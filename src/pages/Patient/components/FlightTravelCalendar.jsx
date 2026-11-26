import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { baseurl, image } from "../../../Basurl/Baseurl";
import { normalizePatientStatus } from "../../../utils/patientStatus";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";
import "./FlightTravelCalendar.css";

const FLIGHT_STATUS_THEMES = {
  Arriving: {
    bg: "#ecfdf5",
    color: "#065f46",
    border: "#10b981",
    badge: "bg-success-light text-success",
    icon: "fa-plane",
    label: "Arriving",
  },
  Departing: {
    bg: "#fffbeb",
    color: "#92400e",
    border: "#f59e0b",
    badge: "bg-warning-light text-warning",
    icon: "fa-plane",
    label: "Departing",
  },
  Travelled: {
    bg: "#eff6ff",
    color: "#1e40af",
    border: "#3b82f6",
    badge: "bg-primary-light text-primary",
    icon: "fa-check-circle",
    label: "Travelled",
  },
  Preponed: {
    bg: "#faf5ff",
    color: "#6b21a8",
    border: "#a855f7",
    badge: "bg-purple-light text-purple",
    icon: "fa-history",
    label: "Preponed",
  },
  Postponed: {
    bg: "#fff1f2",
    color: "#9f1239",
    border: "#f43f5e",
    badge: "bg-danger-light text-danger",
    icon: "fa-calendar-times-o",
    label: "Postponed",
  },
};

const getAirportCode = (str) => {
  if (!str) return "—";
  const s = String(str).trim();
  // If formatted like "DEL - Indira Gandhi..."
  if (s.includes(" - ")) {
    return s.split(" - ")[0].trim();
  }
  // If matches 3-letter uppercase code
  if (/^[A-Za-z]{3}$/.test(s)) {
    return s.toUpperCase();
  }
  return s.length > 15 ? `${s.substring(0, 13)}…` : s;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
};

