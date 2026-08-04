// src/components/admin/InstallStatusManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSpinner, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function InstallStatusManagement() {
  const [installStatuses, setInstallStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    plate_number: "", driver_name: "", tracker_number: "",
    phone_number: "", install_date: "", status: "pending", notes: "",
    sim_brand: "", invoice_number: ""
  });

  useEffect(() => { fetchInstallStatuses(); }, [refreshKey]);

  const fetchInstallStatuses = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-install-status/`);
      setInstallStatuses(response.data);
    } catch (error) {
      console.error("Error fetching install statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/admin-dashboard/install-status/`, formData);
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
      alert("Install record created successfully");
    } catch (error) {
      console.error("Error creating install status:", error);
      alert("Error creating install record");
    }
  };

  const deleteInstallStatus = async (id) => {
    if (window.confirm("Delete this install status record?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/install-status/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Install record deleted successfully");
      } catch (error) {
        console.error("Error deleting install status:", error);
        alert("Error deleting install record");
      }
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiClient.patch(`/api/admin-dashboard/install-status-update/${id}/`, { status });
      setRefreshKey(prev => prev + 1);
      alert(`Status updated to ${status}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error updating status");
    }
  };

  const resetForm = () => {
    setFormData({
      plate_number: "", driver_name: "", tracker_number: "",
      phone_number: "", install_date: "", status: "pending", notes: "",
      sim_brand: "", invoice_number: ""
    });
  };

  if (loading) return <LoadingSpinner />;

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800"
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Install Status Management</h1>
        <button onClick={() => setShowModal(true)} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <FaPlus /> Add Install Record
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Total Records</p>
          <p className="text-2xl font-bold text-gray-600">{installStatuses.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <FaTimesCircle className="text-yellow-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{installStatuses.filter(i => i.status === 'pending').length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <FaCheckCircle className="text-green-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-600">{installStatuses.filter(i => i.status === 'completed').length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Failed</p>
          <p className="text-2xl font-bold text-red-600">{installStatuses.filter(i => i.status === 'failed').length}</p>
        </div>
      </div>

      {/* Install Status Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Driver</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tracker No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Install Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {installStatuses.map((install) => (
              <tr key={install.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{install.vehicle_plate || install.plate_number}</td>
                <td className="px-4 py-3">{install.driver_name}</td>
                <td className="px-4 py-3 font-mono text-sm">{install.tracker_number || "-"}</td>
                <td className="px-4 py-3">{install.phone_number || "-"}</td>
                <td className="px-4 py-3">{install.install_date ? new Date(install.install_date).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3">
                  <select 
                    value={install.status} 
                    onChange={e => updateStatus(install.id, e.target.value)} 
                    className={`text-sm border rounded px-2 py-1 ${getStatusBadge(install.status)}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteInstallStatus(install.id)} className="text-red-600 hover:text-red-800">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {installStatuses.length === 0 && (
          <div className="text-center py-8 text-gray-500">No install status records found.</div>
        )}
      </div>

      {/* Add Install Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Install Record</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Vehicle Plate" value={formData.plate_number} 
                onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" required placeholder="Driver Name" value={formData.driver_name} 
                onChange={e => setFormData({ ...formData, driver_name: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Tracker Number" value={formData.tracker_number || ""} 
                onChange={e => setFormData({ ...formData, tracker_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Phone Number" value={formData.phone_number || ""} 
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="SIM Brand" value={formData.sim_brand || ""} 
                onChange={e => setFormData({ ...formData, sim_brand: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Invoice Number" value={formData.invoice_number || ""} 
                onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Install Date" value={formData.install_date || ""} 
                onChange={e => setFormData({ ...formData, install_date: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Notes" value={formData.notes || ""} 
                onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                rows="2" className="w-full px-3 py-2 border rounded-lg" />
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

export default InstallStatusManagement;