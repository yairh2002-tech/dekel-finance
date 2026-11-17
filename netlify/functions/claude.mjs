// Reads invoices (and writes the monthly summary) for signed-in members only.
// The Anthropic key lives in the Netlify environment variable ANTHROPIC_API_KEY and never reaches the browser.
const SB_URL = 'https://wrcilpvuksfrhsgcxoau.supabase.co';
const SB_KEY = 'sb_publishable_OlcLF4jfcGptEbzkib3soQ_6mFA3Enb';
const IMG = /^image\/(jpeg|png|webp|gif)$/;
const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});

export default async req => {
  if (req.method !== 'POST') return json({code: 'bad_request'}, 405);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({code: 'not_declared', message: 'ANTHROPIC_API_KEY is not set'}, 503);

  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/.test(auth)) return json({code: 'session_expired'}, 401);
  const sb = {apikey: SB_KEY, authorization: auth};
  try {
    // one call checks both the sign-in token and membership: an invalid token is refused by Supabase
    const m = await fetch(SB_URL + '/rest/v1/rpc/is_member', {method: 'POST', headers: {...sb, 'content-type': 'application/json'}, body: '{}'});
    if (m.status === 401) return json({code: 'session_expired'}, 401);
    if (!m.ok || (await m.json()) !== true) return json({code: 'not_granted'}, 403);
  } catch (e) { console.error('membership check failed', e); return json({code: 'unavailable', message: 'sign-in check failed'}, 502); }

  let body;
  try { body = await req.json(); } catch (e) { return json({code: 'bad_request'}, 400); }
  const prompt = String(body.prompt || '').slice(0, 20000);
  if (!prompt) return json({code: 'bad_request'}, 400);
  const content = (Array.isArray(body.images) ? body.images : []).slice(0, 2)
    .filter(i => i && IMG.test(i.type) && typeof i.data === 'string' && i.data.length < 6_000_000)
    .map(i => ({type: 'image', source: {type: 'base64', media_type: i.type, data: i.data}}));
  content.push({type: 'text', text: prompt});

  let r, d;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000); // Netlify stops functions at 10 seconds
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: body.json ? 600 : 1200, messages: [{role: 'user', content}]})
    });
    d = await r.json().catch(() => ({}));
  } catch (e) { console.error('anthropic call failed', e); return json({code: 'unavailable', message: e && e.name === 'AbortError' ? 'timeout' : 'Anthropic API unreachable'}, 504); }
  finally { clearTimeout(timer); }
  if (!r.ok) console.error('anthropic error', r.status, JSON.stringify(d).slice(0, 500));
  if (r.status === 429 || r.status === 529) return json({code: 'rate_limited'}, 429);
  if (r.status === 401 || r.status === 403) return json({code: 'not_declared', message: 'The Anthropic key was rejected'}, 503);
  if (r.status === 400 && /credit|billing/i.test((d.error && d.error.message) || '')) return json({code: 'not_declared', message: 'No credit on the Anthropic account'}, 503);
  if (!r.ok) return json({code: 'unavailable', message: r.status + ' ' + ((d.error && d.error.message) || 'Anthropic API error')}, 502);
  return json({text: (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('')});
};
