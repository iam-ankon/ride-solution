// src/components/admin/GPSManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSpinner, FaSatelliteDish } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function GPSManagement() {
  const [gpsDevices, setGpsDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    plate_number: "", account_name: "", activation_date: "",
    new_sim_no: "", phone_number: "", new_tracker_no: "", provider: "Seeworld WhatsGPS",
    old_sim_no: "", old_tracker_no: "", email_address: "", password: "", date_of_birth: ""
  });

  useEffect(() => { fetchGpsDevices(); }, [refreshKey]);

  const fetchGpsDevices = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-gps-devices/`);
      setGpsDevices(response.data);
    } catch (error) {
      console.error("Error fetching GPS devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/admin-dashboard/gps-devices/`, formData);
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
      alert("GPS device added successfully");
    } catch (error) {
      console.error("Error creating GPS device:", error);
      alert("Error creating GPS device");
    }
  };

  const deleteGpsDevice = async (id) => {
    if (window.confirm("Delete this GPS device?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/gps-device/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("GPS device deleted successfully");
      } catch (error) {
        console.error("Error deleting GPS device:", error);
        alert("Error deleting GPS device");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      plate_number: "", account_name: "", activation_date: "",
      new_sim_no: "", phone_number: "", new_tracker_no: "", provider: "Seeworld WhatsGPS",
      old_sim_no: "", old_tracker_no: "", email_address: "", password: "", date_of_birth: ""
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">GPS Devices Management</h1>
        <button onClick={() => setShowModal(true)} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <FaPlus /> Add GPS Device
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <FaSatelliteDish className="text-blue-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Devices</p>
          <p className="text-2xl font-bold text-blue-600">{gpsDevices.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Active Trackers</p>
          <p className="text-2xl font-bold text-green-600">{gpsDevices.filter(d => d.new_tracker_no).length}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Providers</p>
          <p className="text-2xl font-bold text-purple-600">{new Set(gpsDevices.map(d => d.provider)).size}</p>
        </div>
      </div>

      {/* GPS Devices Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Account Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tracker No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SIM No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {gpsDevices.map((device) => (
              <tr key={device.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{device.vehicle_plate || device.plate_number}</td>
                <td className="px-4 py-3">{device.account_name || "-"}</td>
                <td className="px-4 py-3 font-mono text-sm">{device.new_tracker_no || device.tracker_number || "-"}</td>
                <td className="px-4 py-3 font-mono text-sm">{device.new_sim_no || "-"}</td>
                <td className="px-4 py-3">{device.phone_number || "-"}</td>
                <td className="px-4 py-3">{device.provider || "-"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteGpsDevice(device.id)} className="text-red-600 hover:text-red-800">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {gpsDevices.length === 0 && (
          <div className="text-center py-8 text-gray-500">No GPS devices found.</div>
        )}
      </div>

      {/* Add GPS Device Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add GPS Device</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Vehicle Plate" value={formData.plate_number} 
                onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Account Name" value={formData.account_name || ""} 
                onChange={e => setFormData({ ...formData, account_name: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="email" placeholder="Email Address" value={formData.email_address || ""} 
                onChange={e => setFormData({ ...formData, email_address: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Activation Date" value={formData.activation_date || ""} 
                onChange={e => setFormData({ ...formData, activation_date: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="New Tracker No." value={formData.new_tracker_no || ""} 
                  onChange={e => setFormData({ ...formData, new_tracker_no: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="Old Tracker No." value={formData.old_tracker_no || ""} 
                  onChange={e => setFormData({ ...formData, old_tracker_no: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="New SIM No." value={formData.new_sim_no || ""} 
                  onChange={e => setFormData({ ...formData, new_sim_no: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="Old SIM No." value={formData.old_sim_no || ""} 
                  onChange={e => setFormData({ ...formData, old_sim_no: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
              </div>
              <input type="tel" placeholder="Phone Number" value={formData.phone_number || ""} 
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Provider" value={formData.provider} 
                onChange={e => setFormData({ ...formData, provider: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="password" placeholder="Password" value={formData.password || ""} 
                onChange={e => setFormData({ ...formData, password: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Date of Birth" value={formData.date_of_birth || ""} 
                onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
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

export default GPSManagement;