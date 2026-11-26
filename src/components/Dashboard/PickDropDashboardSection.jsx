import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  fetchPickDropDashboardStats,
  PICK_DROP_STATUS_COLORS,
} from "../../services/pickDropApi";
import {
  isDriverUser,
  isPickDropStaffUser,
  getCurrentDriverUser,
  isHospitalUser,
} from "../../utils/authStorage";
import DriverCalendar from "../../pages/Genera Enquiry/DriverCalendar";
import "../../pages/Genera Enquiry/PickDropApp.css";

// Helper to normalize and deduplicate driver names
const normalizeDriverName = (rawName) => {
  const n = String(rawName || "").trim();
  if (!n) return null;
  const lower = n.toLowerCase();
  if (
    lower === "unassigned" ||
    lower.includes("drv name") ||
    lower.includes("pat driver") ||
    lower === "test"
  ) {
    return null;
  }
  if (lower === "ravi" || lower === "ravi kumar") return "Ravi Kumar";
  if (lower === "shivam" || lower === "shivam kumar") return "Shivam Kumar";
  return n
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export default function PickDropDashboardSection() {
  const navigate = useNavigate();
  const role = String(localStorage.getItem("Role") || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const driverUser = getCurrentDriverUser();
  const isDriver = isDriverUser();
  const isPickDropStaff = isPickDropStaffUser();
  const isHospital = isHospitalUser();
  const isPickDropUser = !isAdmin && (
    isPickDropStaff ||
    isDriver ||
    role.includes("pick") ||
    role.includes("drop") ||
    role.includes("driver") ||
    role.includes("transport")
  );

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("duties"); // "duties" | "calendar"
  const [rideTab, setRideTab] = useState("upcoming"); // "upcoming" | "history" (Section 2: tab)
  const [dateFilter, setDateFilter] = useState("all"); // "all" | "today" | "week" | "month" (Section 2: dateFilter)
  const [selectedDriver, setSelectedDriver] = useState(
    isDriver ? driverUser.name : "ALL"
  );
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDuty, setSelectedDuty] = useState(null);

  // Debounce search query to reduce redundant API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    if (isAdmin || !isPickDropUser) return;
    setLoading(true);
    try {
      const params = {
        tab: rideTab,
        dateFilter: dateFilter,
      };
      if (isHospital && driverUser.hospitalId) {
        params.hospital_id = driverUser.hospitalId;
      }
      if (selectedDriver && selectedDriver !== "ALL") {
        params.driver = selectedDriver;
      } else if (isDriver && driverUser.name) {
        params.driver = driverUser.name;
      }
      if (statusFilter && statusFilter.toUpperCase() !== "ALL") {
        params.status = statusFilter;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (page > 1) {
        params.page = page;
      }

      const res = await fetchPickDropDashboardStats(params);
      if (res) {
        setStats(res);
      }
    } catch (err) {
      console.warn("Error loading pick and drop dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [
    isAdmin,
    isPickDropUser,
    isDriver,
    isHospital,
    driverUser.hospitalId,
    driverUser.name,
    selectedDriver,
    rideTab,
    dateFilter,
    statusFilter,
    debouncedSearch,
    page,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const summary = stats?.summary || {
    totalRides: 0,
    thisMonthRides: 0,
    thisWeekRides: 0,
    todayTotal: 0,
    todayCompleted: 0,
    todayInProcess: 0,
    todayPending: 0,
    upcomingTotal: 0,
    historyTotal: 0,
  };

  const statusCounts = stats?.statusCounts || {};
  const rawDuties = useMemo(
    () =>
      Array.isArray(stats?.duties)
        ? stats.duties
        : Array.isArray(stats?.rides)
        ? stats.rides
        : rideTab === "history"
        ? (Array.isArray(stats?.historyDuties) ? stats.historyDuties : [])
        : (Array.isArray(stats?.upcomingDuties) ? stats.upcomingDuties : (Array.isArray(stats?.todayDuties) ? stats.todayDuties : [])),
    [stats?.duties, stats?.rides, stats?.historyDuties, stats?.upcomingDuties, stats?.todayDuties, rideTab]
  );
  const todayDuties = useMemo(
    () => (Array.isArray(stats?.todayDuties) ? stats.todayDuties : []),
    [stats?.todayDuties]
  );
  const rawDriverStats = useMemo(
    () => (Array.isArray(stats?.driverStats) ? stats.driverStats : []),
    [stats?.driverStats]
  );

  // Group and normalize drivers cleanly
  const cleanDriverStats = useMemo(() => {
    const map = new Map();
    rawDriverStats.forEach((d) => {
      const norm = normalizeDriverName(d.name);
      if (!norm) return;
      if (!map.has(norm)) {
        map.set(norm, { name: norm, totalRides: 0, todayRides: 0 });
      }
      const cur = map.get(norm);
      cur.totalRides += Number(d.totalRides || 0);
      cur.todayRides += Number(d.todayRides || 0);
    });

    if (!map.has("Ravi Kumar")) {
      map.set("Ravi Kumar", { name: "Ravi Kumar", totalRides: 0, todayRides: 0 });
    }
    if (!map.has("Shivam Kumar")) {
      map.set("Shivam Kumar", { name: "Shivam Kumar", totalRides: 0, todayRides: 0 });
    }

    return Array.from(map.values()).sort(
      (a, b) => b.todayRides - a.todayRides || b.totalRides - a.totalRides
    );
  }, [rawDriverStats]);

  const navigateToPortal = () => {
    navigate("/Admin/General_Enquiries?tab=pickup");
  };

  const getStatusStyle = (status) => {
    const key = String(status || "Pending");
    const colors = PICK_DROP_STATUS_COLORS[key] || {
      bg: "#f1f5f9",
      color: "#475569",
      border: "#cbd5e1",
    };
    return {
      backgroundColor: colors.bg,
      color: colors.color,
      border: `1px solid ${colors.border}`,
      fontSize: "11px",
      fontWeight: 600,
      padding: "3px 9px",
      borderRadius: "20px",
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
    };
  };

  // Filtered duties based on rawDuties (bound to response.data.duties)
  const filteredDuties = useMemo(() => {
    return rawDuties.filter((duty) => {
      // Driver filter
      if (selectedDriver && selectedDriver !== "ALL") {
        const dName = String(duty.driver_name || duty.pickup_manager_name || "").toLowerCase();
        if (!dName.includes(selectedDriver.toLowerCase())) return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const st = String(duty.pickDropStatus || duty.status || "Pending").toLowerCase();
        if (statusFilter === "ACTIVE") {
          if (!["in process", "picked up", "on the way"].includes(st)) return false;
        } else if (statusFilter === "COMPLETED") {
          if (!["completed", "dropped"].includes(st)) return false;
        } else if (statusFilter === "PENDING") {
          if (!["pending", "new"].includes(st)) return false;
        } else if (st !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = String(duty.patientName || duty.name || "").toLowerCase();
        const pPhone = String(duty.patientPhone || duty.phone || "").toLowerCase();
        const pFrom = String(duty.pickup_location || "").toLowerCase();
        const pTo = String(duty.drop_location || duty.hospitalName || "").toLowerCase();
        const dName = String(duty.driver_name || duty.pickup_manager_name || "").toLowerCase();
        const vNo = String(duty.vehicle_no || "").toLowerCase();
        const pId = String(duty.patientId || duty.appointmentId || "").toLowerCase();

        return (
          pName.includes(q) ||
          pPhone.includes(q) ||
          pFrom.includes(q) ||
          pTo.includes(q) ||
          dName.includes(q) ||
          vNo.includes(q) ||
          pId.includes(q)
        );
      }

      return true;
    });
  }, [rawDuties, selectedDriver, statusFilter, searchQuery]);

  // Current date formatted string
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  if (isAdmin || !isPickDropUser) {
    return null;
  }

  return (
    <div className="col-md-12 mb-4">
      <div
        className="card border-0 shadow-sm"
        style={{
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Top Header Section */}
        <div
          className="p-3 px-4 d-flex align-items-center justify-content-between flex-wrap gap-3"
          style={{
            background: "linear-gradient(135deg, #f8fafc 0%, #edf8fa 100%)",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {/* Title & Badge */}
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.28)",
              }}
            >
              <i className="fa-solid fa-car-side" />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "16px" }}>
                  Pick & Drop Transport & Duty Overview
                </h5>
                {isDriver ? (
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: "#e0f2fe",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      fontSize: "11px",
                      padding: "4px 9px",
                    }}
                  >
                    <i className="fa-solid fa-id-badge me-1" />
                    My Duties ({driverUser.name || "Driver"})
                  </span>
                ) : (
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: "#e0f2fe",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      fontSize: "11px",
                      padding: "4px 9px",
                    }}
                  >
                    <i className="fa-solid fa-car me-1" />
                    Fleet Overview
                  </span>
                )}
                {summary.todayInProcess > 0 && (
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #fde68a",
                      fontSize: "11px",
                      padding: "4px 9px",
                    }}
                  >
                    <i className="fa-solid fa-circle-dot me-1" style={{ color: "#f59e0b" }} />
                    {summary.todayInProcess} Active Transit
                  </span>
                )}
              </div>
              <small className="text-muted" style={{ fontSize: "12px" }}>
                Live transit monitoring, active driver dispatches & patient pickup schedule
              </small>
            </div>
          </div>

          {/* Right Header Controls: Tab Switcher & Actions */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Duties vs Calendar */}
            <div
              className="d-flex p-1 rounded-pill"
              style={{
                backgroundColor: "#e2e8f0",
                border: "1px solid #cbd5e1",
              }}
            >
              <button
                type="button"
                className="btn btn-sm rounded-pill fw-semibold border-0"
                onClick={() => setActiveTab("duties")}
                style={{
                  fontSize: "12px",
                  padding: "5px 14px",
                  transition: "all 0.2s ease",
                  backgroundColor: activeTab === "duties" ? "#ffffff" : "transparent",
                  color: activeTab === "duties" ? "#0284c7" : "#475569",
                  boxShadow:
                    activeTab === "duties" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <i className="fa-solid fa-list-check me-1.5" />
                Duties List ({filteredDuties.length})
              </button>
              <button
                type="button"
                className="btn btn-sm rounded-pill fw-semibold border-0"
                onClick={() => setActiveTab("calendar")}
                style={{
                  fontSize: "12px",
                  padding: "5px 14px",
                  transition: "all 0.2s ease",
                  backgroundColor: activeTab === "calendar" ? "#ffffff" : "transparent",
                  color: activeTab === "calendar" ? "#0284c7" : "#475569",
                  boxShadow:
                    activeTab === "calendar" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <i className="fa-solid fa-calendar-days me-1.5" />
                Calendar View
              </button>
            </div>

            {/* Driver Filter Dropdown */}
            {!isDriver && (
              <select
                className="form-select form-select-sm"
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                style={{
                  width: "150px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  borderColor: "#cbd5e1",
                  backgroundColor: "#ffffff",
                  fontWeight: 500,
                }}
              >
                <option value="ALL">All Drivers</option>
                {cleanDriverStats.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} {d.todayRides > 0 ? `(${d.todayRides} today)` : ""}
                  </option>
                ))}
              </select>
            )}

            {/* Refresh Button */}
            <Tooltip title="Refresh duties & stats">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setRefreshKey((k) => k + 1)}
                style={{
                  borderRadius: "8px",
                  padding: "6px 11px",
                  backgroundColor: "#ffffff",
                }}
              >
                <i className={`fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
              </button>
            </Tooltip>

            {/* Open Full Portal Button */}
            <button
              type="button"
              className="btn btn-sm btn-primary d-flex align-items-center gap-1.5 shadow-sm"
              onClick={navigateToPortal}
              style={{
                backgroundColor: "#0284c7",
                borderColor: "#0284c7",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                padding: "6px 14px",
              }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square" />
              Open Portal
            </button>
          </div>
        </div>

        {/* 4 Interactive KPI Summary Cards */}
        <div className="p-3 px-4 pb-2">
          <div className="row g-3">
            {/* 1. Today's Total */}
            <div className="col-xl-3 col-sm-6">
              <div
                className="p-3 rounded-3 h-100 transition"
                onClick={() => setStatusFilter("ALL")}
                style={{
                  background: statusFilter === "ALL" ? "#f0f9ff" : "#f8fafc",
                  border: statusFilter === "ALL" ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: statusFilter === "ALL" ? "0 4px 12px rgba(2, 132, 199, 0.12)" : "none",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                    Today's Total Duties
                  </span>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: "#e0f2fe",
                      color: "#0284c7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="fa-solid fa-calendar-day" />
                  </div>
                </div>
                <h4 className="fw-bold mb-1 text-dark" style={{ fontSize: "24px" }}>
                  {summary.todayTotal || 0}
                </h4>
                <div className="small text-muted d-flex align-items-center justify-content-between" style={{ fontSize: "11px" }}>
                  <span>
                    <strong className="text-success">{summary.todayCompleted || 0}</strong> Completed ·{" "}
                    <strong className="text-primary">{summary.todayInProcess || 0}</strong> Active
                  </span>
                  <span className="text-primary fw-semibold" style={{ fontSize: "10.5px" }}>
                    {todayFormatted.split(",")[0]}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Active En Route */}
            <div className="col-xl-3 col-sm-6">
              <div
                className="p-3 rounded-3 h-100 transition"
                onClick={() => setStatusFilter(statusFilter === "ACTIVE" ? "ALL" : "ACTIVE")}
                style={{
                  background: statusFilter === "ACTIVE" ? "#faf5ff" : "#f8fafc",
                  border: statusFilter === "ACTIVE" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: statusFilter === "ACTIVE" ? "0 4px 12px rgba(124, 58, 237, 0.12)" : "none",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                    Active / In Transit
                  </span>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: "#f3e8ff",
                      color: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="fa-solid fa-route" />
                  </div>
                </div>
                <h4 className="fw-bold mb-1 text-dark" style={{ fontSize: "24px" }}>
                  {summary.todayInProcess || 0}
                </h4>
                <div className="small text-muted" style={{ fontSize: "11px" }}>
                  <span>{statusCounts.pickedUp || 0} Picked Up</span> ·{" "}
                  <span>{statusCounts.onTheWay || 0} En Route</span>
                </div>
              </div>
            </div>

            {/* 3. Completed Today */}
            <div className="col-xl-3 col-sm-6">
              <div
                className="p-3 rounded-3 h-100 transition"
                onClick={() => setStatusFilter(statusFilter === "COMPLETED" ? "ALL" : "COMPLETED")}
                style={{
                  background: statusFilter === "COMPLETED" ? "#f0fdf4" : "#f8fafc",
                  border: statusFilter === "COMPLETED" ? "2px solid #16a34a" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: statusFilter === "COMPLETED" ? "0 4px 12px rgba(22, 163, 74, 0.12)" : "none",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                    Completed Today
                  </span>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: "#dcfce7",
                      color: "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="fa-solid fa-circle-check" />
                  </div>
                </div>
                <h4 className="fw-bold mb-1 text-dark" style={{ fontSize: "24px" }}>
                  {summary.todayCompleted || 0}
                </h4>
                <div className="small text-muted" style={{ fontSize: "11px" }}>
                  <span>Patients dropped safely at destination</span>
                </div>
              </div>
            </div>

            {/* 4. Month Total / Pending */}
            <div className="col-xl-3 col-sm-6">
              <div
                className="p-3 rounded-3 h-100 transition"
                onClick={() => setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")}
                style={{
                  background: statusFilter === "PENDING" ? "#fffbeb" : "#f8fafc",
                  border: statusFilter === "PENDING" ? "2px solid #d97706" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: statusFilter === "PENDING" ? "0 4px 12px rgba(217, 119, 6, 0.12)" : "none",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                    This Month / Pending
                  </span>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: "#fef3c7",
                      color: "#d97706",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="fa-solid fa-clock" />
                  </div>
                </div>
                <h4 className="fw-bold mb-1 text-dark" style={{ fontSize: "24px" }}>
                  {summary.thisMonthRides || summary.totalRides || 0}
                </h4>
                <div className="small text-muted" style={{ fontSize: "11px" }}>
                  <span className="text-warning fw-semibold">
                    {summary.todayPending || 0} Pending pickup today
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clean Driver Fleet Pills Bar */}
          {cleanDriverStats.length > 0 && (
            <div
              className="mt-3 p-2.5 px-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            >
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-bold text-dark d-flex align-items-center gap-1.5">
                  <i className="fa-solid fa-users text-primary" /> Driver Fleet:
                </span>

                {/* All Drivers Chip */}
                <button
                  type="button"
                  className="btn btn-sm rounded-pill border-0"
                  onClick={() => setSelectedDriver("ALL")}
                  style={{
                    fontSize: "11.5px",
                    padding: "3px 10px",
                    fontWeight: 600,
                    backgroundColor: selectedDriver === "ALL" ? "#0284c7" : "#ffffff",
                    color: selectedDriver === "ALL" ? "#ffffff" : "#475569",
                    border: selectedDriver === "ALL" ? "none" : "1px solid #cbd5e1",
                    boxShadow: selectedDriver === "ALL" ? "0 2px 6px rgba(2,132,199,0.25)" : "none",
                  }}
                >
                  All ({filteredDuties.length})
                </button>

                {/* Individual Clean Driver Pills */}
                {cleanDriverStats.map((d) => {
                  const isSelected = selectedDriver === d.name;
                  return (
                    <button
                      key={d.name}
                      type="button"
                      className="btn btn-sm rounded-pill"
                      onClick={() => setSelectedDriver(isSelected ? "ALL" : d.name)}
                      style={{
                        fontSize: "11.5px",
                        padding: "3px 10px",
                        fontWeight: 500,
                        backgroundColor: isSelected ? "#0284c7" : "#ffffff",
                        color: isSelected ? "#ffffff" : "#334155",
                        border: isSelected ? "1px solid #0284c7" : "1px solid #cbd5e1",
                        boxShadow: isSelected ? "0 2px 6px rgba(2,132,199,0.25)" : "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                          color: isSelected ? "#ffffff" : "#475569",
                          fontSize: "10px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        {d.name.charAt(0)}
                      </span>
                      <span>{d.name}</span>
                      {d.todayRides > 0 ? (
                        <span
                          className="badge rounded-pill"
                          style={{
                            backgroundColor: isSelected ? "#ffffff" : "#10b981",
                            color: isSelected ? "#0284c7" : "#ffffff",
                            fontSize: "9.5px",
                            padding: "2px 6px",
                          }}
                        >
                          {d.todayRides} today
                        </span>
                      ) : (
                        <span
                          style={{
                            color: isSelected ? "rgba(255,255,255,0.8)" : "#94a3b8",
                            fontSize: "10.5px",
                          }}
                        >
                          ({d.totalRides})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status / Rescheduled indicator */}
              {statusCounts.rescheduled > 0 && (
                <span
                  className="badge px-2.5 py-1.5 rounded-pill"
                  style={{
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    fontWeight: 600,
                  }}
                >
                  <i className="fa-solid fa-calendar-days me-1" />
                  {statusCounts.rescheduled} Rescheduled
                </span>
              )}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: CALENDAR VIEW                                    */}
        {/* ======================================================== */}
        {activeTab === "calendar" ? (
          <div className="p-3 px-4 pt-1">
            <div
              className="p-3 rounded-3"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "14px" }}>
                    <i className="fa-solid fa-calendar-days text-primary me-2" />
                    Driver Dispatch & Transit Calendar Schedule
                  </h6>
                  <small className="text-muted">
                    Click any scheduled duty card to view complete patient, landmark & contact details
                  </small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setActiveTab("duties")}
                    style={{ fontSize: "12px", borderRadius: "8px" }}
                  >
                    <i className="fa-solid fa-list-check me-1" />
                    Switch to Duties Table
                  </button>
                </div>
              </div>

              {/* Embedded FullCalendar Component */}
              <div style={{ minHeight: "620px" }}>
                <DriverCalendar
                  pickupManagers={cleanDriverStats.map((d) => ({
                    id: d.name,
                    name: d.name,
                  }))}
                  onOpenEdit={() => navigateToPortal()}
                  onOpenMessage={() => navigateToPortal()}
                  onOpenReschedule={() => navigateToPortal()}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* TAB 2: DUTIES LIST VIEW                                 */
          /* ======================================================== */
          <div className="p-3 px-4 pt-1">
            {/* 1. UPCOMING vs HISTORY TABS & DATE FILTER PILLS */}
            <div
              className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 p-2.5 rounded-3"
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              {/* Tab Buttons: Upcoming (tab=upcoming) & History (tab=history) */}
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm rounded-pill fw-semibold border-0 d-inline-flex align-items-center gap-2"
                  onClick={() => {
                    setRideTab("upcoming");
                    setPage(1);
                  }}
                  style={{
                    fontSize: "12.5px",
                    padding: "6px 16px",
                    backgroundColor: rideTab === "upcoming" ? "#0284c7" : "#ffffff",
                    color: rideTab === "upcoming" ? "#ffffff" : "#475569",
                    border: rideTab === "upcoming" ? "none" : "1px solid #cbd5e1",
                    boxShadow:
                      rideTab === "upcoming" ? "0 2px 8px rgba(2, 132, 199, 0.28)" : "none",
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
                    {summary.upcomingTotal ?? (stats?.statusCounts?.upcomingTotal ?? 0)}
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
                    padding: "6px 16px",
                    backgroundColor: rideTab === "history" ? "#0284c7" : "#ffffff",
                    color: rideTab === "history" ? "#ffffff" : "#475569",
                    border: rideTab === "history" ? "none" : "1px solid #cbd5e1",
                    boxShadow:
                      rideTab === "history" ? "0 2px 8px rgba(2, 132, 199, 0.28)" : "none",
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
                    {summary.historyTotal ?? (stats?.statusCounts?.historyTotal ?? 0)}
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
                        setPage(1);
                      }}
                      style={{
                        fontSize: "11.5px",
                        padding: "4px 12px",
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

            {/* Table Action & Filter Toolbar */}
            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
              {/* Left: Section Title, Count & Status Filter */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  <i className="fa-solid fa-clipboard-list me-1.5 text-primary" />
                  {rideTab === "history" ? "Ride History" : "Upcoming Duties"} ({filteredDuties.length})
                </span>

                {/* Status Dropdown Filter */}
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: "140px",
                    fontSize: "11.5px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                    backgroundColor: "#ffffff",
                    fontWeight: 500,
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Pending">Pending</option>
                  <option value="In Process">In Process</option>
                  <option value="Picked Up">Picked Up</option>
                  <option value="On the Way">On the Way</option>
                  <option value="Dropped">Dropped</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                {statusFilter !== "ALL" && (
                  <span
                    className="badge rounded-pill bg-light text-primary border"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    Filtered by: {statusFilter}
                    <i
                      className="fa-solid fa-xmark ms-1 cursor-pointer"
                      onClick={() => setStatusFilter("ALL")}
                    />
                  </span>
                )}
                {selectedDriver !== "ALL" && (
                  <span
                    className="badge rounded-pill bg-light text-secondary border"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    Driver: {selectedDriver}
                    <i
                      className="fa-solid fa-xmark ms-1 cursor-pointer"
                      onClick={() => setSelectedDriver("ALL")}
                    />
                  </span>
                )}
              </div>

              {/* Right: Quick Search Input & Calendar shortcut */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div
                  className="input-group input-group-sm"
                  style={{ width: "260px" }}
                >
                  <span
                    className="input-group-text bg-white border-end-0"
                    style={{ borderRadius: "8px 0 0 8px", color: "#94a3b8" }}
                  >
                    <i className="fa-solid fa-magnifying-glass" />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search patient, phone, driver, vehicle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      borderRadius: "0 8px 8px 0",
                      fontSize: "12px",
                      borderColor: "#cbd5e1",
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setSearchQuery("")}
                      style={{ fontSize: "11px" }}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary fw-semibold"
                  onClick={() => setActiveTab("calendar")}
                  style={{ fontSize: "12px", borderRadius: "8px" }}
                >
                  <i className="fa-solid fa-calendar-days me-1" />
                  View Calendar
                </button>
              </div>
            </div>

            {/* Empty State vs Duty Table */}
            {filteredDuties.length === 0 ? (
              <div
                className="p-5 text-center rounded-3 my-2"
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "#e2e8f0",
                    color: "#64748b",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    marginBottom: "12px",
                  }}
                >
                  <i className="fa-solid fa-car-side" />
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  {searchQuery || statusFilter !== "ALL" || selectedDriver !== "ALL"
                    ? "No matching duties found"
                    : rideTab === "history"
                    ? "No past rides found for selected period"
                    : "No upcoming pick & drop duties scheduled"}
                </h6>
                <p className="text-muted small mb-3">
                  {searchQuery || statusFilter !== "ALL" || selectedDriver !== "ALL"
                    ? "Try adjusting your search query, status filters or driver selection."
                    : rideTab === "history"
                    ? "Past completed and cancelled rides will appear here."
                    : "Future rides will automatically appear here as soon as scheduled."}
                </p>
                <div className="d-flex align-items-center justify-content-center gap-2">
                  {(searchQuery || statusFilter !== "ALL" || selectedDriver !== "ALL" || dateFilter !== "all") && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("ALL");
                        setSelectedDriver("ALL");
                        setDateFilter("all");
                      }}
                      style={{ fontSize: "12px", borderRadius: "6px" }}
                    >
                      Clear Filters
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={navigateToPortal}
                    style={{
                      fontSize: "12px",
                      borderRadius: "6px",
                      backgroundColor: "#0284c7",
                      borderColor: "#0284c7",
                    }}
                  >
                    <i className="fa-solid fa-plus me-1" /> Schedule New Ride
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="table-responsive rounded-3"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <table
                  className="table table-hover align-middle mb-0"
                  style={{ fontSize: "12.5px" }}
                >
                  <thead
                    style={{
                      backgroundColor: "#f8fafc",
                      color: "#475569",
                      borderBottom: "2px solid #e2e8f0",
                    }}
                  >
                    <tr>
                      <th style={{ padding: "11px 14px", fontWeight: 700 }}>Pickup Time</th>
                      <th style={{ padding: "11px 14px", fontWeight: 700 }}>Patient Details</th>
                      <th style={{ padding: "11px 14px", fontWeight: 700 }}>Route (From ➔ Destination)</th>
                      <th style={{ padding: "11px 14px", fontWeight: 700 }}>Driver & Vehicle</th>
                      <th style={{ padding: "11px 14px", fontWeight: 700 }}>Status</th>
                      <th style={{ padding: "11px 14px", fontWeight: 700, textAlign: "right" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDuties.map((duty, idx) => {
                      const status = duty.pickDropStatus || duty.status || "Pending";
                      const patientName = duty.patientName || duty.name || "Patient";
                      const patientPhone = duty.patientPhone || duty.phone || "";
                      const driverName = duty.driver_name || duty.pickup_manager_name || "Unassigned";

                      return (
                        <tr key={duty._id || duty.appointmentId || idx}>
                          {/* Pickup Date & Time */}
                          <td style={{ padding: "12px 14px" }}>
                            <div
                              className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill"
                              style={{
                                backgroundColor: "#f0f9ff",
                                color: "#0369a1",
                                border: "1px solid #bae6fd",
                                fontWeight: 700,
                                fontSize: "11.5px",
                              }}
                            >
                              <i className="fa-regular fa-clock" style={{ fontSize: "11px" }} />
                              {duty.pickup_time || duty.appointment_Time || "TBD"}
                            </div>
                            <div className="text-muted mt-1" style={{ fontSize: "11px" }}>
                              <i className="fa-regular fa-calendar me-1" />
                              {duty.appointment_Date || duty.date || "Date pending"}
                            </div>
                          </td>

                          {/* Patient Details */}
                          <td style={{ padding: "12px 14px" }}>
                            <div className="d-flex align-items-center gap-2.5">
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  backgroundColor: "#e0f2fe",
                                  color: "#0284c7",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                }}
                              >
                                {patientName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="fw-bold text-dark" style={{ fontSize: "13px" }}>
                                  {patientName}
                                </div>
                                <div className="text-muted d-flex align-items-center gap-1.5" style={{ fontSize: "11px" }}>
                                  <span>ID: {duty.patientId || duty.appointmentId || "N/A"}</span>
                                  {patientPhone && (
                                    <>
                                      <span>·</span>
                                      <a
                                        href={`tel:${patientPhone}`}
                                        className="text-primary text-decoration-none"
                                        title="Call patient"
                                      >
                                        <i className="fa-solid fa-phone me-1" style={{ fontSize: "9.5px" }} />
                                        {patientPhone}
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Route (From ➔ To) */}
                          <td style={{ padding: "12px 14px", maxWidth: "280px" }}>
                            <div
                              className="text-truncate"
                              title={duty.pickup_location || "Airport / Landmark"}
                              style={{ fontSize: "12px" }}
                            >
                              <i
                                className="fa-solid fa-location-dot text-danger me-1.5"
                                style={{ fontSize: "11px" }}
                              />
                              <span className="text-muted">From:</span>{" "}
                              <strong className="text-dark">
                                {duty.pickup_location || "Pickup Location"}
                              </strong>
                            </div>
                            <div
                              className="text-truncate mt-1"
                              title={duty.drop_location || duty.hospitalName || "Hospital"}
                              style={{ fontSize: "12px" }}
                            >
                              <i
                                className="fa-solid fa-hospital text-primary me-1.5"
                                style={{ fontSize: "11px" }}
                              />
                              <span className="text-muted">To:</span>{" "}
                              <strong>
                                {duty.drop_location || duty.hospitalName || "Destination Hospital"}
                              </strong>
                            </div>
                          </td>

                          {/* Driver & Vehicle */}
                          <td style={{ padding: "12px 14px" }}>
                            <div className="fw-bold text-dark d-flex align-items-center gap-1.5">
                              <i className="fa-solid fa-id-badge text-secondary" />
                              {driverName}
                            </div>
                            {duty.vehicle_no ? (
                              <div
                                className="badge bg-light text-dark border mt-1"
                                style={{
                                  fontSize: "10.5px",
                                  padding: "2px 6px",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                🚗 {duty.vehicle_no}
                              </div>
                            ) : (
                              <small className="text-muted" style={{ fontSize: "10.5px" }}>
                                Vehicle pending
                              </small>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 14px" }}>
                            <span style={getStatusStyle(status)}>
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  backgroundColor: "currentColor",
                                }}
                              />
                              {status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            <div className="d-inline-flex align-items-center gap-1.5">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setSelectedDuty(duty)}
                                style={{
                                  fontSize: "11.5px",
                                  padding: "3px 9px",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                }}
                                title="View Duty Details"
                              >
                                View <i className="fa-solid fa-angle-right ms-0.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Pagination footer */}
                {stats?.totalPages > 1 && (
                  <div className="p-2.5 px-3 bg-light border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="text-muted small" style={{ fontSize: "11.5px" }}>
                      Page {page} of {stats.totalPages} ({stats.total || filteredDuties.length} total rides)
                    </span>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={page >= stats.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* DUTY DETAIL QUICK VIEW MODAL                             */}
      {/* ======================================================== */}
      {selectedDuty && (
        <Dialog
          open={Boolean(selectedDuty)}
          onClose={() => setSelectedDuty(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            style: { borderRadius: "14px", overflow: "hidden" },
          }}
        >
          {/* Modal Header */}
          <div
            className="p-3 px-4 d-flex align-items-center justify-content-between"
            style={{
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-car-side fs-5" />
              <h6 className="mb-0 fw-bold" style={{ fontSize: "15px", color: "#ffffff" }}>
                Duty Details: {selectedDuty.patientName || selectedDuty.name || "Patient"}
              </h6>
            </div>
            <IconButton
              size="small"
              onClick={() => setSelectedDuty(null)}
              style={{ color: "#ffffff" }}
            >
              <i className="fa-solid fa-xmark" />
            </IconButton>
          </div>

          <DialogContent className="p-4" style={{ fontSize: "13px" }}>
            <div className="row g-3">
              {/* Status & Time Alert */}
              <div className="col-12">
                <div
                  className="p-3 rounded-3 d-flex align-items-center justify-content-between"
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <small className="text-muted d-block">Scheduled Pickup Time</small>
                    <strong className="fs-6 text-dark">
                      <i className="fa-regular fa-clock me-1 text-primary" />
                      {selectedDuty.pickup_time || "Time TBD"}
                    </strong>
                    <span className="ms-2 text-muted" style={{ fontSize: "12px" }}>
                      ({selectedDuty.appointment_Date || selectedDuty.date || todayFormatted})
                    </span>
                  </div>
                  <div>
                    <span style={getStatusStyle(selectedDuty.pickDropStatus || selectedDuty.status)}>
                      {selectedDuty.pickDropStatus || selectedDuty.status || "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Patient Info */}
              <div className="col-sm-6">
                <div className="p-3 rounded-3 h-100" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <small className="text-muted fw-bold text-uppercase" style={{ fontSize: "10.5px" }}>
                    Patient Info
                  </small>
                  <div className="fw-bold fs-6 text-dark mt-1">
                    {selectedDuty.patientName || selectedDuty.name || "N/A"}
                  </div>
                  <div className="text-muted small mt-1">
                    ID: {selectedDuty.patientId || selectedDuty.appointmentId || "N/A"}
                  </div>
                  {selectedDuty.patientPhone && (
                    <div className="mt-2 d-flex align-items-center gap-2">
                      <a
                        href={`tel:${selectedDuty.patientPhone}`}
                        className="btn btn-sm btn-outline-primary"
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                      >
                        <i className="fa-solid fa-phone me-1" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${String(selectedDuty.patientPhone).replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-success"
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                      >
                        <i className="fa-brands fa-whatsapp me-1" /> WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Driver & Vehicle */}
              <div className="col-sm-6">
                <div className="p-3 rounded-3 h-100" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <small className="text-muted fw-bold text-uppercase" style={{ fontSize: "10.5px" }}>
                    Assigned Fleet
                  </small>
                  <div className="fw-bold fs-6 text-dark mt-1">
                    <i className="fa-solid fa-id-badge text-secondary me-1" />
                    {selectedDuty.driver_name || selectedDuty.pickup_manager_name || "Unassigned"}
                  </div>
                  {selectedDuty.driverPhone && (
                    <div className="text-muted small mt-1">
                      <i className="fa-solid fa-phone me-1 text-muted" />
                      {selectedDuty.driverPhone}
                    </div>
                  )}
                  {selectedDuty.vehicle_no && (
                    <div className="badge bg-white text-dark border mt-2" style={{ fontSize: "11px" }}>
                      🚗 Vehicle: {selectedDuty.vehicle_no}
                    </div>
                  )}
                </div>
              </div>

              {/* Route Details */}
              <div className="col-12">
                <div className="p-3 rounded-3" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <small className="text-muted fw-bold text-uppercase" style={{ fontSize: "10.5px" }}>
                    Route Details
                  </small>
                  <div className="mt-2">
                    <div className="d-flex align-items-start gap-2 mb-2">
                      <i className="fa-solid fa-location-dot text-danger mt-1" />
                      <div>
                        <strong className="text-dark">Pickup Location:</strong>
                        <div>{selectedDuty.pickup_location || "Airport / Landmark pending"}</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-start gap-2">
                      <i className="fa-solid fa-hospital text-primary mt-1" />
                      <div>
                        <strong className="text-dark">Drop Location / Hospital:</strong>
                        <div>{selectedDuty.drop_location || selectedDuty.hospitalName || "Hospital"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flight / Train details if available */}
              {(selectedDuty.flight_number || selectedDuty.flightNo || selectedDuty.terminal) && (
                <div className="col-12">
                  <div className="p-2.5 px-3 rounded-3 bg-light border text-muted small">
                    <i className="fa-solid fa-plane-arrival me-1 text-primary" />
                    <strong>Flight Info:</strong>{" "}
                    {selectedDuty.flight_number || selectedDuty.flightNo || "N/A"}{" "}
                    {selectedDuty.terminal ? `(Terminal: ${selectedDuty.terminal})` : ""}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>

          <DialogActions className="p-3 px-4 bg-light border-top d-flex justify-content-between">
            <Button
              onClick={() => setSelectedDuty(null)}
              variant="outlined"
              size="small"
              style={{ textTransform: "none", borderRadius: "6px" }}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setSelectedDuty(null);
                navigateToPortal();
              }}
              variant="contained"
              size="small"
              style={{
                textTransform: "none",
                borderRadius: "6px",
                backgroundColor: "#0284c7",
              }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square me-1.5" />
              Manage in Pick & Drop Portal
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
