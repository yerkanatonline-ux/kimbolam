// Интеграциялық тест — жақтаусыз, таза Node (жобаның стилі бойынша).
// Уақытша SQLite дерекқорға нақты endpoint'терді тексереді (гейт → тест → сақтау → мұғалім).
// Іске қосу:  npm test
//
// AI (broad-suggestions) нақты API-ге бармайды — global fetch мокталады.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');

// --- Изоляция: уақытша SQLite файл, sqlite драйвер ---
const tmpDb = path.join(os.tmpdir(), `kimbolam-test-${process.pid}.db`);
for (const ext of ['', '-shm', '-wal']) { try { fs.unlinkSync(tmpDb + ext); } catch {} }
process.env.SQLITE_PATH = tmpDb;
delete process.env.DB_DRIVER; // sqlite

const db = require('../db');

// --- global fetch мок: anthropic.com-ды ұстап қалады, қалғанын нақты жібереді ---
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('anthropic.com') || u.includes('openai.com')) {
    const list = Array.from({ length: 6 }, (_, i) => ({ n: `Рөл ${i + 1}`, why: 'себебі' }));
    const isOpenAI = u.includes('openai.com');
    const body = isOpenAI
      ? { choices: [{ message: { content: JSON.stringify(list) } }] }
      : { content: [{ type: 'text', text: JSON.stringify(list) }] };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  }
  return realFetch(url, opts);
};

// --- Тест app (server.js-тегі маршруттардың дәл көшірмесі) ---
const app = express();
app.use(express.json({ limit: '1mb' }));
const routes = {
  '/api/check-code': require('../api/check-code'),
  '/api/save-result': require('../api/save-result'),
  '/api/create-class': require('../api/create-class'),
  '/api/get-class-results': require('../api/get-class-results'),
  '/api/broad-suggestions': require('../api/broad-suggestions'),
};
Object.entries(routes).forEach(([p, h]) => app.all(p, (req, res) =>
  Promise.resolve(h(req, res)).catch(e => { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'x' }); })));

// --- Кішкентай тест харнесі ---
let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function main() {
  await db.importPromoCodes(['KB-TEST1', 'KB-TEST2']);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (p, body) => {
    const r = await realFetch(base + p, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: r.status, json: await r.json() };
  };

  console.log('check-code:');
  ok((await post('/api/check-code', { code: 'KB-TEST1' })).json.valid === true, 'жарамды код → valid');
  ok((await post('/api/check-code', { code: 'KB-NOPE' })).json.reason === 'not_found', 'жоқ код → not_found');
  ok((await post('/api/check-code', {})).status === 400, 'бос код → 400');

  console.log('create-class → get-class-results:');
  const cls = (await post('/api/create-class', { className: '9 Ә', schoolName: '№1 мектеп' })).json;
  ok(cls.code && cls.teacherCode, 'класс жасалды (code + teacherCode)');

  console.log('save-result:');
  const save1 = await post('/api/save-result', {
    studentName: 'Айдана', promoCode: 'KB-TEST1', classCode: cls.code,
    studentClass: '9 Ә', hollandCode: 'ISA', hollandScores: { I: 90 },
    klimovTop: ['Адам'], mbtiType: 'INFP', confidence: 'Жоғары',
    matchedSpecialties: [{ code: 'B041', n: 'Психология', pct: 98 }],
  });
  ok(save1.status === 200 && save1.json.promoConsumed === true, 'нәтиже сақталды + промокод қолданылды');
  ok(save1.json.linkedToClass === true, 'класс кодына байланды');
  ok((await post('/api/save-result', { promoCode: 'KB-TEST1' })).status === 400, 'аты жоқ → 400');

  console.log('промокод қайта пайдалану:');
  ok((await post('/api/check-code', { code: 'KB-TEST1' })).json.reason === 'used', 'қолданылған код → used');
  const save2 = await post('/api/save-result', { studentName: 'Басқа', promoCode: 'KB-TEST1' });
  ok(save2.status === 200 && save2.json.promoConsumed === false, 'қолданылған кодпен де нәтиже САҚТАЛАДЫ (жұмыс жоғалмайды)');

  console.log('teacher dashboard:');
  const rz = await post('/api/get-class-results', { teacherCode: cls.teacherCode });
  ok(rz.status === 200 && Array.isArray(rz.json.results) && rz.json.results.length === 1, 'мұғалім кодымен нәтиже тізімі');
  ok(rz.json.results[0].student_name === 'Айдана', 'дұрыс оқушы');
  ok((await post('/api/get-class-results', { teacherCode: 'T-WRONG-CODE' })).status === 404, 'қате teacherCode → 404');

  console.log('broad-suggestions (AI мокталған):');
  const broad = await post('/api/broad-suggestions', { hollandCode: 'ISA', klimovTop: ['Адам'], mbtiType: 'INFP' });
  ok(broad.json.ok === true && broad.json.list.length === 6, '6 рөл қайтарды');

  await new Promise(r => server.close(r));
  for (const ext of ['', '-shm', '-wal']) { try { fs.unlinkSync(tmpDb + ext); } catch {} }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('Тест қатесі:', e); process.exit(1); });
