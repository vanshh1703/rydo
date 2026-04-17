import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wallet, IndianRupee, ArrowUpRight, Clock, 
  CheckCircle2, XCircle, TrendingUp, Landmark, ArrowRight, ChevronRight,
  Zap, Star, Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DriverWallet = () => {
  const { token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [amount, setAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [activeTab, setActiveTab] = useState('withdrawals'); // 'withdrawals' | 'ledger'

  const getToken = () => token || localStorage.getItem('token');

  const fetchWalletData = async () => {
    const activeToken = getToken();
    if (!activeToken) return;
    try {
      setRefreshing(true);
      const [statsRes, historyRes, ledgerRes] = await Promise.all([
        axios.get('http://localhost:5000/ride/stats', { headers: { Authorization: `Bearer ${activeToken}` } }),
        axios.get('http://localhost:5000/ride/withdrawals', { headers: { Authorization: `Bearer ${activeToken}` } }),
        axios.get('http://localhost:5000/ride/ledger', { headers: { Authorization: `Bearer ${activeToken}` } }),
      ]);
      setBalance(statsRes.data.wallet_balance || 0);
      setTotalEarnings(statsRes.data.total_earnings || 0);
      setWithdrawals(historyRes.data);
      setLedger(ledgerRes.data || []);
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchWalletData(); }, [token]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Please enter a valid amount');
    if (parseFloat(amount) > balance) return alert('Insufficient balance');
    const activeToken = getToken();
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

  const handleSubscribe = async () => {
    if (!window.confirm('Purchase the Zero-Commission Day Plan? ₹100 will be deducted from your wallet.')) return;
    const activeToken = getToken();
    if (!activeToken) return;
    try {
      setSubscribing(true);
      const res = await axios.post('http://localhost:5000/ride/subscribe', {}, { headers: { Authorization: `Bearer ${activeToken}` } });
      alert(`✅ ${res.data.message}. Commission-free for 24 hours!`);
      fetchWalletData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to purchase subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const txTypeStyle = (type) => {
    if (type === 'ride_earnings') return 'text-green-600 bg-green-50 border-green-100';
    if (type === 'platform_commission') return 'text-red-600 bg-red-50 border-red-100';
    if (type === 'subscription_fee') return 'text-purple-600 bg-purple-50 border-purple-100';
    if (type === 'withdrawal') return 'text-orange-600 bg-orange-50 border-orange-100';
    return 'text-gray-600 bg-gray-50 border-gray-100';
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f8f9fa] p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Wallet className="text-blue-600" size={40} />
              Driver Wallet
            </h1>
            <p className="text-gray-500 font-medium mt-2">Manage your earnings and payouts</p>
          </div>
          <button 
            onClick={fetchWalletData}
            disabled={refreshing}
            className="bg-white border border-gray-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Balance Card */}
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
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Lifetime Earnings</p>
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
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20"></div>
          </div>

          {/* Right Column: Withdraw + Subscribe */}
          <div className="flex flex-col gap-5">
            {/* Withdraw Card */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col">
              <h3 className="text-xl font-black text-gray-900 mb-1">Withdraw Early</h3>
              <p className="text-gray-400 text-xs font-medium mb-5">Credited within 24h of admin approval.</p>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</div>
                  <input 
                    type="number" placeholder="0.00" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-50 rounded-xl py-4 pl-10 pr-5 focus:outline-none focus:border-blue-500 transition-all font-black text-xl placeholder:text-gray-300"
                  />
                </div>
                <button type="submit" disabled={requesting || !amount}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {requesting ? 'Processing...' : <><span>Withdraw</span> <ArrowRight size={20} /></>}
                </button>
              </form>
            </div>

            {/* Zero Commission Subscription */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-2xl shadow-purple-200/50">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={20} className="text-yellow-300" fill="currentColor" />
                <span className="text-xs font-black uppercase tracking-widest text-purple-200">Zero Commission</span>
              </div>
              <h3 className="text-2xl font-black mb-1">Day Pass</h3>
              <p className="text-purple-200 text-xs mb-5">Keep 100% of every fare for 24 hours. Deducted from your balance.</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-black">₹100</span>
                <span className="text-purple-300 text-sm">/ day</span>
              </div>
              <button onClick={handleSubscribe} disabled={subscribing || balance < 100}
                className="w-full bg-white text-purple-700 py-3 rounded-xl font-black text-sm hover:bg-purple-50 active:scale-95 transition-all disabled:opacity-50"
              >
                {subscribing ? 'Activating...' : balance < 100 ? 'Insufficient Balance' : 'Activate Plan'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit shadow-sm">
          <button onClick={() => setActiveTab('withdrawals')}
            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'withdrawals' ? 'bg-gray-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Clock size={14} className="inline mr-2" />Withdrawals
          </button>
          <button onClick={() => setActiveTab('ledger')}
            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'ledger' ? 'bg-gray-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Receipt size={14} className="inline mr-2" />Transaction Ledger
          </button>
        </div>

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Withdrawal History</h2>
                <p className="text-gray-500 text-sm font-medium mt-1">Recent payout requests</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <Clock className="text-gray-400" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-50">
                    <th className="px-10 py-6">Reference</th>
                    <th className="px-10 py-6">Amount</th>
                    <th className="px-10 py-6">Date</th>
                    <th className="px-10 py-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawals.length === 0 ? (
                    <tr><td colSpan="4" className="px-10 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 grayscale opacity-40">
                        <Landmark size={60} className="text-gray-300" />
                        <p className="font-black text-gray-400 text-xl">No withdrawals yet</p>
                      </div>
                    </td></tr>
                  ) : withdrawals.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50/80 transition-all">
                      <td className="px-10 py-7"><span className="font-mono text-xs text-gray-400 font-bold uppercase">#{w.id.slice(0,8)}</span></td>
                      <td className="px-10 py-7"><span className="text-lg font-black text-gray-900">₹{parseFloat(w.amount).toLocaleString()}</span></td>
                      <td className="px-10 py-7"><p className="text-sm font-bold text-gray-600">{new Date(w.created_at).toLocaleDateString()}</p></td>
                      <td className="px-10 py-7">
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          w.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100' : 
                          w.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                          'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${w.status === 'approved' ? 'bg-green-500' : w.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                          {w.status}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="p-10 border-b border-gray-50 bg-gray-50/30">
              <h2 className="text-2xl font-black text-gray-900">Transaction Ledger</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">Full audit trail of all credits and debits</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-50">
                    <th className="px-10 py-6">Type</th>
                    <th className="px-10 py-6">Description</th>
                    <th className="px-10 py-6">Amount</th>
                    <th className="px-10 py-6">Balance After</th>
                    <th className="px-10 py-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ledger.length === 0 ? (
                    <tr><td colSpan="5" className="px-10 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 grayscale opacity-40">
                        <Receipt size={60} className="text-gray-300" />
                        <p className="font-black text-gray-400 text-xl">No transactions yet</p>
                      </div>
                    </td></tr>
                  ) : ledger.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50/80 transition-all">
                      <td className="px-10 py-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${txTypeStyle(tx.transaction_type)}`}>
                          {tx.transaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-sm text-gray-600 font-medium">{tx.description || '—'}</td>
                      <td className="px-10 py-6">
                        <span className={`text-lg font-black ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.amount >= 0 ? '+' : ''}₹{Math.abs(parseFloat(tx.amount)).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-10 py-6"><span className="text-sm font-bold text-gray-700">₹{parseFloat(tx.balance_after).toLocaleString()}</span></td>
                      <td className="px-10 py-6"><p className="text-sm text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverWallet;
