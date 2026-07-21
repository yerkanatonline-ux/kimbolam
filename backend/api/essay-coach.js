// api/essay-coach.js
// «Кім болам?» мотивациялық эссе көмекшісі — Vercel serverless function.
// AI кеңесшімен бірдей принцип: ANTHROPIC_API_KEY сервер жағында сақталады.
//
// ЕКІ РЕЖИМ:
//   'coach' (әдепкі) — AI ешқашан толық эссе жазбайды, тек бағыттаушы сұрақ қояды
//                       және студенттің өз жобасына кері байланыс береді.
//   'full_draft'      — студент НАҚТЫ, ашық түрде сұрағанда ғана іске қосылады;
//                       AI толық үлгі жазады, бірақ оны "бастапқы нұсқа, өз сөзіңмен
//                       қайта жаз" деп қатаң түрде белгілейді (адалдық үшін).

const specialtiesKey = require('../data/specialties-key.json');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');
const SPEC_BY_CODE = {};
specialtiesKey.forEach(s => { SPEC_BY_CODE[s.code] = s; });

function buildSystemPrompt(profile, essayContext, mode) {
  const { hollandCode, hollandNames, topSpecialties, mbtiType } = profile || {};
  const specLines = (topSpecialties || []).map(code => {
    const s = SPEC_BY_CODE[code];
    return s ? `${s.n} (${s.code})` : null;
  }).filter(Boolean).join(', ');

  const base = `Сен — «Кім болам?» платформасының мотивациялық эссе көмекшісісің. Ерқанат Жақсыбаевтың кітабындағы «Тану» бөлімінің рухында жұмыс істейсің: алдымен өзін-өзі түсіну, содан кейін ғана жазу.

## СТУДЕНТТІҢ ПРОФИЛІ
- Holland коды: ${hollandCode || 'белгісіз'} (${hollandNames || ''})
- Мінез типі: ${mbtiType || 'белгісіз'}
- Сай табылған мамандықтар: ${specLines || 'белгісіз'}

## ЭССЕ КОНТЕКСТІ
- Не үшін жазылады: ${(essayContext && essayContext.purpose) || 'көрсетілмеген'}
- Мақсатты сала/мамандық: ${(essayContext && essayContext.field) || 'көрсетілмеген'}

## ДЕРЕК ШЕКТЕУІ
Тек студент өзі айтқан фактілерге және жоғарыдағы тест профиліне сүйен. Студенттің басынан
өткен нақты оқиғаларды, жетістіктерін ойдан шығарма — егер білмесең, сұра.`;

  if (mode === 'full_draft') {
    return base + `

## РЕЖИМ: ТОЛЫҚ ҮЛГІ (тек студент нақты сұрағанда іске қосылады)
Студент толық эссе үлгісін сұрады. Жаз, бірақ:
- Жазбаның ЕҢ БАСЫНДА үлкен әріппен ескерт: «БҰЛ — ТЕК БАСТАПҚЫ ҮЛГІ. Оны сол қалпында ешқашан
  тапсырма — өз сөзіңмен, өз тәжірибеңмен толық қайта жаз, әйтпесе бұл сенің дауысың болмайды
  және комиссия мұны бірден байқайды.»
- Мәтінді студенттің НАҚТЫ тест профиліне және айтқан ақпаратына сүйеніп жаз, жалпы/generic үлгі емес.
- Жазба құрылымы: қызықты кіріспе (hook), жеке байланыс/оқиға, нақты сала/мамандыққа неге сай
  екені, нақты мақсаттар, қорытынды.
- 250–350 сөз шамасында, қазақ тілінде.`;
  }

  return base + `

## РЕЖИМ: БАҒЫТТАУШЫ (әдепкі — ЕШҚАШАН толық эссе жазба)
- Толық эссе МӘТІНІН ЕШҚАШАН өзіңнен жазба, тіпті сұрамаса да ұсынба.
- Орнына: студенттің тест профиліне сай, нақты, ойландыратын сұрақтар қой (мыс. «сен ISA
  профилі бойынша Психологияға бейімсің — неге дәл осы сала сені қызықтырды? Нақты бір сәтті
  еске түсір»).
- Егер студент өз жобасын (черновик) жіберсе — оны толық қайта жазба. Оның орнына: қай бөлігі
  күшті, қай бөлігі тым жалпы/generic, қайда нақты мысал жетіспейді — соны көрсет. 3-5 нақты
  ұсыныс жеткілікті.
- Жылы, қолдаушы, бірақ адал бол. Жалған мақтау берме.
- Егер студент НАҚТЫ, ашық түрде «толық нұсқасын жаз», «мысал жаз», «өзің жаз» десе — оған
  «Мен саған толық үлгі жаза аламын, бірақ есіңде болсын: оны сол қалпында тапсыруға болмайды,
  тек бастапқы нүкте ретінде. Жалғастырайын ба?» деп нақтылап сұра, содан кейін ғана жаз.
- Қазақ тілінде жауап бер.`;
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'essay-coach', { max: 15, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { profile, essayContext, messages, mode } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages өрісі керек' });
      return;
    }
    const trimmed = messages.slice(-24).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 6000),
    }));

    const system = buildSystemPrompt(profile, essayContext, mode === 'full_draft' ? 'full_draft' : 'coach');

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: mode === 'full_draft' ? 1200 : 700,
        system,
        messages: trimmed,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      res.status(502).json({ error: 'AI қызметі уақытша қолжетімсіз, кейінірек қайталап көріңіз.' });
      return;
    }

    const data = await apiRes.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const reply = textBlock ? textBlock.text : 'Кешіріңіз, жауап құра алмадым, қайталап көріңізші.';

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Essay coach handler error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
