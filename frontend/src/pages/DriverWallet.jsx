import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wallet, IndianRupee, ArrowUpRight, Clock, 
  CheckCircle2, XCircle, TrendingUp, Landmark, ArrowRight, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DriverWallet = () => {
  const { token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [amount, setAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWalletData = async () => {
    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;
    
    try {
      setRefreshing(true);
      const [statsRes, historyRes] = await Promise.all([
        axios.get('http://localhost:5000/ride/stats', { headers: { Authorization: `Bearer ${activeToken}` } }),
        axios.get('http://localhost:5000/ride/withdrawals', { headers: { Authorization: `Bearer ${activeToken}` } })
      ]);
      setBalance(statsRes.data.wallet_balance || 0);
      setTotalEarnings(statsRes.data.total_earnings || 0);
      setWithdrawals(historyRes.data);
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [token]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Please enter a valid amount');
    if (amount > balance) return alert('Insufficient balance');

    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;

    try {
      setRequesting(true);
      await axios.post('http://localhost:5000/ride/withdraw', 
        { amount: parseFloat(amount) }, 
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      alert('Withdrawal request submitted successfully!');
      setAmount('');
      fetchWalletData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f8f9fa] p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Wallet className="text-blue-600" size={40} />
              Driver Wallet
            </h1>
            <p className="text-gray-500 font-medium mt-2">Manage your earnings and early withdrawals</p>
          </div>
          <button 
            onClick={fetchWalletData}
            disabled={refreshing}
            className="bg-white border border-gray-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Balance'}
          </button>
        </div>

        {/* Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-12">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                  <IndianRupee size={32} className="text-blue-400" />
                </div>
                <div className="bg-green-500/20 text-green-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-green-500/30">
                  Secure Fund
                </div>
              </div>
              <p className="text-blue-200/60 font-black uppercase tracking-[0.2em] text-xs mb-2">Available Balance</p>
              <h2 className="text-6xl font-black mb-10 flex items-baseline gap-2 tabular-nums">
                <span className="text-3xl font-medium text-white/50">₹</span>
                {parseFloat(balance).toLocaleString()}
              </h2>
              <div className="mt-auto flex items-center gap-8 border-t border-white/10 pt-8">
                <div>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Total Lifetime Earnings</p>
                  <p className="text-xl font-bold">₹{parseFloat(totalEarnings).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Status</p>
                  <p className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-500" />
                    Verified
                  </p>
                </div>
              </div>
            </div>
            {/* Background design elements */}
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20"></div>
            <div className="absolute top-10 right-10 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Withdraw Early</h3>
              <p className="text-gray-500 text-sm font-medium mb-8">Funds are credited to your bank within 24 hours of approval.</p>
              
              <form onSubmit={handleWithdraw} className="space-y-6">
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</div>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl py-6 pl-12 pr-6 focus:outline-none focus:border-blue-500 transition-all font-black text-2xl placeholder:text-gray-300"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={requesting || !amount}
                  className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                >
                  {requesting ? 'Processing...' : (
                    <>
                      Withdraw Now <ArrowRight size={24} />
                    </>
                  )}
                </button>
              </form>
            </div>
            <p className="text-[10px] text-gray-400 font-medium text-center mt-6 uppercase tracking-widest leading-relaxed">
              Standard evening settlements are automatic. Early withdrawals may carry small processing fees.
            </p>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Withdrawal History</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">Showing your recent payout requests</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
              <Clock className="text-gray-400" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-50">
                  <th className="px-10 py-6">Reference ID</th>
                  <th className="px-10 py-6">Amount</th>
                  <th className="px-10 py-6">Requested At</th>
                  <th className="px-10 py-6">Status</th>
                  <th className="px-10 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-10 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 grayscale opacity-40">
                        <Landmark size={60} className="text-gray-300" />
                        <p className="font-black text-gray-400 text-xl">No history found yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  withdrawals.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50/80 transition-all group">
                      <td className="px-10 py-7">
                        <span className="font-mono text-xs text-gray-400 font-bold uppercase">#{w.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-10 py-7">
                        <span className="text-lg font-black text-gray-900">₹{parseFloat(w.amount).toLocaleString()}</span>
                      </td>
                      <td className="px-10 py-7">
                        <p className="text-sm font-bold text-gray-600">{new Date(w.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">{new Date(w.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-10 py-7">
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          w.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100' : 
                          w.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                          'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                             w.status === 'approved' ? 'bg-green-500' : 
                             w.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 
                             'bg-red-500'
                          }`}></div>
                          {w.status}
                        </div>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <button className="text-gray-300 group-hover:text-blue-600 transition-colors">
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-8 bg-gray-50/50 border-t border-gray-50 flex items-center justify-center">
             <button className="text-blue-600 font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                Export Statement <ArrowUpRight size={18} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverWallet;
