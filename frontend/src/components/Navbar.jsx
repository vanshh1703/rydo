import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Car, User, LogOut, History, LayoutDashboard, Menu, X, Wallet } from 'lucide-react';

const Navbar = () => {
  const { user, loading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-black p-2 rounded-lg">
            <Car className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-gray-900">Rydo</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {loading ? (
            <div className="w-20 h-8 bg-gray-100 animate-pulse rounded-full"></div>
          ) : user ? (
            <>
              {user.role === 'driver' ? (
                <>
                  <Link to="/driver" className="flex items-center space-x-1 text-gray-600 hover:text-black transition-colors">
                    <LayoutDashboard size={20} />
                    <span className="font-medium">Dashboard</span>
                  </Link>
                  <Link to="/driver/wallet" className="flex items-center space-x-1 text-gray-600 hover:text-black transition-colors">
                    <Wallet size={20} />
                    <span className="font-medium">Wallet</span>
                  </Link>
                </>
              ) : (
                <Link to="/book" className="flex items-center space-x-1 text-gray-600 hover:text-black transition-colors">
                  <Car size={20} />
                  <span className="font-medium">Book Ride</span>
                </Link>
              )}
              
              <Link to="/history" className="flex items-center space-x-1 text-gray-600 hover:text-black transition-colors">
                <History size={20} />
                <span className="font-medium">History</span>
              </Link>

              {user.role === 'driver' && (
                <Link 
                  to="/driver/payout-settings" 
                  className="flex items-center space-x-1 text-gray-600 hover:text-black transition-colors"
                >
                  <span className="text-[18px]">🏦</span>
                  <span className="font-medium">Payout Settings</span>
                </Link>
              )}

              <div className="flex items-center space-x-3 ml-4 border-l pl-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                  <span className="text-xs text-gray-500 capitalize">{user.role}</span>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-700 font-medium hover:text-black transition-colors">Log in</Link>
              <Link to="/signup" className="bg-black text-white px-5 py-2 rounded-full font-medium hover:bg-gray-800 transition-all shadow-sm">Sign up</Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button 
          onClick={toggleMenu}
          className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 animate-in slide-in-from-top duration-300 shadow-xl pb-6">
          <div className="px-4 py-6 space-y-4">
            {loading ? (
               <div className="space-y-4">
                 <div className="w-full h-10 bg-gray-100 animate-pulse rounded-xl"></div>
                 <div className="w-full h-10 bg-gray-100 animate-pulse rounded-xl"></div>
               </div>
            ) : user ? (
              <>
                <div className="flex items-center space-x-4 pb-4 border-b border-gray-50 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                  </div>
                </div>
                
                {user.role === 'driver' ? (
                  <>
                    <Link 
                      to="/driver" 
                      className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl text-gray-900 font-bold"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <LayoutDashboard size={20} />
                      <span>Dashboard</span>
                    </Link>

                    <Link 
                      to="/driver/wallet" 
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl text-gray-600 font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Wallet size={20} />
                      <span>My Wallet</span>
                    </Link>

                    <Link 
                      to="/driver/payout-settings" 
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl text-gray-600 font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="text-[18px]">🏦</span>
                      <span>Payout Settings</span>
                    </Link>
                  </>
                ) : (
                  <Link 
                    to="/book" 
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl text-gray-900 font-bold"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Car size={20} />
                    <span>Book Ride</span>
                  </Link>
                )}

                <Link 
                  to="/history" 
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl text-gray-600 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <History size={20} />
                  <span>History</span>
                </Link>

                <button 
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-colors"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col space-y-3">
                <Link 
                  to="/login" 
                  className="w-full py-4 text-center text-gray-700 font-bold bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Log In
                </Link>
                <Link 
                  to="/signup" 
                  className="w-full py-4 text-center bg-black text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
