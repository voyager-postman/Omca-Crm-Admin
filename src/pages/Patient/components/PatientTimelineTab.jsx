import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  Stack,
} from "@mui/material";
import { toast } from "react-toastify";
import Loader from "../../../components/Loader";
import {
  fetchPatientTimeline,
  exportTimelineToExcel,
  formatRelativeTime,
  getTimelineIconClass,
  getPlanMilestoneIcon,
  TIMELINE_CATEGORIES,
  DEFAULT_MILESTONES,
} from "../../../services/patientTimelineApi";
import { getAssignedCoordinator } from "../../../services/coordinatorApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";
import "./PatientTimeline.css";

export default function PatientTimelineTab({
  patient,
  patientId,
  initialTimeline,
  initialJourneySummary,
  onNavigateTab,
}) {
  const isReferral = isReferralUser() || isInsuranceUser();

  // Primary Patient ID extraction
  const effectivePatientId = useMemo(() => {
    return (
      patientId ||
      patient?.patientId ||
      patient?.patientNumber ||
      patient?._id ||
      patient?.id ||
      ""
    );
  }, [patientId, patient]);

  // States
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState(() => {
    if (Array.isArray(initialTimeline) && initialTimeline.length > 0) {
      return initialTimeline;
    }
    return [];
  });

  const [journeySummary, setJourneySummary] = useState(() => {
    if (initialJourneySummary && typeof initialJourneySummary === "object") {
      return initialJourneySummary;
    }
    return {
      currentStage: patient?.patient_status || "Registered",
      daysInJourney: 0,
      registeredAt: patient?.createdAt || null,
      assignedCoordinator: getAssignedCoordinator(patient),
      milestones: DEFAULT_MILESTONES,
      categoryCounts: {},
    };
  });

  const [pagination, setPagination] = useState({
    totalRecords: initialTimeline?.length || 0,
    currentPage: 1,
    totalPages: 1,
    perPage: 10,
  });

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTreatmentPlanId, setSelectedTreatmentPlanId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" | "table"
  const [page, setPage] = useState(1);
  const [isReadOnly, setIsReadOnly] = useState(isReferral);
  const [roadmapCollapsed, setRoadmapCollapsed] = useState(false);
  const [showMilestonesInTable, setShowMilestonesInTable] = useState(false);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset scrollTop when viewMode changes
  useEffect(() => {
    const dialogContent =
      document.querySelector(".activity-log-dialog .MuiDialogContent-root") ||
      document.querySelector(".MuiDialogContent-root");

    if (dialogContent) {
      dialogContent.scrollTop = 0;
      dialogContent.style.overflowY = "auto";
    }

    return () => {
      if (dialogContent) {
        dialogContent.style.overflowY = "auto";
      }
    };
  }, [viewMode]);

  // Load timeline data from API
  const loadTimeline = useCallback(
    async (isBackground = false) => {
      if (!effectivePatientId) return;

      if (!isBackground) {
        setLoading(true);
      }

      try {
        const filters = {
          page,
          limit: 10,
        };

        if (selectedCategory && selectedCategory !== "all") {
          filters.category = selectedCategory;
        }
        if (selectedTreatmentPlanId && selectedTreatmentPlanId !== "all") {
          filters.treatmentPlanId = selectedTreatmentPlanId;
        }
        if (selectedStatus && selectedStatus !== "all") {
          filters.status = selectedStatus;
        }
        if (searchQuery) {
          filters.search = searchQuery;
        }
        if (fromDate) {
          filters.fromDate = fromDate;
        }
        if (toDate) {
          filters.toDate = toDate;
        }

        const res = await fetchPatientTimeline(effectivePatientId, filters);

        if (res && res.data) {
          setEvents(res.data);
          if (res.journeySummary) {
            setJourneySummary((prev) => ({
              ...prev,
              ...res.journeySummary,
              assignedCoordinator:
                res.journeySummary.assignedCoordinator ||
                getAssignedCoordinator(patient) ||
                prev.assignedCoordinator,
            }));
          }
          if (res.pagination) {
            setPagination(res.pagination);
          }
          if (res.isReadOnly !== undefined) {
            setIsReadOnly(Boolean(res.isReadOnly || isReferral));
          }
        }
      } catch (err) {
        // Only show error toast if not an unmounted or background fetch
        if (err?.response?.status === 403) {
          toast.error("You do not have permission to view timeline for this patient.");
        } else if (!isBackground) {
          console.error("Failed to fetch timeline:", err);
          toast.error(
            err?.response?.data?.message ||
            err?.message ||
            "Could not load patient activity timeline."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [
      effectivePatientId,
      page,
      selectedCategory,
      selectedTreatmentPlanId,
      selectedStatus,
      searchQuery,
      fromDate,
      toDate,
      patient,
      isReferral,
    ]
  );

  // Trigger fetch when parameters change
  useEffect(() => {
    loadTimeline(false);
  }, [loadTimeline]);

  // Quick reset filters
  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedTreatmentPlanId("all");
    setSelectedStatus("all");
    setSearchInput("");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  // Milestone icon selector
  const getMilestoneIcon = (key) => {
    switch (key) {
      case "enquiry":
        return "fa-circle-question";
      case "registration":
        return "fa-user-check";
      case "coordinator":
        return "fa-user-tie";
      case "treatment_plan":
        return "fa-notes-medical";
      case "vil_visa":
        return "fa-passport";
      case "travel_pickup":
        return "fa-plane-departure";
      case "treatment":
        return "fa-kit-medical";
      case "completed":
        return "fa-circle-check";
      default:
        return "fa-circle-dot";
    }
  };

  // Compute milestones progress line percentage based on the furthest completed milestone
  const milestonesList = useMemo(() => {
    if (Array.isArray(journeySummary?.milestones) && journeySummary.milestones.length > 0) {
      return journeySummary.milestones;
    }
    return DEFAULT_MILESTONES;
  }, [journeySummary]);

  const progressPercent = useMemo(() => {
    if (!milestonesList || milestonesList.length <= 1) return 0;
    let furthestIdx = 0;
    milestonesList.forEach((m, idx) => {
      if (m.completed) {
        furthestIdx = idx;
      }
    });
    return Math.min(100, Math.round((furthestIdx / (milestonesList.length - 1)) * 100));
  }, [milestonesList]);



  // Per-Treatment-Plan extraction
  const treatmentPlansList = useMemo(() => {
    if (Array.isArray(journeySummary?.treatmentPlans) && journeySummary.treatmentPlans.length > 0) {
      return journeySummary.treatmentPlans;
    }
    return [];
  }, [journeySummary]);

  const activeTreatmentPlan = useMemo(() => {
    if (selectedTreatmentPlanId && selectedTreatmentPlanId !== "all") {
      return (
        treatmentPlansList.find(
          (p) => String(p.treatmentPlanId) === String(selectedTreatmentPlanId)
        ) || null
      );
    }
    // If "all" is selected but there is only 1 treatment plan, display its details by default
    if (treatmentPlansList.length === 1) {
      return treatmentPlansList[0];
    }
    return null;
  }, [treatmentPlansList, selectedTreatmentPlanId]);

  // Target record navigation
  const handleTargetRecordClick = (targetRecord) => {
    if (!targetRecord) return;
    const type = String(targetRecord.type || "").toLowerCase();

    if (onNavigateTab) {
      if (type.includes("treatment_plan") || type.includes("plan")) {
        onNavigateTab("treatment-plans");
        return;
      }
      if (type.includes("enquiry")) {
        onNavigateTab("Patient_Enquiry");
        return;
      }
      if (type.includes("vil") || type.includes("visa")) {
        onNavigateTab("pre-intimation");
        return;
      }
      if (type.includes("treatment")) {
        onNavigateTab("treatment");
        return;
      }
      if (type.includes("order")) {
        onNavigateTab("my-order");
        return;
      }
      if (type.includes("physio")) {
        onNavigateTab("physiotherapy");
        return;
      }
      if (type.includes("guest_house") || type.includes("guesthouse")) {
        onNavigateTab("guest-house");
        return;
      }
    }

    if (targetRecord.route) {
      window.open(targetRecord.route, "_blank");
    }
  };

  // Effective pagination metrics
  const effectiveTotalRecords = useMemo(() => {
    return (
      pagination?.totalRecords ||
      journeySummary?.categoryCounts?.[selectedCategory] ||
      journeySummary?.categoryCounts?.all ||
      events.length
    );
  }, [pagination, journeySummary, selectedCategory, events]);

  const effectivePerPage = pagination?.perPage || 25;

  const effectiveTotalPages = useMemo(() => {
    return Math.max(
      pagination?.totalPages || 0,
      Math.ceil(effectiveTotalRecords / effectivePerPage) || 1
    );
  }, [pagination, effectiveTotalRecords, effectivePerPage]);

  // Export to Excel handler
  const handleExport = () => {
    const patientName =
      patient?.patient_name ||
      patient?.name ||
      patient?.patientName ||
      "Patient";
    exportTimelineToExcel(effectivePatientId, patientName, events);
    toast.success("Timeline exported successfully!");
  };

  return (
    <div className={`patient-timeline-wrapper ${viewMode === "table" ? "table-mode-layout" : ""}`}>
      {/* ------------------------------------------------------------------ */}
      {/* 1. Hero: Patient Journey & Milestones Roadmap                      */}
      {/* ------------------------------------------------------------------ */}
      {(viewMode === "timeline" || showMilestonesInTable) && (
        <div className="journey-roadmap-card">
          <div className="journey-header-flex">
            <div className="journey-title-block">
              <h5>
                <i className="fa-solid fa-timeline text-primary"></i>
                Patient Journey & Milestone Tracker
              </h5>
              <p>
                Complete chronological audit trail and operational milestones for{" "}
                <strong>
                  {patient?.patient_name || patient?.name || effectivePatientId}
                </strong>
              </p>
            </div>

            <div className="journey-meta-pills">
              {/* Current Stage */}
              <div className="stage-pill">
                <span className="stage-pulsing-dot"></span>
                <span>
                  Stage:{" "}
                  <strong>
                    {journeySummary?.currentStage ||
                      patient?.patient_status ||
                      "Active"}
                  </strong>
                </span>
              </div>

              {/* Days in Journey */}
              <div className="days-pill" title="Total days since registration">
                <i className="fa-regular fa-calendar-days text-muted"></i>
                <span>
                  <strong>{journeySummary?.daysInJourney ?? 0}</strong> Days in
                  Journey
                </span>
              </div>

              {isReadOnly && (
                <div
                  className="stage-pill"
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    borderColor: "#fde68a",
                  }}
                >
                  <i className="fa-solid fa-eye"></i>
                  <span>Referrer View</span>
                </div>
              )}

              {/* Collapse / Expand Milestones Toggle */}
              <button
                type="button"
                className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1"
                style={{
                  borderRadius: "8px",
                  fontSize: "0.76rem",
                  padding: "3px 10px",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                }}
                onClick={() => setRoadmapCollapsed(!roadmapCollapsed)}
                title={roadmapCollapsed ? "Expand Journey Roadmap" : "Collapse Journey Roadmap"}
              >
                <i className={`fa-solid ${roadmapCollapsed ? "fa-chevron-down" : "fa-chevron-up"}`}></i>
                <span>{roadmapCollapsed ? "Show Milestones" : "Hide"}</span>
              </button>
            </div>
          </div>

          {/* 8-Point Visual Milestone Stepper */}
          {!roadmapCollapsed && (
            <div className="milestones-stepper-track">
              <div className="stepper-progress-line">
                <div
                  className="stepper-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {milestonesList.map((m, idx) => {
                const isCompleted = Boolean(m.completed);
                const isCurrent =
                  !isCompleted &&
                  (idx === 0 || milestonesList[idx - 1]?.completed);

                return (
                  <div
                    key={m.key || idx}
                    className={`milestone-step-item ${isCompleted ? "completed" : isCurrent ? "active" : ""}`}
                    title={`${m.label}: ${m.date || (isCompleted ? "Completed" : "Pending")}`}
                  >
                    <div className="milestone-icon-bubble">
                      {isCompleted ? (
                        <i className="fa-solid fa-check"></i>
                      ) : (
                        <i className={`fa-solid ${getMilestoneIcon(m.key)}`}></i>
                      )}
                    </div>
                    <div className="milestone-text-block">
                      <div className="milestone-label">{m.label}</div>
                      <div className="milestone-date">
                        {m.date || (isCompleted ? "Done" : "Pending")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1B. Per-Treatment-Plan Milestone Tracking & Hospital Breakdown    */}
      {/* ------------------------------------------------------------------ */}
      {treatmentPlansList.length > 0 && (viewMode === "timeline" || showMilestonesInTable) && (
        <div className="treatment-plans-tracker-card">
          <div className="plans-header-row">
            <h6 className="plans-title-text">
              <i className="fa-solid fa-notes-medical text-primary"></i>
              Treatment Plans Milestone Tracking ({treatmentPlansList.length})
            </h6>
            <div className="text-muted small">
              Filter timeline activities scoped to an individual treatment plan
            </div>
          </div>

          {/* Chips for Plans */}
          <div className="plan-chips-list">
            <button
              type="button"
              className={`plan-chip-button ${selectedTreatmentPlanId === "all" ? "active" : ""}`}
              onClick={() => {
                setSelectedTreatmentPlanId("all");
                setPage(1);
              }}
            >
              <span>All Treatment Plans</span>
              <span className="plan-chip-badge">{treatmentPlansList.length}</span>
            </button>
            {treatmentPlansList.map((plan) => (
              <button
                key={plan.treatmentPlanId}
                type="button"
                className={`plan-chip-button ${selectedTreatmentPlanId === plan.treatmentPlanId ? "active" : ""}`}
                onClick={() => {
                  setSelectedTreatmentPlanId(
                    selectedTreatmentPlanId === plan.treatmentPlanId ? "all" : plan.treatmentPlanId
                  );
                  setPage(1);
                }}
                title={`Filter timeline for ${plan.treatmentName}`}
              >
                <i className="fa-solid fa-file-medical"></i>
                <span>{plan.treatmentName}</span>
                {plan.status && (
                  <span
                    className="plan-chip-badge"
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 0.18)",
                      color: "#065f46",
                    }}
                  >
                    {plan.status}
                  </span>
                )}
                {plan.eventsCount > 0 && (
                  <span className="plan-chip-badge">{plan.eventsCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* If a specific plan is active, display its 5-step checklist & hospital breakdown */}
          {activeTreatmentPlan && (
            <div className="plan-detail-box">
              <div className="plan-detail-header">
                <div>
                  <span className="plan-detail-title">{activeTreatmentPlan.treatmentName}</span>
                  {activeTreatmentPlan.createdDate && (
                    <span className="text-muted small ms-2">
                      Created: {activeTreatmentPlan.createdDate}
                    </span>
                  )}
                </div>
                <span className="plan-status-pill">{activeTreatmentPlan.status || "In-Progress"}</span>
              </div>

              {/* 5-step checklist per plan */}
              {Array.isArray(activeTreatmentPlan.milestones) && activeTreatmentPlan.milestones.length > 0 && (
                <div className="plan-milestones-track">
                  {activeTreatmentPlan.milestones.map((m, idx) => {
                    const isCompleted = Boolean(m.completed);
                    return (
                      <div
                        key={m.key || idx}
                        className={`plan-step-node ${isCompleted ? "completed" : ""}`}
                        title={`${m.label}: ${m.date || (isCompleted ? "Done" : "Pending")}`}
                      >
                        <div className="plan-step-circle">
                          {isCompleted ? (
                            <i className="fa-solid fa-check"></i>
                          ) : (
                            <i className={`fa-solid ${getPlanMilestoneIcon(m.key)}`} style={{ fontSize: "11px" }}></i>
                          )}
                        </div>
                        <div className="plan-step-title">{m.label}</div>
                        <div className="plan-step-date">
                          {m.date || (isCompleted ? "Done" : "Pending")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hospital Submission Breakdown */}
              {Array.isArray(activeTreatmentPlan.hospitals) && activeTreatmentPlan.hospitals.length > 0 && (
                <div className="hospitals-submission-list">
                  <div className="hosp-sub-header d-flex justify-content-between align-items-center">
                    <span>Hospital Submissions ({activeTreatmentPlan.hospitals.length})</span>
                    <span>Status & Dates</span>
                  </div>
                  {activeTreatmentPlan.hospitals.map((hosp, hIdx) => (
                    <div key={hosp.id || hIdx} className="hosp-sub-row">
                      <div className="hosp-sub-name">
                        <i className="fa-solid fa-hospital text-primary"></i>
                        <span>{hosp.name || `Hospital ${hIdx + 1}`}</span>
                      </div>
                      <div className="hosp-sub-meta">
                        {hosp.status && (
                          <span
                            className={`badge-status badge-status-${hosp.status === "Approved"
                              ? "green"
                              : hosp.status === "Rejected"
                                ? "red"
                                : "amber"
                              }`}
                          >
                            {hosp.status}
                          </span>
                        )}
                        {hosp.approvalAt && (
                          <span className="text-muted small" title="Approval Date">
                            <i className="fa-regular fa-clock me-1"></i>Approved: {hosp.approvalAt}
                          </span>
                        )}
                        {hosp.rejectionAt && (
                          <span className="text-danger small" title="Rejection Date">
                            <i className="fa-regular fa-circle-xmark me-1"></i>Rejected: {hosp.rejectionAt}
                          </span>
                        )}
                        {hosp.resubmittedAt && (
                          <span className="text-muted small" title="Resubmitted Date">
                            <i className="fa-solid fa-rotate-right me-1"></i>Resubmitted: {hosp.resubmittedAt}
                          </span>
                        )}
                        {hosp.seenAt && (
                          <span className="text-muted small" title="Seen Date">
                            <i className="fa-regular fa-eye me-1"></i>Seen: {hosp.seenAt}
                          </span>
                        )}
                        {hosp.preIntimationSent && (
                          <span className="badge-status badge-status-blue" title="Pre-Intimation Sent">
                            <i className="fa-solid fa-paper-plane me-1"></i>Pre-Intimation
                          </span>
                        )}
                        {hosp.vilStatus && hosp.vilStatus !== "Pending" && (
                          <span className="badge-status badge-status-blue">
                            VIL: {hosp.vilStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Controls Toolbar: Category Chips, Search & Filters              */}
      {/* ------------------------------------------------------------------ */}
      <div className="timeline-controls-card">
        {/* Category Horizontal Filter Chips with Badges */}
        <div className="category-chips-scroll">
          {TIMELINE_CATEGORIES.map((cat) => {
            const count =
              journeySummary?.categoryCounts?.[cat.key] ??
              (cat.key === "all"
                ? journeySummary?.categoryCounts?.all ?? pagination.totalRecords
                : null);

            return (
              <button
                key={cat.key}
                type="button"
                className={`category-chip-btn ${selectedCategory === cat.key ? "active" : ""}`}
                onClick={() => {
                  setSelectedCategory(cat.key);
                  setPage(1);
                }}
              >
                <i className={`fa-solid ${cat.icon}`}></i>
                <span>{cat.label}</span>
                {count !== null && count !== undefined && (
                  <span className="category-chip-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search, Status, Date Range & View Mode Row */}
        <div className="timeline-search-row">
          <div className="search-input-wrap">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="Search by title, description, user, remarks..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchInput("")}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          <div className="filter-action-group">
            {/* Status Dropdown */}
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              title="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Complete">Complete / Active</option>
              <option value="Schedule">Scheduled</option>
              <option value="Seen">Seen</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Dropped">Dropped</option>
            </select>

            {/* Date Filters */}
            <input
              type="date"
              className="date-filter-input"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              title="From Date"
            />
            <span className="text-muted small">to</span>
            <input
              type="date"
              className="date-filter-input"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              title="To Date"
            />

            {/* Reset Filters */}
            {(selectedCategory !== "all" ||
              selectedStatus !== "all" ||
              searchQuery ||
              fromDate ||
              toDate) && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleResetFilters}
                  title="Reset all filters"
                  style={{ borderRadius: "8px", fontSize: "0.82rem" }}
                >
                  <i className="fa-solid fa-rotate-left me-1"></i> Reset
                </button>
              )}

            {/* View Mode Toggle */}
            <div className="view-toggle-wrap">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "timeline" ? "active" : ""}`}
                onClick={() => setViewMode("timeline")}
                title="Timeline Feed View"
              >
                <i className="fa-solid fa-stream"></i> Feed
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Tabular View"
              >
                <i className="fa-solid fa-table-list"></i> Table
              </button>
            </div>

            {/* Toggle Plans in Table view */}
            {viewMode === "table" && (treatmentPlansList.length > 0 || milestonesList.length > 0) && (
              <button
                type="button"
                className={`btn btn-sm ${showMilestonesInTable ? "btn-primary" : "btn-outline-secondary"} d-inline-flex align-items-center gap-1`}
                style={{ borderRadius: "8px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                onClick={() => setShowMilestonesInTable(!showMilestonesInTable)}
                title={showMilestonesInTable ? "Hide Milestones & Plans" : "Show Milestones & Plans"}
              >
                <i className={`fa-solid ${showMilestonesInTable ? "fa-eye-slash" : "fa-timeline"}`}></i>
                <span>{showMilestonesInTable ? "Hide Plans" : "Show Plans"}</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              className="icon-btn-tool"
              onClick={() => loadTimeline(false)}
              title="Refresh timeline"
            >
              <i
                className={`fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`}
              ></i>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
              style={{ borderRadius: "8px", fontSize: "0.82rem" }}
              onClick={handleExport}
              disabled={loading || events.length === 0}
              title="Export timeline to CSV / Excel"
            >
              <i className="fa-solid fa-file-excel"></i> Export
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Main Content: Timeline Feed or Table View                      */}
      {/* ------------------------------------------------------------------ */}
      {loading ? (
        <div className="py-5 text-center">
          <Loader />
          <p className="text-muted mt-2" style={{ fontSize: "0.88rem" }}>
            Fetching patient activity timeline...
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="timeline-empty-state">
          <div className="empty-icon-circle">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <h6>No Activity Timeline Events Found</h6>
          <p>
            {searchQuery ||
              selectedCategory !== "all" ||
              selectedStatus !== "all" ||
              fromDate ||
              toDate
              ? "No timeline records match your selected filter criteria. Try resetting your search filters."
              : "No activities or journey milestones have been recorded for this patient yet."}
          </p>
          {(selectedCategory !== "all" ||
            selectedStatus !== "all" ||
            searchQuery ||
            fromDate ||
            toDate) && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ borderRadius: "20px", padding: "6px 18px" }}
                onClick={handleResetFilters}
              >
                <i className="fa-solid fa-filter-circle-xmark me-1"></i> Clear Filters
              </button>
            )}
        </div>
      ) : viewMode === "timeline" ? (
        /* Chronological Timeline Feed */
        <div className="timeline-feed-container">
          {events.map((ev, index) => {
            const statusColor = ev.statusColor || "blue";
            const iconClass = getTimelineIconClass(ev.icon, ev.category);
            const categoryAccentClass = `accent-${String(ev.category || "patient").toLowerCase()}`;

            return (
              <div key={ev.id || index} className="timeline-event-row">
                {/* Node Icon Avatar */}
                <div className={`timeline-node-icon node-${statusColor}`}>
                  <i className={`fa-solid ${iconClass}`}></i>
                </div>

                {/* Event Card */}
                <div className={`timeline-event-card ${categoryAccentClass}`}>
                  <div className="event-card-header">
                    <div className="event-title-group">
                      <div className="event-title-text">{ev.title}</div>
                      <div className="event-badge-strip">
                        {/* Category Label */}
                        <span className="badge-cat">
                          <i className={`fa-solid ${iconClass} me-1`}></i>
                          {ev.categoryLabel || ev.category}
                        </span>

                        {/* Status Badge */}
                        {ev.status && (
                          <span
                            className={`badge-status badge-status-${statusColor}`}
                          >
                            {ev.status}
                          </span>
                        )}

                        {/* Action Pill */}
                        {ev.action && (
                          <span className="badge-action-pill">{ev.action}</span>
                        )}

                        {/* Treatment Plan Tag */}
                        {ev.treatmentName && (
                          <button
                            type="button"
                            className={`badge-treatment-plan ${String(selectedTreatmentPlanId) === String(ev.treatmentPlanId) ? "active-plan-badge" : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (ev.treatmentPlanId) {
                                setSelectedTreatmentPlanId(
                                  String(selectedTreatmentPlanId) === String(ev.treatmentPlanId)
                                    ? "all"
                                    : ev.treatmentPlanId
                                );
                                setPage(1);
                              }
                            }}
                            title="Filter timeline to this Treatment Plan"
                          >
                            <i className="fa-solid fa-notes-medical"></i>
                            <span>{ev.treatmentName}</span>
                          </button>
                        )}

                        {/* Hospital Tag */}
                        {ev.hospitalName && (
                          <span className="badge-hospital">
                            <i className="fa-solid fa-hospital"></i>
                            <span>{ev.hospitalName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time / Date */}
                    <div className="event-time-meta">
                      <div className="time-primary">
                        {ev.time ? `${ev.date} • ${ev.time}` : ev.date || ev.dateTime}
                      </div>
                      <span className="time-relative">
                        {formatRelativeTime(ev.performedAt || ev.dateTime)}
                      </span>
                    </div>
                  </div>

                  {/* Event Body */}
                  <div className="event-card-body">
                    {ev.description && (
                      <p className="event-description-text">{ev.description}</p>
                    )}

                    {/* Target Record Reference (click to jump/navigate) */}
                    {ev.targetRecord && ev.targetRecord.name && (
                      <div>
                        <button
                          type="button"
                          className="target-record-tag"
                          onClick={() => handleTargetRecordClick(ev.targetRecord)}
                          title={`Navigate to ${ev.targetRecord.type || "record"}: ${ev.targetRecord.name}`}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          <span>
                            {ev.targetRecord.type
                              ? `${String(ev.targetRecord.type).replace(/_/g, " ").toUpperCase()}: `
                              : ""}
                            {ev.targetRecord.name}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Remarks Callout */}
                    {ev.remarks && (
                      <div className="event-remarks-box">
                        <i className="fa-regular fa-comment-dots me-1 text-muted"></i>
                        {ev.remarks}
                      </div>
                    )}

                    {/* Attachments if any */}
                    {Array.isArray(ev.attachments) &&
                      ev.attachments.length > 0 && (
                        <div className="event-attachments-wrap">
                          {ev.attachments.map((att, aIdx) => (
                            <a
                              key={aIdx}
                              href={att.url || att}
                              target="_blank"
                              rel="noreferrer"
                              className="attachment-pill"
                            >
                              <i className="fa-solid fa-paperclip"></i>
                              <span>{att.name || `Attachment ${aIdx + 1}`}</span>
                            </a>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Event Card Footer */}
                  <div className="event-card-footer">
                    <div className="performer-info">
                      <div className="performer-avatar-sm">
                        {(ev.performedBy || "U").charAt(0).toUpperCase()}
                      </div>
                      <span className="performer-name">
                        {ev.performedBy || "System"}
                      </span>
                      {ev.userRole && (
                        <span className="performer-role-tag">{ev.userRole}</span>
                      )}
                    </div>

                    <div className="source-tag">
                      <i className="fa-solid fa-shield-alt fa-shield"></i>
                      <span>
                        {ev.source === "domain_milestone"
                          ? "Milestone Fact"
                          : "Audit Log"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tabular View */
        <TableContainer
          component={Paper}
          className="timeline-table-container"
          sx={{ mb: 2 }}
        >
          <Table stickyHeader size="small" className="activity-log-table timeline-data-table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "50px", textAlign: "center" }}>#</TableCell>
                <TableCell sx={{ width: "150px" }}>Date & Time</TableCell>
                <TableCell sx={{ width: "145px" }}>Category</TableCell>
                <TableCell sx={{ width: "165px" }}>Plan / Hospital</TableCell>
                <TableCell sx={{ minWidth: "260px" }}>Title & Description</TableCell>
                <TableCell sx={{ width: "110px", textAlign: "center" }}>Status</TableCell>
                <TableCell sx={{ width: "180px" }}>Performed By</TableCell>
                <TableCell sx={{ width: "135px", textAlign: "center" }}>Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <div className="text-center text-muted">
                      <i className="fa-solid fa-clock-rotate-left mb-2" style={{ fontSize: "1.8rem", color: "#cbd5e1" }}></i>
                      <h6>No Timeline Records</h6>
                      <p className="small mb-0">No matching activities found for this patient.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev, idx) => {
                  const iconClass = getTimelineIconClass(ev.icon, ev.category);
                  const hasRealStatus =
                    ev.status &&
                    ev.status !== "-" &&
                    ev.status.toLowerCase() !== "log" &&
                    ev.status.toLowerCase() !== "completed";

                  // Clean duplicate text
                  const titleText = (ev.title || "").trim();
                  const descText = (ev.description || "").trim();
                  const remarksText = (ev.remarks || "").trim();
                  const showDesc = descText && descText !== titleText;
                  const showRemarks =
                    remarksText &&
                    remarksText !== titleText &&
                    remarksText !== descText;

                  return (
                    <TableRow key={ev.id || idx} hover>
                      <TableCell sx={{ textAlign: "center", fontWeight: 600, color: "#64748b" }}>
                        {(pagination.currentPage - 1) * (pagination.perPage || 25) + idx + 1}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>
                          <i className="fa-regular fa-calendar me-1 text-muted"></i>
                          {ev.date}
                        </div>
                        {ev.time && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                            <i className="fa-regular fa-clock me-1 text-muted"></i>
                            {ev.time}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="badge-cat">
                          <i className={`fa-solid ${iconClass} me-1`}></i>
                          {ev.categoryLabel || ev.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        {ev.treatmentName ? (
                          <button
                            type="button"
                            className={`badge-treatment-plan ${String(selectedTreatmentPlanId) === String(ev.treatmentPlanId)
                              ? "active-plan-badge"
                              : ""
                              }`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (ev.treatmentPlanId) {
                                setSelectedTreatmentPlanId(
                                  String(selectedTreatmentPlanId) === String(ev.treatmentPlanId)
                                    ? "all"
                                    : ev.treatmentPlanId
                                );
                                setPage(1);
                              }
                            }}
                            title="Filter timeline to this Treatment Plan"
                          >
                            <i className="fa-solid fa-notes-medical"></i>
                            <span>{ev.treatmentName}</span>
                          </button>
                        ) : null}
                        {ev.hospitalName && (
                          <div className="text-muted small mt-1" style={{ fontSize: "0.76rem" }}>
                            <i className="fa-solid fa-hospital me-1"></i>
                            {ev.hospitalName}
                          </div>
                        )}
                        {!ev.treatmentName && !ev.hospitalName && (
                          <span className="text-muted" style={{ fontSize: "0.85rem" }}>—</span>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: "280px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.83rem", lineHeight: "1.4" }}>
                          {titleText}
                        </div>
                        {showDesc && (
                          <div
                            style={{
                              fontSize: "0.79rem",
                              color: "#475569",
                              marginTop: "3px",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              lineHeight: "1.4",
                            }}
                          >
                            {descText}
                          </div>
                        )}
                        {showRemarks && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#64748b",
                              fontStyle: "italic",
                              marginTop: "3px",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>Note:</span> {remarksText}
                          </div>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {hasRealStatus ? (
                          <span
                            className={`badge-status badge-status-${ev.statusColor || "blue"}`}
                            style={{ textTransform: "capitalize", fontSize: "0.72rem" }}
                          >
                            {ev.status}
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: "0.82rem" }}>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="activity-user-pill">
                          <div className="activity-user-avatar">
                            {(ev.performedBy || "U").charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: "0.82rem" }}>{ev.performedBy || "System"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`activity-role-badge ${String(ev.userRole || "").toLowerCase().includes("doc")
                            ? "activity-role-doctor"
                            : String(ev.userRole || "").toLowerCase().includes("coord")
                              ? "activity-role-coordinator"
                              : String(ev.userRole || "").toLowerCase().includes("physio")
                                ? "activity-role-physio"
                                : String(ev.userRole || "").toLowerCase().includes("hosp")
                                  ? "activity-role-hospital"
                                  : String(ev.userRole || "").toLowerCase().includes("admin") ||
                                    String(ev.userRole || "").toLowerCase().includes("manag")
                                    ? "activity-role-admin"
                                    : "activity-role-default"
                            }`}
                        >
                          {ev.userRole || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. Pagination Footer                                              */}
      {/* ------------------------------------------------------------------ */}
      {!loading && events.length > 0 && (
        <div className="timeline-pagination-bar d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 pb-2">
          <div className="text-muted small">
            Showing{" "}
            <strong>
              {(page - 1) * effectivePerPage + 1}
            </strong>{" "}
            to{" "}
            <strong>
              {Math.min(page * effectivePerPage, effectiveTotalRecords)}
            </strong>{" "}
            of <strong>{effectiveTotalRecords}</strong> activities
          </div>
          <Stack spacing={2}>
            <Pagination
              count={effectiveTotalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
              size="small"
              shape="rounded"
            />
          </Stack>
        </div>
      )}
    </div>
  );
}
