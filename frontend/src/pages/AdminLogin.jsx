import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      
      if (!result.success) {
        setError(result.message);
        return;
      }

      // After successful login, check role from localStorage 
      // (since context 'user' state hasn't updated in this render cycle)
      const storedUser = JSON.parse(localStorage.getItem('user'));
      
      if (storedUser?.role !== 'admin') {
        logout(); // Prevent non-admins from staying logged in via admin portal
        setError('Unauthorized. This portal is for administrators only.');
        return;
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError('An unexpected error occurred during admin login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0a0a0a] flex items-center justify-center p-6 font-sans">
      {/* Background patterns */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-600/20 rotate-3">
              <Shield size={40} className="text-white -rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2">Platform Admin</h1>
            <p className="text-gray-400 font-medium">Secure authentication required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in shake duration-300">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm font-bold">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin Email"
                  className="w-full bg-white/5 border border-white/10 text-white pl-14 pr-5 py-5 rounded-2xl focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-medium placeholder:text-gray-600"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Security Password"
                  className="w-full bg-white/5 border border-white/10 text-white pl-14 pr-5 py-5 rounded-2xl focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-medium placeholder:text-gray-600"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 disabled:opacity-50 text-lg group"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Access Terminal <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-gray-600 text-sm font-medium">
            Rydo Infrastructure Control — &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
