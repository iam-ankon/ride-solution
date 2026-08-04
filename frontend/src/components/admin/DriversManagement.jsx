// src/components/admin/DriversManagement.jsx
import React, { useState, useEffect } from "react";
import { FaSpinner, FaUser, FaCar, FaCalendarAlt, FaPhone, FaEnvelope, FaSearch, FaExclamationTriangle, FaUsers, FaBookmark, FaMoneyBillWave, FaEdit, FaTrash, FaPlus, FaSync, FaCheckCircle, FaTimesCircle, FaShieldAlt } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function DriversManagement() {
  const [drivers, setDrivers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    name: "", plate_number: "", start_date: "", end_date: "", is_current: true,
    driver_licence_no: "", date_of_birth: "", address: "", phone_number: "", email_address: ""
  });
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, [refreshKey]);

  const fetchAllData = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch drivers with rentals
      const driversResponse = await apiClient.get(`/api/admin-dashboard/all-drivers-with-rentals/`);
      console.log("Drivers response:", driversResponse.data);

      // Fetch payments to get accurate payment status
      const paymentsResponse = await apiClient.get(`/api/admin-dashboard/customer-payments/`);
      console.log("Payments response:", paymentsResponse.data);
      setPayments(paymentsResponse.data);

      // Create payment map for quick lookup
      const paymentMap = new Map();
      paymentsResponse.data.forEach(payment => {
        if (payment.rental && payment.rental.id) {
          if (!paymentMap.has(payment.rental.id)) {
            paymentMap.set(payment.rental.id, {
              signup_paid: false,
              bond_paid: false,
              signup_amount: 0,
              bond_amount: 0,
              weekly_payments: [],
              weekly_total: 0
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
            rentalPayments.weekly_total += parseFloat(payment.amount);
          }
        }
      });

      // Merge payment status with driver rentals
      let driversData = [];
      if (Array.isArray(driversResponse.data)) {
        driversData = driversResponse.data.map(driver => ({
          ...driver,
          rentals: (driver.rentals || []).map(rental => ({
            ...rental,
            actual_signup_paid: paymentMap.has(rental.id) ? paymentMap.get(rental.id).signup_paid : false,
            actual_bond_paid: paymentMap.has(rental.id) ? paymentMap.get(rental.id).bond_paid : false,
            actual_signup_amount: paymentMap.has(rental.id) ? paymentMap.get(rental.id).signup_amount : (rental.signup_fee_amount || 0),
            actual_bond_amount: paymentMap.has(rental.id) ? paymentMap.get(rental.id).bond_amount : (rental.bond_amount || 0),
            weekly_payments_count: paymentMap.has(rental.id) ? paymentMap.get(rental.id).weekly_payments.length : 0,
            weekly_payments_total: paymentMap.has(rental.id) ? paymentMap.get(rental.id).weekly_total : 0
          }))
        }));
      }

      setDrivers(driversData);

      // Fetch vehicles for modal
      const vehiclesResponse = await apiClient.get(`/api/admin-dashboard/all-vehicles/`);
      if (Array.isArray(vehiclesResponse.data)) {
        setVehicles(vehiclesResponse.data);
      } else if (vehiclesResponse.data.results && Array.isArray(vehiclesResponse.data.results)) {
        setVehicles(vehiclesResponse.data.results);
      } else {
        setVehicles([]);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.response?.data?.error || error.message || "Failed to load driver data");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDriver) {
        await apiClient.put(`/api/admin-dashboard/driver/${editingDriver.id}/`, formData);
        alert("Driver updated successfully");
      } else {
        await apiClient.post(`/api/admin-dashboard/drivers/`, formData);
        alert("Driver created successfully");
      }
      refreshData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving driver:", error);
      alert("Error saving driver: " + (error.response?.data?.error || error.message));
    }
  };

  const deleteDriver = async (id) => {
    if (window.confirm("Delete this driver? This will not delete their rental history.")) {
      try {
        await apiClient.delete(`/api/admin-dashboard/driver/${id}/`);
        refreshData();
        alert("Driver deleted successfully");
      } catch (error) {
        console.error("Error deleting driver:", error);
        alert("Error deleting driver");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "", plate_number: "", start_date: "", end_date: "", is_current: true,
      driver_licence_no: "", date_of_birth: "", address: "", phone_number: "", email_address: ""
    });
    setEditingDriver(null);
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name || "",
      plate_number: driver.plate_number || "",
      start_date: driver.start_date || "",
      end_date: driver.end_date || "",
      is_current: driver.is_current !== false,
      driver_licence_no: driver.driver_licence_no || "",
      date_of_birth: driver.date_of_birth || "",
      address: driver.address || "",
      phone_number: driver.phone_number || "",
      email_address: driver.email_address || "",
    });
    setShowModal(true);
  };

  // Filter drivers based on search
  const filteredDrivers = drivers.filter(driver =>
    driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.phone_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    return {
      color: colors[type] || colors.weekly,
      label: labels[type] || type
    };
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
    return {
      color: colors[status] || colors.pending,
      label: labels[status] || status
    };
  };

  // Calculate totals from actual payment data
  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter(d => d.has_active_rental || d.is_current).length;
  const totalBookings = drivers.reduce((sum, d) => sum + (d.total_bookings || 0), 0);
  const totalRevenue = drivers.reduce((sum, d) => sum + (d.total_spent || 0), 0);
  const activeBookings = drivers.reduce((sum, d) => sum + (d.rentals?.filter(r => r.status === 'active').length || 0), 0);

  // Calculate payment stats from actual payments
  let totalSignupPaid = 0;
  let totalBondPaid = 0;
  drivers.forEach(driver => {
    if (driver.rentals) {
      driver.rentals.forEach(rental => {
        if (rental.actual_signup_paid) totalSignupPaid++;
        if (rental.actual_bond_paid) totalBondPaid++;
      });
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-600 text-4xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Drivers Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all drivers (auto-created from rentals + manual entries)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshData}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
          >
            <FaSync /> Refresh
          </button>
          <button onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <FaPlus /> Add Manual Driver
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
          <FaExclamationTriangle className="text-red-500" />
          <span>{error}</span>
          <button onClick={refreshData} className="ml-auto bg-red-100 px-3 py-1 rounded text-red-700 hover:bg-red-200">
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search drivers by name, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <FaUsers className="text-blue-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Drivers</p>
          <p className="text-2xl font-bold text-blue-600">{totalDrivers}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <FaUser className="text-green-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Active Drivers</p>
          <p className="text-2xl font-bold text-green-600">{activeDrivers}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <FaCheckCircle className="text-purple-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Signup Fees Paid</p>
          <p className="text-2xl font-bold text-purple-600">{totalSignupPaid}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <FaShieldAlt className="text-orange-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Bonds Paid</p>
          <p className="text-2xl font-bold text-orange-600">{totalBondPaid}</p>
        </div>
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <FaBookmark className="text-gray-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-700">{totalBookings}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <FaCar className="text-yellow-500 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Active Rentals</p>
          <p className="text-2xl font-bold text-yellow-600">{activeBookings}</p>
        </div>
        <div className="bg-green-100 rounded-xl p-4 text-center">
          <FaMoneyBillWave className="text-green-600 text-2xl mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold text-green-700">${totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Drivers List */}
      {drivers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <FaUsers className="text-5xl mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No drivers found.</p>
          <p className="text-sm text-gray-400 mt-1">Drivers will be auto-created when customers make bookings.</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="mt-3 text-blue-600 hover:text-blue-700"
          >
            Or click here to add a manual driver
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDrivers.map((driver) => (
            <div key={driver.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Driver Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b">
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FaUser className="text-blue-600" />
                      <h3 className="text-lg font-bold">{driver.name}</h3>
                      {driver.has_active_rental && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Currently Renting</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      {driver.email_address && (
                        <span className="flex items-center gap-1">
                          <FaEnvelope className="text-gray-400" />
                          {driver.email_address}
                        </span>
                      )}
                      {driver.phone_number && (
                        <span className="flex items-center gap-1">
                          <FaPhone className="text-gray-400" />
                          {driver.phone_number}
                        </span>
                      )}
                      {driver.plate_number && (
                        <span className="flex items-center gap-1">
                          <FaCar className="text-gray-400" />
                          Assigned: {driver.plate_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-blue-100 rounded-lg px-3 py-1 text-center">
                      <p className="text-xs text-gray-600">Bookings</p>
                      <p className="text-xl font-bold text-blue-600">{driver.total_bookings || 0}</p>
                    </div>
                    <div className="bg-green-100 rounded-lg px-3 py-1 text-center">
                      <p className="text-xs text-gray-600">Total Spent</p>
                      <p className="text-xl font-bold text-green-600">${(driver.total_spent || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(driver)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="Edit Driver"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => deleteDriver(driver.id)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Delete Driver"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rentals Table */}
              {driver.rentals && driver.rentals.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Booking Ref</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Car</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Rental Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Start Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">End Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Signup</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Bond</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {driver.rentals.map((rental) => {
                        const rentalType = getRentalTypeBadge(rental.rental_type);
                        const statusBadge = getStatusBadge(rental.status);
                        const startDate = new Date(rental.start_date);
                        const endDate = rental.end_date ? new Date(rental.end_date) : null;

                        // Use actual payment status from payment records
                        const signupPaid = rental.actual_signup_paid;
                        const bondPaid = rental.actual_bond_paid;

                        return (
                          <tr key={rental.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm font-semibold text-blue-600">
                                {rental.booking_reference}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{rental.car_name}</div>
                              <div className="text-xs text-gray-500">{rental.car_brand}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${rentalType.color}`}>
                                {rentalType.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">{startDate.toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              {endDate ? endDate.toLocaleDateString() :
                                <span className="text-green-600 font-medium">Ongoing</span>}
                            </td>
                            <td className="px-4 py-3 font-semibold text-green-600">
                              ${parseFloat(rental.total_price).toLocaleString()}
                              {rental.weekly_payments_count > 0 && (
                                <div className="text-xs text-gray-500">
                                  {rental.weekly_payments_count} weekly payments (${rental.weekly_payments_total.toLocaleString()})
                                </div>
                              )}
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
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}>
                                {statusBadge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredDrivers.length === 0 && drivers.length > 0 && (
        <div className="text-center py-8 text-gray-500 mt-4">
          No matching drivers found for "{searchTerm}"
        </div>
      )}

      {/* Add/Edit Driver Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingDriver ? "Edit Driver" : "Add Manual Driver"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required placeholder="Full Name *" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />

              <select value={formData.plate_number || ""} onChange={e => setFormData({ ...formData, plate_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select Assigned Vehicle (Optional)</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.plate_number}>{v.plate_number} - {v.manufacturer} {v.model}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-4">
                <input type="date" placeholder="Start Date" value={formData.start_date || ""}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
                <input type="date" placeholder="End Date" value={formData.end_date || ""}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  className="px-3 py-2 border rounded-lg" />
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_current}
                  onChange={e => setFormData({ ...formData, is_current: e.target.checked })} />
                <span>Currently Active</span>
              </label>

              <input type="text" placeholder="Driver Licence No." value={formData.driver_licence_no || ""}
                onChange={e => setFormData({ ...formData, driver_licence_no: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Date of Birth" value={formData.date_of_birth || ""}
                onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="tel" placeholder="Phone Number" value={formData.phone_number || ""}
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <input type="email" placeholder="Email Address" value={formData.email_address || ""}
                onChange={e => setFormData({ ...formData, email_address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Address" value={formData.address || ""}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                rows="2" className="w-full px-3 py-2 border rounded-lg" />

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  Save
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriversManagement;