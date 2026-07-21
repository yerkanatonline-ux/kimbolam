// «Кім болам?» — Google Apps Script backend (Vercel/Supabase орнына, жедел іске қосу үшін)
// Осы файлды Google Sheet-тің Extensions → Apps Script ішіне қойыңыз.
//
// Sheet-те 2 бет болу керек:
//   Codes:   code | used | used_by | used_at
//   Results: timestamp | class | name | code | hollandCode | klimovTop | mbtiType | confidence | topSpecialties
//
// GEMINI_API_KEY — aistudio.google.com/apikey алған кілт (тек «Кеңірек қарасаң»
// бөлімі үшін керек, checkCode/submitResult одан тәуелсіз жұмыс істейді).
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'checkCode') {
    return checkCode_(e.parameter.code);
  }
  return json_({ ok: false, error: 'Белгісіз action' });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (body.action === 'submitResult') {
    return submitResult_(body);
  }
  if (body.action === 'suggestBroad') {
    return suggestBroad_(body);
  }
  return json_({ ok: false, error: 'Белгісіз action' });
}

function checkCode_(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return json_({ valid: false, reason: 'empty' });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Codes');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowCode = String(data[i][0] || '').trim().toUpperCase();
    if (rowCode === code) {
      const used = data[i][1];
      if (used) return json_({ valid: false, reason: 'used' });
      return json_({ valid: true });
    }
  }
  return json_({ valid: false, reason: 'not_found' });
}

function submitResult_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const codesSheet = ss.getSheetByName('Codes');
    const data = codesSheet.getDataRange().getValues();

    const code = String(body.promoCode || '').trim().toUpperCase();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toUpperCase() === code) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return json_({ ok: false, error: 'Промокод табылмады' });
    if (data[rowIndex][1]) return json_({ ok: false, error: 'Промокод бұрын қолданылған' });

    const now = new Date();

    const resultsSheet = ss.getSheetByName('Results');
    resultsSheet.appendRow([
      now,
      body.className || '',
      body.studentName || '',
      code,
      body.hollandCode || '',
      (body.klimovTop || []).join(', '),
      body.mbtiType || '',
      body.confidence || '',
      JSON.stringify(body.matchedSpecialties || []),
    ]);

    codesSheet.getRange(rowIndex + 1, 2, 1, 3).setValues([[true, body.studentName || '', now]]);

    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function suggestBroad_(body) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    return json_({ ok: false, error: 'GEMINI_API_KEY орнатылмаған' });
  }

  const prompt = 'Сен қазақстандық мектеп оқушысына арналған профориентация көмекшісісің.\n' +
    'Оқушының тест профилі:\n' +
    '- Holland коды: ' + (body.hollandCode || 'белгісіз') + '\n' +
    '- Климов бейімділігі: ' + ((body.klimovTop || []).join(', ') || 'белгісіз') + '\n' +
    '- Мінез типі (MBTI дәстүрінде): ' + (body.mbtiType || 'белгісіз') + '\n\n' +
    'Ресми БББТ 117 мамандық тізімімен ШЕКТЕЛМЕ — қазіргі еңбек нарығындағы кез келген ' +
    'заманауи мамандықты/рөлді ұсына аласың (IT, бизнес, креативті сала, т.б.).\n' +
    'Дәл 6 мамандық ұсын. ТЕК JSON массив қайтар, басқа мәтінсіз, дәл мына форматта:\n' +
    '[{"n":"мамандық атауы","why":"неге сәйкес, 1 қысқа сөйлем қазақша"}]';

  const res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      muteHttpExceptions: true,
    }
  );

  const status = res.getResponseCode();
  if (status !== 200) {
    return json_({ ok: false, error: 'Gemini API қатесі (' + status + ')' });
  }

  try {
    const data = JSON.parse(res.getContentText());
    const text = data.candidates[0].content.parts[0].text;
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const list = JSON.parse(cleaned);
    return json_({ ok: true, list });
  } catch (err) {
    return json_({ ok: false, error: 'Жауапты өңдеу қатесі' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
