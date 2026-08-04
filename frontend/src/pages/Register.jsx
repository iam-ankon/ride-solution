// Register.jsx - Updated with proper API service and mobile support
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    phone: '',
    user_type: 'individual'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      console.log('Registering user:', formData.username);
      
      const response = await api.post('/api/auth/register/', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirm_password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        user_type: formData.user_type
      });
      
      console.log('Registration response:', response.data);
      
      if (response.data.success) {
        setSuccess('Registration successful! Redirecting to login...');
        
        // Store registration info temporarily for auto-fill on login
        sessionStorage.setItem('justRegistered', 'true');
        sessionStorage.setItem('registeredUsername', formData.username);
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Registration successful! Please login with your credentials.',
              username: formData.username 
            }
          });
        }, 2000);
      } else {
        setError(response.data.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response) {
        // Server responded with error
        const data = error.response.data;
        if (typeof data === 'object') {
          // Handle field-specific errors
          const errorMessages = [];
          
          if (data.username) errorMessages.push(`Username: ${data.username.join(', ')}`);
          if (data.email) errorMessages.push(`Email: ${data.email.join(', ')}`);
          if (data.password) errorMessages.push(`Password: ${data.password.join(', ')}`);
          if (data.error) errorMessages.push(data.error);
          
          if (errorMessages.length > 0) {
            setError(errorMessages.join('. '));
          } else {
            setError('Registration failed. Please check your information and try again.');
          }
        } else {
          setError(data.error || 'Registration failed. Please try again.');
        }
      } else if (error.request) {
        // Request made but no response
        setError('Network error. Please check your connection and try again.');
      } else {
        // Something else happened
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
          Create an Account
        </h1>
        
        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* Name Fields - Grid on desktop, column on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="mb-4 sm:mb-0">
              <label className="block text-gray-700 mb-2 text-sm font-medium">First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="John"
              />
            </div>
            
            <div className="mb-4 sm:mb-0">
              <label className="block text-gray-700 mb-2 text-sm font-medium">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Doe"
              />
            </div>
          </div>
          
          {/* Username */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 text-sm font-medium">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Choose a username"
              required
            />
          </div>
          
          {/* Email */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="your@email.com"
              required
            />
          </div>
          
          {/* Phone */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 text-sm font-medium">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="+61 123 456 789"
            />
          </div>
          
          {/* User Type */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 text-sm font-medium">Account Type</label>
            <select
              name="user_type"
              value={formData.user_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="individual">Individual - Personal Use</option>
              <option value="business">Business - Company Account</option>
              <option value="dealer">Car Dealer - Multiple Vehicles</option>
            </select>
          </div>
          
          {/* Password */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 text-sm font-medium">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Minimum 6 characters"
              required
            />
          </div>
          
          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-gray-700 mb-2 text-sm font-medium">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Confirm your password"
              required
            />
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Creating Account...
              </div>
            ) : (
              'Register'
            )}
          </button>
        </form>
        
        {/* Login Link */}
        <p className="text-center text-gray-600 mt-6 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Sign in here
          </Link>
        </p>
        
        {/* Terms and Privacy */}
        <p className="text-center text-gray-400 text-xs mt-6">
          By registering, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default Register;