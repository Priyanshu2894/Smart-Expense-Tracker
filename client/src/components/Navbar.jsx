import React, { useState, useEffect } from 'react';
import { Wallet, Settings, Sun, Moon } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function Navbar() {
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : { name: 'User' };
    } catch {
      return { name: 'User' };
    }
  });

  const location = useLocation();

  // Handle global theme DOM manipulation securely on state changes
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Re-eval upon navigation loops
  useEffect(() => {
    setToken(localStorage.getItem('token'));
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUserProfile(JSON.parse(stored)); } catch { }
    } else {
      setUserProfile({ name: 'User', email: 'user@example.com' });
    }
  }, [location]);

 const handleDownloadReport = () => {
  try {
    const doc = new jsPDF();

    // --- THE FIX: Get data from localStorage because Navbar doesn't have 'transactions' ---
    const savedData = JSON.parse(localStorage.getItem('transactions') || '[]');
    
    if (savedData.length === 0) {
      alert("No transaction data found to generate a report.");
      return;
    }

    doc.setFontSize(18);
    doc.text("SmartExpense - Full Report", 14, 22);
    
    const tableColumn = ["Date", "Category", "Amount"];
    
    // Use 'savedData' instead of 'transactions' here
    const tableRows = savedData.map(t => [
      t.date || "N/A",
      t.category || "General",
      `Rs. ${Math.abs(t.amount || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save("SmartExpense_Full_Report.pdf");

  } catch (error) {
    console.error("PDF Generation failed:", error);
    alert("Could not generate PDF. Check the console.");
  }
};

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#09090b]/80 border-b border-white/10 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-indigo-500" />
          <Link to="/" className="text-xl font-bold tracking-tight text-white hover:text-indigo-400 transition-colors">
            SmartExpense
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link to="/dashboard" className="text-white hover:text-indigo-400 transition-colors">Dashboard</Link>
          <button
            onClick={handleDownloadReport}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-sm font-medium"
          >
            Reports
          </button>
          <Link to="/history" className="text-gray-400 hover:text-white transition-colors">History</Link>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all focus:outline-none"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
          </button>

          {token ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg hover:shadow-indigo-500/20 transition-all border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </button>

              {isProfileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileOpen(false)}
                  ></div>

                  <div className="absolute right-0 mt-3 w-48 rounded-2xl bg-[#121214]/80 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                      <p className="text-sm font-semibold text-white truncate">{userProfile.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{userProfile.email || 'user@example.com'}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => {
                          window.dispatchEvent(new Event('open-budget-modal'));
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Budget Settings
                      </button>
                      <button
                        onClick={() => {
                          localStorage.removeItem('token');
                          localStorage.removeItem('user');
                          setToken(null);
                          setIsProfileOpen(false);
                          navigate('/login');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg border border-transparent hover:border-white/10">
                Login
              </Link>
              <Link to="/signup" className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg shadow-lg shadow-indigo-500/20 transition-colors">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
