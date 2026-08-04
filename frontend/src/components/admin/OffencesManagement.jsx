// src/components/admin/OffencesManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSpinner, FaCheckCircle, FaGavel } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function OffencesManagement() {
  const [offences, setOffences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    penalty_notice_number: "", offence: "", location: "", vehicle_rego: "",
    offence_date: "", maturity_date: "", driver_name: "", status: "outstanding", driver_licence_no: ""
  });

  useEffect(() => { fetchOffences(); }, [filter, refreshKey]);

  const fetchOffences = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-offences/`);
      let filteredData = response.data;
      if (filter === "outstanding") {
        filteredData = response.data.filter(o => o.status === "outstanding");
      } else if (filter === "overdue") {
        filteredData = response.data.filter(o => o.maturity_date && new Date(o.maturity_date) < new Date() && o.status === "outstanding");
      }
      setOffences(filteredData);
    } catch (error) {
      console.error("Error fetching offences:", error);
    } finally {
      setLoading(false);
    }
  };

  const resolveOffence = async (offenceId, fineAmount) => {
    if (window.confirm(`Record fine payment of $${fineAmount} for this offence?`)) {
      try {
        await apiClient.patch(`/api/admin-dashboard/offence-resolve/${offenceId}/`, { fine_amount: fineAmount });
        setRefreshKey(prev => prev + 1);
        alert("Offence marked as resolved");
      } catch (error) {
        console.error("Error resolving offence:", error);
        alert("Error resolving offence");
      }
    }
  };

  const deleteOffence = async (id) => {
    if (window.confirm("Delete this offence record?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/offence/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Offence deleted successfully");
      } catch (error) {
        console.error("Error deleting offence:", error);
        alert("Error deleting offence");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/admin-dashboard/offences/`, formData);
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
      alert("Offence added successfully");
    } catch (error) {
      console.error("Error creating offence:", error);
      alert("Error creating offence");
    }
  };

  const resetForm = () => {
    setFormData({
      penalty_notice_number: "", offence: "", location: "", vehicle_rego: "",
      offence_date: "", maturity_date: "", driver_name: "", status: "outstanding", driver_licence_no: ""
    });
  };

  if (loading) return <LoadingSpinner />;

  const outstandingCount = offences.filter(o => o.status === 'outstanding').length;
  const overdueCount = offences.filter(o => o.maturity_date && new Date(o.maturity_date) < new Date() && o.status === 'outstanding').length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Toll Offences Management</h1>
        <button onClick={() => setShowModal(true)} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <FaPlus /> Add Offence
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <FaGavel className="text-gray-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Offences</p>
          <p className="text-2xl font-bold text-gray-600">{offences.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <FaGavel className="text-yellow-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Outstanding</p>
          <p className="text-2xl font-bold text-yellow-600">{outstandingCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <FaGavel className="text-red-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setFilter("all")} 
          className={`px-4 py-2 rounded-lg ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
          All
        </button>
        <button onClick={() => setFilter("outstanding")} 
          className={`px-4 py-2 rounded-lg ${filter === "outstanding" ? "bg-yellow-600 text-white" : "bg-gray-200"}`}>
          Outstanding
        </button>
        <button onClick={() => setFilter("overdue")} 
          className={`px-4 py-2 rounded-lg ${filter === "overdue" ? "bg-red-600 text-white" : "bg-gray-200"}`}>
          Overdue
        </button>
      </div>

      {/* Offences Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Notice No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Offence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Offence Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Maturity Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Driver</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {offences.map((offence) => {
              const isOverdue = offence.maturity_date && new Date(offence.maturity_date) < new Date() && offence.status !== "resolved";
              return (
                <tr key={offence.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{offence.penalty_notice_number}</td>
                  <td className="px-4 py-3 font-mono">{offence.vehicle_rego}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={offence.offence}>{offence.offence}</td>
                  <td className="px-4 py-3">{new Date(offence.offence_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                      {offence.maturity_date ? new Date(offence.maturity_date).toLocaleDateString() : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{offence.driver_name || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      offence.status === "resolved" ? "bg-green-100 text-green-800" : 
                      isOverdue ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {offence.status === "resolved" ? "Resolved" : isOverdue ? "Overdue" : "Outstanding"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {offence.status !== "resolved" && (
                      <button 
                        onClick={() => { 
                          const amount = prompt("Enter fine amount to record:", "100"); 
                          if (amount && !isNaN(parseFloat(amount))) 
                            resolveOffence(offence.id, parseFloat(amount)); 
                        }} 
                        className="text-green-600 hover:text-green-800 mr-3" 
                        title="Mark as Resolved">
                        <FaCheckCircle />
                      </button>
                    )}
                    <button onClick={() => deleteOffence(offence.id)} className="text-red-600 hover:text-red-800">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {offences.length === 0 && (
          <div className="text-center py-8 text-gray-500">No offence records found.</div>
        )}
      </div>

      {/* Add Offence Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Toll Offence</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Penalty Notice Number" value={formData.penalty_notice_number} 
                onChange={e => setFormData({ ...formData, penalty_notice_number: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <textarea required placeholder="Offence Description" value={formData.offence} 
                onChange={e => setFormData({ ...formData, offence: e.target.value })} 
                rows="2" className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Location" value={formData.location || ""} 
                onChange={e => setFormData({ ...formData, location: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" required placeholder="Vehicle Rego" value={formData.vehicle_rego} 
                onChange={e => setFormData({ ...formData, vehicle_rego: e.target.value.toUpperCase() })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required placeholder="Offence Date" value={formData.offence_date} 
                  onChange={e => setFormData({ ...formData, offence_date: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" placeholder="Maturity Date" value={formData.maturity_date || ""} 
                  onChange={e => setFormData({ ...formData, maturity_date: e.target.value })} 
                  className="px-3 py-2 border rounded-lg" />
              </div>
              <input type="text" placeholder="Driver Name" value={formData.driver_name || ""} 
                onChange={e => setFormData({ ...formData, driver_name: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Driver Licence No" value={formData.driver_licence_no || ""} 
                onChange={e => setFormData({ ...formData, driver_licence_no: e.target.value })} 
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

export default OffencesManagement;