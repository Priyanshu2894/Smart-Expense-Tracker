import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import History from './pages/History';


// This component acts as a security wall
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  // If there is no token, send them to the login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If there is a token, let them through to the page
  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#09090b] text-gray-100 font-sans selection:bg-indigo-500/30 flex flex-col">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/history" element={<History />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
