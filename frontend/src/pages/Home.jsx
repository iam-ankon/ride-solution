import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import CarCard from "../components/CarCard";

import {
  FaCar,
  FaUsers,
  FaHeadset,
  FaShieldAlt,
  FaStar,
  FaArrowRight,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
} from "react-icons/fa";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

function Home() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuredCars, setFeaturedCars] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");

  // Get unique brands for filter dropdown
  const brands = [...new Set(cars.map((car) => car.brand))].sort();

  // Filter cars based on search term and selected brand
  const filteredCars = cars.filter((car) => {
    const matchesSearch =
      car.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = selectedBrand ? car.brand === selectedBrand : true;
    return matchesSearch && matchesBrand;
  });

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars/`);
      setCars(response.data);
      const featured = response.data.filter((car) => car.featured).slice(0, 6);
      setFeaturedCars(
        featured.length > 0 ? featured : response.data.slice(0, 6),
      );
    } catch (error) {
      console.error("Error fetching cars:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get car image
  const getCarImage = (car) => {
    if (car.images && car.images.length > 0 && car.images[0].image) {
      return `${API_URL}${car.images[0].image}`;
    }
    return null;
  };

  return (
    <div>
      <Hero />

      <div className="container mx-auto px-4 py-12">
        {/* Search and Filter Section */}
        <div className="mb-12 flex flex-col md:flex-row gap-4 justify-between items-center">
          <input
            type="text"
            placeholder="Search cars by name or brand..."
            className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        {/* Cars Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-2xl text-gray-600">No cars found</h3>
            <p className="text-gray-500 mt-2">
              Try adjusting your search or filter
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
