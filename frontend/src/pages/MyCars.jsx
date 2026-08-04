import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

// API URL constant
const API_URL = "https://ride-solution-backend-udox.onrender.com";

// Create axios instance with auth interceptor
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/auth/refresh_token/`, {
            refresh_token: refreshToken,
          });
          
          if (response.data.access_token) {
            localStorage.setItem("access_token", response.data.access_token);
            originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    
    return Promise.reject(error);
  }
);

function MyCars() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("access_token");
    
    if (userData) {
      setUser(JSON.parse(userData));
    }
    
    // Check if user is authenticated
    if (!token) {
      window.location.href = "/login";
      return;
    }
    
    fetchMyCars();
  }, []);

  const fetchMyCars = async () => {
    try {
      const response = await apiClient.get(`/api/cars/my-cars/`);
      console.log("My Cars API Response:", response.data);
      setCars(response.data);
    } catch (error) {
      console.error("Error fetching my cars:", error);
      if (error.response?.status === 401) {
        window.location.href = "/login";
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteCar = async (id) => {
    if (window.confirm("Delete this car?")) {
      try {
        await apiClient.delete(`/api/cars/${id}/`);
        setCars(cars.filter((car) => car.id !== id));
        alert("Car deleted");
      } catch (error) {
        console.error("Error deleting car:", error);
        alert("Error deleting car");
      }
    }
  };

  // Helper function to get full image URL
  const getImageUrl = (car) => {
    if (car.images && car.images.length > 0) {
      if (car.images[0].image_url) {
        return car.images[0].image_url;
      }
      if (car.images[0].image) {
        // Check if it's already a full URL
        if (car.images[0].image.startsWith('http')) {
          return car.images[0].image;
        }
        return `${API_URL}${car.images[0].image}`;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Cars</h1>
            {user && <p className="text-gray-600">Welcome, {user.username}</p>}
            <p className="text-sm text-blue-600 mt-1">
              You own {cars.length} car(s)
            </p>
          </div>
          <Link to="/add-car">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              + Add New Car
            </button>
          </Link>
        </div>

        {cars.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-600">You haven't listed any cars yet.</p>
            <Link to="/add-car">
              <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">
                List Your First Car
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => {
              const imageUrl = getImageUrl(car);
              return (
                <div
                  key={car.id}
                  className="bg-white rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={car.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500">No Image</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-bold">
                      {car.brand} {car.name}
                    </h3>
                    <p className="text-gray-500">{car.model_year}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold text-blue-600">
                        ${car.daily_price}/day
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          car.status === "available"
                            ? "bg-green-100 text-green-800"
                            : car.status === "rented"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {car.status}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Link to={`/edit-car/${car.id}`} className="flex-1">
                        <button className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 transition">
                          Edit
                        </button>
                      </Link>
                      <button
                        onClick={() => deleteCar(car.id)}
                        className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyCars;