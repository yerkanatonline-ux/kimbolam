// Дерекқор абстракциясы: api/*.js файлдары осы модульді шақырады,
// нақты драйвер (sqlite — локал, supabase — прод) DB_DRIVER env арқылы таңдалады.
// Екі драйвер де бірдей интерфейсті қайтарады, сондықтан деплой кезінде
// api/*.js ешбір өзгеріссіз қалады — тек .env-де DB_DRIVER=supabase қою жеткілікті.

module.exports = process.env.DB_DRIVER === 'supabase'
  ? require('./supabase')
  : require('./sqlite');
