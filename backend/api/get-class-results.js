// api/get-class-results.js
// Мұғалім сыныптың нәтижелерін көреді. ЕСКЕРТУ: бұрын бұл endpoint оқушыларға
// таратылатын `classCode`-тың өзімен ашылатын — яғни кез келген оқушы өз
// сыныбының коды арқылы сыныптастарының аты-жөнін/нәтижесін көре алатын.
// Енді тек мұғалімге ғана берілетін құпия `teacherCode` талап етіледі
// (create-class.js жасайды, оқушыларға ешқашан көрсетілмейді).
const db = require('../db');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // teacherCode кеңістігі үлкен болса да, brute-force әрекетін қиындату үшін қатаң лимит
  if (!rateLimit(req, 'get-class-results', { max: 10, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { teacherCode } = req.body || {};
    if (!teacherCode || !teacherCode.trim()) {
      res.status(400).json({ error: 'teacherCode өрісі керек' });
      return;
    }

    const cls = await db.findClassByTeacherCode(teacherCode.trim().toUpperCase());
    if (!cls) { res.status(404).json({ error: 'Мұндай мұғалім коды табылмады' }); return; }

    const results = await db.getResultsByClassCode(cls.code);
    res.status(200).json({
      class: { code: cls.code, className: cls.className, schoolName: cls.schoolName },
      results,
    });
  } catch (err) {
    console.error('get-class-results error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
