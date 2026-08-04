// App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Cars from './pages/Cars';
import About from './pages/About';
import Contact from './pages/Contact';
import CarDetails from './pages/CarDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import AddCar from './pages/AddCar';
import MyCars from './pages/MyCars';
import EditCar from './pages/EditCar';
import MyBookings from './components/MyBookings';
import PaymentSuccess from './components/PaymentSuccess';
import PaymentHistory from './components/PaymentHistory';
import AdminDashboard from './components/admin/AdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from "./components/ScrollToTop";
import api from './services/api';

function ProtectedRoute({ children, requireAdmin = false }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        if (isMounted) {
          setIsAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      try {
        const user = JSON.parse(userStr);
        
        // Quick check - if we have user data, assume authenticated initially
        if (isMounted) {
          setIsAuthenticated(true);
          setIsAdmin(user.is_staff || user.is_superuser);
          setLoading(false);
        }
        
        // Verify with backend in background
        const response = await api.get('/api/auth/me/', { withCredentials: true, timeout: 5000 });
        
        if (isMounted) {
          if (response.data && response.data.id) {
            setIsAuthenticated(true);
            setIsAdmin(response.data.is_staff || response.data.is_superuser);
          } else {
            setIsAuthenticated(false);
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        if (isMounted) {
          // Keep authenticated based on localStorage if backend fails
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            setIsAuthenticated(true);
            setIsAdmin(user.is_staff || user.is_superuser);
          } else {
            setIsAuthenticated(false);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkAuth();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    localStorage.setItem('redirectAfterLogin', window.location.pathname);
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function SessionHealthChecker() {
  useEffect(() => {
    let intervalId = null;

    const verifySession = async () => {
      const user = localStorage.getItem('user');
      if (!user) return;

      try {
        await api.get('/api/auth/me/', { withCredentials: true, timeout: 5000 });
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem('user');
          window.dispatchEvent(new CustomEvent('user-logout'));
        }
      }
    };

    intervalId = setInterval(verifySession, 5 * 60 * 1000);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  return null;
}

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col">
      <SessionHealthChecker />
      <Navbar />
      <main className="flex-grow pt-16">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/car/:id" element={<CarDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/add-car" element={<ProtectedRoute><AddCar /></ProtectedRoute>} />
          <Route path="/my-cars" element={<ProtectedRoute><MyCars /></ProtectedRoute>} />
          <Route path="/edit-car/:id" element={<ProtectedRoute><EditCar /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/payment-history/:id" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
          <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;