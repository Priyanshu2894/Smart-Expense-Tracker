const express = require('express');
const auth = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

// Fetch logged-in user expenses
router.get('/', auth, async (req, res) => {
  try {
    const db = await getDb();
    const expenses = await db.all('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC', [req.user.userId]);
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve expenses' });
  }
});

// Create new expense
router.post('/', auth, async (req, res) => {
  try {
    const { date, category, amount, is_recurring } = req.body;
    if (!date || !category || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const db = await getDb();
    const isRecurringInt = is_recurring ? 1 : 0;
    
    const result = await db.run(
      'INSERT INTO expenses (user_id, date, category, amount, is_recurring) VALUES (?, ?, ?, ?, ?)',
      [req.user.userId, date, category, parseFloat(amount), isRecurringInt]
    );

    if (isRecurringInt) {
      await db.run(
        'INSERT INTO recurring_templates (user_id, category, amount) VALUES (?, ?, ?)',
        [req.user.userId, category, parseFloat(amount)]
      );
    }

    res.status(201).json({ 
      id: result.lastID, 
      user_id: req.user.userId, 
      date, 
      category, 
      amount: parseFloat(amount),
      is_recurring: isRecurringInt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Process Auto-Recurring Transactions Log
router.post('/process-recurring', auth, async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user.userId;
    
    // Grab all user templates
    const templates = await db.all('SELECT * FROM recurring_templates WHERE user_id = ?', [userId]);
    if (templates.length === 0) return res.json({ message: 'No templates to process.'});
    
    // Check if generated this month natively
    const now = new Date();
    const currentMonthString = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonthRef = `${now.getFullYear()}-${currentMonthString}`; // "2026-04"
    const timestampForFirst = `${yearMonthRef}-01`;
    
    // Get existing expenses matching the year/month with is_recurring
    const monthExpenses = await db.all(
       `SELECT * FROM expenses WHERE user_id = ? AND is_recurring = 1 AND date LIKE ?`, 
       [userId, `${yearMonthRef}%`]
    );
    
    let generated = 0;
    
    for (const template of templates) {
       // Search if this template category has already been applied across active calendar tracking
       const exists = monthExpenses.some(ex => ex.category === template.category && Math.abs(ex.amount) === Math.abs(template.amount));
       
       if (!exists) {
          await db.run(
            'INSERT INTO expenses (user_id, date, category, amount, is_recurring) VALUES (?, ?, ?, ?, ?)',
            [userId, timestampForFirst, template.category, template.amount, 1]
          );
          generated++;
       }
    }
    
    res.json({ message: 'Processed', generated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process recurring' });
  }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Expense not found or unauthorized' });
    }
    res.json({ message: 'Expense successfully deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
