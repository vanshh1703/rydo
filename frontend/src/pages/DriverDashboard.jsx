import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import MapView from '../components/MapView';
import { useAuth } from '../context/AuthContext';
import { Power, MapPin, Navigation, Clock, CheckCircle, XCircle, AlertCircle, Phone, Car, Bike, Wallet, CreditCard, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const socket = io('http://localhost:5000');

const DriverDashboard = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [location, setLocation] = useState(null);

  const [earnings, setEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [rating, setRating] = useState({ avg: 5.0, count: 0 });
  const [isPaid, setIsPaid] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [activePath, setActivePath] = useState([]);
  const [otpInput, setOtpInput] = useState('');
  
  // Removed redundant wallet states

  // Fetch actual road route for the driver to follow
  const fetchPath = useCallback(async (start, end) => {
    if (!start || !end) return;
    try {
      const osrmAxios = axios.create();
      delete osrmAxios.defaults.headers.common['Authorization'];
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const res = await osrmAxios.get(url);
      if (res.data.routes?.length > 0) {
        const coords = res.data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setActivePath(coords);
      }
    } catch (err) {
      console.error('Driver routing error:', err);
      setActivePath([start, end]); // Fallback
    }
  }, []);

  // Session Restoration & Initial Stats (Run ONCE on mount)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchStats = async () => {
      try {
        const [activeRes, statsRes] = await Promise.all([
          axios.get('http://localhost:5000/ride/active', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:5000/ride/stats', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (activeRes.data) {
          const ride = activeRes.data;
          setCurrentRide(ride);
          setIsPaid(ride.payment_status === 'completed');
          socket.emit('track-ride', ride.id);
          
          // Restore path based on status for visualization
          if (ride.status === 'accepted' && location) {
            fetchPath(location, [ride.pickup_lat, ride.pickup_lng]);
          } else if (ride.status === 'started') {
            fetchPath([ride.pickup_lat, ride.pickup_lng], [ride.drop_lat, ride.drop_lng]);
          }
        }

        if (statsRes.data) {
          setEarnings(statsRes.data.total_earnings || 0);
          setTodayEarnings(statsRes.data.today_earnings || 0);
          setWalletBalance(statsRes.data.wallet_balance || 0);
          setTotalRides(statsRes.data.total_rides || 0);
          setRating({
            avg: statsRes.data.rating_avg || 5.0,
            count: statsRes.data.rating_count || 0
          });
          setIsOnline(statsRes.data.is_online || false);
        }
      } catch (err) {
        console.error('Driver session recovery failed:', err);
      }
    };

    // Removed fetchWithdrawals from dashboard

    fetchStats();

    // Get initial location on mount to center the map
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.log("Initial driver location denied."),
        { enableHighAccuracy: true }
      );
    }

    if (user?.driverId) {
      socket.emit('join-driver', user.driverId);
    }
  }, []); // Run once on mount

  // Socket Listeners (Reactive to online state and active ride)
  useEffect(() => {
    socket.on('ride-request-created', (data) => {
      // Only show request if online, not in a ride, and vehicle type matches
      if (isOnline && !currentRide && data.vehicle_type === user?.vehicleType) {
        setIncomingRequest(data);
        // Automatically show the path to pickup to help driver decide
        if (location) {
          fetchPath(location, [data.pickup_lat, data.pickup_lng]);
        }
      }
    });

    socket.on('ride-assigned', (data) => {
      // Use functional state updates to avoid dependency issues if needed, 
      // but here we just need to clear it if it matches
      setIncomingRequest(prev => prev?.id === data.rideId ? null : prev);
    });

    socket.on('ride-cancelled-by-rider', () => {
      alert('The rider has cancelled the trip.');
      setCurrentRide(null);
    });

    socket.on('payment-received', (data) => {
      console.log('Payment notification received for ride:', data.rideId);
      setIsPaid(true);
    });

    return () => {
      socket.off('ride-request-created');
      socket.off('ride-assigned');
      socket.off('ride-cancelled-by-rider');
      socket.off('payment-received');
    };
  }, [isOnline, currentRide]); // Update listeners when online status or context changes

  // REAL-TIME GPS Tracking & Broadcast (No Simulation)
  useEffect(() => {
    let watchId;
    if (isOnline && "geolocation" in navigator) {
      setIsTracking(true);
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const newLoc = [latitude, longitude];
          setLocation(newLoc);
          
          // Broadcast real location change to backend
          socket.emit('driver-location-update', {
            driverId: user?.driverId,
            lat: latitude,
            lng: longitude
          });
        },
        (err) => {
          console.error("GPS Tracking Error:", err);
          setIsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    } else {
      setIsTracking(false);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, user?.driverId]);

  const toggleOnline = async () => {
    try {
      const nextState = !isOnline;

      if (nextState && !location) {
        // Request location upon going online (User Gesture)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setLocation([latitude, longitude]);
            // Sync initial location to database via socket immediately
            socket.emit('driver-location-update', {
              driverId: user?.driverId,
              lat: latitude,
              lng: longitude
            });
          },
          (err) => alert("Please enable location to go online.")
        );
      }

      await axios.post('http://localhost:5000/ride/driver-status', {
        isOnline: nextState
      });
      setIsOnline(nextState);
    } catch (err) {
      alert('Error updating online status');
    }
  };

  const handleAccept = async () => {
    try {
      socket.emit('ride-request-response', {
        rideId: incomingRequest.id,
        driverId: user.driverId,
        status: 'accepted'
      });
      setCurrentRide({ ...incomingRequest, status: 'accepted' });
      setIsPaid(false);
      socket.emit('track-ride', incomingRequest.id);
      setIncomingRequest(null);

      // Fetch path to pickup for navigation UI
      if (location) {
        fetchPath(location, [incomingRequest.pickup_lat, incomingRequest.pickup_lng]);
      }
    } catch (err) {
      console.error('Error accepting ride:', err);
    }
  };

  const updateRideStatus = async (status, otp) => {
    try {
      await axios.post('http://localhost:5000/ride/update-status', {
        rideId: currentRide.id,
        status,
        otp
      });

      if (status === 'completed') {
        alert('Ride completed! Your earnings have been updated.');
        setCurrentRide(null);
        // Refresh earnings
        const token = localStorage.getItem('token');
        const statsRes = await axios.get('http://localhost:5000/ride/stats', { headers: { Authorization: `Bearer ${token}` } });
        if (statsRes.data) {
          setEarnings(statsRes.data.total_earnings || 0);
          setTodayEarnings(statsRes.data.today_earnings || 0);
          setTotalRides(statsRes.data.total_rides || 0);
          setRating({
            avg: statsRes.data.rating_avg || 5.0,
            count: statsRes.data.rating_count || 0
          });
        }
      } else {
        setCurrentRide({ ...currentRide, status });
        setOtpInput(''); // Clear OTP input after successful use
        // If trip started, fetch path to drop-off for navigation UI
        if (status === 'started') {
          fetchPath([currentRide.pickup_lat, currentRide.pickup_lng], [currentRide.drop_lat, currentRide.drop_lng]);
        }
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  // Removed handleWithdrawalRequest from dashboard

  const handleCancelRide = async () => {
    if (!currentRide) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/ride/cancel', {
        rideId: currentRide.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentRide(null);
    } catch (err) {
      alert('Failed to cancel ride');
    }
  };

  return (
    <div className="relative h-[calc(100vh-64px)] flex flex-col md:flex-row-reverse bg-gray-50 overflow-hidden shadow-inner">
      {/* Map display */}
      <div className="relative h-[40vh] md:h-full md:flex-grow">
        <MapView
          pickup={currentRide ? [currentRide.pickup_lat, currentRide.pickup_lng] : (incomingRequest ? [incomingRequest.pickup_lat, incomingRequest.pickup_lng] : null)}
          drop={currentRide ? [currentRide.drop_lat, currentRide.drop_lng] : (incomingRequest ? [incomingRequest.drop_lat, incomingRequest.drop_lng] : null)}
          driver={location}
          mapCenter={incomingRequest ? [incomingRequest.pickup_lat, incomingRequest.pickup_lng] : location}
          routePositions={activePath}
          centerOnDriver={!incomingRequest}
        />

        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleOnline}
              className={`flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-sm md:text-lg shadow-2xl transition-all border-2 md:border-4 ${isOnline
                  ? 'bg-green-500 text-white border-green-200'
                  : 'bg-white text-gray-400 border-gray-100'
                }`}
            >
              <Power size={isOnline ? 20 : 24} />
              {isOnline ? 'ONLINE' : 'GO ONLINE'}
            </button>
            
            {isOnline && (
              <div className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2 shadow-lg border animate-in slide-in-from-left duration-300 ${isTracking ? 'bg-blue-600 text-white border-blue-400' : 'bg-red-500 text-white border-red-300'}`}>
                <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-blue-200 animate-pulse' : 'bg-white'}`}></div>
                {isTracking ? 'LIVE GPS ACTIVE' : 'GPS SEARCHING...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel / Bottom Sheet */}
      <div className="w-full md:w-[450px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl z-20 flex flex-col p-6 md:p-8 overflow-y-auto rounded-t-[2.5rem] md:rounded-none -mt-8 md:mt-0 flex-grow md:flex-none">
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 md:hidden"></div>
        <div className="mb-10 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-gray-900 leading-tight">Driver<br />Dashboard</h2>
              <div className="flex flex-col items-center justify-center bg-yellow-400 text-black px-3 py-2 rounded-2xl shadow-lg border-2 border-yellow-500/20 active:scale-95 transition-transform">
                <div className="flex items-center gap-1 font-black text-lg">
                  <span className="text-xl">⭐</span>
                  {parseFloat(rating.avg).toFixed(1)}
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-70">
                  {rating.count} Ratings
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-gray-500 font-medium">Manage your active rides</p>
              {user?.vehicleType && (
                <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">
                  {user.vehicleType}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-right">
            <Link 
              to="/driver/wallet"
              className="group flex flex-col items-end bg-blue-50 hover:bg-blue-100 p-3 rounded-2xl transition-all border border-blue-100"
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Balance</p>
                <Wallet size={12} className="text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-black text-blue-900 leading-none">₹ {parseFloat(walletBalance).toLocaleString()}</p>
              <p className="text-[9px] font-bold text-blue-400 mt-1">Open Wallet <ChevronRight size={10} className="inline" /></p>
            </Link>
            <div className="opacity-50 border-t border-gray-100 pt-2 pr-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Total Earned</p>
              <p className="text-sm font-black text-gray-500 mt-1">₹ {parseFloat(earnings).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {!currentRide && !incomingRequest && (
          <div className="flex-grow flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-1000">
            <div className={`p-10 rounded-full transition-all duration-500 ${isOnline ? 'bg-green-50 animate-pulse' : 'bg-gray-50'}`}>
              <Navigation size={64} className={isOnline ? 'text-green-500' : 'text-gray-300'} />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">{isOnline ? 'Waiting for requests...' : 'You are offline'}</h3>
              <p className="text-gray-500 max-w-[250px]">
                {isOnline
                  ? 'Keep this window open to receive ride requests from nearby customers.'
                  : 'Go online to start receiving ride requests and earning.'}
              </p>
            </div>
          </div>
        )}

        {incomingRequest && (
          <div className="p-8 bg-black text-white rounded-[3rem] animate-in zoom-in duration-300 shadow-2xl ring-8 ring-yellow-400/20">
            <div className="flex justify-between items-start mb-8">
              <div>
                <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 inline-block">New Request</span>
                <h3 className="text-3xl font-black">₹{incomingRequest.fare}</h3>
                <p className="text-gray-400 font-medium">{incomingRequest.distance_km} km ride</p>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur flex flex-col items-center gap-1">
                {['mini', 'sedan', 'xl'].includes(incomingRequest.vehicle_type) ? (
                  <Car size={32} className="text-yellow-400" />
                ) : (
                  <Bike size={32} className="text-yellow-400" />
                )}
                <span className="text-[10px] font-black uppercase tracking-tighter text-yellow-400">{incomingRequest.vehicle_type}</span>
              </div>
            </div>

            <div className="flex gap-4 mb-8">
              <div className="flex-1 p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] text-gray-500 font-bold uppercase">Payment</p>
                <div className="flex items-center gap-2 mt-1">
                  {incomingRequest.payment_method === 'cash' ? <Wallet size={14} className="text-green-400" /> : <CreditCard size={14} className="text-blue-400" />}
                  <span className="font-bold text-sm uppercase">{incomingRequest.payment_method}</span>
                </div>
              </div>
              <div className="flex-1 p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] text-gray-500 font-bold uppercase">Vehicle</p>
                <p className="font-bold text-sm uppercase mt-1">{incomingRequest.vehicle_type}</p>
              </div>
            </div>

            <div className="space-y-6 mb-10">
              <div className="flex gap-4">
                <div className="w-1 h-12 bg-gradient-to-b from-blue-500 to-yellow-400 rounded-full"></div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pickup Coordinates</p>
                    <p className="font-bold truncate text-lg">
                      {incomingRequest.pickup_lat.toFixed(4)}, {incomingRequest.pickup_lng.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIncomingRequest(null)}
                className="flex-1 py-4 rounded-2xl bg-white/10 font-bold hover:bg-white/20 transition-all border border-white/10"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 py-4 rounded-2xl bg-yellow-400 text-black font-black text-lg hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20"
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {currentRide && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="bg-blue-600 text-white p-8 rounded-[3rem] shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black">Active Ride</h3>
                  <p className="text-blue-100 font-medium">In progress</p>
                </div>
                <div className="p-4 bg-white/20 rounded-2xl"><Navigation size={24} /></div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-black text-xl">A</div>
                <div className="flex-grow">
                  <p className="text-xs font-bold text-blue-200">Customer</p>
                  <p className="font-bold">{currentRide.rider_name || 'Valued Customer'}</p>
                </div>
                <div className="text-right px-4 border-l border-white/10">
                  <p className="text-[10px] font-bold text-blue-200 uppercase">{currentRide.vehicle_type}</p>
                  <div className="flex items-center gap-1 font-bold text-sm">
                    {currentRide.payment_method === 'cash' ? <Wallet size={12} /> : <CreditCard size={12} />}
                    {currentRide.payment_method?.toUpperCase()}
                  </div>
                  {isPaid ? (
                    <span className="mt-1 inline-block px-2 py-0.5 bg-green-500 text-[9px] font-black text-white rounded-md animate-in zoom-in">PAID ✅</span>
                  ) : currentRide.payment_method === 'razorpay' ? (
                    <span className="mt-1 inline-block px-2 py-0.5 bg-yellow-500 text-[9px] font-black text-white rounded-md animate-pulse">WAITING...</span>
                  ) : null}
                </div>
                <button className="p-3 bg-white text-blue-600 rounded-xl"><Phone size={20} /></button>
              </div>
            </div>

            <div className="space-y-4">
              {currentRide.status === 'accepted' && (
                <button
                  onClick={() => updateRideStatus('arrived')}
                  className="w-full py-5 bg-black text-white rounded-2xl font-black text-xl hover:bg-gray-800 transition-all shadow-xl flex items-center justify-center gap-3"
                >
                  <MapPin size={24} /> I have Arrived
                </button>
              )}
              {currentRide.status === 'arrived' && (
                <div className="space-y-4 animate-in slide-in-from-top duration-300">
                  <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-3 text-center tracking-widest">Enter Passenger PIN to Start</p>
                    <input
                      type="text"
                      maxLength="4"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className="w-full bg-white/10 text-white text-center text-4xl font-black py-4 rounded-2xl border-2 border-white/10 focus:outline-none focus:border-yellow-400 transition-all tracking-[1em] pl-[1em]"
                    />
                  </div>
                  <button
                    onClick={() => updateRideStatus('started', otpInput)}
                    disabled={otpInput.length !== 4}
                    className="w-full py-5 bg-yellow-400 text-black rounded-2xl font-black text-xl hover:bg-yellow-300 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                  >
                    <Clock size={24} /> Start Trip
                  </button>
                </div>
              )}
              {currentRide.status === 'started' && (
                <button
                  onClick={() => updateRideStatus('completed')}
                  className="w-full py-5 bg-green-500 text-white rounded-2xl font-black text-xl hover:bg-green-400 transition-all shadow-xl flex items-center justify-center gap-3"
                >
                  <CheckCircle size={24} /> Complete Trip
                </button>
              )}
              {currentRide.status !== 'started' && (
                <button
                  onClick={handleCancelRide}
                  className="w-full py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <XCircle size={20} /> Cancel Ride
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal removed - using separate page */}
    </div>
  );
};

export default DriverDashboard;
