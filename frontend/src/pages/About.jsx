import React, { useState, useEffect } from "react";
import { FaUsers } from "react-icons/fa";

function About() {
  const [showFullStory, setShowFullStory] = useState(false);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  // Load Elfsight script when component mounts
  useEffect(() => {
    // Check if script already exists
    if (!document.querySelector('script[src="https://elfsightcdn.com/platform.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://elfsightcdn.com/platform.js';
      script.async = true;
      script.onload = () => {
        console.log('Elfsight script loaded');
        setWidgetLoaded(true);
        // Force widget to initialize
        if (window.ElfsightWidget) {
          window.ElfsightWidget.init();
        }
      };
      document.body.appendChild(script);
    } else {
      setWidgetLoaded(true);
      // Re-initialize widget if needed
      if (window.ElfsightWidget) {
        window.ElfsightWidget.init();
      }
    }
  }, []);

  const fullStoryText = `OTOBI GO Pty Ltd was established on 1st November 2019 and is proudly based in Oran Park, Australia. Since its inception, the company has been dedicated to providing reliable, flexible, and innovative transportation solutions to meet the diverse needs of individuals and businesses. With a strong commitment to customer satisfaction and operational excellence, OTOBI GO Pty Ltd continues to grow as a trusted name in the transport and mobility industry.

We operate across two major service areas: vehicle rental services and advanced fleet management solutions. Through these services, we aim to deliver complete transportation support that caters to both personal and commercial requirements.

Our vehicle rental division offers a wide selection of well-maintained cars designed to suit different client needs. We provide car rental services to our clients for personal use, ensuring convenient, reliable, and flexible transportation options. Whether it is for short-term use, long-term rental, or business purposes, we offer affordable and flexible rental plans that are easy to access and tailored to individual requirements. We understand that every client has unique needs, so we focus on delivering solutions that ensure comfort, reliability, and peace of mind.

Beyond vehicle rentals, OTOBI GO Pty Ltd is also a premier partner in transportation management. Based in Oran Park, we provide innovative fleet management and tracking software and hardware solutions tailored for both individual and commercial clients. Our advanced technology solutions are designed to improve efficiency, enhance visibility, and give complete control over fleet operations.

Our fleet management solutions include real-time vehicle tracking, route optimization, maintenance scheduling, and driver behavior monitoring. These features help businesses reduce operational costs, improve safety, and increase overall productivity. We also offer customized solutions to meet specific industry needs, ensuring that our clients can effectively manage their fleets and achieve their business goals.

At OTOBI GO Pty Ltd, we are committed to delivering exceptional service and innovative solutions that meet the evolving needs of our clients. Our team of dedicated professionals is passionate about providing reliable transportation options and cutting-edge fleet management technology. We strive to build long-lasting relationships with our clients by consistently exceeding their expectations and delivering value in every aspect of our business.

Client satisfaction is at the heart of everything we do. We take pride in building long-term relationships based on trust, transparency, and consistent service. Our dedicated team is always ready to assist clients with personalised solutions that match their specific requirements.

We also ensure that all our vehicles are regularly maintained and meet high safety and performance standards. Combined with our responsive customer support, we aim to deliver a smooth and hassle-free experience from start to finish.

OTOBI GO Pty Ltd invites you to connect with us and explore the wide range of services we offer. Whether you are looking for a rental vehicle, a rent-to-own option, or advanced fleet management solutions, we are here to support you every step of the way. Feel free to reach out to us or visit our office to discuss available options. We look forward to serving you with excellence and reliability.`;

  const renderParagraphs = (text) => {
    const paragraphs = text.split('\n\n');
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="text-gray-600 mb-4">
        {paragraph}
      </p>
    ));
  };

  const firstParagraph = fullStoryText.split('\n\n')[0];

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">
          About OTOBI GO
        </h1>

        <div className="max-w-4xl mx-auto">
          {/* Our Story Section */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Our Story</h2>
              
              {!showFullStory ? (
                <p className="text-gray-600 mb-4">{firstParagraph}</p>
              ) : (
                <div>{renderParagraphs(fullStoryText)}</div>
              )}
              
              {!showFullStory && (
                <button
                  onClick={() => setShowFullStory(true)}
                  className="text-blue-600 hover:text-blue-800 font-semibold transition"
                >
                  Read More →
                </button>
              )}
              {showFullStory && (
                <button
                  onClick={() => setShowFullStory(false)}
                  className="text-blue-600 hover:text-blue-800 font-semibold transition mt-2"
                >
                  Show Less ↑
                </button>
              )}
            </div>
          </div>

          {/* Stats and Reviews Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Happy Customers Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <FaUsers className="text-4xl text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">200+ Happy Customers</h3>
              <p className="text-gray-600">
                Trusted by drivers across the country
              </p>
            </div>

            {/* Google Reviews Widget */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-center">
                Google Customer Reviews
              </h3>
              <div 
                className="elfsight-app-8e7e0f61-a94b-4a43-9c4c-8a93965bdc60" 
                data-elfsight-app-lazy
              ></div>
              {!widgetLoaded && (
                <div className="text-center text-gray-500">
                  Loading reviews...
                </div>
              )}
            </div>
          </div>

          {/* Why Choose Us Section */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Why Choose Us?</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">1</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold">Quality Assurance</h3>
                    <p className="text-gray-600">
                      Every vehicle undergoes thorough inspection
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">2</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold">Competitive Pricing</h3>
                    <p className="text-gray-600">Best prices guaranteed</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">3</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold">Excellent Support</h3>
                    <p className="text-gray-600">24/7 customer support</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;