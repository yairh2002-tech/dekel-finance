# dekel-finance

מערכת ליווי פיננסי לעסק. האתר מתפרסם אוטומטית ב-Netlify מהענף `main`.

- `index.html` — המערכת כולה (קובץ אחד). הנתונים, הכניסה והחשבוניות נשמרים ב-Supabase.
- `netlify.toml` — הגדרות פרסום: בלי שלב בנייה, הקובץ מתפרסם כמו שהוא.

עדכונים למערכת נעשים כאן, ו-Netlify מפרסם אותם תוך כדקה.

קריאת חשבוניות: `netlify/functions/claude.mjs`, עם המפתח ANTHROPIC_API_KEY שמוגדר ב-Netlify.
