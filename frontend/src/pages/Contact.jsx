import React, { useState } from "react";
import axios from "axios";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaClock } from "react-icons/fa";

// API URL constant
const API_URL = "https://ride-solution-backend-udox.onrender.com";

function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setSuccess("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const response = await axios.post(`${API_URL}/api/contacts/`, formData);

      console.log("Form submitted:", response.data);
      setSuccess("Thank you for your message! We will get back to you soon.");
      setFormData({ name: "", email: "", subject: "", message: "" });

      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("Error submitting form:", error);
      setError("Something went wrong. Please try again later.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">Contact Us</h1>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Form */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Send us a Message</h2>

              {success && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
                  {success}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Message *</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows="5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={loading}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <FaPhone className="text-blue-600 text-xl mr-4" />
                    <div>
                      <p className="font-semibold">Phone</p>
                      <p className="text-gray-600">0449 596 147</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <FaEnvelope className="text-blue-600 text-xl mr-4" />
                    <div>
                      <p className="font-semibold">Email</p>
                      <p className="text-gray-600">
                        Otobigo247@gmail.com
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <FaMapMarkerAlt className="text-blue-600 text-xl mr-4 mt-1" />
                    <div>
                      <p className="font-semibold">Address</p>
                      <p className="text-gray-600">Unit 402/02 Fordham Way</p>
                      <p className="text-gray-600">
                        Oran Park NSW 2570, Australia
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <FaClock className="text-blue-600 text-xl mr-4" />
                    <div>
                      <p className="font-semibold">Business Hours</p>
                      <p className="text-gray-600">Mon-Fri: 9am - 6pm</p>
                      <p className="text-gray-600">Sat: 10am - 4pm</p>
                      <p className="text-gray-600">Sun: Closed</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google Map */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h3 className="font-semibold mb-3">Find Us</h3>
                <div className="rounded-lg overflow-hidden">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3312.345678901234!2d150.7428!3d-34.0123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b12f01fc6a7f8f9%3A0x1234567890abcdef!2sUnit%20402%2F02%20Fordham%20Way%2C%20Oran%20Park%20NSW%202570%2C%20Australia!5e0!3m2!1sen!2sus!4v1644262076055!5m2!1sen!2sus"
                    width="100%"
                    height="300"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    title="OTOBI GO Location"
                    className="rounded-lg"
                  />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p className="font-semibold">📍 OTOBI GO PTY LTD</p>
                  <p>Unit 402/02 Fordham Way</p>
                  <p>Oran Park NSW 2570, Australia</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;