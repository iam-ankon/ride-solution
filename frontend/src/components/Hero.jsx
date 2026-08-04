import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaArrowRight, FaChevronLeft, FaChevronRight, FaStar, FaCar } from 'react-icons/fa';

const API_URL = 'https://ride-solution-backend-udox.onrender.com';

const Hero = () => {
  const navigate = useNavigate();
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cars: 0,
    customers: 0,
    experience: 0
  });

  useEffect(() => {
    fetchCarImages();
  }, []);

  useEffect(() => {
    let interval;
    if (backgroundImages.length > 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % backgroundImages.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  const fetchCarImages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars/`);
      const cars = response.data;
      
      // Set stats
      setStats({
        cars: cars.length,
        customers: 500 + Math.floor(Math.random() * 200),
        experience: 5
      });
      
      // Extract images from cars - FIXED to handle both image and image_url
      const imageUrls = [];
      for (const car of cars) {
        if (car.images && car.images.length > 0) {
          // Get the first image from each car
          const firstImage = car.images[0];
          // Try to get image_url first (Cloudinary), then fallback to image (local)
          let imagePath = firstImage.image_url || firstImage.image;
          
          if (imagePath) {
            // If it's a Cloudinary URL (starts with http), use it directly
            if (imagePath.startsWith('http')) {
              imageUrls.push(imagePath);
            } 
            // Otherwise, it's a local path - prepend API_URL
            else {
              imageUrls.push(`${API_URL}${imagePath}`);
            }
          }
        }
      }
      
      // If no images found, use default background
      if (imageUrls.length === 0) {
        setBackgroundImages(['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600']);
      } else {
        setBackgroundImages(imageUrls);
      }
    } catch (error) {
      console.error('Error fetching car images:', error);
      // Set default background image on error
      setBackgroundImages(['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600']);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    if (backgroundImages.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % backgroundImages.length);
    }
  };

  const prevSlide = () => {
    if (backgroundImages.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + backgroundImages.length) % backgroundImages.length);
    }
  };

  const currentImage = backgroundImages[currentIndex] || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600';

  return (
    <div className="relative text-white min-h-screen flex items-center">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: `url(${currentImage})`,
          transition: 'background-image 0.5s ease-in-out'
        }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      </div>
      
      {/* Navigation Arrows - Only show if multiple images */}
      {backgroundImages.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-3 rounded-full transition-all duration-300 z-20"
            aria-label="Previous image"
          >
            <FaChevronLeft size={24} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-3 rounded-full transition-all duration-300 z-20"
            aria-label="Next image"
          >
            <FaChevronRight size={24} />
          </button>
        </>
      )}
      
      {/* Content */}
      <div className="relative container mx-auto px-4 py-20 z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 animate-fade-in">
            Find Your Perfect Ride
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            Discover our premium selection of vehicles. From electric to SUVs, 
            we have the perfect car for every need and budget.
          </p>
          
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/cars')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
            >
              Browse Cars <FaArrowRight />
            </button>
            <button 
              onClick={() => navigate('/contact')}
              className="border-2 border-white hover:bg-white hover:text-blue-600 px-8 py-3 rounded-lg font-semibold transition-all duration-300"
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>
      
      {/* Image counter indicator */}
      {backgroundImages.length > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
          {backgroundImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'bg-white w-8'
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
};

export default Hero;