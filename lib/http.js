// Барлық api/*.js хендлерлері қолданатын ортақ көмекшілер: CORS және rate limit.
// Vercel-де де, локал Express dev-серверде де бірдей жұмыс істейді (req/res сигнатурасы бірдей).

// --- CORS ---
// ALLOWED_ORIGIN env-де көрсетілмесе — '*' (әдепкі, ескі мінез). Production-да
// нақты доменді (мыс. https://kimbolam.kz,http://localhost:8080) көрсету ұсынылады.
function applyCors(req, res) {
  const raw = process.env.ALLOWED_ORIGIN || '*';
  const allowed = raw.split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;

  if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// OPTIONS preflight-ті аяқтайды. true қайтарса — хендлер шақырушысы дереу return жасауы керек.
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
}

// --- Rate limit (жады ішінде, IP бойынша) ---
// ЕСКЕРТУ: бұл тек локал/бір-процесс жағдайда толық жұмыс істейді (Docker, dev server).
// Vercel serverless-те warm instance-тер арасында ортақ емес — толық қорғаныс үшін
// production-да Upstash Redis сияқты сыртқы store қажет. Қазір ол — "best effort" қорғаныс.
const buckets = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimit(req, key, { max = 20, windowMs = 60000 } = {}) {
  const bucketKey = key + ':' + clientIp(req);
  const now = Date.now();
  const b = buckets.get(bucketKey);
  if (!b || now > b.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

function tooManyRequests(res) {
  res.status(429).json({ error: 'Тым жиі сұраныс жіберілді. Сәл күте тұрып, қайталап көріңіз.' });
}

module.exports = { applyCors, handlePreflight, rateLimit, tooManyRequests, clientIp };
