import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Dialog, DialogContent, CircularProgress } from "@mui/material";
import { baseurl } from "../../Basurl/Baseurl";

const LOCATION_TYPES = [
  "Airport",
  "Hotel",
  "Guest House",
  "Hospital",
  "Residence",
  "Other",
];

const PRESET_MESSAGES = [
  "Pickup delayed by 20 minutes due to heavy traffic near airport.",
  "Driver is on the way to the pickup location.",
  "Driver and vehicle have arrived at Terminal/Pickup location.",
  "Pickup schedule updated. Please check revised details.",
  "Drop completed safely at the destination hospital/hotel.",
];

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export const SendPickDropMessageModal = ({
  open,
  onClose,
  appointment,
  onSuccess,
}) => {
  const [target, setTarget] = useState("both"); // both | patient | driver
  const [channel, setChannel] = useState("all"); // all | whatsapp | email
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [tripForm, setTripForm] = useState({
    pickup_time: "",
    pickup_location: "",
    pickup_location_type: "",
    drop_location: "",
    drop_location_type: "",
    pickup_manager_name: "",
    pickup_manager_phone: "",
    vehicle_no: "",
  });

  useEffect(() => {
    if (appointment) {
      setTripForm({
        pickup_time: appointment.pickup_time || appointment.appointment_Time || "",
        pickup_location: appointment.pickup_location || "",
        pickup_location_type: appointment.pickup_location_type || "",
        drop_location: appointment.drop_location || appointment.hospitalName || "",
        drop_location_type: appointment.drop_location_type || "",
        pickup_manager_name:
          appointment.pickup_manager_name || appointment.driver_name || "Ravi Kumar",
        pickup_manager_phone:
          appointment.pickup_manager_phone ||
          appointment.driver_contact ||
          "9217993173, 7453 034 087",
        vehicle_no: appointment.vehicle_no || "",
      });
      setCustomMessage("");
      setTarget("both");
      setChannel("all");
    }
  }, [appointment]);

  if (!open || !appointment) return null;

  const appointmentId = appointment.appointmentId || appointment._id || appointment.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!appointmentId) {
      Swal.fire("Error", "Appointment ID is required to send notification", "error");
      return;
    }

    const payload = {
      target,
      channel,
      customMessage: customMessage.trim(),
      pickup_time: tripForm.pickup_time,
      pickup_location: tripForm.pickup_location,
      pickup_location_type: tripForm.pickup_location_type,
      drop_location: tripForm.drop_location,
      drop_location_type: tripForm.drop_location_type,
      pickup_manager_name: tripForm.pickup_manager_name,
      pickup_manager_phone: tripForm.pickup_manager_phone,
      vehicle_no: tripForm.vehicle_no,
    };

    setSending(true);
    try {
      const response = await axios.post(
        `${baseurl}send_pick_drop_message/${encodeURIComponent(appointmentId)}`,
        payload,
        { headers: getHeaders() }
      );

      if (response?.data?.success === false) {
        throw new Error(response?.data?.message || "Failed to send message");
      }

      Swal.fire({
        icon: "success",
        title: "Alert Sent Successfully!",
        text:
          response?.data?.message ||
          `Message sent to ${target === "both" ? "Patient & Driver" : target} via ${
            channel === "all" ? "WhatsApp & Email" : channel
          }!`,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed to send alert",
        text:
          err?.response?.data?.message ||
          err?.message ||
          "An error occurred while dispatching the notification.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      scroll="paper"
      className="send-pickdrop-dialog pickdrop-modal-dialog"
      onClose={() => !sending && onClose()}
      sx={{
        "& .MuiDialog-container": {
          height: "100vh !important",
          maxHeight: "100vh !important",
          padding: "12px !important",
          alignItems: "center !important",
          justifyContent: "center !important",
          overflow: "hidden !important",
        },
        "& .MuiDialog-paper, & .MuiPaper-root": {
          margin: "0 !important",
          width: "100% !important",
          height: "min(88vh, 760px) !important",
          maxHeight: "calc(100vh - 24px) !important",
          display: "flex !important",
          flexDirection: "column !important",
          borderRadius: "16px !important",
          overflow: "hidden !important",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35) !important",
          backgroundColor: "#ffffff !important",
        },
      }}
    >
      {/* 1. FIXED MODAL HEADER */}
      <div className="pickdrop-modal-header" style={{ flex: "0 0 auto", background: "linear-gradient(135deg, #047857 0%, #10b981 100%)" }}>
        <div className="header-left">
          <div className="header-icon-box" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
            <i className="fa-brands fa-whatsapp"></i>
          </div>
          <div>
            <h5 className="modal-title">Send Transport Alert / Schedule Notification</h5>
            <p className="modal-subtitle">
              Dispatch instant WhatsApp & Email alerts to patient and/or assigned driver
            </p>
          </div>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          disabled={sending}
          onClick={onClose}
          title="Close modal"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* 2. SCROLLABLE FORM BODY */}
      <div
        className="pickdrop-modal-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <form id="sendMessageForm" onSubmit={handleSubmit}>
          {/* Header recipient summary */}
          <div
            style={{
              padding: "10px 14px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#166534",
            }}
          >
            <strong>Appointment #{appointmentId}</strong> | Patient:{" "}
            <strong>{appointment.patientName || "-"}</strong> (
            {appointment.patientPhone || "-"}) | Driver:{" "}
            <strong>{tripForm.pickup_manager_name || "-"}</strong>
          </div>

          {/* Target and Channel Selectors */}
          <div className="row mb-3">
            <div className="col-md-6 mb-2">
              <label className="form-label fw-bold" style={{ fontSize: 13 }}>
                Recipient Target:
              </label>
              <div className="pill-group">
                {[
                  { key: "both", label: "Both (Patient & Driver)", icon: "fa-users" },
                  { key: "patient", label: "Patient Only", icon: "fa-user" },
                  { key: "driver", label: "Driver Only", icon: "fa-id-card" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`pill-option ${target === item.key ? "active" : ""}`}
                    onClick={() => setTarget(item.key)}
                  >
                    <i className={`fa-solid ${item.icon}`}></i> {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-md-6 mb-2">
              <label className="form-label fw-bold" style={{ fontSize: 13 }}>
                Notification Channel:
              </label>
              <div className="pill-group">
                {[
                  { key: "all", label: "WhatsApp & Email", icon: "fa-bolt" },
                  { key: "whatsapp", label: "WhatsApp Only", icon: "fa-whatsapp" },
                  { key: "email", label: "Email Only", icon: "fa-envelope" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`pill-option ${channel === item.key ? "active" : ""}`}
                    onClick={() => setChannel(item.key)}
                  >
                    <i
                      className={`${
                        item.icon === "fa-whatsapp" ? "fa-brands" : "fa-solid"
                      } ${item.icon}`}
                    ></i>{" "}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick preset message chips */}
          <div className="mb-3">
            <label className="form-label fw-bold" style={{ fontSize: 13 }}>
              Quick Templates (Click to insert):
            </label>
            <div className="quick-msg-chips">
              {PRESET_MESSAGES.map((msg, index) => (
                <button
                  key={index}
                  type="button"
                  className="quick-msg-chip"
                  onClick={() => setCustomMessage(msg)}
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>

          {/* Custom message text area */}
          <div className="mb-3">
            <label className="form-label fw-bold" style={{ fontSize: 13 }}>
              Custom Message / Schedule Note:
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Pickup delayed by 20 minutes due to heavy traffic near airport."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />
          </div>

          {/* Verified Trip Details to include in the Notification */}
          <div className="card mb-3" style={{ background: "#f8fafc" }}>
            <div className="card-body">
              <h6
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f766e",
                  marginBottom: 12,
                }}
              >
                Included Trip & Transport Details (Sent with alert):
              </h6>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Pickup Time
                  </label>
                  <input
                    className="form-control form-control-sm"
                    value={tripForm.pickup_time}
                    onChange={(e) =>
                      setTripForm({ ...tripForm, pickup_time: e.target.value })
                    }
                    placeholder="10:00 AM"
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Pickup Location
                  </label>
                  <input
                    className="form-control form-control-sm"
                    value={tripForm.pickup_location}
                    onChange={(e) =>
                      setTripForm({ ...tripForm, pickup_location: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Pickup Type
                  </label>
                  <select
                    className="form-control form-control-sm"
                    value={tripForm.pickup_location_type}
                    onChange={(e) =>
                      setTripForm({
                        ...tripForm,
                        pickup_location_type: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Location Type</option>
                    {LOCATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-5">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Drop Location
                  </label>
                  <input
                    className="form-control form-control-sm"
                    value={tripForm.drop_location}
                    onChange={(e) =>
                      setTripForm({ ...tripForm, drop_location: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Drop Type
                  </label>
                  <select
                    className="form-control form-control-sm"
                    value={tripForm.drop_location_type}
                    onChange={(e) =>
                      setTripForm({
                        ...tripForm,
                        drop_location_type: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Location Type</option>
                    {LOCATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Vehicle No
                  </label>
                  <input
                    className="form-control form-control-sm"
                    value={tripForm.vehicle_no}
                    onChange={(e) =>
                      setTripForm({ ...tripForm, vehicle_no: e.target.value })
                    }
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Driver / Pickup Manager Name
                  </label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="e.g. Ramesh Kumar"
                    value={tripForm.pickup_manager_name}
                    onChange={(e) =>
                      setTripForm({
                        ...tripForm,
                        pickup_manager_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Driver Contact
                  </label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="+91 98765 43210"
                    value={tripForm.pickup_manager_phone}
                    onChange={(e) =>
                      setTripForm({
                        ...tripForm,
                        pickup_manager_phone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Transport Footer Notice Box */}
          <div className="transport-footer-box">
            <div className="footer-title">
              <i className="fa-solid fa-circle-info"></i> Transport Footer
              (Automatically Appended to All Alerts):
            </div>
            <div>
              <strong>For any queries regarding Transport, Please contact:</strong>
              <br />
              Ravi Kumar - 9217993173, 7453 034 087
              <br />
              Shivam Kumar - 88905 06958
            </div>
          </div>

        </form>
      </div>

      {/* 3. FIXED MODAL FOOTER */}
      <div className="pickdrop-modal-footer">
        <span
          style={{
            fontSize: 12,
            color: "#64748b",
            background: "#f1f5f9",
            padding: "4px 10px",
            borderRadius: "20px",
            fontWeight: 500,
          }}
        >
          <i className="fa-solid fa-paper-plane text-success me-1"></i>
          Target: {target === "both" ? "Both (Patient & Driver)" : target} •{" "}
          Channel: {channel === "all" ? "WhatsApp & Email" : channel}
        </span>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-light"
            disabled={sending}
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1",
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 18px",
              borderRadius: "8px",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-button"
            disabled={sending}
            onClick={handleSubmit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 20px",
              borderRadius: "8px",
              border: "none",
              color: "#fff",
              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
            }}
          >
            {sending ? (
              <>
                <CircularProgress size={16} color="inherit" /> Sending Alert...
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane"></i> Send Alert Now
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default SendPickDropMessageModal;
