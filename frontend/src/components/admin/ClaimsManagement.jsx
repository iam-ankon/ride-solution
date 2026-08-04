// src/components/admin/ClaimsManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSpinner, FaFileAlt } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function ClaimsManagement() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    vehicle_rego: "", claim_number: "", event_date: "",
    what_happened: "", progress: "in_progress", excess: "",
    coverage: "", incident_location: "", repair_details: ""
  });

  useEffect(() => { fetchClaims(); }, [refreshKey]);

  const fetchClaims = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-claims/`);
      setClaims(response.data);
    } catch (error) {
      console.error("Error fetching claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/admin-dashboard/claims/`, {
        ...formData,
        excess: parseFloat(formData.excess) || 0
      });
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
      alert("Claim created successfully");
    } catch (error) {
      console.error("Error creating claim:", error);
      alert("Error creating claim");
    }
  };

  const deleteClaim = async (id) => {
    if (window.confirm("Delete this claim?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/claim/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Claim deleted successfully");
      } catch (error) {
        console.error("Error deleting claim:", error);
        alert("Error deleting claim");
      }
    }
  };

  const updateProgress = async (id, progress) => {
    try {
      await apiClient.patch(`/api/admin-dashboard/claim-progress/${id}/`, { progress });
      setRefreshKey(prev => prev + 1);
      alert(`Claim progress updated to ${progress}`);
    } catch (error) {
      console.error("Error updating claim progress:", error);
      alert("Error updating claim progress");
    }
  };

  const resetForm = () => {
    setFormData({
      vehicle_rego: "", claim_number: "", event_date: "",
      what_happened: "", progress: "in_progress", excess: "",
      coverage: "", incident_location: "", repair_details: ""
    });
  };

  if (loading) return <LoadingSpinner />;

  const getProgressColor = (progress) => {
    const colors = {
      in_progress: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    };
    return colors[progress] || colors.in_progress;
  };

  const getProgressLabel = (progress) => {
    const labels = {
      in_progress: "In Progress",
      approved: "Approved",
      rejected: "Rejected",
      completed: "Completed"
    };
    return labels[progress] || progress;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Insurance Claims Management</h1>
        <button onClick={() => setShowModal(true)} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <FaPlus /> Add Claim
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <FaFileAlt className="text-gray-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Claims</p>
          <p className="text-2xl font-bold text-gray-600">{claims.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-yellow-600">{claims.filter(c => c.progress === 'in_progress').length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-2xl font-bold text-green-600">{claims.filter(c => c.progress === 'approved').length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-2xl font-bold text-blue-600">{claims.filter(c => c.progress === 'completed').length}</p>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Claim No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Event Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Excess</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {claims.map((claim) => (
              <tr key={claim.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{claim.claim_number}</td>
                <td className="px-4 py-3 font-mono">{claim.vehicle_rego}</td>
                <td className="px-4 py-3">{new Date(claim.event_date).toLocaleDateString()}</td>
                <td className="px-4 py-3">${claim.excess?.toLocaleString() || 0}</td>
                <td className="px-4 py-3">
                  <select 
                    value={claim.progress} 
                    onChange={e => updateProgress(claim.id, e.target.value)} 
                    className={`text-sm border rounded px-2 py-1 ${getProgressColor(claim.progress)}`}
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteClaim(claim.id)} className="text-red-600 hover:text-red-800">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {claims.length === 0 && (
          <div className="text-center py-8 text-gray-500">No insurance claims found.</div>
        )}
      </div>

      {/* Add Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Insurance Claim</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Claim Number" value={formData.claim_number} 
                onChange={e => setFormData({ ...formData, claim_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" required placeholder="Vehicle Rego" value={formData.vehicle_rego} 
                onChange={e => setFormData({ ...formData, vehicle_rego: e.target.value.toUpperCase() })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="date" required placeholder="Event Date" value={formData.event_date} 
                onChange={e => setFormData({ ...formData, event_date: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Incident Location" value={formData.incident_location || ""} 
                onChange={e => setFormData({ ...formData, incident_location: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Coverage" value={formData.coverage || ""} 
                onChange={e => setFormData({ ...formData, coverage: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <textarea required placeholder="What Happened" value={formData.what_happened} 
                onChange={e => setFormData({ ...formData, what_happened: e.target.value })} 
                rows="3" className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Repair Details" value={formData.repair_details || ""} 
                onChange={e => setFormData({ ...formData, repair_details: e.target.value })} 
                rows="2" className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" step="0.01" placeholder="Excess Amount" value={formData.excess} 
                onChange={e => setFormData({ ...formData, excess: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  Create
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

export default ClaimsManagement;