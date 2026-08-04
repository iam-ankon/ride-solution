import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaCar,
  FaCalendarAlt,
  FaDollarSign,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaSpinner,
  FaEye,
  FaPrint,
  FaGasPump,
  FaCog,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaTag,
  FaCalendarCheck,
  FaArrowLeft,
  FaInfoCircle,
  FaReceipt,
  FaChartLine,
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
          // Refresh failed, redirect to login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    
    return Promise.reject(error);
  }
);

function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [paymentDataMap, setPaymentDataMap] = useState({});

  // Excel Formula: Total Cost = Car Value + (Interest% × Car Value × Years) + (Ongoing Cost × Total Weeks) + (Service Fee × Total Weeks)
  // Weekly Payment = Total Cost ÷ Total Weeks
  
  const calculateTotalWeeks = (months) => {
    const years = months / 12;
    return Math.ceil(years * 52.1775);
  };

  const calculateRentToOwnTotalContract = (booking) => {
    const carData = booking.car_details || booking.car;
    if (!carData) return parseFloat(booking.total_price) || 0;

    const carValue = parseFloat(carData.car_value) || 0;
    if (carValue === 0) return parseFloat(booking.total_price) || 0;
    
    const months = booking.months || 24;
    const years = months / 12;
    const totalWeeks = calculateTotalWeeks(months);
    
    // Get values from car data
    const interestRate = parseFloat(carData.interest_rate) || 0.095;
    const ongoingCostWeekly = parseFloat(carData.ongoing_cost_weekly) || 79;
    const serviceFeeWeekly = parseFloat(carData.service_fee_weekly) || 55;
    
    // Excel Formula calculations
    const interestTotal = carValue * interestRate * years;
    const ongoingTotal = ongoingCostWeekly * totalWeeks;
    const serviceTotal = serviceFeeWeekly * totalWeeks;
    
    // Total contract = Car Value + Interest + Ongoing Costs + Service Fees
    return carValue + interestTotal + ongoingTotal + serviceTotal;
  };

  const calculateRentToOwnWeekly = (booking) => {
    const totalContract = calculateRentToOwnTotalContract(booking);
    const months = booking.months || 24;
    const totalWeeks = calculateTotalWeeks(months);
    const weeklyPayment = totalWeeks > 0 ? totalContract / totalWeeks : 0;
    return weeklyPayment;
  };

  useEffect(() => {
    checkAuthAndFetchBookings();
  }, []);

  const checkAuthAndFetchBookings = async () => {
    const token = localStorage.getItem("access_token");
    const user = localStorage.getItem("user");
    
    if (!token || !user) {
      navigate("/login");
      return;
    }
    await fetchBookings();
  };

  const fetchBookings = async () => {
    try {
      const response = await apiClient.get(`/api/rentals/user-bookings/`);
      console.log("All Bookings data:", response.data);
      setBookings(response.data);
      await fetchAllPaymentsData(response.data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        setError("Failed to load your bookings. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPaymentsData = async (bookingsList) => {
    const paymentMap = {};

    for (const booking of bookingsList) {
      try {
        const response = await apiClient.get(
          `/api/rentals/${booking.id}/payment-history/`,
        );

        if (response.data.success) {
          paymentMap[booking.id] = response.data.summary;
          console.log(
            `Payment data for ${booking.booking_reference}:`,
            response.data.summary,
          );
        }
      } catch (error) {
        console.error(
          `Error fetching payment data for booking ${booking.id}:`,
          error,
        );
        
        // Calculate using Excel formula for rent-to-own
        let totalDue = 0;
        let totalWeeks = 0;
        
        if (booking.rental_type === "rent_to_own") {
          totalDue = calculateRentToOwnTotalContract(booking);
          totalWeeks = calculateTotalWeeks(booking.months || 24);
        } else {
          totalDue = parseFloat(booking.total_price);
          totalWeeks = booking.weeks || 0;
        }

        paymentMap[booking.id] = {
          total_paid: 0,
          total_due: totalDue,
          remaining_balance: totalDue,
          payment_count: 0,
          remaining_weeks: totalWeeks,
          next_week_number: 1,
          total_weeks: totalWeeks,
          requires_payment: true,
        };
      }
    }

    setPaymentDataMap(paymentMap);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        icon: FaClock,
        text: "Pending Payment",
      },
      confirmed: {
        color: "bg-green-100 text-green-800",
        icon: FaCheckCircle,
        text: "Confirmed",
      },
      active: {
        color: "bg-blue-100 text-blue-800",
        icon: FaCar,
        text: "Active",
      },
      completed: {
        color: "bg-gray-100 text-gray-800",
        icon: FaCheckCircle,
        text: "Completed",
      },
      cancelled: {
        color: "bg-red-100 text-red-800",
        icon: FaTimesCircle,
        text: "Cancelled",
      },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}
      >
        <Icon size={10} /> {config.text}
      </span>
    );
  };

  const getRentalTypeBadge = (type) => {
    const typeConfig = {
      daily: {
        color: "bg-blue-100 text-blue-800",
        text: "Daily Rental (Paid in Full)",
      },
      weekly: { color: "bg-purple-100 text-purple-800", text: "Weekly Rental" },
      rent_to_own: {
        color: "bg-green-100 text-green-800",
        text: "Rent to Own",
      },
    };
    const config = typeConfig[type] || typeConfig.daily;
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}
      >
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const viewBookingDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedBooking(null);
  };

  const printInvoice = () => {
    window.print();
  };

  const getPaymentProgress = (booking) => {
    const paymentData = paymentDataMap[booking.id];

    let totalDue = 0;
    let totalWeeks = 0;
    let weeklyAmount = 0;

    if (booking.rental_type === "rent_to_own") {
      totalDue = calculateRentToOwnTotalContract(booking);
      totalWeeks = calculateTotalWeeks(booking.months || 24);
      weeklyAmount = parseFloat(calculateRentToOwnWeekly(booking));
    } else {
      totalDue = parseFloat(booking.total_price);
      totalWeeks = booking.weeks || 0;
      weeklyAmount = totalWeeks > 0 ? totalDue / totalWeeks : totalDue;
    }

    if (!paymentData) {
      return {
        percentage: 0,
        paid: 0,
        total: totalDue,
        remaining: totalDue,
        paidWeeks: 0,
        totalWeeks: totalWeeks,
        nextWeek: 1,
        weeklyAmount: weeklyAmount,
        remainingWeeks: totalWeeks,
        requiresPayment: totalDue > 0,
      };
    }

    const totalPaid = paymentData.total_paid || 0;
    const percentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
    const paidWeeks = paymentData.payment_count || 0;
    const nextWeek = paidWeeks + 1;
    const remainingBalance = totalDue - totalPaid;

    return {
      percentage: Math.min(percentage, 100),
      paid: totalPaid,
      total: totalDue,
      remaining: remainingBalance,
      paidWeeks: paidWeeks,
      totalWeeks: totalWeeks,
      nextWeek: nextWeek <= totalWeeks ? nextWeek : 0,
      weeklyAmount: weeklyAmount,
      remainingWeeks: totalWeeks - paidWeeks,
      requiresPayment: remainingBalance > 0,
    };
  };

  const requiresRecurringPayment = (booking) => {
    return (
      booking.rental_type === "weekly" || booking.rental_type === "rent_to_own"
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-blue-600 mb-6 transition group"
        >
          <FaArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">My Bookings</h1>
          <p className="text-gray-600 mt-1">
            View and manage your car rental bookings
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🚗</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              No Bookings Yet
            </h2>
            <p className="text-gray-500 mb-6">
              You haven't made any car bookings yet.
            </p>
            <button
              onClick={() => navigate("/cars")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Browse Cars
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const carData = booking.car_details || booking.car;
              const progress = getPaymentProgress(booking);
              const totalWeeksDisplay = booking.rental_type === "rent_to_own" 
                ? calculateTotalWeeks(booking.months || 24)
                : (booking.weeks || 0);

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-xl font-semibold text-gray-800">
                            {carData?.brand} {carData?.name}
                          </h2>
                          {getStatusBadge(booking.status)}
                        </div>
                        <p className="text-gray-500 text-sm mb-3">
                          Booking Reference:{" "}
                          <span className="font-mono">
                            {booking.booking_reference}
                          </span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <FaCalendarAlt className="text-blue-500" />
                            {booking.rental_type === "rent_to_own" ? (
                              <span>
                                {formatDate(booking.start_date)} -{" "}
                                {booking.months} months term ({totalWeeksDisplay} weeks)
                              </span>
                            ) : (
                              <span>
                                {formatDate(booking.start_date)} -{" "}
                                {formatDate(booking.end_date)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <FaDollarSign className="text-green-500" />
                            <span className="font-semibold">
                              $
                              {progress.total.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div>{getRentalTypeBadge(booking.rental_type)}</div>
                          <div className="text-gray-500 text-xs">
                            Booked on: {formatDate(booking.created_at)}
                          </div>
                        </div>

                        {requiresRecurringPayment(booking) && (
                          <div className="mt-2 p-2 bg-green-50 rounded-lg">
                            <div className="text-xs text-green-700">
                              <strong>
                                Weekly payment: $
                                {progress.weeklyAmount.toFixed(2)}
                              </strong>
                              {booking.rental_type === "weekly" && (
                                <span className="ml-2">
                                  for {booking.weeks} weeks
                                </span>
                              )}
                              {booking.rental_type === "rent_to_own" && (
                                <span className="ml-2">
                                  for {progress.totalWeeks} weeks (
                                  {booking.months} months)
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Payment Progress Indicator */}
                        {requiresRecurringPayment(booking) && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <FaChartLine className="text-blue-500" />
                                Payment Progress
                              </span>
                              <span className="text-xs font-semibold text-green-600">
                                {progress.paidWeeks} / {progress.totalWeeks}{" "}
                                weeks paid ($
                                {progress.paid.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                / $
                                {progress.total.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                )
                              </span>
                            </div>
                            <div className="relative">
                              <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
                                <div
                                  style={{ width: `${progress.percentage}%` }}
                                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 transition-all duration-500"
                                ></div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs">
                              {progress.requiresPayment ? (
                                <div className="text-blue-600">
                                  <span className="font-semibold">
                                    Next payment due:
                                  </span>{" "}
                                  Week {progress.nextWeek}
                                  (${progress.weeklyAmount.toFixed(2)})
                                  <br />
                                  <span className="text-gray-500 text-xs">
                                    {progress.remainingWeeks} more payments
                                    remaining (${progress.remaining.toFixed(2)}{" "}
                                    left)
                                  </span>
                                </div>
                              ) : (
                                <div className="text-green-600 font-semibold">
                                  ✓ Fully Paid! All {progress.totalWeeks} weeks
                                  completed.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() =>
                            navigate(`/payment-history/${booking.id}`)
                          }
                          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                        >
                          <FaReceipt /> Payment History
                        </button>
                        <button
                          onClick={() => viewBookingDetails(booking)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                          <FaEye /> View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {showDetails && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  Booking Details
                </h2>
                <button
                  onClick={closeDetails}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500">Booking Reference</p>
                <p className="text-lg font-mono font-semibold">
                  {selectedBooking.booking_reference}
                </p>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaCar /> Car Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {(() => {
                    const carData =
                      selectedBooking.car_details || selectedBooking.car;
                    if (!carData) {
                      return (
                        <p className="text-gray-500">
                          Car details not available
                        </p>
                      );
                    }
                    return (
                      <>
                        <p className="font-medium text-lg">
                          {carData.brand} {carData.name}
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                          <div className="flex items-center gap-2">
                            <FaTag className="text-gray-400" />
                            <span className="font-medium">
                              {carData.model_year || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaGasPump className="text-gray-400" />
                            <span className="font-medium">
                              {carData.fuel_type || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaCog className="text-gray-400" />
                            <span className="font-medium">
                              {carData.transmission || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaUser className="text-gray-400" />
                            <span className="font-medium">
                              {carData.seats || "N/A"} seats
                            </span>
                          </div>
                        </div>
                        {selectedBooking.rental_type === "rent_to_own" &&
                          carData.car_value > 0 && (
                            <div className="mt-3 pt-2 border-t border-gray-200">
                              <div className="flex flex-wrap items-center gap-4 text-xs">
                                <div className="flex items-center gap-1 text-purple-600">
                                  <FaInfoCircle />
                                  <span>Car Value: ${parseFloat(carData.car_value).toLocaleString()}</span>
                                </div>
                                {carData.interest_rate && (
                                  <div className="text-blue-600">
                                    Interest Rate: {(parseFloat(carData.interest_rate) * 100).toFixed(1)}%
                                  </div>
                                )}
                                {carData.ongoing_cost_weekly && (
                                  <div className="text-green-600">
                                    Weekly Ongoing: ${parseFloat(carData.ongoing_cost_weekly)}
                                  </div>
                                )}
                                {carData.service_fee_weekly && (
                                  <div className="text-orange-600">
                                    Service Fee: ${parseFloat(carData.service_fee_weekly)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Customer Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p>
                    <FaUser className="inline mr-2 text-gray-400" />{" "}
                    <strong>Name:</strong> {selectedBooking.customer_name}
                  </p>
                  <p>
                    <FaEnvelope className="inline mr-2 text-gray-400" />{" "}
                    <strong>Email:</strong> {selectedBooking.customer_email}
                  </p>
                  <p>
                    <FaPhone className="inline mr-2 text-gray-400" />{" "}
                    <strong>Phone:</strong> {selectedBooking.customer_phone}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Rental Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <p>
                      <strong>Rental Type:</strong>{" "}
                      {selectedBooking.rental_type?.toUpperCase() || "N/A"}
                    </p>
                    <p>
                      <strong>Status:</strong> {selectedBooking.status || "N/A"}
                    </p>
                    <p>
                      <FaCalendarCheck className="inline mr-2 text-gray-400" />{" "}
                      <strong>Start Date:</strong>{" "}
                      {formatDateTime(selectedBooking.start_date)}
                    </p>
                    {selectedBooking.rental_type === "rent_to_own" ? (
                      <>
                        <p>
                          <FaCalendarCheck className="inline mr-2 text-gray-400" />{" "}
                          <strong>Term:</strong> {selectedBooking.months} months
                          ({calculateTotalWeeks(selectedBooking.months || 24)} weeks)
                        </p>
                        <p>
                          <strong>End Date:</strong>{" "}
                          <span className="text-gray-500">
                            After completing {selectedBooking.months} months of
                            payments
                          </span>
                        </p>
                      </>
                    ) : (
                      <p>
                        <FaCalendarCheck className="inline mr-2 text-gray-400" />{" "}
                        <strong>End Date:</strong>{" "}
                        {formatDateTime(selectedBooking.end_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Payment Summary
                </h3>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Contract:</span>
                    <span className="text-2xl font-bold text-green-600">
                      $
                      {getPaymentProgress(selectedBooking).total.toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                  {requiresRecurringPayment(selectedBooking) && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Payment Type:</span>
                        <span className="font-semibold text-green-600">
                          {selectedBooking.rental_type === "rent_to_own"
                            ? `Weekly Installment - ${getPaymentProgress(selectedBooking).totalWeeks} weeks`
                            : "Weekly Rental Payment"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Weekly Amount:</span>
                        <span className="font-semibold text-green-600">
                          $
                          {getPaymentProgress(
                            selectedBooking,
                          ).weeklyAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Paid So Far:</span>
                        <span className="font-semibold text-blue-600">
                          ${getPaymentProgress(selectedBooking).paid.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Remaining:</span>
                        <span className="font-semibold text-orange-600">
                          $
                          {getPaymentProgress(
                            selectedBooking,
                          ).remaining.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">
                    Special Requests
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-600">
                      {selectedBooking.special_requests}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={printInvoice}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
                >
                  <FaPrint className="inline mr-2" /> Print
                </button>
                <button
                  onClick={() => {
                    closeDetails();
                    navigate(`/payment-history/${selectedBooking.id}`);
                  }}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
                >
                  <FaReceipt /> Payment History
                </button>
                <button
                  onClick={closeDetails}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyBookings;