import React, { useState, useEffect } from "react";
import axios from "axios";
import CarCard from "../components/CarCard";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

function Cars() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [priceFilter, setPriceFilter] = useState("all");

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars/`);
      setCars(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching cars:", error);
      setLoading(false);
    }
  };

  // Helper function to get daily price
  const getDailyPrice = (car) => {
    if (!car) return 0;
    const price = car.daily_price || car.price_per_day || car.price || 0;
    return typeof price === 'number' ? price : parseFloat(price) || 0;
  };

  // Filter and sort cars
  let filteredCars = cars.filter((car) => {
    if (!car) return false;
    
    const matchesSearch =
      (car.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (car.brand || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBrand = !selectedBrand || car.brand === selectedBrand;
    
    const carPrice = getDailyPrice(car);
    let matchesPrice = true;
    if (priceFilter === "under50") {
      matchesPrice = carPrice < 50;
    } else if (priceFilter === "under100") {
      matchesPrice = carPrice < 100;
    } else if (priceFilter === "under200") {
      matchesPrice = carPrice < 200;
    }
    
    return matchesSearch && matchesBrand && matchesPrice;
  });

  // Sort cars
  filteredCars = [...filteredCars].sort((a, b) => {
    if (sortBy === "price_low") {
      return getDailyPrice(a) - getDailyPrice(b);
    } else if (sortBy === "price_high") {
      return getDailyPrice(b) - getDailyPrice(a);
    } else if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "");
    } else if (sortBy === "brand") {
      return (a.brand || "").localeCompare(b.brand || "");
    } else if (sortBy === "year") {
      return (b.model_year || 0) - (a.model_year || 0);
    }
    return 0;
  });

  const brands = [...new Set(cars.filter(car => car && car.brand).map((car) => car.brand))];

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedBrand("");
    setPriceFilter("all");
    setSortBy("name");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Our Fleet</h1>
        <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
          Choose from our wide selection of premium vehicles. All cars are regularly maintained 
          and come with comprehensive insurance.
        </p>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by name or brand..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* Price Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Price Range
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
              >
                <option value="all">All Prices</option>
                <option value="under50">Under $50/day</option>
                <option value="under100">Under $100/day</option>
                <option value="under200">Under $200/day</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Name (A-Z)</option>
                <option value="brand">Brand (A-Z)</option>
                <option value="price_low">Price (Low to High)</option>
                <option value="price_high">Price (High to Low)</option>
                <option value="year">Year (Newest First)</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchTerm || selectedBrand || priceFilter !== "all") && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Active Filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    Search: {searchTerm}
                    <button onClick={() => setSearchTerm("")} className="ml-1 hover:text-blue-900 font-bold">
                      ×
                    </button>
                  </span>
                )}
                {selectedBrand && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    Brand: {selectedBrand}
                    <button onClick={() => setSelectedBrand("")} className="ml-1 hover:text-blue-900 font-bold">
                      ×
                    </button>
                  </span>
                )}
                {priceFilter !== "all" && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    {priceFilter === "under50" && "Under $50/day"}
                    {priceFilter === "under100" && "Under $100/day"}
                    {priceFilter === "under200" && "Under $200/day"}
                    <button onClick={() => setPriceFilter("all")} className="ml-1 hover:text-blue-900 font-bold">
                      ×
                    </button>
                  </span>
                )}
                <button onClick={clearAllFilters} className="text-sm text-red-600 hover:text-red-800">
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-gray-600">
          Found {filteredCars.length} car{filteredCars.length !== 1 ? "s" : ""}
        </div>

        {/* Cars Grid */}
        {filteredCars.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow">
            <h3 className="text-2xl text-gray-600 mb-2">No cars found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            <button onClick={clearAllFilters} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Clear All Filters
            </button>
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

export default Cars;