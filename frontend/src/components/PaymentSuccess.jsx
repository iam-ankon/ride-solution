import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { FaCheckCircle, FaSpinner, FaHome, FaBook, FaReceipt, FaArrowLeft } from "react-icons/fa";

const API_URL = "https://ride-solution-backend-udox.onrender.com";

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState(null);

  const sessionId = searchParams.get("session_id");
  const bookingRef = searchParams.get("booking_ref");
  const paymentRef = searchParams.get("payment_ref");

  useEffect(() => {
    if (sessionId && bookingRef) {
      verifyPayment();
    }
  }, [sessionId, bookingRef]);

  const verifyPayment = async () => {
    try {
      const paymentAmount = sessionStorage.getItem("last_payment_amount") || "0.00";
      setPaymentInfo({
        bookingReference: bookingRef,
        paymentReference: paymentRef,
        amount: paymentAmount,
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
    } finally {
      setVerifying(false);
      sessionStorage.removeItem("last_payment_amount");
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <FaSpinner className="animate-spin text-blue-600 text-5xl mb-4" />
        <h2 className="text-xl font-semibold">Verifying your payment...</h2>
        <p className="text-gray-600 mt-2">Please wait while we confirm your transaction</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <FaCheckCircle className="text-green-600 text-4xl" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your payment has been processed successfully.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <FaReceipt className="text-blue-500" /> Payment Details:
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Booking Reference:</strong> <span className="font-mono">{paymentInfo?.bookingReference}</span></p>
              <p><strong>Payment Reference:</strong> <span className="font-mono">{paymentInfo?.paymentReference || "N/A"}</span></p>
              <p><strong>Amount Paid:</strong> <span className="font-bold text-green-600">${paymentInfo?.amount}</span></p>
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              to="/my-bookings"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <FaBook /> My Bookings
            </Link>
            <Link
              to="/"
              className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-2"
            >
              <FaHome /> Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;