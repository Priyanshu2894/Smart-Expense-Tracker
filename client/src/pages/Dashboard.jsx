import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Settings, Search, Download } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : { name: 'User', email: 'user@example.com' };
    } catch {
      return { name: 'User', email: 'user@example.com' };
    }
  });
  const [transactions, setTransactions] = useState([]);
  const [formData, setFormData] = useState({ date: '', category: '', amount: '', is_recurring: false });
  const [searchQuery, setSearchQuery] = useState('');

  // AI Feature States
  const [advice, setAdvice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Dynamic Budget feature
  const [categoryBudgets, setCategoryBudgets] = useState({});

  const navigate = useNavigate();

  const fetchExpenses = useCallback(async () => {
    try {

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else {
        if (response.status === 401) navigate('/login');
      }
    } catch (err) {
      console.error('Failed to grab expenses', err);
    }
  }, [navigate]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Auto-process strictly locked recurring subscriptions gracefully
  useEffect(() => {
    const processRecurring = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses/process-recurring`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.generated && data.generated > 0) {
          // Recursively grab any freshly generated automated expenses
          fetchExpenses();
        }
      } catch (err) {
        console.error('Failed to auto-process limits', err);
      }
    };
    processRecurring();
  }, []);

  // Listen for Navbar triggered Budget Settings interaction
  useEffect(() => {
    const handleOpenBudget = () => setIsBudgetModalOpen(true);
    window.addEventListener('open-budget-modal', handleOpenBudget);
    return () => window.removeEventListener('open-budget-modal', handleOpenBudget);
  }, []);

  const totalBalance = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  const income = transactions.filter(t => t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);
  const expenses = transactions.filter(t => t.amount < 0).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const now = new Date();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;

  // Extract unique categories for the Modal
  const uniqueExpenseCategories = Array.from(new Set(
    transactions
      .filter(t => parseFloat(t.amount) < 0)
      .map(t => t.category.toLowerCase())
  ));

  const currentMonthExpenses = transactions.filter(t => {
    const match = parseFloat(t.amount) < 0;
    if (!match) return false;
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  // Forecasting Logic
  const totalSpentThisMonth = currentMonthExpenses.reduce((acc, curr) => acc + Math.abs(parseFloat(curr.amount)), 0);
  const avgDailySpent = currentDay > 0 ? (totalSpentThisMonth / currentDay) : 0;

  // Logic: (Current Total Spent / Days Elapsed) * Total Days in Month
  const totalForecast = avgDailySpent * daysInMonth;

  const totalBudgetLimit = Object.values(categoryBudgets).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  const isForecastDangerous = totalBudgetLimit > 0 && totalForecast > totalBudgetLimit;

  // Logic: (Total Monthly Budget - Total Spent) / Days Remaining in Month
  const validRemaining = daysRemaining > 0 ? daysRemaining : 1;
  const dailyAllowance = totalBudgetLimit > 0 ? ((totalBudgetLimit - totalSpentThisMonth) / validRemaining) : 0;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[currentMonth];

  // Prepare Progress Data (Filtered to Current Month)
  const expenseDataMap = currentMonthExpenses
    .reduce((acc, curr) => {
      const cat = curr.category.toLowerCase();
      acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(curr.amount));
      return acc;
    }, {});

  const pieChartData = Object.keys(expenseDataMap).map(category => ({
    name: category,
    value: expenseDataMap[category]
  }));

  const PIE_COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6'];

  // Indian Rupee (INR) Formatter
  const formatINR = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setTransactions(transactions.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.date) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert("Please sign up or login to save your expenses and access AI forecasting!");
      navigate('/signup');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const newExpense = await response.json();
        setTransactions([newExpense, ...transactions]);
        setIsModalOpen(false);
        setFormData({ date: '', category: '', amount: '', is_recurring: false });
      }
    } catch (err) {
      console.error('Failed to add expense', err);
    }
  };

  const generateReport = async () => {
    setIsGenerating(true);
    setAdvice('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/advice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ expenses: transactions })
      });
      const data = await response.json();
      if (response.ok) {
        setAdvice(data.advice);
      } else {
        setAdvice('Error: ' + data.error);
      }
    } catch (err) {
      setAdvice('Failed to reach AI service.');
    } finally {
      setIsGenerating(false);
    }
  };
  const handleDownloadReport = () => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    try {
      // 1. Initialize the PDF
      const doc = new jsPDF();

      // 2. Check if transactions exist to avoid crashing
      if (!transactions || transactions.length === 0) {
        alert("No data available to generate a report.");
        return;
      }

      // 3. Add a Title
      doc.setFontSize(18);
      doc.text("SmartExpense - Transaction Report", 14, 22);

      // 4. Add Generation Date
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Report generated on: ${new Date().toLocaleString()}`, 14, 30);

      // 5. Prepare Table Data
      const tableColumn = ["Date", "Category", "Amount"];
      const tableRows = transactions.map(t => [
        t.date || "N/A",
        t.category || "General",
        `Rs. ${Math.abs(t.amount || 0).toFixed(2)}`
      ]);

      // 6. Use autoTable as a direct function (This solves the "not a function" error)
      autoTable(doc, {
        startY: 40,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Matches your Indigo theme
        styles: { fontSize: 10 },
      });

      // 7. Download the file
      doc.save("SmartExpense_Report.pdf");

    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Could not generate PDF. Check the console for technical details.");
    }
  };
  return (
    <>
      <div className="w-full max-w-full px-6 xl:px-12 pt-6 pb-12">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl">
            <h2 className="text-gray-400 text-sm font-medium tracking-wide uppercase">Total Balance</h2>
            <p className={`text-4xl font-semibold mt-3 ${totalBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatINR(totalBalance)}
            </p>
          </div>

          {/* Income Card */}
          <div className="rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl flex flex-col justify-center">
            <h2 className="text-gray-400 text-sm font-medium tracking-wide uppercase">Monthly Income</h2>
            <p className="text-2xl font-semibold text-emerald-400 mt-1">{formatINR(income)}</p>
          </div>

          {/* Expenses Card */}
          <div className="rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl flex flex-col justify-center">
            <h2 className="text-gray-400 text-sm font-medium tracking-wide uppercase">Expenses</h2>
            <p className="text-2xl font-semibold text-rose-400 mt-1">{formatINR(expenses)}</p>
          </div>
        </div>

        {/* Advanced Insights Row */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">

          {/* Card 1: Monthly Forecast */}
          <div className={`flex-1 rounded-2xl border p-6 shadow-xl relative overflow-hidden ${isForecastDangerous ? 'bg-rose-500/5 border-rose-500/20' : 'bg-[#121214] border-white/5'}`}>
            {isForecastDangerous && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 to-rose-400 animate-pulse"></div>}
            <div className="flex items-center gap-2 mb-2">
              <svg className={`w-5 h-5 ${isForecastDangerous ? 'text-rose-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
              <h2 className="font-bold text-xl text-white">Monthly Forecast</h2>
            </div>
            <p className="text-gray-300">
              Based on your current pace, you are on track to spend{' '}
              <span className={`font-bold ${isForecastDangerous ? 'text-rose-400 text-lg' : 'text-emerald-400 text-lg'}`}>
                {formatINR(totalForecast)}
              </span>{' '}
              by the end of {currentMonthName}.
            </p>
            {totalBudgetLimit > 0 && (
              <p className="text-xs text-gray-500 mt-2 font-medium">
                Your total assigned hard-limit across all categories is <span className="text-gray-400">{formatINR(totalBudgetLimit)}</span>.
              </p>
            )}
          </div>

          {/* Card 2: Daily Allowance */}
          <div className={`flex-1 rounded-2xl border p-6 shadow-xl relative overflow-hidden ${totalBudgetLimit === 0 ? 'bg-[#121214] border-white/5' : dailyAllowance < 0 ? 'bg-rose-500/5 border-rose-500/20' : dailyAllowance < 100 ? 'bg-orange-500/5 border-orange-500/20' : 'bg-[#121214] border-white/5'}`}>
            {totalBudgetLimit > 0 && dailyAllowance < 0 && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 to-rose-400 animate-pulse"></div>}
            {totalBudgetLimit > 0 && dailyAllowance >= 0 && dailyAllowance < 100 && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-yellow-400"></div>}

            <div className="flex items-center gap-2 mb-2">
              <svg className={`w-5 h-5 ${totalBudgetLimit === 0 ? 'text-indigo-400' : dailyAllowance < 0 ? 'text-rose-400' : dailyAllowance < 100 ? 'text-orange-400' : 'text-emerald-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="font-bold text-xl text-white">Daily Allowance</h2>
            </div>

            {totalBudgetLimit === 0 ? (
              <p className="text-gray-400 text-sm mt-3">
                No custom budgets set. Configure limits to see your daily allowance calculation!
              </p>
            ) : dailyAllowance < 0 ? (
              <div className="mt-2 flex flex-col gap-1 items-start">
                <span className="text-sm font-bold text-rose-400 bg-rose-400/10 px-3 py-1 rounded-md border border-rose-400/20 shadow-sm animate-pulse">
                  ⚠️ Budget Depleted
                </span>
                <p className="text-gray-300 text-sm mt-1">
                  You are over budget by <span className="text-rose-400 font-bold">{formatINR(Math.abs(dailyAllowance * validRemaining))}</span> in {currentMonthName}.
                </p>
              </div>
            ) : (
              <p className="text-gray-300 mt-1">
                You have an allowable spend of{' '}
                <span className={`font-bold text-lg tracking-wide ${dailyAllowance < 100 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {formatINR(dailyAllowance)}
                </span>{' '}
                per day remaining.
              </p>
            )}

            {totalBudgetLimit > 0 && dailyAllowance >= 0 && (
              <p className="text-xs text-gray-500 mt-3 font-medium">
                Paced evenly across the final {daysRemaining} days.
              </p>
            )}
          </div>
        </div>

        {/* AI Savings Advice Section */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl shadow-xl overflow-hidden mb-12 p-8 relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-xl text-white">AI Savings Advice</h2>
              </div>
              <p className="text-gray-400 text-sm max-w-xl">
                Let Gemini 1.0 Pro analyze your spending patterns, identify your highest category, and give you a structured suggestion on how to save next month.
              </p>
            </div>
            <button
              onClick={generateReport}
              disabled={isGenerating || transactions.length === 0}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex-shrink-0"
            >
              {isGenerating ? 'Analyzing...' : 'Generate Report'}
            </button>
          </div>

          {/* Advice Output Box */}
          {advice && (
            <div className="mt-8 p-6 bg-[#09090b]/50 backdrop-blur-sm border border-white/10 rounded-xl leading-relaxed text-gray-200">
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {advice}
              </div>
            </div>
          )}
        </div>

        {/* Two-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">

          {/* Left Column: Transactions Table (60%) */}
          <div className="w-full lg:w-3/5 bg-[#121214] border border-white/5 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="font-semibold text-lg flex-shrink-0">Recent Transactions</h2>

              <div className="relative w-full max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by category or amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-md"
                />
              </div>
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 px-4 py-2 rounded-full text-sm font-medium transition-all"
                title="Download PDF Report"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Report</span>
              </button>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse h-full">
                <thead>
                  <tr className="bg-[#18181b] border-b border-white/5 text-xs uppercase tracking-wider text-gray-400">
                    <th className="p-4 pl-6 font-medium">Date</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 pr-6 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {transactions.filter(t => {
                    const query = searchQuery.toLowerCase();
                    const matchCategory = t.category.toLowerCase().includes(query);
                    const matchAmount = Math.abs(t.amount).toString().includes(query);
                    return matchCategory || matchAmount;
                  }).length > 0 ? transactions.filter(t => {
                    const query = searchQuery.toLowerCase();
                    const matchCategory = t.category.toLowerCase().includes(query);
                    const matchAmount = Math.abs(t.amount).toString().includes(query);
                    return matchCategory || matchAmount;
                  }).map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 pl-6 text-gray-300">{transaction.date}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-gray-300 border border-white/10 capitalize">
                            {transaction.category}
                          </span>
                          {transaction.is_recurring === 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest shadow-sm">
                              🔄 Recurring
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`p-4 font-medium ${transaction.amount > 0 ? 'text-emerald-400' : 'text-gray-100'}`}>
                        {transaction.amount > 0 ? '+' + formatINR(transaction.amount) : formatINR(transaction.amount)}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-gray-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 rounded-lg hover:bg-rose-400/10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-500">
                        {transactions.length === 0 ? "No transactions found. Add a new expense!" : "No matches found for your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Spending by Category Progress Bars (40%) */}
          <div className="w-full lg:w-2/5 bg-[#121214] border border-white/5 rounded-2xl shadow-xl p-6 flex flex-col">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
              <h2 className="font-semibold text-lg">Spending by Category</h2>
              <button onClick={() => setIsBudgetModalOpen(true)} className="text-gray-400 hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-indigo-500/10" title="Set Budgets">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 w-full flex flex-col justify-start gap-6 mt-2 overflow-y-auto pr-2 custom-scrollbar">
              {pieChartData.length > 0 ? (
                pieChartData.sort((a, b) => b.value - a.value).map((entry, index) => {
                  const total = pieChartData.reduce((acc, curr) => acc + curr.value, 0);
                  const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                  const color = PIE_COLORS[index % PIE_COLORS.length];

                  const categoryName = entry.name.toLowerCase();
                  const limit = categoryBudgets[categoryName] ? parseFloat(categoryBudgets[categoryName]) : undefined;
                  const isExceeded = limit && entry.value > limit;

                  return (
                    <div key={index} className={`w-full relative group p-3 rounded-xl border transition-all ${isExceeded ? 'border-rose-500/40 bg-rose-500/10' : 'border-transparent'}`}>
                      <div className="flex justify-between items-end mb-2">
                        <span className={`text-sm font-medium capitalize transition-colors ${isExceeded ? 'text-rose-200' : 'text-gray-200 group-hover:text-white'}`}>{entry.name}</span>
                        <div className="text-right flex items-center gap-2">
                          {isExceeded && (
                            <span className="text-xs font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md border border-rose-400/20 shadow-sm animate-pulse">
                              ⚠️ Budget Exceeded
                            </span>
                          )}
                          <span className="text-sm font-bold text-white">{formatINR(entry.value)}</span>
                          <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#1e1e24] shadow-inner rounded-full h-2.5 overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${isExceeded ? 'bg-rose-500' : ''}`}
                          style={{ width: `${percentage}%`, backgroundColor: isExceeded ? undefined : color }}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 py-12">
                  <p>No expenses to chart.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          const token = localStorage.getItem('token');
          if (token) {
            setIsModalOpen(true);
          } else {
            // No alert, just a smooth transition
            navigate('/login');
          }
        }}
        className="fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all hover:scale-110 active:scale-95 z-40"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      </button>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative transform transition-all">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {localStorage.getItem('token') ? (
              <>
                <h2 className="text-xl font-bold mb-6 text-white">Add Transaction</h2>
                <h2 className="text-xl font-bold mb-6 text-white">Add Transaction</h2>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Groceries, Rent, Salary"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Amount (use negative for expenses)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="flex items-center space-x-3 cursor-pointer mt-4 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500/50 bg-[#09090b] transition-all"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-indigo-200">Recurring Monthly Subscription</span>
                        <span className="text-xs text-indigo-200/50">Automatically charges this to your target balance on the 1st of every month.</span>
                      </div>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl px-4 py-3 mt-6 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    Save Transaction
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-10">
                <h2 className="text-xl font-bold mb-4 text-white">Login Required</h2>
                <p className="mb-6 text-gray-400">You need an account to save transactions and use AI features.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="bg-indigo-600 px-6 py-2 rounded-xl text-white font-bold hover:bg-indigo-500 transition-colors"
                >
                  Login / Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget Set Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative transform transition-all">
            <button
              onClick={() => setIsBudgetModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl font-bold mb-2 text-white">Set Budget Limits</h2>
            <p className="text-sm text-gray-400 mb-6">Assign target soft-limits for each of your expense categories.</p>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {uniqueExpenseCategories.map(cat => (
                <div key={cat} className="flex justify-between items-center bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 hover:border-indigo-500/50 transition-colors focus-within:border-indigo-500/50">
                  <span className="text-sm font-medium text-gray-200 capitalize">{cat}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-medium">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="No limit"
                      value={categoryBudgets[cat] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCategoryBudgets(prev => ({
                          ...prev,
                          [cat]: val === '' ? undefined : parseFloat(val)
                        }));
                      }}
                      className="w-24 bg-transparent text-white text-right font-medium focus:outline-none placeholder:text-gray-600"
                    />
                  </div>
                </div>
              ))}
              {uniqueExpenseCategories.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No expense categories found. Start saving transactions first.
                </div>
              )}
            </div>

            <button
              onClick={() => setIsBudgetModalOpen(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl px-4 py-3 mt-8 transition-colors shadow-lg shadow-indigo-500/20"
            >
              Save Limits
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
