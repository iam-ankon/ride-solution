import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaGasPump, FaUsers, FaCog, FaSuitcase, FaChevronLeft, FaChevronRight, FaStar, FaCar, FaShieldAlt, FaWrench, FaPhoneAlt, FaCheckCircle } from "react-icons/fa";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

const CarCard = ({ car }) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);

  useEffect(() => {
    if (!car) return;
    const urls = [];
    if (car.images && car.images.length > 0) {
      car.images.forEach((img) => {
        let imageUrl = img.image_url || img.image;
        if (imageUrl) {
          if (!imageUrl.startsWith('http')) {
            imageUrl = `${API_URL}${imageUrl}`;
          }
          urls.push(imageUrl);
        }
      });
    }
    setImageUrls(urls);
    setCurrentImageIndex(0);
  }, [car]);

  const prevImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
  };

  const nextImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
  };

  const handleBookNow = (e, carId) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/car/${carId}`);
  };

  if (!car) return null;

  const currentImage = imageUrls.length > 0
    ? imageUrls[currentImageIndex]
    : `https://via.placeholder.com/400x300?text=${encodeURIComponent(car.brand + ' ' + car.name)}`;

  const dailyPrice = car.daily_price || 0;
  const weeklyPrice = car.weekly_price || 0;
  const availableUnits = car.available_units !== undefined ? car.available_units : (car.total_units || 1);
  const isAvailable = availableUnits > 0 && car.status !== 'maintenance';

  const availability = {
    color: isAvailable ? 'bg-green-500' : (car.status === 'maintenance' ? 'bg-red-500' : 'bg-orange-500'),
    text: isAvailable ? 'Available' : (car.status === 'maintenance' ? 'Maintenance' : 'Unavailable'),
    
    buttonText: isAvailable ? 'Book Now' : 'Check Availability',
    buttonClass: isAvailable
      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
      : 'bg-gray-400 hover:bg-gray-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group">
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        <img
          src={currentImage}
          alt={`${car.brand} ${car.name}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            e.target.src = `https://via.placeholder.com/400x300?text=${encodeURIComponent(car.brand + ' ' + car.name)}`;
          }}
        />

        {imageUrls.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
            >
              <FaChevronLeft size={12} />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
            >
              <FaChevronRight size={12} />
            </button>
          </>
        )}

        <div className={`absolute top-3 right-3 ${availability.color} text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg z-10`}>
          {availability.text}
        </div>

        {car.featured && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg z-10">
            <FaStar size={10} /> Featured
          </div>
        )}

        <div className="absolute bottom-3 right-3 bg-black bg-opacity-75 backdrop-blur-sm text-white px-3 py-1 rounded-lg shadow-lg z-10">
          <span className="text-lg font-bold">${dailyPrice.toLocaleString()}</span>
          <span className="text-xs ml-0.5">/day</span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Car Title */}
        <div className="mb-2">
          <h3 className="text-lg font-bold text-gray-800 line-clamp-1">
            {car.brand} {car.name}
          </h3>
          <p className="text-gray-500 text-xs">{car.model_year || "2024"}</p>
        </div>

        {/* 3 Service Badges */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex flex-col items-center text-center p-2 bg-green-50 rounded-lg">
            <FaShieldAlt className="text-green-600 text-sm mb-1" />
            <span className="text-[10px] font-semibold text-green-700">Registration</span>
            <span className="text-[8px] text-green-600">Included</span>
          </div>
          <div className="flex flex-col items-center text-center p-2 bg-blue-50 rounded-lg">
            <FaWrench className="text-blue-600 text-sm mb-1" />
            <span className="text-[10px] font-semibold text-blue-700">Servicing</span>
            <span className="text-[8px] text-blue-600">Included</span>
          </div>
          <div className="flex flex-col items-center text-center p-2 bg-purple-50 rounded-lg">
            <FaPhoneAlt className="text-purple-600 text-sm mb-1" />
            <span className="text-[10px] font-semibold text-purple-700">24/7 Roadside</span>
            <span className="text-[8px] text-purple-600">Assistance</span>
          </div>
        </div>

        {/* Quick Specs - Simplified */}
        <div className="flex justify-between items-center text-gray-600 text-xs mb-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <FaGasPump className="text-blue-500" size={12} />
            <span>{car.fuel_type || "Petrol"}</span>
          </div>
          <div className="flex items-center gap-1">
            <FaUsers className="text-blue-500" size={12} />
            <span>{car.seats || 5} seats</span>
          </div>
          <div className="flex items-center gap-1">
            <FaCog className="text-blue-500" size={12} />
            <span>{car.transmission === "Automatic" ? "Auto" : "Manual"}</span>
          </div>
          <div className="flex items-center gap-1">
            <FaSuitcase className="text-blue-500" size={12} />
            <span>{car.luggage_capacity || 2} bags</span>
          </div>
        </div>

        {/* Weekly Price (if available) */}
        {weeklyPrice > 0 && (
          <div className="mb-3 text-center">
            <span className="text-xs text-gray-500">or </span>
            <span className="text-sm font-semibold text-green-600">${weeklyPrice.toLocaleString()}</span>
            <span className="text-xs text-gray-500">/week</span>
          </div>
        )}

        {/* Book Now Button */}
        <button
          onClick={(e) => handleBookNow(e, car.id)}
          className={`w-full mt-2 py-2 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg ${availability.buttonClass} text-white cursor-pointer text-sm`}
        >
          {availability.buttonText}
        </button>

        {/* Availability Note */}
        {!isAvailable && (
          <p className="text-xs text-center text-orange-600 mt-2">
            Contact us for availability
          </p>
        )}
      </div>
    </div>
  );
};

export default CarCard;