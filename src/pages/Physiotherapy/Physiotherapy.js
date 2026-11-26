import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Swal from "sweetalert2";
import {
  fetchPhysiotherapyStats,
  fetchPhysiotherapyPatients,
  updatePhysiotherapyStatus,
  formatDiseaseName,
  PHYSIO_CATEGORIES,
  PHYSIO_STATUSES,
  PHYSIO_PRIORITIES,
} from "../../services/physiotherapyApi";
import ReferralModal from "./components/ReferralModal";
import SessionModal from "./components/SessionModal";
import CaseDetailModal from "./components/CaseDetailModal";
import { markRecordRead } from "../../services/unreadApi";
import { clearUnreadById, UnreadDot } from "../../components/NewTag";
import { isPhysiotherapistUser } from "../../utils/authStorage";
import "./Physiotherapy.css";

export default function Physiotherapy() {
  const navigate = useNavigate();
  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const isPhysioUser = isPhysiotherapistUser();
  const canAccessPhysio =
    userRole === "admin" ||
    permissionsList.includes("/Physiotherapy") ||
    permissionsList.includes("Physiotherapy") ||
    isPhysioUser;

  useEffect(() => {
    if (!canAccessPhysio) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccessPhysio, navigate]);

  // Stats state
  const [stats, setStats] = useState({
    totalCases: 0,
    totalPatientsNeedingPhysio: 0,
    statusCounts: {
      referred: 0,
      assessmentPending: 0,
      inProgress: 0,
      completed: 0,
      onHold: 0,
      cancelled: 0,
    },
    sessionsToday: 0,
  });

  // Worklist state
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const rowsPerPage = 10;

  // Modals state
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalTab, setDetailModalTab] = useState("sessions");
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [editingCase, setEditingCase] = useState(null);
  const [editCaseModalOpen, setEditCaseModalOpen] = useState(false);

  const markPhysioCase = (item) => {
    const recordId = item?.patientId || item?._id;
    if (recordId) {
      markRecordRead("physiotherapy", recordId);
      setCases((prev) => clearUnreadById(prev, recordId, ["patientId", "_id"]));
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadCases();
  }, [currentPage, selectedStatus, selectedPriority, selectedCategory, searchTerm]);

  const loadStats = async () => {
    try {
      const data = await fetchPhysiotherapyStats();
      if (data) setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: rowsPerPage,
      };
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      if (selectedPriority !== "ALL") params.priority = selectedPriority;
      if (selectedCategory !== "ALL") params.category = selectedCategory;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const result = await fetchPhysiotherapyPatients(params);
      const isPhysioUser = isPhysiotherapistUser();
      const currentUserId = (localStorage.getItem("_id") || "").toLowerCase();
      const currentUserName = (localStorage.getItem("name") || "").trim().toLowerCase();
      const currentUserEmail = (localStorage.getItem("email") || "").trim().toLowerCase();

      let list = result?.data || [];
      if (isPhysioUser) {
        list = list.filter((c) => {
          const t = c.assignedPhysiotherapist;
          if (!t) return false;
          const tId = String(t.userId || t._id || t.staffId || "").toLowerCase();
          const tName = String(t.name || "").trim().toLowerCase();
          const tEmail = String(t.email || "").trim().toLowerCase();
          return (
            (currentUserId && tId && currentUserId === tId) ||
            (currentUserName && tName && currentUserName === tName) ||
            (currentUserEmail && tEmail && currentUserEmail === tEmail)
          );
        });
      }
      setCases(list);

      if (result?.pagination && !isPhysioUser) {
        setTotalPages(result.pagination.totalPages || 1);
        setTotalRecords(result.pagination.totalRecords || list.length);
      } else {
        setTotalPages(1);
        setTotalRecords(list.length);
      }
    } catch (err) {
      console.error("Error loading physiotherapy patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadCases();
  };

  const handleQuickStatusChange = async (caseItem, newStatus) => {
    markPhysioCase(caseItem);
    try {
      await updatePhysiotherapyStatus(caseItem._id, newStatus);
      Swal.fire({
        title: "Status Updated",
        text: `Case status changed to ${newStatus}`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      loadCases();
      loadStats();
    } catch (err) {
      Swal.fire("Error", typeof err === "string" ? err : "Failed to update status", "error");
    }
  };

  const handleExportCSV = () => {
    if (!cases || cases.length === 0) {
      return Swal.fire("Export", "No physiotherapy records to export", "info");
    }

    const headers = [
      "Patient ID",
      "Patient Name",
      "Age",
      "Gender",
      "Country",
      "Diagnosis",
      "Category",
      "Priority",
      "Status",
      "Prescribed Sessions",
      "Completed Sessions",
      "Therapist",
    ];

    const rows = cases.map((c) => [
      `"${c.patientId || ""}"`,
      `"${c.patientName || ""}"`,
      `"${c.age || ""}"`,
      `"${c.gender || ""}"`,
      `"${c.country || ""}"`,
      `"${(c.clinicalDiagnosis || "").replace(/"/g, '""')}"`,
      `"${c.category || ""}"`,
      `"${c.priority || ""}"`,
      `"${c.status || ""}"`,
      c.prescribedSessions || 0,
      c.completedSessions || 0,
      `"${c.assignedPhysiotherapist?.name || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `physiotherapy_worklist_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Badges styling
  const getPriorityBadgeClass = (priority) => {
    switch (String(priority).toLowerCase()) {
      case "urgent":
        return "badge-priority-urgent";
      case "high":
        return "badge-priority-high";
      case "normal":
        return "badge-priority-normal";
      case "low":
        return "badge-priority-low";
      default:
        return "badge-priority-normal";
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (String(status).toLowerCase()) {
      case "referred":
        return "badge-physio-referred";
      case "assessment pending":
        return "badge-physio-assessment";
      case "in progress":
        return "badge-physio-in-progress";
      case "completed":
        return "badge-physio-completed";
      case "on hold":
        return "badge-physio-on-hold";
      case "cancelled":
        return "badge-physio-cancelled";
      default:
        return "badge-secondary";
    }
  };

  const getStatusCount = (status) => {
    if (!stats?.statusCounts) return null;
    const sc = stats.statusCounts;
    switch (status) {
      case "ALL":
        return stats.totalCases ?? totalRecords ?? null;
      case "Referred":
        return sc.referred ?? sc.Referred ?? 0;
      case "Assessment Pending":
        return sc.assessmentPending ?? sc["Assessment Pending"] ?? 0;
      case "In Progress":
        return sc.inProgress ?? sc["In Progress"] ?? 0;
      case "Completed":
        return sc.completed ?? sc.Completed ?? 0;
      case "On Hold":
        return sc.onHold ?? sc["On Hold"] ?? 0;
      case "Cancelled":
        return sc.cancelled ?? sc.Cancelled ?? 0;
      default:
        return null;
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content physio-page-wrapper">
        {/* Top Header */}
        <div className="physio-header">
          <div>
            <h4>
              <i className="fa fa-heartbeat text-danger" />
              Physiotherapy Management
            </h4>
            <p>
              Track patient rehabilitation referrals, sessions, clinical pain scores, and therapist assignments
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary d-flex align-items-center gap-1"
              onClick={handleExportCSV}
            >
              <i className="fa fa-download" /> Export CSV
            </button>
            {isPhysioUser && (
              <button
                type="button"
                className="btn btn-primary d-flex align-items-center gap-2"
                onClick={() => setReferralModalOpen(true)}
              >
                <i className="fa fa-plus" /> Create Case
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="physio-kpi-grid">
          <div
            className={`physio-kpi-card ${selectedStatus === "ALL" ? "active-kpi" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => {
              setSelectedStatus("ALL");
              setCurrentPage(1);
            }}
            title="Total cases in physiotherapy module (Click to view all)"
          >
            <div className="physio-kpi-icon blue">
              <i className="fa fa-users" />
            </div>
            <div className="physio-kpi-info">
              <h3>{stats.totalCases ?? 0}</h3>
              <span>Total Rehab Cases</span>
            </div>
          </div>

          <div
            className="physio-kpi-card"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/Admin/patients")}
            title="Patients in Patient list flagged as Need Physio (Click to view)"
          >
            <div className="physio-kpi-icon teal">
              <i className="fa fa-person-walking" />
            </div>
            <div className="physio-kpi-info">
              <h3>{stats.totalPatientsNeedingPhysio ?? 0}</h3>
              <span>Needs Physio (Flagged)</span>
            </div>
          </div>

          <div
            className={`physio-kpi-card ${selectedStatus === "In Progress" ? "active-kpi" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => {
              setSelectedStatus("In Progress");
              setCurrentPage(1);
            }}
            title="Click to view In Progress cases"
          >
            <div className="physio-kpi-icon indigo">
              <i className="fa fa-play-circle" />
            </div>
            <div className="physio-kpi-info">
              <h3>{stats.statusCounts?.inProgress ?? stats.statusCounts?.["In Progress"] ?? 0}</h3>
              <span>In Progress</span>
            </div>
          </div>

          <div
            className={`physio-kpi-card ${selectedStatus === "Referred" || selectedStatus === "Assessment Pending" ? "active-kpi" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => {
              setSelectedStatus("Referred");
              setCurrentPage(1);
            }}
            title="Referred / Assessment Pending cases"
          >
            <div className="physio-kpi-icon amber">
              <i className="fa fa-hourglass-half" />
            </div>
            <div className="physio-kpi-info">
              <h3>
                {(stats.statusCounts?.referred ?? stats.statusCounts?.Referred ?? 0) +
                  (stats.statusCounts?.assessmentPending ?? stats.statusCounts?.["Assessment Pending"] ?? 0)}
              </h3>
              <span>Pending Initial Evaluation</span>
            </div>
          </div>

          <div
            className={`physio-kpi-card ${selectedStatus === "Completed" ? "active-kpi" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => {
              setSelectedStatus("Completed");
              setCurrentPage(1);
            }}
            title="Click to view Completed cases"
          >
            <div className="physio-kpi-icon green">
              <i className="fa fa-check-circle" />
            </div>
            <div className="physio-kpi-info">
              <h3>{stats.statusCounts?.completed ?? stats.statusCounts?.Completed ?? 0}</h3>
              <span>Completed Rehab</span>
            </div>
          </div>

          <div className="physio-kpi-card">
            <div className="physio-kpi-icon purple">
              <i className="fa fa-calendar-check-o" />
            </div>
            <div className="physio-kpi-info">
              <h3>{stats.sessionsToday ?? 0}</h3>
              <span>Sessions Today</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar Card */}
        <div className="physio-filter-card">
          {/* Status Tabs */}
          <div className="physio-status-tabs">
            {["ALL", ...PHYSIO_STATUSES].map((st) => {
              const count = getStatusCount(st);
              return (
                <button
                  key={st}
                  type="button"
                  className={`physio-tab-btn ${selectedStatus === st ? "active" : ""}`}
                  onClick={() => {
                    setSelectedStatus(st);
                    setCurrentPage(1);
                  }}
                >
                  {st === "ALL" ? "All Cases" : st}
                  {count !== null && (
                    <span className="physio-tab-badge">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="physio-filter-row">
            <form onSubmit={handleSearchSubmit} className="physio-search-box">
              <i className="fa fa-search" />
              <input
                type="text"
                placeholder="Search by patient name, ID, phone, diagnosis, or therapist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>

            <select
              className="physio-select"
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Priorities</option>
              {PHYSIO_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              className="physio-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Categories</option>
              {PHYSIO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-primary btn-sm px-3"
              onClick={() => {
                setCurrentPage(1);
                loadCases();
              }}
            >
              Filter
            </button>

            {(searchTerm || selectedPriority !== "ALL" || selectedCategory !== "ALL" || selectedStatus !== "ALL") && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedPriority("ALL");
                  setSelectedCategory("ALL");
                  setSelectedStatus("ALL");
                  setCurrentPage(1);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Worklist Table */}
        <div className="physio-table-card">
          <div className="table-responsive">
            <table className="physio-table">
              <thead>
                <tr>
                  <th>Patient Details</th>
                  <th>Diagnosis & Category</th>
                  <th>Priority</th>
                  <th>Sessions Progress</th>
                  <th>Assigned Physiotherapist</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2" />
                      <p className="text-muted mb-0">Loading physiotherapy worklist...</p>
                    </td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <i className="fa fa-folder-open-o fa-2x mb-2" />
                      <p className="mb-0">No physiotherapy records found matching the criteria.</p>
                    </td>
                  </tr>
                ) : (
                  cases.map((item) => {
                    const completed = item.completedSessions || 0;
                    const prescribed = item.prescribedSessions || 1;
                    const percent = Math.min(100, Math.round((completed / prescribed) * 100));

                    return (
                      <tr
                        key={item._id}
                        className={item.isUnread ? "unread-row" : undefined}
                      >
                        {/* Patient Details */}
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "50%",
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "13px",
                              }}
                            >
                              {(item.patientName || "P").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span
                                className="fw-bold text-dark d-block"
                                style={{ cursor: "pointer" }}
                                onClick={() => {
                                  markPhysioCase(item);
                                  setSelectedCaseId(item._id);
                                  setDetailModalOpen(true);
                                }}
                              >
                                {item.patientName || "Unnamed Patient"}
                              </span>
                              <small className="text-muted d-block">
                                ID: {item.patientId || "N/A"}
                                <UnreadDot unread={item.isUnread === true} />
                                {item.age ? ` | ${item.age} yrs` : ""}
                                {item.gender ? ` (${item.gender})` : ""}
                                {item.country ? ` • ${item.country}` : ""}
                              </small>
                            </div>
                          </div>
                        </td>

                        {/* Diagnosis & Category */}
                        <td style={{ maxWidth: "240px" }}>
                          <strong className="d-block text-dark text-truncate" title={formatDiseaseName(item.clinicalDiagnosis)}>
                            {formatDiseaseName(item.clinicalDiagnosis) || "Physiotherapy Rehab"}
                          </strong>
                          <div className="d-flex align-items-center gap-1 mt-1">
                            <span className="badge bg-light text-primary border" style={{ fontSize: "10.5px" }}>
                              {item.category || "General"}
                            </span>
                            {item.affectedBodyPart && (
                              <small className="text-muted text-truncate" style={{ fontSize: "11px" }}>
                                • {item.affectedBodyPart}
                              </small>
                            )}
                          </div>
                        </td>

                        {/* Priority */}
                        <td>
                          <span className={`badge ${getPriorityBadgeClass(item.priority)}`}>
                            {item.priority || "Normal"}
                          </span>
                        </td>

                        {/* Sessions Progress */}
                        <td>
                          <div className="physio-progress-wrapper">
                            <div className="d-flex justify-content-between small text-muted">
                              <span>
                                <strong>{completed}</strong> / {prescribed}
                              </span>
                              <span>{percent}%</span>
                            </div>
                            <div className="physio-progress-bar">
                              <div
                                className="physio-progress-fill"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            {item.sessionFrequency && (
                              <small className="text-muted d-block mt-1" style={{ fontSize: "10px" }}>
                                {item.sessionFrequency}
                              </small>
                            )}
                          </div>
                        </td>

                        {/* Assigned Therapist */}
                        <td>
                          {item.assignedPhysiotherapist?.name ? (
                            <div className="d-flex align-items-center gap-1 text-dark">
                              <i className="fa fa-user-md text-primary" />
                              <span>{item.assignedPhysiotherapist.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted fst-italic">Unassigned</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <div className="dropdown">
                            <span
                              className={`badge ${getStatusBadgeClass(item.status)}`}
                              style={{ cursor: "pointer" }}
                              title="Click to change status"
                            >
                              {item.status}
                            </span>
                          </div>
                          {item.paymentDetails?.status && (
                            <div className="mt-1">
                              <span
                                className={`badge ${
                                  item.paymentDetails.status === "Completed"
                                    ? "bg-success bg-opacity-10 text-success border border-success"
                                    : item.paymentDetails.status === "Partial"
                                    ? "bg-warning bg-opacity-10 text-warning border border-warning"
                                    : "bg-danger bg-opacity-10 text-danger border border-danger"
                                }`}
                                style={{ fontSize: "10px", padding: "2px 6px" }}
                                title={`Decided: Rs. ${item.paymentDetails.decidedAmount || 0} | Paid: Rs. ${item.paymentDetails.totalGiven || 0}`}
                              >
                                <i className="fa fa-credit-card me-1" />
                                {item.paymentDetails.status}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="physio-actions justify-content-center">
                            <button
                              type="button"
                              className="physio-btn-action log"
                              title="Log New Session"
                              onClick={() => {
                                markPhysioCase(item);
                                setSelectedCase(item);
                                setSessionModalOpen(true);
                              }}
                            >
                              <i className="fa fa-calendar-plus-o" />
                            </button>
                            <button
                              type="button"
                              className="physio-btn-action"
                              title="Edit Case Details"
                              onClick={() => {
                                markPhysioCase(item);
                                setEditingCase(item);
                                setEditCaseModalOpen(true);
                              }}
                            >
                              <i className="fa fa-pencil" />
                            </button>
                            <button
                              type="button"
                              className="physio-btn-action"
                              title="Case Fee & Payments"
                              style={{ color: "#059669" }}
                              onClick={() => {
                                markPhysioCase(item);
                                setSelectedCaseId(item._id);
                                setDetailModalTab("payments");
                                setDetailModalOpen(true);
                              }}
                            >
                              <i className="fa fa-credit-card" />
                            </button>
                            <button
                              type="button"
                              className="physio-btn-action"
                              title="View Case Details & Notes"
                              onClick={() => {
                                markPhysioCase(item);
                                setSelectedCaseId(item._id);
                                setDetailModalTab("sessions");
                                setDetailModalOpen(true);
                              }}
                            >
                              <i className="fa fa-eye" />
                            </button>
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
            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <span className="small text-muted">
                Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                {Math.min(currentPage * rowsPerPage, totalRecords)} of {totalRecords} records
              </span>
              <Stack spacing={2}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => setCurrentPage(page)}
                  color="primary"
                  shape="rounded"
                  size="small"
                />
              </Stack>
            </div>
          )}
        </div>

        {/* Referral Modal (Create) */}
        <ReferralModal
          open={referralModalOpen}
          onClose={() => setReferralModalOpen(false)}
          onSuccess={() => {
            loadCases();
            loadStats();
          }}
        />

        {/* Edit Case Modal */}
        <ReferralModal
          open={editCaseModalOpen}
          onClose={() => {
            setEditCaseModalOpen(false);
            setEditingCase(null);
          }}
          editCase={editingCase}
          onSuccess={() => {
            loadCases();
            loadStats();
          }}
        />

        {/* Log Session Modal */}
        <SessionModal
          open={sessionModalOpen}
          onClose={() => {
            setSessionModalOpen(false);
            setSelectedCase(null);
          }}
          physioCase={selectedCase}
          onSuccess={() => {
            loadCases();
            loadStats();
          }}
        />

        {/* Case Details Modal */}
        <CaseDetailModal
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedCaseId(null);
          }}
          caseId={selectedCaseId}
          initialTab={detailModalTab}
          onStatusUpdated={() => {
            loadCases();
            loadStats();
          }}
          onOpenLogSession={(caseItem) => {
            setDetailModalOpen(false);
            setSelectedCase(caseItem);
            setSessionModalOpen(true);
          }}
        />
      </div>
    </div>
  );
}
