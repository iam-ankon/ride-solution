// EditCar.jsx - Updated with Signup Fee and Bond Amount
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

function EditCar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRefs = useRef({});
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [existingImages, setExistingImages] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);
  const [imageIds, setImageIds] = useState([]);
  const nextIdRef = useRef(1);

  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    model_year: new Date().getFullYear(),
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
    // Signup Fee fields - NEW
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

  // RTO year options: 3, 4, 5, 6, 7 years
  const rtoYearOptions = [3, 4, 5, 6, 7];

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

  // Fetch car details on load
  useEffect(() => {
    fetchCarDetails();
  }, [id]);

  useEffect(() => {
    return () => {
      Object.values(imagePreviews).forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    };
  }, []);

  const fetchCarDetails = async () => {
    try {
      const response = await apiClient.get(`/api/cars/${id}/`);
      const car = response.data;

      setFormData({
        name: car.name || "",
        brand: car.brand || "",
        model_year: car.model_year || new Date().getFullYear(),
        daily_price: car.daily_price || "",
        weekly_price: car.weekly_price || "",
        rent_to_own_price: car.rent_to_own_price || "",
        rent_to_own_term: car.rent_to_own_term || 36,
        min_rental_days: car.min_rental_days || 3,
        max_weekly_bookings: car.max_weekly_bookings || 5,
        total_units: car.total_units || 1,
        available_units: car.available_units || 1,
        featured: car.featured || false,
        short_term_available: car.short_term_available !== undefined ? car.short_term_available : true,
        long_term_available: car.long_term_available !== undefined ? car.long_term_available : true,
        rent_to_own_available: car.rent_to_own_available !== undefined ? car.rent_to_own_available : true,
        car_value: car.car_value || "",
        rent_to_own_years: car.rent_to_own_years || 3,
        // Convert decimal to percentage for display
        interest_rate: car.interest_rate ? car.interest_rate * 100 : 9.5,
        ongoing_cost_weekly: car.ongoing_cost_weekly || 79,
        service_fee_weekly: car.service_fee_weekly || 55,
        // Signup fee fields - NEW
        signup_fee: car.signup_fee || "",
        signup_fee_description: car.signup_fee_description || "Signup fee covers booking processing and administrative costs. This fee is non-refundable.",
        // Bond fields
        bond_amount: car.bond_amount || "",
        bond_refundable: car.bond_refundable !== undefined ? car.bond_refundable : true,
        bond_terms: car.bond_terms || "Bond is fully refundable upon return of the vehicle in good condition, no damage, and no outstanding fines or tolls.",
        fuel_type: car.fuel_type || "Petrol",
        transmission: car.transmission || "Automatic",
        seats: car.seats || 5,
        luggage_capacity: car.luggage_capacity || 2,
        description: car.description || "",
        features: car.features || "",
        status: car.status || "available",
      });

      // Load existing images
      if (car.images && car.images.length > 0) {
        const processedImages = car.images.map((img) => {
          let imageUrl = img.image_url || img.image;
          if (imageUrl && imageUrl.startsWith("/")) {
            imageUrl = `${API_URL}${imageUrl}`;
          }
          return {
            ...img,
            display_url: imageUrl,
          };
        });
        setExistingImages(processedImages);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching car:", error);
      setError("Failed to load car details. Please try again.");
      setLoading(false);
    }
  };

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

  const handleImageChange = (tempId, file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError(`Image is too large (max 5MB)`);
      if (fileInputRefs.current[tempId]) {
        fileInputRefs.current[tempId].value = "";
      }
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      if (fileInputRefs.current[tempId]) {
        fileInputRefs.current[tempId].value = "";
      }
      return;
    }

    if (imagePreviews[tempId]) {
      URL.revokeObjectURL(imagePreviews[tempId]);
    }

    const preview = URL.createObjectURL(file);

    setImageFiles((prev) => ({ ...prev, [tempId]: file }));
    setImagePreviews((prev) => ({ ...prev, [tempId]: preview }));
    setError("");
  };

  const addImageField = () => {
    const newId = nextIdRef.current++;
    setImageIds((prev) => [...prev, newId]);
  };

  const removeNewImage = (tempId) => {
    if (imagePreviews[tempId]) {
      URL.revokeObjectURL(imagePreviews[tempId]);
    }
    setImageFiles((prev) => {
      const newState = { ...prev };
      delete newState[tempId];
      return newState;
    });
    setImagePreviews((prev) => {
      const newState = { ...prev };
      delete newState[tempId];
      return newState;
    });
    setImageIds((prev) => prev.filter((id) => id !== tempId));
  };

  const removeExistingImage = async (imageId) => {
    if (!window.confirm("Remove this image?")) return;

    try {
      await apiClient.post(`/api/cars/${id}/delete_image/`, {
        image_id: imageId,
      });

      setDeletedImages((prev) => [...prev, imageId]);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      setSuccess("Image removed successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting image:", error);
      setError("Failed to delete image");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const weeklyPayment = calculateWeeklyPayment();
      const monthlyPayment = calculateMonthlyPayment();
      
      const carData = {
        name: formData.name,
        brand: formData.brand,
        model_year: parseInt(formData.model_year),
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
        // Convert percentage to decimal for backend
        interest_rate: (parseFloat(formData.interest_rate) || 9.5) / 100,
        ongoing_cost_weekly: parseFloat(formData.ongoing_cost_weekly) || 79,
        service_fee_weekly: parseFloat(formData.service_fee_weekly) || 55,
        // Signup fee fields - NEW
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

      console.log("Updating car with data:", carData);

      await apiClient.put(`/api/cars/${id}/`, carData);

      // Delete removed images
      for (const imageId of deletedImages) {
        await apiClient.post(`/api/cars/${id}/delete_image/`, {
          image_id: imageId,
        });
      }

      // Upload new images
      const newImageIds = Object.keys(imageFiles);
      for (let i = 0; i < newImageIds.length; i++) {
        const tempId = newImageIds[i];
        const file = imageFiles[tempId];
        const formDataImages = new FormData();
        formDataImages.append("image", file);

        await apiClient.post(
          `/api/cars/${id}/upload_to_cloudinary/`,
          formDataImages,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      }

      setSuccess("Car updated successfully!");
      setTimeout(() => {
        navigate("/my-cars");
      }, 1500);
    } catch (error) {
      console.error("Error updating car:", error);
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
              "Failed to update car"
          );
        }
      } else if (error.request) {
        setError("No response from server. Please check your connection.");
      } else {
        setError("Failed to update car: " + (error.message || "Unknown error"));
      }
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Edit Car Listing</h1>
          <p className="text-gray-600 mb-6">
            Update your car details and images
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
              {success}
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
                    <option value="booked_out">Booked Out</option>
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
                    Car Base Value ($)
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

            {/* Signup Fee Section - NEW */}
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

            {/* Existing Images Section */}
            {existingImages.length > 0 && (
              <div className="border-b border-gray-200 pb-4 mb-4">
                <label className="block text-gray-700 font-semibold mb-3">
                  Current Images ({existingImages.length})
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {existingImages.map((img) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.display_url || img.image_url || img.image}
                        alt="Car"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ×
                      </button>
                      {img.is_primary && (
                        <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-xs px-1 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Images Upload Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-gray-700 font-semibold">
                  Add New Images
                </label>
                <button
                  type="button"
                  onClick={addImageField}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  + Add Another Image
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Upload additional images. New images will be added to existing
                ones.
              </p>

              {imageIds.map((tempId, index) => (
                <div
                  key={tempId}
                  className="border rounded-lg p-4 mb-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-medium text-gray-700">
                      New Image {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewImage(tempId)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <input
                        ref={(el) => (fileInputRefs.current[tempId] = el)}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) =>
                          handleImageChange(tempId, e.target.files[0])
                        }
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, GIF, WEBP up to 5MB
                      </p>
                    </div>

                    {imagePreviews[tempId] && (
                      <div className="relative">
                        <img
                          src={imagePreviews[tempId]}
                          alt={`New Preview ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {imageIds.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">No new images to upload</p>
                  <button
                    type="button"
                    onClick={addImageField}
                    className="mt-2 text-blue-600 hover:underline"
                  >
                    Add Images
                  </button>
                </div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
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

export default EditCar;