// CarDetails.jsx - Shows disabled options (grayed out) instead of removing them
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  FaGasPump,
  FaUsers,
  FaCog,
  FaSuitcase,
  FaArrowLeft,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarDay,
  FaCalendarWeek,
  FaHome,
  FaCheckCircle,
  FaInfoCircle,
  FaCalendarAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaStar,
  FaShieldAlt,
  FaHeadset,
  FaClock,
  FaCar,
  FaMoneyBillWave,
  FaCreditCard,
  FaCalculator,
  FaSync,
  FaMoneyBill,
  FaUndo,
  FaQuestionCircle,
  FaUserPlus,
  FaLock,
} from "react-icons/fa";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

function CarDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showSignupInfo, setShowSignupInfo] = useState(false);
  const [showBondInfo, setShowBondInfo] = useState(false);

  // Rental options state
  const [selectedRentalType, setSelectedRentalType] = useState("daily");
  const [rentalDays, setRentalDays] = useState(3);
  const [rentalWeeks, setRentalWeeks] = useState(4);
  const [rentalMonthsRTO, setRentalMonthsRTO] = useState(60); // Default to 5 years for RTO
  const [calculatedPrice, setCalculatedPrice] = useState(0);

  // Date availability state
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [bookedRanges, setBookedRanges] = useState([]);
  const [stockInfo, setStockInfo] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialRequests: "",
  });

  // RTO month options: 3-7 years (36, 48, 60, 72, 84 months)
  const rtoMonthOptions = [36, 48, 60, 72, 84];
  const rtoYearLabels = {
    36: "3 Years",
    48: "4 Years", 
    60: "5 Years",
    72: "6 Years",
    84: "7 Years"
  };

  // Get admin settings for each rental type
  const isDailyEnabled = car?.short_term_available === true;
  const isWeeklyEnabled = car?.long_term_available === true;
  const isRTOEnabled = car?.rent_to_own_available === true;

  // Check if ANY option is enabled (for showing the section at all)
  const hasAnyEnabledOption = isDailyEnabled || isWeeklyEnabled || isRTOEnabled;

  // Rent-to-Own calculation functions
  const calculateTotalWeeks = useCallback((months) => {
    const years = months / 12;
    return Math.ceil(years * 52.1775);
  }, []);

  const calculateInterestTotal = useCallback((carValue, years) => {
    const interestRate = parseFloat(car?.interest_rate) || 0.095;
    return carValue * interestRate * years;
  }, [car]);

  const calculateOngoingTotal = useCallback((totalWeeks) => {
    const ongoingCostWeekly = parseFloat(car?.ongoing_cost_weekly) || 79;
    return ongoingCostWeekly * totalWeeks;
  }, [car]);

  const calculateServiceFeeTotal = useCallback((totalWeeks) => {
    const serviceFeeWeekly = parseFloat(car?.service_fee_weekly) || 55;
    return serviceFeeWeekly * totalWeeks;
  }, [car]);

  const calculateDynamicTotalCost = useCallback(() => {
    if (!car || !car.car_value || parseFloat(car.car_value) <= 0) return 0;

    const carValue = parseFloat(car.car_value) || 0;
    const years = rentalMonthsRTO / 12;
    const totalWeeks = calculateTotalWeeks(rentalMonthsRTO);

    const interestTotal = calculateInterestTotal(carValue, years);
    const ongoingTotal = calculateOngoingTotal(totalWeeks);
    const serviceTotal = calculateServiceFeeTotal(totalWeeks);

    return carValue + interestTotal + ongoingTotal + serviceTotal;
  }, [car, rentalMonthsRTO, calculateTotalWeeks, calculateInterestTotal, calculateOngoingTotal, calculateServiceFeeTotal]);

  const getRentToOwnWeeklyPrice = useCallback(() => {
    if (!car || !car.car_value || parseFloat(car.car_value) <= 0) return "0.00";
    const totalCost = calculateDynamicTotalCost();
    const totalWeeks = calculateTotalWeeks(rentalMonthsRTO);
    const weeklyPayment = totalCost / totalWeeks;
    return weeklyPayment.toFixed(2);
  }, [car, rentalMonthsRTO, calculateDynamicTotalCost, calculateTotalWeeks]);

  const getTotalWeeks = useCallback(() => {
    return calculateTotalWeeks(rentalMonthsRTO);
  }, [rentalMonthsRTO, calculateTotalWeeks]);

  const getInterestRateDisplay = () => {
    if (!car) return "9.5";
    const rate = parseFloat(car.interest_rate) || 0.095;
    return (rate * 100).toFixed(1);
  };

  // Get signup fee
  const getSignupFee = () => {
    return parseFloat(car?.signup_fee) || 0;
  };

  const hasSignupFee = () => {
    return getSignupFee() > 0;
  };

  // Get bond amount
  const getBondAmount = () => {
    return parseFloat(car?.bond_amount) || 0;
  };

  const hasBond = () => {
    return getBondAmount() > 0;
  };

  // Upfront payment is just the signup fee
  const getUpfrontPayment = () => {
    return getSignupFee();
  };

  const fetchCarDetails = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);

      const timestamp = new Date().getTime();
      const response = await axios.get(`${API_URL}/api/cars/${id}/`, {
        params: { t: timestamp },
        withCredentials: true,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });

      setCar(response.data);
      console.log("Car data loaded:", response.data);
      console.log("Rental options - Daily:", response.data.short_term_available);
      console.log("Rental options - Weekly:", response.data.long_term_available);
      console.log("Rental options - RTO:", response.data.rent_to_own_available);

      const urls = [];
      if (response.data.images && Array.isArray(response.data.images) && response.data.images.length > 0) {
        response.data.images.forEach((img) => {
          const imagePath = img.image_url || img.image;
          if (imagePath) {
            let fullUrl;
            if (imagePath.startsWith("http")) {
              fullUrl = imagePath;
            } else if (imagePath.startsWith("/media")) {
              fullUrl = `${API_URL}${imagePath}`;
            } else if (imagePath.startsWith("/")) {
              fullUrl = `${API_URL}${imagePath}`;
            } else {
              fullUrl = `${API_URL}/media/${imagePath}`;
            }
            urls.push(fullUrl);
          }
        });
      }

      if (urls.length === 0 && response.data.main_image) {
        let fullUrl;
        if (response.data.main_image.startsWith("http")) {
          fullUrl = response.data.main_image;
        } else {
          fullUrl = `${API_URL}${response.data.main_image}`;
        }
        urls.push(fullUrl);
      }

      setImages(urls);
    } catch (error) {
      console.error("Error fetching car details:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await fetchCarDetails(true);
    await fetchStockInfo();
    await fetchBookedRanges();
  };

  useEffect(() => {
    fetchCarDetails();
  }, [id]);

  useEffect(() => {
    if (car) {
      fetchStockInfo();
      fetchBookedRanges();
      
      // Set default rental type to the first enabled option
      if (isRTOEnabled) {
        setSelectedRentalType("rent_to_own");
      } else if (isWeeklyEnabled) {
        setSelectedRentalType("weekly");
      } else if (isDailyEnabled) {
        setSelectedRentalType("daily");
      }
    }
  }, [car]);

  const fetchStockInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars/${id}/check_availability/`, {
        withCredentials: true,
      });
      setStockInfo(response.data);
    } catch (error) {
      console.error("Error fetching stock info:", error);
    }
  };

  const fetchBookedRanges = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars/${id}/booked_date_ranges/`, {
        withCredentials: true,
      });
      setBookedRanges(response.data.booked_ranges || []);
    } catch (error) {
      console.error("Error fetching booked ranges:", error);
      setBookedRanges([]);
    }
  };

  useEffect(() => {
    if (!car) return;

    let price = 0;
    if (selectedRentalType === "daily") {
      price = (parseFloat(car.daily_price) || 0) * rentalDays;
    } else if (selectedRentalType === "weekly") {
      const weeklyRate = parseFloat(car.weekly_price) || 0;
      price = weeklyRate * rentalWeeks; // Total for all weeks
    } else if (selectedRentalType === "rent_to_own") {
      price = parseFloat(getRentToOwnWeeklyPrice());
    }
    setCalculatedPrice(price);
  }, [car, selectedRentalType, rentalDays, rentalWeeks, rentalMonthsRTO, getRentToOwnWeeklyPrice]);

  useEffect(() => {
    if (startDate && selectedRentalType !== "rent_to_own") {
      let newEndDate = null;
      if (selectedRentalType === "daily" && rentalDays > 0) {
        newEndDate = new Date(startDate);
        newEndDate.setDate(startDate.getDate() + rentalDays);
      } else if (selectedRentalType === "weekly" && rentalWeeks > 0) {
        newEndDate = new Date(startDate);
        newEndDate.setDate(startDate.getDate() + (rentalWeeks * 7));
      }
      setEndDate(newEndDate);
    }
  }, [startDate, rentalDays, rentalWeeks, selectedRentalType]);

  const isDateRangeBooked = (start, end) => {
    if (!start || !end) return false;

    const startTime = start.getTime();
    const endTime = end.getTime();

    for (const range of bookedRanges) {
      const rangeStart = new Date(range.start).getTime();
      const rangeEnd = new Date(range.end).getTime();

      if (startTime < rangeEnd && endTime > rangeStart) {
        return true;
      }
    }
    return false;
  };

  const isDateBooked = (date) => {
    if (!date) return false;

    const dateTime = date.getTime();

    for (const range of bookedRanges) {
      const rangeStart = new Date(range.start).getTime();
      const rangeEnd = new Date(range.end).getTime();

      if (dateTime >= rangeStart && dateTime <= rangeEnd) {
        return true;
      }
    }
    return false;
  };

  const getWeeklySavings = () => {
    if (!car || selectedRentalType !== "weekly") return 0;
    const dailyRate = parseFloat(car.daily_price) || 0;
    const weeklyRate = parseFloat(car.weekly_price) || 0;
    return (dailyRate * 7 - weeklyRate).toFixed(2);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const nextImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleStartDateChange = (date) => {
    setStartDate(date);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (selectedRentalType !== "rent_to_own" && endDate) {
        if (isDateRangeBooked(startDate, endDate)) {
          alert("❌ Sorry, these dates are no longer available. Please select different dates.");
          setIsSubmitting(false);
          return;
        }
      }

      let weeklyPriceValue = 0;
      const signupFeeValue = getSignupFee();
      const bondAmountValue = getBondAmount();
      
      // Total upfront payment is just the signup fee
      const totalUpfrontPayment = signupFeeValue;

      if (selectedRentalType === "weekly") {
        weeklyPriceValue = parseFloat(car.weekly_price) || 0;
      } else if (selectedRentalType === "rent_to_own") {
        weeklyPriceValue = calculatedPrice;
      }

      const bookingData = {
        rental_type: selectedRentalType,
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        start_date: startDate.toISOString(),
        end_date: (selectedRentalType !== "rent_to_own" && endDate) ? endDate.toISOString() : null,
        days: selectedRentalType === "daily" ? rentalDays : 0,
        weeks: selectedRentalType === "weekly" ? rentalWeeks : 0,
        months: selectedRentalType === "rent_to_own" ? rentalMonthsRTO : 0,
        total_price: totalUpfrontPayment,
        weekly_price: weeklyPriceValue,
        special_requests: formData.specialRequests,
        signup_fee: signupFeeValue,
        pay_signup_fee: hasSignupFee(),
        bond_amount: bondAmountValue,
        pay_bond: false,
      };

      console.log("=== SENDING BOOKING DATA (SIGNUP FEE ONLY) ===");
      console.log("Rental Type:", selectedRentalType);
      console.log("Weekly Price:", weeklyPriceValue);
      console.log("Signup Fee:", signupFeeValue);
      console.log("Upfront Payment:", totalUpfrontPayment);

      const response = await axios.post(
        `${API_URL}/api/cars/${id}/create_checkout_session/`,
        bookingData,
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true
        },
      );

      if (response.data.success) {
        sessionStorage.setItem(
          "pendingBooking",
          JSON.stringify({
            bookingReference: response.data.booking_reference,
            carName: `${car.brand} ${car.name}`,
            carId: car.id,
            rentalType: selectedRentalType,
            customerName: formData.name,
            customerEmail: formData.email,
            customerPhone: formData.phone,
            startDate: startDate.toISOString(),
            endDate: endDate ? endDate.toISOString() : null,
            weeklyPrice: weeklyPriceValue,
            initialPayment: response.data.initial_payment,
            totalContract: response.data.total_contract,
            signupFee: signupFeeValue,
            bondAmount: bondAmountValue,
          }),
        );

        setShowBookingForm(false);
        setFormData({ name: "", email: "", phone: "", specialRequests: "" });

        window.location.href = response.data.session_url;
      } else {
        alert("❌ Failed to create checkout session. Please try again.");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      if (error.response) {
        alert(`❌ Booking Failed\n\n${error.response.data.error || "Please try again"}`);
      } else if (error.request) {
        alert("❌ No response from server. Please check your connection.");
      } else {
        alert("❌ Network error. Please check your connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading car details...</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaExclamationTriangle className="text-6xl text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl text-red-600 mb-4">Car not found</h2>
          <button
            onClick={() => navigate("/cars")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Back to Cars
          </button>
        </div>
      </div>
    );
  }

  const dailyPrice = parseFloat(car.daily_price) || 0;
  const weeklyPrice = parseFloat(car.weekly_price) || 0;
  const carValue = parseFloat(car.car_value) || 0;
  const signupFee = getSignupFee();
  const bondAmount = getBondAmount();
  const hasSignupFeeOption = hasSignupFee();
  const upfrontPayment = getUpfrontPayment();

  const totalWeeks = getTotalWeeks();
  const totalContract = calculateDynamicTotalCost();
  const interestTotal = carValue * (parseFloat(car.interest_rate) || 0.095) * (rentalMonthsRTO / 12);
  const ongoingTotal = (parseFloat(car.ongoing_cost_weekly) || 79) * totalWeeks;
  const serviceTotal = (parseFloat(car.service_fee_weekly) || 55) * totalWeeks;

  // Check if booking is disabled (no start date or no enabled options)
  const isBookingDisabled = !startDate || !hasAnyEnabledOption;

  const formatDate = (date) => {
    if (!date) return "Not selected";
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helper to get option button classes (disabled styling)
  const getOptionButtonClass = (optionType, isEnabled) => {
    const isSelected = selectedRentalType === optionType;
    
    if (!isEnabled) {
      return "p-3 md:p-4 rounded-xl border-2 border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed";
    }
    
    if (isSelected) {
      return "p-3 md:p-4 rounded-xl border-2 border-blue-600 bg-blue-50 shadow-md transform scale-[1.02] cursor-pointer";
    }
    
    return "p-3 md:p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-4 md:py-8 pb-32 md:pb-8">
        {/* Header with Back and Refresh */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4 md:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition group bg-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md text-sm md:text-base"
          >
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Back to Cars</span>
            <span className="sm:hidden">Back</span>
          </button>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md text-gray-600 hover:text-blue-600 text-sm md:text-base"
          >
            <FaSync className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
          {/* Left Column - Image Gallery */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden sticky top-20">
              <div className="relative bg-gradient-to-r from-gray-800 to-gray-900" style={{ height: "350px", minHeight: "350px" }}>
                {images.length > 0 ? (
                  <img
                    src={images[currentImageIndex]}
                    alt={`${car.brand} ${car.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FaCar className="text-6xl text-gray-500" />
                  </div>
                )}

                {stockInfo && (
                  <div className={`absolute top-3 left-3 md:top-4 md:left-4 inline-flex items-center gap-1 md:gap-2 px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-medium shadow-lg ${stockInfo.available_units > 0
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                    }`}>
                    <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white`}></div>
                    {stockInfo.available_units > 0 ? `${stockInfo.available_units} Available` : "Out of Stock"}
                  </div>
                )}

                {car.featured && (
                  <span className="absolute top-3 right-3 md:top-4 md:right-4 bg-yellow-100 text-yellow-800 px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                    <FaStar size={10} className="md:text-xs" /> Featured
                  </span>
                )}

                {hasSignupFeeOption && (
                  <div className="absolute bottom-3 left-3 bg-green-600 text-white px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                    <FaUserPlus size={10} /> Signup: ${signupFee}
                  </div>
                )}

                {hasBond() && (
                  <div className="absolute bottom-3 left-36 bg-blue-600 text-white px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                    <FaShieldAlt size={10} /> Bond: ${bondAmount}
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition"
                    >
                      <FaChevronLeft size={16} className="md:text-xl" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition"
                    >
                      <FaChevronRight size={16} className="md:text-xl" />
                    </button>
                  </>
                )}

                {images.length > 1 && (
                  <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-black bg-opacity-60 text-white px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="p-2 md:p-4 border-t overflow-x-auto bg-gray-50">
                  <div className="flex gap-1 md:gap-2 justify-center">
                    {images.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 w-14 h-14 md:w-20 md:h-20 rounded-lg overflow-hidden transition-all ${currentImageIndex === index
                          ? "ring-2 ring-blue-600 scale-95 shadow-lg"
                          : "opacity-60 hover:opacity-100"
                          }`}
                      >
                        <img
                          src={img}
                          alt={`${car.name} view ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Car Details */}
          <div className="lg:col-span-5">
            <div className="space-y-4 md:space-y-6">
              {/* Title Card */}
              <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                <h1 className="text-xl md:text-3xl font-bold text-gray-800">
                  {car.brand} {car.name}
                </h1>
                <p className="text-gray-500 text-sm md:text-base mt-1">
                  {car.model_year || "2024"}
                </p>
              </div>

              {/* Signup Fee Card */}
              {hasSignupFeeOption && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-lg p-4 md:p-6 border border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <FaUserPlus className="text-green-600 text-xl md:text-2xl" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm md:text-base">Signup Fee (Pay Upfront)</h3>
                        <p className="text-2xl md:text-3xl font-bold text-green-600">${signupFee}</p>
                        <p className="text-xs text-gray-500 mt-1">Non-refundable booking fee</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSignupInfo(!showSignupInfo)}
                      className="text-green-500 hover:text-green-700"
                    >
                      <FaQuestionCircle size={18} />
                    </button>
                  </div>

                  {showSignupInfo && (
                    <div className="mt-3 p-3 bg-white rounded-lg text-sm">
                      <p className="text-gray-700">{car.signup_fee_description || "Signup fee covers booking processing and administrative costs. This fee is non-refundable."}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Bond Info Card - Show if bond exists */}
              {hasBond() && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-4 md:p-6 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <FaMoneyBill className="text-blue-600 text-xl md:text-2xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm md:text-base">Refundable Bond</h3>
                      <p className="text-2xl md:text-3xl font-bold text-blue-600">${bondAmount}</p>
                      <p className="text-xs text-gray-500 mt-1">Pay after signup in Payment History</p>
                      <p className="text-xs text-green-600 mt-1">Fully refundable upon return</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rental Options Card - Shows ALL options (enabled and disabled) */}
              {hasAnyEnabledOption && (
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
                    <FaMoneyBillWave className="text-green-500" />
                    Rental Options
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    {/* Daily Option - shows always with disabled styling if not available */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isDailyEnabled) {
                          setSelectedRentalType("daily");
                          setRentalDays(3);
                        }
                      }}
                      disabled={!isDailyEnabled}
                      className={getOptionButtonClass("daily", isDailyEnabled)}
                      title={!isDailyEnabled ? "Daily rental is currently unavailable for this vehicle" : "Daily rental option"}
                    >
                      <FaCalendarDay className={`mx-auto mb-1 md:mb-2 text-xl md:text-2xl ${isDailyEnabled ? "text-blue-500" : "text-gray-400"}`} />
                      <div className="font-semibold text-xs md:text-sm flex items-center justify-center gap-1">
                        Short Term
                        {!isDailyEnabled && <FaLock size={10} className="text-gray-400" />}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Daily Rental</div>
                      <div className="text-base md:text-lg font-bold text-green-600 mt-1 md:mt-2">
                        ${dailyPrice}<span className="text-xs font-normal">/day</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Min 3 days</div>
                      {!isDailyEnabled && (
                        <div className="text-xs text-red-500 mt-2">Currently Unavailable</div>
                      )}
                    </button>
                    
                    {/* Weekly Option - shows always with disabled styling if not available */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isWeeklyEnabled) {
                          setSelectedRentalType("weekly");
                          setRentalWeeks(4);
                        }
                      }}
                      disabled={!isWeeklyEnabled}
                      className={getOptionButtonClass("weekly", isWeeklyEnabled)}
                      title={!isWeeklyEnabled ? "Weekly rental is currently unavailable for this vehicle" : "Weekly rental option"}
                    >
                      <FaCalendarWeek className={`mx-auto mb-1 md:mb-2 text-xl md:text-2xl ${isWeeklyEnabled ? "text-purple-500" : "text-gray-400"}`} />
                      <div className="font-semibold text-xs md:text-sm flex items-center justify-center gap-1">
                        Long Term
                        {!isWeeklyEnabled && <FaLock size={10} className="text-gray-400" />}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Weekly Rental</div>
                      <div className="text-base md:text-lg font-bold text-green-600 mt-1 md:mt-2">
                        ${weeklyPrice}<span className="text-xs font-normal">/wk</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Min 4 weeks</div>
                      {!isWeeklyEnabled && (
                        <div className="text-xs text-red-500 mt-2">Currently Unavailable</div>
                      )}
                    </button>
                    
                    {/* Rent to Own Option - shows always with disabled styling if not available */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isRTOEnabled) {
                          setSelectedRentalType("rent_to_own");
                        }
                      }}
                      disabled={!isRTOEnabled}
                      className={getOptionButtonClass("rent_to_own", isRTOEnabled)}
                      title={!isRTOEnabled ? "Rent to own is currently unavailable for this vehicle" : "Rent to own option"}
                    >
                      <FaHome className={`mx-auto mb-1 md:mb-2 text-xl md:text-2xl ${isRTOEnabled ? "text-orange-500" : "text-gray-400"}`} />
                      <div className="font-semibold text-xs md:text-sm flex items-center justify-center gap-1">
                        Rent to Own
                        {!isRTOEnabled && <FaLock size={10} className="text-gray-400" />}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Own the car</div>
                      <div className="text-base md:text-lg font-bold text-green-600 mt-1 md:mt-2">
                        ${getRentToOwnWeeklyPrice()}<span className="text-xs font-normal">/wk</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">3-7 years term</div>
                      {!isRTOEnabled && (
                        <div className="text-xs text-red-500 mt-2">Currently Unavailable</div>
                      )}
                    </button>
                  </div>
                  
                  {/* Info message when selected option is disabled */}
                  {selectedRentalType === "daily" && !isDailyEnabled && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-center">
                      <p className="text-yellow-700 text-sm flex items-center justify-center gap-2">
                        <FaLock size={14} /> Daily rental is currently unavailable. Please select another option.
                      </p>
                    </div>
                  )}
                  {selectedRentalType === "weekly" && !isWeeklyEnabled && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-center">
                      <p className="text-yellow-700 text-sm flex items-center justify-center gap-2">
                        <FaLock size={14} /> Weekly rental is currently unavailable. Please select another option.
                      </p>
                    </div>
                  )}
                  {selectedRentalType === "rent_to_own" && !isRTOEnabled && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-center">
                      <p className="text-yellow-700 text-sm flex items-center justify-center gap-2">
                        <FaLock size={14} /> Rent to own is currently unavailable. Please select another option.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Rental Details / RTO Calculator - Only show if selected option is enabled */}
              {selectedRentalType === "rent_to_own" && isRTOEnabled && (
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                  <div className="flex justify-between items-center mb-3 md:mb-4">
                    <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                      <FaCalculator className="text-orange-500" />
                      Payment Calculator
                    </h3>
                    <button
                      onClick={() => setShowCalculator(!showCalculator)}
                      className="text-blue-600 text-xs md:text-sm font-medium"
                    >
                      {showCalculator ? "Hide" : "Details"}
                    </button>
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="block font-medium text-sm mb-2 text-gray-700">Payment Term (3-7 Years)</label>
                      <div className="grid grid-cols-5 gap-1 md:gap-2">
                        {rtoMonthOptions.map((months) => (
                          <button
                            key={months}
                            onClick={() => setRentalMonthsRTO(months)}
                            className={`py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${rentalMonthsRTO === months
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                          >
                            {rtoYearLabels[months]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div className="bg-green-50 rounded-lg p-2 md:p-3 text-center">
                        <p className="text-xs text-gray-500">Weekly Payment</p>
                        <p className="text-lg md:text-xl font-bold text-green-600">${getRentToOwnWeeklyPrice()}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 md:p-3 text-center">
                        <p className="text-xs text-gray-500">Total Weeks</p>
                        <p className="text-lg md:text-xl font-bold text-blue-600">{totalWeeks}</p>
                      </div>
                    </div>

                    {showCalculator && (
                      <div className="mt-2 md:mt-3 p-2 md:p-3 bg-gray-50 rounded-xl">
                        <p className="font-semibold text-gray-800 text-xs md:text-sm mb-2">Breakdown</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Car Value:</span>
                            <span className="font-medium">${carValue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Interest ({getInterestRateDisplay()}%):</span>
                            <span className="font-medium">${interestTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Rego/Insurance:</span>
                            <span className="font-medium">${ongoingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Service Fees:</span>
                            <span className="font-medium">${serviceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="border-t pt-1 mt-1 flex justify-between font-bold">
                            <span>Total Contract:</span>
                            <span className="text-green-600">${totalContract.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rental Details for Daily/Weekly - Only show if selected option is enabled */}
              {(selectedRentalType === "daily" && isDailyEnabled) || (selectedRentalType === "weekly" && isWeeklyEnabled) ? (
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
                    <FaCreditCard className="text-blue-500" />
                    Rental Details
                  </h3>

                  {selectedRentalType === "daily" && isDailyEnabled && (
                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <label className="block font-semibold mb-2 text-gray-700 text-sm md:text-base">Number of Days</label>
                        <input
                          type="range"
                          min="3"
                          max="30"
                          value={rentalDays}
                          onChange={(e) => setRentalDays(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs md:text-sm text-gray-600 mt-1">
                          <span>3 days</span>
                          <span className="font-bold text-blue-600">{rentalDays} days</span>
                          <span>30 days</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRentalType === "weekly" && isWeeklyEnabled && (
                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <label className="block font-semibold mb-2 text-gray-700 text-sm md:text-base">Number of Weeks</label>
                        <input
                          type="range"
                          min="4"
                          max="52"
                          value={rentalWeeks}
                          onChange={(e) => setRentalWeeks(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs md:text-sm text-gray-600 mt-1">
                          <span>4 weeks</span>
                          <span className="font-bold text-blue-600">{rentalWeeks} weeks</span>
                          <span>52 weeks</span>
                        </div>
                      </div>
                      {getWeeklySavings() > 0 && (
                        <div className="p-2 md:p-3 bg-green-50 rounded-lg text-xs md:text-sm text-green-700">
                          <FaCheckCircle className="inline mr-1 md:mr-2" />
                          Save ${getWeeklySavings()} per week vs daily rate!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price Summary - FIXED to show weekly rate vs total price */}
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 md:p-4">
                      <div className="space-y-2">
                        {selectedRentalType === "daily" && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Daily Rate:</span>
                              <span className="font-semibold text-gray-800">
                                ${dailyPrice.toLocaleString()}/day
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total for {rentalDays} days:</span>
                              <span className="font-semibold text-gray-800">
                                ${calculatedPrice.toLocaleString()}
                              </span>
                            </div>
                          </>
                        )}

                        {selectedRentalType === "weekly" && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Weekly Rate:</span>
                              <span className="font-semibold text-gray-800">
                                ${weeklyPrice.toLocaleString()}/week
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total for {rentalWeeks} weeks:</span>
                              <span className="font-semibold text-gray-800">
                                ${calculatedPrice.toLocaleString()}
                              </span>
                            </div>
                          </>
                        )}

                        {hasSignupFeeOption && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-1">
                                <FaUserPlus className="text-green-500" size={12} />
                                Signup Fee (Pay Upfront)
                              </span>
                              <span className="font-semibold text-green-600">
                                ${signupFee}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 pt-2 mt-2">
                              <div className="flex justify-between font-bold">
                                <span>Upfront Payment Today:</span>
                                <span className="text-green-600">
                                  ${upfrontPayment.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Pay signup fee now. First weekly payment due on start date.
                              </p>
                              {hasBond() && (
                                <p className="text-xs text-blue-500 mt-1">
                                  Bond payment of ${bondAmount} will be required after signup.
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        {!hasSignupFeeOption && (
                          <>
                            <div className="border-t border-gray-200 pt-2 mt-2">
                              <div className="flex justify-between font-bold">
                                <span>First Payment Today:</span>
                                <span className="text-green-600">
                                  ${calculatedPrice.toLocaleString()}
                                </span>
                              </div>
                              {selectedRentalType === "daily" && (
                                <p className="text-xs text-gray-500 mt-1">One-time payment for {rentalDays} days</p>
                              )}
                              {selectedRentalType === "weekly" && rentalWeeks > 0 && (
                                <p className="text-xs text-gray-500 mt-1">First week payment, then weekly for {rentalWeeks - 1} more weeks</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Date Selection Card - Show only if there's at least one enabled option */}
              {hasAnyEnabledOption && (
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
                    <FaCalendarAlt className="text-blue-500" />
                    Select Start Date
                  </h3>
                  <DatePicker
                    selected={startDate}
                    onChange={handleStartDateChange}
                    minDate={new Date()}
                    filterDate={(date) => selectedRentalType !== "rent_to_own" ? !isDateBooked(date) : true}
                    placeholderText="Click to select start date"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                    dateFormat="MMMM d, yyyy"
                    required
                  />
                  {startDate && selectedRentalType !== "rent_to_own" && endDate && (
                    <div className="mt-3 md:mt-4 p-3 md:p-4 bg-blue-50 rounded-xl">
                      <p className="text-xs md:text-sm font-semibold text-blue-800 mb-2">Rental Period</p>
                      <p className="text-xs md:text-sm text-blue-700">
                        {formatDate(startDate)} → {formatDate(endDate)}
                      </p>
                    </div>
                  )}
                  {startDate && selectedRentalType === "rent_to_own" && (
                    <div className="mt-3 md:mt-4 p-3 md:p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm font-semibold text-blue-800 mb-2">Start Date</p>
                      <p className="text-sm text-blue-700">{formatDate(startDate)}</p>
                      <p className="text-xs text-blue-600 mt-2">First payment due on this date</p>
                    </div>
                  )}
                </div>
              )}

              {/* Desktop Book Button - Only show if selected option is enabled */}
              {hasAnyEnabledOption && (
                <button
                  type="button"
                  onClick={() => {
                    // Only allow booking if the selected option is enabled
                    if ((selectedRentalType === "daily" && !isDailyEnabled) ||
                        (selectedRentalType === "weekly" && !isWeeklyEnabled) ||
                        (selectedRentalType === "rent_to_own" && !isRTOEnabled)) {
                      alert("This rental option is currently unavailable. Please select another option.");
                      return;
                    }
                    setShowBookingForm(true);
                  }}
                  disabled={isBookingDisabled || 
                    (selectedRentalType === "daily" && !isDailyEnabled) ||
                    (selectedRentalType === "weekly" && !isWeeklyEnabled) ||
                    (selectedRentalType === "rent_to_own" && !isRTOEnabled)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 md:py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all text-base md:text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] hidden md:block"
                >
                  {!startDate ? "📅 Select Start Date First" :
                    ((selectedRentalType === "daily" && !isDailyEnabled) ||
                     (selectedRentalType === "weekly" && !isWeeklyEnabled) ||
                     (selectedRentalType === "rent_to_own" && !isRTOEnabled)) ? "🔒 Option Unavailable" :
                    hasSignupFeeOption
                      ? `📝 Pay Signup Fee - $${upfrontPayment}`
                      : selectedRentalType === "daily"
                        ? `💰 Book Now - $${calculatedPrice.toLocaleString()}`
                        : selectedRentalType === "weekly"
                          ? `🚗 Start Rental - $${weeklyPrice.toLocaleString()}/week`
                          : `🏠 Start Ownership - $${calculatedPrice}/week`
                  }
                </button>
              )}

              {/* Specifications Card */}
              <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Specifications</h3>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-gray-50 rounded-lg">
                    <FaGasPump className="text-blue-500 text-base md:text-lg" />
                    <div>
                      <p className="text-xs text-gray-500">Fuel Type</p>
                      <p className="font-medium text-sm md:text-base">{car.fuel_type || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-gray-50 rounded-lg">
                    <FaUsers className="text-blue-500 text-base md:text-lg" />
                    <div>
                      <p className="text-xs text-gray-500">Seats</p>
                      <p className="font-medium text-sm md:text-base">{car.seats || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-gray-50 rounded-lg">
                    <FaCog className="text-blue-500 text-base md:text-lg" />
                    <div>
                      <p className="text-xs text-gray-500">Transmission</p>
                      <p className="font-medium text-sm md:text-base">{car.transmission || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-gray-50 rounded-lg">
                    <FaSuitcase className="text-blue-500 text-base md:text-lg" />
                    <div>
                      <p className="text-xs text-gray-500">Luggage</p>
                      <p className="font-medium text-sm md:text-base">{car.luggage_capacity || "N/A"} bags</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Card */}
              {car.description && (
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Description</h3>
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                    {car.description}
                  </p>
                </div>
              )}

              {/* Features Card */}
              {car.features && (
                <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-3">Key Features</h3>
                  <div className="flex flex-wrap gap-1 md:gap-2">
                    {car.features.split(",").map((feature, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-700 px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm"
                      >
                        {feature.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 md:gap-4 text-center py-3 md:py-4">
                <div className="flex flex-col items-center">
                  <FaShieldAlt className="text-green-500 text-xl md:text-2xl" />
                  <p className="text-xs text-gray-500 mt-1 md:mt-2">Secure Payments</p>
                </div>
                <div className="flex flex-col items-center">
                  <FaHeadset className="text-blue-500 text-xl md:text-2xl" />
                  <p className="text-xs text-gray-500 mt-1 md:mt-2">24/7 Support</p>
                </div>
                <div className="flex flex-col items-center">
                  <FaClock className="text-orange-500 text-xl md:text-2xl" />
                  <p className="text-xs text-gray-500 mt-1 md:mt-2">Weekly Billing</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Book Button */}
        {hasAnyEnabledOption && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 md:p-4 z-40 md:hidden">
            <button
              type="button"
              onClick={() => {
                if ((selectedRentalType === "daily" && !isDailyEnabled) ||
                    (selectedRentalType === "weekly" && !isWeeklyEnabled) ||
                    (selectedRentalType === "rent_to_own" && !isRTOEnabled)) {
                  alert("This rental option is currently unavailable. Please select another option.");
                  return;
                }
                setShowBookingForm(true);
              }}
              disabled={isBookingDisabled ||
                (selectedRentalType === "daily" && !isDailyEnabled) ||
                (selectedRentalType === "weekly" && !isWeeklyEnabled) ||
                (selectedRentalType === "rent_to_own" && !isRTOEnabled)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            >
              {!startDate ? "📅 Select Date First" :
                ((selectedRentalType === "daily" && !isDailyEnabled) ||
                 (selectedRentalType === "weekly" && !isWeeklyEnabled) ||
                 (selectedRentalType === "rent_to_own" && !isRTOEnabled)) ? "🔒 Option Unavailable" :
                hasSignupFeeOption
                  ? `📝 Pay Signup Fee - $${upfrontPayment}`
                  : selectedRentalType === "daily"
                    ? `💰 Book Now - $${calculatedPrice.toLocaleString()}`
                    : selectedRentalType === "weekly"
                      ? `🚗 Start Rental - $${weeklyPrice.toLocaleString()}/week`
                      : `🏠 Start Ownership - $${calculatedPrice}/week`
              }
            </button>
            {hasSignupFeeOption && (
              <p className="text-center text-xs text-gray-500 mt-2">
                Pay ${signupFee} signup fee today. Weekly payments start on rental date.
              </p>
            )}
            {hasBond() && !hasSignupFeeOption && (
              <p className="text-center text-xs text-gray-500 mt-2">
                Bond payment of ${bondAmount} will be required after booking.
              </p>
            )}
          </div>
        )}

        {/* Booking Form Modal */}
        {showBookingForm && startDate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowBookingForm(false)}>
            <div className="bg-white rounded-2xl p-5 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold">Complete Your Booking</h2>
                <button onClick={() => setShowBookingForm(false)} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  ✕
                </button>
              </div>
              <p className="text-gray-600 mb-3 pb-2 border-b text-sm">
                {car.brand} {car.name}
              </p>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-1 text-sm font-semibold">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1 text-sm font-semibold">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1 text-sm font-semibold">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Your phone number"
                  />
                </div>

                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-semibold mb-2">Booking Summary</p>
                  <p><strong>Start:</strong> {formatDate(startDate)}</p>
                  {selectedRentalType !== "rent_to_own" && endDate && (
                    <p><strong>End:</strong> {formatDate(endDate)}</p>
                  )}
                  <p><strong>Type:</strong> {selectedRentalType === "daily" ? "Daily" : selectedRentalType === "weekly" ? "Weekly" : "Rent to Own"}</p>
                  {selectedRentalType === "weekly" && (
                    <p><strong>Weekly Rate:</strong> ${weeklyPrice.toLocaleString()}/week</p>
                  )}
                  {selectedRentalType === "weekly" && rentalWeeks > 0 && (
                    <p><strong>Total Weeks:</strong> {rentalWeeks} weeks</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 mb-1 text-sm">Special Requests (Optional)</label>
                  <textarea
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Any special requirements?"
                  />
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
                  <div className="space-y-2">
                    {hasSignupFeeOption ? (
                      <>
                        {selectedRentalType === "weekly" && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Weekly Rental Rate:</span>
                            <span className="font-semibold">${weeklyPrice.toLocaleString()}/week</span>
                          </div>
                        )}
                        {selectedRentalType === "daily" && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Daily Rate:</span>
                            <span className="font-semibold">${dailyPrice.toLocaleString()}/day</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <FaUserPlus className="text-green-500" />
                            Signup Fee (Pay Now)
                          </span>
                          <span className="font-semibold text-green-600">${signupFee}</span>
                        </div>
                        {hasBond() && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 flex items-center gap-1">
                              <FaShieldAlt className="text-blue-500" />
                              Refundable Bond
                            </span>
                            <span className="font-semibold text-blue-600">${bondAmount}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-700 font-semibold">Upfront Payment Today:</span>
                            <span className="text-2xl font-bold text-green-600">
                              ${upfrontPayment.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <FaInfoCircle size={10} /> Pay signup fee now to secure your booking.
                          </p>
                          {hasBond() && (
                            <p className="text-xs text-blue-500 mt-1">
                              Bond payment of ${bondAmount} will be available after signup.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-semibold">Total Today:</span>
                        <span className="text-2xl font-bold text-green-600">
                          ${calculatedPrice.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <FaSpinner className="animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      `Pay $${upfrontPayment} Now`
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="flex-1 bg-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CarDetails;