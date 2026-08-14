// AddCar.jsx - Without service_charge_per_year
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

// Create axios instance with auth interceptor
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

function AddCar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRefs = useRef({});
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [imageIds, setImageIds] = useState([1]);
  const nextIdRef = useRef(2);

  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    model_year: new Date().getFullYear(),
    registration_number: "",
    daily_price: "",
    weekly_price: "",
    rent_to_own_price: "",
    rent_to_own_term: 36,
    min_rental_days: 3,
    max_weekly_bookings: 5,
    total_units: 1,
    available_units: 1,
    featured: false,
    short_term_available: true,
    long_term_available: true,
    rent_to_own_available: true,
    car_value: "",
    rent_to_own_years: 3,
    // Rent-to-Own calculation fields
    interest_rate: 9.5,
    ongoing_cost_weekly: 79,
    service_fee_weekly: 55,
    // Signup Fee fields
    signup_fee: "",
    signup_fee_description: "Signup fee covers booking processing and administrative costs. This fee is non-refundable.",
    // Bond fields
    bond_amount: "",
    bond_refundable: true,
    bond_terms: "Bond is fully refundable upon return of the vehicle in good condition, no damage, and no outstanding fines or tolls.",
    fuel_type: "Petrol",
    transmission: "Automatic",
    seats: 5,
    luggage_capacity: 2,
    description: "",
    features: "",
    status: "available",
  });

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      Object.values(imagePreviews).forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let parsedValue = value;
    
    if (type === "number") {
      parsedValue = parseFloat(value);
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Calculate total weeks for rent-to-own
  const calculateTotalWeeks = (years) => {
    return Math.ceil(years * 52.1775);
  };

  // Calculate total cost for rent-to-own based on Excel formula
  const calculateTotalCost = () => {
    const carValue = parseFloat(formData.car_value) || 0;
    const years = parseFloat(formData.rent_to_own_years) || 3;
    const interestRate = (parseFloat(formData.interest_rate) || 9.5) / 100;
    const ongoingCostWeekly = parseFloat(formData.ongoing_cost_weekly) || 79;
    const serviceFeeWeekly = parseFloat(formData.service_fee_weekly) || 55;
    
    if (carValue === 0) return 0;
    
    const totalWeeks = calculateTotalWeeks(years);
    const interestTotal = carValue * interestRate * years;
    const ongoingTotal = ongoingCostWeekly * totalWeeks;
    const serviceTotal = serviceFeeWeekly * totalWeeks;
    
    return carValue + interestTotal + ongoingTotal + serviceTotal;
  };

  // Calculate weekly payment for rent-to-own
  const calculateWeeklyPayment = () => {
    const totalCost = calculateTotalCost();
    const years = parseFloat(formData.rent_to_own_years) || 3;
    const totalWeeks = calculateTotalWeeks(years);
    
    if (totalCost === 0 || totalWeeks === 0) return "0.00";
    return (totalCost / totalWeeks).toFixed(2);
  };

  // Calculate monthly payment for display
  const calculateMonthlyPayment = () => {
    const weeklyPayment = parseFloat(calculateWeeklyPayment());
    if (weeklyPayment === 0) return "0.00";
    return (weeklyPayment * 4.33).toFixed(2);
  };

  const handleImageChange = (id, file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError(`Image is too large (max 5MB)`);
      if (fileInputRefs.current[id]) {
        fileInputRefs.current[id].value = "";
      }
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      if (fileInputRefs.current[id]) {
        fileInputRefs.current[id].value = "";
      }
      return;
    }

    if (imagePreviews[id]) {
      URL.revokeObjectURL(imagePreviews[id]);
    }

    const preview = URL.createObjectURL(file);

    setImageFiles((prev) => ({ ...prev, [id]: file }));
    setImagePreviews((prev) => ({ ...prev, [id]: preview }));
    setError("");
  };

  const addImageField = () => {
    const newId = nextIdRef.current++;
    setImageIds((prev) => [...prev, newId]);
  };

  const removeImageField = (id) => {
    if (imageIds.length === 1) {
      setError("You need at least one image");
      return;
    }

    if (imagePreviews[id]) {
      URL.revokeObjectURL(imagePreviews[id]);
    }

    setImageIds((prev) => prev.filter((i) => i !== id));
    setImageFiles((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setImagePreviews((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!formData.name || !formData.brand || !formData.daily_price) {
      setError("Please fill in all required fields (Name, Brand, Daily Price)");
      setLoading(false);
      return;
    }

    const hasImage = Object.keys(imageFiles).length > 0;
    if (!hasImage) {
      setError("Please upload at least one image of the car");
      setLoading(false);
      return;
    }

    const weeklyPayment = calculateWeeklyPayment();
    const monthlyPayment = calculateMonthlyPayment();

    const carData = {
      name: formData.name,
      brand: formData.brand,
      model_year: parseInt(formData.model_year),
      registration_number: formData.registration_number,
      daily_price: parseFloat(formData.daily_price) || 0,
      weekly_price: parseFloat(formData.weekly_price) || 0,
      rent_to_own_price: parseFloat(monthlyPayment) || 0,
      rent_to_own_term: parseInt(formData.rent_to_own_term),
      min_rental_days: parseInt(formData.min_rental_days),
      max_weekly_bookings: parseInt(formData.max_weekly_bookings),
      total_units: parseInt(formData.total_units),
      available_units: parseInt(formData.total_units),
      featured: formData.featured,
      short_term_available: formData.short_term_available,
      long_term_available: formData.long_term_available,
      rent_to_own_available: formData.rent_to_own_available,
      car_value: parseFloat(formData.car_value) || 0,
      rent_to_own_years: parseInt(formData.rent_to_own_years) || 3,
      interest_rate: (parseFloat(formData.interest_rate) || 9.5) / 100,
      ongoing_cost_weekly: parseFloat(formData.ongoing_cost_weekly) || 79,
      service_fee_weekly: parseFloat(formData.service_fee_weekly) || 55,
      // Signup fee fields
      signup_fee: parseFloat(formData.signup_fee) || 0,
      signup_fee_description: formData.signup_fee_description,
      // Bond fields
      bond_amount: parseFloat(formData.bond_amount) || 0,
      bond_refundable: formData.bond_refundable,
      bond_terms: formData.bond_terms,
      fuel_type: formData.fuel_type,
      transmission: formData.transmission,
      seats: parseInt(formData.seats),
      luggage_capacity: parseInt(formData.luggage_capacity),
      description: formData.description || "",
      features: formData.features || "",
      status: formData.status,
    };

    console.log("Submitting car data:", carData);

    try {
      const response = await apiClient.post(`/api/cars/`, carData);

      const carId = response.data.id;
      const imageIdList = Object.keys(imageFiles);

      for (let i = 0; i < imageIdList.length; i++) {
        const id = imageIdList[i];
        const file = imageFiles[id];
        const formDataImages = new FormData();
        formDataImages.append("image", file);

        await apiClient.post(
          `/api/cars/${carId}/upload_to_cloudinary/`,
          formDataImages,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      }

      alert(`Car listed successfully with ${imageIdList.length} image(s)!`);
      navigate("/my-cars");
    } catch (error) {
      console.error("Error:", error.response?.data);
      if (error.response?.data) {
        if (typeof error.response.data === "object") {
          const errorMessages = Object.values(error.response.data)
            .flat()
            .join(", ");
          setError(errorMessages);
        } else {
          setError(
            error.response.data.error ||
              error.response.data.message ||
              "Failed to add car"
          );
        }
      } else {
        setError("Network error. Please check if the server is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  const weeklyPayment = calculateWeeklyPayment();
  const totalCost = calculateTotalCost();
  const totalWeeks = calculateTotalWeeks(parseFloat(formData.rent_to_own_years) || 3);
  const carValue = parseFloat(formData.car_value) || 0;
  const years = parseFloat(formData.rent_to_own_years) || 3;
  const interestRateDecimal = (parseFloat(formData.interest_rate) || 9.5) / 100;
  const interestTotal = carValue * interestRateDecimal * years;
  const ongoingTotal = (parseFloat(formData.ongoing_cost_weekly) || 79) * totalWeeks;
  const serviceTotal = (parseFloat(formData.service_fee_weekly) || 55) * totalWeeks;

  // RTO year options: 3, 4, 5, 6, 7 years
  const rtoYearOptions = [3, 4, 5, 6, 7];

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">List Your Car for Rent</h1>
          <p className="text-gray-600 mb-6">
            Earn money by renting out your vehicle
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Information Section */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Car Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Civic, Camry, Model 3"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Brand *</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g., Toyota, Honda, Tesla"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Model Year</label>
                  <input
                    type="number"
                    name="model_year"
                    value={formData.model_year}
                    onChange={handleChange}
                    min="1900"
                    max="2025"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Registration Number *</label>
                  <input
                    type="text"
                    name="registration_number"
                    value={formData.registration_number}
                    onChange={handleChange}
                    placeholder="e.g., ABC123"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="available">Available</option>
                    <option value="rented">Rented</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Car Valuation Section with R2W Calculation */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4">Car Valuation & Rent-to-Own</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Car Base Value ($) *
                  </label>
                  <input
                    type="number"
                    name="car_value"
                    value={formData.car_value}
                    onChange={handleChange}
                    placeholder="e.g., 20000"
                    min="0"
                    step="1000"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Current market value of the car</p>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Rent to Own Period (Years)
                  </label>
                  <select
                    name="rent_to_own_years"
                    value={formData.rent_to_own_years}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {rtoYearOptions.map(year => (
                      <option key={year} value={year}>{year} years ({year * 12} months)</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Choose 3-7 years for rent-to-own</p>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Interest Rate (% per annum)
                  </label>
                  <input
                    type="number"
                    name="interest_rate"
                    value={formData.interest_rate}
                    onChange={handleChange}
                    placeholder="e.g., 9.5"
                    min="0"
                    max="50"
                    step="0.1"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Annual interest rate (default: 9.5%)
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Weekly Ongoing Cost ($)
                  </label>
                  <input
                    type="number"
                    name="ongoing_cost_weekly"
                    value={formData.ongoing_cost_weekly}
                    onChange={handleChange}
                    placeholder="e.g., 79"
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Includes rego, insurance, general service (default: $79)
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Weekly Service Fee ($)
                  </label>
                  <input
                    type="number"
                    name="service_fee_weekly"
                    value={formData.service_fee_weekly}
                    onChange={handleChange}
                    placeholder="e.g., 55"
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Business operation cost (default: $55)
                  </p>
                </div>
              </div>

              {/* R2W Calculation Preview */}
              {carValue > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-3">Rent-to-Own Calculation Preview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Car Value:</span>
                        <span className="font-medium">${carValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interest ({formData.interest_rate}% p.a. for {years} years):</span>
                        <span className="font-medium">${interestTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rego/Insurance (${formData.ongoing_cost_weekly}/week × {totalWeeks} weeks):</span>
                        <span className="font-medium">${ongoingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Service Fees (${formData.service_fee_weekly}/week × {totalWeeks} weeks):</span>
                        <span className="font-medium">${serviceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                        <span>Total Contract Value:</span>
                        <span className="text-green-600">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Weekly Payment</p>
                      <p className="text-3xl font-bold text-blue-600">${weeklyPayment}</p>
                      <p className="text-xs text-gray-500 mt-2">for {totalWeeks} weeks</p>
                      <div className="mt-3 pt-2 border-t">
                        <p className="text-xs text-gray-500">Monthly Payment (approx)</p>
                        <p className="text-lg font-semibold text-purple-600">${calculateMonthlyPayment()}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Formula: Car Value + (Interest × Years) + (Ongoing Cost × Weeks) + (Service Fee × Weeks)
                  </p>
                </div>
              )}
            </div>

            {/* Signup Fee Section */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-green-600">📝</span> Signup Fee
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Set a signup fee that customers pay upfront when booking. This fee is non-refundable and covers booking processing costs.
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Signup Fee Amount ($)
                  </label>
                  <input
                    type="number"
                    name="signup_fee"
                    value={formData.signup_fee}
                    onChange={handleChange}
                    placeholder="e.g., 50"
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Set 0 for no signup fee</p>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Signup Fee Description
                  </label>
                  <textarea
                    name="signup_fee_description"
                    value={formData.signup_fee_description}
                    onChange={handleChange}
                    rows="2"
                    placeholder="Describe what the signup fee covers..."
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This description will be shown to customers during checkout
                  </p>
                </div>
              </div>
            </div>

            {/* Bond Settings Section */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-blue-600">💰</span> Bond / Security Deposit
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Set an optional refundable bond amount for this vehicle. This amount will be paid after signup and refunded upon return.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Bond Amount ($)
                  </label>
                  <input
                    type="number"
                    name="bond_amount"
                    value={formData.bond_amount}
                    onChange={handleChange}
                    placeholder="e.g., 500"
                    min="0"
                    step="50"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Set 0 for no bond</p>
                </div>

                <div className="mb-4 flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="bond_refundable"
                      checked={formData.bond_refundable}
                      onChange={handleCheckboxChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-gray-700">Bond is Refundable</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Bond Terms & Conditions
                </label>
                <textarea
                  name="bond_terms"
                  value={formData.bond_terms}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Describe the terms for bond refund..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  These terms will be shown to customers when they choose to pay the bond
                </p>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4">Rental Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Daily Price ($) *
                  </label>
                  <input
                    type="number"
                    name="daily_price"
                    value={formData.daily_price}
                    onChange={handleChange}
                    placeholder="e.g., 50"
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Weekly Price ($)
                  </label>
                  <input
                    type="number"
                    name="weekly_price"
                    value={formData.weekly_price}
                    onChange={handleChange}
                    placeholder="e.g., 300"
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Rent to Own Term (Months)
                  </label>
                  <input
                    type="number"
                    name="rent_to_own_term"
                    value={formData.rent_to_own_term}
                    onChange={handleChange}
                    placeholder="36"
                    min="12"
                    max="84"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Min Rental Days
                  </label>
                  <input
                    type="number"
                    name="min_rental_days"
                    value={formData.min_rental_days}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Max Weekly Bookings
                  </label>
                  <input
                    type="number"
                    name="max_weekly_bookings"
                    value={formData.max_weekly_bookings}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Total Units Available
                  </label>
                  <input
                    type="number"
                    name="total_units"
                    value={formData.total_units}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Rental Options Availability Section */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4">Rental Options Availability</h2>
              <p className="text-sm text-gray-500 mb-4">
                Enable or disable rental options for this car. Disabled options will not be shown to customers.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <label className="font-semibold text-gray-700">Short Term</label>
                    <p className="text-xs text-gray-500">Daily rentals (min 3 days)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="short_term_available"
                      checked={formData.short_term_available}
                      onChange={handleCheckboxChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <label className="font-semibold text-gray-700">Long Term</label>
                    <p className="text-xs text-gray-500">Weekly rentals</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="long_term_available"
                      checked={formData.long_term_available}
                      onChange={handleCheckboxChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <label className="font-semibold text-gray-700">Rent to Own</label>
                    <p className="text-xs text-gray-500">Weekly payments to own</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="rent_to_own_available"
                      checked={formData.rent_to_own_available}
                      onChange={handleCheckboxChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  name="featured"
                  checked={formData.featured}
                  onChange={handleCheckboxChange}
                  className="mr-2 w-4 h-4"
                />
                <label className="text-gray-700">
                  Feature this car (highlight on homepage)
                </label>
              </div>
            </div>

            {/* Specifications Section */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4">Specifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Fuel Type</label>
                  <select
                    name="fuel_type"
                    value={formData.fuel_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Electric">Electric</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Transmission</label>
                  <select
                    name="transmission"
                    value={formData.transmission}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Automatic">Automatic</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Seats</label>
                  <input
                    type="number"
                    name="seats"
                    value={formData.seats}
                    onChange={handleChange}
                    min="1"
                    max="15"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Luggage Capacity (bags)
                  </label>
                  <input
                    type="number"
                    name="luggage_capacity"
                    value={formData.luggage_capacity}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Description & Features */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold mb-4">Description & Features</h2>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Describe your car's condition, features, and any special notes for renters..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Features (comma separated)
                </label>
                <textarea
                  name="features"
                  value={formData.features}
                  onChange={handleChange}
                  rows="2"
                  placeholder="e.g., Bluetooth, Backup Camera, GPS, Heated Seats"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>

            {/* Images Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-gray-700 font-semibold">
                  Car Images
                </label>
                <button
                  type="button"
                  onClick={addImageField}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  + Add Another Car Image
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Upload multiple images for your car. The first image will be the primary/cover image.
              </p>

              {imageIds.map((id, index) => (
                <div key={id} className="border rounded-lg p-4 mb-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-medium text-gray-700">
                      Image {index + 1}
                    </span>
                    {imageIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeImageField(id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <input
                        ref={(el) => (fileInputRefs.current[id] = el)}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                        onChange={(e) => handleImageChange(id, e.target.files[0])}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, GIF, WebP, AVIF up to 5MB
                      </p>
                    </div>

                    {imagePreviews[id] && (
                      <div className="relative">
                        <img
                          src={imagePreviews[id]}
                          alt={`Preview ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                        {index === 0 && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!imagePreviews[id] && (
                    <div className="mt-3 p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                      No image selected
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? "Listing..." : "List Car for Rent"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/my-cars")}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddCar;