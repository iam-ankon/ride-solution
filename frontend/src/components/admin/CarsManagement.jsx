// src/components/admin/CarsManagement.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaEye, FaSync, FaInfoCircle } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function CarsManagement() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { fetchCars(); }, [refreshKey]);

  const fetchCars = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-cars/`);
      console.log("Fetched cars:", response.data);
      setCars(response.data);
    } catch (error) {
      console.error("Error fetching cars:", error);
      alert("Error fetching cars: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const deleteCar = async (id) => {
    if (window.confirm("Delete this car? This will also delete all associated bookings and images.")) {
      setDeletingId(id);
      try {
        // USE THE SAME WORKING ENDPOINT AS MyCars.jsx
        // The CarViewSet has DELETE method at /api/cars/{id}/
        await apiClient.delete(`/api/cars/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Car deleted successfully");
      } catch (error) {
        console.error("Error deleting car:", error);
        alert("Error deleting car: " + (error.response?.data?.error || error.message));
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Navigate to Add Car page
  const handleAddCar = () => {
    navigate("/add-car");
  };

  // Navigate to Edit Car page
  const handleEditCar = (carId) => {
    navigate(`/edit-car/${carId}`);
  };

  // View car details (optional)
  const handleViewCar = (carId) => {
    navigate(`/car/${carId}`);
  };

  // Refresh data
  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cars Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all cars available for rent</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={refreshData}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
          >
            <FaSync /> Refresh
          </button>
          <button 
            onClick={handleAddCar}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <FaPlus /> Add New Car
          </button>
        </div>
      </div>


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Total Cars</p>
          <p className="text-2xl font-bold text-blue-600">{cars.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Available</p>
          <p className="text-2xl font-bold text-green-600">{cars.filter(c => c.status === 'available').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Rented</p>
          <p className="text-2xl font-bold text-yellow-600">{cars.filter(c => c.status === 'rented').length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Maintenance</p>
          <p className="text-2xl font-bold text-red-600">{cars.filter(c => c.status === 'maintenance').length}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Featured</p>
          <p className="text-2xl font-bold text-purple-600">{cars.filter(c => c.featured).length}</p>
        </div>
      </div>

      {/* Cars Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Image</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name/Brand</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Daily/Weekly</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Signup Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Bond</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Car Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Options</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cars.map((car) => (
              <tr key={car.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-500">#{car.id}</td>
                <td className="px-4 py-3">
                  {car.main_image ? (
                    <img 
                      src={car.main_image} 
                      alt={car.name} 
                      className="w-12 h-12 object-cover rounded-lg"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=No+Image'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{car.name}</div>
                  <div className="text-sm text-gray-500">{car.brand} {car.model_year}</div>
                </td>
                <td className="px-4 py-3">
                  <div>${car.daily_price}/day</div>
                  <div className="text-sm">${car.weekly_price}/week</div>
                </td>
                <td className="px-4 py-3">${car.signup_fee || 0}</td>
                <td className="px-4 py-3">${car.bond_amount || 0}</td>
                <td className="px-4 py-3">${car.car_value?.toLocaleString() || 0}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {car.short_term_available && <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Daily</span>}
                    {car.long_term_available && <span className="px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">Weekly</span>}
                    {car.rent_to_own_available && <span className="px-1 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">RTO</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    car.status === "available" ? "bg-green-100 text-green-800" : 
                    car.status === "rented" ? "bg-yellow-100 text-yellow-800" : 
                    "bg-red-100 text-red-800"
                  }`}>
                    {car.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleViewCar(car.id)} 
                      className="text-gray-600 hover:text-gray-800" 
                      title="View"
                    >
                      <FaEye />
                    </button>
                    <button 
                      onClick={() => handleEditCar(car.id)} 
                      className="text-blue-600 hover:text-blue-800" 
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => deleteCar(car.id)} 
                      disabled={deletingId === car.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50" 
                      title="Delete"
                    >
                      {deletingId === car.id ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cars.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-3">🚗</div>
            <p>No cars found.</p>
            <button 
              onClick={handleAddCar}
              className="mt-3 text-blue-600 hover:text-blue-700"
            >
              Click here to add your first car
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-64">
      <FaSpinner className="animate-spin text-blue-600 text-4xl" />
    </div>
  );
}

export default CarsManagement;