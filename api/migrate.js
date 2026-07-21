// Бір реттік көшу (migration) endpoint-і — Supabase-та кестелерді автоматты құрады.
// Операция идемпотентті әрі деструктивті емес (тек CREATE ... IF NOT EXISTS),
// деректерді ешқашан өшірмейді/оқымайды. Кестелер құрылғаннан кейін бұл файл
// жойылады (схема логикасы db/migrate.js-те қала береді).
// Қауіпсіздік: MIGRATE_SECRET env қойылса — x-migrate-secret тақырыбымен сәйкес келуі шарт.
const { runMigration } = require('../db/migrate');
const { applyCors, handlePreflight } = require('../lib/http');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const secret = process.env.MIGRATE_SECRET;
  if (secret && req.headers['x-migrate-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await runMigration();
    res.status(200).json(result);
  } catch (err) {
    console.error('migrate error:', err);
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
