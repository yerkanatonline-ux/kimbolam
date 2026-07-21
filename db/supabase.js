// Прод драйвер — Supabase (Postgres). DB_DRIVER=supabase болғанда қолданылады.
// Интерфейсі ./sqlite.js-пен бірдей — api/*.js файлдары айырмашылықты білмейді.
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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
};
