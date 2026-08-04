// src/components/admin/PaymentLedgerManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSpinner, FaCheckCircle, FaMoneyBillWave, FaCalendarAlt, FaSync, FaExclamationTriangle, FaClock, FaCreditCard } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function PaymentLedgerManagement() {
  const [payments, setPayments] = useState([]);
  const [upcomingPayments, setUpcomingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("completed"); // "completed" or "upcoming"
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    plate_number: "", driver_name: "", week_start: "", week_end: "",
    due_date: "", due_amount: "", received_amount: 0, status: "pending", notes: ""
  });
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    fetchPayments();
    fetchUpcomingPayments();
    fetchVehicles();
  }, [filter, refreshKey]);


  const syncPaymentLedger = async () => {
    if (!window.confirm("This will sync all completed payments to the payment ledger. Continue?")) return;

    setSyncing(true);
    try {
      const response = await apiClient.post(`/api/admin-dashboard/sync-payment-ledger/`);
      alert(response.data.message);
      refreshData();
      fetchUpcomingPayments();
    } catch (error) {
      console.error("Sync error:", error);
      alert("Error syncing payment ledger: " + (error.response?.data?.error || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    setError("");
    try {
      console.log("Fetching payment ledger...");
      const response = await apiClient.get(`/api/admin-dashboard/all-payment-ledger/`);
      console.log("Payment ledger response:", response.data);

      let paymentsData = [];
      if (Array.isArray(response.data)) {
        paymentsData = response.data;
      } else if (response.data.results && Array.isArray(response.data.results)) {
        paymentsData = response.data.results;
      } else {
        paymentsData = [];
      }

      // Add is_late flag to each payment
      paymentsData = paymentsData.map(payment => ({
        ...payment,
        is_late: payment.status !== 'paid' && payment.due_date && new Date(payment.due_date) < new Date()
      }));

      setPayments(paymentsData);
      console.log("Processed payments:", paymentsData.length);
    } catch (error) {
      console.error("Error fetching payments:", error);
      setError(error.response?.data?.error || error.message || "Failed to load payment ledger data");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingPayments = async () => {
    try {
      console.log("Fetching upcoming payments...");
      const response = await apiClient.get(`/api/admin-dashboard/upcoming-payments/`);
      console.log("Upcoming payments response:", response.data);

      if (Array.isArray(response.data)) {
        setUpcomingPayments(response.data);
      } else {
        setUpcomingPayments([]);
      }
    } catch (error) {
      console.error("Error fetching upcoming payments:", error);
      setUpcomingPayments([]);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/all-vehicles/`);
      if (Array.isArray(response.data)) {
        setVehicles(response.data);
      } else if (response.data.results && Array.isArray(response.data.results)) {
        setVehicles(response.data.results);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      setVehicles([]);
    }
  };

  const markAsPaid = async (paymentId) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      await apiClient.patch(`/api/admin-dashboard/payment-ledger/${paymentId}/`, {
        status: "paid",
        received_date: new Date().toISOString().split("T")[0],
        received_amount: payment.due_amount
      });
      setRefreshKey(prev => prev + 1);
      alert("Payment marked as paid");
    } catch (error) {
      console.error("Error updating payment:", error);
      alert("Error marking payment as paid");
    }
  };

  const deletePayment = async (id) => {
    if (window.confirm("Delete this payment record?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/payment-ledger/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Payment record deleted successfully");
      } catch (error) {
        console.error("Error deleting payment:", error);
        alert("Error deleting payment record");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        due_amount: parseFloat(formData.due_amount) || 0,
        received_amount: parseFloat(formData.received_amount) || 0,
      };

      if (editingPayment) {
        await apiClient.patch(`/api/admin-dashboard/payment-ledger/${editingPayment.id}/`, dataToSend);
        alert("Payment record updated successfully");
      } else {
        await apiClient.post(`/api/admin-dashboard/payment-ledger/`, dataToSend);
        alert("Payment record created successfully");
      }
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Error saving payment record: " + (error.response?.data?.error || error.message));
    }
  };

  const resetForm = () => {
    setFormData({
      plate_number: "", driver_name: "", week_start: "", week_end: "",
      due_date: "", due_amount: "", received_amount: 0, status: "pending", notes: ""
    });
    setEditingPayment(null);
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getStatusBadge = (payment) => {
    if (payment.status === "paid") {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Paid</span>;
    }
    if (payment.is_late) {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Late</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>;
  };

  // Calculate totals
  const totalDue = payments.reduce((sum, p) => sum + parseFloat(p.due_amount || 0), 0);
  const totalReceived = payments.reduce((sum, p) => sum + parseFloat(p.received_amount || 0), 0);
  const pendingCount = payments.filter(p => p.status === "pending" && !p.is_late).length;
  const lateCount = payments.filter(p => p.is_late).length;
  const upcomingTotal = upcomingPayments.reduce((sum, p) => sum + p.weekly_amount, 0);
  const totalUpcomingCount = upcomingPayments.length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-600 text-4xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payment Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">Track driver payments - completed and upcoming</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshData}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
          >
            <FaSync /> Refresh
          </button>
          <button
            onClick={syncPaymentLedger}
            disabled={syncing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
          >
            {syncing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            Sync Ledger
          </button>

          <button onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <FaPlus /> Add Manual Entry
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
          <FaExclamationTriangle className="text-red-500" />
          <span>{error}</span>
          <button onClick={refreshData} className="ml-auto bg-red-100 px-3 py-1 rounded text-red-700 hover:bg-red-200">
            Retry
          </button>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-6 py-3 font-medium transition ${activeTab === "completed"
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          <FaCheckCircle className="inline mr-2" />
          Completed & Pending ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`px-6 py-3 font-medium transition ${activeTab === "upcoming"
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          <FaClock className="inline mr-2" />
          Upcoming Payments ({totalUpcomingCount})
        </button>
      </div>

      {/* Stats Cards for Completed Tab */}
      {activeTab === "completed" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <FaMoneyBillWave className="text-blue-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Total Due</p>
            <p className="text-2xl font-bold text-blue-600">${totalDue.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <FaCheckCircle className="text-green-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Total Received</p>
            <p className="text-2xl font-bold text-green-600">${totalReceived.toLocaleString()}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 text-center">
            <FaCalendarAlt className="text-yellow-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <FaExclamationTriangle className="text-red-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Late</p>
            <p className="text-2xl font-bold text-red-600">{lateCount}</p>
          </div>
        </div>
      )}

      {/* Stats Cards for Upcoming Tab */}
      {activeTab === "upcoming" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <FaClock className="text-purple-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Upcoming Payments</p>
            <p className="text-2xl font-bold text-purple-600">{totalUpcomingCount}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <FaMoneyBillWave className="text-blue-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Total Expected</p>
            <p className="text-2xl font-bold text-blue-600">${upcomingTotal.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <FaCreditCard className="text-green-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Active Rentals</p>
            <p className="text-2xl font-bold text-green-600">{upcomingPayments.length}</p>
          </div>
        </div>
      )}

      {/* Filter Buttons - Only for Completed Tab */}
      {activeTab === "completed" && (
        <div className="flex gap-3 mb-6">
          <button onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            All ({payments.length})
          </button>
          <button onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-lg ${filter === "pending" ? "bg-yellow-600 text-white" : "bg-gray-200"}`}>
            Pending ({payments.filter(p => p.status === 'pending').length})
          </button>
          <button onClick={() => setFilter("paid")}
            className={`px-4 py-2 rounded-lg ${filter === "paid" ? "bg-green-600 text-white" : "bg-gray-200"}`}>
            Paid ({payments.filter(p => p.status === 'paid').length})
          </button>
        </div>
      )}

      {/* Completed Payments Table */}
      {activeTab === "completed" && (
        <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-gray-500">No payment records found.</p>
              <p className="text-sm text-gray-400 mt-1">Payments will appear here automatically when customers make payments.</p>
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <FaPlus className="inline mr-2" /> Add Manual Entry
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Week</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Due Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Received</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{payment.vehicle_plate || payment.plate_number?.plate_number || "-"}</td>
                    <td className="px-4 py-3 font-medium">{payment.driver_name}</td>
                    <td className="px-4 py-3 text-sm">
                      {payment.week_start ? new Date(payment.week_start).toLocaleDateString() : "-"} - {payment.week_end ? new Date(payment.week_end).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3">{payment.due_date ? new Date(payment.due_date).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 font-semibold">${parseFloat(payment.due_amount).toLocaleString()}</td>
                    <td className="px-4 py-3">${parseFloat(payment.received_amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{getStatusBadge(payment)}</td>
                    <td className="px-4 py-3">
                      {payment.status !== "paid" && (
                        <button onClick={() => markAsPaid(payment.id)}
                          className="text-green-600 hover:text-green-800 mr-3" title="Mark as Paid">
                          <FaCheckCircle />
                        </button>
                      )}
                      <button onClick={() => deletePayment(payment.id)}
                        className="text-red-600 hover:text-red-800" title="Delete">
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Upcoming Payments Table */}
      {activeTab === "upcoming" && (
        <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
          {upcomingPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">📅</div>
              <p className="text-gray-500">No upcoming payments found.</p>
              <p className="text-sm text-gray-400 mt-1">All active rentals have completed their payment schedules.</p>
            </div>
          ) : (
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Booking Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Car</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle Plate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Next Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {upcomingPayments.map((payment) => {
                  const isOverdue = new Date(payment.next_payment_date) < new Date();
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-blue-600">
                        {payment.booking_reference}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{payment.customer_name}</div>
                        <div className="text-xs text-gray-500">{payment.customer_email}</div>
                        <div className="text-xs text-gray-400">{payment.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{payment.car_name}</div>
                        <div className="text-xs text-gray-500">{payment.car_brand}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{payment.plate_number || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">Week #{payment.next_week_number}</span>
                        <div className="text-xs text-gray-500">of {payment.total_weeks} weeks</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        ${payment.weekly_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 rounded-full h-2"
                            style={{ width: `${(payment.completed_payments / payment.total_weeks) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {payment.completed_payments} / {payment.total_weeks} payments completed
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                          {new Date(payment.next_payment_date).toLocaleDateString()}
                        </span>
                        {isOverdue && (
                          <div className="text-xs text-red-500">Overdue!</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingPayment ? "Edit Payment Entry" : "Add Manual Payment Entry"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Vehicle Plate Number" value={formData.plate_number}
                onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" required placeholder="Driver Name" value={formData.driver_name}
                onChange={e => setFormData({ ...formData, driver_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" required placeholder="Week Start" value={formData.week_start}
                  onChange={e => setFormData({ ...formData, week_start: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" required placeholder="Week End" value={formData.week_end}
                  onChange={e => setFormData({ ...formData, week_end: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
              </div>
              <input type="date" required placeholder="Due Date" value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" step="0.01" required placeholder="Due Amount" value={formData.due_amount}
                onChange={e => setFormData({ ...formData, due_amount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" step="0.01" placeholder="Received Amount (if paid)" value={formData.received_amount}
                onChange={e => setFormData({ ...formData, received_amount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Notes" value={formData.notes}
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

export default PaymentLedgerManagement;