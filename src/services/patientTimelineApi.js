import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

/**
 * Standard Auth Headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

/**
 * Category Definitions with Labels, Icons & Brand Colors
 */
export const TIMELINE_CATEGORIES = [
  { key: "all", label: "All Activities", icon: "fa-list-check", color: "#475569" },
  { key: "enquiry", label: "Enquiries", icon: "fa-circle-question", color: "#0284c7" },
  { key: "patient", label: "Patient Profile", icon: "fa-user-injured", color: "#0d9488" },
  { key: "coordinator", label: "Coordinator", icon: "fa-user-tie", color: "#6366f1" },
  { key: "treatment_plan", label: "Treatment Plans", icon: "fa-notes-medical", color: "#8b5cf6" },
  { key: "vil", label: "VIL & Visa", icon: "fa-passport", color: "#ec4899" },
  { key: "appointment", label: "Appointments", icon: "fa-calendar-check", color: "#14b8a6" },
  { key: "pick_drop", label: "Pick & Drop", icon: "fa-car", color: "#f59e0b" },
  { key: "travel", label: "Travel & Flights", icon: "fa-plane-departure", color: "#f97316" },
  { key: "treatment", label: "Treatment", icon: "fa-kit-medical", color: "#10b981" },
  { key: "payment", label: "Payments", icon: "fa-credit-card", color: "#10b981" },
  { key: "document", label: "Documents", icon: "fa-file-lines", color: "#64748b" },
];

/**
 * Map Status Color Names to styling classes & hex codes
 */
export const STATUS_COLOR_CONFIG = {
  green: {
    bg: "#ecfdf5",
    text: "#059669",
    border: "#a7f3d0",
    glow: "rgba(16, 185, 129, 0.2)",
  },
  blue: {
    bg: "#eff6ff",
    text: "#2563eb",
    border: "#bfdbfe",
    glow: "rgba(37, 99, 235, 0.2)",
  },
  amber: {
    bg: "#fffbeb",
    text: "#d97706",
    border: "#fde68a",
    glow: "rgba(217, 119, 6, 0.2)",
  },
  red: {
    bg: "#fef2f2",
    text: "#dc2626",
    border: "#fecaca",
    glow: "rgba(220, 38, 38, 0.2)",
  },
  gray: {
    bg: "#f8fafc",
    text: "#475569",
    border: "#e2e8f0",
    glow: "rgba(100, 116, 139, 0.15)",
  },
};

/**
 * Derives status color name ('green' | 'blue' | 'amber' | 'red' | 'gray')
 */
export const getStatusColorName = (status, action) => {
  if (!status) return "blue";
  const s = String(status).toLowerCase();
  const a = String(action || "").toLowerCase();
  if (
    s.includes("approv") ||
    s.includes("confirm") ||
    s.includes("complet") ||
    s.includes("success") ||
    a.includes("approv")
  ) {
    return "green";
  }
  if (
    s.includes("close") ||
    s.includes("dead") ||
    s.includes("reject") ||
    s.includes("cancel") ||
    s.includes("drop") ||
    s.includes("fail") ||
    s.includes("delete") ||
    a.includes("reject")
  ) {
    return "red";
  }
  if (
    s.includes("not connected") ||
    s.includes("not-connected") ||
    s.includes("pend") ||
    s.includes("wait") ||
    s.includes("sched") ||
    s.includes("hold") ||
    s.includes("sent")
  ) {
    return "amber";
  }
  if (s.includes("connected")) {
    return "blue";
  }
  return "blue";
};

/**
 * Icons for 5-step Treatment Plan checklist
 */
export const getPlanMilestoneIcon = (key) => {
  switch (key) {
    case "plan_created":
      return "fa-file-lines";
    case "sent_to_hospitals":
      return "fa-paper-plane";
    case "plan_approved":
      return "fa-certificate";
    case "vil_issued":
      return "fa-passport";
    case "treatment_started":
      return "fa-kit-medical";
    default:
      return "fa-circle-dot";
  }
};

/**
 * Map FontAwesome icon by icon name or category fallback
 */
export const getTimelineIconClass = (iconName, category) => {
  if (iconName) {
    const raw = String(iconName).toLowerCase().replace(/^fa-/, "");
    if (raw.includes("clipboard") || raw.includes("list")) return "fa-clipboard-list";
    if (raw.includes("calendar")) return "fa-calendar-check";
    if (raw.includes("plane") || raw.includes("flight")) return "fa-plane-departure";
    if (raw.includes("passport") || raw.includes("visa")) return "fa-passport";
    if (raw.includes("car") || raw.includes("cab") || raw.includes("drive")) return "fa-car";
    if (raw.includes("user-tie") || raw.includes("coordinator")) return "fa-user-tie";
    if (raw.includes("stethoscope") || raw.includes("doctor")) return "fa-user-doctor";
    if (raw.includes("kit-medical") || raw.includes("treatment")) return "fa-kit-medical";
    if (raw.includes("file") || raw.includes("document") || raw.includes("pdf")) return "fa-file-lines";
    if (raw.includes("dollar") || raw.includes("card") || raw.includes("payment")) return "fa-credit-card";
    if (raw.includes("circle-question") || raw.includes("enquiry")) return "fa-circle-question";
    if (raw.includes("check")) return "fa-circle-check";
    return `fa-${raw}`;
  }

  const cat = String(category || "").toLowerCase();
  const matched = TIMELINE_CATEGORIES.find((c) => c.key === cat);
  return matched ? matched.icon : "fa-clock-rotate-left";
};

