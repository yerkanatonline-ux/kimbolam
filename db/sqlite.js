// Локал драйвер — SQLite (better-sqlite3). Тек local dev/Docker үшін.
// Прод үшін ./supabase.js қолданылады (DB_DRIVER=supabase).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'local.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  create table if not exists classes (
    id text primary key,
    code text unique not null,
    teacher_code text unique not null,
    school_name text,
    class_name text,
    created_at text not null
  );
  create table if not exists test_results (
    id text primary key,
    created_at text not null,
    student_name text not null,
    class_code text,
    student_class text,
    promo_code text,
    holland_code text,
    holland_scores text,
    klimov_top text,
    mbti_type text,
    confidence text,
    matched_specialties text
  );
  create index if not exists idx_test_results_class_code on test_results(class_code);
  create index if not exists idx_test_results_created_at on test_results(created_at);
  create table if not exists promo_codes (
    code text primary key,
    used integer not null default 0,
    used_by text,
    used_at text
  );
`);

// Бұрыннан бар test_results кестесіне жаңа бағандарды идемпотентті қосу
// (SQLite-та ADD COLUMN IF NOT EXISTS сенімді емес, сондықтан pragma арқылы тексереміз).
(function ensureColumns() {
  const cols = db.prepare(`pragma table_info(test_results)`).all().map(c => c.name);
  if (!cols.includes('student_class')) db.exec(`alter table test_results add column student_class text`);
  if (!cols.includes('promo_code')) db.exec(`alter table test_results add column promo_code text`);
})();

function nowIso() { return new Date().toISOString(); }

function classRowToObj(row) {
  if (!row) return null;
  return {
    code: row.code,
    teacherCode: row.teacher_code,
    schoolName: row.school_name,
    className: row.class_name,
    createdAt: row.created_at,
  };
}

async function createClass({ schoolName, className, code, teacherCode }) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`insert into classes (id, code, teacher_code, school_name, class_name, created_at)
    values (?,?,?,?,?,?)`).run(id, code, teacherCode, schoolName || null, className, createdAt);
  return { code, teacherCode, schoolName: schoolName || null, className, createdAt };
}

async function codeExists(code) {
  return !!db.prepare(`select 1 from classes where code = ?`).get(code);
}

async function teacherCodeExists(teacherCode) {
  return !!db.prepare(`select 1 from classes where teacher_code = ?`).get(teacherCode);
}

async function findClassByCode(code) {
  return classRowToObj(db.prepare(`select * from classes where code = ?`).get(code));
}

async function findClassByTeacherCode(teacherCode) {
  return classRowToObj(db.prepare(`select * from classes where teacher_code = ?`).get(teacherCode));
}

async function insertTestResult(r) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`insert into test_results
      (id, created_at, student_name, class_code, student_class, promo_code, holland_code, holland_scores, klimov_top, mbti_type, confidence, matched_specialties)
      values (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      id, createdAt, r.studentName, r.classCode || null, r.studentClass || null, r.promoCode || null,
      r.hollandCode || null,
      r.hollandScores ? JSON.stringify(r.hollandScores) : null,
      r.klimovTop ? JSON.stringify(r.klimovTop) : null,
      r.mbtiType || null, r.confidence || null,
      r.matchedSpecialties ? JSON.stringify(r.matchedSpecialties) : null,
    );
  return { id, createdAt };
}

// --- Промокодтар (платный доступ) ---

// Гейтте: код бар ма, әлі қолданылмаған ба? {valid, reason} қайтарады.
async function checkPromoCode(code) {
  const row = db.prepare(`select code, used from promo_codes where code = ?`).get(code);
  if (!row) return { valid: false, reason: 'not_found' };
  if (row.used) return { valid: false, reason: 'used' };
  return { valid: true };
}

// save-result-те: кодты атомды түрде "қолданылды" деп белгілейміз (CAS).
// SQLite — бір жазушы, сондықтан UPDATE ... WHERE used=0 атомды.
// { consumed } қайтарады: true — біз енді ғана белгіледік, false — код жоқ/бұрын қолданылған.
async function consumePromoCode(code, usedBy) {
  const info = db.prepare(
    `update promo_codes set used = 1, used_by = ?, used_at = ? where code = ? and used = 0`,
  ).run(usedBy || null, nowIso(), code);
  return { consumed: info.changes > 0 };
}

// Массовый импорт (import-promo-codes.js қолданады). Бар кодты аттап кетеді.
async function importPromoCodes(codes) {
  const stmt = db.prepare(`insert or ignore into promo_codes (code, used) values (?, 0)`);
  const tx = db.transaction((list) => {
    let added = 0;
    for (const c of list) { if (stmt.run(c).changes > 0) added++; }
    return added;
  });
  return { added: tx(codes) };
}

async function getResultsByClassCode(code) {
  const rows = db.prepare(`
    select id, created_at, student_name, holland_code, mbti_type, confidence, matched_specialties
    from test_results where class_code = ? order by created_at desc
  `).all(code);
  return rows.map(r => ({
    id: r.id,
    created_at: r.created_at,
    student_name: r.student_name,
    holland_code: r.holland_code,
    mbti_type: r.mbti_type,
    confidence: r.confidence,
    matched_specialties: r.matched_specialties ? JSON.parse(r.matched_specialties) : null,
  }));
}

module.exports = {
  createClass, codeExists, teacherCodeExists,
  findClassByCode, findClassByTeacherCode,
  insertTestResult, getResultsByClassCode,
  checkPromoCode, consumePromoCode, importPromoCodes,
};
