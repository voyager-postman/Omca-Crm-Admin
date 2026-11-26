import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem } from "@mui/material";
import {
  fetchPatientsWithoutOmcaId,
  updateUserStatus,
  updateAppUser,
  fetchAppUserDetail,
  fetchUserStatuses,
  APP_USER_ALLOWED_STATUSES,
} from "../../services/appUsersApi";
import { markLeadAsConverted, getConvertedLeadIds } from "../../services/leadsApi";
import CreateEnquiryModal from "../../components/Common/CreateEnquiryModal";
import "./AppUsers.css";

export const getAppUserStatusBadgeStyle = (status) => {
  const s = String(status || "").toLowerCase().trim();
  switch (s) {
    case "pending":
      return {
        color: "#b45309",
        backgroundColor: "#fef3c7",
        borderColor: "#fde68a",
      };
    case "follow-up":
    case "follow up":
      return {
        color: "#0369a1",
        backgroundColor: "#e0f2fe",
        borderColor: "#bae6fd",
      };
    case "connected":
      return {
        color: "#1d4ed8",
        backgroundColor: "#eff6ff",
        borderColor: "#bfdbfe",
      };
    case "not connected":
    case "not-connected":
      return {
        color: "#b45309",
        backgroundColor: "#fffbeb",
        borderColor: "#fde68a",
      };
    case "close":
    case "closed":
      return {
        color: "#b91c1c",
        backgroundColor: "#fee2e2",
        borderColor: "#fecaca",
      };
    case "just a user":
    case "user":
    default:
      return {
        color: "#6d28d9",
        backgroundColor: "#f5f3ff",
        borderColor: "#ddd6fe",
      };
  }
};

const APP_USERS_STATUS_CACHE_KEY = "omca_app_users_status_overrides";
const getAppUserStatusOverride = (userId) => {
  if (!userId) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(APP_USERS_STATUS_CACHE_KEY) || "{}");
    return cache[String(userId)] || null;
  } catch {
    return null;
  }
};

