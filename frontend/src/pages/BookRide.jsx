import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import MapView from '../components/MapView';
import { useAuth } from '../context/AuthContext';
import { calculateFareOptions, VEHICLE_TYPES, calculateDistance } from '../utils/rideUtils';
import { MapPin, Navigation, Clock, CreditCard, Loader2, ArrowRight, X, Car, AlertTriangle, CheckCircle, Bike, Wallet, ChevronRight, Phone, LocateFixed } from 'lucide-react';

const socket = io('http://localhost:5000');

const BookRide = () => {
  const { user } = useAuth();

  // Coordinate states
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Delhi default

  // Local text states for inputs (to prevent jumpy typing)
  const [pickupInp, setPickupInp] = useState({ lat: '', lng: '', address: '' });
  const [dropInp, setDropInp] = useState({ lat: '', lng: '', address: '' });

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDrop, setIsSearchingDrop] = useState(false);

  const [route, setRoute] = useState([]);
  const [isRouting, setIsRouting] = useState(false);
  const [step, setStep] = useState('selection'); // selection, confirming, searching, tracking
  const [rideInfo, setRideInfo] = useState(null);
  const [status, setStatus] = useState('');
  const [driverLoc, setDriverLoc] = useState(null);
  const [activeRideId, setActiveRideId] = useState(null);
  const [fareOptions, setFareOptions] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, razorpay
  const [nearbyCounts, setNearbyCounts] = useState(null);
  const [isCheckingDrivers, setIsCheckingDrivers] = useState(false);
  const [driver, setDriver] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [otp, setOtp] = useState('');

  // Helper to check if location is within India's approximate bounding box
  const submitRating = async () => {
    try {
      await axios.post('http://localhost:5000/ride/rate', {
        rideId: activeRideId,
        rating: userRating
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowRatingModal(false);
      // Clean up session
      setActiveRideId(null);
      setPickup(null);
      setDrop(null);
      setPickupInp({ address: '', lat: '', lng: '' });
      setDropInp({ address: '', lat: '', lng: '' });
      setRoute([]);
      setStatus('');
      setStep('selection');
      setDriver(null);
      setRideInfo(null);
    } catch (err) {
      console.error('Rating error:', err);
      // Still close modal to unblock user
      setShowRatingModal(false);
      setStep('selection');
    }
  };

  const isInsideIndia = (lat, lng) => {
    return lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;
  };

  // Function for Geocoding (Address to Coords)
  const fetchAddressSuggestions = async (query, setSuggestions, setLoading) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: query,
          format: 'json',
          limit: 5,
          countrycodes: 'in'
        },
        headers: {
          'User-Agent': 'RydoRideApp/1.0'
        }
      });
      setSuggestions(res.data);
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function for Reverse Geocoding (Coords to Address)
  const fetchAddressFromCoords = async (lat, lng) => {
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat: lat,
          lon: lng,
          format: 'json',
          countrycodes: 'in'
        },
        headers: {
          'User-Agent': 'RydoRideApp/1.0'
        }
      });
      return res.data.display_name;
    } catch (err) {
      console.error('Reverse Geocoding error:', err);
      return '';
    }
  };

  // Default to User Location on Mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (isInsideIndia(latitude, longitude)) {
            setMapCenter([latitude, longitude]);
          }
        },
        (err) => console.log("Geolocation error/denied:", err.message),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Sync inputs from Map clicks
  useEffect(() => {
    if (pickup) {
      setPickupInp(prev => ({ ...prev, lat: pickup[0].toFixed(6), lng: pickup[1].toFixed(6) }));
      fetchAddressFromCoords(pickup[0], pickup[1]).then(addr => {
        setPickupInp(prev => ({ ...prev, address: addr }));
      });
      checkNearbyDrivers(pickup[0], pickup[1]);
    }
  }, [pickup]);

  const checkNearbyDrivers = async (lat, lng) => {
    setIsCheckingDrivers(true);
    try {
      const res = await axios.get(`http://localhost:5000/ride/nearby-drivers`, {
        params: { lat, lng },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Backend returns { counts: { mini: X, sedan: Y, ... } }
      setNearbyCounts(res.data.counts || {});
    } catch (err) {
      console.error('Error checking nearby drivers:', err);
    } finally {
      setIsCheckingDrivers(false);
    }
  };

  useEffect(() => {
    if (drop) {
      setDropInp(prev => ({ ...prev, lat: drop[0].toFixed(6), lng: drop[1].toFixed(6) }));
      fetchAddressFromCoords(drop[0], drop[1]).then(addr => {
        setDropInp(prev => ({ ...prev, address: addr }));
      });
    }
  }, [drop]);

  // Auto-select first available vehicle type
  useEffect(() => {
    if (step === 'confirming' && nearbyCounts && fareOptions.length > 0) {
      const firstAvailable = fareOptions.find(v => (nearbyCounts[v.id] || 0) > 0);
      if (firstAvailable) {
        setSelectedVehicle(firstAvailable);
      }
    }
  }, [step, nearbyCounts, fareOptions]);

  // Debounced Search Effects
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only search if address is typed and significantly different from current selection
      if (pickupInp.address && pickupInp.address.length >= 3) {
        // If we have a 'pickup' coord, we might have just updated the address from it.
        // We only want to search if the user manually changed the text.
        // For simplicity, we search if pickupSuggestions is being looked for.
        fetchAddressSuggestions(pickupInp.address, setPickupSuggestions, setIsSearchingPickup);
      } else {
        setPickupSuggestions([]);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [pickupInp.address]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dropInp.address && dropInp.address.length >= 3) {
        fetchAddressSuggestions(dropInp.address, setDropSuggestions, setIsSearchingDrop);
      } else {
        setDropSuggestions([]);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [dropInp.address]);

  // Fetch real road route from OSRM
  const fetchRoute = useCallback(async (start, end) => {
    if (!start || !end) return null;
    setIsRouting(true);
    try {
      // Create a clean axios instance to avoid sending global Auth headers to OSRM
      const osrmAxios = axios.create();
      delete osrmAxios.defaults.headers.common['Authorization'];

      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const response = await osrmAxios.get(url);
      const data = response.data;

      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        const distanceKm = (data.routes[0].distance / 1000);
        setRoute(coords);
        setIsRouting(false);
        return distanceKm;
      }
    } catch (err) {
      console.error('Routing error:', err);
    }

    // Fallback to straight line distance if API fails
    const fallbackDist = calculateDistance(start[0], start[1], end[0], end[1]);
    setRoute([]);
    setIsRouting(false);
    return fallbackDist;
  }, []);

  // Session Restoration (Runs ONCE on mount)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await axios.get('http://localhost:5000/ride/active', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data && res.data.id) {
          const ride = res.data;
          setActiveRideId(ride.id);
          setOtp(ride.otp || '');
          const p = [parseFloat(ride.pickup_lat), parseFloat(ride.pickup_lng)];
          const d = [parseFloat(ride.drop_lat), parseFloat(ride.drop_lng)];

          setPickup(p);
          setDrop(d);
          setPickupInp({ lat: p[0].toString(), lng: p[1].toString() });
          setDropInp({ lat: d[0].toString(), lng: d[1].toString() });
          setRideInfo({ distance: ride.distance_km, fare: ride.fare });
          setPaymentMethod(ride.payment_method || 'cash');

          if (ride.status === 'requested') setStep('searching');
          else if (ride.status === 'accepted') {
            setStep('tracking');
            setDriver(ride.driver_name ? {
              driver_name: ride.driver_name,
              driver_phone: ride.driver_phone,
              rating_avg: ride.rating_avg,
              rating_count: ride.rating_count
            } : null);
            if (ride.payment_method === 'razorpay' && ride.payment_status === 'pending') {
              setTimeout(() => triggerRazorpay(ride.id), 1000);
            }
          }
          else if (['arrived', 'started'].includes(ride.status)) {
            setStep('tracking');
            setDriver(ride.driver_name ? {
              driver_name: ride.driver_name,
              driver_phone: ride.driver_phone,
              rating_avg: ride.rating_avg,
              rating_count: ride.rating_count
            } : null);
          }

          const vehicles = [
            { id: 'mini', name: 'Rydo Mini', icon: '🚗' },
            { id: 'sedan', name: 'Rydo Sedan', icon: '🚙' },
            { id: 'xl', name: 'Rydo XL', icon: '🚐' },
            { id: 'bike', name: 'Rydo Moto', icon: '🏍️' }
          ];
          const matched = vehicles.find(v => v.id === ride.vehicle_type);
          if (matched) {
            setSelectedVehicle({ ...matched, totalFare: parseFloat(ride.fare) });
          }

          socket.emit('track-ride', ride.id);
          fetchRoute(p, d); 
        }
      } catch (err) {
        console.error('Session recovery failed:', err);
      }
    };

    restoreSession();
  }, []); // Run ONLY once on mount

  // Socket Reconnection Logic
  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected, checking for active ride room re-join...');
      if (activeRideId) {
        socket.emit('track-ride', activeRideId);
      }
    };

    socket.on('connect', handleConnect);
    return () => socket.off('connect', handleConnect);
  }, [activeRideId]);

  // Ride Status & Tracking Listeners
  useEffect(() => {
    socket.on('ride-status-changed', (data) => {
      console.log('Status change received:', data.status);
      setStatus(data.status);

      if (data.status === 'accepted') {
        setStep('tracking');
        if (data.driver) setDriver(data.driver);
        if (paymentMethod === 'razorpay') {
          setTimeout(() => triggerRazorpay(data.rideId), 500);
        }
      } else if (['arrived', 'started'].includes(data.status)) {
        setStep('tracking');
      }

      if (data.status === 'completed') {
        setShowRatingModal(true);
      }
    });

    socket.on('live-ride-tracking', (data) => {
      setDriverLoc([data.lat, data.lng]);
    });

    socket.on('ride-cancelled-by-driver', () => {
      alert('The driver has cancelled the trip.');
      setShowRatingModal(true); // Allow rating even if cancelled by driver
    });

    return () => {
      socket.off('ride-status-changed');
      socket.off('live-ride-tracking');
      socket.off('ride-cancelled-by-driver');
    };
  }, [paymentMethod]); // Re-bind status listener if payment method changes

  const handleMapClick = (e) => {
    const coords = [e.latlng.lat, e.latlng.lng];
    if (!isInsideIndia(coords[0], coords[1])) {
      alert("📍 Service is currently available in India only.");
      return;
    }
    if (!pickup) setPickup(coords);
    else if (!drop) setDrop(coords);
  };

  const handleManualEntry = (val, field, type) => {
    if (type === 'pickup') {
      setPickupInp(prev => ({ ...prev, [field]: val }));
      if (field === 'address' && !val) {
        setPickup(null);
        setPickupSuggestions([]);
      }
      if (field !== 'address') {
        const newVal = val.replace(/[^0-9.-]/g, '');
        const upd = { ...pickupInp, [field]: newVal };
        if (upd.lat && upd.lng) {
          const lat = parseFloat(upd.lat);
          const lng = parseFloat(upd.lng);
          if (!isNaN(lat) && !isNaN(lng)) setPickup([lat, lng]);
        }
      }
    } else {
      setDropInp(prev => ({ ...prev, [field]: val }));
      if (field === 'address' && !val) {
        setDrop(null);
        setDropSuggestions([]);
      }
      if (field !== 'address') {
        const newVal = val.replace(/[^0-9.-]/g, '');
        const upd = { ...dropInp, [field]: newVal };
        if (upd.lat && upd.lng) {
          const lat = parseFloat(upd.lat);
          const lng = parseFloat(upd.lng);
          if (!isNaN(lat) && !isNaN(lng)) setDrop([lat, lng]);
        }
      }
    }
  };

  const handleSuggestionSelect = (suggestion, type) => {
    const coords = [parseFloat(suggestion.lat), parseFloat(suggestion.lon)];
    if (type === 'pickup') {
      setPickup(coords);
      setPickupInp({ lat: coords[0].toString(), lng: coords[1].toString(), address: suggestion.display_name });
      setPickupSuggestions([]);
    } else {
      setDrop(coords);
      setDropInp({ lat: coords[0].toString(), lng: coords[1].toString(), address: suggestion.display_name });
      setDropSuggestions([]);
    }
  };

  const clearLoc = (type) => {
    if (type === 'pickup') {
      setPickup(null);
      setPickupInp({ lat: '', lng: '', address: '' });
      setPickupSuggestions([]);
    } else {
      setDrop(null);
      setDropInp({ lat: '', lng: '', address: '' });
      setDropSuggestions([]);
    }
    setRoute([]);
    setStep('selection');
  };

  const handleUseCurrentLocation = () => {
    if ("geolocation" in navigator) {
      setIsSearchingPickup(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const coords = [latitude, longitude];
          setPickup(coords);
          setMapCenter(coords);
          
          // The useEffect for [pickup] will handle address fetching, 
          // but we can also set the lat/lng inputs immediately
          setPickupInp(prev => ({ 
            ...prev, 
            lat: latitude.toFixed(6), 
            lng: longitude.toFixed(6) 
          }));
          
          setIsSearchingPickup(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Unable to fetch location. Please check your browser permissions.");
          setIsSearchingPickup(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleConfirmRide = async () => {
    if (!pickup || !drop) return;
    const dist = await fetchRoute(pickup, drop);
    const options = calculateFareOptions(dist || 0);
    setFareOptions(options);
    setSelectedVehicle(options[0]);
    setRideInfo({ distance: dist ? dist.toFixed(2) : '0' });
    setStep('confirming');
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const triggerRazorpay = async (rideId) => {
    const loaded = await loadRazorpay();
    if (!loaded) {
      alert('Razorpay SDK failed to load. Are you online?');
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_basic_key',
      amount: selectedVehicle.totalFare * 100,
      currency: 'INR',
      name: 'Rydo Rides',
      description: `Payment for ${selectedVehicle.name}`,
      handler: async (response) => {
        console.log('Payment Success:', response);
        try {
          await axios.post('http://localhost:5000/ride/confirm-payment', {
            rideId: rideId || activeRideId,
            paymentId: response.razorpay_payment_id
          });
          // Notify driver immediately via socket
          socket.emit('payment-confirmed', { rideId: rideId || activeRideId });
        } catch (err) {
          console.error('Failed to confirm payment on backend');
        }
      },
      prefill: {
        name: user.name,
        email: user.email,
        contact: user.phone
      },
      theme: { color: '#000000' }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const requestRide = async () => {
    // Proceed directly to searching, payment happens after acceptance
    finalizeRideRequest(null);
  };

  const finalizeRideRequest = async (paymentId) => {
    setStep('searching');
    try {
      const res = await axios.post('http://localhost:5000/ride/create', {
        pickup_lat: pickup[0],
        pickup_lng: pickup[1],
        drop_lat: drop[0],
        drop_lng: drop[1],
        pickup_address: pickupInp.address,
        drop_address: dropInp.address,
        distance_km: rideInfo.distance,
        fare: selectedVehicle.totalFare,
        vehicleType: selectedVehicle.id,
        paymentMethod: paymentMethod
      });
      const ride = res.data;
      setActiveRideId(ride.id);
      setOtp(ride.otp || '');
      setStatus('requested');
      socket.emit('track-ride', ride.id);
    } catch (err) {
      alert('Error requesting ride');
      setStep('confirming');
    }
  };

  // Heuristic based ETA calculation
  const calculateETA = (distanceKm) => {
    if (!distanceKm) return null;
    // Assume 20km/h avg city speed -> 3 mins per km
    const mins = Math.max(1, Math.round(distanceKm * 3));
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
  };

  const getLiveETA = () => {
    if (!driverLoc) return status === 'accepted' ? 'Connecting...' : 'Arrived';
    
    // Distance from driver to pickup
    if (status === 'accepted') {
      const dist = calculateDistance(driverLoc[0], driverLoc[1], pickup[0], pickup[1]);
      const eta = Math.round(dist * 3);
      return eta <= 0.5 ? 'Arrived' : `${eta} min`;
    }
    
    // Distance from driver to drop
    if (status === 'started') {
      const dist = calculateDistance(driverLoc[0], driverLoc[1], drop[0], drop[1]);
      const eta = Math.round(dist * 3);
      return eta <= 0.5 ? 'Reached' : `${eta} min`;
    }
    
    return status === 'arrived' ? 'Arrived' : 'Calculating...';
  };

  const handleCancelRide = async () => {
    if (!activeRideId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/ride/cancel', {
        rideId: activeRideId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveRideId(null);
      setPickup(null);
      setDrop(null);
      setRoute([]);
      setStatus('');
      setStep('selection');
    } catch (err) {
      alert('Failed to cancel ride');
    }
  };

  const handleRequestRide = async () => {
    if (!activeRideId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/ride/cancel', {
        rideId: activeRideId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActiveRideId(null);
      setPickup(null);
      setDrop(null);
      setRoute([]);
      setStatus('');
      setStep('selection');
    } catch (err) {
      alert('Failed to cancel ride');
    }
  };

  return (
    <div className="relative h-[calc(100vh-64px)] overflow-hidden flex flex-col md:flex-row shadow-inner">
      {/* Map Section */}
      <div className="relative h-[40vh] md:h-full md:flex-grow">
        <MapView pickup={pickup} drop={drop} driver={driverLoc} routePositions={route} onMapClick={handleMapClick} mapCenter={mapCenter} />
        {step === 'selection' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur px-4 py-2 md:px-6 md:py-3 rounded-full shadow-lg border border-gray-200 w-[90%] md:w-auto text-center">
            <p className="text-xs md:text-sm font-bold text-gray-900">{!pickup ? '📍 Click map for pickup' : !drop ? '🏁 Click map for drop' : '✨ Review your selection'}</p>
          </div>
        )}
      </div>

      {/* Side Control Panel / Bottom Sheet */}
      <div className="w-full md:w-[450px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl z-20 flex flex-col p-5 md:p-8 overflow-y-auto rounded-t-[2.5rem] md:rounded-none -mt-8 md:mt-0 flex-grow md:flex-none">
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 md:hidden"></div>
        {step === 'selection' && (
          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-3xl font-bold text-gray-900">Where to?</h2>
                <div className="bg-yellow-100 text-yellow-800 text-[10px] font-black px-3 py-1 rounded-full border border-yellow-200 shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                  INDIA ONLY
                </div>
              </div>
              <p className="text-gray-500">Enter coordinates or click on the map</p>
            </div>

            <div className="space-y-6">
              {/* Pickup Group */}
              <div className="relative p-4 md:p-5 bg-gray-50 rounded-2xl border border-gray-100 group">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pickup Location</span>
                  </div>
                  {pickup && <button onClick={() => clearLoc('pickup')} className="p-1 px-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500 text-[10px] font-bold">CLEAR</button>}
                </div>
                
                <div className="relative">
                  <input 
                    value={pickupInp.address} 
                    onChange={(e) => handleManualEntry(e.target.value, 'address', 'pickup')} 
                    placeholder="Search pickup address..." 
                    className="w-full bg-white px-4 py-3 rounded-xl text-sm font-medium border border-transparent focus:border-blue-500 outline-none transition-all shadow-sm pr-20" 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isSearchingPickup ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                      <button 
                        onClick={handleUseCurrentLocation}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-500 group/locate"
                        title="Use Current Location"
                      >
                        <LocateFixed size={18} className="group-hover/locate:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                  
                  {/* Pickup Suggestions Dropdown */}
                  {pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {pickupSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionSelect(s, 'pickup')}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <p className="font-bold text-sm text-gray-900 truncate">{s.name || s.display_name.split(',')[0]}</p>
                          <p className="text-xs text-gray-400 truncate">{s.display_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hidden advanced coordinates */}
                <div className="mt-4 grid grid-cols-2 gap-3 opacity-40 hover:opacity-100 transition-opacity">
                  <div className="space-y-1">
                    <label className="text-[8px] text-gray-400 font-bold ml-1 uppercase">Lat</label>
                    <input value={pickupInp.lat} onChange={(e) => handleManualEntry(e.target.value, 'lat', 'pickup')} placeholder="28.61" className="w-full bg-transparent px-2 py-1 rounded-lg text-[10px] border border-gray-200" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-gray-400 font-bold ml-1 uppercase">Lng</label>
                    <input value={pickupInp.lng} onChange={(e) => handleManualEntry(e.target.value, 'lng', 'pickup')} placeholder="77.20" className="w-full bg-transparent px-2 py-1 rounded-lg text-[10px] border border-gray-200" />
                  </div>
                </div>
              </div>

              {/* Drop-off Group */}
              <div className="relative p-4 md:p-5 bg-gray-50 rounded-2xl border border-gray-100 group">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Drop-off Location</span>
                  </div>
                  {drop && <button onClick={() => clearLoc('drop')} className="p-1 px-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500 text-[10px] font-bold">CLEAR</button>}
                </div>

                <div className="relative">
                  <input 
                    value={dropInp.address} 
                    onChange={(e) => handleManualEntry(e.target.value, 'address', 'drop')} 
                    placeholder="Search drop destination..." 
                    className="w-full bg-white px-4 py-3 rounded-xl text-sm font-medium border border-transparent focus:border-black outline-none transition-all shadow-sm pr-10" 
                  />
                  {isSearchingDrop && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black animate-spin" />}

                  {/* Drop Suggestions Dropdown */}
                  {dropSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {dropSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionSelect(s, 'drop')}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <p className="font-bold text-sm text-gray-900 truncate">{s.name || s.display_name.split(',')[0]}</p>
                          <p className="text-xs text-gray-400 truncate">{s.display_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hidden advanced coordinates */}
                <div className="mt-4 grid grid-cols-2 gap-3 opacity-40 hover:opacity-100 transition-opacity">
                  <div className="space-y-1">
                    <label className="text-[8px] text-gray-400 font-bold ml-1 uppercase">Lat</label>
                    <input value={dropInp.lat} onChange={(e) => handleManualEntry(e.target.value, 'lat', 'drop')} placeholder="28.53" className="w-full bg-transparent px-2 py-1 rounded-lg text-[10px] border border-gray-200" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-gray-400 font-bold ml-1 uppercase">Lng</label>
                    <input value={dropInp.lng} onChange={(e) => handleManualEntry(e.target.value, 'lng', 'drop')} placeholder="77.39" className="w-full bg-transparent px-2 py-1 rounded-lg text-[10px] border border-gray-200" />
                  </div>
                </div>
              </div>
            </div>

            <button 
              disabled={!pickup || !drop || isRouting || (!nearbyCounts || Object.values(nearbyCounts).reduce((a, b) => a + b, 0) === 0)}
              onClick={handleConfirmRide} 
              className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 ${
                !pickup || !drop || isRouting || (!nearbyCounts || Object.values(nearbyCounts).reduce((a, b) => a + b, 0) === 0)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-black text-white hover:bg-gray-900 active:scale-95'
              }`}
            >
              {isRouting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              Confirm Pickup
            </button>
            
            {pickup && nearbyCounts !== null && (
              <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 ${Object.values(nearbyCounts).reduce((a, b) => a + b, 0) > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {isCheckingDrivers ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : Object.values(nearbyCounts).reduce((a, b) => a + b, 0) > 0 ? (
                  <CheckCircle size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span className="text-sm font-bold">
                  {isCheckingDrivers ? 'Checking driver availability...' : Object.values(nearbyCounts).reduce((a, b) => a + b, 0) > 0 ? `${Object.values(nearbyCounts).reduce((a, b) => a + b, 0)} drivers nearby in 7km radius` : 'No drivers available within 7km of your pickup'}
                </span>
              </div>
            )}
          </div>
        )}

        {step === 'confirming' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button onClick={() => setStep('selection')} className="flex items-center gap-2 text-gray-500 hover:text-black font-medium transition-colors"><ArrowRight className="rotate-180" /> Change Route</button>

            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-black">Choose a ride</h2>
              <div className="text-xs text-gray-400 font-bold bg-gray-100 px-3 py-1 rounded-full">{rideInfo.distance} km trip</div>
            </div>

            {/* Vehicle Selection List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {fareOptions.map((v) => {
                const isAvailable = (nearbyCounts?.[v.id] || 0) > 0;
                return (
                  <div
                    key={v.id}
                    onClick={() => isAvailable && setSelectedVehicle(v)}
                    className={`p-4 rounded-[1.5rem] border-2 transition-all flex items-center justify-between ${
                      !isAvailable ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50' :
                      selectedVehicle?.id === v.id
                        ? 'border-black bg-gray-50 shadow-md translate-x-1 cursor-pointer'
                        : 'border-transparent bg-white hover:border-gray-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl ${!isAvailable ? 'bg-gray-200 text-gray-400' : selectedVehicle?.id === v.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'} transition-colors`}>
                        {['mini', 'sedan', 'xl'].includes(v.id) ? <Car size={28} /> : <Bike size={28} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{v.name}</h3>
                          {!isAvailable && <span className="text-[8px] font-black bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">Unavailable</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                          {isAvailable ? (
                            <>
                              <Clock size={12} className="text-blue-500" />
                              <span>{nearbyCounts[v.id]} nearby • 5 mins away</span>
                            </>
                          ) : (
                            <span>No drivers in 7km</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black">₹{v.totalFare}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Fastest</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Method Selector */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Payment Method</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${paymentMethod === 'cash' ? 'border-black bg-black text-white' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                    }`}
                >
                  <Wallet size={18} /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${paymentMethod === 'razorpay' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                    }`}
                >
                  <CreditCard size={18} /> UPI/Card
                </button>
              </div>
            </div>

            <button
              onClick={requestRide}
              className="w-full bg-black text-white py-5 rounded-[2rem] font-bold text-xl hover:bg-gray-800 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 mt-4"
            >
              Confirm {selectedVehicle?.name}
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {step === 'searching' && (
          <div className="flex-grow flex flex-col items-center justify-center space-y-8 animate-in fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-black rounded-full animate-ping opacity-20"></div>
              <div className="relative bg-black p-8 rounded-full text-white"><Loader2 className="w-12 h-12 animate-spin" /></div>
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Finding a driver...</h2>
              <p className="text-gray-500 font-medium">Sit tight, we're connecting you soon.</p>
            </div>
            <button
              onClick={handleCancelRide}
              className="px-8 py-3 rounded-full bg-red-100 text-red-600 font-bold hover:bg-red-200 transition-all border border-red-200"
            >
              Cancel Request
            </button>
          </div>
        )}

        {step === 'tracking' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="bg-black text-white p-7 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              {/* Pulse background effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Live Tracking</span>
                  </div>
                  <h3 className="text-2xl font-black italic">
                    {status === 'accepted' ? (getLiveETA() === 'Arrived' ? 'Driver is here!' : `Arriving in ${getLiveETA()}`) : 
                     status === 'arrived' ? 'Driver has arrived!' :
                     status === 'started' ? (getLiveETA() === 'Reached' ? 'Almost there' : `Reaching in ${getLiveETA()}`) : 'Tracking ride'}
                  </h3>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur">
                  <Navigation size={20} className="text-blue-400" />
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                {/* Driver Info Card */}
                <div className="bg-white/10 p-5 rounded-3xl border border-white/10 relative overflow-hidden group">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                      <Car size={32} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-lg tracking-tight">{driver?.driver_name || 'Your Driver'}</h4>
                        <div className="flex items-center gap-1 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                          ⭐ {parseFloat(driver?.rating_avg || 5.0).toFixed(1)} ({driver?.rating_count || 0})
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{selectedVehicle?.name}</p>
                    </div>
                    <a 
                      href={`tel:${driver?.driver_phone}`}
                      className="ml-auto w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all active:scale-90"
                    >
                      <Phone size={20} className="text-white" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 group hover:bg-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center font-black text-xl text-blue-400">
                    {selectedVehicle?.id?.[0]?.toUpperCase() || 'R'}
                  </div>
                  <div className="flex-grow">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Your Ride Details</p>
                    <p className="font-bold text-sm tracking-wide capitalize">PIN: {otp || '----'} • ₹{selectedVehicle?.totalFare || rideInfo?.fare}</p>
                    <p className="text-xs text-gray-500">{rideInfo?.distance} km trip</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all border border-white/10 flex items-center justify-center gap-2">
                    <Phone size={18} /> Call
                  </button>
                  {status !== 'started' && (
                    <button onClick={handleCancelRide} className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-bold transition-all border border-red-500/20 flex items-center justify-center gap-2">
                      <X size={18} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 italic text-center">
              <p className="text-sm text-gray-500 font-medium">For your safety, please share your ride details with family.</p>
            </div>
          </div>
        )}

        {step === 'completed' && (
          <div className="flex-grow flex flex-col items-center justify-center space-y-8 animate-in zoom-in">
            <div className="bg-green-100 p-8 rounded-full">
              <CheckCircle className="w-20 h-20 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black text-gray-900">Ride Completed!</h2>
              <p className="text-gray-500 font-medium text-lg">Hope you enjoyed your Rydo trip</p>
            </div>

            <div className="w-full bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-gray-500 font-bold">Total Fare</span>
                <span className="text-2xl font-black text-gray-900">₹{rideInfo?.fare}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-bold">Distance</span>
                <span className="text-gray-900 font-black">{rideInfo?.distance} km</span>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveRideId(null);
                setPickup(null);
                setDrop(null);
                setRoute([]);
                setStatus('');
                setStep('selection');
              }}
              className="w-full bg-black text-white py-5 rounded-2xl font-bold text-xl hover:bg-gray-800 transition-all shadow-xl"
            >
              Done
            </button>
          </div>
        )}
      </div>
      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="w-20 h-20 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-yellow-500" size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2">Ride Completed!</h2>
              <p className="text-gray-500 font-medium mb-8">How was your trip with {driver?.driver_name || 'the driver'}?</p>
              
              <div className="flex justify-center gap-2 mb-10">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setUserRating(star)}
                    className={`transition-all duration-300 ${userRating >= star ? 'text-yellow-400 scale-110' : 'text-gray-200'}`}
                  >
                    <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
              </div>

              <button
                onClick={submitRating}
                className="w-full py-5 bg-black text-white rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/20"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookRide;
