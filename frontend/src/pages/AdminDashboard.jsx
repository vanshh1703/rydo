import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart3, Users, Car, CheckCircle2, XCircle, 
  IndianRupee, TrendingUp, AlertCircle, Phone, 
  Star, Search, RefreshCcw, Landmark, Clock, CheckCircle, Wallet, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const token = localStorage.getItem('token');
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, drivers, finance

  // Finance States
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [isProcessingSettlement, setIsProcessingSettlement] = useState(false);

  const fetchData = async () => {
    const freshToken = localStorage.getItem('token');
    if (!freshToken) return setLoading(false);
    
    setRefreshing(true);
    
    // Fetch individual resources to prevent one failure from blocking everything
    const fetchResource = async (url, setter) => {
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${freshToken}` } });
        setter(res.data);
      } catch (err) {
        console.error(`Failed to fetch ${url}:`, err);
      }
    };

    await Promise.all([
      fetchResource('http://localhost:5000/api/admin/stats', setStats),
      fetchResource('http://localhost:5000/api/admin/drivers', setDrivers),
      fetchResource('http://localhost:5000/api/admin/pending-settlements', setPendingSettlements),
      fetchResource('http://localhost:5000/api/admin/withdrawals', setWithdrawalRequests)
    ]);

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSettleAll = async () => {
    if (!window.confirm('Are you sure you want to process all pending settlements? This will pay out all drivers.')) return;
    setIsProcessingSettlement(true);
    try {
      await axios.post('http://localhost:5000/api/admin/settle-all', {}, { headers: { Authorization: `Bearer ${token}` } });
      alert('Evening settlements processed successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to process settlements');
    } finally {
      setIsProcessingSettlement(false);
    }
  };

  const handleWithdrawal = async (requestId, status) => {
    try {
      await axios.post('http://localhost:5000/api/admin/handle-withdrawal', {
        requestId,
        status
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Withdrawal request ${status}`);
      fetchData();
    } catch (err) {
      alert('Failed to process withdrawal request');
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.driver_phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-gray-500 text-lg">Initializing Admin Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Platform Analytics</h1>
            <p className="text-gray-500 font-medium mt-2">Real-time overview of your Rydo infrastructure</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'overview' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
              >Overview</button>
              <button 
                onClick={() => setActiveTab('drivers')}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'drivers' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
              >Drivers</button>
              <button 
                onClick={() => setActiveTab('finance')}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'finance' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
              >Finance {withdrawalRequests.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{withdrawalRequests.length}</span>}</button>
            </div>
            <button 
              onClick={fetchData}
              disabled={refreshing}
              className="flex items-center gap-3 bg-white border border-gray-200 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm group active:scale-95"
            >
              <RefreshCcw size={20} className={`${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Revenue" 
                value={`₹ ${parseFloat(stats?.total_earnings || 0).toLocaleString()}`} 
                icon={<IndianRupee className="text-green-600" />}
                color="bg-green-100"
                trend="+12% from last week"
              />
              <StatCard 
                title="Total Rides" 
                value={stats?.total_rides || 0} 
                icon={<BarChart3 className="text-blue-600" />}
                color="bg-blue-100"
                trend={`${stats?.completed_rides || 0} completed`}
              />
              <StatCard 
                title="Active Drivers" 
                value={stats?.total_drivers || 0} 
                icon={<Car className="text-purple-600" />}
                color="bg-purple-100"
                trend="Active Partners"
              />
              <StatCard 
                title="Cancellations" 
                value={stats?.cancelled_rides || 0} 
                icon={<XCircle className="text-red-600" />}
                color="bg-red-100"
                trend={`${((stats?.cancelled_rides / stats?.total_rides) * 100 || 0).toFixed(1)}% bounce rate`}
              />
            </div>
            
            <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black mb-2">Finance Overview</h3>
                <p className="text-gray-500 font-medium">Pending daily settlements total: <span className="text-blue-600 font-bold">₹{pendingSettlements.reduce((acc, curr) => acc + parseFloat(curr.wallet_balance), 0).toLocaleString()}</span></p>
              </div>
              <button 
                onClick={() => setActiveTab('finance')}
                className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
              >Manage Payouts</button>
            </div>

            {/* Re-integrated Drivers list for better visibility */}
            <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-2xl font-black text-gray-900">Registered Driver Partners</h3>
                <button onClick={() => setActiveTab('drivers')} className="text-blue-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  View Detailed Performance <ChevronRight size={18} />
                </button>
              </div>
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                                <th className="px-8 py-6">Driver Partner</th>
                                <th className="px-8 py-6">Vehicle</th>
                                <th className="px-8 py-6">Rating</th>
                                <th className="px-8 py-6 text-right">Lifetime Earnings</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {drivers.length === 0 ? (
                                <tr><td colSpan="4" className="px-8 py-10 text-center text-gray-400 font-bold">No drivers registered yet</td></tr>
                            ) : (
                                drivers.slice(0, 5).map((driver) => (
                                <tr key={driver.id} className="hover:bg-gray-50/80 transition-all group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-gray-400">
                                                {driver.driver_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{driver.driver_name}</p>
                                                <p className="text-[10px] text-gray-500 uppercase font-black">{driver.driver_phone}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="bg-gray-100 text-gray-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                                            {driver.vehicle_type}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                            <span className="font-bold">{parseFloat(driver.rating_avg).toFixed(1)}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right font-black text-gray-900">
                                        ₹ {parseFloat(driver.total_earnings || 0).toLocaleString()}
                                    </td>
                                </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="animate-in fade-in slide-in-from-bottom duration-500">
            {/* Drivers Section */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Driver Performance</h2>
                  <p className="text-gray-500 text-sm font-medium">Monitoring {drivers.length} registered partners</p>
                </div>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by name or phone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                      <th className="px-8 py-6">Driver Partner</th>
                      <th className="px-8 py-6">Vehicle</th>
                      <th className="px-8 py-6">Rating</th>
                      <th className="px-8 py-6">Rides (Cpl/Can)</th>
                      <th className="px-8 py-6">Earnings</th>
                      <th className="px-8 py-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDrivers.map((driver) => (
                      <tr key={driver.id} className="hover:bg-gray-50/80 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gray-100 to-gray-200 flex items-center justify-center font-black text-gray-400 group-hover:scale-110 transition-transform">
                              {driver.driver_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{driver.driver_name}</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone size={10} /> {driver.driver_phone}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="bg-gray-100 text-gray-700 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg tracking-tighter">
                            {driver.vehicle_type}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <Star size={16} className="text-yellow-400 fill-yellow-400" />
                            <span className="font-bold">{parseFloat(driver.rating_avg).toFixed(1)}</span>
                            <span className="text-xs text-gray-400 font-medium">({driver.rating_count})</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3 font-bold">
                            <span className="text-green-600">{driver.rides_completed}</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-red-400">{driver.rides_cancelled}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-gray-900">₹ {parseFloat(driver.total_earnings || 0).toLocaleString()}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2 text-green-500 font-bold text-xs uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            Verified
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom duration-500">
            {/* Settlements Section */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                    <Landmark className="text-blue-600" /> 
                    Evening Settlements
                  </h2>
                  <p className="text-gray-500 text-sm font-medium mt-1">Found {pendingSettlements.length} drivers with pending balances</p>
                </div>
                <button 
                  onClick={handleSettleAll}
                  disabled={isProcessingSettlement || pendingSettlements.length === 0}
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:grayscale"
                >
                  {isProcessingSettlement ? 'Processing...' : 'Settle All Portfolios'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                      <th className="px-8 py-6">Driver Partner</th>
                      <th className="px-8 py-6">Phone Number</th>
                      <th className="px-8 py-6 text-right">Pending Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingSettlements.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-8 py-10 text-center text-gray-400 font-bold">No pending settlements for today</td>
                      </tr>
                    ) : (
                      pendingSettlements.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-all">
                          <td className="px-8 py-6 font-bold text-gray-900">{s.driver_name}</td>
                          <td className="px-8 py-6 text-gray-500 font-medium">{s.driver_phone}</td>
                          <td className="px-8 py-6 text-right font-black text-blue-600 text-lg font-mono">₹{parseFloat(s.wallet_balance).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Withdrawal Requests Section */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-transparent">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                  <Clock className="text-yellow-600" /> 
                  Early Withdrawal Requests
                </h2>
                <p className="text-gray-500 text-sm font-medium mt-1">Requires manual review and bank transfer</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                      <th className="px-8 py-6">Requester</th>
                      <th className="px-8 py-6">Amount Requested</th>
                      <th className="px-8 py-6">Driver Balance</th>
                      <th className="px-8 py-6">Requested At</th>
                      <th className="px-8 py-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {withdrawalRequests.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-8 py-10 text-center text-gray-400 font-bold">No active withdrawal requests</td>
                      </tr>
                    ) : (
                      withdrawalRequests.map(wr => (
                        <tr key={wr.id} className="hover:bg-gray-50/50 transition-all group">
                          <td className="px-8 py-6">
                            <p className="font-bold text-gray-900">{wr.driver_name}</p>
                            <p className="text-xs text-gray-500">{wr.driver_phone}</p>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-black text-gray-900 text-lg">₹{parseFloat(wr.amount).toLocaleString()}</span>
                          </td>
                          <td className="px-8 py-6 text-gray-400 font-bold">₹{parseFloat(wr.current_balance).toLocaleString()}</td>
                          <td className="px-8 py-6 text-gray-500 text-sm font-medium">{new Date(wr.created_at).toLocaleString()}</td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleWithdrawal(wr.id, 'rejected')}
                                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                title="Reject Request"
                              >
                                <XCircle size={20} />
                              </button>
                              <button 
                                onClick={() => handleWithdrawal(wr.id, 'approved')}
                                className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                                title="Approve Request"
                              >
                                <CheckCircle size={20} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, trend }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl ${color} shadow-inner`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-lg">
        <TrendingUp size={14} />
      </div>
    </div>
    <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
    <h3 className="text-3xl font-black text-gray-900 mb-4">{value}</h3>
    <p className="text-gray-400 text-[10px] font-bold">{trend}</p>
  </div>
);

export default AdminDashboard;
