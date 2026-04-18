import React, { useState, useEffect } from 'react';
import { Wallet, Settings, Sun, Moon, Menu, X } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    setToken(localStorage.getItem('token'));
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUserProfile(JSON.parse(stored)); } catch { }
    }
    setIsMobileMenuOpen(false); // Close menu on navigation
  }, [location]);

  const handleDownloadReport = () => {
    try {
      const doc = new jsPDF();
      const savedData = JSON.parse(localStorage.getItem('transactions') || '[]');
      if (savedData.length === 0) {
        alert("No transaction data found.");
        return;
      }
      doc.setFontSize(18);
      doc.text("SmartExpense - Report", 14, 22);
      const tableColumn = ["Date", "Category", "Amount"];
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
      doc.save("SmartExpense_Report.pdf");
    } catch (error) {
      alert("PDF Generation failed.");
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#09090b]/80 border-b border-white/10 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo Section */}
        <div className="flex items-center gap-2 shrink-0">
          <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
          <Link to="/" className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
            SmartExpense
          </Link>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link to="/dashboard" className="text-white hover:text-indigo-400 transition-colors">Dashboard</Link>
          <button onClick={handleDownloadReport} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
            Reports
          </button>
          <Link to="/history" className="text-gray-400 hover:text-white transition-colors">History</Link>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white bg-white/5 border border-white/10"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />}
          </button>

          {token ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold"
              >
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </button>
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-48 rounded-2xl bg-[#121214] border border-white/10 shadow-2xl z-50 p-2 space-y-1">
                    <button onClick={() => { window.dispatchEvent(new Event('open-budget-modal')); setIsProfileOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Budget Settings
                    </button>
                    <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setToken(null); setIsProfileOpen(false); navigate('/login'); }} className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-rose-400/10 rounded-lg flex items-center gap-2">
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Link to="/login" className="text-xs sm:text-sm font-medium text-gray-300 px-2 sm:px-4 py-2 whitespace-nowrap">
                Login
              </Link>
              <Link to="/signup" className="text-xs sm:text-sm font-medium bg-indigo-600 text-white px-3 sm:px-5 py-2 rounded-lg whitespace-nowrap shadow-lg shadow-indigo-500/20">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle (Only visible on small screens) */}
          <button 
            className="md:hidden p-1 text-gray-400" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#09090b] border-t border-white/10 p-4 flex flex-col gap-4 text-sm font-medium animate-in slide-in-from-top-2">
          <Link to="/dashboard" className="text-white">Dashboard</Link>
          <button onClick={handleDownloadReport} className="text-left text-gray-400">Reports</button>
          <Link to="/history" className="text-gray-400">History</Link>
        </div>
      )}
    </nav>
  );
}

export default Navbar;