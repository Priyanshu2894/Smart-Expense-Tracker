import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Filter } from 'lucide-react';

function History() {
  const [transactions, setTransactions] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'this_month', 'last_3_months', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/login');

      // Use the VITE_API_URL variable instead of localhost
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else {
        console.error('Failed to fetch transactions');
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  };
  fetchTransactions();
}, [navigate]);

  const handleDelete = async (id) => {
  if (!window.confirm("Delete this record?")) return;
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/expenses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      // Use _id for MongoDB compatibility
      setTransactions(transactions.filter(t => (t._id || t.id) !== id));
    }
  } catch (err) {
    console.error('Failed to delete', err);
  }
};

  const getFilteredTransactions = () => {
    if (filterType === 'all') return transactions;
    
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (filterType === 'this_month') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      if (filterType === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return tDate >= threeMonthsAgo && tDate <= now;
      }
      if (filterType === 'custom') {
        if (!customStart || !customEnd) return true;
        return tDate >= new Date(customStart) && tDate <= new Date(customEnd);
      }
      return true;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
  <div className="w-full max-w-6xl mx-auto px-6 pt-10 pb-16">
    <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Transaction History</h1>
        <p className="text-gray-400">View and manage your entire financial record.</p>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#121214] p-2 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 px-3">
           <Filter className="w-4 h-4 text-indigo-400" />
           <select 
             value={filterType}
             onChange={(e) => setFilterType(e.target.value)}
             className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
           >
             <option value="all" className="bg-[#18181b]">All Time</option>
             <option value="this_month" className="bg-[#18181b]">This Month</option>
             <option value="last_3_months" className="bg-[#18181b]">Last 3 Months</option>
             <option value="custom" className="bg-[#18181b]">Custom Range</option>
           </select>
        </div>
        
        {filterType === 'custom' && (
          <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-white/10 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 w-full sm:w-auto">
             <input 
               type="date" 
               value={customStart}
               onChange={(e) => setCustomStart(e.target.value)}
               className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" 
             />
             <span className="text-gray-500 text-xs">to</span>
             <input 
               type="date" 
               value={customEnd}
               onChange={(e) => setCustomEnd(e.target.value)}
               className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" 
             />
          </div>
        )}
      </div>
    </div>

    <div className="w-full bg-[#121214] border border-white/5 rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[500px]">
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse h-full">
          <thead>
            <tr className="bg-[#18181b] border-b border-white/5 text-xs text-gray-400 uppercase tracking-wider">
              <th className="p-5 pl-6 font-medium">Date</th>
              <th className="p-5 font-medium">Category</th>
              <th className="p-5 font-medium text-right">Amount</th>
              <th className="p-5 pr-6 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => (
              /* FIXED: Changed key to use _id || id */
              <tr key={transaction._id || transaction.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-5 pl-6 text-gray-300">{transaction.date}</td>
                <td className="p-5">
                  <span className="inline-flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1 rounded-lg text-gray-300 font-medium whitespace-nowrap">
                    {transaction.category}
                    {transaction.is_recurring === 1 && (
                      <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded">
                        🔄
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-5 text-right font-medium whitespace-nowrap">
                  {/* FIXED: Using parseFloat to handle MongoDB strings and formatINR for currency */}
                  <span className={parseFloat(transaction.amount) > 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatINR(transaction.amount)}
                  </span>
                </td>
                <td className="p-5 pr-6 text-center text-gray-300 whitespace-nowrap align-middle">
                  <button 
                    /* FIXED: Changed onClick to use _id || id */
                    onClick={() => handleDelete(transaction._id || transaction.id)}
                    className="p-2 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all mx-auto"
                    title="Delete Transaction"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="p-16 text-center text-gray-500">
                  No transactions found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
}

export default History;
