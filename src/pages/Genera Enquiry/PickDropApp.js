import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Pagination,
  Stack,
  Box,
  Dialog,
  DialogContent,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { baseurl } from "../../Basurl/Baseurl";
import { UnreadDot } from "../../components/NewTag";
import {
  markRecordRead,
  markRequestRead,
  getCachedGeneralEnquiryUnread,
  publishGeneralEnquiryUnread,
  UNREAD_REFRESH_EVENT,
} from "../../services/unreadApi";
import DriverCalendar from "./DriverCalendar";
import SendPickDropMessageModal from "./SendPickDropMessageModal";
import CreatePickDropAppointmentModal from "./CreatePickDropAppointmentModal";
import ReschedulePickDropModal from "./ReschedulePickDropModal";
import {
  fetchPickDropDashboardStats,
  PICK_DROP_STATUSES,
  PICK_DROP_STATUS_COLORS,
  PICK_DROP_STATUS_FILTERS,
} from "../../services/pickDropApi";
import {
  isDriverUser,
  getCurrentDriverUser,
  isHospitalUser,
} from "../../utils/authStorage";
import "./PickDropApp.css";

const isRecordUnread = (item) =>
  item?.isUnread === true ||
  item?.is_seen === 0 ||
  item?.is_seen === "0" ||
  item?.is_read === 0 ||
  item?.is_read === "0" ||
  item?.isRead === false;

const STATUSES = PICK_DROP_STATUSES;
const STATUS_FILTERS = PICK_DROP_STATUS_FILTERS;
const STATUS_COLORS = PICK_DROP_STATUS_COLORS;

const LOCATION_TYPES = [
  "Airport",
  "Hotel",
  "Guest House",
  "Hospital",
  "Residence",
  "Other",
];

const DEFAULT_PICKUP_MANAGERS = [
  {
    id: "ravi_kumar",
    name: "Ravi Kumar",
    phone: "9217993173, 7453 034 087",
    displayLabel: "Ravi Kumar - 9217993173, 7453 034 087",
  },
  {
    id: "shivam_kumar",
    name: "Shivam Kumar",
    phone: "88905 06958",
    displayLabel: "Shivam Kumar - 88905 06958",
  },
  {
    id: "other",
    name: "Other",
    phone: "",
    displayLabel: "Other (Enter custom driver & vehicle)",
  },
];

const emptyForm = {
  status: "Pending",
  pickDropStatus: "Pending",
  pickup_manager_name: "Ravi Kumar",
  pickup_manager_phone: "9217993173, 7453 034 087",
  driver_name: "Ravi Kumar",
  driver_contact: "9217993173, 7453 034 087",
  vehicle_no: "",
  pickup_time: "",
  drop_time: "",
  pickup_location: "",
  pickup_location_type: "",
  drop_location: "",
  drop_location_type: "",
  notes: "",
  isCustomDriver: false,
};

const LIMIT = 10;

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const authHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
  };
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
};

const formFromRow = (row) => {
  const managerName = row?.pickup_manager_name || row?.driver_name || "Ravi Kumar";
  const isPreset =
    managerName === "Ravi Kumar" || managerName === "Shivam Kumar";

  return {
    status: row?.pickDropStatus || row?.status || "Pending",
    pickDropStatus: row?.pickDropStatus || row?.status || "Pending",
    pickup_manager_name: managerName,
    pickup_manager_phone:
      row?.pickup_manager_phone ||
      row?.driver_contact ||
      (managerName === "Ravi Kumar"
        ? "9217993173, 7453 034 087"
        : managerName === "Shivam Kumar"
        ? "88905 06958"
        : ""),
    driver_name: row?.driver_name || managerName,
    driver_contact:
      row?.driver_contact || row?.pickup_manager_phone || "",
    vehicle_no: row?.vehicle_no || "",
    pickup_time: row?.pickup_time || "",
    drop_time: row?.drop_time || "",
    pickup_location: row?.pickup_location || "",
    pickup_location_type: row?.pickup_location_type || "",
    drop_location: row?.drop_location || "",
    drop_location_type: row?.drop_location_type || "",
    notes: row?.notes || row?.note || "",
    isCustomDriver: !isPreset,
  };
};

const InfoItem = ({ label, value }) => (
  <div>
    <h6>{label}</h6>
    <p>{value || "-"}</p>
  </div>
);

