import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Swal from "sweetalert2";
import {
  fetchGHDashboardStats,
  fetchGHServicesList,
  deleteGHRecord,
  GH_STATUSES,
} from "../../services/guestHouseServicesApi";
import { fetchGuestHouses } from "../../services/guestHouseApi";
import CreateGHServiceModal from "./components/CreateGHServiceModal";
import GHDetailsModal from "./components/GHDetailsModal";
import AddServicesModal from "./components/AddServicesModal";
import AddPaymentModal from "./components/AddPaymentModal";
import EditStayInfoModal from "./components/EditStayInfoModal";
import "./GuestHouseServices.css";
import { markRecordRead } from "../../services/unreadApi";
import { UnreadDot } from "../../components/NewTag";

export default function GuestHouseServices({ embedded = false }) {
  const navigate = useNavigate();
  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const canAccessGHS =
    userRole === "admin" ||
    permissionsList.includes("/Guest_House_Services") ||
    permissionsList.includes("Guest_House_Services");

  useEffect(() => {
    if (!embedded && !canAccessGHS) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [embedded, canAccessGHS, navigate]);

  // Stats
  const [stats, setStats] = useState({
    totalBookings: 0,
    bookingsWithServices: 0,
    inProcessBookings: 0,
    completedBookings: 0,
    totalBilling: 0,
    totalAmenities: 0,
    totalFood: 0,
    totalPaid: 0,
    totalDue: 0,
    totalServicesCount: 0,
  });

  // Records list & filters
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guestHousesCatalog, setGuestHousesCatalog] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedGuestHouse, setSelectedGuestHouse] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyWithServices, setOnlyWithServices] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 10;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [editStayOpen, setEditStayOpen] = useState(false);

  const openServiceDetails = (rec) => {
    const recordId = rec?.booking_id || rec?.id || rec?.guestHouseServiceId || rec?._id;
    setSelectedRecordId(recordId);
    setDetailsModalOpen(true);
    if (recordId) markRecordRead("guestHouseServices", recordId);
  };

  useEffect(() => {
    loadStats();
    loadGuestHouses();
  }, []);

  const loadGuestHouses = async () => {
    try {
      const res = await fetchGuestHouses();
      const list = Array.isArray(res) ? res : res?.data || res?.details || [];
      setGuestHousesCatalog(list);
    } catch (e) {
      console.warn("Could not load guest houses for filter:", e);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [currentPage, selectedStatus, selectedGuestHouse, dateFrom, dateTo, onlyWithServices, searchTerm]);

  const loadStats = async () => {
    try {
      const data = await fetchGHDashboardStats();
      if (data) {
        setStats((prev) => ({
          ...prev,
          ...data,
          totalBilling: Number(data.totalBilling) || prev.totalBilling || 0,
          totalAmenities: Number(data.totalAmenities) || prev.totalAmenities || 0,
          totalFood: Number(data.totalFood) || prev.totalFood || 0,
          totalPaid: Number(data.totalPaid) || prev.totalPaid || 0,
          totalDue: Number(data.totalDue) || prev.totalDue || 0,
        }));
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: rowsPerPage,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      if (selectedGuestHouse !== "ALL") {
        const found = guestHousesCatalog.find(
          (gh) => (gh.name || gh.title) === selectedGuestHouse
        );
        if (found && found.id) {
          params.guestHouse_id = found.id;
        } else {
          params.search = params.search ? `${params.search} ${selectedGuestHouse}` : selectedGuestHouse;
        }
      }
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (onlyWithServices) params.only_with_services = 1;

      const res = await fetchGHServicesList(params);
      const list = res?.data || [];
      setRecords(list);
      setTotalPages(res?.totalPages || 1);
      setTotalCount(res?.totalCount !== undefined ? res.totalCount : list.length);
      if (res?.summary) {
        setStats((prev) => ({
          ...prev,
          totalBilling: Number(res.summary.totalBilling) || 0,
          totalAmenities: Number(res.summary.totalAmenities) || 0,
          totalFood: Number(res.summary.totalFood) || 0,
          totalPaid: Number(res.summary.totalPaid) || 0,
          totalDue: Number(res.summary.totalDue) || 0,
        }));
      }
    } catch (err) {
      console.error("Error loading GH service records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadRecords();
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("ALL");
    setSelectedGuestHouse("ALL");
    setDateFrom("");
    setDateTo("");
    setOnlyWithServices(false);
    setCurrentPage(1);
  };

  const handleDelete = async (rec) => {
    const bId = rec.booking_id || `Booking #${rec.id}`;
    const result = await Swal.fire({
      title: "Clear All Services?",
      text: `Are you sure you want to remove all add-on services and payment entries for ${bId} (${rec.name || rec.patient_name})? Room stay booking will remain untouched.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Clear Services",
    });

    if (result.isConfirmed) {
      try {
        const identifier = rec.booking_id || rec.id || rec._id || rec.guestHouseServiceId;
        await deleteGHRecord(identifier);
        Swal.fire("Cleared", "All services and payments for this booking removed successfully.", "success");
        loadRecords();
        loadStats();
      } catch (err) {
        Swal.fire("Error", typeof err === "string" ? err : err?.message || "Failed to clear services", "error");
      }
    }
  };

  // Unique guest houses for filter dropdown
  const uniqueGuestHouses = useMemo(() => {
    const fromRecords = records.map((r) => r.guest_house_name || r.guestHouseName).filter(Boolean);
    const fromCatalog = guestHousesCatalog.map((gh) => gh.name || gh.title).filter(Boolean);
    return Array.from(new Set([...fromCatalog, ...fromRecords])).sort();
  }, [records, guestHousesCatalog]);

  // Combined totals (Room stays + Add-on services)
  const combinedSummary = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        const roomBilled = Number(
          r.room_amount !== undefined
            ? r.room_amount
            : r.room_payment_amount !== undefined
            ? r.room_payment_amount
            : r.payment_amount || 0
        );
        const svcBilled = Number(
          r.services_final_amount !== undefined
            ? r.services_final_amount
            : r.final_services_cost !== undefined
            ? r.final_services_cost
            : r.services_total_amount !== undefined
            ? r.services_total_amount
            : r.final_amount || r.totalAmount || 0
        );
        const billed = Number(
          r.total_billed_amount !== undefined
            ? r.total_billed_amount
            : roomBilled + svcBilled
        );

        const roomPaid = Number(r.room_paid_amount || 0);
        const svcPaid = Number(r.services_paid_amount || 0);
        const paid = Number(
          r.total_paid_amount !== undefined
            ? r.total_paid_amount
            : roomPaid + svcPaid
        );

        const due = Number(
          r.total_due_amount !== undefined
            ? r.total_due_amount
            : Math.max(0, billed - paid)
        );

        return {
          totalBilled: acc.totalBilled + billed,
          totalPaid: acc.totalPaid + paid,
          totalDue: acc.totalDue + due,
        };
      },
      { totalBilled: 0, totalPaid: 0, totalDue: 0 }
    );
  }, [records]);

  const content = (
    <div className="gh-services-page">
      {/* Top Banner (if not embedded) */}
      {!embedded && (
        <div className="gh-services-header d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h4 className="page-title mb-1 fw-bold text-dark" style={{ fontSize: "20px" }}>
              <i className="fa fa-concierge-bell text-primary me-2" />
              Guest House Services & Payments
            </h4>
            <p className="text-muted small mb-0">
              Manage patient accommodation add-ons (meals, laundry, cabs, nursing, wheelchair) & track payment receipts.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
              onClick={() => {
                loadStats();
                loadRecords();
              }}
              title="Refresh data"
            >
              <i className="fa fa-refresh" /> Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm fw-bold px-3"
              style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
              onClick={() => setCreateModalOpen(true)}
              title="Book guest house stay, room, and add-on services for a patient"
            >
              <i className="fa fa-plus" /> New Guest House Booking
            </button>
          </div>
        </div>
      )}

      {/* Embedded Action Bar */}
      {embedded && (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "16px" }}>
              Guest House Stays, Services & Billing
            </h5>
            <small className="text-muted">
              Manage room stays, meals, cabs, laundry, and track guest house payment receipts
            </small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm fw-bold px-3"
              style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
              onClick={() => setCreateModalOpen(true)}
            >
              <i className="fa fa-plus" /> New Guest House Booking
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Bar (8 metrics) */}
      <div className="row g-3 mb-3">
        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-blue">
              <i className="fa fa-book" />
            </div>
            <div>
              <div className="gh-stat-value">{stats.totalBookings || totalCount || 0}</div>
              <div className="gh-stat-label">Total Stays</div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-purple">
              <i className="fa fa-concierge-bell" />
            </div>
            <div>
              <div className="gh-stat-value">
                {stats.bookingsWithServices || records.filter((r) => (r.services_count || 0) > 0).length || 0}
              </div>
              <div className="gh-stat-label">Stays With Services</div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-emerald">
              <i className="fa fa-bed" />
            </div>
            <div>
              <div className="gh-stat-value">{stats.inProcessBookings || stats.activeRecords || 0}</div>
              <div className="gh-stat-label">In-Process Stays</div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-indigo">
              <i className="fa fa-check-circle" />
            </div>
            <div>
              <div className="gh-stat-value">{stats.completedBookings || stats.completedRecords || 0}</div>
              <div className="gh-stat-label">Completed Stays</div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-blue">
              <i className="fa fa-list-check" />
            </div>
            <div>
              <div className="gh-stat-value">₹{(Number(stats.totalBilling) || 0).toLocaleString()}</div>
              <div className="gh-stat-label">
                Services Billed
                {(stats.totalAmenities > 0 || stats.totalFood > 0) && (
                  <span className="d-block text-muted" style={{ fontSize: "11px" }}>
                    Amen: ₹{Number(stats.totalAmenities || 0).toLocaleString()} • Food: ₹{Number(stats.totalFood || 0).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-emerald">
              <i className="fa fa-check" />
            </div>
            <div>
              <div className="gh-stat-value text-success">
                ₹{(Number(stats.totalPaid) || 0).toLocaleString()}
              </div>
              <div className="gh-stat-label">Services Paid</div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-rose">
              <i className="fa fa-exclamation-circle" />
            </div>
            <div>
              <div className="gh-stat-value text-danger">
                ₹{(Number(stats.totalDue) || 0).toLocaleString()}
              </div>
              <div className="gh-stat-label">Services Outstanding Due</div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 col-sm-6">
          <div className="gh-stat-card-custom">
            <div className="gh-stat-icon-wrapper gh-stat-icon-amber">
              <i className="fa fa-hotel" />
            </div>
            <div>
              <div className="gh-stat-value" style={{ color: "#0369a1" }}>
                ₹{combinedSummary.totalBilled.toLocaleString()}
              </div>
              <div className="gh-stat-label">
                Combined Stays + Services
                <span className="d-block text-muted" style={{ fontSize: "11px" }}>
                  Paid: ₹{combinedSummary.totalPaid.toLocaleString()} • Due: ₹{combinedSummary.totalDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="gh-filter-bar">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-lg-3 col-md-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white">
                <i className="fa fa-search text-muted" />
              </span>
              <input
                type="text"
                placeholder="Search patient, booking code, property..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control"
              />
            </div>
          </div>

          <div className="col-lg-2 col-md-3 col-6">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="form-select form-select-sm"
            >
              {GH_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === "ALL" ? "All Stays Status" : st}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-2 col-md-3 col-6">
            <select
              value={selectedGuestHouse}
              onChange={(e) => {
                setSelectedGuestHouse(e.target.value);
                setCurrentPage(1);
              }}
              className="form-select form-select-sm"
            >
              <option value="ALL">All Guest Houses</option>
              {uniqueGuestHouses.map((gh) => (
                <option key={gh} value={gh}>
                  {gh}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-2 col-md-3 col-6">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-control form-control-sm"
              title="Checkin From"
            />
          </div>

          <div className="col-lg-2 col-md-3 col-6">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-control form-control-sm"
              title="Checkin To"
            />
          </div>

          <div className="col-lg-1 col-md-12 text-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100"
              onClick={handleResetFilters}
              title="Reset All Filters"
            >
              <i className="fa fa-refresh" />
            </button>
          </div>

          {/* Quick Toggle: Only with Services */}
          <div className="col-12 mt-2">
            <div className="form-check form-check-inline">
              <input
                className="form-check-input"
                type="checkbox"
                id="onlyWithServicesCheck"
                checked={onlyWithServices}
                onChange={(e) => {
                  setOnlyWithServices(e.target.checked);
                  setCurrentPage(1);
                }}
              />
              <label className="form-check-label small fw-semibold text-dark" htmlFor="onlyWithServicesCheck">
                Show only bookings that have add-on services
              </label>
            </div>
          </div>
        </form>
      </div>

      {/* Main Data Table */}
      <div className="gh-table-card">
        <div className="gh-table-header">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "15px" }}>
              Guest House Bookings & Service Ledger
            </h6>
            <span className="badge bg-light text-primary border">{totalCount} Bookings</span>
          </div>

          <div className="d-flex align-items-center gap-2 small text-muted">
            <span>
              Showing Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table gh-table mb-0">
            <thead>
              <tr>
                <th>Booking Code</th>
                <th>Patient Details</th>
                <th>Property & Room</th>
                <th>Stay Period</th>
                <th>Total Billed (₹)</th>
                <th>Total Paid (₹)</th>
                <th>Balance Due (₹)</th>
                <th className="text-end text-nowrap" style={{ minWidth: "140px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2" />
                    <p className="text-muted small mb-0">Loading guest house records...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="text-muted mb-2" style={{ fontSize: "32px" }}>
                      <i className="fa fa-bed" />
                    </div>
                    <h6 className="fw-bold text-dark">No Guest House Bookings Found</h6>
                    <p className="small text-muted mb-3">
                      {searchTerm || selectedStatus !== "ALL" || onlyWithServices
                        ? "No bookings matched your filter criteria."
                        : "No patient guest house bookings have been recorded yet."}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm px-3"
                      onClick={() => setCreateModalOpen(true)}
                    >
                      <i className="fa fa-plus me-1" /> New Booking
                    </button>
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const roomCharge = Number(
                    rec.room_amount !== undefined
                      ? rec.room_amount
                      : rec.room_payment_amount !== undefined
                      ? rec.room_payment_amount
                      : rec.payment_amount || 0
                  );
                  const roomPaid = Number(rec.room_paid_amount || 0);
                  const roomDue = Number(
                    rec.room_due_amount !== undefined
                      ? rec.room_due_amount
                      : Math.max(0, roomCharge - roomPaid)
                  );

                  const servicesCharge = Number(
                    rec.services_final_amount !== undefined
                      ? rec.services_final_amount
                      : rec.final_services_cost !== undefined
                      ? rec.final_services_cost
                      : rec.services_total_amount !== undefined
                      ? rec.services_total_amount
                      : rec.final_amount || rec.totalAmount || 0
                  );
                  const servicesPaid = Number(rec.services_paid_amount || 0);
                  const servicesDue = Number(
                    rec.services_due_amount !== undefined
                      ? rec.services_due_amount
                      : Math.max(0, servicesCharge - servicesPaid)
                  );
                  const amenitiesCharge = Number(
                    rec.services_amenities_amount !== undefined
                      ? rec.services_amenities_amount
                      : rec.amenities_total || 0
                  );
                  const foodCharge = Number(
                    rec.services_food_amount !== undefined
                      ? rec.services_food_amount
                      : rec.food_total || rec.meals_total || 0
                  );

                  const totalBilled = Number(
                    rec.total_billed_amount !== undefined
                      ? rec.total_billed_amount
                      : roomCharge + servicesCharge
                  );
                  const totalPaid = Number(
                    rec.total_paid_amount !== undefined
                      ? rec.total_paid_amount
                      : roomPaid + servicesPaid
                  );
                  const totalDue = Number(
                    rec.total_due_amount !== undefined
                      ? rec.total_due_amount
                      : Math.max(0, totalBilled - totalPaid)
                  );

                  const fromStr = rec.checkin || rec.stayDateRangeFrom || "-";
                  const toStr = rec.checkout || rec.stayDateRangeTo || "-";
                  const stayDates = rec.stay_dates || `${fromStr} → ${toStr}`;
                  const bCode = rec.booking_id || (rec.id ? `GH-${rec.id}` : rec.guestHouseServiceId);
                  const servicesCount = rec.services_count !== undefined ? rec.services_count : (rec.services?.length || 0);
                  const paymentStatus = rec.overall_payment_status || (totalDue === 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Pending");

                  return (
                    <tr
                      key={rec.id || rec.booking_id || rec._id}
                      className={rec.isUnread === true ? "unread-row" : undefined}
                    >
                      {/* Booking Code */}
                      <td>
                        <span
                          className="fw-bold text-primary"
                          style={{ cursor: "pointer" }}
                          onClick={() => openServiceDetails(rec)}
                          title={rec.patient_stay_summary || rec.display_label || bCode}
                        >
                          {bCode}
                          <UnreadDot unread={rec.isUnread === true} />
                        </span>
                        {rec.created_at && (
                          <small className="text-muted d-block" style={{ fontSize: "11px" }}>
                            {rec.created_at.slice(0, 10)}
                          </small>
                        )}
                      </td>

                      {/* Patient Details */}
                      <td>
                        <strong
                          className="d-block"
                          style={{
                            cursor: "pointer",
                            color: "#0284c7",
                          }}
                          onClick={() => openServiceDetails(rec)}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          title="Click to view booking & service details"
                        >
                          {rec.name || rec.patient_name || "Patient"}
                        </strong>
                        <small className="text-muted d-block">
                          ID: {rec.user_id || rec.patientId || "-"}
                          {rec.phone && ` • ${rec.phone}`}
                        </small>
                        {rec.passport_number && (
                          <small className="text-muted d-block" style={{ fontSize: "11px" }}>
                            Passport: {rec.passport_number}
                          </small>
                        )}
                      </td>

                      {/* Property & Room */}
                      <td>
                        <span
                          className="fw-semibold text-dark d-block"
                          title={rec.guest_house_address || ""}
                        >
                          {rec.guest_house_name || rec.guestHouseName || "Guest House"}
                        </span>
                        <span className="badge bg-light text-muted border">
                          {rec.guest_house_room_type || (rec.roomNumber ? `Room: ${rec.roomNumber}` : "Room Assigned")}
                        </span>
                      </td>

                      {/* Stay Period */}
                      <td className="text-nowrap small text-muted">
                        <div>
                          <i className="fa fa-calendar me-1 text-primary" />
                          <span className="fw-semibold text-dark">{stayDates}</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: "11px" }}>
                          {rec.rooms || 1} room{rec.rooms > 1 ? "s" : ""} • {rec.adults || 1} adult{rec.adults > 1 ? "s" : ""}
                          {rec.children ? ` • ${rec.children} child` : ""}
                        </div>
                      </td>

                      {/* Total Billed */}
                      <td className="fw-bold text-dark">₹{totalBilled.toLocaleString()}</td>

                      {/* Total Paid */}
                      <td className="fw-semibold text-success">₹{totalPaid.toLocaleString()}</td>

                      {/* Balance Due */}
                      <td>
                        <span
                          className={`badge ${totalDue > 0 ? "bg-danger" : "bg-success"}`}
                          style={{ fontSize: "11.5px" }}
                        >
                          {totalDue > 0 ? `₹${totalDue.toLocaleString()}` : "Cleared"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-end text-nowrap" style={{ minWidth: "140px" }}>
                        <div className="d-inline-flex gap-1 align-items-center">
                          <Tooltip title="View Booking & Service Details" arrow placement="top">
                            <button
                              type="button"
                              className="action-btn-circle action-btn-circle-view"
                              onClick={() => openServiceDetails(rec)}
                              title="View Booking & Service Details"
                              aria-label="View Booking & Service Details"
                            >
                              <i className="fa fa-eye" />
                            </button>
                          </Tooltip>

                          <Tooltip title="Add Add-On Services / Meals" arrow placement="top">
                            <button
                              type="button"
                              className="action-btn-circle action-btn-circle-add"
                              onClick={() => {
                                setSelectedRecord(rec);
                                setAddServicesOpen(true);
                              }}
                              title="Add Add-on Services"
                              aria-label="Add Add-on Services"
                            >
                              <i className="fa fa-plus" />
                            </button>
                          </Tooltip>

                          <Tooltip title="Record Services Payment" arrow placement="top">
                            <button
                              type="button"
                              className="action-btn-circle action-btn-circle-payment"
                              onClick={() => {
                                setSelectedRecord(rec);
                                setAddPaymentOpen(true);
                              }}
                              title="Record Services Payment"
                              aria-label="Record Services Payment"
                            >
                              <i className="fa fa-credit-card" />
                            </button>
                          </Tooltip>

                          {servicesCount > 0 && (
                            <Tooltip title="Clear Add-On Services" arrow placement="top">
                              <button
                                type="button"
                                className="action-btn-circle action-btn-circle-delete"
                                onClick={() => handleDelete(rec)}
                                title="Clear Add-on Services"
                                aria-label="Clear Add-on Services"
                              >
                                <i className="fa fa-trash" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="gh-pagination-wrapper">
            <Stack spacing={2}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(_, page) => setCurrentPage(page)}
                color="primary"
                size="small"
              />
            </Stack>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateGHServiceModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          loadStats();
          loadRecords();
        }}
      />

      <GHDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        recordId={selectedRecordId}
        onRecordUpdated={() => {
          loadStats();
          loadRecords();
        }}
      />

      <AddServicesModal
        open={addServicesOpen}
        onClose={() => setAddServicesOpen(false)}
        record={selectedRecord}
        onSuccess={() => {
          loadStats();
          loadRecords();
        }}
      />

      <AddPaymentModal
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        record={selectedRecord}
        onSuccess={() => {
          loadStats();
          loadRecords();
        }}
      />

      <EditStayInfoModal
        open={editStayOpen}
        onClose={() => setEditStayOpen(false)}
        record={selectedRecord}
        onSuccess={() => {
          loadStats();
          loadRecords();
        }}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="page-wrapper gh-services-page-wrapper">
      <div className="content">{content}</div>
    </div>
  );
}
