// src/components/admin/InsuranceManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaShieldAlt } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function InsuranceManagement() {
  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    plate_number: "", policy_holder: "", policy_number: "", provider: "",
    start_date: "", end_date: "", monthly_amount: "", status: "active", 
    excess_fee: "", account_email: "", password: ""
  });

  useEffect(() => { fetchInsurances(); }, [refreshKey]);

  const fetchInsurances = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-insurances/`);
      setInsurances(response.data);
    } catch (error) {
      console.error("Error fetching insurances:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        monthly_amount: parseFloat(formData.monthly_amount) || 0,
        excess_fee: parseFloat(formData.excess_fee) || 0,
      };
      
      if (editingInsurance) {
        await apiClient.put(`/api/admin-dashboard/insurance/${editingInsurance.id}/`, dataToSend);
        alert("Insurance updated successfully");
      } else {
        await apiClient.post(`/api/admin-dashboard/insurances/`, dataToSend);
        alert("Insurance created successfully");
      }
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving insurance:", error);
      alert("Error saving insurance");
    }
  };

  const deleteInsurance = async (id) => {
    if (window.confirm("Delete this insurance policy?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/insurance/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Insurance deleted successfully");
      } catch (error) {
        console.error("Error deleting insurance:", error);
        alert("Error deleting insurance");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      plate_number: "", policy_holder: "", policy_number: "", provider: "",
      start_date: "", end_date: "", monthly_amount: "", status: "active",
      excess_fee: "", account_email: "", password: ""
    });
    setEditingInsurance(null);
  };

  const openEditModal = (insurance) => {
    setEditingInsurance(insurance);
    setFormData({
      plate_number: insurance.plate_number || "",
      policy_holder: insurance.policy_holder || "",
      policy_number: insurance.policy_number || "",
      provider: insurance.provider || "",
      start_date: insurance.start_date || "",
      end_date: insurance.end_date || "",
      monthly_amount: insurance.monthly_amount || "",
      status: insurance.status || "active",
      excess_fee: insurance.excess_fee || "",
      account_email: insurance.account_email || "",
      password: insurance.password || "",
    });
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner />;

  const expiringCount = insurances.filter(i => {
    if (!i.end_date || i.status !== 'active') return false;
    const expiryDate = new Date(i.end_date);
    const today = new Date();
    const daysLeft = (expiryDate - today) / (1000 * 60 * 60 * 24);
    return daysLeft <= 30 && daysLeft > 0;
  }).length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Insurance Management</h1>
        <button onClick={() => { resetForm(); setShowModal(true); }} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <FaPlus /> Add Insurance
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <FaShieldAlt className="text-blue-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Policies</p>
          <p className="text-2xl font-bold text-blue-600">{insurances.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <FaShieldAlt className="text-green-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-600">{insurances.filter(i => i.status === 'active').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <FaShieldAlt className="text-yellow-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Expiring Soon</p>
          <p className="text-2xl font-bold text-yellow-600">{expiringCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Expired</p>
          <p className="text-2xl font-bold text-red-600">{insurances.filter(i => i.status === 'expired').length}</p>
        </div>
      </div>

      {/* Insurance Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Policy No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Holder</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">End Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Monthly</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {insurances.map((insurance) => {
              const isExpiring = insurance.end_date && new Date(insurance.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              return (
                <tr key={insurance.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{insurance.vehicle_plate || insurance.plate_number}</td>
                  <td className="px-4 py-3">{insurance.provider || "-"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{insurance.policy_number || "-"}</td>
                  <td className="px-4 py-3">{insurance.policy_holder || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={isExpiring ? "text-red-600 font-semibold" : ""}>
                      {insurance.end_date ? new Date(insurance.end_date).toLocaleDateString() : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">${insurance.monthly_amount?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      insurance.status === "active" ? "bg-green-100 text-green-800" : 
                      insurance.status === "expired" ? "bg-red-100 text-red-800" : 
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {insurance.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEditModal(insurance)} className="text-blue-600 hover:text-blue-800 mr-3">
                      <FaEdit />
                    </button>
                    <button onClick={() => deleteInsurance(insurance.id)} className="text-red-600 hover:text-red-800">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {insurances.length === 0 && (
          <div className="text-center py-8 text-gray-500">No insurance policies found.</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingInsurance ? "Edit Insurance" : "Add Insurance"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Vehicle Plate" value={formData.plate_number} 
                onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Policy Holder" value={formData.policy_holder || ""} 
                onChange={e => setFormData({ ...formData, policy_holder: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Policy Number" value={formData.policy_number || ""} 
                onChange={e => setFormData({ ...formData, policy_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Provider" value={formData.provider || ""} 
                onChange={e => setFormData({ ...formData, provider: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="email" placeholder="Account Email" value={formData.account_email || ""} 
                onChange={e => setFormData({ ...formData, account_email: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Password" value={formData.password || ""} 
                onChange={e => setFormData({ ...formData, password: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" placeholder="Start Date" value={formData.start_date || ""} 
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" placeholder="End Date" value={formData.end_date || ""} 
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
              </div>
              <input type="number" step="0.01" placeholder="Monthly Amount" value={formData.monthly_amount} 
                onChange={e => setFormData({ ...formData, monthly_amount: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" step="0.01" placeholder="Excess Fee" value={formData.excess_fee} 
                onChange={e => setFormData({ ...formData, excess_fee: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg">
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
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

export default InsuranceManagement;