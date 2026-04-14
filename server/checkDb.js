const { getDb } = require('./db');
(async () => {
  const db = await getDb();
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  console.log(tables);
})();
