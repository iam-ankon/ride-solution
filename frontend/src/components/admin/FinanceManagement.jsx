// src/components/admin/FinanceManagement.jsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSpinner, FaChartLine, FaSync, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function FinanceManagement() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0], type: "income",
    category: "rental", amount: "", description: "", plate_number: ""
  });
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { fetchTransactions(); }, [startDate, endDate, refreshKey]);

  const fetchTransactions = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/income_expense_report/?start_date=${startDate}&end_date=${endDate}`);
      setTransactions(response.data.transactions);
      setSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  // Sync function to create missing income records from completed payments
  const syncIncomeFromPayments = async () => {
    if (!window.confirm("This will sync all completed payments to the Income & Expenses ledger. Continue?")) return;

    setSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await apiClient.post(`/api/admin-dashboard/sync-income-from-payments/`);
      console.log("Sync response:", response.data);
      
      setSyncResult({
        success: response.data.success,
        created: response.data.created,
        skipped: response.data.skipped,
        message: response.data.message,
        errors: response.data.errors || []
      });
      
      alert(response.data.message);
      setRefreshKey(prev => prev + 1); // Refresh the data
      
      // Clear sync result after 5 seconds
      setTimeout(() => {
        setSyncResult(null);
      }, 5000);
    } catch (error) {
      console.error("Error syncing:", error);
      setSyncResult({
        success: false,
        message: error.response?.data?.error || error.message || "Error syncing payments to income",
        errors: []
      });
      alert("Error syncing payments to income");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/admin-dashboard/transactions/`, formData);
      setRefreshKey(prev => prev + 1);
      setShowModal(false);
      resetForm();
      alert("Transaction added successfully");
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Error adding transaction: " + (error.response?.data?.error || error.message));
    }
  };

  const deleteTransaction = async (id) => {
    if (window.confirm("Delete this transaction?")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/transaction/${id}/`);
        setRefreshKey(prev => prev + 1);
        alert("Transaction deleted successfully");
      } catch (error) {
        console.error("Error deleting transaction:", error);
        alert("Error deleting transaction");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0], type: "income",
      category: "rental", amount: "", description: "", plate_number: ""
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      rental: "bg-green-100 text-green-800", 
      insurance: "bg-blue-100 text-blue-800",
      maintenance: "bg-yellow-100 text-yellow-800", 
      registration: "bg-purple-100 text-purple-800",
      fuel: "bg-orange-100 text-orange-800", 
      toll: "bg-red-100 text-red-800", 
      other: "bg-gray-100 text-gray-800"
    };
    return colors[category] || colors.other;
  };

  // Group by category for chart
  const incomeByCategory = transactions.filter(t => t.type === 'income').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
    return acc;
  }, {});

  const expenseByCategory = transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Income & Expenses</h1>
        <div className="flex gap-2">
          <button 
            onClick={syncIncomeFromPayments}
            disabled={syncing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
          >
            {syncing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            {syncing ? "Syncing..." : "Sync from Payments"}
          </button>
          <button 
            onClick={() => setShowModal(true)} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <FaPlus /> Add Transaction
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
                  Created: {syncResult.created} | Skipped: {syncResult.skipped}
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

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} 
              className="px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} 
              className="px-3 py-2 border rounded-lg" />
          </div>
          <button onClick={fetchTransactions} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Apply Filter
          </button>
          <button onClick={syncIncomeFromPayments} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
            <FaSync /> Sync Payments
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-green-100 rounded-xl p-4 text-center">
            <p className="text-gray-600">Total Income</p>
            <p className="text-2xl font-bold text-green-600">${summary.total_income?.toLocaleString()}</p>
          </div>
          <div className="bg-red-100 rounded-xl p-4 text-center">
            <p className="text-gray-600">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">${summary.total_expenses?.toLocaleString()}</p>
          </div>
          <div className="bg-blue-100 rounded-xl p-4 text-center">
            <p className="text-gray-600">Net Profit</p>
            <p className={`text-2xl font-bold ${summary.net_profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
              ${summary.net_profit?.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Income vs Expense by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4 text-green-600">Income by Category</h2>
          <div className="space-y-2">
            {Object.entries(incomeByCategory).map(([category, amount]) => (
              <div key={category} className="flex justify-between items-center">
                <span className="capitalize">{category}</span>
                <span className="font-semibold text-green-600">${amount.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(incomeByCategory).length === 0 && (
              <p className="text-gray-500">No income transactions in this period</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4 text-red-600">Expenses by Category</h2>
          <div className="space-y-2">
            {Object.entries(expenseByCategory).map(([category, amount]) => (
              <div key={category} className="flex justify-between items-center">
                <span className="capitalize">{category}</span>
                <span className="font-semibold text-red-600">${amount.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(expenseByCategory).length === 0 && (
              <p className="text-gray-500">No expense transactions in this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-mono">{t.vehicle_plate || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getCategoryColor(t.category)}`}>
                    {t.category}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-xs truncate" title={t.description}>{t.description}</td>
                <td className={`px-4 py-3 font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === "income" ? "+" : "-"}${parseFloat(t.amount).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    t.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteTransaction(t.id)} className="text-red-600 hover:text-red-800">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions found for the selected period.</p>
            <button 
              onClick={syncIncomeFromPayments}
              className="mt-3 text-green-600 hover:text-green-700 flex items-center gap-2 mx-auto"
            >
              <FaSync /> Click here to sync payments to income
            </button>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Transaction</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="date" required value={formData.date} 
                onChange={e => setFormData({ ...formData, date: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              
              <select required value={formData.type} 
                onChange={e => setFormData({ ...formData, type: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              
              <select required value={formData.category} 
                onChange={e => setFormData({ ...formData, category: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg">
                <option value="rental">Rental Income</option>
                <option value="insurance">Insurance</option>
                <option value="maintenance">Maintenance</option>
                <option value="registration">Registration</option>
                <option value="fuel">Fuel</option>
                <option value="toll">Toll</option>
                <option value="other">Other</option>
              </select>
              
              <input type="number" step="0.01" required placeholder="Amount *" value={formData.amount} 
                onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              
              <input type="text" required placeholder="Description *" value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                className="w-full px-3 py-2 border rounded-lg" />
              
              <input type="text" placeholder="Vehicle Plate (Optional)" value={formData.plate_number} 
                onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })} 
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

export default FinanceManagement;