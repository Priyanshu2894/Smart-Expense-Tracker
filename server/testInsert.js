const { getDb } = require('./db');
(async () => {
    try {
        const db = await getDb();
        const date = "2026-04-14";
        const category = "Exam Form";
        const amount = "-1000";
        const isRecurringInt = 0;
        const result = await db.run(
          'INSERT INTO expenses (user_id, date, category, amount, is_recurring) VALUES (?, ?, ?, ?, ?)',
          [1, date, category, parseFloat(amount), isRecurringInt]
        );
        console.log("Success:", result);
    } catch(e) {
        console.error("FAILED:", e.message);
    }
})();
