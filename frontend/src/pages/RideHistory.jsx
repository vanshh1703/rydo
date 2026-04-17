import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getStatusColor } from '../utils/rideUtils';
import { Clock, MapPin, Navigation, Calendar, IndianRupee, ChevronRight, AlertCircle } from 'lucide-react';

const RideHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:5000/ride/history');
        setHistory(res.data);
      } catch (err) {
        setError('Failed to fetch ride history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 md:mb-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Your Trips</h1>
          <p className="text-gray-500 mt-2 font-medium text-sm md:text-base">Review your past journeys and receipts</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-r-xl flex items-center gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-red-700 font-medium text-sm">{error}</p>
          </div>
        )}

        {history.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-8 md:p-12 text-center shadow-sm border border-gray-100">
            <div className="bg-gray-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <Clock size={32} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">No trips yet</h3>
            <p className="text-sm md:text-base text-gray-500 max-w-xs mx-auto mb-8">When you complete a ride, it will appear here for your records.</p>
            {user.role === 'user' && (
              <a href="/book" className="inline-block bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-all text-sm md:text-base">
                Book your first ride
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((ride) => (
              <div 
                key={ride.id} 
                className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col md:flex-row gap-4 md:gap-6 items-center group cursor-pointer"
              >
                <div className="flex-grow w-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-yellow-400 transition-colors">
                        <Calendar size={20} className="text-gray-600 group-hover:text-black" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          {new Date(ride.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                          {new Date(ride.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusColor(ride.status)}`}>
                      {ride.status}
                    </div>
                  </div>

                  <div className="flex gap-4 mb-6">
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div className="w-0.5 h-6 bg-gray-100"></div>
                      <div className="w-2 h-2 rounded-full bg-black"></div>
                    </div>
                    <div className="flex-grow space-y-3">
                      <p className="text-sm font-medium text-gray-500 truncate max-w-md">
                        {ride.pickup_address || 'Pickup address not recorded'}
                      </p>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-md">
                        {ride.drop_address || 'Drop-off address not recorded'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2 text-gray-600">
                      <IndianRupee size={16} className="font-bold" />
                      <span className="font-black text-lg text-black">{ride.fare}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                      <Navigation size={14} />
                      {ride.distance_km} km
                    </div>
                  </div>
                </div>
                
                <div className="w-full md:w-auto flex md:block">
                  <button className="flex-grow md:flex-none p-4 bg-gray-50 text-gray-400 rounded-2xl group-hover:bg-black group-hover:text-white transition-all">
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RideHistory;
