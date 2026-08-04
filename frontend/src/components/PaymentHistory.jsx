// PaymentHistory.jsx - Updated with Bond Payment option after signup
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaArrowLeft,
  FaCreditCard,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaCar,
  FaReceipt,
  FaChartLine,
  FaExclamationTriangle,
  FaSpinner,
  FaMoneyBillWave,
  FaInfoCircle,
  FaShieldAlt,
  FaCalendarWeek,
  FaFlagCheckered,
  FaUndo,
  FaUserPlus,
  FaMoneyBill,
  FaLock,
} from "react-icons/fa";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
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

function PaymentHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentData, setPaymentData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [bondPayment, setBondPayment] = useState(null);
  const [signupPayment, setSignupPayment] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState("weekly"); // 'bond' or 'weekly'

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
      return;
    }
    
    if (id) {
      fetchPaymentHistory();
    } else {
      setError("No booking ID provided");
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchPaymentHistory = async () => {
    try {
      const response = await apiClient.get(`/api/rentals/${id}/payment-history/`);

      if (response.data && response.data.success) {
        setPaymentData(response.data.summary);
        setPayments(response.data.payments || []);
        setBondPayment(response.data.bond_payment || null);
        setSignupPayment(response.data.signup_payment || null);
      } else {
        setError("No payment data found");
      }
    } catch (err) {
      console.error("Error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(err.message || "Failed to load payment history");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMakeBondPayment = async () => {
    setPaymentType("bond");
    setShowPaymentModal(true);
  };

  const handleMakeWeeklyPayment = async () => {
    setPaymentType("weekly");
    setShowPaymentModal(true);
  };

  const confirmBondPayment = async () => {
    if (!paymentData) return;

    setProcessingPayment(true);
    try {
      const bondAmount = paymentData.bond_amount || 0;

      const response = await apiClient.post(`/api/rentals/${id}/pay-bond/`, {
        amount: bondAmount,
      });

      if (response.data.success) {
        sessionStorage.setItem("last_payment_amount", response.data.amount);
        window.location.href = response.data.session_url;
      } else {
        alert(
          response.data.error ||
            "Failed to create bond payment session. Please try again."
        );
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error("Bond payment error:", error);
      if (error.response?.status === 401) {
        alert("Session expired. Please login again.");
        navigate("/login");
      } else {
        alert("Failed to process bond payment. Please try again.");
      }
      setShowPaymentModal(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  const confirmWeeklyPayment = async () => {
    if (!paymentData) return;

    setProcessingPayment(true);
    try {
      const weeklyAmount = getWeeklyAmount();
      const paymentForWeek = paymentData.next_week_number;

      const response = await apiClient.post(`/api/rentals/${id}/make-payment/`, {
        amount: weeklyAmount,
        payment_for_week: paymentForWeek,
      });

      if (response.data.success) {
        sessionStorage.setItem("last_payment_amount", response.data.amount);
        window.location.href = response.data.session_url;
      } else {
        alert(
          response.data.error ||
            "Failed to create payment session. Please try again."
        );
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      if (error.response?.status === 401) {
        alert("Session expired. Please login again.");
        navigate("/login");
      } else {
        alert("Failed to process payment. Please try again.");
      }
      setShowPaymentModal(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "$0.00";
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };
    const color = colors[status] || "bg-gray-100 text-gray-800";
    const icon = status === 'completed' ? <FaCheckCircle className="mr-1" /> : 
                 status === 'pending' ? <FaClock className="mr-1" /> :
                 status === 'failed' ? <FaTimesCircle className="mr-1" /> : null;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
        {icon} {status?.toUpperCase() || "PENDING"}
      </span>
    );
  };

  const getWeeklyAmount = () => {
    if (payments.length > 0) {
      const completedPayments = payments.filter(p => p.status === 'completed');
      if (completedPayments.length > 0) {
        return completedPayments[0]?.amount || 0;
      }
    }
    if (paymentData?.total_due && paymentData?.total_weeks) {
      return paymentData.total_due / paymentData.total_weeks;
    }
    return 0;
  };

  const getNextPaymentWeek = () => {
    return paymentData?.next_week_number || 1;
  };

  const getCompletedWeeks = () => {
    return paymentData?.payment_count || 0;
  };

  const getTotalWeeks = () => {
    return paymentData?.total_weeks || 0;
  };

  const getProgressPercentage = () => {
    if (!paymentData) return 0;
    if (paymentData.total_due === 0) return 100;
    const percentage = (paymentData.total_paid_weekly / paymentData.total_due) * 100;
    return Math.min(percentage, 100);
  };

  const requiresRecurringPayment = () => {
    return paymentData?.rental_type === "weekly" || paymentData?.rental_type === "rent_to_own";
  };

  const isBondPaid = () => {
    return paymentData?.bond_paid === true;
  };

  const isBondRefunded = () => {
    return bondPayment?.status === 'refunded';
  };

  const getBondAmount = () => {
    return paymentData?.bond_amount || 0;
  };

  const hasBond = () => {
    return getBondAmount() > 0;
  };

  const isSignupPaid = () => {
    return paymentData?.signup_paid === true;
  };

  const getSignupAmount = () => {
    return paymentData?.signup_amount || 0;
  };

  const hasSignup = () => {
    return getSignupAmount() > 0;
  };

  // Check if bond payment is required (signup paid but bond not paid)
  const isBondRequired = () => {
    return hasBond() && !isBondPaid() && isSignupPaid();
  };

  // Check if weekly payments can start (bond paid or no bond required)
  const canStartWeeklyPayments = () => {
    if (hasBond()) {
      return isBondPaid();
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-600 text-5xl mx-auto mb-4" />
          <p className="text-gray-600">Loading payment history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-red-100 border border-red-400 text-red-700 p-6 rounded-lg text-center">
            <FaExclamationTriangle className="text-3xl mx-auto mb-3" />
            <p className="text-lg font-semibold mb-2">Error</p>
            <p>{error}</p>
            <button
              onClick={() => navigate("/my-bookings")}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Go Back to Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600">No payment data available</p>
          <button
            onClick={() => navigate("/my-bookings")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = getProgressPercentage();
  const weeklyAmount = getWeeklyAmount();
  const nextWeek = getNextPaymentWeek();
  const completedWeeks = getCompletedWeeks();
  const totalWeeks = getTotalWeeks();
  const bondPaid = isBondPaid();
  const bondRefunded = isBondRefunded();
  const bondAmount = getBondAmount();
  const hasBondOption = hasBond();
  const signupPaid = isSignupPaid();
  const signupAmount = getSignupAmount();
  const hasSignupOption = hasSignup();
  const bondRequired = isBondRequired();
  const weeklyPaymentsEnabled = canStartWeeklyPayments();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/my-bookings")}
            className="flex items-center text-gray-600 hover:text-blue-600 mb-4 transition"
          >
            <FaArrowLeft className="mr-2" /> Back to My Bookings
          </button>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <FaCar className="text-blue-600 text-2xl" />
              <h1 className="text-2xl font-bold text-gray-800">Payment History</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Booking Reference</p>
                <p className="font-mono font-semibold">{paymentData.booking_reference}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Car</p>
                <p className="font-semibold">{paymentData.car_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rental Type</p>
                <p className="font-semibold capitalize">{paymentData.rental_type?.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-semibold capitalize">{paymentData.rental_status}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signup Fee Status Card */}
        {hasSignupOption && (
          <div className={`mb-6 rounded-xl shadow-lg p-6 ${
            signupPaid 
              ? "bg-gradient-to-r from-green-50 to-green-100 border border-green-400"
              : "bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-400"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <FaUserPlus className={`text-2xl ${
                signupPaid ? "text-green-600" : "text-yellow-600"
              }`} />
              <h2 className="text-xl font-bold text-gray-800">Signup Fee Status</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Signup Fee Amount</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(signupAmount)}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Payment Status</p>
                <div className="mt-2">
                  {signupPaid ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      <FaCheckCircle className="mr-1" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                      <FaClock className="mr-1" /> Pending
                    </span>
                  )}
                </div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Payment Date</p>
                <p className="text-lg font-semibold text-gray-800">
                  {signupPayment?.payment_date ? formatDate(signupPayment.payment_date) : "Not paid yet"}
                </p>
              </div>
            </div>
            
            {signupPaid && (
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <p className="text-green-800 text-sm flex items-center gap-2">
                  <FaCheckCircle className="text-green-600" />
                  Signup fee has been paid. Your booking is confirmed!
                </p>
              </div>
            )}
            
            {!signupPaid && (
              <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                <p className="text-yellow-800 text-sm flex items-center gap-2">
                  <FaClock className="text-yellow-600" />
                  Signup fee payment is pending. Please complete the signup fee payment to confirm your booking.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bond Payment Status Card - Show only if bond exists and signup is paid */}
        {hasBondOption && signupPaid && (
          <div className={`mb-6 rounded-xl shadow-lg p-6 ${
            bondPaid 
              ? bondRefunded 
                ? "bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-400"
                : "bg-gradient-to-r from-green-50 to-green-100 border border-green-400"
              : "bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-400"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <FaShieldAlt className={`text-2xl ${
                bondPaid 
                  ? bondRefunded ? "text-blue-600" : "text-green-600"
                  : "text-purple-600"
              }`} />
              <h2 className="text-xl font-bold text-gray-800">Refundable Bond Status</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Bond Amount</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(bondAmount)}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Payment Status</p>
                <div className="mt-2">
                  {bondPaid ? (
                    bondRefunded ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        <FaUndo className="mr-1" /> Bond Refunded
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        <FaCheckCircle className="mr-1" /> Bond Paid
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                      <FaClock className="mr-1" /> Bond Pending - Pay Now
                    </span>
                  )}
                </div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Payment Date</p>
                <p className="text-lg font-semibold text-gray-800">
                  {bondPayment?.payment_date ? formatDate(bondPayment.payment_date) : "Not paid yet"}
                </p>
              </div>
            </div>
            
            {bondPaid && !bondRefunded && (
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <p className="text-green-800 text-sm flex items-center gap-2">
                  <FaCheckCircle className="text-green-600" />
                  Bond payment has been completed. The bond amount is fully refundable upon vehicle return in good condition.
                </p>
              </div>
            )}
            
            {bondRefunded && (
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-blue-800 text-sm flex items-center gap-2">
                  <FaUndo className="text-blue-600" />
                  Bond has been refunded to your original payment method. Please allow 3-5 business days for the refund to appear.
                </p>
              </div>
            )}
            
            {!bondPaid && (
              <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                <p className="text-purple-800 text-sm flex items-center gap-2">
                  <FaLock className="text-purple-600" />
                  Bond payment is required to activate your booking and start weekly payments.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bond Payment Required Banner - Show when bond needs to be paid */}
        {hasBondOption && signupPaid && !bondPaid && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-400 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <FaShieldAlt className="text-purple-600 text-2xl" />
              <h2 className="text-xl font-bold text-purple-800">Bond Payment Required</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Bond Amount</p>
                <p className="text-3xl font-bold text-purple-600">
                  {formatCurrency(bondAmount)}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Action Required</p>
                <button
                  onClick={handleMakeBondPayment}
                  className="mt-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2 mx-auto"
                >
                  <FaShieldAlt /> Pay Bond Now
                </button>
              </div>
            </div>
            <div className="mt-4 p-3 bg-purple-100 rounded-lg text-center">
              <p className="text-purple-800 text-sm">
                <FaInfoCircle className="inline mr-2" />
                Bond payment is required to activate your booking. Weekly payments will start after bond is paid.
                The bond is fully refundable upon vehicle return.
              </p>
            </div>
          </div>
        )}

        {/* Current Weekly Payment Due - Only show if bond is paid or no bond required */}
        {requiresRecurringPayment() && paymentData.requires_payment && weeklyPaymentsEnabled && (
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <FaCalendarWeek className="text-yellow-600 text-2xl" />
              <h2 className="text-xl font-bold text-yellow-800">Current Weekly Payment Due</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Week Number</p>
                <p className="text-3xl font-bold text-yellow-600">
                  Week {nextWeek} of {totalWeeks}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Weekly Payment Amount</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(weeklyAmount)}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500">Progress</p>
                <p className="text-3xl font-bold text-blue-600">
                  {completedWeeks} / {totalWeeks} weeks
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-100 rounded-lg text-center">
              <p className="text-yellow-800">
                <FaInfoCircle className="inline mr-2" />
                You are about to pay for <strong>Week {nextWeek}</strong> of {totalWeeks} total weeks.
                {totalWeeks - nextWeek > 0 && ` ${totalWeeks - nextWeek} more payments remaining.`}
              </p>
            </div>
          </div>
        )}

        {/* Weekly Payments Locked Message - Show if bond required but not paid */}
        {hasBondOption && signupPaid && !bondPaid && requiresRecurringPayment() && (
          <div className="mb-6 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-400 rounded-xl shadow-lg p-6 text-center">
            <FaLock className="text-gray-500 text-4xl mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">Weekly Payments Locked</h2>
            <p className="text-gray-600">
              Please pay the bond amount first to unlock weekly payments.
            </p>
            <button
              onClick={handleMakeBondPayment}
              className="mt-3 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Pay Bond Now
            </button>
          </div>
        )}

        {/* Completion Message */}
        {requiresRecurringPayment() && !paymentData.requires_payment && bondPaid && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-500 rounded-xl shadow-lg p-6 text-center">
            <FaFlagCheckered className="text-green-600 text-4xl mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-green-700">Congratulations! 🎉</h2>
            <p className="text-green-600 mt-2">
              You have completed all {totalWeeks} weekly payments! The vehicle is now yours.
            </p>
            {hasBondOption && !bondRefunded && (
              <p className="text-blue-600 mt-2 text-sm">
                Your bond of {formatCurrency(bondAmount)} will be refunded within 7-14 business days.
              </p>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-5 text-white">
            <p className="text-sm opacity-90 mb-1">Total Paid</p>
            <p className="text-2xl font-bold">{formatCurrency(paymentData.total_paid)}</p>
            {hasSignupOption && signupPaid && (
              <p className="text-xs opacity-75 mt-1">Includes signup: {formatCurrency(signupAmount)}</p>
            )}
            {hasBondOption && bondPaid && (
              <p className="text-xs opacity-75 mt-1">Includes bond: {formatCurrency(bondAmount)}</p>
            )}
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-5 text-white">
            <p className="text-sm opacity-90 mb-1">Total Contract (Weekly Payments)</p>
            <p className="text-2xl font-bold">{formatCurrency(paymentData.total_due)}</p>
            {hasBondOption && (
              <p className="text-xs opacity-75 mt-1">Excludes refundable bond</p>
            )}
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-5 text-white">
            <p className="text-sm opacity-90 mb-1">Remaining Weekly Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(paymentData.remaining_balance)}</p>
          </div>
        </div>

        {/* Progress Bar - Weekly Payments Only (show only if bond paid) */}
        {totalWeeks > 0 && weeklyPaymentsEnabled && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <FaChartLine className="text-blue-500" />
                Weekly Payment Progress
              </h3>
              <span className="text-sm font-semibold text-green-600">
                {progressPercentage.toFixed(1)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2 text-white text-xs font-bold"
                style={{ width: `${progressPercentage}%` }}
              >
                {progressPercentage > 15 && `${Math.round(progressPercentage)}%`}
              </div>
            </div>
            
            {/* Week markers */}
            {totalWeeks > 0 && (
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>Week 1</span>
                <span>Week {Math.floor(totalWeeks / 4)}</span>
                <span>Week {Math.floor(totalWeeks / 2)}</span>
                <span>Week {Math.floor(totalWeeks * 3 / 4)}</span>
                <span>Week {totalWeeks}</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-xs text-gray-500">Weekly Payments Made</p>
                <p className="text-lg font-semibold">{completedWeeks}</p>
              </div>
              {hasBondOption && (
                <div>
                  <p className="text-xs text-gray-500">Bond Status</p>
                  <p className="text-lg font-semibold">
                    {bondPaid ? (bondRefunded ? "Refunded" : "Paid") : "Pending"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Weekly Amount</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(weeklyAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Next Week Due</p>
                <p className="text-lg font-semibold text-yellow-600">
                  Week {nextWeek}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Weeks Left</p>
                <p className="text-lg font-semibold">{totalWeeks - completedWeeks}</p>
              </div>
            </div>
          </div>
        )}

        {/* Signup Payment Details Table */}
        {hasSignupOption && signupPayment && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <FaUserPlus className="text-green-500" />
                Signup Fee Payment Details
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FaUserPlus className="text-green-500" />
                        <span className="font-semibold">Signup Fee</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{signupPayment.payment_reference}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(signupPayment.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-green-600">
                        {formatCurrency(signupPayment.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(signupPayment.status)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bond Payment Details Table */}
        {hasBondOption && bondPayment && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <FaShieldAlt className="text-blue-500" />
                Bond Payment Details
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FaShieldAlt className="text-blue-500" />
                        <span className="font-semibold">Refundable Bond</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{bondPayment.payment_reference}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(bondPayment.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(bondPayment.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(bondPayment.status)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Weekly Payments Table - Show only if weekly payments are enabled */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaReceipt className="text-blue-500" />
              Weekly Payment Transactions
              <span className="text-sm text-gray-500 ml-2">({payments.length} records)</span>
            </h3>
          </div>

          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <FaCreditCard className="text-gray-300 text-5xl mx-auto mb-3" />
              <p className="text-gray-500">No weekly payments have been made yet.</p>
              {hasBondOption && !bondPaid && signupPaid && (
                <p className="text-gray-400 text-sm mt-2">Bond payment required before weekly payments start.</p>
              )}
              {!signupPaid && (
                <p className="text-gray-400 text-sm mt-2">Signup fee payment required first.</p>
              )}
              {(!hasBondOption || bondPaid) && signupPaid && (
                <button
                  onClick={handleMakeWeeklyPayment}
                  className="mt-4 bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition"
                >
                  Make First Weekly Payment
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment, idx) => {
                    const isCurrentWeek = payment.payment_for_week === nextWeek && payment.status === 'pending';
                    const isUpcoming = payment.payment_for_week > nextWeek;
                    
                    return (
                      <tr key={payment.id || idx} className={`hover:bg-gray-50 ${isCurrentWeek ? 'bg-yellow-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <FaMoneyBillWave className={`${isCurrentWeek ? 'text-yellow-600' : 'text-gray-400'}`} />
                            <span className={`font-semibold ${isCurrentWeek ? 'text-yellow-700' : ''}`}>
                              Week {payment.payment_for_week || idx + 1}
                              {isCurrentWeek && " (Current)"}
                              {isUpcoming && " (Upcoming)"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{payment.payment_reference}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-semibold ${isCurrentWeek ? 'text-yellow-600' : 'text-green-600'}`}>
                            {formatCurrency(payment.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(payment.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mt-6">
          <button
            onClick={() => navigate("/my-bookings")}
            className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition font-semibold"
          >
            Back to Bookings
          </button>
          
          {/* Bond Payment Button - Show if bond exists and not paid yet */}
          {hasBondOption && signupPaid && !bondPaid && (
            <button
              onClick={handleMakeBondPayment}
              className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-semibold flex items-center justify-center gap-2"
            >
              <FaShieldAlt /> Pay Bond - {formatCurrency(bondAmount)}
            </button>
          )}
          
          {/* Weekly Payment Button - Show if weekly payments are enabled and balance > 0 */}
          {requiresRecurringPayment() && paymentData.requires_payment && weeklyPaymentsEnabled && paymentData.remaining_balance > 0 && (
            <button
              onClick={handleMakeWeeklyPayment}
              className="flex-1 bg-yellow-600 text-white py-3 rounded-lg hover:bg-yellow-700 transition font-semibold flex items-center justify-center gap-2 text-lg"
            >
              <FaMoneyBillWave /> Pay Week {nextWeek} - {formatCurrency(weeklyAmount)}
            </button>
          )}
        </div>
      </div>

      {/* Payment Modal - Bond Payment */}
      {showPaymentModal && paymentType === "bond" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FaShieldAlt className="text-purple-600 text-3xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Confirm Bond Payment</h2>
              <p className="text-gray-600 mt-1">
                You are about to pay the refundable bond
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking Reference:</span>
                  <span className="font-mono font-semibold">{paymentData.booking_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Car:</span>
                  <span className="font-semibold">{paymentData.car_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Type:</span>
                  <span className="font-semibold text-purple-600">Refundable Bond</span>
                </div>
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-semibold">Bond Amount:</span>
                    <span className="text-3xl font-bold text-purple-600">
                      {formatCurrency(bondAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <FaInfoCircle />
                <span>This bond is fully refundable upon vehicle return in good condition.</span>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 mb-4 text-sm text-green-800">
              <div className="flex items-center gap-2">
                <FaCreditCard />
                <span>You will be redirected to Stripe for secure payment</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmBondPayment}
                disabled={processingPayment}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
              >
                {processingPayment ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaShieldAlt />
                    Pay Bond - {formatCurrency(bondAmount)}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 py-3 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal - Weekly Payment */}
      {showPaymentModal && paymentType === "weekly" && paymentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FaCalendarWeek className="text-yellow-600 text-3xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Confirm Weekly Payment</h2>
              <p className="text-gray-600 mt-1">
                You are about to pay for <strong className="text-yellow-600">Week {nextWeek}</strong>
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking Reference:</span>
                  <span className="font-mono font-semibold">{paymentData.booking_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Car:</span>
                  <span className="font-semibold">{paymentData.car_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Week:</span>
                  <span className="font-semibold text-yellow-600 text-lg">Week {nextWeek} of {totalWeeks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-semibold">{completedWeeks} weeks paid, {totalWeeks - completedWeeks} remaining</span>
                </div>
                {hasBondOption && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bond Status:</span>
                    <span className="font-semibold text-green-600">Paid ✓</span>
                  </div>
                )}
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-semibold">Weekly Amount Due:</span>
                    <span className="text-3xl font-bold text-green-600">
                      {formatCurrency(weeklyAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <FaCreditCard />
                <span>You will be redirected to Stripe for secure payment</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmWeeklyPayment}
                disabled={processingPayment}
                className="flex-1 bg-yellow-600 text-white py-3 rounded-lg hover:bg-yellow-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
              >
                {processingPayment ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaCreditCard />
                    Pay Week {nextWeek} - {formatCurrency(weeklyAmount)}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 py-3 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentHistory;