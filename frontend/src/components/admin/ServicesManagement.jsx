// src/components/admin/ServicesManagement.jsx
// Updated: Added "Fetch Live KM from GPS" button that calls WhatsGPS API
import React, { useState, useEffect } from "react";
import { 
  FaSpinner, FaWrench, FaCar, FaCalendarAlt, FaRoad, FaClock, 
  FaCheckCircle, FaExclamationTriangle, FaSync, FaEdit, FaSave, 
  FaTimes, FaPlus, FaTrash, FaTachometerAlt, FaCalendarCheck,
  FaSatelliteDish
} from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function ServicesManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [editingOdometer, setEditingOdometer] = useState(null);
  const [newOdometerValue, setNewOdometerValue] = useState("");
  const [showRecordServiceModal, setShowRecordServiceModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [serviceFormData, setServiceFormData] = useState({
    service_odometer: "",
    service_date: new Date().toISOString().split("T")[0],
    notes: "",
    driver_name: ""
  });

  // ── WhatsGPS live fetch state ──────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsResult, setGpsResult] = useState(null);   // { updated, vehicles_updated, skipped, errors }
  const [showGpsDetail, setShowGpsDetail] = useState(false);

  useEffect(() => {
    fetchServiceData();
  }, [refreshKey]);

  const fetchServiceData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/admin-dashboard/service-dashboard/`);
      setVehicles(response.data.vehicles || []);
      setSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching service data:", error);
      if (error.response?.status === 500) {
        alert("Database columns missing. Please run the fix-vehicle-table endpoint first.");
      } else {
        alert("Error fetching service data: " + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const syncServiceRecords = async () => {
    if (!window.confirm("Sync vehicle data to service records? This will create/update entries in the ServiceRecord model.")) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await apiClient.post(`/api/admin-dashboard/sync-service-records/`);
      setSyncResult({
        success: true,
        message: response.data.message,
        created: response.data.created,
        updated: response.data.updated,
        errors: response.data.errors || []
      });
      alert(response.data.message);
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSyncResult(null), 5000);
    } catch (error) {
      setSyncResult({
        success: false,
        message: error.response?.data?.error || error.message || "Error syncing service records",
        errors: []
      });
      alert("Error syncing service records");
    } finally {
      setSyncing(false);
    }
  };

  // ── WhatsGPS: fetch live km for ALL vehicles ───────────────────────────────
  const fetchLiveKmFromGPS = async () => {
    if (!window.confirm(
      "Fetch live odometer readings from WhatsGPS?\n\n" +
      "This will call the WhatsGPS API and update the Current Odometer for every vehicle " +
      "that has a GPS device configured.\n\n" +
      "Only readings HIGHER than the current value will be applied."
    )) return;

    setGpsLoading(true);
    setGpsResult(null);

    try {
      const response = await apiClient.post(`/api/admin-dashboard/fetch-gps-odometer/`);
      const data = response.data;
      setGpsResult(data);

      if (data.updated > 0) {
        // Refresh the table so new km values show immediately
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message || "Unknown error";
      setGpsResult({ error: msg, updated: 0 });
    } finally {
      setGpsLoading(false);
    }
  };

  const updateOdometer = async (vehicleId) => {
    if (!newOdometerValue || parseInt(newOdometerValue) < 0) {
      alert("Please enter a valid odometer reading");
      return;
    }
    try {
      const response = await apiClient.post(`/api/admin-dashboard/update-odometer/`, {
        vehicle_id: vehicleId,
        current_odometer: parseInt(newOdometerValue)
      });
      alert(response.data.message);
      setEditingOdometer(null);
      setNewOdometerValue("");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      alert("Error updating odometer: " + (error.response?.data?.error || error.message));
    }
  };

  const recordService = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setServiceFormData({
      service_odometer: vehicle.current_odometer.toString(),
      service_date: new Date().toISOString().split("T")[0],
      notes: "",
      driver_name: vehicle.current_driver?.name || ""
    });
    setShowRecordServiceModal(true);
  };

  const submitServiceRecord = async () => {
    if (!serviceFormData.service_odometer || parseInt(serviceFormData.service_odometer) < 0) {
      alert("Please enter a valid odometer reading");
      return;
    }
    try {
      const response = await apiClient.post(`/api/admin-dashboard/record-service/`, {
        vehicle_id: selectedVehicle.id,
        service_odometer: parseInt(serviceFormData.service_odometer),
        service_date: serviceFormData.service_date,
        notes: serviceFormData.notes,
        driver_name: serviceFormData.driver_name
      });
      alert(response.data.message);
      setShowRecordServiceModal(false);
      setSelectedVehicle(null);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      alert("Error recording service: " + (error.response?.data?.error || error.message));
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'due_now': return <FaExclamationTriangle className="text-red-500" size={18} />;
      case 'due_soon': return <FaClock className="text-yellow-500" size={18} />;
      case 'overdue': return <FaExclamationTriangle className="text-red-700" size={18} />;
      default: return <FaCheckCircle className="text-green-500" size={18} />;
    }
  };

  const getProgressPercentage = (vehicle) => {
    if (!vehicle.service_interval_km || vehicle.service_interval_km <= 0) return 0;
    const used = vehicle.current_odometer - (vehicle.last_service_odometer || 0);
    const percentage = (used / vehicle.service_interval_km) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-600 text-4xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Service Records</h1>
          <p className="text-gray-500 text-sm mt-1">Track vehicle service schedules and odometer readings</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">

          {/* ── NEW: Fetch live KM from WhatsGPS ─────────────────────────── */}
          <button
            onClick={fetchLiveKmFromGPS}
            disabled={gpsLoading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 font-medium shadow"
            title="Pull current odometer readings from WhatsGPS for all vehicles that have a GPS device configured"
          >
            {gpsLoading
              ? <FaSpinner className="animate-spin" />
              : <FaSatelliteDish />}
            {gpsLoading ? "Fetching GPS…" : "Fetch Live KM from GPS"}
          </button>

          <button
            onClick={syncServiceRecords}
            disabled={syncing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
          >
            {syncing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            {syncing ? "Syncing..." : "Sync to Records"}
          </button>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
          >
            <FaSync /> Refresh
          </button>
        </div>
      </div>

      {/* ── GPS Sync Result Banner ──────────────────────────────────────────── */}
      {gpsResult && (
        <div className={`mb-4 p-4 rounded-lg border ${
          gpsResult.error
            ? "bg-red-50 border-red-400"
            : gpsResult.updated > 0
              ? "bg-indigo-50 border-indigo-400"
              : "bg-gray-50 border-gray-300"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {gpsResult.error ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <FaExclamationTriangle className="text-red-500" />
                    <span className="font-semibold text-red-700">GPS Sync Failed</span>
                  </div>
                  <p className="text-red-600 text-sm">{gpsResult.error}</p>
                  <p className="text-xs text-red-400 mt-1">
                    Make sure WHATSGPS_USERNAME and WHATSGPS_PASSWORD are set in your server environment,
                    and that each vehicle's GPS Device has a "New Tracker No" (WhatsGPS carId) configured.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <FaSatelliteDish className="text-indigo-500" />
                    <span className="font-semibold text-indigo-700">
                      GPS Sync Complete — {gpsResult.updated} vehicle{gpsResult.updated !== 1 ? "s" : ""} updated
                    </span>
                  </div>

                  {/* Updated vehicles list */}
                  {gpsResult.vehicles_updated?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {gpsResult.vehicles_updated.map((v, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-indigo-800 bg-indigo-100 rounded px-3 py-1">
                          <FaTachometerAlt className="text-indigo-400 shrink-0" />
                          <span className="font-mono font-semibold w-28 shrink-0">{v.plate}</span>
                          <span className="text-gray-500">{v.old_km.toLocaleString()} km</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-semibold text-indigo-700">{v.new_km.toLocaleString()} km</span>
                          <span className="text-green-600 text-xs ml-auto">+{v.delta_km.toLocaleString()} km</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skipped / errors toggle */}
                  {((gpsResult.skipped?.length > 0) || (gpsResult.errors?.length > 0)) && (
                    <button
                      onClick={() => setShowGpsDetail(p => !p)}
                      className="mt-2 text-xs text-indigo-500 underline"
                    >
                      {showGpsDetail ? "Hide" : "Show"} skipped / errors
                      ({(gpsResult.skipped?.length || 0) + (gpsResult.errors?.length || 0)})
                    </button>
                  )}
                  {showGpsDetail && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                      {gpsResult.skipped?.map((s, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-mono text-gray-500 w-28 shrink-0">{s.plate}</span>
                          <span className="text-gray-400">{s.reason}</span>
                        </div>
                      ))}
                      {gpsResult.errors?.map((e, i) => (
                        <div key={i} className="flex gap-2 text-red-500">
                          <span className="font-mono w-28 shrink-0">{e.plate}</span>
                          <span>{e.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <button onClick={() => { setGpsResult(null); setShowGpsDetail(false); }}
              className="text-gray-400 hover:text-gray-600 shrink-0">
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* ── Sync Result Notification ────────────────────────────────────────── */}
      {syncResult && (
        <div className={`mb-4 p-4 rounded-lg ${syncResult.success ? 'bg-green-50 border border-green-400' : 'bg-red-50 border border-red-400'}`}>
          <div className="flex items-center justify-between">
            <div>
              {syncResult.success
                ? <FaCheckCircle className="text-green-500 text-xl inline mr-2" />
                : <FaExclamationTriangle className="text-red-500 text-xl inline mr-2" />}
              <span className={syncResult.success ? "text-green-700" : "text-red-700"}>
                {syncResult.message}
              </span>
              {syncResult.created !== undefined && (
                <p className="text-sm text-gray-600 mt-1">
                  Created: {syncResult.created} | Updated: {syncResult.updated}
                </p>
              )}
              {syncResult.errors?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer">View errors ({syncResult.errors.length})</summary>
                  <ul className="mt-1 text-xs text-red-500 list-disc list-inside">
                    {syncResult.errors.slice(0, 5).map((err, idx) => <li key={idx}>{err}</li>)}
                    {syncResult.errors.length > 5 && <li>... and {syncResult.errors.length - 5} more errors</li>}
                  </ul>
                </details>
              )}
            </div>
            <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        </div>
      )}

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <FaCar className="text-blue-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Total Vehicles</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total_vehicles}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <FaExclamationTriangle className="text-red-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Service Due Now</p>
            <p className="text-2xl font-bold text-red-600">{summary.due_now}</p>
          </div>
          <div className="bg-red-100 rounded-xl p-4 text-center">
            <FaExclamationTriangle className="text-red-700 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Overdue</p>
            <p className="text-2xl font-bold text-red-700">{summary.overdue}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 text-center">
            <FaClock className="text-yellow-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Due Soon</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.due_soon}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <FaCheckCircle className="text-green-500 text-2xl mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Up to Date</p>
            <p className="text-2xl font-bold text-green-600">{summary.ok}</p>
          </div>
        </div>
      )}

      {/* ── Vehicles Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Driver</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Current Odometer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Last Service</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Next Service</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className={`hover:bg-gray-50 ${
                vehicle.status === 'due_now' ? 'bg-red-50' :
                vehicle.status === 'due_soon' ? 'bg-yellow-50' :
                vehicle.status === 'overdue' ? 'bg-red-100' : ''
              }`}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{vehicle.plate_number}</div>
                  <div className="text-sm text-gray-600">{vehicle.manufacturer} {vehicle.model}</div>
                  <div className="text-xs text-gray-400">{vehicle.year} • {vehicle.colour}</div>
                </td>
                <td className="px-4 py-3">
                  {vehicle.current_driver ? (
                    <>
                      <div className="font-medium">{vehicle.current_driver.name}</div>
                      <div className="text-xs text-gray-500">{vehicle.current_driver.phone}</div>
                    </>
                  ) : (
                    <span className="text-gray-400">No driver assigned</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingOdometer === vehicle.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newOdometerValue}
                        onChange={(e) => setNewOdometerValue(e.target.value)}
                        className="w-32 px-2 py-1 border rounded text-sm"
                        placeholder="km"
                      />
                      <button onClick={() => updateOdometer(vehicle.id)} className="text-green-600 hover:text-green-800" title="Save">
                        <FaSave />
                      </button>
                      <button onClick={() => { setEditingOdometer(null); setNewOdometerValue(""); }} className="text-red-600 hover:text-red-800" title="Cancel">
                        <FaTimes />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FaTachometerAlt className="text-gray-400" />
                      <span className="font-mono font-semibold">{vehicle.current_odometer.toLocaleString()} km</span>
                      <button
                        onClick={() => { setEditingOdometer(vehicle.id); setNewOdometerValue(vehicle.current_odometer.toString()); }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="Edit Odometer Manually"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {vehicle.last_service_date ? (
                    <>
                      <div className="flex items-center gap-1">
                        <FaCalendarCheck className="text-gray-400 text-xs" />
                        <span>{new Date(vehicle.last_service_date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-500">{vehicle.last_service_odometer?.toLocaleString()} km</div>
                      <div className="text-xs text-gray-400">{vehicle.days_since_service} days ago</div>
                    </>
                  ) : (
                    <span className="text-gray-400">No service record</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono font-semibold">{vehicle.next_service_odometer?.toLocaleString()} km</div>
                  <div className="text-xs text-gray-500">
                    {vehicle.km_until_service > 0
                      ? `${vehicle.km_until_service.toLocaleString()} km remaining`
                      : 'Overdue'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        vehicle.status === 'due_now' || vehicle.status === 'overdue' ? 'bg-red-600' :
                        vehicle.status === 'due_soon' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${getProgressPercentage(vehicle)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{getProgressPercentage(vehicle).toFixed(0)}% complete</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(vehicle.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${vehicle.status_color}`}>
                      {vehicle.status_text}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => recordService(vehicle)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                    title="Record Service"
                  >
                    <FaWrench size={12} /> Service
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {vehicles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FaCar className="text-5xl mx-auto mb-3 text-gray-300" />
            <p>No vehicles found.</p>
            <p className="text-sm mt-1">Add vehicles to track service schedules.</p>
            <button onClick={syncServiceRecords} className="mt-3 text-green-600 hover:text-green-700 flex items-center gap-2 mx-auto">
              <FaSync /> Click here to sync service records
            </button>
          </div>
        )}
      </div>

      {/* ── Record Service Modal ───────────────────────────────────────────── */}
      {showRecordServiceModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Record Service</h2>
              <button onClick={() => setShowRecordServiceModal(false)} className="text-gray-500 hover:text-gray-700">
                <FaTimes />
              </button>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedVehicle.plate_number}</p>
              <p className="text-sm text-gray-600">{selectedVehicle.manufacturer} {selectedVehicle.model}</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitServiceRecord(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Odometer (km)</label>
                <input
                  type="number" required
                  value={serviceFormData.service_odometer}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, service_odometer: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter current odometer reading"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
                <input
                  type="date" required
                  value={serviceFormData.service_date}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, service_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
                <input
                  type="text"
                  value={serviceFormData.driver_name}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, driver_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Driver name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={serviceFormData.notes}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, notes: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Service notes, repairs performed, etc."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  Record Service
                </button>
                <button type="button" onClick={() => setShowRecordServiceModal(false)} className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Service Due Now (0 km or less until service)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Due Soon (less than 2,000 km until service)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-700 rounded-full"></div>
            <span>Overdue (exceeded service interval by 5,000+ km)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>OK (more than 2,000 km until service)</span>
          </div>
        </div>

        {/* GPS setup hint */}
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-start gap-2 text-xs text-gray-500">
          <FaSatelliteDish className="text-indigo-400 mt-0.5 shrink-0" />
          <span>
            <strong>"Fetch Live KM from GPS"</strong> pulls the current cumulative mileage from WhatsGPS for every
            vehicle that has a GPS device configured with a <em>New Tracker No</em> (WhatsGPS carId).
            Requires <code>WHATSGPS_USERNAME</code> and <code>WHATSGPS_PASSWORD</code> set as environment variables on the server.
          </span>
        </div>
      </div>
    </div>
  );
}

export default ServicesManagement;
