import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Swal from "sweetalert2";
import { updatePickDropStatus } from "../../services/pickDropApi";

const RESCHEDULE_REASONS = [
  "Patient flight delayed",
  "Hospital consultation rescheduled",
  "Patient requested time change",
  "Visa / Arrival formalities delayed",
  "Traffic / Route delay",
  "Emergency schedule change",
];

const TIME_PRESETS = [
  "08:30 AM",
  "10:00 AM",
  "11:30 AM",
  "01:30 PM",
  "03:00 PM",
  "05:00 PM",
  "07:30 PM",
];

export default function ReschedulePickDropModal({
  open,
  onClose,
  appointment,
  pickupManagers = [],
  onSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [driverName, setDriverName] = useState("Ravi Kumar");
  const [driverContact, setDriverContact] = useState("9217993173, 7453 034 087");
  const [vehicleNo, setVehicleNo] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");
  const [sendAlert, setSendAlert] = useState(true);
  const [isCustomDriver, setIsCustomDriver] = useState(false);

  useEffect(() => {
    if (open && appointment) {
      // Default new date to tomorrow or current appointment date
      let defaultDate = "";
      if (appointment.appointment_Date) {
        const d = new Date(appointment.appointment_Date);
        if (!Number.isNaN(d.getTime())) {
          defaultDate = d.toISOString().split("T")[0];
        }
      }
      if (!defaultDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        defaultDate = tomorrow.toISOString().split("T")[0];
      }

      setRescheduleDate(defaultDate);
      setPickupTime(appointment.pickup_time || "11:30 AM");
      setDropTime(appointment.drop_time || "");
      setRescheduleReason(
        appointment.discussionNotes || appointment.notes || "Patient flight delayed by 2 hours"
      );

      const dName =
        appointment.pickup_manager_name ||
        appointment.driver_name ||
        "Ravi Kumar";
      const dPhone =
        appointment.pickup_manager_phone ||
        appointment.driver_contact ||
        (dName === "Ravi Kumar"
          ? "9217993173, 7453 034 087"
          : dName === "Shivam Kumar"
          ? "88905 06958"
          : "");

      const isPreset = dName === "Ravi Kumar" || dName === "Shivam Kumar";
      setDriverName(dName);
      setDriverContact(dPhone);
      setVehicleNo(appointment.vehicle_no || "DL 1Z A 4455");
      setIsCustomDriver(!isPreset);

      setPickupLocation(
        appointment.pickup_location || "Terminal 3, IGI Airport"
      );
      setDropLocation(
        appointment.drop_location || "Fortis Memorial Hospital"
      );
      setSendAlert(true);
    }
  }, [open, appointment]);

  if (!open || !appointment) return null;

  const appointmentId =
    appointment.appointmentId ||
    appointment.id ||
    appointment._id ||
    "";
  const patientName =
    appointment.patientName || appointment.patient_name || "Patient";

  const handleManagerPresetChange = (name) => {
    if (name === "Ravi Kumar") {
      setDriverName("Ravi Kumar");
      setDriverContact("9217993173, 7453 034 087");
      setIsCustomDriver(false);
    } else if (name === "Shivam Kumar") {
      setDriverName("Shivam Kumar");
      setDriverContact("88905 06958");
      setIsCustomDriver(false);
    } else {
      setDriverName("");
      setDriverContact("");
      setIsCustomDriver(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rescheduleDate) {
      return Swal.fire("Validation Error", "Please select a reschedule date", "warning");
    }
    if (!pickupTime) {
      return Swal.fire("Validation Error", "Please enter a pickup time", "warning");
    }
    if (!rescheduleReason.trim()) {
      return Swal.fire("Validation Error", "Please provide a reason for rescheduling", "warning");
    }

    const payload = {
      pickDropStatus: "Rescheduled",
      status: "Rescheduled",
      rescheduleDate,
      newDate: rescheduleDate,
      pickup_time: pickupTime,
      drop_time: dropTime,
      rescheduleReason: rescheduleReason.trim(),
      notes: rescheduleReason.trim(),
      discussionNotes: rescheduleReason.trim(),
      driver_name: driverName,
      driver_contact: driverContact,
      vehicle_no: vehicleNo,
      pickup_location: pickupLocation,
      drop_location: dropLocation,
      sendAlert: Boolean(sendAlert),
    };

    setSubmitting(true);
    try {
      const response = await updatePickDropStatus(appointmentId, payload);

      Swal.fire({
        icon: "success",
        title: "Ride Rescheduled!",
        html: `
          <div style="text-align: left; font-size: 13.5px; color: #334155; line-height: 1.5;">
            <p><strong>Appointment #${appointmentId}</strong> has been updated to <strong>Rescheduled</strong>.</p>
            <ul style="padding-left: 20px; margin: 8px 0;">
              <li><strong>New Date:</strong> ${rescheduleDate}</li>
              <li><strong>Pickup Time:</strong> ${pickupTime}</li>
              <li><strong>Driver:</strong> ${driverName} (${driverContact || "N/A"})</li>
            </ul>
            ${
              sendAlert
                ? '<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 10px; color: #065f46; font-size: 12px;"><i class="fa-brands fa-whatsapp text-success me-1"></i> Automated WhatsApp notifications dispatched to Patient & Driver.</div>'
                : ""
            }
          </div>
        `,
        timer: 3500,
        showConfirmButton: true,
      });

      if (onSuccess) onSuccess(response);
      onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Reschedule Failed",
        text: err.message || "Failed to reschedule pick and drop ride",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !submitting && onClose()}
      fullWidth
      maxWidth="md"
      scroll="paper"
      className="reschedule-pickdrop-dialog pickdrop-modal-dialog"
      sx={{
        "& .MuiDialog-container": {
          height: "100vh !important",
          maxHeight: "100vh !important",
          padding: { xs: "8px", sm: "16px" },
          alignItems: "center !important",
          justifyContent: "center !important",
          overflow: "hidden !important",
        },
        "& .MuiDialog-paper, & .MuiPaper-root": {
          width: "100% !important",
          maxWidth: "820px !important",
          height: "min(90vh, 780px) !important",
          maxHeight: "calc(100vh - 32px) !important",
          display: "flex !important",
          flexDirection: "column !important",
          borderRadius: "14px !important",
          overflow: "hidden !important",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35) !important",
          margin: "auto !important",
          backgroundColor: "#ffffff !important",
        },
      }}
    >
      {/* Sticky Header */}
      <div
        className="pickdrop-modal-header"
        style={{
          background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
          padding: "14px 20px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flex: "0 0 auto",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2.5">
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <i className="fa-solid fa-calendar-days text-white" />
          </div>
          <div>
            <h5 className="m-0 fw-bold text-white" style={{ fontSize: "16px", lineHeight: 1.25 }}>
              Reschedule Pick & Drop Ride
            </h5>
            <small style={{ color: "rgba(255,255,255,0.88)", fontSize: "11.5px" }}>
              Update schedule, assign driver, and automatically dispatch WhatsApp alerts
            </small>
          </div>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <div
        className="pickdrop-modal-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          maxHeight: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px 20px",
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          overscrollBehavior: "contain",
        }}
      >
        {/* Current Appointment Overview Card */}
        <div
          className="card border-0 shadow-sm"
          style={{
            borderRadius: "10px",
            background: "#ffffff",
            borderLeft: "4px solid #f59e0b",
          }}
        >
          <div className="card-body p-2.5 px-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2.5">
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "17px",
                    flexShrink: 0,
                  }}
                >
                  {patientName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: "14.5px" }}>
                    {patientName}
                  </h6>
                  <div className="small text-muted d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: "11.5px" }}>
                    <span>
                      <strong>Appt:</strong> #{appointmentId}
                    </span>
                    {appointment.patientId && <span>• ID: {appointment.patientId}</span>}
                    {appointment.patientPhone && <span>• {appointment.patientPhone}</span>}
                    {appointment.hospitalName && <span>• {appointment.hospitalName}</span>}
                  </div>
                </div>
              </div>

              <div>
                <span
                  className="badge px-2.5 py-1.5"
                  style={{
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    fontSize: "11px",
                  }}
                >
                  Current Status: {appointment.pickDropStatus || appointment.status || "Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <form id="rescheduleForm" onSubmit={handleSubmit}>
          {/* Section 1: New Timing & Date */}
          <div
            className="card border-0 shadow-sm mb-3"
            style={{ borderRadius: "10px", background: "#ffffff" }}
          >
            <div className="card-header bg-transparent border-bottom-0 pb-1 pt-2.5 px-3">
              <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "13.5px" }}>
                <i className="fa-solid fa-clock text-warning me-1.5" />
                1. New Schedule & Pickup Timing
              </h6>
            </div>
            <div className="card-body p-3 pt-2">
              <div className="row g-2.5">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    New Appointment Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    required
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    New Pickup Time <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. 11:30 AM"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    required
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                  {/* Time preset chips */}
                  <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="btn btn-sm btn-light border py-0 px-1.5"
                        style={{
                          fontSize: "10px",
                          borderRadius: "4px",
                          color: pickupTime === preset ? "#b45309" : "#64748b",
                          fontWeight: pickupTime === preset ? 600 : 400,
                          backgroundColor: pickupTime === preset ? "#fef3c7" : "#f8fafc",
                          borderColor: pickupTime === preset ? "#fde68a" : "#e2e8f0",
                        }}
                        onClick={() => setPickupTime(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-md-12">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Reason for Rescheduling <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Patient flight delayed by 2 hours"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    required
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                  {/* Quick Reason pills */}
                  <div className="d-flex align-items-center gap-1 mt-1.5 flex-wrap">
                    {RESCHEDULE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className="btn btn-sm btn-light border py-0 px-1.5"
                        style={{
                          fontSize: "10px",
                          borderRadius: "4px",
                          color: rescheduleReason === reason ? "#b45309" : "#64748b",
                          fontWeight: rescheduleReason === reason ? 600 : 400,
                          backgroundColor: rescheduleReason === reason ? "#fef3c7" : "#f8fafc",
                          borderColor: rescheduleReason === reason ? "#fde68a" : "#e2e8f0",
                        }}
                        onClick={() => setRescheduleReason(reason)}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Driver & Vehicle Assignment */}
          <div
            className="card border-0 shadow-sm mb-3"
            style={{ borderRadius: "10px", background: "#ffffff" }}
          >
            <div className="card-header bg-transparent border-bottom-0 pb-1 pt-2.5 px-3">
              <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "13.5px" }}>
                <i className="fa-solid fa-id-card text-primary me-1.5" />
                2. Driver & Vehicle Details
              </h6>
            </div>
            <div className="card-body p-3 pt-2">
              <div className="row g-2.5">
                <div className="col-md-12">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Select Pickup Manager / Driver Preset
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={isCustomDriver ? "Other" : driverName}
                    onChange={(e) => handleManagerPresetChange(e.target.value)}
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  >
                    <option value="Ravi Kumar">Ravi Kumar (9217993173, 7453 034 087)</option>
                    <option value="Shivam Kumar">Shivam Kumar (88905 06958)</option>
                    <option value="Other">Other (Custom Driver / Vehicle)</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Driver Name
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={driverName}
                    disabled={!isCustomDriver}
                    onChange={(e) => setDriverName(e.target.value)}
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Driver Contact Phone
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={driverContact}
                    disabled={!isCustomDriver}
                    onChange={(e) => setDriverContact(e.target.value)}
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. DL 1Z A 4455"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Locations & Alert Dispatches */}
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "10px", background: "#ffffff" }}
          >
            <div className="card-header bg-transparent border-bottom-0 pb-1 pt-2.5 px-3">
              <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "13.5px" }}>
                <i className="fa-solid fa-map-location-dot text-danger me-1.5" />
                3. Pickup & Drop Locations
              </h6>
            </div>
            <div className="card-body p-3 pt-2">
              <div className="row g-2.5">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Pickup Location / Airport Landmark
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: "11px" }}>
                    Drop Destination / Hospital
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    style={{ borderRadius: "7px", fontSize: "12.5px" }}
                  />
                </div>

                {/* WhatsApp & CRM Alert Toggle */}
                <div className="col-12 mt-2">
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className="fa-brands fa-whatsapp text-success fs-5" />
                      <div>
                        <strong style={{ fontSize: "12.5px", color: "#166534" }}>
                          Dispatch WhatsApp & CRM Alerts Automatically
                        </strong>
                        <small className="d-block text-muted" style={{ fontSize: "11px" }}>
                          Sends WhatsApp notification to patient with new date/time & notifies driver of the duty
                        </small>
                      </div>
                    </div>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={sendAlert}
                          onChange={(e) => setSendAlert(e.target.checked)}
                          color="success"
                          size="small"
                        />
                      }
                      label=""
                      sx={{ m: 0 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Sticky Bottom Footer */}
      <div
        className="pickdrop-modal-footer"
        style={{
          padding: "12px 20px",
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          flex: "0 0 auto",
        }}
      >
        <span className="small text-muted" style={{ fontSize: "11.5px" }}>
          Rescheduling sets status to <strong>Rescheduled</strong> and syncs treatment timeline.
        </span>

        <div className="d-flex align-items-center gap-2 ms-auto">
          <button
            type="button"
            className="btn btn-light btn-sm border text-secondary fw-semibold"
            disabled={submitting}
            onClick={onClose}
            style={{ borderRadius: "6px", padding: "6px 16px", fontSize: "12.5px" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="rescheduleForm"
            className="btn btn-warning btn-sm fw-bold shadow-sm"
            disabled={submitting}
            style={{
              backgroundColor: "#d97706",
              borderColor: "#d97706",
              color: "#ffffff",
              borderRadius: "6px",
              padding: "6px 20px",
              fontSize: "12.5px",
            }}
          >
            {submitting ? (
              <>
                <CircularProgress size={14} color="inherit" className="me-1" />
                Rescheduling...
              </>
            ) : (
              <>
                <i className="fa-solid fa-calendar-check me-1.5" />
                Confirm Reschedule
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