const setAppUserStatusOverride = (userId, status) => {
  if (!userId) return;
  try {
    const cache = JSON.parse(localStorage.getItem(APP_USERS_STATUS_CACHE_KEY) || "{}");
    cache[String(userId)] = status;
    localStorage.setItem(APP_USERS_STATUS_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Could not save status override", e);
  }
};

export default function AppUsers() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const canAccessAppUsers =
    userRole === "admin" ||
    permissionsList.includes("/App_Users") ||
    permissionsList.includes("App_Users") ||
    permissionsList.includes("/app_users") ||
    permissionsList.includes("app_users") ||
    permissionsList.includes("/app-users");

  useEffect(() => {
    if (!canAccessAppUsers) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccessAppUsers, navigate]);

  useEffect(() => {
    try {
      localStorage.removeItem("omca_converted_app_users");
    } catch {}
  }, []);

  // Data state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("users"); // "users" default as requested (Mobile App / MySQL Users)
  const [mode, setMode] = useState("patient_id");
  const [patientStatus, setPatientStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createEnquiryModalOpen, setCreateEnquiryModalOpen] = useState(false);
  const [selectedUserForEnquiry, setSelectedUserForEnquiry] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  // Edit App User Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone_code: "+91",
    phone: "",
    age: "",
    gender: "",
    treatment: "",
    passport_number: "",
    omca_patient_id: "",
    houseNo: "",
    street: "",
    address: "",
    pinCode: "",
    status: "Connected",
    reason: "",
  });
  const [editErrors, setEditErrors] = useState({});

  const [availableStatuses, setAvailableStatuses] = useState(APP_USER_ALLOWED_STATUSES);

  useEffect(() => {
    fetchUserStatuses()
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setAvailableStatuses(res);
        }
      })
      .catch(() => {});
  }, []);

  const getUserStatus = (user) => {
    if (!user) return "Just A User";
    const override = getAppUserStatusOverride(user.id || user.user_id);
    const rawStatus = user.status || user.status_text || user.patient_status || "";
    const candidate = override || rawStatus || "Just A User";
    const matched = availableStatuses.find(
      (s) => s.toLowerCase() === String(candidate).trim().toLowerCase()
    );
    if (matched) return matched;
    const lower = String(candidate).toLowerCase().trim();
    if (lower === "user" || lower === "just a user") return "Just A User";
    if (lower === "active" || lower === "1") return "Connected";
    if (lower === "inactive" || lower === "0") return "Pending";
    if (lower === "blocked" || lower === "2") return "Close";
    return "Just A User";
  };

  const handleStatusChange = async (user, newStatus) => {
    const userId = user.id || user.user_id;
    if (!userId) return;

    const currentStatus = getUserStatus(user);
    if (currentStatus === newStatus) return;

    let reason = "";

    const confirmResult = await Swal.fire({
      title: `Change Status to "${newStatus}"?`,
      text: `Optional: Enter reason or notes for updating status of "${user.name || user.patient_name || "this user"}"`,
      input: "text",
      inputPlaceholder: "Reason / notes (optional, max 500 characters)...",
      showCancelButton: true,
      confirmButtonText: `Set as ${newStatus}`,
      cancelButtonText: "Cancel",
      confirmButtonColor: getAppUserStatusBadgeStyle(newStatus).color,
    });
    if (!confirmResult.isConfirmed) return;
    if (confirmResult.value && confirmResult.value.trim()) {
      reason = confirmResult.value.trim().slice(0, 500);
    }

    setStatusUpdatingId(userId);

    // Optimistic UI update
    setAppUserStatusOverride(userId, newStatus);
    setUsers((prev) =>
      prev.map((u) =>
        String(u.id || u.user_id) === String(userId)
          ? {
              ...u,
              patient_status: newStatus,
              status: newStatus,
              status_text: newStatus,
              reason,
            }
          : u
      )
    );

    try {
      const res = await updateUserStatus({
        userId,
        status: newStatus,
        reason,
      });

      if (res?.data) {
        setUsers((prev) =>
          prev.map((u) =>
            String(u.id || u.user_id) === String(userId)
              ? {
                  ...u,
                  ...res.data,
                  patient_status: newStatus,
                  status: res.data.status || newStatus,
                  status_text: res.data.status_text || newStatus,
                  reason: res.data.reason || reason,
                }
              : u
          )
        );
      }

      Swal.fire({
        icon: "success",
        title: "Status Updated",
        text: res?.message || `Status for "${user.name || user.patient_name || "user"}" changed to "${newStatus}"`,
        timer: 1600,
        showConfirmButton: false,
      });

      // Refresh GET API of app users immediately
      await loadUsers();
    } catch (err) {
      console.error("Failed to update user status on server:", err);
      // Rollback optimistic state
      setAppUserStatusOverride(userId, currentStatus);
      setUsers((prev) =>
        prev.map((u) =>
          String(u.id || u.user_id) === String(userId)
            ? { ...u, patient_status: currentStatus, status: currentStatus, status_text: currentStatus }
            : u
        )
      );
      Swal.fire({
        icon: "error",
        title: "Failed to Update Status",
        text: err.message || "An error occurred while updating status. Please try again.",
      });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleOpenEditUser = async (user) => {
    if (!user) return;
    const userId = user.id || user.user_id;
    setSelectedUserForEdit(user);
    setEditErrors({});

    const initialFormData = {
      id: userId,
      name: user.name || user.patient_name || "",
      email: user.email || "",
      phone_code: user.phone_code || user.phoneCode || user.country_code || "+91",
      phone: user.phone || user.phone_number || user.emergency_contact_no || "",
      age: user.age || user.patient_age || "",
      gender: user.gender || user.patient_gender || "",
      treatment: user.treatment || user.treatment_ad_name || user.treatment_name || "",
      passport_number: user.passport_number || user.passport || "",
      omca_patient_id: user.omca_patient_id || user.patientId || user.patient_id || "",
      houseNo: user.houseNo || user.house_no || "",
      street: user.street || "",
      address: user.address || "",
      pinCode: user.pinCode || user.pincode || "",
      status: getUserStatus(user),
      reason: user.reason || user.status_notes || user.notes || "",
    };
    setEditFormData(initialFormData);
    setEditModalOpen(true);

    if (userId) {
      try {
        const fullUser = await fetchAppUserDetail(userId);
        if (fullUser && typeof fullUser === "object") {
          setEditFormData((prev) => ({
            ...prev,
            name: prev.name || fullUser.name || fullUser.patient_name || "",
            email: prev.email || fullUser.email || "",
            phone_code: prev.phone_code || fullUser.phone_code || fullUser.phoneCode || fullUser.country_code || "+91",
            phone: prev.phone || fullUser.phone || fullUser.phone_number || "",
            age: prev.age || fullUser.age || fullUser.patient_age || "",
            gender: prev.gender || fullUser.gender || fullUser.patient_gender || "",
            treatment: prev.treatment || fullUser.treatment || fullUser.treatment_ad_name || "",
            passport_number: prev.passport_number || fullUser.passport_number || fullUser.passport || "",
            omca_patient_id: prev.omca_patient_id || fullUser.omca_patient_id || fullUser.patientId || "",
            houseNo: prev.houseNo || fullUser.houseNo || fullUser.house_no || "",
            street: prev.street || fullUser.street || "",
            address: prev.address || fullUser.address || "",
            pinCode: prev.pinCode || fullUser.pinCode || fullUser.pincode || "",
            status: fullUser.status || prev.status,
            reason: prev.reason || fullUser.reason || fullUser.status_notes || fullUser.notes || "",
          }));
        }
      } catch (e) {
        // ignore background fetch error
      }
    }
  };

  const handleSaveEditUser = async (e) => {
    if (e) e.preventDefault();
    if (!editFormData.name || !editFormData.name.trim()) {
      setEditErrors({ name: "Name is required" });
      return;
    }
    if (!editFormData.phone || !editFormData.phone.trim()) {
      setEditErrors({ phone: "Phone number is required" });
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        id: editFormData.id || selectedUserForEdit?.id || selectedUserForEdit?.user_id,
        name: editFormData.name.trim(),
        email: editFormData.email.trim(),
        phone_code: editFormData.phone_code.trim(),
        country_code: editFormData.phone_code.trim(),
        phone: editFormData.phone.trim(),
        phone_number: editFormData.phone.trim(),
        age: editFormData.age ? (isNaN(editFormData.age) ? editFormData.age : Number(editFormData.age)) : "",
        gender: editFormData.gender,
        treatment: editFormData.treatment.trim(),
        treatment_ad_name: editFormData.treatment.trim(),
        passport_number: editFormData.passport_number.trim(),
        omca_patient_id: editFormData.omca_patient_id.trim(),
        houseNo: editFormData.houseNo.trim(),
        street: editFormData.street.trim(),
        address: editFormData.address.trim(),
        pinCode: editFormData.pinCode.trim(),
        pincode: editFormData.pinCode.trim(),
        status: editFormData.status,
        crm_status: editFormData.status,
        reason: editFormData.reason.trim(),
        status_notes: editFormData.reason.trim(),
        notes: editFormData.reason.trim(),
      };

      const res = await updateAppUser(payload);

      Swal.fire({
        icon: "success",
        title: "Updated Successfully",
        text: res?.message || "App user details updated successfully.",
        timer: 1800,
        showConfirmButton: false,
      });

      setEditModalOpen(false);
      setSelectedUserForEdit(null);

      // Refresh GET API immediately
      await loadUsers();
    } catch (err) {
      console.error("Failed to update app user:", err);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err?.response?.data?.message || err?.message || "Failed to update app user details",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenCreateEnquiry = (user) => {
    setSelectedUserForEnquiry(user);
    setCreateEnquiryModalOpen(true);
  };

  const handleEnquiryCreatedFromUser = async (createdResult, user) => {
    const userId = user?.id || user?.user_id;
    if (userId) {
      setAppUserStatusOverride(userId, "Connected");
      setUsers((prev) =>
        prev.map((u) =>
          String(u.id || u.user_id) === String(userId)
            ? { ...u, status: "Connected", status_text: "Connected", patient_status: "Connected" }
            : u
        )
      );
    }

    Swal.fire({
      icon: "success",
      title: "Enquiry Created!",
      text: "Enquiry has been created successfully.",
      timer: 2200,
      showConfirmButton: false,
    });

    // Refresh GET API of app users immediately
    await loadUsers();
  };

  // Debounce search input
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(val);
      setCurrentPage(1);
    }, 450);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setCurrentPage(1);
  };

  // Load Data
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPatientsWithoutOmcaId({
        page: currentPage,
        perPage: perPage,
        search: search,
        source: source,
        mode: mode,
        status: patientStatus,
        patient_status: patientStatus,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const activeUsers = (res.data || []).map((u) => {
        const override = getAppUserStatusOverride(u.id || u.user_id);
        return override
          ? { ...u, patient_status: override, status: override, status_text: override }
          : u;
      });

      setUsers(activeUsers);
      setTotalCount(res.totalCount || activeUsers.length);
      setTotalPages(
        res.pagination?.last_page ||
          Math.max(1, Math.ceil((res.totalCount || activeUsers.length) / perPage))
      );
    } catch (err) {
      console.error("Error loading app users:", err);
      setError(err.message || "Failed to load App Users");
      setUsers([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, search, source, mode, patientStatus, sortBy, sortOrder]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Open details modal
  const handleViewDetail = async (user) => {
    setSelectedUser(user);
    setDetailModalOpen(true);

    const userId = user?.id || user?.user_id;
    if (userId) {
      try {
        const fullDetail = await fetchAppUserDetail(userId);
        if (fullDetail && typeof fullDetail === "object") {
          setSelectedUser((prev) => ({
            ...prev,
            ...fullDetail,
          }));
        }
      } catch (e) {
        // ignore background fetch error
      }
    }
  };

  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setSelectedUser(null);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setPatientStatus("");
    setCurrentPage(1);
  };

  // Export to Excel / CSV
  const handleExport = () => {
    if (!users || users.length === 0) {
      Swal.fire("Info", "No user records to export", "info");
      return;
    }

    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone Code",
      "Phone",
      "Age",
      "Gender",
      "Country",
      "Town",
      "Address",
      "Patient Type",
      "Status",
      "Created At",
    ];

    const rows = users.map((u) => [
      `"${u.id || u.user_id || ""}"`,
      `"${(u.name || u.patient_name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${(u.phoneCode || u.phone_code || "").replace(/"/g, '""')}"`,
      `"${(u.phone || u.emergency_contact_no || "").replace(/"/g, '""')}"`,
      `"${u.age || ""}"`,
      `"${u.gender || ""}"`,
      `"${(u.country || "").replace(/"/g, '""')}"`,
      `"${(u.town || "").replace(/"/g, '""')}"`,
      `"${(u.address || "").replace(/"/g, '""')}"`,
      `"${(u.patient_type || "App User").replace(/"/g, '""')}"`,
      `"${(u.patient_status || "Active").replace(/"/g, '""')}"`,
      `"${(u.created_at || "").slice(0, 10)}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `app_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: "success",
      title: "Export Complete",
      text: "App Users list exported successfully!",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const formatDate = (val) => {
    if (!val) return "—";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val).slice(0, 10);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(val).slice(0, 10);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="app-users-container">
          {/* Header */}
          <div className="app-users-header d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h1 className="app-users-title">
                <i className="fa fa-mobile text-primary" style={{ fontSize: "24px" }} />
                App Users
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fs-6 px-3">
                  {totalCount.toLocaleString()} Total
                </span>
              </h1>
              <p className="app-users-subtitle">
                Mobile application & external users who do not have an OMCA ID assigned. You can review and directly create OMCA enquiries from here.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={loadUsers}
                disabled={loading}
              >
                <i className={`fa fa-refresh me-1 ${loading ? "fa-spin" : ""}`} /> Refresh
              </button>
              <button
                type="button"
                className="btn btn-outline-success btn-sm px-3"
                onClick={handleExport}
                disabled={loading || users.length === 0}
              >
                <i className="fa fa-file-excel-o me-1" /> Export CSV
              </button>
            </div>
          </div>

          {/* Quick Status Filter Pills */}
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            {[
              { label: "All Users", value: "" },
              ...availableStatuses.map((st) => ({ label: st, value: st })),
            ].map((pill) => {
              const isActive = patientStatus === pill.value;
              const style = pill.value ? getAppUserStatusBadgeStyle(pill.value) : null;
              return (
                <button
                  key={pill.value || "all"}
                  type="button"
                  onClick={() => {
                    setPatientStatus(pill.value);
                    setCurrentPage(1);
                  }}
                  className="btn btn-sm"
                  style={{
                    borderRadius: "20px",
                    fontWeight: 600,
                    fontSize: "12px",
                    padding: "5px 14px",
                    border: `1px solid ${isActive ? (style ? style.color : "#0284c7") : "#e2e8f0"}`,
                    backgroundColor: isActive
                      ? (style ? style.backgroundColor : "#0284c7")
                      : "#ffffff",
                    color: isActive
                      ? (style ? style.color : "#ffffff")
                      : "#64748b",
                    boxShadow: isActive ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div className="app-users-filter-card">
            <div className="app-users-filter-row">
              {/* Search box */}
              <div className="app-users-search-box">
                <i className="fa fa-search search-icon" />
                <input
                  type="text"
                  placeholder="Search name, phone, email, town, ID..."
                  value={searchInput}
                  onChange={handleSearchChange}
                />
                {searchInput && (
                  <i className="fa fa-times clear-icon" onClick={handleClearSearch} title="Clear search" />
                )}
              </div>

              {/* Status Filter */}
              <div style={{ minWidth: "150px" }}>
                <select
                  className="form-select form-select-sm"
                  value={patientStatus}
                  onChange={(e) => {
                    setPatientStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Per Page */}
              <div style={{ minWidth: "110px" }}>
                <select
                  className="form-select form-select-sm"
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>

              {/* Reset button */}
              {(searchInput || patientStatus || source !== "users" || mode !== "patient_id") && (
                <button
                  type="button"
                  className="btn btn-light btn-sm text-danger border"
                  onClick={handleResetFilters}
                  title="Reset all filters"
                >
                  <i className="fa fa-undo me-1" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="app-users-table-card">
            <div className="app-users-table-header">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  App Users Directory
                </span>
                <span className="badge bg-light text-secondary border">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <div className="small text-muted">
                Showing {users.length > 0 ? (currentPage - 1) * perPage + 1 : 0} -{" "}
                {Math.min(currentPage * perPage, totalCount)} of {totalCount.toLocaleString()} users
              </div>
            </div>

            <div className="table-responsive">
              <table className="app-users-table table mb-0">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>#</th>
                    <th>User / Patient Name</th>
                    <th>Contact Info</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th className="text-end" style={{ width: "120px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5">
                        <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2" />
                        <p className="text-muted small mb-0">Loading App Users...</p>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-danger">
                        <i className="fa fa-exclamation-triangle fa-2x mb-2" />
                        <p className="fw-semibold mb-1">{error}</p>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm mt-2"
                          onClick={loadUsers}
                        >
                          Try Again
                        </button>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5">
                        <div className="text-muted mb-2" style={{ fontSize: "36px" }}>
                          <i className="fa fa-user-o" />
                        </div>
                        <h6 className="fw-bold text-dark">No App Users Found</h6>
                        <p className="text-muted small mb-0">
                          {search || patientStatus
                            ? "No users matched your current filter criteria."
                            : "No user records found in this category."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user, idx) => {
                      const rowNum = (currentPage - 1) * perPage + idx + 1;
                      const userName = user.name || user.patient_name || "Unknown User";
                      const phone = user.phone || user.emergency_contact_no || "";
                      const phoneCode = user.phoneCode || user.phone_code || "";
                      const fullPhone = phoneCode ? `${phoneCode} ${phone}` : phone;

                      return (
                        <tr key={user.id || user._id || idx}>
                          {/* Row Number */}
                          <td className="text-muted text-center">{rowNum}</td>

                          {/* Name */}
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="user-avatar-circle">
                                {userName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong
                                  className="d-block text-dark"
                                  style={{ cursor: "pointer", color: "#0284c7" }}
                                  onClick={() => handleViewDetail(user)}
                                  title="View User Details"
                                >
                                  {userName}
                                </strong>
                              </div>
                            </div>
                          </td>

                          {/* Contact Info */}
                          <td>
                            {fullPhone ? (
                              <div className="text-dark">
                                <i className="fa fa-phone text-muted me-1" style={{ fontSize: "11px" }} />
                                {fullPhone}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                            {user.email && (
                              <small className="text-muted d-block text-truncate" style={{ maxWidth: "200px" }} title={user.email}>
                                <i className="fa fa-envelope text-muted me-1" style={{ fontSize: "11px" }} />
                                {user.email}
                              </small>
                            )}
                          </td>

                          {/* Status */}
                          <td>
                            <div className="d-flex align-items-center gap-1">
                              <select
                                className="form-select form-select-sm"
                                disabled={statusUpdatingId === (user.id || user.user_id)}
                                style={{
                                  width: "135px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  borderColor: getAppUserStatusBadgeStyle(getUserStatus(user)).borderColor,
                                  color: getAppUserStatusBadgeStyle(getUserStatus(user)).color,
                                  backgroundColor: getAppUserStatusBadgeStyle(getUserStatus(user)).backgroundColor,
                                  cursor: "pointer",
                                }}
                                value={getUserStatus(user)}
                                onChange={(e) => handleStatusChange(user, e.target.value)}
                              >
                                {availableStatuses.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              {statusUpdatingId === (user.id || user.user_id) && (
                                <i className="fa fa-spinner fa-spin text-primary" style={{ fontSize: "12px" }} />
                              )}
                            </div>
                          </td>

                          {/* Registered Date */}
                          <td className="text-muted small">
                            {formatDate(user.created_at)}
                          </td>

                          {/* Actions */}
                          <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                            <Tooltip title="Edit App User Details" arrow placement="top">
                              <button
                                type="button"
                                className="app-user-action-btn edit"
                                style={{
                                  border: "1px solid #bbf7d0",
                                  background: "#f0fdf4",
                                  color: "#16a34a",
                                  marginRight: "6px",
                                }}
                                onClick={() => handleOpenEditUser(user)}
                                aria-label="Edit User Details"
                              >
                                <i className="fa fa-pencil" style={{ fontSize: "13px" }} />
                              </button>
                            </Tooltip>
                            <Tooltip title="Edit & Create Enquiry" arrow placement="top">
                              <button
                                type="button"
                                className="app-user-action-btn"
                                style={{
                                  border: "1px solid #bae6fd",
                                  background: "#f0f9ff",
                                  color: "#0284c7",
                                  marginRight: "6px",
                                }}
                                onClick={() => handleOpenCreateEnquiry(user)}
                                aria-label="Edit & Create Enquiry"
                              >
                                <i className="fa fa-user-plus" style={{ fontSize: "13px" }} />
                              </button>
                            </Tooltip>
                            <Tooltip title="View User Profile Details" arrow placement="top">
                              <button
                                type="button"
                                className="app-user-action-btn view"
                                onClick={() => handleViewDetail(user)}
                                aria-label="View Details"
                              >
                                <i className="fa fa-eye" />
                              </button>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="d-flex align-items-center justify-content-between p-3 border-top flex-wrap gap-2">
                <span className="small text-muted">
                  Page {currentPage} of {totalPages} ({totalCount.toLocaleString()} total users)
                </span>
                <div className="d-flex align-items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-2"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage(1)}
                    title="First Page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>

                  <span className="px-2 small fw-bold text-dark">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-2"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage(totalPages)}
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      <Dialog
        open={detailModalOpen}
        onClose={handleCloseDetail}
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: "14px",
            height: "82vh",
            maxHeight: "82vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.2)",
            m: { xs: 1, sm: 2 },
          },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "#e0f2fe",
                color: "#0284c7",
              }}
            >
              <i className="fa fa-user-circle" style={{ fontSize: "16px" }} />
            </span>
            <span className="fw-bold text-dark" style={{ fontSize: "16px" }}>
              App User Profile Details
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={handleCloseDetail}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fee2e2";
              e.currentTarget.style.color = "#dc2626";
              e.currentTarget.style.borderColor = "#fca5a5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.color = "#64748b";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            <i className="fa fa-times" />
          </button>
        </DialogTitle>

        <DialogContent
          dividers
          sx={{
            p: 3,
            overflowY: "auto !important",
            flex: "1 1 auto",
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#f1f5f9",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#94a3b8",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "#64748b",
            },
          }}
        >
          {selectedUser ? (
            <div>
              {/* Profile Top Banner Card */}
              <div
                className="d-flex align-items-center justify-content-between mb-4 p-3 rounded-3 flex-wrap gap-2"
                style={{
                  background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                  border: "1px solid #bae6fd",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="user-avatar-circle"
                    style={{
                      width: "48px",
                      height: "48px",
                      fontSize: "20px",
                      background: "#0284c7",
                      color: "#fff",
                      boxShadow: "0 3px 8px rgba(2, 132, 199, 0.25)",
                    }}
                  >
                    {(selectedUser.name || selectedUser.patient_name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="mb-1 fw-bold text-dark" style={{ fontSize: "16px" }}>
                      {selectedUser.name || selectedUser.patient_name || "Unknown"}
                    </h5>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="badge bg-white text-muted border" style={{ fontSize: "11px" }}>
                        User ID: {selectedUser.id || selectedUser.user_id || "—"}
                      </span>
                      {selectedUser.patientId && (
                        <span className="badge bg-white text-muted border" style={{ fontSize: "11px" }}>
                          Pt ID: {selectedUser.patientId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    className="badge px-3 py-2"
                    style={{
                      fontSize: "12px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      ...getAppUserStatusBadgeStyle(getUserStatus(selectedUser)),
                    }}
                  >
                    {getUserStatus(selectedUser)}
                  </span>
                </div>
              </div>

              {/* 2-Column Grid of Details */}
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      FULL NAME
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.name || selectedUser.patient_name || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      PHONE NUMBER
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.phoneCode || selectedUser.phone_code ? `${selectedUser.phoneCode || selectedUser.phone_code} ` : ""}
                      {selectedUser.phone || selectedUser.emergency_contact_no || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      EMAIL ADDRESS
                    </small>
                    <span className="fw-semibold text-dark text-break" style={{ fontSize: "13.5px" }}>
                      {selectedUser.email || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      ALTERNATE PHONE
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.patient_emergency_contact_no || selectedUser.alternate_phone || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      AGE / GENDER
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.age ? `${selectedUser.age} years` : "—"}
                      {selectedUser.gender ? ` • ${selectedUser.gender}` : ""}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      COUNTRY
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.country ? (
                        <span className="badge bg-light text-dark border">
                          {selectedUser.country}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      TOWN / CITY
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.town || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      PASSPORT NO
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.passport_num || selectedUser.passport_number || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      TREATMENT / DISEASE
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.treatment || selectedUser.treatment_name || selectedUser.disease_name || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      TREATING IN COUNTRY
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {Array.isArray(selectedUser.treatingIn)
                        ? selectedUser.treatingIn.join(", ")
                        : selectedUser.treatingIn || selectedUser.treating_in_country || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      OMCA ID STATUS
                    </small>
                    <div>
                      <span className="badge bg-warning text-dark">
                        No OMCA ID Assigned
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      REGISTERED AT
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {formatDate(selectedUser.created_at)}
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      REASON
                    </small>
                    <span className="fw-semibold text-dark fs-6">
                      {selectedUser.reason || selectedUser.status_notes || selectedUser.remark || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-md-12">
                  <div className="p-3 border rounded-3 bg-light">
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: "11px" }}>
                      ADDRESS
                    </small>
                    <span className="fw-semibold text-dark" style={{ fontSize: "13.5px" }}>
                      {selectedUser.address || "—"}
                    </span>
                  </div>
                </div>

                {(selectedUser.reason || selectedUser.status_notes || selectedUser.remark) && (
                  <div className="col-md-12">
                    <div className="p-3 border rounded-3" style={{ backgroundColor: "#fefce8", borderColor: "#fde047" }}>
                      <small className="d-block fw-semibold mb-1" style={{ fontSize: "11px", color: "#854d0e" }}>
                        <i className="fa-solid fa-circle-info me-1"></i> REASON / STATUS NOTE
                      </small>
                      <span className="fw-semibold text-dark" style={{ fontSize: "14px" }}>
                        {selectedUser.reason || selectedUser.status_notes || selectedUser.remark}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>

        <DialogActions
          className="px-4 py-3 border-top"
          style={{ backgroundColor: "#f8fafc", flexShrink: 0 }}
        >
          <Button
            variant="outlined"
            onClick={handleCloseDetail}
            style={{
              borderColor: "#cbd5e1",
              color: "#475569",
              padding: "6px 22px",
              borderRadius: "6px",
              fontWeight: 500,
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const u = selectedUser;
              handleCloseDetail();
              handleOpenEditUser(u);
            }}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              color: "#ffffff",
              padding: "6px 20px",
              borderRadius: "6px",
              fontWeight: 600,
              boxShadow: "0 4px 10px rgba(22, 163, 74, 0.3)",
              marginRight: "8px",
            }}
          >
            <i className="fa fa-pencil me-2" />
            Edit User Details
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const user = selectedUser;
              handleCloseDetail();
              handleOpenCreateEnquiry(user);
            }}
            style={{
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              padding: "6px 22px",
              borderRadius: "6px",
              fontWeight: 600,
              boxShadow: "0 4px 10px rgba(2, 132, 199, 0.3)",
            }}
          >
            <i className="fa fa-user-plus me-2" />
            Edit & Create Enquiry
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit App User Modal */}
      <Dialog
        open={editModalOpen}
        onClose={editSubmitting ? undefined : () => setEditModalOpen(false)}
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: "14px",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
            m: { xs: 1, sm: 2 },
          },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "#dcfce7",
                color: "#16a34a",
              }}
            >
              <i className="fa fa-pencil" style={{ fontSize: "15px" }} />
            </span>
            <div>
              <span className="fw-bold text-dark d-block" style={{ fontSize: "16px" }}>
                Edit App User Details
              </span>
              <small className="text-muted" style={{ fontSize: "12px" }}>
                Update lead and patient details for this registered app user.
              </small>
            </div>
          </div>
          <button
            type="button"
            disabled={editSubmitting}
            onClick={() => setEditModalOpen(false)}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <i className="fa fa-times" />
          </button>
        </DialogTitle>

        <form onSubmit={handleSaveEditUser} style={{ display: "contents" }}>
          <DialogContent
            dividers
            sx={{
              p: 3,
              overflowY: "auto !important",
            }}
          >
            <div className="row g-3">
              {/* Full Name */}
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Full Name <span className="text-danger">*</span>
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.name}
                  onChange={(e) => {
                    setEditFormData((prev) => ({ ...prev, name: e.target.value }));
                    if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  error={Boolean(editErrors.name)}
                  helperText={editErrors.name}
                  placeholder="e.g. Rajesh Kumar"
                />
              </div>

              {/* Phone Code & Phone Number */}
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Phone Number <span className="text-danger">*</span>
                </label>
                <div className="d-flex gap-2">
                  <div style={{ width: "110px", flexShrink: 0 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={editFormData.phone_code}
                      onChange={(e) =>
                        setEditFormData((prev) => ({ ...prev, phone_code: e.target.value }))
                      }
                      placeholder="+91"
                    />
                  </div>
                  <TextField
                    size="small"
                    fullWidth
                    value={editFormData.phone}
                    onChange={(e) => {
                      setEditFormData((prev) => ({ ...prev, phone: e.target.value }));
                      if (editErrors.phone) setEditErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    error={Boolean(editErrors.phone)}
                    helperText={editErrors.phone}
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Email Address
                </label>
                <TextField
                  size="small"
                  fullWidth
                  type="email"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="e.g. rajesh@example.com"
                />
              </div>

              {/* Age */}
              <div className="col-md-3 col-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Age
                </label>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  inputProps={{ min: 0, max: 125 }}
                  value={editFormData.age}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, age: e.target.value }))
                  }
                  placeholder="e.g. 45"
                />
              </div>

              {/* Gender */}
              <div className="col-md-3 col-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Gender
                </label>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={editFormData.gender}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, gender: e.target.value }))
                  }
                >
                  <MenuItem value="">Select Gender</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              </div>

              {/* Treatment / Service */}
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Treatment / Enquiry
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.treatment}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, treatment: e.target.value }))
                  }
                  placeholder="e.g. Cardiology Consultation"
                />
              </div>

              {/* Passport Number */}
              <div className="col-md-3 col-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Passport Number
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.passport_number}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, passport_number: e.target.value }))
                  }
                  placeholder="e.g. Z1234567"
                />
              </div>

              {/* OMCA Patient ID */}
              <div className="col-md-3 col-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  OMCA Patient ID
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.omca_patient_id}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, omca_patient_id: e.target.value }))
                  }
                  placeholder="e.g. OMCA-IND-1002"
                />
              </div>

              {/* House / Flat No */}
              <div className="col-md-4">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  House / Flat No
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.houseNo}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, houseNo: e.target.value }))
                  }
                  placeholder="e.g. Flat 302"
                />
              </div>

              {/* Street */}
              <div className="col-md-4">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Street Name
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.street}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, street: e.target.value }))
                  }
                  placeholder="e.g. MG Road"
                />
              </div>

              {/* Pin Code */}
              <div className="col-md-4">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Postal / Pin Code
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.pinCode}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, pinCode: e.target.value }))
                  }
                  placeholder="e.g. 560038"
                />
              </div>

              {/* Address */}
              <div className="col-md-12">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Full Address
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.address}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="e.g. Indiranagar, Bangalore"
                />
              </div>

              {/* CRM Status */}
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  CRM Status
                </label>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={editFormData.status}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  {availableStatuses.map((st) => (
                    <MenuItem key={st} value={st}>
                      {st}
                    </MenuItem>
                  ))}
                </TextField>
              </div>

              {/* Reason / Notes */}
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Remarks / Notes
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={editFormData.reason}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g. Appointment scheduled for Monday morning."
                />
              </div>
            </div>
          </DialogContent>

          <DialogActions
            sx={{
              p: "14px 24px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: 1.5,
            }}
          >
            <Button
              variant="outlined"
              disabled={editSubmitting}
              onClick={() => setEditModalOpen(false)}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "#64748b",
                borderColor: "#cbd5e1",
                "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f1f5f9" },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={editSubmitting}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                boxShadow: "0 4px 10px rgba(22, 163, 74, 0.3)",
                "&:hover": { background: "linear-gradient(135deg, #15803d 0%, #166534 100%)" },
              }}
            >
              {editSubmitting ? (
                <>
                  <i className="fa fa-spinner fa-spin me-2" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa fa-check me-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <CreateEnquiryModal
        open={createEnquiryModalOpen}
        onClose={() => {
          setCreateEnquiryModalOpen(false);
          setSelectedUserForEnquiry(null);
        }}
        leadData={selectedUserForEnquiry}
        sourceType="app_user"
        onSuccess={handleEnquiryCreatedFromUser}
      />
    </div>
  );
}