export default function FlightTravelCalendar({
  travelPatients = [],
  onOpenTravelStatus,
  onRefresh,
}) {
  const calendarRef = useRef(null);
  const [internalPatients, setInternalPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const hideTimerRef = useRef(null);

  const deduplicateList = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.filter((item) => {
      if (!item) return false;
      const td =
        item.travelDetails &&
        typeof item.travelDetails === "object" &&
        !Array.isArray(item.travelDetails)
          ? item.travelDetails
          : item;
      const patientId =
        item.patientId ||
        item.patientNumber ||
        item._id ||
        item.id ||
        item.patient_name ||
        "";
      const travelDate =
        td.travelDate || td.travel_date || item.travelDate || item.date || "";
      const from = td.from || item.countryFrom || item.from || "";
      const to = td.to || item.countryTo || item.to || "";
      const time = td.arrivalTime || td.arrival_time || "";
      const key = `${patientId}-${travelDate}-${from}-${to}-${time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // Fetch full travel patients list if not supplied or empty
  const loadTravelPatients = useCallback(async () => {
    if (Array.isArray(travelPatients) && travelPatients.length > 0) {
      setInternalPatients(deduplicateList(travelPatients));
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${baseurl}get_travel_patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setInternalPatients(deduplicateList(list));
    } catch (err) {
      console.error("Failed to load flight travel schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [travelPatients, deduplicateList]);

  useEffect(() => {
    loadTravelPatients();
  }, [loadTravelPatients]);

  // Sync internal state when parent props change
  useEffect(() => {
    if (Array.isArray(travelPatients) && travelPatients.length > 0) {
      setInternalPatients(deduplicateList(travelPatients));
    }
  }, [travelPatients, deduplicateList]);

  // Normalize flight events for FullCalendar
  const calendarEvents = useMemo(() => {
    const list = internalPatients || [];
    const formatted = [];
    const seenEvents = new Set();

    list.forEach((item, idx) => {
      const td =
        item.travelDetails &&
        typeof item.travelDetails === "object" &&
        !Array.isArray(item.travelDetails)
          ? item.travelDetails
          : item;

      const rawDate = td.travelDate || td.travel_date || item.travelDate || item.date;
      if (!rawDate) return;

      const dateStr = String(rawDate).slice(0, 10);
      const statusRaw = normalizePatientStatus(item.p_status || item.status || td.action || "Arriving");
      const theme = FLIGHT_STATUS_THEMES[statusRaw] || FLIGHT_STATUS_THEMES.Arriving;

      const patientName = item.patient_name || item.patientName || item.name || "Patient";
      const patientId = item.patientId || item.patientNumber || item._id || "";
      const fromAirport = td.from || item.countryFrom || item.from || "Origin";
      const toAirport = td.to || item.countryTo || item.to || "Destination";
      const fromCode = getAirportCode(fromAirport);
      const toCode = getAirportCode(toAirport);
      const arrivalTime = td.arrivalTime || td.arrival_time || "";
      const travellers = td.numberOfTravellers || td.number_of_travellers || 1;
      const services = td.services || td.service || "";
      const documents = Array.isArray(td.documents) ? td.documents : [];

      // Deduplicate key: prevents exact same flight for same patient on same date being rendered twice
      const dedupeKey = `${patientId || patientName}-${dateStr}-${fromCode}-${toCode}-${arrivalTime}`;
      if (seenEvents.has(dedupeKey)) return;
      seenEvents.add(dedupeKey);

      // Direction filter
      if (selectedDirection !== "all") {
        if (selectedDirection === "arriving" && statusRaw !== "Arriving") return;
        if (selectedDirection === "departing" && statusRaw !== "Departing") return;
        if (selectedDirection === "travelled" && statusRaw !== "Travelled") return;
      }

      // Keyword search
      if (searchTerm.trim()) {
        const s = searchTerm.trim().toLowerCase();
        const pMatch = patientName.toLowerCase().includes(s) || patientId.toLowerCase().includes(s);
        const fromMatch = fromAirport.toLowerCase().includes(s);
        const toMatch = toAirport.toLowerCase().includes(s);
        if (!pMatch && !fromMatch && !toMatch) return;
      }

      formatted.push({
        id: `flight-${patientId || idx}-${dateStr}-${fromCode}-${toCode}`,
        title: `${patientName} (${fromCode} → ${toCode})`,
        start: dateStr,
        allDay: true,
        backgroundColor: theme.bg,
        borderColor: theme.border,
        textColor: theme.color,
        extendedProps: {
          patientName,
          patientId,
          phone: item.contact_no || item.phone || "",
          travelDate: dateStr,
          fromAirport,
          toAirport,
          fromCode,
          toCode,
          arrivalTime,
          status: statusRaw,
          theme,
          travellers,
          services,
          documents,
          rawItem: item,
        },
      });
    });

    return formatted;
  }, [internalPatients, selectedDirection, searchTerm]);

  // Overall flight statistics
  const metrics = useMemo(() => {
    const list = internalPatients || [];
    const seen = new Set();
    let arrivingCount = 0;
    let departingCount = 0;
    let travelledCount = 0;

    list.forEach((item) => {
      const td =
        item.travelDetails &&
        typeof item.travelDetails === "object" &&
        !Array.isArray(item.travelDetails)
          ? item.travelDetails
          : item;
      const rawDate = td.travelDate || td.travel_date || item.travelDate || item.date || "";
      const dateStr = String(rawDate).slice(0, 10);
      const patientId =
        item.patientId || item.patientNumber || item._id || item.patient_name || item.name || "";
      const fromAirport = td.from || item.countryFrom || item.from || "";
      const toAirport = td.to || item.countryTo || item.to || "";
      const arrivalTime = td.arrivalTime || td.arrival_time || "";

      const dedupeKey = `${patientId}-${dateStr}-${fromAirport}-${toAirport}-${arrivalTime}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const s = normalizePatientStatus(item.p_status || item.status || "Arriving");
      if (s === "Arriving") arrivingCount += 1;
      else if (s === "Departing") departingCount += 1;
      else if (s === "Travelled") travelledCount += 1;
    });

    return {
      total: seen.size || list.length,
      arriving: arrivingCount,
      departing: departingCount,
      travelled: travelledCount,
    };
  }, [internalPatients]);

  // Hover handlers for quick floating card
  const handleEventMouseEnter = (info) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const rect = info.el.getBoundingClientRect();
    const flight = info.event.extendedProps;
    setHoverInfo({
      flight,
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

  const handleEventClick = (info) => {
    setHoverInfo(null);
    setSelectedFlight(info.event.extendedProps);
  };

  // Custom FullCalendar event cell rendering
  const renderEventContent = (eventInfo) => {
    const flight = eventInfo.event.extendedProps || {};
    const theme = flight.theme || FLIGHT_STATUS_THEMES.Arriving;

    return (
      <div
        className="flight-event-card"
        style={{
          backgroundColor: theme.bg,
          color: theme.color,
          borderLeftColor: theme.border,
        }}
      >
        <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
          <span className="flight-event-route">
            <i className={`fa ${theme.icon} me-1`} style={{ fontSize: "10px" }} />
            {flight.fromCode} ➔ {flight.toCode}
          </span>
          {flight.arrivalTime && (
            <span className="flight-event-time">
              {flight.arrivalTime}
            </span>
          )}
        </div>
        <div className="flight-event-patient" title={flight.patientName}>
          {flight.patientName}
        </div>
      </div>
    );
  };

  return (
    <div className="flight-calendar-wrapper">
      {/* Flight Schedule Metrics Bar */}
      <div className="row g-2 mb-3">
        <div className="col-lg-3 col-sm-6 col-12">
          <div
            className="p-3 bg-white rounded border d-flex align-items-center justify-content-between shadow-sm"
            style={{ cursor: "pointer", borderLeft: "4px solid #0284c7" }}
            onClick={() => setSelectedDirection("all")}
          >
            <div>
              <div className="text-muted small fw-bold">Total Flight Schedules</div>
              <h4 className="mb-0 fw-bold text-dark mt-1">{metrics.total}</h4>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#e0f2fe",
                color: "#0369a1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              <i className="fa fa-plane" />
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-sm-6 col-12">
          <div
            className="p-3 bg-white rounded border d-flex align-items-center justify-content-between shadow-sm"
            style={{ cursor: "pointer", borderLeft: "4px solid #10b981" }}
            onClick={() => setSelectedDirection("arriving")}
          >
            <div>
              <div className="text-muted small fw-bold">Arriving Flights</div>
              <h4 className="mb-0 fw-bold text-success mt-1">{metrics.arriving}</h4>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#ecfdf5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              <i className="fa fa-plane" style={{ transform: "rotate(45deg)", display: "inline-block" }} />
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-sm-6 col-12">
          <div
            className="p-3 bg-white rounded border d-flex align-items-center justify-content-between shadow-sm"
            style={{ cursor: "pointer", borderLeft: "4px solid #f59e0b" }}
            onClick={() => setSelectedDirection("departing")}
          >
            <div>
              <div className="text-muted small fw-bold">Departing Flights</div>
              <h4 className="mb-0 fw-bold text-warning mt-1">{metrics.departing}</h4>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#fffbeb",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              <i className="fa fa-plane" style={{ transform: "rotate(-45deg)", display: "inline-block" }} />
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-sm-6 col-12">
          <div
            className="p-3 bg-white rounded border d-flex align-items-center justify-content-between shadow-sm"
            style={{ cursor: "pointer", borderLeft: "4px solid #6366f1" }}
            onClick={() => setSelectedDirection("travelled")}
          >
            <div>
              <div className="text-muted small fw-bold">Completed / Travelled</div>
              <h4 className="mb-0 fw-bold text-primary mt-1">{metrics.travelled}</h4>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              <i className="fa fa-check-circle" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white rounded border mb-3 shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="input-group input-group-sm" style={{ width: "300px" }}>
            <span className="input-group-text bg-light border-end-0">
              <i className="fa fa-search text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search by Patient Name, ID, or Airport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setSearchTerm("")}
              >
                <i className="fa fa-times" />
              </button>
            )}
          </div>

          <FormControl size="small" style={{ minWidth: "160px" }}>
            <Select
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value)}
              style={{ height: "34px", fontSize: "13px", background: "#fff" }}
            >
              <option value="all" style={{ display: "none" }}>All Flights</option>
              <MenuItem value="all">All Flights</MenuItem>
              <MenuItem value="arriving">Arriving Flights Only</MenuItem>
              <MenuItem value="departing">Departing Flights Only</MenuItem>
              <MenuItem value="travelled">Travelled (History)</MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Legend */}
          <div className="d-flex align-items-center gap-3 small text-muted me-2">
            <span className="d-flex align-items-center gap-1">
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
              Arriving
            </span>
            <span className="d-flex align-items-center gap-1">
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
              Departing
            </span>
            <span className="d-flex align-items-center gap-1">
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3b82f6" }} />
              Travelled
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              if (onRefresh) onRefresh();
              loadTravelPatients();
            }}
            title="Refresh Flight Calendar"
            style={{ borderRadius: "8px" }}
          >
            <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* FullCalendar Component Container */}
      <div className="flight-calendar-container">
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              borderRadius: "12px",
            }}
          >
            <CircularProgress size={36} style={{ color: "#0284c7" }} />
          </div>
        )}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
          }}
          events={calendarEvents}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          dayMaxEvents={3}
          height="auto"
          stickyHeaderDates
        />
      </div>

      {/* Floating Hover Popover (only when no modal is open) */}
      {hoverInfo &&
        !selectedFlight &&
        ReactDOM.createPortal(
          (() => {
            const { flight, rect } = hoverInfo;
            const popoverWidth = 290;
            const popoverHeight = 160;
            let left = rect.left + rect.width / 2 - popoverWidth / 2;
            let top = rect.top - popoverHeight - 8;

            if (top < 10) {
              top = rect.bottom + 8;
            }
            if (left < 10) left = 10;
            if (left + popoverWidth > window.innerWidth - 10) {
              left = window.innerWidth - popoverWidth - 10;
            }

            const theme = flight.theme || FLIGHT_STATUS_THEMES.Arriving;

            return (
              <div
                className="flight-hover-popover"
                style={{
                  top: `${top}px`,
                  left: `${left}px`,
                  borderLeft: `4px solid ${theme.border}`,
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="badge" style={{ backgroundColor: theme.bg, color: theme.color, fontSize: "11px" }}>
                    <i className={`fa ${theme.icon} me-1`} />
                    {flight.status}
                  </span>
                  <span className="text-muted small fw-bold">
                    {formatDate(flight.travelDate)}
                  </span>
                </div>

                <div className="fw-bold text-dark mb-1" style={{ fontSize: "13.5px" }}>
                  {flight.patientName}
                </div>
                <div className="text-muted small mb-2">
                  ID: <span className="text-primary fw-bold">{flight.patientId}</span>
                </div>

                <div className="p-2 bg-light rounded border mb-2" style={{ fontSize: "11.5px" }}>
                  <div className="d-flex align-items-center justify-content-between fw-bold text-dark">
                    <span>{flight.fromCode}</span>
                    <i className="fa fa-plane text-primary mx-1" style={{ fontSize: "10px" }} />
                    <span>{flight.toCode}</span>
                  </div>
                  {flight.arrivalTime && (
                    <div className="text-muted small mt-1">
                      Time: <strong>{flight.arrivalTime}</strong>
                    </div>
                  )}
                </div>

                <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: "11px" }}>
                  <span>Travellers: {flight.travellers}</span>
                  {flight.documents?.length > 0 && (
                    <span className="text-primary">
                      <i className="fa fa-file-text-o me-1" />
                      {flight.documents.length} Doc(s)
                    </span>
                  )}
                </div>
              </div>
            );
          })(),
          document.body
        )}

      {/* Flight Detail Dialog */}
      {selectedFlight && (
        <Dialog
          open={Boolean(selectedFlight)}
          onClose={() => setSelectedFlight(null)}
          maxWidth="md"
          fullWidth
          className="flight-detail-dialog"
          PaperProps={{
            style: {
              maxWidth: "680px",
              width: "100%",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
            },
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#fff",
              padding: "16px 22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  color: "#fff",
                  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                }}
              >
                <i className="fa fa-plane" />
              </div>
              <div>
                <h6 className="mb-0 fw-bold" style={{ color: "#fff", fontSize: "16px" }}>
                  Flight & Travel Itinerary Details
                </h6>
                <small style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: "12px" }}>
                  Scheduled Date: {formatDate(selectedFlight.travelDate)}
                </small>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedFlight(null)}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
                color: "#fff",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
            >
              <i className="fa fa-times" />
            </button>
          </div>

          <DialogContent style={{ padding: "20px 22px", overflowX: "hidden" }}>
            {/* Passenger Info Card */}
            <div className="card p-3 border mb-3 bg-light shadow-sm" style={{ borderRadius: "10px" }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "15.5px" }}>
                    {selectedFlight.patientName}
                  </h6>
                  <div className="d-flex align-items-center gap-2 text-muted small">
                    <span className="badge bg-primary-light text-primary fw-bold" style={{ fontSize: "11.5px" }}>
                      ID: {selectedFlight.patientId}
                    </span>
                    {selectedFlight.phone && (
                      <span className="ms-1">
                        <i className="fa fa-phone me-1 text-primary" />
                        {selectedFlight.phone}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className="badge px-3 py-2 fw-bold"
                  style={{
                    backgroundColor: selectedFlight.theme?.bg,
                    color: selectedFlight.theme?.color,
                    border: `1px solid ${selectedFlight.theme?.border}`,
                    fontSize: "12px",
                    borderRadius: "6px",
                  }}
                >
                  <i className={`fa ${selectedFlight.theme?.icon || "fa-plane"} me-1`} />
                  {selectedFlight.status}
                </span>
              </div>
            </div>

            {/* Flight Route Diagram Card */}
            <div className="card border mb-3 overflow-hidden shadow-sm" style={{ borderRadius: "10px" }}>
              <div className="card-header bg-white py-2 px-3 border-bottom d-flex align-items-center justify-content-between">
                <span className="fw-bold text-dark" style={{ fontSize: "13px" }}>
                  <i className="fa fa-plane text-primary me-2" />
                  Flight Route & Itinerary
                </span>
                {selectedFlight.arrivalTime && (
                  <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: "11px" }}>
                    <i className="fa fa-clock-o text-muted me-1" />
                    Arrival: <strong className="ms-1 text-primary">{selectedFlight.arrivalTime}</strong>
                  </span>
                )}
              </div>

              <div className="p-3" style={{ background: "#f8fafc" }}>
                <div className="row g-2 align-items-center text-center">
                  {/* Origin */}
                  <div className="col-5">
                    <div className="p-2 bg-white rounded border h-100 shadow-sm" style={{ minWidth: 0 }}>
                      <span
                        className="badge bg-secondary text-white px-2 py-1 mb-1 d-inline-block"
                        style={{ fontSize: "10px", letterSpacing: "0.5px" }}
                      >
                        ORIGIN
                      </span>
                      <div
                        className="fw-bold text-dark mb-1"
                        style={{ fontSize: "20px", letterSpacing: "1px", lineHeight: 1.2 }}
                      >
                        {selectedFlight.fromCode || "DEL"}
                      </div>
                      <div
                        className="text-muted small text-truncate px-1"
                        title={selectedFlight.fromAirport}
                        style={{ fontSize: "11.5px", lineHeight: "1.3" }}
                      >
                        {selectedFlight.fromAirport || "Origin Airport"}
                      </div>
                    </div>
                  </div>

                  {/* Flight Connector */}
                  <div className="col-2 px-0">
                    <div className="d-flex flex-column align-items-center justify-content-center">
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "50%",
                          backgroundColor: "#e0f2fe",
                          color: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          boxShadow: "0 2px 4px rgba(2, 132, 199, 0.15)",
                        }}
                      >
                        <i className="fa fa-plane" />
                      </div>
                      <div
                        style={{
                          borderBottom: "2px dashed #94a3b8",
                          width: "100%",
                          margin: "6px 0",
                        }}
                      />
                      <small className="text-muted fw-bold" style={{ fontSize: "10px" }}>
                        Non-Stop
                      </small>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="col-5">
                    <div className="p-2 bg-white rounded border h-100 shadow-sm" style={{ minWidth: 0 }}>
                      <span
                        className="badge bg-primary text-white px-2 py-1 mb-1 d-inline-block"
                        style={{ fontSize: "10px", letterSpacing: "0.5px" }}
                      >
                        DESTINATION
                      </span>
                      <div
                        className="fw-bold text-dark mb-1"
                        style={{ fontSize: "20px", letterSpacing: "1px", lineHeight: 1.2 }}
                      >
                        {selectedFlight.toCode || "MRU"}
                      </div>
                      <div
                        className="text-muted small text-truncate px-1"
                        title={selectedFlight.toAirport}
                        style={{ fontSize: "11.5px", lineHeight: "1.3" }}
                      >
                        {selectedFlight.toAirport || "Destination Airport"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Details (Travellers, Services) */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="p-2 bg-light border rounded shadow-sm">
                  <small className="text-muted d-block" style={{ fontSize: "11px" }}>Number of Travellers</small>
                  <strong className="text-dark" style={{ fontSize: "13px" }}>
                    <i className="fa fa-users text-primary me-1" />
                    {selectedFlight.travellers || 1} Person(s)
                  </strong>
                </div>
              </div>

              <div className="col-6">
                <div className="p-2 bg-light border rounded shadow-sm">
                  <small className="text-muted d-block" style={{ fontSize: "11px" }}>Special Services</small>
                  <strong className="text-dark" style={{ fontSize: "13px" }}>
                    <i className="fa fa-tag text-info me-1" />
                    {selectedFlight.services || "None"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Documents / Tickets */}
            {selectedFlight.documents && selectedFlight.documents.length > 0 && (
              <div className="card p-3 border mb-3 shadow-sm" style={{ borderRadius: "10px" }}>
                <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "13px" }}>
                  <i className="fa fa-file-text-o text-primary me-2" />
                  Flight Tickets & Documents ({selectedFlight.documents.length})
                </h6>
                <div className="d-flex flex-wrap gap-2">
                  {selectedFlight.documents.map((doc, dIdx) => {
                    const url =
                      doc.url ||
                      doc.path ||
                      (doc.fileUrl ? `${image}uploads/${doc.fileUrl}` : doc.filePath ? `${image}${doc.filePath}` : "");
                    const name = doc.label || doc.fileName || doc.name || `Document ${dIdx + 1}`;

                    return url ? (
                      <a
                        key={doc._id || dIdx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                        style={{ fontSize: "12px", borderRadius: "6px" }}
                      >
                        <i className="fa fa-file-pdf-o text-danger" />
                        {name}
                        <i className="fa fa-external-link opacity-75 ms-1" style={{ fontSize: "10px" }} />
                      </a>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="d-flex justify-content-end align-items-center gap-2 mt-3 pt-3 border-top">
              <button
                type="button"
                className="btn btn-sm btn-secondary px-3"
                onClick={() => setSelectedFlight(null)}
              >
                Close
              </button>
              {onOpenTravelStatus && !isReferralUser() && !isInsuranceUser() && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-bold px-3 d-inline-flex align-items-center gap-1"
                  style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
                  onClick={() => {
                    const rec = selectedFlight;
                    setSelectedFlight(null);
                    onOpenTravelStatus(rec.patientId, rec.patientName, rec.status);
                  }}
                >
                  <i className="fa fa-pencil me-1" />
                  Update Travel Status
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
