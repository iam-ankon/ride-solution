// services/api.js - JWT version
import axios from 'axios';

const API_URL = 'https://ride-solution-backend-udox.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// Track if we're refreshing token
let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed(access_token) {
  refreshSubscribers.forEach(callback => callback(access_token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback) {
  refreshSubscribers.push(callback);
}

// Request interceptor - add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((access_token) => {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/auth/refresh_token/`, {
            refresh_token: refreshToken
          });
          
          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);
          
          isRefreshing = false;
          onTokenRefreshed(access_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.dispatchEvent(new CustomEvent('user-logout'));
          return Promise.reject(refreshError);
        }
      } else {
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('user-logout'));
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;