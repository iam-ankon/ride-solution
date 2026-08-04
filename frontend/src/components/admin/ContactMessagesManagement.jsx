// src/components/admin/ContactMessagesManagement.jsx
import React, { useState, useEffect } from "react";
import { FaTrash, FaSpinner, FaEnvelope, FaUser, FaCalendarAlt, FaCheckCircle, FaReply } from "react-icons/fa";
import { apiClient } from "./AdminDashboard";

function ContactMessagesManagement() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { fetchMessages(); }, [refreshKey]);

  const fetchMessages = async () => {
    try {
      const response = await apiClient.get(`/api/contact/`);
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await apiClient.patch(`/api/contact/${id}/`, { is_read: true });
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  const deleteMessage = async (id) => {
    if (window.confirm("Delete this message?")) {
      try {
        await apiClient.delete(`/api/contact/${id}/`);
        setRefreshKey(prev => prev + 1);
        setSelectedMessage(null);
        alert("Message deleted successfully");
      } catch (error) {
        console.error("Error deleting message:", error);
        alert("Error deleting message");
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Contact Messages</h1>
        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
          {unreadCount} Unread
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="font-semibold">Messages ({messages.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {messages.map((message) => (
              <button
                key={message.id}
                onClick={() => { 
                  setSelectedMessage(message); 
                  if (!message.is_read) markAsRead(message.id); 
                }}
                className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                  selectedMessage?.id === message.id ? "bg-blue-50 border-l-4 border-blue-600" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold">{message.name}</p>
                    <p className="text-sm text-gray-600 truncate">{message.subject}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(message.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    {!message.is_read && (
                      <span className="w-2 h-2 bg-blue-600 rounded-full mb-1"></span>
                    )}
                    <FaEnvelope className={`text-sm ${message.is_read ? "text-gray-300" : "text-blue-500"}`} />
                  </div>
                </div>
              </button>
            ))}
            {messages.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <FaEnvelope className="text-4xl mx-auto mb-2" />
                <p>No messages yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          {selectedMessage ? (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedMessage.subject}</h2>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    <span><FaUser className="inline mr-1" /> {selectedMessage.name}</span>
                    <span><FaEnvelope className="inline mr-1" /> {selectedMessage.email}</span>
                    <span><FaCalendarAlt className="inline mr-1" /> {new Date(selectedMessage.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.location.href = `mailto:${selectedMessage.email}?subject=RE: ${selectedMessage.subject}`}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                    title="Reply"
                  >
                    <FaReply />
                  </button>
                  <button 
                    onClick={() => deleteMessage(selectedMessage.id)} 
                    className="text-red-600 hover:text-red-800 p-2"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => window.location.href = `mailto:${selectedMessage.email}?subject=RE: ${selectedMessage.subject}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FaReply /> Reply via Email
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FaEnvelope className="text-5xl mb-4" />
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
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

export default ContactMessagesManagement;