// Прод драйвер — Supabase (Postgres). DB_DRIVER=supabase болғанда қолданылады.
// Интерфейсі ./sqlite.js-пен бірдей — api/*.js файлдары айырмашылықты білмейді.
const { createClient } = require('@supabase/supabase-js');

// Vercel-дың Supabase интеграциясы айнымалыларды NEXT_PUBLIC_ префиксімен қосады
// (NEXT_PUBLIC_SUPABASE_URL), ал қолмен қосқанда SUPABASE_URL болуы мүмкін —
// екеуін де қабылдаймыз. Кілт үшін де солай (SERVICE_ROLE_KEY / SECRET_KEY).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function rowToObj(row) {
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
  const { data, error } = await supabase
    .from('classes')
    .insert({ code, teacher_code: teacherCode, school_name: schoolName || null, class_name: className })
    .select()
    .single();
  if (error) throw error;
  return rowToObj(data);
}

async function codeExists(code) {
  const { data } = await supabase.from('classes').select('code').eq('code', code).maybeSingle();
  return !!data;
}

async function teacherCodeExists(teacherCode) {
  const { data } = await supabase.from('classes').select('code').eq('teacher_code', teacherCode).maybeSingle();
  return !!data;
}

async function findClassByCode(code) {
  const { data } = await supabase.from('classes').select('*').eq('code', code).maybeSingle();
  return rowToObj(data);
}

async function findClassByTeacherCode(teacherCode) {
  const { data } = await supabase.from('classes').select('*').eq('teacher_code', teacherCode).maybeSingle();
  return rowToObj(data);
}

async function insertTestResult(r) {
  const { data, error } = await supabase
    .from('test_results')
    .insert({
      student_name: r.studentName,
      class_code: r.classCode || null,
      student_class: r.studentClass || null,
      promo_code: r.promoCode || null,
      holland_code: r.hollandCode || null,
      holland_scores: r.hollandScores || null,
      klimov_top: r.klimovTop || null,
      mbti_type: r.mbtiType || null,
      confidence: r.confidence || null,
      matched_specialties: r.matchedSpecialties || null,
    })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return { id: data.id, createdAt: data.created_at };
}

// --- Промокодтар (платный доступ) ---

async function checkPromoCode(code) {
  const { data } = await supabase
    .from('promo_codes').select('code, used').eq('code', code).maybeSingle();
  if (!data) return { valid: false, reason: 'not_found' };
  if (data.used) return { valid: false, reason: 'used' };
  return { valid: true };
}

// Атомды CAS: used=false болғанда ғана true-ге ауыстырады. Postgres UPDATE ...
// WHERE used=false — жалғыз транзакция, race-те тек біреуі жеңеді.
async function consumePromoCode(code, usedBy) {
  const { data, error } = await supabase
    .from('promo_codes')
    .update({ used: true, used_by: usedBy || null, used_at: new Date().toISOString() })
    .eq('code', code)
    .eq('used', false)
    .select('code');
  if (error) throw error;
  return { consumed: Array.isArray(data) && data.length > 0 };
}

async function importPromoCodes(codes) {
  const rows = codes.map(c => ({ code: c, used: false }));
  const { data, error } = await supabase
    .from('promo_codes')
    .upsert(rows, { onConflict: 'code', ignoreDuplicates: true })
    .select('code');
  if (error) throw error;
  return { added: Array.isArray(data) ? data.length : 0 };
}

async function getResultsByClassCode(code) {
  const { data, error } = await supabase
    .from('test_results')
    .select('id, created_at, student_name, holland_code, mbti_type, confidence, matched_specialties')
    .eq('class_code', code)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

module.exports = {
  createClass, codeExists, teacherCodeExists,
  findClassByCode, findClassByTeacherCode,
  insertTestResult, getResultsByClassCode,
  checkPromoCode, consumePromoCode, importPromoCodes,
};
