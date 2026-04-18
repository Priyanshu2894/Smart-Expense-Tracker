const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/expense'); // Ensure this model exists!
const router = express.Router();

// 1. Fetch expenses
router.get('/', auth, async (req, res) => {
  try {
    // Find expenses where user matches the logged-in ID
    const expenses = await Expense.find({ user: req.user.userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve expenses' });
  }
});

// 2. Create new expense
router.post('/', auth, async (req, res) => {
  try {
    const { date, category, amount, is_recurring } = req.body;
    if (!date || !category || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newExpense = new Expense({
      user: req.user.userId,
      date,
      category,
      amount: parseFloat(amount),
      is_recurring: is_recurring ? true : false
    });

    const savedExpense = await newExpense.save();
    res.status(201).json(savedExpense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// 3. Delete expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user.userId 
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found or unauthorized' });
    }
    res.json({ message: 'Expense successfully deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;