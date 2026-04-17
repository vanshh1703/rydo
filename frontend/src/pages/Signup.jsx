import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User as UserIcon, Phone, Car, ArrowRight, AlertCircle } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    vehicleType: 'Standard'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await register(formData);
    if (result.success) {
      navigate(formData.role === 'driver' ? '/driver' : '/book');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-12 px-4 bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-12 border border-gray-100">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Create your account</h2>
          <p className="text-gray-500 mt-3 text-lg">Join Rydo today and start moving easily</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center space-x-3 rounded-r-xl">
            <AlertCircle size={24} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all"
                  placeholder="John Doe"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  name="phone"
                  type="tel"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all"
                  placeholder="+1 (555) 000-0000"
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                name="email"
                type="email"
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all"
                placeholder="john@example.com"
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                name="password"
                type="password"
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all"
                placeholder="••••••••"
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="pt-4">
            <label className="block text-sm font-bold text-gray-700 mb-4 text-center">I want to join as a:</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'user' })}
                className={`flex-1 py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center gap-2 ${
                  formData.role === 'user' ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <UserIcon size={24} />
                <span>Rider</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'driver' })}
                className={`flex-1 py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center gap-2 ${
                  formData.role === 'driver' ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Car size={24} />
                <span>Driver</span>
              </button>
            </div>
          </div>

          {formData.role === 'driver' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="block text-sm font-bold text-gray-700 mb-2">Vehicle Type</label>
              <select
                name="vehicleType"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black outline-none"
                onChange={handleChange}
              >
                <option value="mini">Standard (Hatchback)</option>
                <option value="sedan">Premium (Sedan)</option>
                <option value="xl">XL (SUV/6-seater)</option>
                <option value="moto">Moto (Bike)</option>
                <option value="scooty">Scooty</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-5 rounded-2xl font-bold text-xl hover:bg-gray-800 transition-all flex items-center justify-center space-x-3 group disabled:opacity-50 mt-8 shadow-xl"
          >
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
            {!loading && <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-gray-600 text-lg">
            Already have an account?{' '}
            <Link to="/login" className="text-black font-bold hover:underline">
              Log in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
