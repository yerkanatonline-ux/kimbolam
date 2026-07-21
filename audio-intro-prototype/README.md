# Дауыстық кіріспе — прототип

## Файлдар
- `index.html` — прототип беті (робот + сөйлеу/субтитр логикасы)
- `generate-audio.js` — Azure Speech API арқылы қазақша дауысты (kk-KZ-DauletNeural) MP3 файлдарына бір рет айналдыратын скрипт
- `audio/` — генерацияланған MP3 файлдар осында жиналады

## Іске қосу қадамдары

1. Azure тіркелгісі ашыңыз: https://portal.azure.com (тегін деңгей бар)
2. "Speech service" (Cognitive Services) ресурсын жасаңыз, region мысалы "westeurope"
3. "Keys and Endpoint" бөлімінен кілт пен region-ды алыңыз
4. Терминалда:
   ```
   cd audio-intro-prototype
   AZURE_SPEECH_KEY=сіздің_кілтіңіз AZURE_SPEECH_REGION=westeurope node generate-audio.js
   ```
5. `audio/` қалтасында 12 MP3 файл пайда болады
6. `index.html`-ды ашыңыз — енді нақты Azure дауысымен сөйлейді

## Сақтық тізбегі (fallback)
1. **Ең жақсы**: `audio/intro-XX.mp3` файлдары табылса — солар ойнатылады (Azure kk-KZ-DauletNeural)
2. Табылмаса: браузердің өз дауысы (қазақша болса — қазақша, болмаса орысша)
3. Ол да болмаса: субтитр режимі (дауыссыз, уақыт бойынша)

Диагностика панелі бетте төменде — нақты не болып жатқанын көрсетеді.
