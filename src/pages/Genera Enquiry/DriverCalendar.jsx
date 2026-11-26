import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  Box,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import { baseurl } from "../../Basurl/Baseurl";

const STATUS_COLORS = {
  New: { bg: "#eef2ff", color: "#1e1b4b", border: "#4f46e5" },
  Pending: { bg: "#fff7ed", color: "#7c2d12", border: "#ea580c" },
  "In Process": { bg: "#eff6ff", color: "#1e3a8a", border: "#2563eb" },
  "Picked Up": { bg: "#ecfeff", color: "#164e63", border: "#0891b2" },
  "On the Way": { bg: "#f5f3ff", color: "#4c1d95", border: "#7c3aed" },
  Dropped: { bg: "#fdf4ff", color: "#701a75", border: "#c026d3" },
  Completed: { bg: "#ecfdf5", color: "#064e3b", border: "#059669" },
  Cancelled: { bg: "#fef2f2", color: "#7f1d1d", border: "#dc2626" },
  Rescheduled: { bg: "#fef3c7", color: "#92400e", border: "#f59e0b" },
};

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export const DriverCalendar = ({
  pickupManagers = [],
  onOpenEdit,
  onOpenMessage,
  onOpenReschedule,
}) => {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("all");
  const [driverMetrics, setDriverMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDuty, setSelectedDuty] = useState(null);
  const [currentRange, setCurrentRange] = useState({
    start: null,
    end: null,
  });

  // State for floating hover popover
  const [hoverInfo, setHoverInfo] = useState(null);
  const hideTimerRef = useRef(null);

  const fetchCalendarData = useCallback(
    async (driver = "all", range = null) => {
      setLoading(true);
      try {
        const now = new Date();
        const params = new URLSearchParams();
        params.set("driver", driver || "all");

        if (range?.start && range?.end) {
          const startIso = range.start.toISOString().split("T")[0];
          const endIso = range.end.toISOString().split("T")[0];
          params.set("startDate", startIso);
          params.set("endDate", endIso);
          params.set("month", String(range.start.getMonth() + 1));
          params.set("year", String(range.start.getFullYear()));
        } else {
          params.set("month", String(now.getMonth() + 1));
          params.set("year", String(now.getFullYear()));
          params.set("date", now.toISOString().split("T")[0]);
        }

        const response = await axios.get(
          `${baseurl}get_driver_calendar_schedule?${params.toString()}`,
          { headers: getHeaders() }
        );

        if (response.data && response.data.success !== false) {
          const rawEvents =
            response.data.calendarEvents ||
            response.data.events ||
            (Array.isArray(response.data.data) ? response.data.data : []);

          // Normalize events for FullCalendar with robust field fallbacks
          const formatted = rawEvents.map((evt, idx) => {
            const duty = evt.extendedProps || evt;
            const statusKey = duty.pickDropStatus || duty.status || "Pending";
            const tone = STATUS_COLORS[statusKey] || {
              bg: "#f1f5f9",
              color: "#1e293b",
              border: "#64748b",
            };

            const appointmentId = String(
              duty.appointmentId || evt.id || duty.id || duty._id || `appt-${idx}`
            );
            const patientName =
              duty.patientName || duty.patient_name || duty.name || "-";
            const patientPhone =
              duty.patientPhone || duty.patient_phone || duty.phone || "-";
            const patientId = duty.patientId || duty.patient_id || "-";
            const hospitalName =
              duty.hospitalName || duty.hospital_name || duty.hospital || "-";
            const pickupTime =
              duty.pickup_time || duty.pickupTime || duty.appointment_Time || "-";
            const dropTime = duty.drop_time || duty.dropTime || "-";
            const pickupLocation =
              duty.pickup_location || duty.pickupLocation || "-";
            const pickupType =
              duty.pickup_location_type || duty.pickupLocationType || "Airport";
            const dropLocation =
              duty.drop_location || duty.dropLocation || "-";
            const dropType =
              duty.drop_location_type || duty.dropLocationType || "Hospital";
            const vehicleNo = duty.vehicle_no || duty.vehicleNo || "-";
            const driverName =
              duty.driver_name ||
              duty.driverName ||
              duty.pickup_manager_name ||
              duty.pickupManager ||
              "Unassigned";
            const driverContact =
              duty.driver_contact ||
              duty.driverContact ||
              duty.pickup_manager_phone ||
              "-";
            const notes = duty.notes || duty.note || "";

            // Construct valid start date/time
            let startDate = evt.start;
            if (!startDate && (duty.appointment_Date || duty.date)) {
              startDate = String(duty.appointment_Date || duty.date).substring(0, 10);
            }

            return {
              id: appointmentId,
              title: `${patientName} (${statusKey})`,
              start: startDate || new Date(),
              end: evt.end || undefined,
              allDay: true,
              backgroundColor: tone.bg,
              borderColor: tone.border,
              textColor: tone.color,
              extendedProps: {
                appointmentId,
                patientName,
                patientPhone,
                patientId,
                hospitalName,
                pickup_time: pickupTime,
                drop_time: dropTime,
                pickup_location: pickupLocation,
                pickup_location_type: pickupType,
                drop_location: dropLocation,
                drop_location_type: dropType,
                vehicle_no: vehicleNo,
                driver_name: driverName,
                driver_contact: driverContact,
                pickDropStatus: statusKey,
                notes,
                raw: duty,
              },
            };
          });

          setEvents(formatted);
          setDriverMetrics(response.data.driverMetrics || {});
        }
      } catch (err) {
        console.error("Failed to load driver calendar:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchCalendarData(selectedDriver, currentRange);
  }, [selectedDriver, currentRange, fetchCalendarData]);

  const handleDatesSet = (dateInfo) => {
    setCurrentRange({
      start: dateInfo.start,
      end: dateInfo.end,
    });
  };

  const handleEventClick = (info) => {
    // Hide hover popover immediately on click
    setHoverInfo(null);
    const duty = info.event.extendedProps;
    setSelectedDuty(duty);
  };

  // Hover handlers for floating duty preview
  const handleEventMouseEnter = (info) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const rect = info.el.getBoundingClientRect();
    const duty = info.event.extendedProps;
    setHoverInfo({
      duty,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  const handleEventMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setHoverInfo(null);
    }, 120);
  };

  // Custom FullCalendar event content rendering inside calendar cells
  const renderEventContent = (eventInfo) => {
    const duty = eventInfo.event.extendedProps || {};
    const statusKey = duty.pickDropStatus || "Pending";
    const tone = STATUS_COLORS[statusKey] || {
      bg: "#f8fafc",
      color: "#1e293b",
      border: "#64748b",
    };
    const time =
      duty.pickup_time && duty.pickup_time !== "-"
        ? duty.pickup_time
        : eventInfo.timeText || "";
    const isUnassigned =
      !duty.driver_name ||
      duty.driver_name === "-" ||
      duty.driver_name.toLowerCase().includes("unassigned");

    return (
      <div
        className="custom-calendar-event"
        style={{
          borderLeft: `4px solid ${tone.border}`,
          backgroundColor: tone.bg,
          color: tone.color,
        }}
      >
        <div className="event-header-row">
          {time && (
            <span className="event-time-pill">
              <i className="fa-solid fa-clock me-1" style={{ fontSize: 9 }}></i>
              {time}
            </span>
          )}
          <span
            className="event-status-pill"
            style={{
              backgroundColor: tone.border,
              color: "#fff",
            }}
          >
            {statusKey}
          </span>
        </div>

        <div className="event-patient-row" title={duty.patientName}>
          <i
            className="fa-solid fa-user me-1 text-secondary"
            style={{ fontSize: 9 }}
          ></i>
          <strong>
            {duty.patientName && duty.patientName !== "-"
              ? duty.patientName
              : "Duty"}
          </strong>
          {duty.patientId && duty.patientId !== "-" && (
            <span className="event-patient-id-sub">({duty.patientId})</span>
          )}
        </div>

        <div className="event-driver-row">
          {isUnassigned ? (
            <span className="event-driver-unassigned">
              <i className="fa-solid fa-triangle-exclamation me-1"></i>
              Unassigned Driver
            </span>
          ) : (
            <span className="event-driver-assigned" title={duty.driver_name}>
              <i className="fa-solid fa-car me-1" style={{ fontSize: 9 }}></i>
              {duty.driver_name}
              {duty.vehicle_no &&
                duty.vehicle_no !== "-" &&
                ` • ${duty.vehicle_no}`}
            </span>
          )}
        </div>

        {duty.pickup_location && duty.pickup_location !== "-" && (
          <div
            className="event-route-row"
            title={`${duty.pickup_location} → ${duty.drop_location}`}
          >
            <i
              className="fa-solid fa-location-dot me-1 text-danger"
              style={{ fontSize: 9 }}
            ></i>
            <span>{duty.pickup_location}</span>
          </div>
        )}
      </div>
    );
  };

  // Render floating hover popover on document.body via Portal
  const renderHoverPopover = () => {
    if (!hoverInfo) return null;
    const { duty, rect } = hoverInfo;
    const popoverWidth = 350;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < 16) left = 16;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }

    const showAbove = rect.top > 320;
    const top = showAbove ? rect.top - 10 : rect.bottom + 10;
    const statusKey = duty.pickDropStatus || "Pending";
    const statusTone = STATUS_COLORS[statusKey] || {
      bg: "#f8fafc",
      color: "#1e293b",
      border: "#64748b",
    };

    return ReactDOM.createPortal(
      <div
        className="duty-hover-popover"
        style={{
          position: "fixed",
          top,
          left,
          width: popoverWidth,
          transform: showAbove ? "translateY(-100%)" : "none",
          zIndex: 999999,
          pointerEvents: "none",
        }}
      >
        {/* Header */}
        <div
          className="popover-header"
          style={{ borderLeft: `4px solid ${statusTone.border}` }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <span className="popover-appt-id">
              <i className="fa-solid fa-hashtag me-1"></i>
              {duty.appointmentId}
            </span>
            <span
              className="popover-status-badge"
              style={{
                background: statusTone.bg,
                color: statusTone.color,
                border: `1px solid ${statusTone.border}`,
              }}
            >
              {statusKey}
            </span>
          </div>
          <div className="popover-patient-name">
            <i className="fa-solid fa-user-circle me-1 text-primary"></i>
            {duty.patientName}
            {duty.patientPhone && duty.patientPhone !== "-" && (
              <span className="popover-phone ms-2">
                <i className="fa-solid fa-phone ms-1 me-1"></i>
                {duty.patientPhone}
              </span>
            )}
          </div>
          {duty.patientId && duty.patientId !== "-" && (
            <div className="popover-patient-id">
              ID: <strong>{duty.patientId}</strong>
              {duty.hospitalName && duty.hospitalName !== "-" && (
                <> • {duty.hospitalName}</>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="popover-body">
          {/* Pickup */}
          <div className="popover-route-row">
            <div className="route-icon pickup-dot"></div>
            <div className="route-content">
              <div className="route-label">
                <span>PICKUP</span>
                {duty.pickup_time && duty.pickup_time !== "-" && (
                  <strong className="route-time">
                    <i className="fa-solid fa-clock me-1"></i>
                    {duty.pickup_time}
                  </strong>
                )}
                <span
                  className={`location-type-badge location-type-${(
                    duty.pickup_location_type || "airport"
                  )
                    .toLowerCase()
                    .replace(/\s+/g, "")}`}
                >
                  {duty.pickup_location_type || "Airport"}
                </span>
              </div>
              <div className="route-address">{duty.pickup_location}</div>
            </div>
          </div>

          {/* Route connector line */}
          <div className="route-connector-line"></div>

          {/* Drop */}
          <div className="popover-route-row">
            <div className="route-icon drop-dot"></div>
            <div className="route-content">
              <div className="route-label">
                <span>DROP</span>
                {duty.drop_time && duty.drop_time !== "-" && (
                  <strong className="route-time">
                    <i className="fa-solid fa-clock me-1"></i>
                    {duty.drop_time}
                  </strong>
                )}
                <span
                  className={`location-type-badge location-type-${(
                    duty.drop_location_type || "hospital"
                  )
                    .toLowerCase()
                    .replace(/\s+/g, "")}`}
                >
                  {duty.drop_location_type || "Hospital"}
                </span>
              </div>
              <div className="route-address">{duty.drop_location}</div>
            </div>
          </div>

          {/* Driver & Vehicle */}
          <div className="popover-driver-box">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="driver-label">DRIVER / PICKUP MANAGER</span>
                <div className="driver-name">
                  <i className="fa-solid fa-id-card me-1 text-secondary"></i>
                  <strong>{duty.driver_name}</strong>
                </div>
                {duty.driver_contact && duty.driver_contact !== "-" && (
                  <div className="driver-phone">
                    <i className="fa-solid fa-phone me-1" style={{ fontSize: 9 }}></i>
                    {duty.driver_contact}
                  </div>
                )}
              </div>
              {duty.vehicle_no && duty.vehicle_no !== "-" && (
                <div className="vehicle-badge">
                  <i className="fa-solid fa-car-side me-1"></i>
                  {duty.vehicle_no}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {duty.notes && duty.notes !== "-" && duty.notes.trim() !== "" && (
            <div className="popover-notes">
              <i className="fa-solid fa-circle-info me-1 text-muted"></i>
              <span>{duty.notes}</span>
            </div>
          )}

          {/* Footer hint */}
          <div className="popover-footer-hint">
            <i className="fa-solid fa-arrow-pointer me-1"></i>
            Click duty card to edit status or send WhatsApp alert
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="driver-calendar-section">
      {/* Driver Filter & Quick Controls Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              margin: 0,
            }}
          >
            Filter by Driver:
          </label>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              sx={{
                background: "#fff",
                fontSize: 13,
                borderRadius: "6px",
                "& .MuiSelect-select": { py: "6px" },
              }}
            >
              <MenuItem value="all">
                <em>All Drivers / Managers</em>
              </MenuItem>
              {pickupManagers
                .filter((m) => m.name && m.id !== "other")
                .map((m) => (
                  <MenuItem key={m.id || m.name} value={m.name}>
                    {m.name} {m.phone ? `(${m.phone.split(",")[0]})` : ""}
                  </MenuItem>
                ))}
              {!pickupManagers.some((m) => m.name === "Ravi Kumar") && (
                <MenuItem value="Ravi Kumar">Ravi Kumar</MenuItem>
              )}
              {!pickupManagers.some((m) => m.name === "Shivam Kumar") && (
                <MenuItem value="Shivam Kumar">Shivam Kumar</MenuItem>
              )}
            </Select>
          </FormControl>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => fetchCalendarData(selectedDriver, currentRange)}
            disabled={loading}
            style={{
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <i className="fa-solid fa-arrows-rotate"></i>
            )}
            Refresh Schedule
          </button>
        </div>
      </div>

      {/* Driver Metrics Summary Cards */}
      <div className="driver-metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h5>
              {driverMetrics.totalTrips ??
                driverMetrics.totalDuties ??
                events.length}
            </h5>
            <span>Total Schedule Duties</span>
          </div>
          <div
            className="metric-icon"
            style={{ background: "#e0f2fe", color: "#0284c7" }}
          >
            <i className="fa-solid fa-car"></i>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h5>
              {driverMetrics.pickedUp ??
                driverMetrics.inProgress ??
                events.filter(
                  (e) =>
                    e.extendedProps?.pickDropStatus === "Picked Up" ||
                    e.extendedProps?.pickDropStatus === "In Process" ||
                    e.extendedProps?.pickDropStatus === "On the Way"
                ).length}
            </h5>
            <span>Active / On The Way</span>
          </div>
          <div
            className="metric-icon"
            style={{ background: "#fef3c7", color: "#d97706" }}
          >
            <i className="fa-solid fa-route"></i>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h5>
              {driverMetrics.completedTrips ??
                driverMetrics.dropped ??
                events.filter(
                  (e) =>
                    e.extendedProps?.pickDropStatus === "Dropped" ||
                    e.extendedProps?.pickDropStatus === "Completed"
                ).length}
            </h5>
            <span>Completed / Dropped</span>
          </div>
          <div
            className="metric-icon"
            style={{ background: "#d1fae5", color: "#059669" }}
          >
            <i className="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h5>
              {driverMetrics.pendingTrips ??
                events.filter(
                  (e) =>
                    e.extendedProps?.pickDropStatus === "New" ||
                    e.extendedProps?.pickDropStatus === "Pending"
                ).length}
            </h5>
            <span>Scheduled / Pending</span>
          </div>
          <div
            className="metric-icon"
            style={{ background: "#ede9fe", color: "#7c3aed" }}
          >
            <i className="fa-solid fa-clock"></i>
          </div>
        </div>
      </div>

      {/* FullCalendar Component with eventDisplay="block" and custom eventContent */}
      <div className="driver-calendar-container">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          eventDisplay="block"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={events}
          eventClick={handleEventClick}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          eventContent={renderEventContent}
          datesSet={handleDatesSet}
          height="auto"
          dayMaxEvents={3}
        />
      </div>

      {/* Floating Hover Popover Portal */}
      {renderHoverPopover()}

      {/* Duty Click Detail Dialog */}
      <Dialog
        fullWidth
        maxWidth="sm"
        open={Boolean(selectedDuty)}
        onClose={() => setSelectedDuty(null)}
      >
        <div className="main-card-header">
          <div className="top-fixed-hd">
            <div className="note-hd">
              <h6>Duty Details & Driver Assignment</h6>
            </div>
            <div
              className="cross-icon"
              onClick={() => setSelectedDuty(null)}
              style={{ cursor: "pointer" }}
            >
              <i className="fa-solid fa-xmark"></i>
            </div>
          </div>
        </div>
        <DialogContent className="main-box view-table-detail">
          {selectedDuty && (
            <Box>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background:
                    STATUS_COLORS[selectedDuty.pickDropStatus]?.bg || "#f8fafc",
                  color:
                    STATUS_COLORS[selectedDuty.pickDropStatus]?.color || "#334155",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <span>Appointment: #{selectedDuty.appointmentId}</span>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    border: `1px solid ${
                      STATUS_COLORS[selectedDuty.pickDropStatus]?.border || "#ccc"
                    }`,
                    background: "#fff",
                  }}
                >
                  {selectedDuty.pickDropStatus}
                </span>
              </div>

              <div className="card mb-3">
                <div className="card-body">
                  <h6
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0f766e",
                      marginBottom: 10,
                    }}
                  >
                    Patient & Destination
                  </h6>
                  <div className="row g-2" style={{ fontSize: 13 }}>
                    <div className="col-6">
                      <span style={{ color: "#64748b" }}>Patient:</span>{" "}
                      <strong>{selectedDuty.patientName}</strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: "#64748b" }}>Phone:</span>{" "}
                      <strong>{selectedDuty.patientPhone}</strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: "#64748b" }}>Patient ID:</span>{" "}
                      <strong>{selectedDuty.patientId}</strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: "#64748b" }}>Hospital:</span>{" "}
                      <strong>{selectedDuty.hospitalName}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-body">
                  <h6
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0f766e",
                      marginBottom: 10,
                    }}
                  >
                    Trip & Transport Duty
                  </h6>
                  <div className="row g-2" style={{ fontSize: 13 }}>
                    <div className="col-12">
                      <span style={{ color: "#64748b" }}>Pickup:</span>{" "}
                      <strong>{selectedDuty.pickup_location}</strong>
                      <span
                        className={`location-type-badge location-type-${(
                          selectedDuty.pickup_location_type || "other"
                        )
                          .toLowerCase()
                          .replace(/\s+/g, "")} ms-2`}
                      >
                        {selectedDuty.pickup_location_type}
                      </span>
                    </div>
                    <div className="col-6">
                      <span style={{ color: "#64748b" }}>Pickup Time:</span>{" "}
                      <strong>{selectedDuty.pickup_time}</strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: "#64748b" }}>Vehicle No:</span>{" "}
                      <strong>{selectedDuty.vehicle_no}</strong>
                    </div>
                    <div className="col-12 mt-2">
                      <span style={{ color: "#64748b" }}>Drop Location:</span>{" "}
                      <strong>{selectedDuty.drop_location}</strong>
                      <span
                        className={`location-type-badge location-type-${(
                          selectedDuty.drop_location_type || "other"
                        )
                          .toLowerCase()
                          .replace(/\s+/g, "")} ms-2`}
                      >
                        {selectedDuty.drop_location_type}
                      </span>
                    </div>
                    <div className="col-12 mt-2">
                      <span style={{ color: "#64748b" }}>Assigned Driver:</span>{" "}
                      <strong>{selectedDuty.driver_name}</strong>{" "}
                      {selectedDuty.driver_contact && (
                        <span>({selectedDuty.driver_contact})</span>
                      )}
                    </div>
                    {selectedDuty.notes && selectedDuty.notes !== "-" && (
                      <div className="col-12 mt-2">
                        <span style={{ color: "#64748b" }}>Notes:</span>{" "}
                        <em>{selectedDuty.notes}</em>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {onOpenReschedule && (
                  <button
                    type="button"
                    className="btn btn-outline-warning btn-sm"
                    onClick={() => {
                      const rowData = selectedDuty.raw || selectedDuty;
                      setSelectedDuty(null);
                      onOpenReschedule(rowData);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i className="fa-solid fa-calendar-days"></i> Reschedule
                  </button>
                )}
                {onOpenMessage && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    onClick={() => {
                      const rowData = selectedDuty.raw || selectedDuty;
                      setSelectedDuty(null);
                      onOpenMessage(rowData);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i className="fa-brands fa-whatsapp"></i> Send Alert
                  </button>
                )}
                {onOpenEdit && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const rowData = selectedDuty.raw || selectedDuty;
                      setSelectedDuty(null);
                      onOpenEdit(rowData);
                    }}
                    style={{
                      background: "#22c7b8",
                      borderColor: "#22c7b8",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i className="fa-solid fa-pen-to-square"></i> Update Duty
                  </button>
                )}
              </div>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverCalendar;
