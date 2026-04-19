import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Settings, Search, Download } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [token] = useState(() => localStorage.getItem('token'));
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
  const [advice, setAdvice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // LOAD BUDGETS FROM LOCALSTORAGE ON MOUNT
  const [categoryBudgets, setCategoryBudgets] = useState(() => {
    const saved = localStorage.getItem('categoryBudgets');
    return saved ? JSON.parse(saved) : {};
  });

  const navigate = useNavigate();

  // SAVE BUDGETS TO LOCALSTORAGE WHENEVER THEY CHANGE
  useEffect(() => {
    localStorage.setItem('categoryBudgets', JSON.stringify(categoryBudgets));
  }, [categoryBudgets]);

  const fetchExpenses = useCallback(async () => {
    try {
      if (!token) return;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else if (response.status === 401) {
        navigate('/login');
      }
    } catch (err) {
      console.error('Failed to grab expenses', err);
    }
  }, [navigate, token]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // --- Calculations ---
  const totalBalance = transactions.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const income = transactions.filter(t => parseFloat(t.amount) > 0).reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  const expenses = transactions.filter(t => parseFloat(t.amount) < 0).reduce((acc, curr) => acc + Math.abs(parseFloat(curr.amount)), 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(daysInMonth - currentDay + 1, 1);

  const currentMonthExpenses = transactions.filter(t => {
    if (parseFloat(t.amount) >= 0) return false;
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const totalSpentThisMonth = currentMonthExpenses.reduce((acc, curr) => acc + Math.abs(parseFloat(curr.amount)), 0);
  const avgDailySpent = currentDay > 0 ? (totalSpentThisMonth / currentDay) : 0;
  const totalForecast = avgDailySpent * daysInMonth;
  
  // BUDGET LOGIC
  const totalBudgetLimit = Object.values(categoryBudgets).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  const isForecastDangerous = totalBudgetLimit > 0 && totalForecast > totalBudgetLimit;
  const dailyAllowance = totalBudgetLimit > 0 ? ((totalBudgetLimit - totalSpentThisMonth) / daysRemaining) : 0;
  const currentMonthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][currentMonth];

  const uniqueExpenseCategories = Array.from(new Set(
    transactions.filter(t => parseFloat(t.amount) < 0).map(t => t.category.toLowerCase())
  ));

  const handleBudgetChange = (category, value) => {
    setCategoryBudgets(prev => ({
      ...prev,
      [category.toLowerCase()]: parseFloat(value) || 0
    }));
  };

  const expenseDataMap = currentMonthExpenses.reduce((acc, curr) => {
    const cat = curr.category.toLowerCase();
    acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(curr.amount));
    return acc;
  }, {});

  const pieChartData = Object.keys(expenseDataMap).map(category => ({
    name: category,
    value: expenseDataMap[category]
  }));

  const PIE_COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6'];

  const formatINR = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(value);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setTransactions(transactions.filter(t => (t._id || t.id) !== id));
      }
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.date) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ expenses: transactions })
      });
      const data = await response.json();
      if (response.ok) setAdvice(data.advice);
    } catch (err) {
      setAdvice('Failed to reach AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    const tableColumn = ["Date", "Category", "Amount"];
    const tableRows = transactions.map(t => [t.date, t.category, `Rs. ${Math.abs(t.amount).toFixed(2)}`]);
    autoTable(doc, { startY: 20, head: [tableColumn], body: tableRows });
    doc.save("Report.pdf");
  };

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-12 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl">
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Balance</h2>
            <p className={`text-3xl sm:text-4xl font-semibold mt-2 ${totalBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatINR(totalBalance)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl">
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Monthly Income</h2>
            <p className="text-2xl font-semibold text-emerald-400 mt-1">{formatINR(income)}</p>
          </div>
          <div className="rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl">
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Expenses</h2>
            <p className="text-2xl font-semibold text-rose-400 mt-1">{formatINR(expenses)}</p>
          </div>
        </div>

        {/* Forecast & Allowance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 sm:mb-12">
          <div className={`rounded-2xl border p-6 shadow-xl ${isForecastDangerous ? 'bg-rose-500/5 border-rose-500/20' : 'bg-[#121214] border-white/5'}`}>
            <h2 className="font-bold text-lg text-white mb-2 flex items-center gap-2">
               <Sparkles className="w-5 h-5 text-blue-400" /> Monthly Forecast
            </h2>
            <p className="text-sm text-gray-300">
              On track to spend <span className={`font-bold ${isForecastDangerous ? 'text-rose-400' : 'text-emerald-400'}`}>{formatINR(totalForecast)}</span> by the end of {currentMonthName}.
            </p>
          </div>

          <div className="rounded-2xl bg-[#121214] border border-white/5 p-6 shadow-xl relative">
            <h2 className="font-bold text-lg text-white mb-2 flex items-center gap-2">
               <Settings className="w-5 h-5 text-indigo-400" /> Daily Allowance
            </h2>
            {totalBudgetLimit === 0 ? (
              <p className="text-gray-400 text-sm">Configure limits in "Spending by Category" to see your daily allowance.</p>
            ) : (
              <p className="text-sm text-gray-300">
                Remaining spend: <span className="font-bold text-emerald-400">{formatINR(dailyAllowance)}</span> per day.
              </p>
            )}
          </div>
        </div>

        {/* AI Section */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 sm:p-8 mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-bold text-xl text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400"/> AI Advice</h2>
              <p className="text-gray-400 text-sm">Get spending insights from Gemini AI.</p>
            </div>
            <button onClick={generateReport} disabled={isGenerating || transactions.length === 0} className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium">
              {isGenerating ? 'Analyzing...' : 'Generate Advice'}
            </button>
          </div>
          {advice && <div className="mt-6 p-4 bg-[#09090b] rounded-xl text-sm text-gray-300 whitespace-pre-wrap">{advice}</div>}
        </div>

        {/* Transactions & Progress */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 mb-12">
          <div className="xl:col-span-3 bg-[#121214] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between gap-4">
              <h2 className="font-semibold">Recent Transactions</h2>
              <div className="flex gap-2">
                 <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none w-full" />
                 <button onClick={handleDownloadReport} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg"><Download className="w-4 h-4"/></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions
                    .filter(t => t.category.toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice(0,10)
                    .map(t => (
                    <tr key={t._id || t.id} className="hover:bg-white/5">
                      <td className="p-4 text-gray-400">{t.date}</td>
                      <td className="p-4 capitalize">{t.category}</td>
                      <td className={`p-4 text-right font-medium ${parseFloat(t.amount) > 0 ? 'text-emerald-400' : 'text-white'}`}>
                        {formatINR(t.amount)}
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => handleDelete(t._id || t.id)} className="text-rose-500 hover:text-rose-400 transition-colors text-xs font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-2 bg-[#121214] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold">Spending by Category</h2>
              <button onClick={() => setIsBudgetModalOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                <Settings className="w-4 h-4 text-indigo-400" />
              </button>
            </div>
            <div className="space-y-6">
              {pieChartData.map((entry, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="capitalize text-gray-300">{entry.name}</span>
                    <span className="font-bold">{formatINR(entry.value)}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((entry.value / (expenses || 1)) * 100, 100)}%`, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Plus Button */}
      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 bg-indigo-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-40 transition-transform hover:scale-110">
        <span className="text-3xl">+</span>
      </button>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] p-6 rounded-2xl w-full max-w-md border border-white/10">
            <h2 className="text-xl font-bold mb-4 text-white">Add Transaction</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl text-white focus:border-indigo-600 outline-none" />
              <input type="text" placeholder="Category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl text-white focus:border-indigo-600 outline-none" />
              <input type="number" placeholder="Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl text-white focus:border-indigo-600 outline-none" />
              <button type="submit" className="w-full bg-indigo-600 py-3 rounded-xl font-bold text-white hover:bg-indigo-700">Save</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full text-gray-400 text-sm hover:text-white">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Budget Configuration Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Set Monthly Budgets
              </h2>
              <button onClick={() => setIsBudgetModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {uniqueExpenseCategories.length > 0 ? (
                uniqueExpenseCategories.map(cat => (
                  <div key={cat} className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase font-semibold">{cat}</label>
                    <input
                      type="number"
                      placeholder="Enter budget (e.g. 5000)"
                      value={categoryBudgets[cat] || ''}
                      onChange={(e) => handleBudgetChange(cat, e.target.value)}
                      className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl text-white focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">Add some expenses first to set category budgets!</p>
              )}
            </div>

            <button 
              onClick={() => setIsBudgetModalOpen(false)} 
              className="w-full bg-indigo-600 mt-6 py-3 rounded-xl font-bold text-white hover:bg-indigo-700 transition-all"
            >
              Save & Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;