/**
 * Normalizes milestone items
 */
export const DEFAULT_MILESTONES = [
  { key: "enquiry", label: "Enquiry Received", date: null, completed: false },
  { key: "registration", label: "Patient Registered", date: null, completed: false },
  { key: "coordinator", label: "Coordinator Assigned", date: null, completed: false },
  { key: "treatment_plan", label: "Treatment Plan Approved", date: null, completed: false },
  { key: "vil_visa", label: "VIL & Visa", date: null, completed: false },
  { key: "travel_pickup", label: "Travel & Pick-Up", date: null, completed: false },
  { key: "treatment", label: "Treatment In-Progress", date: null, completed: false },
  { key: "completed", label: "Treatment Completed", date: null, completed: false },
];

/**
 * Fetch Patient Activity Timeline with filtering & pagination
 * Supports primary & fallback endpoints
 */
export const fetchPatientTimeline = async (patientId, filters = {}) => {
  if (!patientId) {
    throw new Error("Patient ID is required to fetch timeline");
  }

  const encodedId = encodeURIComponent(String(patientId).trim());
  const headers = getAuthHeaders();

  const queryParams = { ...filters };
  // Remove empty/null params
  Object.keys(queryParams).forEach((k) => {
    if (queryParams[k] === undefined || queryParams[k] === null || queryParams[k] === "") {
      delete queryParams[k];
    }
  });

  // Endpoints to try in order
  const endpoints = [
    `${baseurl}patient_timeline/${encodedId}`,
    `${baseurl}get_patient_timeline/${encodedId}`,
    `${baseurl}patient/${encodedId}/timeline`,
    `${baseurl}patient_timeline?patientId=${encodedId}`,
  ];

  let lastError = null;
  let responseData = null;

  for (const endpoint of endpoints) {
    try {
      const res = await axios.get(endpoint, {
        headers,
        params: queryParams,
      });
      if (res && res.data) {
        responseData = res.data;
        break;
      }
    } catch (err) {
      lastError = err;
      // If 404 or 500, attempt next route
      if (err.response?.status === 404) {
        continue;
      }
      // If 403 Forbidden (RBAC violation), stop and throw immediately
      if (err.response?.status === 403 || err.response?.status === 401) {
        throw err;
      }
    }
  }

  // If new timeline endpoints were not available, fall back to enhanced get_patient_activity_logs
  if (!responseData) {
    try {
      const fallbackRes = await axios.get(`${baseurl}get_patient_activity_logs/${encodedId}`, {
        headers,
        params: queryParams,
      });
      if (fallbackRes && fallbackRes.data) {
        const raw = fallbackRes.data;
        const rawLogs = Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.logs)
          ? raw.logs
          : Array.isArray(raw)
          ? raw
          : [];

        // Synthesize into timeline format
        const events = rawLogs.map((log, index) => ({
          id: log._id || log.id || `log_${index}`,
          title: log.title || log.description || log.action || "Activity Log",
          description: log.description || log.details || "",
          category: String(log.module || log.category || "patient").toLowerCase(),
          categoryLabel: log.categoryLabel || log.module || "Activity",
          action: log.action || "LOG",
          status: log.status || "Completed",
          statusColor: log.statusColor || "blue",
          icon: log.icon || "clipboard-list",
          performedBy: log.performedBy || log.userName || log.user?.name || "System",
          userRole: log.userRole || log.role || "Staff",
          performedAt: log.performedAt || log.createdAt || log.date,
          date: log.date || (log.performedAt ? new Date(log.performedAt).toLocaleDateString("en-GB") : "-"),
          time: log.time || (log.performedAt ? new Date(log.performedAt).toLocaleTimeString("en-GB") : ""),
          dateTime: log.dateTime || log.date || "-",
          remarks: log.remarks || "",
          source: log.source || "audit_log",
          targetRecord: log.targetRecord || null,
        }));

        responseData = {
          success: true,
          patientId,
          currentStage: raw.currentStage || "Active",
          journeySummary: raw.journeySummary || {
            currentStage: raw.currentStage || "Active",
            daysInJourney: 0,
            milestones: DEFAULT_MILESTONES,
            categoryCounts: { all: events.length },
          },
          pagination: {
            totalRecords: raw.totalRecords || raw.total || events.length,
            currentPage: queryParams.page || 1,
            totalPages: Math.ceil((raw.totalRecords || events.length) / (queryParams.limit || 10)) || 1,
            perPage: queryParams.limit || 10,
          },
          count: events.length,
          data: events,
        };
      }
    } catch (fallbackErr) {
      throw lastError || fallbackErr;
    }
  }

  // Normalize final structure
  const rawData = responseData || {};
  const rawEvents = Array.isArray(rawData.data)
    ? rawData.data
    : Array.isArray(rawData.timeline)
    ? rawData.timeline
    : Array.isArray(rawData)
    ? rawData
    : [];

  const events = rawEvents.map((ev, index) => ({
    ...ev,
    id: ev.id || ev._id || `event_${index}`,
    statusColor: ev.statusColor || getStatusColorName(ev.status, ev.action),
    treatmentPlanId: ev.treatmentPlanId || null,
    treatmentName: ev.treatmentName || null,
    hospitalName: ev.hospitalName || null,
  }));

  const totalRecs =
    rawData?.pagination?.totalRecords ||
    rawData?.pagination?.total ||
    rawData?.totalRecords ||
    rawData?.total ||
    rawData?.count ||
    events.length;
  const pageLimit =
    rawData?.pagination?.perPage ||
    rawData?.pagination?.limit ||
    rawData?.limit ||
    queryParams.limit ||
    10;
  const curPage =
    rawData?.pagination?.currentPage ||
    rawData?.pagination?.page ||
    rawData?.page ||
    queryParams.page ||
    1;
  const numPages =
    rawData?.pagination?.totalPages ||
    rawData?.totalPages ||
    (totalRecs > 0 ? Math.ceil(totalRecs / pageLimit) : 1);

  const pagination = {
    totalRecords: totalRecs,
    currentPage: curPage,
    totalPages: Math.max(numPages, 1),
    perPage: pageLimit,
  };

  const journeySummary = rawData.journeySummary || {
    currentStage: rawData.currentStage || "Active",
    daysInJourney: 0,
    registeredAt: null,
    assignedCoordinator: null,
    milestones: DEFAULT_MILESTONES,
    treatmentPlans: [],
    categoryCounts: { all: events.length },
  };

  if (!Array.isArray(journeySummary.treatmentPlans)) {
    journeySummary.treatmentPlans = [];
  } else {
    journeySummary.treatmentPlans = journeySummary.treatmentPlans.map((tp) => ({
      ...tp,
      treatmentPlanId: tp.treatmentPlanId || tp.id || tp._id,
      treatmentName: tp.treatmentName || tp.name || "Treatment Plan",
      status: tp.status || "Created",
      hospitals: Array.isArray(tp.hospitals) ? tp.hospitals : [],
      milestones: Array.isArray(tp.milestones) ? tp.milestones : [],
      eventsCount: tp.eventsCount ?? 0,
    }));
  }

  return {
    success: rawData.success ?? true,
    patientId: rawData.patientId || patientId,
    patientName: rawData.patientName || "",
    currentStage: rawData.currentStage || journeySummary.currentStage || "Active",
    journeySummary,
    pagination,
    count: rawData.count || events.length,
    data: events,
    isReadOnly: rawData.isReadOnly || false,
  };
};

