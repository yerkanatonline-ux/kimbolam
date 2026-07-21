// generate-audio.js
// Бір реттік скрипт: Azure Speech API арқылы «Кім болам?» тестінің
// дауыстық кіріспесін (12 сөйлем) kk-KZ-DauletNeural дауысымен MP3 файлдарына айналдырады.
//
// ҚАЛАЙ ІСКЕ ҚОСУ КЕРЕК:
// 1. Azure тіркелгісі болу керек: https://portal.azure.com (тегін деңгей бар — жаңа
//    есептік жазбаға несиелік карта сұралады, бірақ Speech қызметінің F0 тегін деңгейі
//    ақша алмайды, тек растау үшін карта сұрайды).
// 2. Azure Portal-да "Speech service" (Cognitive Services) ресурсын жасаңыз.
//    Region ретінде "West Europe" немесе "East US" сияқтыны таңдаңыз (кейбір
//    региондарда кейбір дауыстар болмауы мүмкін — kk-KZ-DauletNeural үшін
//    "westeurope" немесе "southeastasia" сенімдірек).
// 3. Ресурс жасалған соң "Keys and Endpoint" бөлімінен KEY1 мен Region-ды көшіріп алыңыз.
// 4. Төмендегі екі айнымалыны толтырыңыз (немесе ENV арқылы беріңіз):
//      AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node generate-audio.js
// 5. Скрипт /audio қалтасына intro-01.mp3 ... intro-12.mp3 файлдарын жазады.
// 6. Дайын болған соң, сол қалтаны платформаның тиісті жеріне көшіріңіз
//    (frontend-де AUDIO_BASE_PATH арқылы көрсетілген жол).

const fs = require('fs');
const path = require('path');
const https = require('https');

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || 'МҰНДА_ӨЗ_КІЛТІҢІЗДІ_ЖАЗЫҢЫЗ';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'westeurope';
const VOICE = 'kk-KZ-DauletNeural';
const OUT_DIR = path.join(__dirname, 'audio');

const SCRIPT = [
  "Сәлем! Мен сенің көмекшіңмін.",
  "Қазір «Кім болам?» тестін бастамақсың.",
  "Алдымен бірнеше маңызды ереже айтайын.",
  "Бұл жерде дұрыс немесе бұрыс жауап жоқ.",
  "Әр сұраққа өзіңе қаншалық шын келетінін ойлан.",
  "Басқаларға ұнау үшін емес, өзің үшін жауап бер.",
  "Тест үш бөлімнен тұрады: қызығушылық, бейімділік, мінез.",
  "Барлығы 72 сұрақ, шамамен 15 минут кетеді.",
  "Асықпа — әр сұраққа мұқият қара.",
  "Соңында саған сай 117 мамандықтың ішінен ең жақынын табамыз.",
  "Нәтиже — үкім емес, өзіңді тануға көмекші құрал.",
  "Дайын болсаң, бастайық!"
];

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com`,
      path: '/sts/v1.0/issuetoken',
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY, 'Content-Length': 0 },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => res.statusCode === 200 ? resolve(data) : reject(new Error('Token error: ' + res.statusCode + ' ' + data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function synthesize(token, text, outPath) {
  const ssml = `<speak version='1.0' xml:lang='kk-KZ'><voice name='${VOICE}'>${text}</voice></speak>`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${AZURE_SPEECH_REGION}.tts.speech.microsoft.com`,
      path: '/cognitiveservices/v1',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'kim-bolam-audio-gen',
      },
    }, res => {
      if (res.statusCode !== 200) { reject(new Error('TTS error: ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { fs.writeFileSync(outPath, Buffer.concat(chunks)); resolve(); });
    });
    req.on('error', reject);
    req.write(ssml);
    req.end();
  });
}

(async () => {
  if (AZURE_SPEECH_KEY === 'МҰНДА_ӨЗ_КІЛТІҢІЗДІ_ЖАЗЫҢЫЗ') {
    console.error('Алдымен AZURE_SPEECH_KEY мен AZURE_SPEECH_REGION орнатыңыз (жоғарыдағы нұсқаулықты оқыңыз).');
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Токен алынуда...');
  const token = await getAccessToken();

  for (let i = 0; i < SCRIPT.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const outPath = path.join(OUT_DIR, `intro-${num}.mp3`);
    console.log(`[${num}/12] Генерацияланып жатыр: "${SCRIPT[i].slice(0, 40)}..."`);
    await synthesize(token, SCRIPT[i], outPath);
  }
  console.log('Дайын! Барлық файл /audio қалтасында: intro-01.mp3 ... intro-12.mp3');
})().catch(err => { console.error('ҚАТЕ:', err.message); process.exit(1); });
