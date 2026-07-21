// api/chat.js
// «Кім болам?» AI кеңесшісі — Vercel serverless function.
// Бұл файл ANTHROPIC_API_KEY-ды сервер жағында сақтайды, клиентке ешқашан шықпайды.
//
// Деплой: vercel env кестесінде ANTHROPIC_API_KEY орнатылуы керек.
// Frontend осы endpoint-ке POST жібереді: /api/chat

const specialtiesKey = require('../data/specialties-key.json');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');

const SPEC_BY_CODE = {};
specialtiesKey.forEach(s => { SPEC_BY_CODE[s.code] = s; });

const KLIMOV_DESC = {
  'Табиғат': 'тірі табиғатпен (өсімдік, жануар)',
  'Техника': 'техникамен (машина, механизм)',
  'Адам': 'адамдармен (оқыту, көмек, қарым-қатынас)',
  'Таңба': 'таңбалық жүйемен (сан, мәтін, код)',
  'Көркем': 'көркем бейнемен (өнер, дизайн)'
};

function buildSystemPrompt(profile) {
  const { hollandCode, hollandNames, klimovTop, mbtiType, topSpecialties, confidence } = profile || {};

  const specLines = (topSpecialties || []).map(code => {
    const s = SPEC_BY_CODE[code];
    if (!s) return null;
    return `- ${s.n} (код ${s.code}, ҰБТ таңдау пәні: ${s.subj}, Holland: ${s.hol})`;
  }).filter(Boolean).join('\n');

  return `Сен — «Кім болам?» кәсіби бағдар беру платформасының AI кеңесшісісің. Мамандығың — қазақстандық мектеп оқушыларына (8–11 сынып) мамандық пен жоғары оқу орнын таңдау туралы ойлануға көмектесу. Сен Ерқанат Жақсыбаевтың профориентация әдіснамасы негізінде жұмыс істейсің.

## ДЕРЕК КӨЗІ ШЕКТЕУІ (ӨТЕ МАҢЫЗДЫ)
Тек осында берілген ақпаратқа сүйен: оқушының тест нәтижесі және төмендегі мамандықтар тізімі. Университеттердің НАҚТЫ өту балдары, гранттар саны, қабылдау мерзімдері, оқу ақысы туралы дерек бұл жүйеде әлі жоқ. Егер оқушы осыны сұраса — ойдан сан/факт ШЫҒАРМА. Оның орнына: «бұл нақты дерек әлі платформаға қосылған жоқ, ресми universitet сайттарынан немесе univision.kz/egov.kz сияқты ресми көздерден тексеруді ұсынамын» деп адал айт.

## ОҚУШЫНЫҢ ТЕСТ НӘТИЖЕСІ
- Holland коды: ${hollandCode || 'белгісіз'} (${hollandNames || ''})
- Климов бейімділігі: ${(klimovTop || []).map(t => `${t} — ${KLIMOV_DESC[t] || ''}`).join(', ')}
- Мінез типі (Юнг типологиясы, MBTI дәстүрінде): ${mbtiType || 'белгісіз'}
- Сенім деңгейі: ${confidence || 'белгісіз'}
- Сай табылған топ мамандықтар:
${specLines || '(әлі жоқ)'}

## ҮНІҢ МЕН ҰСТАНЫМЫҢ
- Жылы, қолдаушы, бірақ адал және нақты сөйле.
- Ешқашан «дәл осы мамандықты таңда» деп үкім берме. Нұсқаларды салыстыр, артық-кемін көрсет, оқушының өзіне сұрақ қойып, өз ойын дамытуына көмектес.
- Тест нәтижесі — түпкілікті ақиқат емес, шешім қолдау құралы ғана екенін ұмытпа. Оқушы нәтижемен келіспесе немесе басқа мамандыққа қызығатынын айтса, мұны сыйла, «сен білесің, тест тек бір көрсеткіш» деп еркіндік бер.
- Нақты, қысқа жауап бер (әдетте 3-6 сөйлем), тым ұзақ дәріс оқыма.

## ҚАУІПСІЗДІК ЕРЕЖЕЛЕРІ
- Әңгімелесушің көбі — кәмелетке толмаған бала. Отбасылық қысым, қатты алаңдаушылық, дағдарыс белгілерін (депрессия, өзіне зиян ойлары және т.б.) байқасаң — сен психолог емессің, дереу мұғаліммен, ата-анамен немесе маман психологпен сөйлесуге жұмсақ түрде кеңес бер.
- Оқушыны платформаға немесе өзіңе шектен тыс «тәуелді» етуге тырыспа — ол нақты адамдармен (ата-ана, мұғалім, профориентолог) кеңесуі керек, сен соны алмастырмайсың, толықтырасың.
- Мансап/білім тақырыбынан тыс ауытқыса, сыпайы түрде негізгі тақырыпқа қайтар.
- Қазақ тілінде жауап бер, тек оқушы басқа тілде жазса, сол тілде жауап бер.`;
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'chat', { max: 15, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { profile, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages өрісі керек' });
      return;
    }
    // keep last 20 turns to bound cost/context
    const trimmed = messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    }));

    const system = buildSystemPrompt(profile);

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
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
    console.error('Chat handler error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
