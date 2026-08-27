// components/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaCar, FaBars, FaTimes, FaPlus, FaList, FaBook, FaSignOutAlt,
  FaTachometerAlt, FaExclamationTriangle, FaSpinner,
  FaChevronDown, FaHeart, FaShieldAlt, FaClock, FaHeadset, FaInfoCircle
} from "react-icons/fa";
import api from "../services/api";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const updateUserState = (userData) => {
    if (userData && userData.id) {
      setUser(userData);
      setIsAdmin(userData.is_staff === true || userData.is_superuser === true);
      localStorage.setItem("user", JSON.stringify(userData));
    } else {
      setUser(null);
      setIsAdmin(false);
      localStorage.removeItem("user");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.clear();
    }
  };

  const fetchUserFromAPI = async () => {
    const token = localStorage.getItem('access_token');
    const localUser = localStorage.getItem("user");
    
    // If no token, clear user and stop
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }
    
    // If we have a local user but no token, clear it
    if (localUser && !token) {
      updateUserState(null);
      setIsLoading(false);
      return;
    }
    
    try {
      setConnectionError(false);
      const response = await api.get('/api/auth/me/');
      
      if (response.data && response.data.id) {
        updateUserState(response.data);
      } else {
        updateUserState(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      
      if (error.response?.status === 401) {
        // Token expired or invalid
        updateUserState(null);
      } else if (error.code === 'ERR_NETWORK') {
        setConnectionError(true);
        // Keep local user data on network error if we have valid token
        if (localUser && token) {
          try {
            const parsedUser = JSON.parse(localUser);
            setUser(parsedUser);
            setIsAdmin(parsedUser.is_staff === true || parsedUser.is_superuser === true);
          } catch (e) {
            updateUserState(null);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check for existing user data on mount
    const localUser = localStorage.getItem("user");
    const token = localStorage.getItem("access_token");
    
    if (localUser && token) {
      try {
        const parsedUser = JSON.parse(localUser);
        setUser(parsedUser);
        setIsAdmin(parsedUser.is_staff === true || parsedUser.is_superuser === true);
        setIsLoading(false);
        // Verify with backend in background
        fetchUserFromAPI();
      } catch (e) {
        fetchUserFromAPI();
      }
    } else {
      fetchUserFromAPI();
    }
  }, []);

  useEffect(() => {
    const handleLoginEvent = () => {
      fetchUserFromAPI();
    };
    
    const handleLogoutEvent = () => {
      updateUserState(null);
      setIsLoading(false);
    };

    window.addEventListener('user-login', handleLoginEvent);
    window.addEventListener('user-logout', handleLogoutEvent);
    
    return () => {
      window.removeEventListener('user-login', handleLoginEvent);
      window.removeEventListener('user-logout', handleLogoutEvent);
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Try to call logout API (optional)
      await api.post('/api/auth/logout/', {}, { timeout: 5000 });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      // CRITICAL: Clear all auth data
      localStorage.removeItem("user");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("redirectAfterLogin");
      sessionStorage.clear();
      
      // Clear state
      setUser(null);
      setIsAdmin(false);
      setDropdownOpen(false);
      setIsOpen(false);
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('user-logout'));
      
      // Navigate to home
      navigate("/");
      
      // Force hard reload to clear any cached state
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    }
  };

  const getUserDisplayName = () => {
    if (!user) return "Guest";
    if (user.first_name) return user.first_name;
    if (user.username) return user.username;
    return "User";
  };

  const getUserInitial = () => {
    return getUserDisplayName().charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <nav className="bg-white shadow-lg fixed w-full z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FaCar className="text-blue-600 text-2xl" />
              <span className="text-xl font-bold text-gray-800">OTOBI GO</span>
            </Link>
            <div className="w-20 h-8 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-lg fixed w-full z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2" onClick={() => setIsOpen(false)}>
            <FaCar className="text-blue-600 text-2xl" />
            <span className="text-xl font-bold text-gray-800 hidden sm:inline">OTOBI GO</span>
            <span className="text-xl font-bold text-gray-800 sm:hidden">RS</span>
          </Link>

          {connectionError && (
            <div className="absolute top-full left-0 right-0 bg-red-500 text-white text-sm py-1 px-3 text-center">
              <FaExclamationTriangle className="inline mr-2" />
              Server connection issue. Please refresh.
            </div>
          )}

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 items-center">
            <Link to="/" className="text-gray-700 hover:text-blue-600">Home</Link>
            <Link to="/cars" className="text-gray-700 hover:text-blue-600">Cars</Link>
            <Link to="/about" className="text-gray-700 hover:text-blue-600">About</Link>
            <Link to="/contact" className="text-gray-700 hover:text-blue-600">Contact</Link>

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-2 text-gray-700 hover:text-blue-600">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                    {getUserInitial()}
                  </div>
                  <span className="hidden lg:inline">{getUserDisplayName()}</span>
                  <FaChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                          {getUserInitial()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{getUserDisplayName()}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 border-b">
                        <FaTachometerAlt className="text-purple-500" size={16} /> <span>Admin Dashboard</span>
                      </Link>
                    )}
                    <Link to="/my-bookings" onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 border-b">
                      <FaBook className="text-blue-500" size={16} /> <span>My Bookings</span>
                    </Link>
                    <Link to="/my-cars" onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 border-b">
                      <FaList className="text-green-500" size={16} /> <span>My Cars</span>
                    </Link>
                    <Link to="/add-car" onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 border-b">
                      <FaPlus className="text-purple-500" size={16} /> <span>Add Car</span>
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition">
                      <FaSignOutAlt size={16} /> <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Sign In</button>
                </Link>
                <Link to="/register">
                  <button className="border-2 border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50">Register</button>
                </Link>
              </>
              
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            {user && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                {getUserInitial()}
              </div>
            )}
            <button onClick={() => setIsOpen(!isOpen)} className="p-2">
              {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div ref={mobileMenuRef} className="md:hidden py-4 border-t">
            {user ? (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-semibold">
                    {getUserInitial()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-gray-600 text-sm mb-3">Sign in to access your bookings</p>
                <div className="flex gap-3">
                  <Link to="/login" onClick={() => setIsOpen(false)} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-center">Sign In</Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="flex-1 border-2 border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-center">Register</Link>
                </div>
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <Link to="/" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                <FaCar size={18} /> <span>Home</span>
              </Link>
              <Link to="/cars" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                <FaList size={18} /> <span>Browse Cars</span>
              </Link>
              <Link to="/about" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                <FaInfoCircle size={18} /> <span>About Us</span>
              </Link>
              <Link to="/contact" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                <FaHeadset size={18} /> <span>Contact</span>
              </Link>
            </div>

            {user && (
              <>
                <div className="border-t my-3"></div>
                {isAdmin && (
                  <Link to="/admin" className="flex items-center gap-3 text-gray-700 hover:bg-purple-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                    <FaTachometerAlt size={18} /> <span>Admin Dashboard</span>
                  </Link>
                )}
                <Link to="/my-bookings" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                  <FaBook size={18} /> <span>My Bookings</span>
                </Link>
                <Link to="/my-cars" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                  <FaList size={18} /> <span>My Cars</span>
                </Link>
                <Link to="/add-car" className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 px-3 py-3 rounded-lg" onClick={() => setIsOpen(false)}>
                  <FaPlus size={18} /> <span>Add Car</span>
                </Link>
                <button onClick={() => { handleLogout(); setIsOpen(false); }} className="w-full flex items-center gap-3 text-red-600 hover:bg-red-50 px-3 py-3 rounded-lg">
                  <FaSignOutAlt size={18} /> <span>Logout</span>
                </button>
              </>
            )}

            <div className="border-t mt-4 pt-4">
              <div className="flex justify-around text-center">
                <div className="flex flex-col items-center">
                  <FaShieldAlt className="text-green-500 text-lg" />
                  <p className="text-xs text-gray-500 mt-1">Secure</p>
                </div>
                <div className="flex flex-col items-center">
                  <FaHeadset className="text-blue-500 text-lg" />
                  <p className="text-xs text-gray-500 mt-1">24/7 Support</p>
                </div>
                <div className="flex flex-col items-center">
                  <FaClock className="text-orange-500 text-lg" />
                  <p className="text-xs text-gray-500 mt-1">Flexible</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;