/**
 * Format relative date time (e.g. "2 hours ago", "Yesterday", "07 Oct 2026")
 */
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
};

/**
 * Export Timeline list to CSV / Excel readable file
 */
export const exportTimelineToExcel = (patientId, patientName, events = []) => {
  if (!events || events.length === 0) return;

  const headers = [
    "Sr.No.",
    "Date & Time",
    "Category",
    "Action",
    "Status",
    "Title",
    "Description",
    "Treatment Plan",
    "Hospital",
    "Remarks",
    "Performed By",
    "Role",
    "Source",
  ];

  const rows = events.map((ev, index) => [
    index + 1,
    `"${(ev.dateTime || ev.date || "").replace(/"/g, '""')}"`,
    `"${(ev.categoryLabel || ev.category || "").replace(/"/g, '""')}"`,
    `"${(ev.action || "").replace(/"/g, '""')}"`,
    `"${(ev.status || "").replace(/"/g, '""')}"`,
    `"${(ev.title || "").replace(/"/g, '""')}"`,
    `"${(ev.description || "").replace(/"/g, '""')}"`,
    `"${(ev.treatmentName || "").replace(/"/g, '""')}"`,
    `"${(ev.hospitalName || "").replace(/"/g, '""')}"`,
    `"${(ev.remarks || "").replace(/"/g, '""')}"`,
    `"${(ev.performedBy || "").replace(/"/g, '""')}"`,
    `"${(ev.userRole || "").replace(/"/g, '""')}"`,
    `"${(ev.source || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const cleanId = String(patientId || "patient").replace(/[^a-zA-Z0-9_-]/g, "_");
  link.setAttribute("download", `Patient_Timeline_${cleanId}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
