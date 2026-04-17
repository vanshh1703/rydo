import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import BookRide from './pages/BookRide';
import DriverDashboard from './pages/DriverDashboard';
import DriverWallet from './pages/DriverWallet';
import RideHistory from './pages/RideHistory';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-gray-500 animate-pulse">Checking authentication...</p>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;

  return children;
};

const HomeRouter = () => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-gray-500 animate-pulse">Checking authentication...</p>
    </div>
  );

  if (!user) return <Landing />;
  
  if (user.role === 'driver') return <Navigate to="/driver" />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" />;
  
  return <Landing />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-white font-sans selection:bg-yellow-200">
          <Navbar />
          <main>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomeRouter />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* Rider Routes */}
              <Route 
                path="/book" 
                element={
                  <ProtectedRoute allowedRoles={['user']}>
                    <BookRide />
                  </ProtectedRoute>
                } 
              />
              
              {/* Driver Routes */}
              <Route 
                path="/driver" 
                element={
                  <ProtectedRoute allowedRoles={['driver']}>
                    <DriverDashboard />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/driver/wallet" 
                element={
                  <ProtectedRoute allowedRoles={['driver']}>
                    <DriverWallet />
                  </ProtectedRoute>
                } 
              />
              
              {/* Shared Routes */}
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute>
                    <RideHistory />
                  </ProtectedRoute>
                } 
              />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route 
                path="/admin/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
