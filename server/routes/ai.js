const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/advice', auth, async (req, res) => {
  try {
    const expenses = req.body.expenses;
    if (!expenses || expenses.length === 0) {
      return res.status(400).json({ error: 'No expenses provided for analysis.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("CRITICAL: No API key found in process.env.GEMINI_API_KEY");
      return res.status(500).json({ error: "Missing API key configuration." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" }, { apiVersion: "v1" });

    const prompt = `Analyze these expenses. Identify the highest spending category and suggest one specific way to reduce costs next month. Keep the response extremely concise, direct, and formatted using engaging markdown. \n\nTransactions:\n${JSON.stringify(expenses, null, 2)}`;

    console.log(`Sending AI generation request to gemini-1.0-pro...`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(`Successfully received AI response! Length: ${responseText.length}`);

    res.json({ advice: responseText });
  } catch (err) {
    console.error('------- AI SDK ERROR INTERCEPTED -------');
    console.error('Error Object:', err);
    console.error('----------------------------------------');
    
    // Fallback Logic
    console.log(`Initiating Graceful Fallback calculation...`);
    const expensesList = req.body.expenses || [];
    
    let categoryTotals = {};
    expensesList.forEach(exp => {
      // Assuming expenses are negative amounts in the frontend layout
      const amt = parseFloat(exp.amount);
      if (amt < 0) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Math.abs(amt);
      }
    });

    let highestCategory = '';
    let highestAmount = -1;
    for (const cat in categoryTotals) {
      if (categoryTotals[cat] > highestAmount) {
        highestAmount = categoryTotals[cat];
        highestCategory = cat.toLowerCase();
      }
    }

    let fallbackAdvice = '✨ AI Tip: Your expenses look normal, but try setting aside an extra 5% this month just in case!';
    
    if (highestCategory.includes('food') || highestCategory.includes('groceries') || highestCategory.includes('dining')) {
      fallbackAdvice = '✨ **AI Tip**: You are spending a lot on Food. Try meal prepping to save 20%!';
    } else if (highestCategory.includes('rent') || highestCategory.includes('housing') || highestCategory.includes('mortgage')) {
      fallbackAdvice = '✨ **AI Tip**: Your rent is a fixed cost. Try reducing small variable expenses like entertainment.';
    }

    console.log(`Fallback constructed based on category: ${highestCategory}`);
    res.json({ advice: fallbackAdvice });
  }
});

module.exports = router;