export default function PickDropApp({ dateRange }) {
  const isReferral = (localStorage.getItem("Role") || "").toUpperCase() === "REFERRAL";
  const driverUser = getCurrentDriverUser();
  const isDriver = isDriverUser();
  const isHospital = isHospitalUser();

  // Views: 'table' | 'calendar'
  const [activeView, setActiveView] = useState("table");
  const [showRemindersBanner, setShowRemindersBanner] = useState(true);

  // Data states
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [rideTab, setRideTab] = useState("all"); // "all" | "upcoming" | "history" (Section 2: tab)
  const [dateFilter, setDateFilter] = useState("all"); // "all" | "today" | "week" | "month" (Section 2: dateFilter)
  const [status, setStatus] = useState("All");
  const [today, setToday] = useState(false);
  const [date, setDate] = useState("");
  const [startDate, setStartDate] = useState(() => dateRange?.startDate || "");
  const [endDate, setEndDate] = useState(() => dateRange?.endDate || "");
  const [searchInput, setSearchInput] = useState("");
  const [patientInput, setPatientInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedPatientId, setAppliedPatientId] = useState("");

  useEffect(() => {
    if (dateRange) {
      setStartDate(dateRange.startDate || "");
      setEndDate(dateRange.endDate || "");
      setPage(1);
    }
  }, [dateRange?.startDate, dateRange?.endDate]);

  // Modals & Action states
  const [updatingId, setUpdatingId] = useState("");
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [rescheduleRow, setRescheduleRow] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Dashboard Stats state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Preset pickup managers loaded from API
  const [pickupManagers, setPickupManagers] = useState(DEFAULT_PICKUP_MANAGERS);

  // Fetch Preset Pickup Managers
  useEffect(() => {
    const fetchPickupManagers = async () => {
      try {
        const response = await axios.get(`${baseurl}get_pickup_managers`, {
          headers: authHeaders(),
        });
        if (response?.data?.success && Array.isArray(response.data.data)) {
          setPickupManagers(response.data.data);
        }
      } catch (err) {
        // Fallback to presets if endpoint is offline or requires different auth
        setPickupManagers(DEFAULT_PICKUP_MANAGERS);
      }
    };
    fetchPickupManagers();
  }, []);

  // Fetch Pick & Drop Dashboard Stats (GET /get_pick_drop_dashboard_stats)
  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const statsParams = {};
        if (isDriver && driverUser.name) statsParams.driver = driverUser.name;
        if (isHospital && driverUser.hospitalId) statsParams.hospital_id = driverUser.hospitalId;

        const data = await fetchPickDropDashboardStats(statsParams);
        if (active && data) {
          setDashboardStats(data);
        }
      } catch (err) {
        console.warn("Could not load pick drop stats:", err);
      } finally {
        if (active) setLoadingStats(false);
      }
    };
    loadStats();
    return () => {
      active = false;
    };
  }, [reloadKey, isDriver, isHospital, driverUser.name, driverUser.hospitalId]);

  // Debounce search and patient ID inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
      setAppliedPatientId(patientInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, patientInput]);

  // Load pick and drop appointments
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (rideTab && rideTab !== "all") params.set("tab", rideTab);
        if (dateFilter && dateFilter !== "all") params.set("dateFilter", dateFilter);
        if (status && status !== "All" && status !== "all") {
          params.set("pickDropStatus", status);
          params.set("status", status);
        }
        params.set("page", String(page));
        params.set("limit", String(LIMIT));
        if (today) params.set("today", "true");
        if (date) params.set("date", date);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (appliedPatientId) params.set("patientId", appliedPatientId);
        if (appliedSearch) params.set("search", appliedSearch);
        if (isDriver && driverUser.name && !appliedSearch) params.set("driver", driverUser.name);
        if (isHospital && driverUser.hospitalId) params.set("hospital_id", driverUser.hospitalId);

        const paramObj = {};
        params.forEach((v, k) => {
          paramObj[k] = v;
        });

        // 1. Fetch appointments directly from get_pick_drop_appointments API
        let appointmentsList = [];
        let appointmentsCounts = {};
        let appointmentsTotal = 0;
        let appointmentsPages = 1;
        let apiSucceeded = false;

        try {
          const response = await axios.get(
            `${baseurl}get_pick_drop_appointments?${params.toString()}`,
            { headers: authHeaders(), signal: controller.signal },
          );
          const body = response?.data || {};
          if (Array.isArray(body.data)) {
            appointmentsList = body.data;
            appointmentsCounts = body.counts || {};
            appointmentsTotal = Number(body.total ?? body.counts?.total ?? body.data.length);
            appointmentsPages = Math.max(1, Number(body.totalPages) || 1);
            apiSucceeded = true;
          }
        } catch (apiErr) {
          if (axios.isCancel?.(apiErr) || apiErr?.code === "ERR_CANCELED") return;
        }

        // 2. Fetch or sync dashboard stats
        const dashboardData = await fetchPickDropDashboardStats(paramObj);
        if (dashboardData && dashboardData.success !== false) {
          setDashboardStats(dashboardData);
          if (!apiSucceeded || appointmentsList.length === 0) {
            const dutiesList = Array.isArray(dashboardData.duties)
              ? dashboardData.duties
              : Array.isArray(dashboardData.rides)
              ? dashboardData.rides
              : [];
            if (dutiesList.length > 0) {
              appointmentsList = dutiesList;
              appointmentsCounts = dashboardData.statusCounts || dashboardData.counts || appointmentsCounts;
              appointmentsTotal = Number(dashboardData.total ?? dashboardData.summary?.totalRides ?? dutiesList.length);
              appointmentsPages = Math.max(1, Number(dashboardData.totalPages) || 1);
            }
          }
        }

        // Apply tab filtering (all / upcoming / history)
        let displayList = appointmentsList;
        if (rideTab === "upcoming") {
          displayList = displayList.filter((item) => {
            const st = String(item.pickDropStatus || item.status || "").toLowerCase();
            if (["new", "pending", "in process", "picked up", "on the way"].includes(st)) return true;
            if (["completed", "dropped", "cancelled"].includes(st)) return false;
            const d = String(item.appointment_Date || item.date || "").slice(0, 10);
            return !d || d >= new Date().toISOString().slice(0, 10);
          });
        } else if (rideTab === "history") {
          displayList = displayList.filter((item) => {
            const st = String(item.pickDropStatus || item.status || "").toLowerCase();
            if (["completed", "dropped", "cancelled"].includes(st)) return true;
            const d = String(item.appointment_Date || item.date || "").slice(0, 10);
            return d && d < new Date().toISOString().slice(0, 10);
          });
        }

        setRows(displayList);
        setCounts(appointmentsCounts);
        setTotal(appointmentsTotal || displayList.length);
        setTotalPages(appointmentsPages);
      } catch (err) {
        if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") return;
        setRows([]);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load pick and drop appointments",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [
    rideTab,
    dateFilter,
    status,
    today,
    date,
    startDate,
    endDate,
    appliedSearch,
    appliedPatientId,
    page,
    reloadKey,
  ]);

  // Sync unread count with top navbar badge
  useEffect(() => {
    if (loading) return;
    if (status !== "All" || today || date || startDate || endDate || appliedSearch || appliedPatientId) return;
    const unread = Number(
      counts?.unread ?? rows.filter(isRecordUnread).length
    );
    const cached = getCachedGeneralEnquiryUnread() || {};
    const appPickup = Number(cached.app_pickup ?? 0);
    const updated = {
      ...cached,
      app_pickup: appPickup,
      portal_pickup: unread,
      pickup: appPickup + unread,
    };
    publishGeneralEnquiryUnread(updated);
  }, [rows, loading, counts]);

  const markReadAction = async (item) => {
    if (!item) return;
    const recordId = String(
      item.appointmentId || item.id || item._id || item.enquiryId || ""
    ).trim();
    if (!recordId) return;

    markRecordRead("enquiries", recordId);
    markRecordRead("appointments", recordId);
    markRecordRead("pickup", recordId);
    markRecordRead("generalEnquiries", recordId);
    markRequestRead("pickup", recordId);

    setRows((prev) => {
      const next = prev.map((r) =>
        String(r.appointmentId || r.id || r._id) === recordId
          ? { ...r, isUnread: false, is_seen: 1, is_read: 1 }
          : r
      );
      const cached = getCachedGeneralEnquiryUnread() || {};
      const currentPortal = Number(cached.portal_pickup || 0);
      const wasItemUnread = isRecordUnread(item);
      const nextPortalUnread = wasItemUnread ? Math.max(0, currentPortal - 1) : currentPortal;
      const appPickup = Number(cached.app_pickup ?? 0);
      const updated = {
        ...cached,
        app_pickup: appPickup,
        portal_pickup: nextPortalUnread,
        pickup: appPickup + nextPortalUnread,
      };
      publishGeneralEnquiryUnread(updated);
      return next;
    });

    window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
  };

  // Update Pick & Drop Status (Inline or Modal)
  const updateStatus = async (row, nextStatus, extraPayload = null) => {
    if (isReferral) return;
    markReadAction(row);
    const appointmentId = row?.appointmentId || row?.id || row?._id;
    if (!appointmentId) {
      Swal.fire("Error", "Appointment ID is missing", "error");
      return;
    }

    // If user selected "Rescheduled" from inline dropdown without dates, open dedicated Reschedule modal
    if (nextStatus === "Rescheduled" && !extraPayload?.rescheduleDate) {
      setRescheduleRow(row);
      return;
    }

    const payload = {
      pickDropStatus: nextStatus,
      status: nextStatus,
      pickup_time: extraPayload?.pickup_time || row.pickup_time || "",
      drop_time: extraPayload?.drop_time || row.drop_time || "",
      pickup_location: extraPayload?.pickup_location || row.pickup_location || "",
      pickup_location_type:
        extraPayload?.pickup_location_type || row.pickup_location_type || "Airport",
      drop_location: extraPayload?.drop_location || row.drop_location || "",
      drop_location_type:
        extraPayload?.drop_location_type || row.drop_location_type || "Hospital",
      pickup_manager_name:
        extraPayload?.pickup_manager_name || row.pickup_manager_name || row.driver_name || "",
      pickup_manager_phone:
        extraPayload?.pickup_manager_phone || row.pickup_manager_phone || row.driver_contact || "",
      driver_name:
        extraPayload?.driver_name || extraPayload?.pickup_manager_name || row.driver_name || row.pickup_manager_name || "",
      driver_contact:
        extraPayload?.driver_contact || extraPayload?.pickup_manager_phone || row.driver_contact || row.pickup_manager_phone || "",
      vehicle_no: extraPayload?.vehicle_no || row.vehicle_no || "",
      notes: extraPayload?.notes !== undefined ? extraPayload.notes : row.notes || "",
      ...(extraPayload?.rescheduleDate ? { rescheduleDate: extraPayload.rescheduleDate, newDate: extraPayload.rescheduleDate } : {}),
      ...(extraPayload?.rescheduleReason ? { rescheduleReason: extraPayload.rescheduleReason, discussionNotes: extraPayload.rescheduleReason } : {}),
      ...(extraPayload?.sendAlert !== undefined ? { sendAlert: extraPayload.sendAlert } : {}),
      ...(extraPayload || {}),
    };

    setUpdatingId(appointmentId);
    try {
      const response = await axios.post(
        `${baseurl}update_pick_drop_status/${encodeURIComponent(appointmentId)}`,
        payload,
        { headers: authHeaders() },
      );
      if (response?.data?.success === false) {
        throw new Error(response?.data?.message || "Status update failed");
      }
      Swal.fire({
        icon: "success",
        title: "Pick & Drop Updated",
        text: response?.data?.message || "Pick & Drop details saved successfully",
        timer: 2000,
        showConfirmButton: false,
      });
      setEditRow(null);
      setReloadKey((current) => current + 1);
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message || err?.message || "Something went wrong",
        "error",
      );
    } finally {
      setUpdatingId("");
    }
  };

  const openEdit = (row) => {
    if (isReferral) return;
    markReadAction(row);
    setEditRow(row);
    setForm(formFromRow(row));
  };

  // Manager change inside Edit Modal
  const handleManagerChange = (managerName) => {
    if (managerName === "Ravi Kumar") {
      setForm((prev) => ({
        ...prev,
        pickup_manager_name: "Ravi Kumar",
        pickup_manager_phone: "9217993173, 7453 034 087",
        driver_name: "Ravi Kumar",
        driver_contact: "9217993173, 7453 034 087",
        isCustomDriver: false,
      }));
    } else if (managerName === "Shivam Kumar") {
      setForm((prev) => ({
        ...prev,
        pickup_manager_name: "Shivam Kumar",
        pickup_manager_phone: "88905 06958",
        driver_name: "Shivam Kumar",
        driver_contact: "88905 06958",
        isCustomDriver: false,
      }));
    } else {
      // "Other" selected -> allow custom driver details
      setForm((prev) => ({
        ...prev,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
        vehicle_no: "",
        isCustomDriver: true,
      }));
    }
  };

  const handleSaveEdit = (event) => {
    event.preventDefault();
    if (!form.status && !form.pickDropStatus) {
      Swal.fire("Error", "Status is required", "error");
      return;
    }
    const currentStatus = form.pickDropStatus || form.status;
    const payload = {
      pickDropStatus: currentStatus,
      status: currentStatus,
      pickup_manager_name: form.pickup_manager_name,
      pickup_manager_phone: form.pickup_manager_phone,
      driver_name: form.pickup_manager_name || form.driver_name,
      driver_contact: form.pickup_manager_phone || form.driver_contact,
      vehicle_no: form.vehicle_no,
      pickup_time: form.pickup_time,
      drop_time: form.drop_time,
      pickup_location: form.pickup_location,
      pickup_location_type: form.pickup_location_type,
      drop_location: form.drop_location,
      drop_location_type: form.drop_location_type,
      notes: form.notes,
    };
    setSaving(true);
    updateStatus(editRow, currentStatus, payload).finally(() => setSaving(false));
  };

  const clearAllFilters = () => {
    setRideTab("upcoming");
    setDateFilter("all");
    setStatus("All");
    setToday(false);
    setDate("");
    setStartDate("");
    setEndDate("");
    setSearchInput("");
    setPatientInput("");
    setAppliedSearch("");
    setAppliedPatientId("");
    setPage(1);
  };

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: 20,
    border: active ? "1px solid #22c7b8" : "1px solid #e5e7eb",
    background: active ? "#22c7b8" : "#fff",
    color: active ? "#fff" : "#475569",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
  });

  return (
    <div className="pickdrop-container">
      {/* Top Header & View Mode Switcher */}
      <div
        className="country-top"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div className="topmainhd mb-0">
          <h6 style={{ display: "inline-flex", alignItems: "center", margin: 0 }}>
            Pick & Drop Portal ({total})
          </h6>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* View Toggle */}
          <div className="pickdrop-view-toggle">
            <button
              type="button"
              className={`pickdrop-view-btn ${activeView === "table" ? "active" : ""}`}
              onClick={() => setActiveView("table")}
            >
              <i className="fa-solid fa-table-list"></i> Table View
            </button>
            <button
              type="button"
              className={`pickdrop-view-btn ${activeView === "calendar" ? "active" : ""}`}
              onClick={() => setActiveView("calendar")}
            >
              <i className="fa-solid fa-calendar-days"></i> Driver Calendar
            </button>
          </div>

          {/* Schedule Pickup Appointment Button */}
          {!isReferral && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setCreateModalOpen(true)}
              style={{
                background: "#22c7b8",
                borderColor: "#22c7b8",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                fontSize: 13,
                padding: "6px 14px",
              }}
            >
              <i className="fa-solid fa-plus"></i> Schedule Pickup
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Refresh Data"
          >
            <i className="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      {/* Automated Reminders Notice Banner */}
      {showRemindersBanner && (
        <div className="pickdrop-reminders-banner">
          <div className="banner-text">
            <i className="fa-solid fa-bell banner-icon"></i>
            <div>
              <strong>Automated Reminders Active:</strong> Backend dispatches
              urgent <strong>24h & 1h prior</strong> WhatsApp & Email duty
              alerts to patients & drivers, appending the Transport Support
              Footer automatically.
            </div>
          </div>
          <button
            type="button"
            className="banner-close"
            onClick={() => setShowRemindersBanner(false)}
            title="Dismiss notice"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* 1. TOP METRIC CARDS DASHBOARD (POWERED BY /get_pick_drop_dashboard_stats) */}
      <div className="driver-metrics-grid mb-3">
        <div
          className="metric-card shadow-sm"
          style={{ borderLeft: "4px solid #0284c7", background: "#ffffff", borderRadius: "10px" }}
        >
          <div className="metric-info">
            <h5 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              {dashboardStats?.summary?.todayTotal ?? (counts?.todayTotal ?? (today ? rows.length : 0))}
            </h5>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              Today's Total Duties
            </span>
            <small className="d-block text-muted mt-1" style={{ fontSize: "11px" }}>
              {dashboardStats?.summary?.todayCompleted ?? (counts?.completed ?? 0)} Completed ·{" "}
              {dashboardStats?.summary?.todayInProcess ?? (counts?.inProcess ?? 0)} Active
            </small>
          </div>
          <div
            className="metric-icon"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "#e0f2fe",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <i className="fa-solid fa-calendar-day"></i>
          </div>
        </div>

        <div
          className="metric-card shadow-sm"
          style={{ borderLeft: "4px solid #7c3aed", background: "#ffffff", borderRadius: "10px" }}
        >
          <div className="metric-info">
            <h5 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              {dashboardStats?.summary?.todayInProcess ?? (counts?.inProcess ?? 0)}
            </h5>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              Active / In Process
            </span>
            <small className="d-block text-muted mt-1" style={{ fontSize: "11px" }}>
              {dashboardStats?.statusCounts?.pickedUp ?? (counts?.pickedUp ?? 0)} Picked Up ·{" "}
              {dashboardStats?.statusCounts?.onTheWay ?? (counts?.onTheWay ?? 0)} En Route
            </small>
          </div>
          <div
            className="metric-icon"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "#ede9fe",
              color: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <i className="fa-solid fa-car-side"></i>
          </div>
        </div>

        <div
          className="metric-card shadow-sm"
          style={{ borderLeft: "4px solid #059669", background: "#ffffff", borderRadius: "10px" }}
        >
          <div className="metric-info">
            <h5 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              {dashboardStats?.summary?.todayCompleted ?? (counts?.completed ?? 0)}
            </h5>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              Completed Rides
            </span>
            <small className="d-block text-muted mt-1" style={{ fontSize: "11px" }}>
              Patient safely dropped at hospital/hotel
            </small>
          </div>
          <div
            className="metric-icon"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "#d1fae5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <i className="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <div
          className="metric-card shadow-sm"
          style={{ borderLeft: "4px solid #d97706", background: "#ffffff", borderRadius: "10px" }}
        >
          <div className="metric-info">
            <h5 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              {dashboardStats?.summary?.thisMonthRides ?? (dashboardStats?.summary?.totalRides ?? total)}
            </h5>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              This Month's Rides
            </span>
            <small className="d-block text-muted mt-1" style={{ fontSize: "11px" }}>
              Total: {dashboardStats?.summary?.totalRides ?? total} rides in database
            </small>
          </div>
          <div
            className="metric-icon"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "#fef3c7",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <i className="fa-solid fa-chart-line"></i>
          </div>
        </div>
      </div>

      {/* Driver Duties Quick Bar from API */}
      {dashboardStats?.driverStats && dashboardStats.driverStats.length > 0 && (
        <div
          className="p-2 px-3 mb-3 rounded-2 d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-sm"
          style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <i className="fa-solid fa-id-badge text-primary" />
            <span className="small fw-bold text-dark" style={{ fontSize: "12px" }}>
              Driver Duty Overview:
            </span>
            <div className="d-flex align-items-center gap-1.5 flex-wrap">
              {dashboardStats.driverStats.map((d) => (
                <span
                  key={d.name}
                  className="badge rounded-pill px-2.5 py-1"
                  style={{
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    fontSize: "11px",
                    fontWeight: 500,
                  }}
                >
                  <strong>{d.name}:</strong> {d.totalRides || 0} rides ({d.todayRides || 0} today)
                </span>
              ))}
            </div>
          </div>

          {(dashboardStats?.statusCounts?.rescheduled > 0 || counts?.rescheduled > 0) && (
            <span
              className="badge px-2.5 py-1 text-white"
              style={{ backgroundColor: "#d97706", fontSize: "11px" }}
            >
              <i className="fa-solid fa-calendar-days me-1" />
              {dashboardStats?.statusCounts?.rescheduled || counts?.rescheduled || 0} Rescheduled Duties
            </span>
          )}
        </div>
      )}

      {/* RENDER ACTIVE VIEW: CALENDAR OR TABLE */}
      {activeView === "calendar" ? (
        <DriverCalendar
          pickupManagers={pickupManagers}
          onOpenEdit={openEdit}
          onOpenMessage={(row) => setMessageRow(row)}
          onOpenReschedule={(row) => setRescheduleRow(row)}
        />
      ) : (
        <>
          {/* Upcoming vs History Tabs & Date Filter Pills (powered by /get_pick_drop_dashboard_stats) */}
          <div
            className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 p-2.5 rounded-3"
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Tab Buttons: All, Upcoming, History */}
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm rounded-pill fw-semibold border-0 d-inline-flex align-items-center gap-2"
                onClick={() => {
                  setRideTab("all");
                  setPage(1);
                }}
                style={{
                  fontSize: "12.5px",
                  padding: "6px 18px",
                  backgroundColor: rideTab === "all" ? "#22c7b8" : "#ffffff",
                  color: rideTab === "all" ? "#ffffff" : "#475569",
                  border: rideTab === "all" ? "none" : "1px solid #cbd5e1",
                  boxShadow:
                    rideTab === "all" ? "0 2px 8px rgba(34, 199, 184, 0.35)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <i className="fa-solid fa-list" />
                <span>All Rides</span>
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: rideTab === "all" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                    color: rideTab === "all" ? "#ffffff" : "#0f172a",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                  }}
                >
                  {counts?.total ?? dashboardStats?.summary?.totalRides ?? total ?? 0}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-sm rounded-pill fw-semibold border-0 d-inline-flex align-items-center gap-2"
                onClick={() => {
                  setRideTab("upcoming");
                  setPage(1);
                }}
                style={{
                  fontSize: "12.5px",
                  padding: "6px 18px",
                  backgroundColor: rideTab === "upcoming" ? "#22c7b8" : "#ffffff",
                  color: rideTab === "upcoming" ? "#ffffff" : "#475569",
                  border: rideTab === "upcoming" ? "none" : "1px solid #cbd5e1",
                  boxShadow:
                    rideTab === "upcoming" ? "0 2px 8px rgba(34, 199, 184, 0.35)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <i className="fa-solid fa-calendar-check" />
                <span>Upcoming</span>
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: rideTab === "upcoming" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                    color: rideTab === "upcoming" ? "#ffffff" : "#0f172a",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                  }}
                >
                  {dashboardStats?.summary?.upcomingTotal ?? 0}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-sm rounded-pill fw-semibold border-0 d-inline-flex align-items-center gap-2"
                onClick={() => {
                  setRideTab("history");
                  setPage(1);
                }}
                style={{
                  fontSize: "12.5px",
                  padding: "6px 18px",
                  backgroundColor: rideTab === "history" ? "#22c7b8" : "#ffffff",
                  color: rideTab === "history" ? "#ffffff" : "#475569",
                  border: rideTab === "history" ? "none" : "1px solid #cbd5e1",
                  boxShadow:
                    rideTab === "history" ? "0 2px 8px rgba(34, 199, 184, 0.35)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <i className="fa-solid fa-clock-rotate-left" />
                <span>History</span>
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: rideTab === "history" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                    color: rideTab === "history" ? "#ffffff" : "#0f172a",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                  }}
                >
                  {dashboardStats?.summary?.historyTotal ?? 0}
                </span>
              </button>
            </div>

            {/* Date Filter Pills: Today, Week, Month, All */}
            <div className="d-flex align-items-center gap-1.5 flex-wrap">
              <span className="text-muted fw-semibold me-1" style={{ fontSize: "11.5px" }}>
                <i className="fa-regular fa-calendar me-1" /> Filter:
              </span>
              {[
                { key: "all", label: "All", icon: "fa-solid fa-globe" },
                { key: "today", label: "Today", icon: "fa-solid fa-calendar-day" },
                { key: "week", label: "Week", icon: "fa-solid fa-calendar-week" },
                { key: "month", label: "Month", icon: "fa-solid fa-calendar" },
              ].map((pill) => {
                const isSelected = dateFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    className="btn btn-sm rounded-pill"
                    onClick={() => {
                      setDateFilter(pill.key);
                      setToday(pill.key === "today");
                      setPage(1);
                    }}
                    style={{
                      fontSize: "11.5px",
                      padding: "4px 13px",
                      fontWeight: isSelected ? 600 : 500,
                      backgroundColor: isSelected ? "#0f766e" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#334155",
                      border: isSelected ? "1px solid #0f766e" : "1px solid #cbd5e1",
                      boxShadow: isSelected ? "0 2px 6px rgba(15, 118, 110, 0.2)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <i className={`${pill.icon} me-1`} style={{ fontSize: "10.5px" }} />
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Search & Filter Toolbar */}
          <div
            className="search-btn-main"
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <TextField
              label="Search"
              size="small"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Patient, Driver, Vehicle, Hospital"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
              InputProps={{
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchInput("")} size="small">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <TextField
              label="Patient ID"
              size="small"
              value={patientInput}
              onChange={(event) => setPatientInput(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 140 }}
            />
            <TextField
              label="Start Date"
              type="date"
              size="small"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setToday(false);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 145 }}
            />
            <TextField
              label="End Date"
              type="date"
              size="small"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setToday(false);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 145 }}
            />
            <button
              type="button"
              onClick={() => {
                setToday((current) => !current);
                setDate("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              style={chipStyle(today)}
            >
              <i className="fa-solid fa-clock me-1"></i> Today
            </button>
            {(startDate || endDate || date || appliedSearch || appliedPatientId || today || status !== "All") && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={clearAllFilters}
                style={{ fontSize: 12, borderRadius: 20, padding: "5px 12px" }}
              >
                <i className="fa-solid fa-filter-circle-xmark me-1"></i> Clear
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              margin: "8px 0 16px",
            }}
          >
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setStatus(item.key);
                  setPage(1);
                }}
                style={chipStyle(status === item.key)}
              >
                {item.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: status === item.key ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                    color: status === item.key ? "#fff" : "#475569",
                  }}
                >
                  {counts?.[item.countKey] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CircularProgress size={24} style={{ color: "#22c7b8" }} />
              <span className="ms-2" style={{ color: "#64748b", fontSize: 13 }}>
                Loading pick & drop duties...
              </span>
            </div>
          )}

          {error && <p style={{ color: "red" }}>{error}</p>}

          {/* Appointments Table */}
          <div className="table-responsive">
            <TableContainer component={Paper} style={{ overflowX: "auto" }}>
              <Table stickyHeader className="table-no-card">
                <TableHead>
                  <TableRow>
                    <TableCell>Sr No.</TableCell>
                    <TableCell>Appointment</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Hospital</TableCell>
                    <TableCell>Appt Date / Time</TableCell>
                    <TableCell>Pickup</TableCell>
                    <TableCell>Drop</TableCell>
                    <TableCell>Driver & Vehicle</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((item, index) => {
                      const currentStatus =
                        item.pickDropStatus || item.status || "Pending";
                      const tone = STATUS_COLORS[currentStatus] || {
                        bg: "#f8fafc",
                        color: "#334155",
                      };
                      const pickupType = item.pickup_location_type || "Airport";
                      const dropType = item.drop_location_type || "Hospital";
                      const driverName =
                        item.pickup_manager_name || item.driver_name || "-";
                      const driverPhone =
                        item.pickup_manager_phone || item.driver_contact || "";

                      return (
                        <TableRow
                          key={item.appointmentId || item._id || index}
                          className={isRecordUnread(item) ? "unread-row" : undefined}
                          onClick={() => {
                            if (isRecordUnread(item)) markReadAction(item);
                          }}
                        >
                          <TableCell>{(page - 1) * LIMIT + index + 1}</TableCell>
                          <TableCell>
                            <div style={{ fontWeight: 600 }}>
                              {item.appointmentId || "-"}
                              <UnreadDot unread={isRecordUnread(item)} />
                            </div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {item.appointmentStatus || "Offline Duty"}
                            </div>
                          </TableCell>
                          <TableCell
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              markReadAction(item);
                              setViewRow(item);
                            }}
                            title="Click to view details"
                          >
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#0284c7",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                              {item.patientName || "-"}
                            </div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {item.patientId || "-"}
                            </div>
                          </TableCell>
                          <TableCell>{item.patientPhone || "-"}</TableCell>
                          <TableCell>{item.hospitalName || "-"}</TableCell>
                          <TableCell>
                            <div>{formatDate(item.appointment_Date)}</div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {item.appointment_Time || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`location-type-badge location-type-${pickupType
                                .toLowerCase()
                                .replace(/\s+/g, "")}`}
                            >
                              {pickupType}
                            </span>
                            <div>{item.pickup_location || "-"}</div>
                            <div style={{ color: "#0f766e", fontSize: 12, fontWeight: 600 }}>
                              <i className="fa-solid fa-clock me-1"></i>
                              {item.pickup_time || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`location-type-badge location-type-${dropType
                                .toLowerCase()
                                .replace(/\s+/g, "")}`}
                            >
                              {dropType}
                            </span>
                            <div>{item.drop_location || "-"}</div>
                            {item.drop_time && (
                              <div style={{ color: "#64748b", fontSize: 12 }}>
                                {item.drop_time}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div style={{ fontWeight: 600 }}>{driverName}</div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {[driverPhone, item.vehicle_no]
                                .filter(Boolean)
                                .join(" · ") || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 135 }}>
                              <Select
                                value={currentStatus}
                                displayEmpty
                                disabled={
                                  isReferral || updatingId === item.appointmentId
                                }
                                onChange={(event) =>
                                  updateStatus(item, event.target.value)
                                }
                                sx={{
                                  backgroundColor: tone.bg,
                                  color: tone.color,
                                  fontWeight: 600,
                                  fontSize: 12,
                                  borderRadius: 6,
                                  "& .MuiSelect-select": { py: "6px" },
                                }}
                              >
                                {STATUSES.map((option) => (
                                  <MenuItem
                                    key={option}
                                    value={option}
                                    sx={{ fontSize: 13 }}
                                  >
                                    {option}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell align="center">
                            <div
                              className="action-icon"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Tooltip title="View Details">
                                <VisibilityIcon
                                  className="eye-icon"
                                  style={{ cursor: "pointer", color: "#64748b" }}
                                  onClick={() => {
                                    markReadAction(item);
                                    setViewRow(item);
                                  }}
                                />
                              </Tooltip>
                              {!isReferral && (
                                <>
                                  <Tooltip title="Reschedule Ride">
                                    <i
                                      className="fa-solid fa-calendar-days text-warning"
                                      style={{
                                        cursor: "pointer",
                                        fontSize: 16,
                                      }}
                                      onClick={() => {
                                        markReadAction(item);
                                        setRescheduleRow(item);
                                      }}
                                    />
                                  </Tooltip>
                                  <Tooltip title="Update Duty">
                                    <i
                                      className="fa-solid fa-pen-to-square"
                                      style={{
                                        cursor: "pointer",
                                        color: "#22c7b8",
                                        fontSize: 15,
                                      }}
                                      onClick={() => {
                                        markReadAction(item);
                                        openEdit(item);
                                      }}
                                    />
                                  </Tooltip>
                                  <Tooltip title="Send WhatsApp/Email Alert">
                                    <i
                                      className="fa-brands fa-whatsapp text-success"
                                      style={{
                                        cursor: "pointer",
                                        fontSize: 16,
                                      }}
                                      onClick={() => {
                                        markReadAction(item);
                                        setMessageRow(item);
                                      }}
                                    />
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    !loading && (
                      <TableRow>
                        <TableCell colSpan={11} align="center">
                          <div style={{ padding: "30px 0", color: "#94a3b8" }}>
                            <i
                              className="fa-solid fa-car-side"
                              style={{ fontSize: 32, marginBottom: 8 }}
                            ></i>
                            <p style={{ margin: 0 }}>No Pick & Drop Appointments Found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                marginTop={2}
                paddingX={2}
                paddingBottom={2}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Showing {rows.length} of {total} appointments
                </span>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(event, value) => setPage(value)}
                  shape="rounded"
                />
              </Stack>
            </TableContainer>
          </div>
        </>
      )}

      {/* VIEW APPOINTMENT MODAL */}
      <Dialog
        fullWidth
        maxWidth="md"
        open={Boolean(viewRow)}
        scroll="paper"
        className="pickdrop-modal-dialog"
        onClose={() => setViewRow(null)}
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
            height: "min(90vh, 840px) !important",
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
        <div className="pickdrop-modal-header" style={{ flex: "0 0 auto" }}>
          <div className="header-left">
            <div className="header-icon-box">
              <i className="fa-solid fa-file-invoice"></i>
            </div>
            <div>
              <h5 className="modal-title">Pick & Drop Duty Details</h5>
              <p className="modal-subtitle">
                {viewRow ? `Appointment #${viewRow.appointmentId} • Patient: ${viewRow.patientName || "-"}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setViewRow(null)}
            title="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          className="pickdrop-modal-body"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {viewRow && (
            <Box>
              <div className="form-section-card">
                <div className="section-header">
                  <h6 className="section-title">
                    <span className="section-step-badge">1</span>
                    Patient & Appointment Information
                  </h6>
                  <span
                    className="popover-status-badge"
                    style={{
                      background: STATUS_COLORS[viewRow.pickDropStatus || viewRow.status]?.bg || "#f1f5f9",
                      color: STATUS_COLORS[viewRow.pickDropStatus || viewRow.status]?.color || "#334155",
                      border: `1px solid ${STATUS_COLORS[viewRow.pickDropStatus || viewRow.status]?.border || "#cbd5e1"}`,
                    }}
                  >
                    {viewRow.pickDropStatus || viewRow.status}
                  </span>
                </div>
                <div className="section-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <InfoItem label="Appointment ID" value={viewRow.appointmentId} />
                    </div>
                    <div className="col-md-4">
                      <InfoItem label="Patient Name" value={viewRow.patientName} />
                    </div>
                    <div className="col-md-4">
                      <InfoItem label="Patient ID" value={viewRow.patientId} />
                    </div>
                    <div className="col-md-4">
                      <InfoItem label="Phone" value={viewRow.patientPhone} />
                    </div>
                    <div className="col-md-4">
                      <InfoItem label="Hospital" value={viewRow.hospitalName} />
                    </div>
                    <div className="col-md-4">
                      <InfoItem
                        label="Status"
                        value={viewRow.pickDropStatus || viewRow.status}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section-card">
                <div className="section-header">
                  <h6 className="section-title">
                    <span className="section-step-badge">2</span>
                    Pickup, Drop & Driver Details
                  </h6>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Verified Route & Duty Assignment
                  </span>
                </div>
                <div className="section-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <InfoItem
                        label="Appointment Date"
                        value={formatDate(viewRow.appointment_Date)}
                      />
                    </div>
                    <div className="col-md-4">
                      <InfoItem
                        label="Appointment Time"
                        value={viewRow.appointment_Time}
                      />
                    </div>
                    <div className="col-md-4">
                      <InfoItem
                        label="Pickup Time"
                        value={viewRow.pickup_time}
                      />
                    </div>
                    <div className="col-md-6">
                      <InfoItem
                        label="Pickup Location"
                        value={
                          <div>
                            <span
                              className={`location-type-badge location-type-${(
                                viewRow.pickup_location_type || "airport"
                              )
                                .toLowerCase()
                                .replace(/\s+/g, "")} me-2`}
                            >
                              {viewRow.pickup_location_type || "Airport"}
                            </span>
                            {viewRow.pickup_location || "-"}
                          </div>
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <InfoItem
                        label="Drop Location"
                        value={
                          <div>
                            <span
                              className={`location-type-badge location-type-${(
                                viewRow.drop_location_type || "hospital"
                              )
                                .toLowerCase()
                                .replace(/\s+/g, "")} me-2`}
                            >
                              {viewRow.drop_location_type || "Hospital"}
                            </span>
                            {viewRow.drop_location || "-"}
                          </div>
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <InfoItem
                        label="Pickup Manager / Driver"
                        value={viewRow.pickup_manager_name || viewRow.driver_name}
                      />
                    </div>
                    <div className="col-md-4">
                      <InfoItem
                        label="Driver Phone"
                        value={viewRow.pickup_manager_phone || viewRow.driver_contact}
                      />
                    </div>
                    <div className="col-md-4">
                      <InfoItem label="Vehicle No." value={viewRow.vehicle_no} />
                    </div>
                    <div className="col-md-12">
                      <InfoItem label="Notes" value={viewRow.notes || viewRow.note} />
                    </div>
                  </div>
                </div>
              </div>
            </Box>
          )}
        </div>

        {/* View Modal Fixed Footer */}
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
            {viewRow ? `Duty Status: ${viewRow.pickDropStatus || viewRow.status || "Pending"}` : ""}
          </span>

          <div style={{ display: "flex", gap: 10 }}>
            {!isReferral && viewRow && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm"
                  onClick={() => {
                    const item = viewRow;
                    setViewRow(null);
                    setRescheduleRow(item);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                  }}
                >
                  <i className="fa-solid fa-calendar-days"></i> Reschedule
                </button>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => {
                    const item = viewRow;
                    setViewRow(null);
                    setMessageRow(item);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                  }}
                >
                  <i className="fa-brands fa-whatsapp"></i> Send Alert
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const item = viewRow;
                    setViewRow(null);
                    openEdit(item);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #0f766e 0%, #22c7b8 100%)",
                    borderColor: "#22c7b8",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Edit Duty
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-light btn-sm"
              onClick={() => setViewRow(null)}
              style={{
                border: "1px solid #cbd5e1",
                padding: "7px 16px",
                borderRadius: "8px",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>

      {/* EDIT APPOINTMENT / TRIP MODAL */}
      <Dialog
        fullWidth
        maxWidth="md"
        open={Boolean(editRow)}
        scroll="paper"
        className="pickdrop-modal-dialog"
        onClose={() => !saving && setEditRow(null)}
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
            height: "min(90vh, 840px) !important",
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
        <div className="pickdrop-modal-header" style={{ flex: "0 0 auto" }}>
          <div className="header-left">
            <div className="header-icon-box">
              <i className="fa-solid fa-pen-to-square"></i>
            </div>
            <div>
              <h5 className="modal-title">Update Pick & Drop Duty</h5>
              <p className="modal-subtitle">
                {editRow ? `Appointment #${editRow.appointmentId} • Patient: ${editRow.patientName || "-"}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            disabled={saving}
            onClick={() => setEditRow(null)}
            title="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          className="pickdrop-modal-body"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <form id="editPickDropForm" onSubmit={handleSaveEdit}>
            {/* Status & Driver Selection */}
            <div className="form-section-card">
              <div className="section-header">
                <h6 className="section-title">
                  <span className="section-step-badge">1</span>
                  Duty Status & Driver Assignment
                </h6>
              </div>
              <div className="section-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Pick & Drop Status</span>
                        <span className="req-star">* required</span>
                      </label>
                      <select
                        className="custom-input"
                        style={{ fontWeight: 600 }}
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value,
                            pickDropStatus: event.target.value,
                          }))
                        }
                        required
                      >
                        {STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Pickup Manager Preset Dropdown</span>
                      </label>
                      <select
                        className="custom-input"
                        style={{ fontWeight: 600 }}
                        value={
                          form.isCustomDriver
                            ? "Other"
                            : form.pickup_manager_name || "Ravi Kumar"
                        }
                        onChange={(e) => handleManagerChange(e.target.value)}
                      >
                        {pickupManagers.map((m) => (
                          <option key={m.id || m.name} value={m.name}>
                            {m.displayLabel || m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Reschedule notice if status selected */}
                  {form.status === "Rescheduled" && (
                    <div className="col-12">
                      <div
                        style={{
                          background: "#fef3c7",
                          border: "1px solid #fde68a",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontSize: "12.5px", color: "#92400e" }}>
                          <i className="fa-solid fa-triangle-exclamation text-warning me-1.5" />
                          <strong>Rescheduling Ride:</strong> To set a new appointment date, timing, reason and dispatch WhatsApp alerts, use the dedicated Reschedule Form.
                        </div>
                        <button
                          type="button"
                          className="btn btn-warning btn-sm text-white fw-bold shadow-sm"
                          style={{ backgroundColor: "#d97706", borderColor: "#d97706", fontSize: "12px", borderRadius: "6px" }}
                          onClick={() => {
                            const item = editRow;
                            setEditRow(null);
                            setRescheduleRow(item);
                          }}
                        >
                          <i className="fa-solid fa-calendar-days me-1" /> Open Reschedule Form
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status alert box */}
                  <div className="col-12">
                    {!form.isCustomDriver ? (
                      <div className="autofill-alert-box mb-0">
                        <i className="fa-solid fa-circle-check text-success" style={{ fontSize: 16 }}></i>
                        <div>
                          <strong>Preset Manager:</strong> {form.pickup_manager_name} ({form.pickup_manager_phone}). Driver fields are locked to verified contact.
                        </div>
                      </div>
                    ) : (
                      <div className="customdriver-alert-box mb-0">
                        <i className="fa-solid fa-triangle-exclamation text-warning" style={{ fontSize: 16 }}></i>
                        <div>
                          <strong>Custom Driver:</strong> You can enter custom driver name, contact & vehicle number below.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-md-4">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Driver Name</span>
                      </label>
                      <input
                        className="custom-input"
                        placeholder="e.g. Ramesh Kumar"
                        value={form.pickup_manager_name}
                        disabled={!form.isCustomDriver}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pickup_manager_name: event.target.value,
                            driver_name: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Driver Phone / Contact</span>
                      </label>
                      <input
                        className="custom-input"
                        placeholder="+91 98765 43210"
                        value={form.pickup_manager_phone}
                        disabled={!form.isCustomDriver}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pickup_manager_phone: event.target.value,
                            driver_contact: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Vehicle No.</span>
                      </label>
                      <input
                        className="custom-input"
                        placeholder="DL 01 AB 1234"
                        value={form.vehicle_no}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            vehicle_no: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Locations and Timing */}
            <div className="form-section-card">
              <div className="section-header">
                <h6 className="section-title">
                  <span className="section-step-badge">2</span>
                  Locations & Timing
                </h6>
              </div>
              <div className="section-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Pickup Location</span>
                      </label>
                      <input
                        className="custom-input"
                        value={form.pickup_location}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pickup_location: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-md-3">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Pickup Location Type</span>
                      </label>
                      <select
                        className="custom-input"
                        value={form.pickup_location_type}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pickup_location_type: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select Location Type</option>
                        {LOCATION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-md-3">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Pickup Time</span>
                      </label>
                      <input
                        className="custom-input"
                        value={form.pickup_time}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pickup_time: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Drop Location</span>
                      </label>
                      <input
                        className="custom-input"
                        value={form.drop_location}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            drop_location: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-md-3">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Drop Location Type</span>
                      </label>
                      <select
                        className="custom-input"
                        value={form.drop_location_type}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            drop_location_type: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select Location Type</option>
                        {LOCATION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-md-3">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Drop Time</span>
                      </label>
                      <input
                        className="custom-input"
                        value={form.drop_time}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            drop_time: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-md-12">
                    <div className="form-field-wrapper mb-0">
                      <label className="form-field-label">
                        <span>Duty Notes</span>
                      </label>
                      <textarea
                        className="custom-input"
                        rows={2}
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Edit Modal Fixed Footer */}
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
            {editRow ? `Duty: #${editRow.appointmentId} • Status: ${form.status}` : ""}
          </span>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-light"
              disabled={saving}
              onClick={() => setEditRow(null)}
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
              type="submit"
              className="add-button"
              disabled={saving || updatingId}
              onClick={handleSaveEdit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg, #0f766e 0%, #22c7b8 100%)",
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 20px",
                borderRadius: "8px",
                border: "none",
                color: "#fff",
                boxShadow: "0 2px 6px rgba(15, 118, 110, 0.25)",
              }}
            >
              {saving ? (
                <>
                  <CircularProgress size={16} color="inherit" /> Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i> Update Pick & Drop
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* DIRECT MESSAGE MODAL */}
      <SendPickDropMessageModal
        open={Boolean(messageRow)}
        onClose={() => setMessageRow(null)}
        appointment={messageRow}
        onSuccess={() => setReloadKey((k) => k + 1)}
      />

      {/* CREATE NEW APPOINTMENT MODAL */}
      <CreatePickDropAppointmentModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        pickupManagers={pickupManagers}
        onSuccess={() => setReloadKey((k) => k + 1)}
      />

      {/* RESCHEDULE PICK & DROP MODAL */}
      <ReschedulePickDropModal
        open={Boolean(rescheduleRow)}
        onClose={() => setRescheduleRow(null)}
        appointment={rescheduleRow}
        pickupManagers={pickupManagers}
        onSuccess={() => {
          setReloadKey((k) => k + 1);
          setRescheduleRow(null);
        }}
      />
    </div>
  );
}
