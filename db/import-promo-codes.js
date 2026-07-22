// Промокодтарды CSV-ден дерекқорға жүктейді (идемпотентті — бар кодты аттап кетеді).
// Локалда SQLite-қа, продта Postgres-қа жүктейді (DB_DRIVER арқылы таңдалады).
//
// Қолдану:
//   node db/import-promo-codes.js                        # әдепкі CSV жол
//   node db/import-promo-codes.js path/to/codes.csv      # басқа файл
//   DB_DRIVER=supabase node db/import-promo-codes.js      # продқа (env керек)
//
// CSV пішімі: бірінші баған = код (шапка "code", оны аттаймыз). Қалған бағандар (used,...) еленбейді —
// импорт әрқашан used=false күйінде қосады.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./index');

// Дереккөз — db/promo-codes.json (машина оқитын тізім). Қаласаң, бірінші аргументпен
// басқа CSV файл беруге болады.
const argPath = process.argv[2];

function loadCodes() {
  if (argPath) {
    const raw = fs.readFileSync(argPath, 'utf8');
    return raw.split(/\r?\n/).map(l => l.split(',')[0].trim())
      .filter(Boolean).filter(c => c.toLowerCase() !== 'code');
  }
  return require('./promo-codes.json');
}

async function main() {
  const codes = loadCodes();
  if (!codes.length) {
    console.error('Код тізімі бос.');
    process.exit(1);
  }
  const { added } = await db.importPromoCodes(codes);
  const driver = process.env.DB_DRIVER === 'supabase' ? 'supabase' : 'sqlite';
  console.log(`[${driver}] CSV-де ${codes.length} код, жаңадан қосылды: ${added} (қалғаны бұрыннан бар).`);
}

main().catch(err => { console.error('Импорт қатесі:', err); process.exit(1); });
