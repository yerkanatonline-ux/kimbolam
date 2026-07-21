# AI кеңесші — сәулет жоспары

1. Backend (Vercel serverless function, Node): api/chat.js
   - ANTHROPIC_API_KEY env var-да сақталады (клиентте ЕШҚАШАН жарияланбайды)
   - Frontend жібереді: {profile: {holland, klimov, mbti, topSpecialties, confidence}, messages: [...]}
   - Backend өз data/specialties-key.json көшірмесінен topSpecialties кодтарын толық ақпаратқа айналдырады
   - System prompt осы деректермен толтырылып, Anthropic Messages API-ға жіберіледі
   - Жауап frontend-ке қайтарылады

2. Frontend (kimbolam.html-ге қосымша):
   - Нәтиже бетінде "AI кеңесші" батырмасы/панелі
   - showResults() ішінде есептелген profile сақталады (window-та)
   - Чат UI: хабарлама тарихы, input, жіберу
