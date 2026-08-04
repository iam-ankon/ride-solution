// src/components/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaSpinner, FaChartLine, FaCar, FaFileInvoiceDollar, FaUsers, FaMoneyBillWave, FaDollarSign, FaWrench, FaShieldAlt, FaGavel, FaCreditCard, FaExclamationTriangle, FaCheckCircle, FaEnvelope } from "react-icons/fa";

// Import all admin page components
import DashboardHome from "./DashboardHome";
import CarsManagement from "./CarsManagement";
import RentalsManagement from "./RentalsManagement";
import VehiclesManagement from "./VehiclesManagement";
import DriversManagement from "./DriversManagement";
import PaymentLedgerManagement from "./PaymentLedgerManagement";
import FinanceManagement from "./FinanceManagement";
import ServicesManagement from "./ServicesManagement";
import InsuranceManagement from "./InsuranceManagement";
import OffencesManagement from "./OffencesManagement";
import GPSManagement from "./GPSManagement";
import ClaimsManagement from "./ClaimsManagement";
import InstallStatusManagement from "./InstallStatusManagement";
import ContactMessagesManagement from "./ContactMessagesManagement";
import CustomerPaymentsManagement from "./CustomerPaymentsManagement";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/auth/refresh_token/`, {
            refresh_token: refreshToken,
          });
          if (response.data.access_token) {
            localStorage.setItem("access_token", response.data.access_token);
            originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export { apiClient };

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const response = await apiClient.get(`/api/auth/me/`);
      const user = response.data;
      if (user.is_staff || user.is_superuser) {
        setAdminAuthenticated(true);
      } else {
        navigate("/login");
      }
    } catch (error) {
      console.error("Admin access denied:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <FaSpinner className="animate-spin text-blue-600 text-5xl" />
      </div>
    );
  }

  if (!adminAuthenticated) return null;

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <FaChartLine /> },
    { id: "cars", label: "Cars Management", icon: <FaCar /> },
    { id: "rentals", label: "Rentals", icon: <FaFileInvoiceDollar /> },
    { id: "customer-payments", label: "Customer Payments", icon: <FaMoneyBillWave /> },
    { id: "vehicles", label: "Fleet Vehicles", icon: <FaCar /> },
    { id: "drivers", label: "Drivers", icon: <FaUsers /> },
    { id: "payment-ledger", label: "Payment Ledger", icon: <FaMoneyBillWave /> },
    { id: "finance", label: "Income & Expenses", icon: <FaDollarSign /> },
    { id: "services", label: "Service Records", icon: <FaWrench /> },
    { id: "insurance", label: "Insurance", icon: <FaShieldAlt /> },
    { id: "offences", label: "Toll Offences", icon: <FaGavel /> },
    { id: "gps", label: "GPS Devices", icon: <FaCreditCard /> },
    { id: "claims", label: "Insurance Claims", icon: <FaExclamationTriangle /> },
    { id: "install-status", label: "Install Status", icon: <FaCheckCircle /> },
    { id: "contact", label: "Contact Messages", icon: <FaEnvelope /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">OTOBI GO Admin</h1>
        </div>
        <nav className="flex-1 py-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                activeTab === item.id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "dashboard" && <DashboardHome />}
        {activeTab === "cars" && <CarsManagement />}
        {activeTab === "rentals" && <RentalsManagement />}
        {activeTab === "customer-payments" && <CustomerPaymentsManagement />}
        {activeTab === "vehicles" && <VehiclesManagement />}
        {activeTab === "drivers" && <DriversManagement />}
        {activeTab === "payment-ledger" && <PaymentLedgerManagement />}
        {activeTab === "finance" && <FinanceManagement />}
        {activeTab === "services" && <ServicesManagement />}
        {activeTab === "insurance" && <InsuranceManagement />}
        {activeTab === "offences" && <OffencesManagement />}
        {activeTab === "gps" && <GPSManagement />}
        {activeTab === "claims" && <ClaimsManagement />}
        {activeTab === "install-status" && <InstallStatusManagement />}
        {activeTab === "contact" && <ContactMessagesManagement />}
      </div>
    </div>
  );
}

export default AdminDashboard;