# AI кеңесші — backend

Бұл — Vercel serverless function, тек бір мақсат үшін: Anthropic API кілтін сервер жағында сақтап,
клиентке (kimbolam.html) жария етпей, чат сұранысын өткізу (proxy).

## Неге backend керек?
API кілтін ешқашан клиент кодына (браузерде жұмыс істейтін JS-ке) салуға болмайды —
кез келген адам "беттің қайнар көзін көру" арқылы оны көріп, өз есебінен пайдалана алады.

## Деплой қадамдары (Vercel, тегін тариф жеткілікті)

1. https://vercel.com сайтында тіркеліңіз (GitHub аккаунтпен кіруге болады).
2. Терминалда осы `backend/` қалтасында:
   ```
   npm install -g vercel
   vercel login
   vercel
   ```
3. Vercel сұрағанда: жоба атын растаңыз, "Link to existing project? No", әдепкі баптауларды қабылдаңыз.
4. Деплой аяқталғанда Vercel сізге URL береді, мыс: `https://kim-bolam-ai.vercel.app`
5. **API кілтті орнату**: Vercel дашбордында → жобаңыз → Settings → Environment Variables →
   `ANTHROPIC_API_KEY` = сіздің Anthropic Console-дан алған кілтіңіз (https://console.anthropic.com/settings/keys)
6. Кілтті қосқаннан кейін қайта деплой қажет: `vercel --prod`

## Тексеру

```bash
curl -X POST https://your-deploy-url.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"profile":{"hollandCode":"SIA","hollandNames":"Көмекші, Аналитик, Креатор","klimovTop":["Адам"],"mbtiType":"ENFJ","topSpecialties":["B041"],"confidence":"Жоғары"},"messages":[{"role":"user","content":"Психология маған сай ма?"}]}'
```

## Frontend жағында не істеу керек?
`kimbolam.html` ішінде `AI_API_URL` айнымалысын деплой URL-іңізге ауыстыру керек
(файлдың басында, config бөлімінде). Толығырақ негізгі README-де.
