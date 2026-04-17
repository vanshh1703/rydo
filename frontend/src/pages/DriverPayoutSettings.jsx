import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Landmark, CreditCard, Plus, CheckCircle2, Clock,
  AlertCircle, ShieldCheck, Smartphone, ChevronRight, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

const DriverPayoutSettings = () => {
  const { token } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('bank'); // 'bank' | 'upi'
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_holder_name: '',
    account_number: '',
    confirm_account: '',
    ifsc_code: '',
    bank_name: '',
    upi_vpa: '',
  });

  const getToken = () => token || localStorage.getItem('token');

  const fetchMethods = async () => {
    try {
      const res = await axios.get(`${API}/ride/payout-methods`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setMethods(res.data);
    } catch (err) {
      console.error('Failed to fetch payout methods:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMethods(); }, [token]);

  const handleAdd = async (e) => {
    e.preventDefault();

    if (formType === 'bank') {
      if (form.account_number !== form.confirm_account) {
        return alert('Account numbers do not match');
      }
      if (!form.ifsc_code.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)) {
        return alert('Invalid IFSC code format (e.g. SBIN0001234)');
      }
    }

    if (formType === 'upi' && !form.upi_vpa.includes('@')) {
      return alert('Invalid UPI ID. Must contain @');
    }

    try {
      setSaving(true);
      await axios.post(`${API}/ride/payout-methods`, {
        method_type: formType,
        ...form,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });

      alert('✅ Payout method added! A 48-hour security cooldown is now active.');
      setShowForm(false);
      setForm({ account_holder_name: '', account_number: '', confirm_account: '', ifsc_code: '', bank_name: '', upi_vpa: '' });
      fetchMethods();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add payout method');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (methodId) => {
    try {
      await axios.patch(`${API}/ride/payout-methods/set-active`, { methodId }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      fetchMethods();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set active method');
    }
  };

  const isCooldown = (method) => method.cooldown_until && new Date(method.cooldown_until) > new Date();

  const cooldownHours = (method) => {
    if (!isCooldown(method)) return 0;
    return Math.ceil((new Date(method.cooldown_until) - new Date()) / 3600000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f8f9fa] p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
              <Landmark size={32} className="text-blue-600" />
              Payout Settings
            </h1>
            <p className="text-gray-500 text-sm mt-2">Manage your bank account or UPI ID for earnings withdrawal.</p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200"
            >
              <Plus size={18} /> Add Method
            </button>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
          <ShieldCheck size={22} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Security Policy</p>
            <p className="text-amber-700 text-xs mt-1">
              After adding a new payout method, a <strong>48-hour cooldown</strong> applies before withdrawals can be processed. 
              You cannot change payout methods while a withdrawal is pending.
            </p>
          </div>
        </div>

        {/* Add Method Form */}
        {showForm && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8">
            <h2 className="text-xl font-black text-gray-900 mb-6">Add Payout Method</h2>

            {/* Type Toggle */}
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl w-fit mb-8">
              <button onClick={() => setFormType('bank')}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${formType === 'bank' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                <Landmark size={16} /> Bank Account
              </button>
              <button onClick={() => setFormType('upi')}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${formType === 'upi' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                <Smartphone size={16} /> UPI
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-5">
              {formType === 'bank' ? (
                <>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Account Holder Name</label>
                      <input required value={form.account_holder_name}
                        onChange={e => setForm(p => ({ ...p, account_holder_name: e.target.value }))}
                        placeholder="As per bank records"
                        className="w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 font-medium text-gray-900 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Account Number</label>
                      <input required type="password" value={form.account_number}
                        onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))}
                        placeholder="Enter account number"
                        className="w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 font-medium focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Confirm Account Number</label>
                      <input required value={form.confirm_account}
                        onChange={e => setForm(p => ({ ...p, confirm_account: e.target.value }))}
                        placeholder="Re-enter account number"
                        className="w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 font-medium focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">IFSC Code</label>
                      <input required value={form.ifsc_code}
                        onChange={e => setForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                        placeholder="e.g. SBIN0001234"
                        maxLength={11}
                        className="w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 font-medium font-mono focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Bank Name</label>
                      <input value={form.bank_name}
                        onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                        placeholder="e.g. State Bank of India"
                        className="w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 font-medium focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">UPI ID (VPA)</label>
                  <input required value={form.upi_vpa}
                    onChange={e => setForm(p => ({ ...p, upi_vpa: e.target.value }))}
                    placeholder="yourname@upi"
                    className="w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 font-medium focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-2">Supported: @okaxis, @ybl, @upi, @paytm, @okhdfcbank, etc.</p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Payout Method'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-4 rounded-xl font-bold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Saved Methods */}
        <div className="space-y-4">
          <h2 className="text-lg font-black text-gray-700 uppercase tracking-wider text-sm">Saved Methods</h2>

          {methods.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
              <Landmark size={48} className="text-gray-200 mx-auto mb-4" />
              <p className="font-bold text-gray-400">No payout methods added yet</p>
              <p className="text-gray-300 text-sm mt-1">Add a bank account or UPI to receive withdrawals</p>
            </div>
          ) : (
            methods.map(method => (
              <div key={method.id} className={`bg-white rounded-2xl border ${method.is_active ? 'border-blue-200 shadow-blue-50' : 'border-gray-100'} shadow-lg p-6 flex items-center gap-5`}>
                {/* Icon */}
                <div className={`p-3 rounded-xl ${method.is_active ? 'bg-blue-600' : 'bg-gray-100'}`}>
                  {method.method_type === 'upi'
                    ? <Smartphone size={22} className={method.is_active ? 'text-white' : 'text-gray-500'} />
                    : <Landmark size={22} className={method.is_active ? 'text-white' : 'text-gray-500'} />
                  }
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-black text-gray-900 capitalize">{method.method_type === 'upi' ? 'UPI' : 'Bank Account'}</p>
                    {method.is_active && (
                      <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Active</span>
                    )}
                    {isCooldown(method) && (
                      <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[10px] px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1">
                        <Clock size={10} />Cooldown {cooldownHours(method)}h
                      </span>
                    )}
                  </div>
                  {method.method_type === 'upi'
                    ? <p className="text-sm text-gray-500 font-medium">{method.upi_vpa}</p>
                    : <p className="text-sm text-gray-500 font-medium font-mono">{method.masked_account} · {method.ifsc_code}</p>
                  }
                  <p className="text-xs text-gray-400 mt-1">Added {new Date(method.created_at).toLocaleDateString()}</p>
                </div>

                {/* Action */}
                {!method.is_active && (
                  <button onClick={() => handleSetActive(method.id)}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-gray-100 text-gray-700 hover:bg-blue-600 hover:text-white transition-all"
                  >
                    Set Active
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverPayoutSettings;
