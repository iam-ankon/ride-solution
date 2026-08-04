// pages/Login.jsx - JWT version
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../services/api';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/';
  const carId = location.state?.carId;
  const storedRedirectUrl = localStorage.getItem('redirectAfterLogin');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/login/', {
        username: formData.username,
        password: formData.password
      });

      if (response.data && response.data.success) {
        // Store JWT tokens
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Determine redirect URL
        let redirectUrl = '/';
        if (carId) {
          redirectUrl = `/car/${carId}`;
        } else if (storedRedirectUrl) {
          redirectUrl = storedRedirectUrl;
          localStorage.removeItem('redirectAfterLogin');
        } else if (from && from !== '/login') {
          redirectUrl = from;
        }

        // Dispatch login event
        window.dispatchEvent(new CustomEvent('user-login'));
        
        // Navigate
        navigate(redirectUrl);
      } else {
        setError(response.data?.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.status === 401) {
        setError('Invalid username or password');
      } else if (error.request) {
        setError('Network error. Please check your connection.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 max-w-md w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8">
          Login to OTOBI GO
        </h1>

        {(carId || storedRedirectUrl) && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-lg text-sm">
            Please login to continue with your booking
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 text-sm font-medium">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2 text-sm font-medium">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold text-base"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Logging in...
              </div>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6 text-sm">
          Don't have an account?{' '}
          <Link
            to="/register"
            state={{ from: from, carId: carId }}
            className="text-blue-600 hover:underline font-medium"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;