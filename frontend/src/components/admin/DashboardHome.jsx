// src/components/admin/DashboardHome.jsx
import React, { useState, useEffect } from "react";
import { 
  FaCar, FaUsers, FaMoneyBillWave, FaExclamationTriangle, FaCalendarAlt, 
  FaShieldAlt, FaWrench, FaGavel, FaSpinner, FaChartLine, FaDollarSign,
  FaCreditCard, FaFileInvoiceDollar
} from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function DashboardHome() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardSummary(); }, []);

  const fetchDashboardSummary = async () => {
    try {
      const response = await apiClient.get(`/api/admin-dashboard/summary/`);
      setSummary(response.data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-600 text-4xl" />
      </div>
    );
  }
  
  if (!summary) return null;

  const mainStats = [
    { title: "Total Cars", value: summary.total_cars || 0, icon: <FaCar className="text-blue-500 text-3xl" />, color: "bg-blue-100" },
    { title: "Available Cars", value: summary.available_cars || 0, icon: <FaCar className="text-green-500 text-3xl" />, color: "bg-green-100" },
    { title: "Rented Cars", value: summary.rented_cars || 0, icon: <FaCar className="text-yellow-500 text-3xl" />, color: "bg-yellow-100" },
    { title: "Active Drivers", value: summary.active_drivers || 0, icon: <FaUsers className="text-purple-500 text-3xl" />, color: "bg-purple-100" },
    { title: "Pending Payments", value: summary.pending_payments || 0, icon: <FaMoneyBillWave className="text-yellow-500 text-3xl" />, color: "bg-yellow-100" },
    { title: "Overdue Payments", value: summary.overdue_payments || 0, icon: <FaExclamationTriangle className="text-red-500 text-3xl" />, color: "bg-red-100" },
  ];

  const alerts = [
    { title: "Registration Expiring", count: summary.expiring_registrations || 0, icon: <FaCalendarAlt />, color: "text-orange-600", bg: "bg-orange-100" },
    { title: "Insurance Expiring", count: summary.expiring_insurances || 0, icon: <FaShieldAlt />, color: "text-purple-600", bg: "bg-purple-100" },
    { title: "Services Due", count: summary.services_due || 0, icon: <FaWrench />, color: "text-red-600", bg: "bg-red-100" },
    { title: "Services Due Soon", count: summary.services_due_soon || 0, icon: <FaWrench />, color: "text-yellow-600", bg: "bg-yellow-100" },
    { title: "Outstanding Offences", count: summary.outstanding_offences || 0, icon: <FaGavel />, color: "text-red-600", bg: "bg-red-100" },
    { title: "Overdue Offences", count: summary.overdue_offences || 0, icon: <FaGavel />, color: "text-red-800", bg: "bg-red-200" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening with your fleet today.</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {mainStats.map((stat, index) => (
          <div key={index} className={`${stat.color} rounded-xl p-4 shadow-sm hover:shadow-md transition`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-xs uppercase tracking-wide">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString()}</p>
              </div>
              <div className="text-2xl opacity-75">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FaExclamationTriangle className="text-yellow-500" />
          Alerts & Notifications
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert, index) => (
            <div key={index} className={`${alert.bg} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`${alert.color} text-xl`}>{alert.icon}</div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{alert.title}</p>
                  <p className={`text-2xl font-bold ${alert.color}`}>{alert.count}</p>
                </div>
                {alert.count > 0 && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FaChartLine className="text-blue-500" />
          Monthly Financial Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <FaDollarSign className="text-green-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600">Total Income</p>
            <p className="text-2xl font-bold text-green-600">${summary.monthly_income?.toLocaleString() || 0}</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <FaCreditCard className="text-red-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">${summary.monthly_expenses?.toLocaleString() || 0}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <FaFileInvoiceDollar className="text-blue-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600">Net Profit</p>
            <p className={`text-2xl font-bold ${summary.net_profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
              ${summary.net_profit?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;