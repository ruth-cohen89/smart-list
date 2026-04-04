import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/shopping-list', label: 'Shopping List' },
  { to: '/consumption-profile', label: 'My Baseline' },
  { to: '/receipts', label: 'Receipts' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-2.5">
            <img src={logo} alt="SmartList logo" className="w-9 h-9 object-contain" />
            <span className="font-bold text-gray-900 text-lg tracking-tight">SmartList</span>
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Desktop user menu */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.fullName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="px-3 text-xs text-gray-400 mb-2">{user?.fullName}</p>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
