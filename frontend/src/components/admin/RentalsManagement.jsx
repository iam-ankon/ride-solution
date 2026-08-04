// src/components/admin/RentalsManagement.jsx
import React, { useState, useEffect } from "react";
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaSearch, FaCalendarAlt, FaUser, FaCar, FaMoneyBillWave, FaEye, FaEdit, FaSync } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function RentalsManagement() {
  const [rentals, setRentals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedRental, setSelectedRental] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => { 
    fetchData(); 
  }, [refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch rentals
      const rentalsResponse = await apiClient.get(`/api/admin-dashboard/all-rentals/`);
      console.log("Fetched rentals:", rentalsResponse.data);
      
      // Fetch payments to get accurate payment status
      const paymentsResponse = await apiClient.get(`/api/admin-dashboard/customer-payments/`);
      console.log("Fetched payments:", paymentsResponse.data);
      setPayments(paymentsResponse.data);
      
      // Create a map of rental_id -> payment status
      const paymentMap = new Map();
      paymentsResponse.data.forEach(payment => {
        if (payment.rental && payment.rental.id) {
          if (!paymentMap.has(payment.rental.id)) {
            paymentMap.set(payment.rental.id, {
              signup_paid: false,
              bond_paid: false,
              signup_amount: 0,
              bond_amount: 0,
              weekly_payments: []
            });
          }
          
          const rentalPayments = paymentMap.get(payment.rental.id);
          
          if (payment.payment_type === 'signup' && payment.status === 'completed') {
            rentalPayments.signup_paid = true;
            rentalPayments.signup_amount = payment.amount;
          }
          if (payment.payment_type === 'bond' && payment.status === 'completed') {
            rentalPayments.bond_paid = true;
            rentalPayments.bond_amount = payment.amount;
          }
          if (payment.payment_type === 'weekly' && payment.status === 'completed') {
            rentalPayments.weekly_payments.push(payment);
          }
        }
      });
      
      // Merge payment status with rentals
      const rentalsWithPayments = rentalsResponse.data.map(rental => ({
        ...rental,
        actual_signup_paid: paymentMap.has(rental.id) ? paymentMap.get(rental.id).signup_paid : false,
        actual_bond_paid: paymentMap.has(rental.id) ? paymentMap.get(rental.id).bond_paid : false,
        actual_signup_amount: paymentMap.has(rental.id) ? paymentMap.get(rental.id).signup_amount : (rental.signup_fee_amount || 0),
        actual_bond_amount: paymentMap.has(rental.id) ? paymentMap.get(rental.id).bond_amount : (rental.bond_amount || 0),
        weekly_payments_count: paymentMap.has(rental.id) ? paymentMap.get(rental.id).weekly_payments.length : 0
      }));
      
      setRentals(rentalsWithPayments);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  const updateStatus = async (id, status) => {
    try {
      await apiClient.patch(`/api/admin-dashboard/rental-status/${id}/`, { status });
      refreshData(); // Refresh after update
      alert(`Rental status updated to ${status}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error updating rental status");
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800"
    };
    const labels = {
      pending: "Pending",
      confirmed: "Confirmed",
      active: "Active",
      completed: "Completed",
      cancelled: "Cancelled"
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>;
  };

  const getRentalTypeBadge = (type) => {
    const colors = {
      daily: "bg-blue-100 text-blue-800",
      weekly: "bg-purple-100 text-purple-800",
      rent_to_own: "bg-orange-100 text-orange-800"
    };
    const labels = {
      daily: "Daily",
      weekly: "Weekly",
      rent_to_own: "Rent to Own"
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[type] || colors.weekly}`}>
      {labels[type] || type}
    </span>;
  };

  const viewRentalDetails = async (rental) => {
    // Fetch latest payment status for this rental
    try {
      const paymentsResponse = await apiClient.get(`/api/admin-dashboard/customer-payments/`);
      const rentalPayments = paymentsResponse.data.filter(p => p.rental?.id === rental.id);
      
      const signupPayment = rentalPayments.find(p => p.payment_type === 'signup');
      const bondPayment = rentalPayments.find(p => p.payment_type === 'bond');
      const weeklyPayments = rentalPayments.filter(p => p.payment_type === 'weekly');
      
      const updatedRental = {
        ...rental,
        actual_signup_paid: signupPayment?.status === 'completed',
        actual_bond_paid: bondPayment?.status === 'completed',
        actual_signup_amount: signupPayment?.amount || rental.signup_fee_amount,
        actual_bond_amount: bondPayment?.amount || rental.bond_amount,
        weekly_payments: weeklyPayments
      };
      
      setSelectedRental(updatedRental);
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error fetching payment details:", error);
      setSelectedRental(rental);
      setShowDetailModal(true);
    }
  };

  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = 
      rental.booking_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.car_details?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.car_details?.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || rental.status === filterStatus;
    const matchesType = filterType === "all" || rental.rental_type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate stats
  const totalRentals = rentals.length;
  const activeRentals = rentals.filter(r => r.status === 'active').length;
  const pendingRentals = rentals.filter(r => r.status === 'pending').length;
  const confirmedRentals = rentals.filter(r => r.status === 'confirmed').length;
  const completedRentals = rentals.filter(r => r.status === 'completed').length;
  const totalRevenue = rentals.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0);
  
  // Calculate payment stats from actual payments
  const signupPaidCount = rentals.filter(r => r.actual_signup_paid).length;
  const bondPaidCount = rentals.filter(r => r.actual_bond_paid).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rentals & Bookings Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all customer bookings, update status, and track rental history</p>
        </div>
        <button 
          onClick={refreshData}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
        >
          <FaSync className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-gray-600 text-xs">Total Bookings</p>
          <p className="text-xl font-bold text-blue-600">{totalRentals}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-gray-600 text-xs">Active Rentals</p>
          <p className="text-xl font-bold text-green-600">{activeRentals}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <p className="text-gray-600 text-xs">Signup Fees Paid</p>
          <p className="text-xl font-bold text-purple-600">{signupPaidCount} / {totalRentals}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-gray-600 text-xs">Bonds Paid</p>
          <p className="text-xl font-bold text-orange-600">{bondPaidCount} / {totalRentals}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by booking ref, customer name, email, phone or car..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">All Types</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="rent_to_own">Rent to Own</option>
            </select>
          </div>
          <button 
            onClick={() => { setSearchTerm(""); setFilterStatus("all"); setFilterType("all"); }}
            className="text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Rentals Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Booking Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Car</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Start Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">End Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Total</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Signup</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Bond</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRentals.map((rental) => {
              const startDate = new Date(rental.start_date);
              const endDate = rental.end_date ? new Date(rental.end_date) : null;
              const isActive = rental.status === 'active';
              
              // Use actual payment status from payments API
              const signupPaid = rental.actual_signup_paid;
              const bondPaid = rental.actual_bond_paid;
              
              return (
                <tr key={rental.id} className={`hover:bg-gray-50 ${isActive ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm font-semibold text-blue-600">{rental.booking_reference}</div>
                    <div className="text-xs text-gray-400">ID: {rental.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-1">
                      <FaUser className="text-gray-400 text-xs" />
                      {rental.customer_name}
                    </div>
                    <div className="text-xs text-gray-500">{rental.customer_email}</div>
                    <div className="text-xs text-gray-400">{rental.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <FaCar className="text-gray-400 text-xs" />
                      <span className="font-medium">{rental.car_details?.name || rental.car?.name || 'N/A'}</span>
                    </div>
                    <div className="text-xs text-gray-500">{rental.car_details?.brand} {rental.car_details?.model_year}</div>
                  </td>
                  <td className="px-4 py-3">{getRentalTypeBadge(rental.rental_type)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <FaCalendarAlt className="text-gray-400 text-xs" />
                      <span>{startDate.toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-gray-400">{startDate.toLocaleTimeString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    {endDate ? (
                      <>
                        <div>{endDate.toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{endDate.toLocaleTimeString()}</div>
                      </>
                    ) : (
                      <span className="text-green-600 text-sm font-medium">Ongoing</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-600">
                    ${parseFloat(rental.total_price || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {signupPaid ? 
                      <FaCheckCircle className="text-green-500 inline-block" title="Paid" size={18} /> : 
                      <FaTimesCircle className="text-red-500 inline-block" title="Not Paid" size={18} />}
                    {rental.signup_fee_amount > 0 && (
                      <div className="text-xs text-gray-400">${rental.signup_fee_amount}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {bondPaid ? 
                      <FaCheckCircle className="text-green-500 inline-block" title="Paid" size={18} /> : 
                      rental.bond_amount > 0 ? 
                        <FaTimesCircle className="text-yellow-500 inline-block" title="Pending" size={18} /> :
                        <span className="text-gray-400 text-xs">N/A</span>}
                    {rental.bond_amount > 0 && (
                      <div className="text-xs text-gray-400">${rental.bond_amount}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(rental.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => viewRentalDetails(rental)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Details"
                      >
                        <FaEye />
                      </button>
                      <select 
                        onChange={(e) => updateStatus(rental.id, e.target.value)} 
                        value={rental.status} 
                        className="text-sm border rounded px-2 py-1 bg-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRentals.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FaCar className="text-5xl mx-auto mb-3 text-gray-300" />
            <p>No bookings found.</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Rental Details Modal */}
      {showDetailModal && selectedRental && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Rental Details</h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Booking Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Booking Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Booking Reference:</span> <span className="font-mono font-semibold">{selectedRental.booking_reference}</span></div>
                  <div><span className="text-gray-500">Created:</span> {new Date(selectedRental.created_at).toLocaleString()}</div>
                  <div><span className="text-gray-500">Rental Type:</span> {selectedRental.rental_type}</div>
                  <div><span className="text-gray-500">Status:</span> {getStatusBadge(selectedRental.status)}</div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Customer Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Name:</span> {selectedRental.customer_name}</div>
                  <div><span className="text-gray-500">Email:</span> {selectedRental.customer_email}</div>
                  <div><span className="text-gray-500">Phone:</span> {selectedRental.customer_phone}</div>
                </div>
              </div>

              {/* Car Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Vehicle Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Car:</span> {selectedRental.car_details?.name || selectedRental.car?.name}</div>
                  <div><span className="text-gray-500">Brand:</span> {selectedRental.car_details?.brand || selectedRental.car?.brand}</div>
                  <div><span className="text-gray-500">Model Year:</span> {selectedRental.car_details?.model_year || selectedRental.car?.model_year}</div>
                </div>
              </div>

              {/* Rental Period */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Rental Period</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Start Date:</span> {new Date(selectedRental.start_date).toLocaleString()}</div>
                  <div><span className="text-gray-500">End Date:</span> {selectedRental.end_date ? new Date(selectedRental.end_date).toLocaleString() : "Ongoing"}</div>
                  {selectedRental.days > 0 && <div><span className="text-gray-500">Days:</span> {selectedRental.days}</div>}
                  {selectedRental.weeks > 0 && <div><span className="text-gray-500">Weeks:</span> {selectedRental.weeks}</div>}
                  {selectedRental.months > 0 && <div><span className="text-gray-500">Months:</span> {selectedRental.months}</div>}
                </div>
              </div>

              {/* Payment Info - Using actual payment data */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Payment Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Weekly Price:</span> ${selectedRental.weekly_price}</div>
                  <div><span className="text-gray-500">Total Price:</span> <span className="font-semibold text-green-600">${selectedRental.total_price}</span></div>
                  <div>
                    <span className="text-gray-500">Signup Fee:</span> 
                    <span className={selectedRental.actual_signup_paid ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                      ${selectedRental.actual_signup_amount || selectedRental.signup_fee_amount || 0} 
                      {selectedRental.actual_signup_paid ? "(Paid ✓)" : "(Pending)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bond Amount:</span>
                    <span className={selectedRental.actual_bond_paid ? "text-green-600 ml-2" : selectedRental.bond_amount > 0 ? "text-yellow-600 ml-2" : "text-gray-400 ml-2"}>
                      ${selectedRental.actual_bond_amount || selectedRental.bond_amount || 0}
                      {selectedRental.actual_bond_paid ? "(Paid ✓)" : selectedRental.bond_amount > 0 ? "(Pending)" : "(No Bond)"}
                    </span>
                  </div>
                </div>
                
                {/* Weekly Payments Summary */}
                {selectedRental.weekly_payments && selectedRental.weekly_payments.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Weekly Payments Made: {selectedRental.weekly_payments.length}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRental.weekly_payments.map((payment, idx) => (
                        <span key={idx} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Week {payment.payment_for_week || idx + 1}: ${payment.amount}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Special Requests */}
              {selectedRental.special_requests && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Special Requests</h3>
                  <p className="text-sm text-gray-600">{selectedRental.special_requests}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <select 
                  onChange={async (e) => {
                    await updateStatus(selectedRental.id, e.target.value);
                    setShowDetailModal(false);
                  }} 
                  value={selectedRental.status} 
                  className="flex-1 px-3 py-2 border rounded-lg"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-64">
      <FaSpinner className="animate-spin text-blue-600 text-4xl" />
    </div>
  );
}

export default RentalsManagement;