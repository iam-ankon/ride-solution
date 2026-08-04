// src/components/admin/CustomerPaymentsManagement.jsx
import React, { useState, useEffect } from "react";
import { FaTrash, FaSpinner, FaMoneyBillWave, FaCreditCard, FaReceipt, FaShieldAlt, FaSync } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function CustomerPaymentsManagement() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, total_amount: 0 });

  useEffect(() => {
    fetchPayments();
  }, [filter, filterType, refreshKey]);

  const fetchPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(`/api/admin-dashboard/customer-payments/`);
      
      let filteredData = response.data;
      if (filter !== "all") {
        filteredData = filteredData.filter(p => p.status === filter);
      }
      if (filterType !== "all") {
        filteredData = filteredData.filter(p => p.payment_type === filterType);
      }
      setPayments(filteredData);
      
      const total = response.data.length;
      const completed = response.data.filter(p => p.status === 'completed').length;
      const pending = response.data.filter(p => p.status === 'pending').length;
      const total_amount = response.data.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      setStats({ total, completed, pending, total_amount });
      
    } catch (error) {
      console.error("Error fetching payments:", error);
      setError(error.response?.data?.error || error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const deletePayment = async (id) => {
    if (window.confirm("Delete this payment?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/customer-payment/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Payment deleted successfully");
      } catch (error) {
        console.error("Error deleting payment:", error);
        alert("Error deleting payment");
      }
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800"
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || colors.pending}`}>{status}</span>;
  };

  const getPaymentTypeIcon = (type) => {
    switch(type) {
      case 'signup': return <FaMoneyBillWave className="text-green-500" />;
      case 'bond': return <FaShieldAlt className="text-blue-500" />;
      case 'weekly': return <FaCreditCard className="text-purple-500" />;
      default: return <FaReceipt className="text-gray-500" />;
    }
  };

  const getPaymentTypeLabel = (type) => {
    switch(type) {
      case 'signup': return 'Signup Fee';
      case 'bond': return 'Bond';
      case 'weekly': return 'Weekly Payment';
      default: return type || 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-600 text-4xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Customer Payments Management</h1>
        <p className="text-gray-500 text-sm mt-1">View all customer payments (signup fees, bonds, weekly rental payments)</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Total Payments</p>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <p className="text-gray-600 text-sm">Total Amount</p>
          <p className="text-2xl font-bold text-purple-600">${stats.total_amount.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          <button onClick={() => setFilter("all")} 
            className={`px-4 py-2 rounded-lg ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            All Status
          </button>
          <button onClick={() => setFilter("completed")} 
            className={`px-4 py-2 rounded-lg ${filter === "completed" ? "bg-green-600 text-white" : "bg-gray-200"}`}>
            Completed
          </button>
          <button onClick={() => setFilter("pending")} 
            className={`px-4 py-2 rounded-lg ${filter === "pending" ? "bg-yellow-600 text-white" : "bg-gray-200"}`}>
            Pending
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilterType("all")} 
            className={`px-4 py-2 rounded-lg ${filterType === "all" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            All Types
          </button>
          <button onClick={() => setFilterType("signup")} 
            className={`px-4 py-2 rounded-lg ${filterType === "signup" ? "bg-green-600 text-white" : "bg-gray-200"}`}>
            Signup Fees
          </button>
          <button onClick={() => setFilterType("bond")} 
            className={`px-4 py-2 rounded-lg ${filterType === "bond" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            Bonds
          </button>
          <button onClick={() => setFilterType("weekly")} 
            className={`px-4 py-2 rounded-lg ${filterType === "weekly" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>
            Weekly Payments
          </button>
        </div>
        <button onClick={fetchPayments} className="ml-auto bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center gap-2">
          <FaSync /> Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-400 text-red-700 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Car</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Week</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{payment.payment_reference}</td>
                <td className="px-4 py-3">
                  <div>{payment.rental?.customer_name || 'N/A'}</div>
                  <div className="text-xs text-gray-500">{payment.rental?.customer_email || 'N/A'}</div>
                </td>
                <td className="px-4 py-3">{payment.rental?.car_name || 'N/A'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getPaymentTypeIcon(payment.payment_type)}
                    <span>{getPaymentTypeLabel(payment.payment_type)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{payment.payment_for_week > 0 ? `Week ${payment.payment_for_week}` : "-"}</td>
                <td className="px-4 py-3 font-semibold text-green-600">${parseFloat(payment.amount).toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(payment.payment_date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{getStatusBadge(payment.status)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deletePayment(payment.id)} className="text-red-600 hover:text-red-800">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">
            <FaReceipt className="text-5xl mx-auto mb-3 text-gray-300" />
            <p>No customer payment records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerPaymentsManagement;