// api/save-result.js
// Оқушы тестті аяқтағанда шақырылады — нәтижені дерекқорға жазады
// (локалда SQLite, продта Supabase — backend/db/index.js арқылы таңдалады).
const db = require('../db');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'save-result', { max: 20, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const {
      studentName, classCode,
      hollandCode, hollandScores, klimovTop, mbtiType, confidence, matchedSpecialties,
    } = req.body || {};

    if (!studentName || !studentName.trim()) {
      res.status(400).json({ error: 'studentName өрісі керек' });
      return;
    }

    // classCode берілсе — сол кодтың шынымен бар-жоғын тексереміз (қате код жазса, үнсіз "жеке" болып сақталады)
    let validClassCode = null;
    if (classCode && classCode.trim()) {
      const cls = await db.findClassByCode(classCode.trim().toUpperCase());
      validClassCode = cls ? cls.code : null;
    }

    const saved = await db.insertTestResult({
      studentName: studentName.trim(),
      classCode: validClassCode,
      hollandCode, hollandScores, klimovTop, mbtiType, confidence, matchedSpecialties,
    });

    res.status(200).json({ id: saved.id, savedAt: saved.createdAt, linkedToClass: !!validClassCode });
  } catch (err) {
    console.error('save-result error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
