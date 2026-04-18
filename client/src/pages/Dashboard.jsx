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
  const [categoryBudgets, setCategoryBudgets] = useState({});

  const navigate = useNavigate();

  const fetchExpenses = useCallback(async () => {
    try {
      if (!token) return;
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
  }, [navigate, token]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    const processRecurring = async () => {
      try {
        if (!token) return;
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses/process-recurring`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.generated && data.generated > 0) {
          fetchExpenses();
        }
      } catch (err) {
        console.error('Failed to auto-process limits', err);
      }
    };
    processRecurring();
  }, [token, fetchExpenses]);

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
  const daysRemaining = Math.max(daysInMonth - currentDay, 1);

  const uniqueExpenseCategories = Array.from(new Set(
    transactions.filter(t => parseFloat(t.amount) < 0).map(t => t.category.toLowerCase())
  ));

  const currentMonthExpenses = transactions.filter(t => {
    if (parseFloat(t.amount) >= 0) return false;
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const calculateDailyAllowance = () => {
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - today.getDate() + 1;
  
  const totalBudget = Object.values(categoryBudgets).reduce((a, b) => a + b, 0);
  const totalSpent = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  const allowance = (totalBudget + totalSpent) / daysRemaining; // totalSpent is negative, so we add
  return allowance > 0 ? allowance.toFixed(2) : 0;
};

  const totalSpentThisMonth = currentMonthExpenses.reduce((acc, curr) => acc + Math.abs(parseFloat(curr.amount)), 0);
  const avgDailySpent = currentDay > 0 ? (totalSpentThisMonth / currentDay) : 0;
  const totalForecast = avgDailySpent * daysInMonth;
  const totalBudgetLimit = Object.values(categoryBudgets).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  const isForecastDangerous = totalBudgetLimit > 0 && totalForecast > totalBudgetLimit;
  const dailyAllowance = totalBudgetLimit > 0 ? ((totalBudgetLimit - totalSpentThisMonth) / daysRemaining) : 0;
  const currentMonthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][currentMonth];

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
  // 1. Confirm with the user before deleting
  if (!window.confirm("Are you sure you want to delete this transaction?")) return;

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      // 2. IMPORTANT: MongoDB uses _id, so we check t._id
      setTransactions(transactions.filter(t => t._id !== id));
    } else {
      console.error('Failed to delete from server');
    }
  } catch (err) {
    console.error('Failed to delete expense', err);
  }
};

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.date) return;
    if (!token) { navigate('/signup'); return; }

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
    setAdvice('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ expenses: transactions })
      });
      const data = await response.json();
      if (response.ok) setAdvice(data.advice);
      else setAdvice('Error generating advice.');
    } catch (err) {
      setAdvice('Failed to reach AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    try {
      const doc = new jsPDF();
      if (!transactions || transactions.length === 0) return;
      doc.setFontSize(18);
      doc.text("SmartExpense - Report", 14, 22);
      const tableColumn = ["Date", "Category", "Amount"];
      const tableRows = transactions.map(t => [t.date || "N/A", t.category || "General", `Rs. ${Math.abs(t.amount || 0).toFixed(2)}`]);
      autoTable(doc, { startY: 40, head: [tableColumn], body: tableRows, theme: 'grid', headStyles: { fillColor: [79, 70, 229] } });
      doc.save("SmartExpense_Report.pdf");
    } catch (error) {
      alert("PDF Generation failed.");
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pb-24 md:p-8">
    {/* Header Section */}
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400 text-sm">Welcome back, {userProfile.name}</p>
      </div>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-full md:rounded-lg flex items-center gap-2 transition-all shadow-lg"
      >
        <span className="hidden md:inline">Add Transaction</span>
        <span className="md:hidden text-xl">+</span>
      </button>
    </div>

    {/* Top Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800">
        <p className="text-gray-400 text-xs uppercase font-semibold">Total Balance</p>
        <h2 className="text-3xl font-bold mt-1">₹{calculateBalance()}</h2>
      </div>
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800">
        <p className="text-green-500 text-xs uppercase font-semibold">Daily Allowance</p>
        <h2 className="text-3xl font-bold mt-1 text-green-400">₹{calculateDailyAllowance()}</h2>
      </div>
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800">
        <p className="text-red-500 text-xs uppercase font-semibold">Monthly Spending</p>
        <h2 className="text-3xl font-bold mt-1 text-red-400">₹{Math.abs(calculateMonthlySpending())}</h2>
      </div>
    </div>

    {/* Spending Category Section */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Spending by Category</h2>
          
          {/* BUDGET SETTINGS BUTTON - Placed here for mobile visibility */}
          <button 
            onClick={() => setIsBudgetModalOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-lg border border-gray-700 transition-colors"
          >
            <Settings size={20} className="text-indigo-400" />
          </button>
        </div>
        
        <div className="space-y-4">
          {Object.entries(calculateCategorySpending()).map(([category, amount]) => (
            <div key={category} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{category}</span>
                <span className="font-medium">₹{Math.abs(amount).toFixed(2)}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full" 
                  style={{ width: `${Math.min((Math.abs(amount) / (categoryBudgets[category] || 5000)) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Advice Card */}
      <div className="bg-indigo-900/20 p-6 rounded-2xl border border-indigo-500/30">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-indigo-400" size={20} />
          <h2 className="text-xl font-bold">AI Savings Advice</h2>
        </div>
        <p className="text-gray-300 text-sm mb-6">
          {advice || "Click generate to get personalized savings tips."}
        </p>
        <button 
          onClick={generateReport}
          disabled={isGenerating}
          className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
        >
          {isGenerating ? "Analyzing..." : "Generate Advice"}
        </button>
      </div>
    </div>

    {/* Recent Transactions Table */}
    <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Recent Transactions</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text"
            placeholder="Search expenses..."
            className="bg-[#0a0a0a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:border-indigo-500"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#141414] text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {transactions
              .filter(t => t.category.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((transaction) => (
              <tr key={transaction._id || transaction.id} className="hover:bg-[#141414] transition-colors">
                <td className="px-6 py-4 text-sm text-gray-300">{transaction.date}</td>
                <td className="px-6 py-4">
                  <span className="bg-gray-800 px-3 py-1 rounded-full text-xs text-indigo-300">
                    {transaction.category}
                  </span>
                </td>
                <td className={`px-6 py-4 text-sm font-bold text-right ${transaction.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ₹{Math.abs(transaction.amount).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleDelete(transaction._id || transaction.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>

    </>
  );
}

export default Dashboard;

