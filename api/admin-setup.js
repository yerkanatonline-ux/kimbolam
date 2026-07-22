// api/admin-setup.js — УАҚЫТША, БІР РЕТТІК орнату эндпойнті (қолданғаннан кейін ЖОЙЫЛАДЫ).
// Прод БД-да: (1) кестелерді құру/жаңарту (migrate), (2) промокодтарды жүктеу (сұраныс
// денесінен — коды публичті репоға салынбайды), (3) қай env бар екенін хабарлау (тек бар/жоқ).
//
// DB_DRIVER-ден тәуелсіз: migrate тікелей pg-мен, импорт тікелей supabase драйверімен.
const { runMigration, seedPromoCodes } = require('../db/migrate');

const TOKEN = 'setup-kb-2026-7f3a9c'; // уақытша, эндпойнтпен бірге жойылады

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const token = (req.query && req.query.token) || (req.body && req.body.token);
  if (token !== TOKEN) { res.status(403).json({ error: 'forbidden' }); return; }

  const env = {
    DB_DRIVER: process.env.DB_DRIVER || '(unset)',
    SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    POSTGRES_URL_NON_POOLING: !!(process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL),
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  };

  const out = { ok: true, env };

  try {
    out.migrate = await runMigration();
  } catch (e) {
    out.migrate = { ok: false, error: String(e && e.message || e) };
  }

  // Промокодтар тек сұраныс денесінен (body.codes = ["KB-....", ...]) — репода жоқ.
  // Тікелей pg арқылы жүктейміз (PostgREST кэшіне тәуелсіз).
  const codes = (req.body && Array.isArray(req.body.codes)) ? req.body.codes : null;
  if (codes && codes.length) {
    try {
      out.import = await seedPromoCodes(codes);
    } catch (e) {
      out.import = { ok: false, error: String(e && e.message || e) };
    }
  } else {
    out.import = { skipped: 'body.codes берілмеді' };
  }

  res.status(200).json(out);
};
