import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">OTOBI GO</h3>
            <p className="text-gray-400">
              Your trusted partner for quality vehicles and exceptional service.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-400 hover:text-white">Home</Link></li>
              <li><Link to="/cars" className="text-gray-400 hover:text-white">Cars</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-white">About Us</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-white">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Info</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Monday to friday 8am to 6pm</li>
              <li>20 merino Crescent Airds 2560</li>
              <li>Phone: 0449 596 147</li>
              <li>Email: Otobigo247@gmail.com</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Follow Us</h4>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/RideSolutionsPtyLtd" className="text-gray-400 hover:text-white text-2xl">
                <FaFacebook />
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-2xl">
                <FaTwitter />
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-2xl">
                <FaInstagram />
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-2xl">
                <FaLinkedin />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2019 OTOBI GO PTY LTD. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;