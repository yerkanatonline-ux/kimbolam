// Локал/Docker dev-сервер. Vercel-де бұл файл қолданылмайды — production-да әр
// api/*.js файлы жеке serverless function болып жұмыс істейді. Мұнда солардың
// дәл сол handler(req,res) функцияларын жай ғана route ретінде іліп қоямыз,
// сондықтан хендлер кодының өзі local/prod арасында бірдей қалады.
require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json({ limit: '1mb' }));

const routes = {
  '/api/chat': require('./api/chat'),
  '/api/essay-coach': require('./api/essay-coach'),
  '/api/goal-mission': require('./api/goal-mission'),
  '/api/create-class': require('./api/create-class'),
  '/api/save-result': require('./api/save-result'),
  '/api/get-class-results': require('./api/get-class-results'),
  '/api/check-code': require('./api/check-code'),
  '/api/broad-suggestions': require('./api/broad-suggestions'),
};

Object.entries(routes).forEach(([path, handler]) => {
  app.all(path, (req, res) => {
    Promise.resolve(handler(req, res)).catch(err => {
      console.error(`Unhandled error in ${path}:`, err);
      if (!res.headersSent) res.status(500).json({ error: 'Ішкі қате болды.' });
    });
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, driver: process.env.DB_DRIVER === 'supabase' ? 'supabase' : 'sqlite' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  const driver = process.env.DB_DRIVER === 'supabase' ? 'supabase' : 'sqlite';
  console.log(`Кім болам? backend :${port} (DB_DRIVER=${driver})`);
});
