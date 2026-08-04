// src/components/admin/VehiclesManagement.jsx
import React, { useState, useEffect } from "react";
import {
  FaPlus, FaEdit, FaTrash, FaSpinner, FaCar, FaSync, FaLink,
  FaUnlink, FaInfoCircle, FaCheckCircle, FaExclamationTriangle,
  FaDatabase, FaClock
} from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function VehiclesManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [filter, setFilter] = useState("all");
  const [formData, setFormData] = useState({
    plate_number: "", manufacturer: "", model: "", year: "", colour: "",
    vin_number: "", engine_number: "", registration_date: "", registration_expiry: "",
    status: "active", seller: "", purchase_price: "", purchase_date: ""
  });

  useEffect(() => { fetchVehicles(); }, [refreshKey]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-vehicles-with-cars/`);
      setVehicles(response.data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncCarsToVehicles = async () => {
    if (!window.confirm("This will sync ALL cars to the vehicle model. This may take a few moments. Continue?")) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await apiClient.post(`/api/admin-dashboard/sync-cars-to-vehicles/`);
      console.log("Sync response:", response.data);

      setSyncResult({
        success: response.data.success,
        created: response.data.created,
        updated: response.data.updated,
        total: response.data.total,
        message: response.data.message,
        errors: response.data.errors || []
      });

      alert(response.data.message);
      setRefreshKey(prev => prev + 1);

      // Clear sync result after 5 seconds
      setTimeout(() => {
        setSyncResult(null);
      }, 5000);
    } catch (error) {
      console.error("Error syncing:", error);
      setSyncResult({
        success: false,
        message: error.response?.data?.error || error.message || "Error syncing cars to vehicles",
        errors: []
      });
      alert("Error syncing cars to vehicles");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        year: parseInt(formData.year) || null,
      };

      if (editingVehicle) {
        await apiClient.put(`/api/admin-dashboard/vehicle/${editingVehicle.id}/`, dataToSend);
        alert("Vehicle updated successfully");
      } else {
        await apiClient.post(`/api/admin-dashboard/vehicles/`, dataToSend);
        alert("Vehicle created successfully");
      }
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving vehicle:", error);
      alert("Error saving vehicle: " + (error.response?.data?.error || error.message));
    }
  };

  const deleteVehicle = async (id) => {
    const vehicle = vehicles.find(v => v.id === id);
    if (vehicle?.is_from_car) {
      if (!window.confirm("This vehicle is auto-created from a car. Deleting it won't delete the car. Continue?")) {
        return;
      }
    } else {
      if (!window.confirm("Delete this vehicle? This will also delete all associated records.")) {
        return;
      }
    }

    try {
      await apiClient.delete(`/api/admin-dashboard/vehicle/${id}/`);
      setRefreshKey(prev => prev + 1);
      alert("Vehicle deleted successfully");
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      alert("Error deleting vehicle");
    }
  };

  const resetForm = () => {
    setFormData({
      plate_number: "", manufacturer: "", model: "", year: "", colour: "",
      vin_number: "", engine_number: "", registration_date: "", registration_expiry: "",
      status: "active", seller: "", purchase_price: "", purchase_date: ""
    });
    setEditingVehicle(null);
  };

  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      plate_number: vehicle.plate_number || "",
      manufacturer: vehicle.manufacturer || "",
      model: vehicle.model || "",
      year: vehicle.year || "",
      colour: vehicle.colour || "",
      vin_number: vehicle.vin_number || "",
      engine_number: vehicle.engine_number || "",
      registration_date: vehicle.registration_date || "",
      registration_expiry: vehicle.registration_expiry || "",
      status: vehicle.status || "active",
      seller: vehicle.seller || "",
      purchase_price: vehicle.purchase_price || "",
      purchase_date: vehicle.purchase_date || "",
    });
    setShowModal(true);
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    if (filter === "auto") return vehicle.is_from_car === true;
    if (filter === "manual") return vehicle.is_from_car !== true;
    return true;
  });

  // Calculate stats
  const totalVehicles = vehicles.length;
  const autoVehicles = vehicles.filter(v => v.is_from_car).length;
  const manualVehicles = totalVehicles - autoVehicles;
  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const expiringVehicles = vehicles.filter(v => {
    if (!v.registration_expiry) return false;
    const daysLeft = (new Date(v.registration_expiry) - new Date()) / (1000 * 60 * 60 * 24);
    return daysLeft <= 30 && daysLeft > 0;
  }).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fleet Vehicles Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage all fleet vehicles (auto-synced from Cars + manual entries)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncCarsToVehicles}
            disabled={syncing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
          >
            {syncing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            {syncing ? "Syncing..." : "Sync Cars to Vehicles"}
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <FaPlus /> Add Manual Vehicle
          </button>
        </div>
      </div>

      {/* Sync Result Notification */}
      {syncResult && (
        <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${syncResult.success ? 'bg-green-50 border border-green-400' : 'bg-red-50 border border-red-400'}`}>
          <div className="flex items-center gap-3">
            {syncResult.success ? (
              <FaCheckCircle className="text-green-500 text-xl" />
            ) : (
              <FaExclamationTriangle className="text-red-500 text-xl" />
            )}
            <div>
              <p className={syncResult.success ? "text-green-700" : "text-red-700"}>
                {syncResult.message}
              </p>
              {syncResult.created !== undefined && (
                <p className="text-sm text-gray-600">
                  Created: {syncResult.created} | Updated: {syncResult.updated} | Total: {syncResult.total}
                </p>
              )}
              {syncResult.errors && syncResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer">View errors ({syncResult.errors.length})</summary>
                  <ul className="mt-1 text-xs text-red-500 list-disc list-inside">
                    {syncResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {syncResult.errors.length > 5 && (
                      <li>... and {syncResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          </div>
          <button
            onClick={() => setSyncResult(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm border border-blue-200">
        <FaInfoCircle className="inline mr-2 text-blue-500" />
        <span className="text-blue-700">
          <strong>Auto-Sync Feature:</strong> Cars added in "Cars Management" are automatically synced to this Vehicle table.
          Use the <strong>"Sync Cars to Vehicles"</strong> button to sync existing cars.
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <FaCar className="text-blue-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Vehicles</p>
          <p className="text-2xl font-bold text-blue-600">{totalVehicles}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <FaCheckCircle className="text-green-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeVehicles}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <FaLink className="text-purple-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Auto-Synced</p>
          <p className="text-2xl font-bold text-purple-600">{autoVehicles}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <FaUnlink className="text-gray-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Manual Entries</p>
          <p className="text-2xl font-bold text-gray-600">{manualVehicles}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <FaExclamationTriangle className="text-yellow-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Rego Expiring</p>
          <p className="text-2xl font-bold text-yellow-600">{expiringVehicles}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <FaDatabase className="text-indigo-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">From Cars</p>
          <p className="text-2xl font-bold text-indigo-600">{autoVehicles}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          All Vehicles ({totalVehicles})
        </button>
        <button
          onClick={() => setFilter("auto")}
          className={`px-4 py-2 rounded-lg ${filter === "auto" ? "bg-purple-600 text-white" : "bg-gray-200"}`}
        >
          Auto-Synced ({autoVehicles})
        </button>
        <button
          onClick={() => setFilter("manual")}
          className={`px-4 py-2 rounded-lg ${filter === "manual" ? "bg-gray-600 text-white" : "bg-gray-200"}`}
        >
          Manual Entries ({manualVehicles})
        </button>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1300px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Plate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Manufacturer/Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Year/Colour</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">VIN/Engine</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Reg Expiry</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Associated Car</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredVehicles.map((vehicle) => {
              const isExpiring = vehicle.registration_expiry &&
                new Date(vehicle.registration_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              const isAutoCreated = vehicle.is_from_car;

              return (
                <tr key={vehicle.id} className={`hover:bg-gray-50 ${isAutoCreated ? 'bg-purple-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    {isAutoCreated ? (
                      <span className="inline-flex items-center gap-1 text-purple-600" title="Auto-created from Car model">
                        <FaLink className="text-xs" />
                        <span className="text-xs">Auto</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400" title="Manually added">
                        <FaUnlink className="text-xs" />
                        <span className="text-xs">Manual</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium">{vehicle.plate_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{vehicle.manufacturer || "-"}</div>
                    <div className="text-sm text-gray-500">{vehicle.model || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{vehicle.year || "-"}</div>
                    <div className="text-sm text-gray-500">{vehicle.colour || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{vehicle.vin_number || "-"}</div>
                    <div className="font-mono text-xs text-gray-500">{vehicle.engine_number || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={isExpiring ? "text-red-600 font-semibold" : ""}>
                      {vehicle.registration_expiry ? new Date(vehicle.registration_expiry).toLocaleDateString() : "-"}
                    </span>
                    {isExpiring && (
                      <div className="text-xs text-red-500">Expiring soon!</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${vehicle.status === "active" ? "bg-green-100 text-green-800" :
                      vehicle.status === "maintenance" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {vehicle.associated_car ? (
                      <div className="text-sm">
                        <span className="font-medium">{vehicle.associated_car.name}</span>
                        <div className="text-xs text-gray-500">
                          {vehicle.associated_car.brand} | ${vehicle.associated_car.daily_price}/day
                        </div>
                        <div className="text-xs text-purple-600">
                          Car ID: {vehicle.associated_car.id}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit Vehicle"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => deleteVehicle(vehicle.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Vehicle"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredVehicles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FaCar className="text-5xl mx-auto mb-3 text-gray-300" />
            <p>No vehicles found.</p>
            <button
              onClick={syncCarsToVehicles}
              className="mt-3 text-green-600 hover:text-green-700 flex items-center gap-2 mx-auto"
            >
              <FaSync /> Click here to sync cars to vehicles
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingVehicle ? "Edit Vehicle" : "Add Manual Vehicle"}
              {editingVehicle?.is_from_car && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                  Auto-synced from Car
                </span>
              )}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Plate Number *" value={formData.plate_number}
                onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Manufacturer" value={formData.manufacturer}
                  onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="Model" value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="number" placeholder="Year" value={formData.year}
                  onChange={e => setFormData({ ...formData, year: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="Colour" value={formData.colour}
                  onChange={e => setFormData({ ...formData, colour: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="VIN Number" value={formData.vin_number}
                  onChange={e => setFormData({ ...formData, vin_number: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="Engine Number" value={formData.engine_number}
                  onChange={e => setFormData({ ...formData, engine_number: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" placeholder="Registration Date" value={formData.registration_date}
                  onChange={e => setFormData({ ...formData, registration_date: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" placeholder="Registration Expiry" value={formData.registration_expiry}
                  onChange={e => setFormData({ ...formData, registration_expiry: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="Seller" value={formData.seller}
                  onChange={e => setFormData({ ...formData, seller: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="number" step="0.01" placeholder="Purchase Price" value={formData.purchase_price}
                  onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" placeholder="Purchase Date" value={formData.purchase_date}
                  onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
              </div>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="decommissioned">Decommissioned</option>
                <option value="rented">Rented</option>
              </select>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  Save
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

export default VehiclesManagement;