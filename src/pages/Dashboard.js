import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import dashboardImg from "../img/dashboard-doc.png";
import CountUp from "react-countup";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import CaseListModal from "../components/Dashboard/CaseListModal";
import TravelStatusModal from "../components/Common/TravelStatusModal";
import DashboardAnalytics from "../components/Dashboard/DashboardAnalytics";
import ActionRequiredSection, {
  mergeActionRequiredItems,
} from "../components/Dashboard/ActionRequiredSection";
import ReferralDashboard from "../components/Dashboard/ReferralDashboard";
import InsuranceDashboard from "../components/Dashboard/InsuranceDashboard";
import PickDropDashboardSection from "../components/Dashboard/PickDropDashboardSection";
import { baseurl } from "../Basurl/Baseurl";
import {
  extractActivityLogs,
  getActivityLogUser,
  getActivityLogRole,
  getActivityLogDescription,
  getActivityLogAction,
  getActivityLogModule,
  getActivityLogDate,
  getActivityLogEntityName,
  getActivityLogId,
} from "./ActivityLog/activityLogHelpers";
import {
  activityIcon,
  addPatientNotes,
  agingToPriority,
  changePatientStatus,
  fetchCaseList,
  fetchDailySummary,
  fetchDashboard,
  fetchDashboardSummary,
  fetchTodayWork,
  fetchPatientAging,
  formatWaitingDuration,
  getWaitingHours,
  navigateToRecord,
  PRIORITY_ENDPOINTS,
  severityToDot,
  TODAY_WORK_ENDPOINTS,
  updatePatientAgingStage,
} from "../services/dashboardApi";
import {
  normalizeAgingStage,
  normalizePatientStatus,
  getPatientStatusLabel,
  getPatientStatusBadgeKey,
  isTravelStatus,
  PATIENT_AGING_STAGE_OPTIONS,
  PATIENT_STATUS_OPTIONS,
} from "../utils/patientStatus";
import { isSocialMediaRole, isPickDropStaffUser, isDriverUser } from "../utils/authStorage";
import {
  fetchMyCrmDashboardPermissions,
  extractPermissionsList,
  isCrmDashboardSectionAllowed,
  isCrmDashboardAnySectionAllowed,
  isCrmDashboardItemAllowed,
} from "../services/dashboardPermissionsApi";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const formatRecentActivityTime = (item = {}) => {
  if (item?.time) return item.time;
  if (!item?.performedAt) return "";
  const date = new Date(item.performedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const priorityBadgeLabel = {
  critical: "Critical",
  high: "High Priority",
  warning: "Warning",
  normal: "Normal",
};

const getPatientPhone = (row = {}) => {
  const raw = row?.raw || row || {};
  const code = String(
    row?.phoneCode ||
    row?.dial_code ||
    row?.dialCode ||
    row?.countryCode ||
    row?.country_code ||
    row?.phone_code ||
    raw?.phoneCode ||
    raw?.dial_code ||
    raw?.dialCode ||
    raw?.countryCode ||
    raw?.country_code ||
    raw?.phone_code ||
    raw?.patient?.phoneCode ||
    raw?.patient?.dial_code ||
    raw?.patient?.dialCode ||
    raw?.patient?.countryCode ||
    raw?.patient?.country_code ||
    raw?.patient?.phone_code ||
    "",
  ).trim();

  const phone = String(
    row?.emergency_contact_no ||
    row?.emergency_contact ||
    row?.patient_emergency_contact_no ||
    row?.phone ||
    row?.phoneNumber ||
    row?.phone_number ||
    row?.mobile ||
    row?.mobileNumber ||
    row?.mobile_number ||
    row?.contact ||
    row?.contact_no ||
    row?.patient_phone ||
    row?.patientPhone ||
    row?.patientMobile ||
    raw?.emergency_contact_no ||
    raw?.emergency_contact ||
    raw?.patient_emergency_contact_no ||
    raw?.phone ||
    raw?.phoneNumber ||
    raw?.phone_number ||
    raw?.mobile ||
    raw?.mobileNumber ||
    raw?.mobile_number ||
    raw?.contact ||
    raw?.contact_no ||
    raw?.patient_phone ||
    raw?.patientPhone ||
    raw?.patientMobile ||
    raw?.patient?.emergency_contact_no ||
    raw?.patient?.emergency_contact ||
    raw?.patient?.patient_emergency_contact_no ||
    raw?.patient?.mobile ||
    raw?.patient?.phone ||
    raw?.patient?.phoneNumber ||
    "",
  ).trim();

  if (code && phone) {
    if (phone.startsWith(code)) {
      return phone;
    }
    return `${code} ${phone}`;
  }
  return phone || code || "—";
};

const normalizeAgingRow = (row) => {
  const waitingHours = getWaitingHours(row);
  const waitingLabel = formatWaitingDuration(
    row.waitingLabel || waitingHours,
  );
  const priority = agingToPriority(row);
  const phone = getPatientPhone(row);
  return {
    id: row.patientId || row.enquiryId || row.patientName,
    patientId: row.patientId,
    enquiryId: row.enquiryId,
    name: row.patientName || row.patient_name || "—",
    phone,
    status: row.p_status || row.status || "—",
    stage: row.currentStage || row.stageLabel || row.stage || row.waitingLabel || "—",
    waitingLabel,
    waitingHours,
    priority,
    priorityLabel: row.priority || priorityBadgeLabel[priority] || "—",
    recordType: row.patientId ? "patient" : row.enquiryId ? "enquiry" : null,
    raw: row,
  };
};

const escapeCsvCell = (value) => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const escapeHtmlCell = (value) => {
  const text = value == null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const downloadAgingExcel = (rows = []) => {
  const headers = [
    "Sr.No.",
    "Patient Name",
    "Patient ID",
    "Enquiry ID",
    "Phone Number",
    "Status",
    "Current Stage",
    "Waiting Time",
    "Priority",
    "Notes Count",
  ];
  const headerRow = headers
    .map(
      (header) =>
        `<th style="background-color:#0ba6df;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #ddd;">${escapeHtmlCell(
          header,
        )}</th>`,
    )
    .join("");

  const bodyRows = rows
    .map((row, idx) => {
      const notes = Array.isArray(row.raw?.discussionNotes)
        ? row.raw.discussionNotes.length
        : 0;
      const cells = [
        idx + 1,
        row.name || "—",
        row.patientId || "",
        row.enquiryId || "",
        row.phone && row.phone !== "—" ? row.phone : "",
        row.status || "—",
        row.stage || "—",
        row.waitingLabel || "—",
        row.priorityLabel || "—",
        notes,
      ]
        .map(
          (val) =>
            `<td style="padding:6px;border:1px solid #ddd;">${escapeHtmlCell(
              val,
            )}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const excelHtml = `\uFEFF<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Aging Monitor</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<h3 style="color:#0ba6df;font-family:sans-serif;">Patient Aging Monitor</h3>
<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;

  const blob = new Blob([excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute("download", `patient-aging-monitor-${stamp}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadAgingCsv = (rows = []) => {
  const headers = [
    "Patient Name",
    "Patient ID",
    "Enquiry ID",
    "Phone Number",
    "Status",
    "Current Stage",
    "Waiting Time",
    "Priority",
    "Notes Count",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => {
      const notes = Array.isArray(row.raw?.discussionNotes)
        ? row.raw.discussionNotes.length
        : 0;
      return [
        escapeCsvCell(row.name),
        escapeCsvCell(row.patientId || ""),
        escapeCsvCell(row.enquiryId || ""),
        escapeCsvCell(row.phone && row.phone !== "—" ? row.phone : ""),
        escapeCsvCell(row.status),
        escapeCsvCell(row.stage),
        escapeCsvCell(row.waitingLabel),
        escapeCsvCell(row.priorityLabel),
        escapeCsvCell(notes),
      ].join(",");
    }),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute("download", `patient-aging-monitor-${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Statuses excluded from Patient Aging Monitor */
const EXCLUDED_AGING_STATUSES = new Set([
  "local case",
  "passed away",
  "cancelled",
]);

const shouldShowInAgingMonitor = (row = {}, activeStatusFilter = "") => {
  if (activeStatusFilter) return true;
  const status = String(row.p_status || row.status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  return !EXCLUDED_AGING_STATUSES.has(status);
};

const AGING_LEGEND_ORDER = ["normal", "warning", "high_priority", "critical"];
const AGING_PAGE_SIZE = 10;

const getPaginationPages = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};

const PRIORITY_STATIC_TREND = [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 8];

const PRIORITY_ITEMS = [
  {
    key: "newEnquiries",
    label: "New Enquiries",
    icon: "fa fa-user-plus",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "treatmentPlansPending",
    label: "Treatment Plans Pending",
    icon: "fa fa-file-text-o",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "followUpsDue",
    label: "Follow-ups Due",
    icon: "fa fa-refresh",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "doctorReviewsPending",
    label: "Doctor Reviews Pending",
    icon: "fa fa-stethoscope",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "patientsTravellingToday",
    label: "Patients Travelling Today",
    icon: "fa fa-plane",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "overdueCases",
    label: "Overdue Cases",
    icon: "fa fa-exclamation-triangle",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "arrivingToday",
    label: "Arriving Today",
    icon: "fas fa-plane-arrival",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  {
    key: "departingToday",
    label: "Departing Today",
    icon: "fas fa-plane-departure",
    staticTrend: PRIORITY_STATIC_TREND,
  },
  // {
  //   key: "preponedToday",
  //   label: "Preponed Today",
  //   icon: "fa fa-calendar-check-o",
  //   staticTrend: PRIORITY_STATIC_TREND,
  // },
  // {
  //   key: "postponedToday",
  //   label: "Postponed Today",
  //   icon: "fa fa-calendar-times-o",
  //   staticTrend: PRIORITY_STATIC_TREND,
  // },
];

const TODAYS_WORK_ITEMS = [
  {
    key: "newEnquiriesToday",
    label: "New enquiries today",
    icon: "fa fa-user-plus",
    color: "#0ba6df",
    fill: "#85B7EB",
  },
  {
    key: "patientsContactedToday",
    label: "Patients contacted today",
    icon: "fa fa-phone",
    color: "#0ba6df",
    fill: "#99F6E4",
  },
  {
    key: "treatmentPlansIssuedToday",
    label: "Treatment plans issued today",
    icon: "fa fa-file-text-o",
    color: "#534AB7",
    fill: "#AFA9EC",
  },
  {
    key: "appointmentsScheduledToday",
    label: "Appointments scheduled today",
    icon: "fa fa-calendar-check-o",
    color: "#854F0B",
    fill: "#FAC775",
  },
  {
    key: "patientsTravellingToday",
    label: "Patients travelling today",
    icon: "fa fa-plane",
    color: "#1D7A46",
    fill: "#A7F3D0",
  },
  {
    key: "followUpsDueToday",
    label: "Follow-ups due today",
    icon: "fa fa-refresh",
    color: "#A32D2D",
    fill: "#F7C1C1",
  },
];

const ATTENTION_ITEMS = [
  {
    key: "treatmentPlanOverdue",
    apiId: "treatment_plan_pending",
    label: "Waiting for treatment plan",
    icon: "fa fa-clock-o",
    color: "#0ba6df",
    fill: "#F7C1C1",
    defaultEndpoint: "dashboard/treatment-plan-pending",
  },
  {
    key: "notContactedToday",
    apiId: "not_contacted_today",
    label: "Not contacted today",
    icon: "fa fa-phone-square",
    color: "#0ba6df",
    fill: "#FAC775",
    defaultEndpoint: "dashboard/new-enquiries-today",
  },
  {
    key: "overdueFollowUps",
    apiId: "overdue_followups",
    label: "Overdue follow-ups",
    icon: "fa fa-calendar-times-o",
    color: "#0ba6df",
    fill: "#F0997B",
    defaultEndpoint: "dashboard/followups-due-today",
  },
  {
    key: "doctorReviewPending",
    apiId: "doctor_review_pending",
    label: "Doctor review pending",
    icon: "fa fa-stethoscope",
    color: "#0ba6df",
    fill: "#85B7EB",
    defaultEndpoint: "dashboard/doctor-review-pending",
  },
  {
    key: "missingDocuments",
    apiId: "missing_documents",
    label: "Missing documents",
    icon: "fa fa-file-excel-o",
    color: "#0ba6df",
    fill: "#AFA9EC",
    defaultEndpoint: "dashboard/missing-documents",
  },
  {
    key: "noStaffAssigned",
    apiId: "no_staff_assigned",
    label: "No staff assigned",
    icon: "fa fa-user-times",
    color: "#0ba6df",
    fill: "#B4B2A9",
    defaultEndpoint: "dashboard/patient-aging",
  },
];

const IMMEDIATE_ATTENTION_META = {
  treatmentPlanOverdue: {
    urgency: "critical",
    urgencyLabel: "Critical",
    waiting: "26 – 48 hrs",
  },
  notContactedToday: {
    urgency: "high",
    urgencyLabel: "High Priority",
    waiting: "Since 9:00 AM",
  },
  overdueFollowUps: {
    urgency: "high",
    urgencyLabel: "High Priority",
    waiting: "1 – 5 days",
  },
  doctorReviewPending: {
    urgency: "warning",
    urgencyLabel: "Warning",
    waiting: "6 – 18 hrs",
  },
  missingDocuments: {
    urgency: "warning",
    urgencyLabel: "Warning",
    waiting: "12 – 40 hrs",
  },
  noStaffAssigned: {
    urgency: "normal",
    urgencyLabel: "Normal",
    waiting: "Since registration",
  },
};

const DEPARTMENT_CONFIG = [
  {
    key: "callCenter",
    apiId: "call_center",
    name: "Call Center",
    icon: "fa fa-phone",
    accent: "msd-dept-blue",
    defaultStats: [
      { label: "New Enquiries", key: "newEnquiries" },
      { label: "Contacted", key: "contacted" },
      { label: "Pending Contact", key: "pendingContact" },
    ],
  },
  {
    key: "medicalTeam",
    apiId: "medical_team",
    name: "Medical Team",
    icon: "fa fa-user-md",
    accent: "msd-dept-teal",
    defaultStats: [
      { label: "Waiting for Documents", key: "waitingForDocuments" },
      { label: "Cases Under Review", key: "casesUnderReview" },
      { label: "Treatment Plans Pending", key: "treatmentPlansPending" },
    ],
  },
  {
    key: "doctors",
    apiId: "doctors",
    name: "Doctors",
    icon: "fa fa-stethoscope",
    accent: "msd-dept-purple",
    defaultStats: [
      { label: "Cases Assigned", key: "casesAssigned" },
      { label: "Reviews Completed", key: "reviewsCompleted" },
      { label: "Reviews Pending", key: "reviewsPending" },
    ],
  },
  {
    key: "operations",
    apiId: "operations",
    name: "Operations",
    icon: "fa fa-plane",
    accent: "msd-dept-green",
    defaultStats: [
      { label: "Visa Pending", key: "visaPending" },
      { label: "Flights Pending", key: "flightsPending" },
      { label: "Travel This Week", key: "travelThisWeek" },
    ],
  },
];

const TODAYS_WORK_TARGETS = {
  newEnquiriesToday: 20,
  patientsContactedToday: 25,
  treatmentPlansIssuedToday: 10,
  appointmentsScheduledToday: 12,
  patientsTravellingToday: 6,
  followUpsDueToday: 15,
};

const mergeAttentionItems = (apiItems = [], liveCounts = {}) => {
  const byId = Object.fromEntries(
    (apiItems || []).map((item) => [item.id || item.apiId || item.key, item]),
  );
  return ATTENTION_ITEMS.map((item) => {
    const api = byId[item.apiId] || byId[item.key] || {};
    const meta = IMMEDIATE_ATTENTION_META[item.key] || {};
    const count =
      api?.count != null && api.count > 0
        ? api.count
        : (liveCounts[item.key] ??
          liveCounts[item.apiId] ??
          (item.key === "treatmentPlanOverdue"
            ? liveCounts.treatmentPlansPending
            : null) ??
          (item.key === "overdueFollowUps"
            ? liveCounts.followUpsDue || liveCounts.overdueCases
            : null) ??
          (item.key === "doctorReviewPending"
            ? liveCounts.doctorReviewsPending
            : null) ??
          (item.key === "missingDocuments"
            ? liveCounts.missingDocuments
            : null) ??
          (item.key === "notContactedToday"
            ? liveCounts.newEnquiries
            : null) ??
          (item.key === "noStaffAssigned"
            ? liveCounts.noStaffAssigned
            : null) ??
          api?.count ??
          0);

    return {
      ...item,
      count: Number(count) || 0,
      timeRange: formatWaitingDuration(api?.timeRange || meta.waiting),
      urgency: meta.urgency,
      urgencyLabel: api?.priority || meta.urgencyLabel,
      viewCasesEndpoint: api?.viewCasesEndpoint || item.defaultEndpoint,
    };
  });
};

const mergeDepartmentItems = (apiItems = []) => {
  const byId = Object.fromEntries((apiItems || []).map((item) => [item.id, item]));
  return DEPARTMENT_CONFIG.map((dept) => {
    const api = byId[dept.apiId];
    const metrics = api?.metrics || [];
    const stats = dept.defaultStats.map((stat) => {
      const metric = metrics.find((m) => m.key === stat.key);
      return {
        label: metric?.label || stat.label,
        value: metric?.value ?? 0,
      };
    });
    const total = stats.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    const completed = stats[1]?.value ?? 0;
    return {
      ...dept,
      name: api?.title || dept.name,
      stats,
      completed: Number(completed) || 0,
      total: Number(total) || 1,
    };
  });
};

function buildSparklinePath(trend = [4, 6, 3, 7, 5, 8, 6]) {
  const width = 160;
  const height = 40;
  const points = trend.length > 1 ? trend : [4, 6, 3, 7, 5, 8, 6];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((val, i) => {
    const x = i * step;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  let line = `M${coords[0][0]},${coords[0][1]}`;
  for (let i = 1; i < coords.length; i++) {
    line += ` L${coords[i][0]},${coords[i][1]}`;
  }
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

function DashboardCards({
  items = [],
  counts = {},
  onCardClick = () => { },
  period = "Today",
}) {
  return (
    <div className="row gx-2 gy-2">
      {items.map((item) => {
        const { line, area } = buildSparklinePath(item.staticTrend);

        return (
          <div key={item.key} className="col-md-4">
            <div
              className="attention-card"
              onClick={() => onCardClick(item.key)}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onCardClick(item.key);
              }}
            >
              <div className="attention-card-top">
                <div className="attention-icon">
                  <i className={item.icon}></i>
                </div>
                <div className="text-end attention-card-meta">
                  <span className="attention-label">{item.label}</span>
                  <h3 className="attention-count">
                    <CountUp
                      start={0}
                      end={Number(counts[item.key]) || 0}
                      duration={2}
                    />
                  </h3>
                </div>
              </div>
              <svg
                className="attention-sparkline"
                viewBox="0 0 160 40"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={area} className="attention-sparkline-fill" />
                <path d={line} className="attention-sparkline-line" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const emptyDashboard = {
  dailySummary: {},
  todayPriorities: {},
  todayWork: {},
  immediateAttention: [],
  actionRequired: [],
  recentActivity: [],
  departmentPerformance: [],
  popupAlerts: [],
  patientAging: { total: 0, legend: {}, patients: [] },
  arrivingTodayCount: 0,
  departingTodayCount: 0,
  preponedTodayCount: 0,
  postponedTodayCount: 0,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const usrFount = localStorage.getItem("Role");
  const userRole = (localStorage.getItem("Role") || "").toUpperCase();
  const roleLower = (localStorage.getItem("Role") || "").trim().toLowerCase();
  const isAdmin = userRole === "ADMIN" || roleLower === "admin";
  const isPickDropUser = !isAdmin && Boolean(
    isPickDropStaffUser() ||
    isDriverUser() ||
    roleLower.includes("pick") ||
    roleLower.includes("drop") ||
    roleLower.includes("driver") ||
    roleLower.includes("transport")
  );
  const isReferralUser = userRole === "REFERRAL";
  const referralId = isReferralUser ? (localStorage.getItem("referral_id") || "") : "";
  const isInsuranceUser = userRole === "INSURANCE";
  const insuranceId = isInsuranceUser ? (localStorage.getItem("insurance_id") || "") : "";

  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw
    .split(",")
    .map((p) => p.trim());
  const hasDashboardAccess =
    userRole === "ADMIN" ||
    isReferralUser ||
    isInsuranceUser ||
    permissionsList.includes("/Dashboard") ||
    permissionsList.includes("Dashboard");

  useEffect(() => {
    if (isSocialMediaRole(userRole) && !hasDashboardAccess) {
      navigate("/Admin/inquiry", { replace: true });
    }
  }, [userRole, hasDashboardAccess, navigate]);

  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [caseModal, setCaseModal] = useState({ open: false, title: "", endpoint: "" });
  const [patientAgingData, setPatientAgingData] = useState([]);
  const [agingLoading, setAgingLoading] = useState(false);
  const [agingSearch, setAgingSearch] = useState("");
  const [agingStatusFilter, setAgingStatusFilter] = useState("");
  const [agingStageFilter, setAgingStageFilter] = useState("");
  const [agingPriorityFilter, setAgingPriorityFilter] = useState("");
  const [agingSortDesc, setAgingSortDesc] = useState(true);
  const [agingPage, setAgingPage] = useState(1);
  const [agingTotal, setAgingTotal] = useState(0);
  const [agingTotalPages, setAgingTotalPages] = useState(1);
  const [agingLimit, setAgingLimit] = useState(AGING_PAGE_SIZE);
  const [backendStageOptions, setBackendStageOptions] = useState([]);
  const [backendStatusOptions, setBackendStatusOptions] = useState([]);
  const [backendPriorityOptions, setBackendPriorityOptions] = useState([]);
  const [backendFilterStageOptions, setBackendFilterStageOptions] = useState([]);
  const [backendLegend, setBackendLegend] = useState(null);
  const [exportingAging, setExportingAging] = useState(false);
  const agingCacheRef = useRef({});
  const searchDebounceRef = useRef(null);
  const lastExecutedSearchRef = useRef("");
  const [notesModal, setNotesModal] = useState({
    open: false,
    patientName: "",
    patientId: "",
    notes: [],
  });
  const [noteText, setNoteText] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteError, setNoteError] = useState({ note: false, date: false });
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [updatingStageId, setUpdatingStageId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [priorityData, setPriorityData] = useState({});
  const [prioritiesLoading, setPrioritiesLoading] = useState(true);
  const [crmPermissions, setCrmPermissions] = useState(null);

  const loadCrmPermissions = useCallback(async () => {
    try {
      const res = await fetchMyCrmDashboardPermissions();
      const list = extractPermissionsList(res);
      if (list) {
        setCrmPermissions(list);
      }
    } catch (err) {
      console.error("Failed to fetch my CRM dashboard permissions:", err);
    }
  }, []);

  useEffect(() => {
    if (!isReferralUser && !isInsuranceUser) {
      loadCrmPermissions();
    }
  }, [loadCrmPermissions, isReferralUser, isInsuranceUser]);

  const loadPriorities = useCallback(async () => {
    setPrioritiesLoading(true);
    try {
      let dailySummary = await fetchDailySummary().catch(() => null);
      // Only fallback to dashboardSummary if fetchDailySummary threw an error (null), not when counts are 0
      if (dailySummary === null) {
        const dashSummary = await fetchDashboardSummary().catch(() => null);
        if (dashSummary) {
          dailySummary =
            dashSummary.dailySummary ||
            dashSummary.todayPriorities ||
            dashSummary;
        }
      }

      const counts = {
        newEnquiries: dailySummary?.newEnquiries ?? 0,
        treatmentPlansPending: dailySummary?.treatmentPlansPending ?? 0,
        followUpsDue:
          dailySummary?.followupsDueToday ??
          dailySummary?.followUpsDueToday ??
          dailySummary?.followupsDue ??
          dailySummary?.followUpsDue ??
          0,
        doctorReviewsPending: dailySummary?.doctorReviewsPending ?? 0,
        patientsTravellingToday: dailySummary?.patientsTravellingToday ?? 0,
        overdueCases: dailySummary?.overdueCases ?? 0,
        arrivingToday: dailySummary?.arrivingToday ?? 0,
        departingToday: dailySummary?.departingToday ?? 0,
        preponedToday: dailySummary?.preponedToday ?? 0,
        postponedToday: dailySummary?.postponedToday ?? 0,
      };

      setPriorityData(counts);
    } catch (err) {
      console.error("Priority data load failed:", err);
    } finally {
      setPrioritiesLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    // Invalidate aging cache on explicit full dashboard refresh
    agingCacheRef.current = {};

    setLoading(true);
    setAgingLoading(true);
    setPrioritiesLoading(true);
    try {
      // Fetch unified dashboard first — minimizes simultaneous connections
      const dashData = await fetchDashboard({ page: 1, limit: AGING_PAGE_SIZE }).catch((err) => {
        if (err?.response?.status === 429) {
          console.warn("CRM Dashboard request rate limited (429)");
        } else {
          console.error("Dashboard load failed:", err);
        }
        return {};
      });

      // Only query todayWork or dailySummary if dashData didn't already include them
      let fetchedWork = {};
      let fetchedDaily = {};
      const needWork = !dashData.todayWork || Object.keys(dashData.todayWork).length === 0;
      const needDaily = !dashData.dailySummary && !dashData.todayPriorities;

      if (needWork || needDaily) {
        const [wRes, dRes] = await Promise.allSettled([
          needWork ? fetchTodayWork().catch(() => ({})) : Promise.resolve({}),
          needDaily ? fetchDailySummary().catch(() => ({})) : Promise.resolve({}),
        ]);
        if (wRes.status === "fulfilled" && wRes.value) fetchedWork = wRes.value;
        if (dRes.status === "fulfilled" && dRes.value) fetchedDaily = dRes.value;
      }

      const data = {
        ...dashData,
        todayWork: {
          ...(typeof dashData.todayWork === "object" ? dashData.todayWork : {}),
          ...(typeof fetchedWork === "object" ? fetchedWork : {}),
        },
        dailySummary: {
          ...(typeof dashData.dailySummary === "object" ? dashData.dailySummary : {}),
          ...(typeof fetchedDaily === "object" ? fetchedDaily : {}),
        },
      };

      // Directly populate priority counts from dashData and dailySummary
      const dashDaily = data.dailySummary || data.todayPriorities || {};
      const dashPriorities = data.todayPriorities || {};
      const counts = {
        newEnquiries:
          dashPriorities.newEnquiries ??
          dashDaily.newEnquiries ??
          data.newEnquiries ??
          0,
        treatmentPlansPending:
          dashPriorities.treatmentPlansPending ??
          dashDaily.treatmentPlansPending ??
          data.treatmentPlansPending ??
          0,
        followUpsDue:
          dashPriorities.followupsDueToday ??
          dashPriorities.followUpsDueToday ??
          dashPriorities.followupsDue ??
          dashPriorities.followUpsDue ??
          dashDaily.followupsDueToday ??
          dashDaily.followUpsDueToday ??
          dashDaily.followupsDue ??
          dashDaily.followUpsDue ??
          data.followupsDueToday ??
          data.followUpsDueToday ??
          data.followupsDue ??
          0,
        doctorReviewsPending:
          dashPriorities.doctorReviewsPending ??
          dashDaily.doctorReviewsPending ??
          data.doctorReviewsPending ??
          0,
        patientsTravellingToday:
          dashPriorities.patientsTravellingToday ??
          dashDaily.patientsTravellingToday ??
          data.patientsTravellingToday ??
          0,
        overdueCases:
          dashPriorities.overdueCases ??
          dashDaily.overdueCases ??
          data.overdueCases ??
          0,
        arrivingToday:
          dashPriorities.arrivingToday ??
          data.arrivingTodayCount ??
          dashDaily.arrivingToday ??
          0,
        departingToday:
          dashPriorities.departingToday ??
          data.departingTodayCount ??
          dashDaily.departingToday ??
          0,
        preponedToday:
          dashPriorities.preponedToday ??
          data.preponedTodayCount ??
          dashDaily.preponedToday ??
          0,
        postponedToday:
          dashPriorities.postponedToday ??
          data.postponedTodayCount ??
          dashDaily.postponedToday ??
          0,
        missingDocuments: 0,
        noStaffAssigned: 0,
      };

      // Query drilldowns only if missing from dashData
      const secondaryPromises = [];
      let activityLogsPayload = null;

      if (!counts.followUpsDue) {
        secondaryPromises.push(
          fetchCaseList("dashboard/followups-due-today", { page: 1, limit: 1 })
            .then((res) => {
              const total = res?.total ?? res?.count;
              if (total != null && Number.isFinite(Number(total))) counts.followUpsDue = Number(total);
            })
            .catch(() => {})
        );
      }
      if (!counts.missingDocuments) {
        secondaryPromises.push(
          fetchCaseList("dashboard/missing-documents", { page: 1, limit: 1 })
            .then((res) => {
              const total = res?.total ?? res?.count;
              if (total != null && Number.isFinite(Number(total))) counts.missingDocuments = Number(total);
            })
            .catch(() => {})
        );
      }
      if (!counts.overdueCases) {
        secondaryPromises.push(
          fetchCaseList("dashboard/overdue-cases", { page: 1, limit: 1 })
            .then((res) => {
              const total = res?.total ?? res?.count;
              if (total != null && Number.isFinite(Number(total))) counts.overdueCases = Number(total);
            })
            .catch(() => {})
        );
      }
      if (!Array.isArray(dashData.recentActivity) || dashData.recentActivity.length === 0) {
        secondaryPromises.push(
          axios
            .get(`${baseurl}get_activity_logs?page=1&limit=8`, { headers: authHeaders() })
            .then((res) => {
              activityLogsPayload = res?.data;
            })
            .catch(() => {})
        );
      }

      if (secondaryPromises.length > 0) {
        await Promise.allSettled(secondaryPromises);
      }

      const rawAging = data?.patientAging || {};
      const rawPatients = Array.isArray(rawAging)
        ? rawAging
        : rawAging.patients || rawAging.data || [];
      const agingPatients = rawPatients.filter((r) =>
        shouldShowInAgingMonitor(r, ""),
      );
      const normalizedAging = agingPatients.map(normalizeAgingRow);

      // Only populate aging rows from full dashboard if user has no active search/filter on aging monitor
      if (!agingSearch && !agingStageFilter && !agingStatusFilter && !agingPriorityFilter) {
        setPatientAgingData(normalizedAging);
      }

      const unassignedCount = agingPatients.filter(
        (p) =>
          !p.coordinator &&
          !p.assignedCoordinator &&
          !p.coordinatorName &&
          !p.raw?.assignedCoordinator &&
          !p.raw?.coordinator,
      ).length;
      counts.noStaffAssigned = unassignedCount;

      setPriorityData(counts);
      setPrioritiesLoading(false);

      // Process live recent activities from activity logs
      let mappedActivities = [];
      if (activityLogsPayload) {
        const rawLogs = extractActivityLogs(activityLogsPayload) || [];
        mappedActivities = rawLogs.map((log) => {
          const user = getActivityLogUser(log);
          const role = getActivityLogRole(log);
          const desc = getActivityLogDescription(log);
          const act = getActivityLogAction(log);
          const mod = getActivityLogModule(log);
          const date = getActivityLogDate(log);
          const entityName = getActivityLogEntityName(log);
          const id = getActivityLogId(log);

          let icon = "clock";
          const m = String(mod || "").toLowerCase();
          const a = String(act || "").toLowerCase();
          if (m.includes("doctor") || m.includes("review") || m.includes("test")) {
            icon = "user-md";
          } else if (m.includes("treatment")) {
            icon = "file-text";
          } else if (
            m.includes("enquiry") ||
            m.includes("contact") ||
            m.includes("message")
          ) {
            icon = "phone";
          } else if (m.includes("travel") || m.includes("flight")) {
            icon = "plane";
          } else if (m.includes("appointment")) {
            icon = "calendar";
          } else if (a.includes("update") || a.includes("status")) {
            icon = "check";
          }

          const patient = entityName && entityName !== "-" ? entityName : "";
          const activityText =
            desc && desc !== "-" ? desc : `${act} in ${mod}`;

          return {
            id: id || `${date}-${user}`,
            patientName: patient,
            patient: patient,
            activity: activityText,
            action: act,
            staffName: user && user !== "-" ? user : "Staff",
            staffLabel: role && role !== "-" ? `${user} (${role})` : user,
            staff: user,
            icon,
            performedAt: date,
            time: formatRecentActivityTime({ performedAt: date }),
          };
        });
      }

      setDashboard((prev) => ({
        ...emptyDashboard,
        ...prev,
        ...data,
        immediateAttention:
          Array.isArray(data.immediateAttention) &&
          data.immediateAttention.length > 0
            ? data.immediateAttention
            : Array.isArray(data.immediate_attention) &&
              data.immediate_attention.length > 0
            ? data.immediate_attention
            : prev.immediateAttention,
        actionRequired:
          Array.isArray(data.actionRequired) && data.actionRequired.length > 0
            ? data.actionRequired
            : Array.isArray(data.action_required) &&
              data.action_required.length > 0
            ? data.action_required
            : prev.actionRequired,
        recentActivity:
          Array.isArray(data.recentActivity) && data.recentActivity.length > 0
            ? data.recentActivity
            : Array.isArray(data.recent_activity) &&
              data.recent_activity.length > 0
            ? data.recent_activity
            : mappedActivities.length > 0
            ? mappedActivities
            : prev.recentActivity,
        missingDocumentsCount: counts.missingDocuments,
        noStaffAssignedCount: counts.noStaffAssigned,
      }));

      const totalCount = Number(rawAging.total) ?? agingPatients.length;
      const limitVal = Number(rawAging.limit) || AGING_PAGE_SIZE;
      const totalPagesVal =
        Number(rawAging.totalPages) ||
        Math.max(1, Math.ceil(totalCount / limitVal));
      const pageVal = Number(rawAging.page) || 1;

      setAgingTotal(totalCount);
      setAgingTotalPages(totalPagesVal);
      setAgingLimit(limitVal);
      setAgingPage(pageVal);

      if (Array.isArray(rawAging.statusOptions) && rawAging.statusOptions.length) {
        setBackendStatusOptions(rawAging.statusOptions);
      }
      if (Array.isArray(rawAging.priorityOptions) && rawAging.priorityOptions.length) {
        setBackendPriorityOptions(rawAging.priorityOptions);
      }
      if (Array.isArray(rawAging.filterStageOptions) && rawAging.filterStageOptions.length) {
        setBackendFilterStageOptions(rawAging.filterStageOptions);
      }
      if (rawAging.legend) {
        setBackendLegend(rawAging.legend);
      }

      const stageOpts =
        Array.isArray(rawAging.stageOptions) && rawAging.stageOptions.length
          ? rawAging.stageOptions
          : Array.isArray(rawAging.filterStageOptions) &&
            rawAging.filterStageOptions.length
          ? rawAging.filterStageOptions
          : [];
      if (stageOpts.length) {
        setBackendStageOptions(stageOpts);
      }

      // Store initial page 1 in cache
      const cacheKey = `_____longest_waiting_${pageVal}_${limitVal}`;
      agingCacheRef.current[cacheKey] = {
        rows: normalizedAging,
        total: totalCount,
        totalPages: totalPagesVal,
        limit: limitVal,
        stageOptions: stageOpts,
        statusOptions: rawAging.statusOptions,
        priorityOptions: rawAging.priorityOptions,
        filterStageOptions: rawAging.filterStageOptions,
        legend: rawAging.legend,
      };

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
      setAgingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReferralUser && !isInsuranceUser) {
      loadDashboard();
    }
  }, [loadDashboard, isReferralUser, isInsuranceUser]);

  const loadPatientAgingPage = useCallback(
    async (
      pageToLoad = 1,
      stageToFilter = agingStageFilter,
      limitToUse = agingLimit,
      statusToFilter = agingStatusFilter,
      priorityToFilter = agingPriorityFilter,
      searchToUse = agingSearch,
      sortDescToUse = agingSortDesc,
    ) => {
      const currentLimit = limitToUse || AGING_PAGE_SIZE;
      const sortBy = sortDescToUse ? "longest_waiting" : "shortest_waiting";
      const cleanSearch = (searchToUse || "").trim();
      const cleanStage = stageToFilter || "";
      const cleanStatus = statusToFilter || "";
      const cleanPriority = priorityToFilter || "";

      const cacheKey = `${cleanSearch}_${cleanStatus}_${cleanStage}_${cleanPriority}_${sortBy}_${pageToLoad}_${currentLimit}`;
      if (agingCacheRef.current[cacheKey]) {
        // Instant response from in-memory cache — zero network delay
        const cached = agingCacheRef.current[cacheKey];
        setPatientAgingData(cached.rows);
        setAgingTotal(cached.total);
        setAgingTotalPages(cached.totalPages);
        setAgingPage(pageToLoad);
        if (cached.stageOptions?.length) setBackendStageOptions(cached.stageOptions);
        if (cached.statusOptions?.length) setBackendStatusOptions(cached.statusOptions);
        if (cached.priorityOptions?.length) setBackendPriorityOptions(cached.priorityOptions);
        if (cached.filterStageOptions?.length) setBackendFilterStageOptions(cached.filterStageOptions);
        if (cached.legend) setBackendLegend(cached.legend);
        return;
      }

      setAgingLoading(true);
      try {
        const res = await fetchPatientAging({
          page: pageToLoad,
          limit: currentLimit,
          stage: cleanStage || undefined,
          status: cleanStatus || undefined,
          priority: cleanPriority || undefined,
          search: cleanSearch || undefined,
          sortBy,
        });

        const rawAging =
          res?.data && typeof res.data === "object" && !Array.isArray(res.data)
            ? { ...res, ...res.data }
            : res || {};
        const rawPatients = Array.isArray(rawAging)
          ? rawAging
          : rawAging.patients || rawAging.data || [];
        const agingPatients = rawPatients.filter((r) =>
          shouldShowInAgingMonitor(r, cleanStatus),
        );
        const normalizedAging = agingPatients.map(normalizeAgingRow);
        setPatientAgingData(normalizedAging);

        const totalCount =
          Number(rawAging.total) ??
          Number(res?.total) ??
          agingPatients.length;
        const totalPagesVal =
          Number(rawAging.totalPages) ??
          Number(res?.totalPages) ??
          Math.max(1, Math.ceil(totalCount / currentLimit));

        setAgingTotal(totalCount);
        setAgingTotalPages(totalPagesVal);
        setAgingPage(Number(rawAging.page) || Number(res?.page) || pageToLoad);

        if (Array.isArray(rawAging.statusOptions) && rawAging.statusOptions.length) {
          setBackendStatusOptions(rawAging.statusOptions);
        }
        if (Array.isArray(rawAging.priorityOptions) && rawAging.priorityOptions.length) {
          setBackendPriorityOptions(rawAging.priorityOptions);
        }
        if (Array.isArray(rawAging.filterStageOptions) && rawAging.filterStageOptions.length) {
          setBackendFilterStageOptions(rawAging.filterStageOptions);
        }
        if (rawAging.legend) {
          setBackendLegend(rawAging.legend);
        }

        const stageOpts =
          Array.isArray(rawAging.stageOptions) && rawAging.stageOptions.length
            ? rawAging.stageOptions
            : Array.isArray(rawAging.filterStageOptions) &&
              rawAging.filterStageOptions.length
            ? rawAging.filterStageOptions
            : [];
        if (stageOpts.length) {
          setBackendStageOptions(stageOpts);
        }

        agingCacheRef.current[cacheKey] = {
          rows: normalizedAging,
          total: totalCount,
          totalPages: totalPagesVal,
          limit: currentLimit,
          stageOptions: stageOpts,
          statusOptions: rawAging.statusOptions,
          priorityOptions: rawAging.priorityOptions,
          filterStageOptions: rawAging.filterStageOptions,
          legend: rawAging.legend,
        };
      } catch (err) {
        console.error("Failed to load patient aging page:", err);
      } finally {
        setAgingLoading(false);
      }
    },
    [agingLimit, agingStageFilter, agingStatusFilter, agingPriorityFilter, agingSearch, agingSortDesc],
  );

  const handleStageFilterChange = (newStage) => {
    setAgingStageFilter(newStage);
    setAgingPage(1);
    loadPatientAgingPage(
      1,
      newStage,
      agingLimit,
      agingStatusFilter,
      agingPriorityFilter,
      agingSearch,
      agingSortDesc,
    );
  };

  const handleStatusFilterChange = (newStatus) => {
    setAgingStatusFilter(newStatus);
    setAgingPage(1);
    loadPatientAgingPage(
      1,
      agingStageFilter,
      agingLimit,
      newStatus,
      agingPriorityFilter,
      agingSearch,
      agingSortDesc,
    );
  };

  const handlePriorityFilterChange = (newPriority) => {
    setAgingPriorityFilter(newPriority);
    setAgingPage(1);
    loadPatientAgingPage(
      1,
      agingStageFilter,
      agingLimit,
      agingStatusFilter,
      newPriority,
      agingSearch,
      agingSortDesc,
    );
  };

  const handleToggleSort = () => {
    const nextSort = !agingSortDesc;
    setAgingSortDesc(nextSort);
    setAgingPage(1);
    loadPatientAgingPage(
      1,
      agingStageFilter,
      agingLimit,
      agingStatusFilter,
      agingPriorityFilter,
      agingSearch,
      nextSort,
    );
  };

  const handleLimitChange = (newLimit) => {
    const limitNum = Number(newLimit) || AGING_PAGE_SIZE;
    setAgingLimit(limitNum);
    agingCacheRef.current = {};
    setAgingPage(1);
    loadPatientAgingPage(
      1,
      agingStageFilter,
      limitNum,
      agingStatusFilter,
      agingPriorityFilter,
      agingSearch,
      agingSortDesc,
    );
  };

  useEffect(() => {
    // Only debounce if agingSearch actually changed from the last executed query
    if (agingSearch === lastExecutedSearchRef.current) {
      return;
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      lastExecutedSearchRef.current = agingSearch;
      setAgingPage(1);
      loadPatientAgingPage(
        1,
        agingStageFilter,
        agingLimit,
        agingStatusFilter,
        agingPriorityFilter,
        agingSearch,
        agingSortDesc,
      );
    }, 450);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [agingSearch]);

  const openCaseList = (title, endpoint) => {
    if (!endpoint) return;
    setCaseModal({ open: true, title, endpoint });
  };

  const handlePriorityClick = (key) => {
    const endpointKey = key === "followUpsDue" ? "followupsDue" : key;
    let endpoint = PRIORITY_ENDPOINTS[endpointKey] || PRIORITY_ENDPOINTS[key];
    if (key === "treatmentPlansPending") {
      endpoint = "dashboard/treatment-plan-pending?today=true";
    } else if (key === "doctorReviewsPending") {
      endpoint = "dashboard/doctor-review-pending?today=true";
    } else if (key === "followUpsDue" || key === "followupsDue") {
      endpoint = "dashboard/followups-due-today";
    }
    openCaseList(
      PRIORITY_ITEMS.find((i) => i.key === key)?.label || "Cases",
      endpoint,
    );
  };

  const handleTodaysWorkClick = (key) => {
    openCaseList(
      TODAYS_WORK_ITEMS.find((i) => i.key === key)?.label || "Cases",
      TODAY_WORK_ENDPOINTS[key],
    );
  };

  const handleAttentionClick = (item) => {
    openCaseList(item.label, item.viewCasesEndpoint);
  };

  const openAgingNotes = (patient) => {
    const notes = Array.isArray(patient?.raw?.discussionNotes)
      ? patient.raw.discussionNotes
      : Array.isArray(patient?.discussionNotes)
        ? patient.discussionNotes
        : [];
    setNoteText("");
    setNoteDate(new Date().toISOString().slice(0, 10));
    setNoteError({ note: false, date: false });
    setNotesModal({
      open: true,
      patientName: patient?.name || "Patient",
      patientId: patient?.patientId || "",
      notes,
    });
  };

  const closeAgingNotes = () => {
    setNotesModal({
      open: false,
      patientName: "",
      patientId: "",
      notes: [],
    });
    setNoteText("");
    setNoteDate("");
    setNoteError({ note: false, date: false });
    setNoteSubmitting(false);
  };

  const handleSubmitAgingNote = async (e) => {
    e.preventDefault();
    const nextError = {
      note: !noteText.trim(),
      date: !noteDate,
    };
    setNoteError(nextError);
    if (nextError.note || nextError.date) return;

    const patientId = notesModal.patientId;
    if (!patientId) {
      toast.error("Patient ID missing — cannot add note");
      return;
    }

    setNoteSubmitting(true);
    try {
      await addPatientNotes(patientId, {
        note: noteText.trim(),
        date: noteDate,
      });
      const addedByName = localStorage.getItem("name") || "";
      const addedByRole = localStorage.getItem("Role") || "";
      const addedBy = addedByName && addedByRole ? `${addedByName} (${addedByRole})` : addedByName || addedByRole || "";
      const newNote = {
        note: noteText.trim(),
        date: noteDate,
        addedBy,
      };
      setNotesModal((prev) => ({
        ...prev,
        notes: [newNote, ...(Array.isArray(prev.notes) ? prev.notes : [])],
      }));
      setPatientAgingData((prev) =>
        prev.map((row) => {
          if (row.patientId !== patientId) return row;
          const existing = Array.isArray(row.raw?.discussionNotes)
            ? row.raw.discussionNotes
            : [];
          return {
            ...row,
            raw: {
              ...row.raw,
              discussionNotes: [newNote, ...existing],
            },
          };
        }),
      );
      setNoteText("");
      setNoteDate(new Date().toISOString().slice(0, 10));
      setNoteError({ note: false, date: false });
      agingCacheRef.current = {};
      toast.success("Note added successfully");
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to add note. Please try again!";
      toast.error(message);
    } finally {
      setNoteSubmitting(false);
    }
  };

  const [travelStatusModal, setTravelStatusModal] = useState({
    open: false,
    patientId: "",
    patientName: "",
    status: "",
  });
  const [travelStatusSubmitting, setTravelStatusSubmitting] = useState(false);

  const handleAgingStatusChange = async (patient, nextStatus) => {
    const statusValue = normalizePatientStatus(nextStatus);
    const current = normalizePatientStatus(patient?.status);
    if (!statusValue || statusValue === current) return;

    const patientId = patient?.patientId;
    if (!patientId) {
      toast.error("Patient ID missing — cannot update status");
      return;
    }

    if (isTravelStatus(statusValue)) {
      setTravelStatusModal({
        open: true,
        patientId,
        patientName: patient?.name || patient?.patient_name || "",
        status: statusValue,
      });
      return;
    }

    setUpdatingStatusId(patientId);
    try {
      const savedRaw = await changePatientStatus(patientId, statusValue);
      const savedStatus = normalizePatientStatus(savedRaw || statusValue);

      if (!shouldShowInAgingMonitor({ p_status: savedStatus })) {
        setPatientAgingData((prev) =>
          prev.filter((row) => row.patientId !== patientId),
        );
      } else {
        setPatientAgingData((prev) =>
          prev.map((row) => {
            if (row.patientId !== patientId) return row;
            return {
              ...row,
              status: savedStatus,
              raw: {
                ...row.raw,
                p_status: savedStatus,
              },
            };
          }),
        );
      }

      agingCacheRef.current = {};
      Swal.fire(
        "Success!",
        "Patient status updated successfully!",
        "success",
      );
    } catch (err) {
      console.error("Status update failed:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update status. Please try again!";
      toast.error(message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleCloseTravelStatusModal = () => {
    if (travelStatusSubmitting) return;
    setTravelStatusModal({
      open: false,
      patientId: "",
      patientName: "",
      status: "",
    });
  };

  const handleSubmitTravelStatus = async (payload) => {
    const patientId = travelStatusModal.patientId;
    if (!patientId) return;
    setTravelStatusSubmitting(true);
    try {
      const savedRaw = await changePatientStatus(patientId, payload);
      const savedStatus = normalizePatientStatus(savedRaw || payload.p_status);

      if (!shouldShowInAgingMonitor({ p_status: savedStatus })) {
        setPatientAgingData((prev) =>
          prev.filter((row) => row.patientId !== patientId),
        );
      } else {
        setPatientAgingData((prev) =>
          prev.map((row) => {
            if (row.patientId !== patientId) return row;
            return {
              ...row,
              status: savedStatus,
              raw: {
                ...row.raw,
                p_status: savedStatus,
              },
            };
          }),
        );
      }

      setTravelStatusModal({
        open: false,
        patientId: "",
        patientName: "",
        status: "",
      });
      agingCacheRef.current = {};
      Swal.fire(
        "Success!",
        "Patient status updated successfully!",
        "success",
      );
    } catch (err) {
      console.error("Travel status update failed:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update travel status";
      toast.error(message);
    } finally {
      setTravelStatusSubmitting(false);
    }
  };

  const handleAgingStageChange = async (patient, nextStage) => {
    const stageLabel = normalizeAgingStage(nextStage);
    const current = normalizeAgingStage(patient?.stage);
    if (!stageLabel || stageLabel === current) return;

    const patientId = patient?.patientId;
    if (!patientId) {
      toast.error("Patient ID missing — cannot update stage");
      return;
    }

    const rowKey = patientId || patient?.id;
    setUpdatingStageId(rowKey);
    try {
      await updatePatientAgingStage(patientId, stageLabel);
      setPatientAgingData((prev) =>
        prev.map((row) => {
          if ((row.patientId || row.id) !== rowKey) return row;
          return {
            ...row,
            stage: stageLabel,
            raw: {
              ...row.raw,
              stageLabel,
            },
          };
        }),
      );
      agingCacheRef.current = {};
      Swal.fire("Success!", "Patient stage updated successfully!", "success");
      loadPatientAgingPage(
        agingPage,
        agingStageFilter,
        agingLimit,
        agingStatusFilter,
        agingPriorityFilter,
        agingSearch,
        agingSortDesc,
      );
    } catch (err) {
      console.error("Stage update failed:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update stage. Please try again!";
      toast.error(message);
    } finally {
      setUpdatingStageId(null);
    }
  };

  const formatNoteDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleDepartmentClick = (key) => {
    switch (key) {
      case "callCenter":
        navigate("/Admin/inquiry");
        break;
      case "medicalTeam":
      case "doctors":
      case "operations":
        navigate("/Admin/patients");
        break;
      default:
        break;
    }
  };

  const { dailySummary, todayPriorities, todayWork } = dashboard;

  const summaryCounts = {
    newEnquiries: dailySummary?.newEnquiries ?? 0,
    treatmentPlansPending: dailySummary?.treatmentPlansPending ?? 0,
    followupsDue: dailySummary?.followupsDue ?? 0,
    doctorReviewsPending: dailySummary?.doctorReviewsPending ?? 0,
    patientsTravellingToday: dailySummary?.patientsTravellingToday ?? 0,
    overdueCases: dailySummary?.overdueCases ?? 0,
  };

  const priorityCounts = useMemo(
    () => ({
      newEnquiries:
        priorityData.newEnquiries ??
        todayPriorities?.newEnquiries ??
        dailySummary?.newEnquiries ??
        0,
      treatmentPlansPending:
        priorityData.treatmentPlansPending ??
        todayPriorities?.treatmentPlansPending ??
        dailySummary?.treatmentPlansPending ??
        0,
      followUpsDue:
        priorityData.followUpsDue ??
        todayPriorities?.followupsDue ??
        dailySummary?.followupsDue ??
        0,
      doctorReviewsPending:
        priorityData.doctorReviewsPending ??
        todayPriorities?.doctorReviewsPending ??
        dailySummary?.doctorReviewsPending ??
        0,
      patientsTravellingToday:
        priorityData.patientsTravellingToday ??
        todayPriorities?.patientsTravellingToday ??
        dailySummary?.patientsTravellingToday ??
        0,
      overdueCases:
        priorityData.overdueCases ??
        todayPriorities?.overdueCases ??
        dailySummary?.overdueCases ??
        0,
      arrivingToday:
        priorityData.arrivingToday ??
        dashboard.arrivingTodayCount ??
        todayPriorities?.arrivingToday ??
        dailySummary?.arrivingToday ??
        0,
      departingToday:
        priorityData.departingToday ??
        dashboard.departingTodayCount ??
        todayPriorities?.departingToday ??
        dailySummary?.departingToday ??
        0,
      preponedToday:
        priorityData.preponedToday ??
        dashboard.preponedTodayCount ??
        todayPriorities?.preponedToday ??
        dailySummary?.preponedToday ??
        0,
      postponedToday:
        priorityData.postponedToday ??
        dashboard.postponedTodayCount ??
        todayPriorities?.postponedToday ??
        dailySummary?.postponedToday ??
        0,
      missingDocuments:
        priorityData.missingDocuments ?? dashboard.missingDocumentsCount ?? 0,
      noStaffAssigned:
        priorityData.noStaffAssigned ?? dashboard.noStaffAssignedCount ?? 0,
    }),
    [
      priorityData,
      todayPriorities,
      dailySummary,
      dashboard.arrivingTodayCount,
      dashboard.departingTodayCount,
      dashboard.preponedTodayCount,
      dashboard.postponedTodayCount,
      dashboard.missingDocumentsCount,
      dashboard.noStaffAssignedCount,
    ],
  );

  const attentionItems = useMemo(
    () => mergeAttentionItems(dashboard.immediateAttention, priorityCounts),
    [dashboard.immediateAttention, priorityCounts],
  );
  const actionRequiredItems = useMemo(
    () => mergeActionRequiredItems(dashboard.actionRequired, priorityCounts),
    [dashboard.actionRequired, priorityCounts],
  );
  const departmentItems = useMemo(
    () => mergeDepartmentItems(dashboard.departmentPerformance),
    [dashboard.departmentPerformance],
  );

  // 1. Item-level filtering for Today's Priority
  const filteredPriorityItems = useMemo(() => {
    let items = PRIORITY_ITEMS.filter((item) =>
      isCrmDashboardItemAllowed(
        crmPermissions,
        null,
        "Today's Priority",
        item.label,
      ),
    );
    if (isPickDropUser) {
      items = items.filter((item) => {
        const key = String(item.key || "").toLowerCase();
        const lbl = String(item.label || "").toLowerCase();
        if (
          key.includes("enquiry") ||
          key.includes("treatment") ||
          key.includes("doctor") ||
          key.includes("follow") ||
          key.includes("overdue") ||
          lbl.includes("enquir") ||
          lbl.includes("treatment") ||
          lbl.includes("doctor") ||
          lbl.includes("follow") ||
          lbl.includes("overdue")
        ) {
          return false;
        }
        return (
          key.includes("travel") ||
          key.includes("arriving") ||
          key.includes("departing") ||
          key.includes("flight") ||
          key.includes("pick") ||
          key.includes("drop") ||
          key.includes("appointment") ||
          lbl.includes("travell") ||
          lbl.includes("arriving") ||
          lbl.includes("departing") ||
          lbl.includes("flight") ||
          lbl.includes("pick") ||
          lbl.includes("drop") ||
          lbl.includes("appointment")
        );
      });
    }
    return items;
  }, [crmPermissions, isPickDropUser]);

  const showTodaysPrioritySection = filteredPriorityItems.length > 0;

  // 2. Item-level filtering for Today's Work
  const filteredTodaysWorkItems = useMemo(() => {
    let items = TODAYS_WORK_ITEMS.filter((item) =>
      isCrmDashboardItemAllowed(
        crmPermissions,
        null,
        "Today's Work",
        item.label,
      ),
    );
    if (isPickDropUser) {
      items = items.filter((item) => {
        const key = String(item.key || "").toLowerCase();
        const lbl = String(item.label || "").toLowerCase();
        if (
          key.includes("enquiry") ||
          key.includes("treatment") ||
          key.includes("contact") ||
          key.includes("follow") ||
          lbl.includes("enquir") ||
          lbl.includes("treatment") ||
          lbl.includes("contact") ||
          lbl.includes("follow")
        ) {
          return false;
        }
        return (
          key.includes("appointment") ||
          key.includes("travel") ||
          key.includes("flight") ||
          key.includes("pick") ||
          key.includes("drop") ||
          lbl.includes("appointment") ||
          lbl.includes("travell") ||
          lbl.includes("flight") ||
          lbl.includes("pick") ||
          lbl.includes("drop")
        );
      });
    }
    return items;
  }, [crmPermissions, isPickDropUser]);

  const showTodaysWorkSection = filteredTodaysWorkItems.length > 0;

  // 3. Item-level filtering for Immediate Attention
  const filteredAttentionItems = useMemo(() => {
    if (isPickDropUser) return [];
    return attentionItems.filter((item) =>
      isCrmDashboardItemAllowed(
        crmPermissions,
        null,
        "Immediate Attentions",
        item.label,
      ),
    );
  }, [attentionItems, crmPermissions, isPickDropUser]);

  const showImmediateAttentionSection = !isPickDropUser && filteredAttentionItems.length > 0;

  // 4. Item-level filtering for Action Required
  const filteredActionRequiredItems = useMemo(() => {
    let items = actionRequiredItems.filter((item) =>
      isCrmDashboardItemAllowed(
        crmPermissions,
        null,
        "Action required",
        item.label,
      ),
    );
    if (isPickDropUser) {
      items = items.filter((item) => {
        const lbl = String(item.label || "").toLowerCase();
        const key = String(item.key || item.apiId || "").toLowerCase();
        if (
          lbl.includes("treatment") ||
          lbl.includes("enquiry") ||
          lbl.includes("doctor") ||
          lbl.includes("medical") ||
          lbl.includes("follow") ||
          lbl.includes("on hold") ||
          key.includes("treatment") ||
          key.includes("enquiry") ||
          key.includes("doctor") ||
          key.includes("medical") ||
          key.includes("follow") ||
          key.includes("on_hold")
        ) {
          return false;
        }
        return (
          lbl.includes("appointment") ||
          lbl.includes("travel") ||
          lbl.includes("flight") ||
          lbl.includes("pick") ||
          lbl.includes("drop") ||
          lbl.includes("visa") ||
          lbl.includes("arriving") ||
          lbl.includes("departing") ||
          key.includes("appointment") ||
          key.includes("travel") ||
          key.includes("flight") ||
          key.includes("pick") ||
          key.includes("drop") ||
          key.includes("visa")
        );
      });
    }
    return items;
  }, [actionRequiredItems, crmPermissions, isPickDropUser]);

  const showActionRequiredSection = filteredActionRequiredItems.length > 0;

  // 5. Item-level filtering for Department Performance
  const filteredDepartmentItems = useMemo(() => {
    if (isPickDropUser) return [];
    return departmentItems.filter((dept) =>
      isCrmDashboardItemAllowed(
        crmPermissions,
        null,
        "Department Performance",
        dept.name,
      ),
    );
  }, [departmentItems, crmPermissions, isPickDropUser]);

  const showDepartmentPerformanceSection = !isPickDropUser && filteredDepartmentItems.length > 0;

  // 6. Section-level visibility for Patient Aging Monitor
  const showPatientAgingMonitor = useMemo(() => {
    if (isPickDropUser) return false;
    return isCrmDashboardAnySectionAllowed(
      crmPermissions,
      "Patient Aging Monitor",
    );
  }, [crmPermissions, isPickDropUser]);

  const agingStatuses = useMemo(() => {
    if (backendStatusOptions && backendStatusOptions.length > 0) {
      return backendStatusOptions.map((st) => {
        if (typeof st === "object" && st !== null) {
          return { value: st.value ?? st.label ?? st.name, label: st.label ?? st.name ?? st.value };
        }
        return { value: st, label: st };
      });
    }
    const presentStatuses = patientAgingData
      .map((p) => p.status)
      .filter(Boolean);
    const optionsMap = new Map();
    PATIENT_STATUS_OPTIONS.forEach((opt) => {
      optionsMap.set(opt.value, opt.label);
    });
    presentStatuses.forEach((st) => {
      const norm = normalizePatientStatus(st) || st;
      if (norm && norm !== "—" && !optionsMap.has(norm)) {
        optionsMap.set(norm, getPatientStatusLabel(st) || st);
      }
    });
    return Array.from(optionsMap.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [backendStatusOptions, patientAgingData]);

  const agingStages = useMemo(() => {
    const opts = backendFilterStageOptions.length
      ? backendFilterStageOptions
      : backendStageOptions.length
      ? backendStageOptions
      : PATIENT_AGING_STAGE_OPTIONS;
    return [
      ...new Set([
        ...opts,
        ...patientAgingData.map((p) => p.stage).filter(Boolean),
      ]),
    ];
  }, [backendFilterStageOptions, backendStageOptions, patientAgingData]);

  const agingPriorities = useMemo(() => {
    if (backendPriorityOptions && backendPriorityOptions.length > 0) {
      return backendPriorityOptions.map((pr) => {
        if (typeof pr === "object" && pr !== null) {
          return { value: pr.value ?? pr.label, label: pr.label ?? pr.value };
        }
        return { value: pr, label: pr };
      });
    }
    return [
      { value: "Critical", label: "Critical" },
      { value: "High Priority", label: "High Priority" },
      { value: "Warning", label: "Warning" },
      { value: "Normal", label: "Normal" },
    ];
  }, [backendPriorityOptions]);

  const agingLegendItems = useMemo(() => {
    const legend = backendLegend || dashboard.patientAging?.legend || {};
    return AGING_LEGEND_ORDER.filter((key) => legend[key]).map((key) => ({
      key,
      ...legend[key],
      dot: severityToDot("", legend[key].dotColor),
    }));
  }, [backendLegend, dashboard.patientAging?.legend]);

  // Server-side filtering & sorting: patientAgingData contains the current page's matching records
  const paginatedAgingData = patientAgingData;
  const filteredAgingData = patientAgingData;
  const effectiveTotal = agingTotal || patientAgingData.length;
  const effectiveTotalPages = Math.max(1, agingTotalPages);
  const safeAgingPage = Math.min(agingPage, effectiveTotalPages);
  const agingPageStart =
    effectiveTotal === 0
      ? 0
      : (safeAgingPage - 1) * (agingLimit || AGING_PAGE_SIZE) + 1;
  const agingPageEnd =
    effectiveTotal === 0
      ? 0
      : Math.min(
          agingPageStart + paginatedAgingData.length - 1,
          effectiveTotal,
        );

  const handleExportAging = async () => {
    try {
      setExportingAging(true);
      toast.info("Preparing complete aging export...");
      const res = await fetchPatientAging({
        agingLimit: "all",
        stage: agingStageFilter || undefined,
        status: agingStatusFilter || undefined,
        priority: agingPriorityFilter || undefined,
        search: agingSearch || undefined,
        sortBy: agingSortDesc ? "longest_waiting" : "shortest_waiting",
      });
      const rawAging =
        res?.data && typeof res.data === "object" && !Array.isArray(res.data)
          ? { ...res, ...res.data }
          : res || {};
      const rawPatients = Array.isArray(rawAging)
        ? rawAging
        : rawAging.patients || rawAging.data || [];
      const allPatients = rawPatients.filter((r) =>
        shouldShowInAgingMonitor(r, agingStatusFilter),
      );
      const rowsToExport = allPatients.map(normalizeAgingRow);
      if (!rowsToExport.length) {
        toast.info("No patients to export");
        return;
      }
      downloadAgingExcel(rowsToExport);
      toast.success(`Exported ${rowsToExport.length} patients to Excel`);
    } catch (err) {
      console.error("Export all aging failed, falling back to current page:", err);
      if (paginatedAgingData.length) {
        downloadAgingExcel(paginatedAgingData);
        toast.success("Patient Aging Monitor exported to Excel");
      } else {
        toast.error("Failed to export patient aging data");
      }
    } finally {
      setExportingAging(false);
    }
  };

  if (isInsuranceUser) {
    return (
      <div className="main-wrapper">
        <Navbar onDashboardRefresh={() => {}} />
        <Sidebar />
        <div className="page-wrapper msd-scope">
          <div className="content">
            <div className="overview">
              <div className="row gx-0">
                <div className="col-md-12">
                  <div className="deash-heading">
                    <div>
                      <img src={dashboardImg} alt="" />
                    </div>
                    <div className="main-heading">
                      <h3>
                        Welcome {localStorage.getItem("name") || "Insurance Partner"}
                      </h3>
                      <p className="mb-0">Have a nice day at work</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <InsuranceDashboard insuranceId={insuranceId} />
          </div>
        </div>
        <div
          className="sidebar-overlay"
          onClick={() => {
            const sidebar = document.getElementById("sidebar");
            const sidebarOverlay = document.querySelector(".sidebar-overlay");
            const mainWrapper = document.querySelector(".main-wrapper");
            if (sidebar) sidebar.classList.remove("opened");
            if (sidebarOverlay) sidebarOverlay.classList.remove("opened");
            if (mainWrapper) mainWrapper.classList.remove("slide-nav");
            document.documentElement.classList.remove("menu-opened");
          }}
          data-reff="#sidebar"
        ></div>
      </div>
    );
  }

  if (isReferralUser) {
    return (
      <div className="main-wrapper">
        <Navbar onDashboardRefresh={() => {}} />
        <Sidebar />
        <div className="page-wrapper msd-scope">
          <div className="content">
            <div className="overview">
              <div className="row gx-0">
                <div className="col-md-12">
                  <div className="deash-heading">
                    <div>
                      <img src={dashboardImg} alt="" />
                    </div>
                    <div className="main-heading">
                      <h3>
                        Welcome {localStorage.getItem("name") || "Referral Partner"}
                      </h3>
                      <p className="mb-0">Have a nice day at work</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ReferralDashboard referralId={referralId} />
          </div>
        </div>
        <div
          className="sidebar-overlay"
          onClick={() => {
            const sidebar = document.getElementById("sidebar");
            const sidebarOverlay = document.querySelector(".sidebar-overlay");
            const mainWrapper = document.querySelector(".main-wrapper");
            if (sidebar) sidebar.classList.remove("opened");
            if (sidebarOverlay) sidebarOverlay.classList.remove("opened");
            if (mainWrapper) mainWrapper.classList.remove("slide-nav");
            document.documentElement.classList.remove("menu-opened");
          }}
          data-reff="#sidebar"
        />
      </div>
    );
  }

  return (
    <div className="main-wrapper">
      <Navbar onDashboardRefresh={loadDashboard} />
      <Sidebar />
      <div className="page-wrapper msd-scope">
        <div className="content">
          <div className="overview">
            <div className="row gx-0">
              <div className="col-md-12">
                <div className="deash-heading">
                  <div>
                    <img src={dashboardImg} alt="" />
                  </div>
                  <div className="main-heading">
                    <h3>Welcome {localStorage.getItem("name")}</h3>
                    <p className="mb-0">Have a nice day at work</p>
                  </div>
                </div>
              </div>


            </div>
          </div>

          {/* Live Pick & Drop Transport & Duty Overview Section (Only for Pick & Drop Staff, hidden for Admin) */}
          {usrFount !== "Insurance Partner" && isPickDropUser && (
            <div className="row gx-2 mb-3">
              <PickDropDashboardSection />
            </div>
          )}

          {usrFount !== "Insurance Partner" && (
            <>
              <div className="row gx-2 gy-4">
                {showTodaysPrioritySection && filteredPriorityItems.length > 0 && (
                  <div className="col-md-12">
                    <div className="row">
                      <div className="col-md-12">
                        <div className="treat-hd">
                          <h6>Today's Priorities</h6>
                          <span className="line"></span>
                        </div>
                        <DashboardCards
                          items={filteredPriorityItems}
                          counts={priorityCounts}
                          onCardClick={handlePriorityClick}
                          period="Today"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {showTodaysWorkSection && filteredTodaysWorkItems.length > 0 && (
                  <div className="col-md-12">
                    <div className="row">
                      <div className="col-md-12">
                        <div className="treat-hd">
                          <h6>Today's Work</h6>
                          <span className="line"></span>
                        </div>
                      </div>
                    </div>
                    <div className="msd-work-grid">
                      {filteredTodaysWorkItems.map((item) => {
                        const metric = todayWork?.[item.key];
                        const value =
                          typeof metric === "object" && metric !== null
                            ? (metric.count ?? metric.value ?? 0)
                            : typeof metric === "number"
                            ? metric
                            : 0;
                        const target =
                          (typeof metric === "object" && metric !== null ? metric.target : null) ??
                          TODAYS_WORK_TARGETS[item.key] ??
                          1;
                        return (
                          <div
                            key={item.key}
                            className="msd-work-card"
                            onClick={() => handleTodaysWorkClick(item.key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ")
                                handleTodaysWorkClick(item.key);
                            }}
                          >
                            <div className="msd-work-card-top">
                              <div>
                                <p className="msd-work-label">{item.label}</p>
                                <h3 className="msd-work-count">
                                  <CountUp start={0} end={value} duration={2} />
                                </h3>
                              </div>
                              <div className="msd-work-icon">
                                <i className={item.icon}></i>
                              </div>
                            </div>
                            <div className="msd-work-footer">
                              {/* <span>
                              {value} of {target} target
                            </span> */}
                              <button
                                type="button"
                                className="msd-work-view"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTodaysWorkClick(item.key);
                                }}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isPickDropUser && showImmediateAttentionSection && filteredAttentionItems.length > 0 && (
                  <div className="col-md-12">
                    <div className="row">
                      <div className="col-md-12">
                        <div className="treat-hd">
                          <h6>Immediate Attention</h6>
                          <span className="line"></span>
                        </div>
                      </div>
                    </div>
                    <div className="msd-attention-panel">
                      {filteredAttentionItems.map((item) => (
                        <div
                          key={item.key}
                          className={`msd-attention-row msd-urgency-${item.urgency || "normal"}`}
                          onClick={() => handleAttentionClick(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              handleAttentionClick(item);
                          }}
                        >
                          <div className="msd-attention-row-main">
                            <p className="msd-attention-row-title">{item.label}</p>
                            <span
                              className={`msd-badge msd-badge-${item.urgency || "normal"}`}
                            >
                              {item.urgencyLabel || "Normal"}
                            </span>
                          </div>
                          <div className="msd-attention-row-count">
                            <span className="msd-count-number">{item.count}</span>
                            <span className="msd-count-label">Patients</span>
                          </div>
                          <div className="msd-attention-row-waiting">
                            <i className="fa fa-hourglass-half"></i> {item.timeRange}
                          </div>
                          <button
                            type="button"
                            className="msd-view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAttentionClick(item);
                            }}
                          >
                            View Cases <i className="fa fa-angle-right"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showActionRequiredSection && (
                  <div className={!isPickDropUser ? "col-md-6" : "col-md-12"}>
                    <ActionRequiredSection items={filteredActionRequiredItems} />
                  </div>
                )}

                {!isPickDropUser && (
                  <div className={showActionRequiredSection ? "col-md-6" : "col-md-12"}>
                    <div className="treat-hd">
                      <h6>Recent Activity</h6>
                      <span className="line"></span>
                    </div>
                    <div className="msd-activity-list">
                      {(dashboard.recentActivity || []).length === 0 && (
                        <div className="msd-aging-empty p-3">No recent activity.</div>
                      )}
                      {(dashboard.recentActivity || []).map((a) => {
                        const patientLabel = (a.patientName || a.patient || "").trim();
                        const activityText = (a.activity || a.action || "").trim();
                        return (
                          <div className="msd-activity-item" key={a.id || a.performedAt}>
                            <div className="msd-activity-icon">
                              <i className={activityIcon(a.icon)}></i>
                            </div>
                            <div className="msd-activity-body">
                              <p className="msd-activity-text">
                                {patientLabel ? (
                                  <>
                                    <strong>{patientLabel}</strong>
                                    {activityText ? ` — ${activityText}` : ""}
                                  </>
                                ) : (
                                  activityText || "—"
                                )}
                              </p>
                              <p className="msd-activity-meta">
                                {a.staffLabel || a.staffName || a.staff || "—"}
                              </p>
                            </div>
                            <div className="msd-activity-time">
                              {formatRecentActivityTime(a)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isPickDropUser && showDepartmentPerformanceSection && (
                  <div className="col-md-12">
                    <div className="treat-hd">
                      <h6>Department Performance</h6>
                      <span className="line"></span>
                    </div>
                    <div className="msd-dept-grid">
                      {filteredDepartmentItems.map((dept) => (
                        <div
                          key={dept.key}
                          className={`msd-dept-card ${dept.accent}`}
                        >
                          <div className="msd-dept-head">
                            <div className="msd-dept-icon">
                              <i className={dept.icon}></i>
                            </div>
                            <h6 className="msd-dept-name">{dept.name}</h6>
                          </div>
                          <div className="msd-dept-stats">
                            {dept.stats.map((s) => (
                              <div className="msd-dept-stat-row" key={s.label}>
                                <span>{s.label}</span>
                                <span>{s.value}</span>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="msd-view-btn"
                            onClick={() => handleDepartmentClick(dept.key)}
                          >
                            View Department
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isPickDropUser && showPatientAgingMonitor && (
                  <div className="col-md-12">
                    <div className="treat-hd">
                      <h6>
                        Patient Aging Monitor
                        {effectiveTotal
                          ? ` (${effectiveTotal})`
                          : ""}
                      </h6>
                      <span className="line"></span>
                    </div>
                    <div className="main_content">
                      {agingLegendItems.length > 0 && (
                        <div className="msd-aging-legend">
                          {agingLegendItems.map((item) => (
                            <span key={item.key} className="msd-aging-legend-item">
                              <span
                                className={`msd-dot msd-dot-${item.dot}`}
                                aria-hidden="true"
                              />
                              {item.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="msd-aging-toolbar">
                        <input
                          type="text"
                          className="msd-aging-search"
                          placeholder="Search by name, ID, or phone..."
                          value={agingSearch}
                          onChange={(e) => setAgingSearch(e.target.value)}
                          aria-label="Search patients"
                        />
                        <select
                          className="msd-aging-select"
                          value={agingStatusFilter}
                          onChange={(e) => handleStatusFilterChange(e.target.value)}
                          aria-label="Filter by status"
                        >
                          <option value="">All Statuses</option>
                          {agingStatuses.map((st) => (
                            <option key={st.value} value={st.value}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="msd-aging-select"
                          value={agingStageFilter}
                          onChange={(e) => handleStageFilterChange(e.target.value)}
                          aria-label="Filter by stage"
                        >
                          <option value="">All Stages</option>
                          {agingStages.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                        <select
                          className="msd-aging-select"
                          value={agingPriorityFilter}
                          onChange={(e) => handlePriorityFilterChange(e.target.value)}
                          aria-label="Filter by priority"
                        >
                          <option value="">All Priorities</option>
                          {agingPriorities.map((pr) => (
                            <option key={pr.value} value={pr.value}>
                              {pr.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="msd-aging-sort-btn"
                          onClick={handleToggleSort}
                          title={
                            agingSortDesc
                              ? "Showing longest waiting first (click to switch to shortest waiting)"
                              : "Showing shortest waiting first (click to switch to longest waiting)"
                          }
                        >
                          <i
                            className={`fa fa-sort-amount-${agingSortDesc ? "desc" : "asc"}`}
                          ></i>{" "}
                          {agingSortDesc ? "Longest Waiting" : "Shortest Waiting"}
                        </button>
                        <button
                          type="button"
                          className="msd-aging-export-btn"
                          onClick={handleExportAging}
                          disabled={agingLoading || exportingAging || (filteredAgingData.length === 0 && effectiveTotal === 0)}
                          title="Export all filtered patients to Excel"
                        >
                          <i
                            className={`fa ${exportingAging ? "fa-spinner fa-spin" : "fa-file-excel-o"} me-1`}
                            aria-hidden="true"
                          ></i>{" "}
                          {exportingAging ? "Exporting..." : "Export Excel"}
                        </button>
                      </div>
                      <div className="table-responsive">
                        {agingLoading ? (
                          <div className="msd-aging-empty">Loading…</div>
                        ) : (
                          <table className="msd-aging-table">
                            <thead>
                              <tr>
                                <th>Patient Name</th>
                                <th>ID</th>
                                <th>Phone Number</th>
                                <th>Status</th>
                                <th>Current Stage</th>
                                <th>Waiting Time</th>
                                <th>Priority</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedAgingData.map((p, idx) => (
                                <tr
                                  key={`${p.patientId || p.enquiryId || p.id}-${idx}`}
                                  className={`msd-aging-row-${p.priority}`}
                                >
                                  <td>{p.name}</td>
                                  <td>{p.patientId || p.enquiryId || "—"}</td>
                                  <td title={p.phone}>{p.phone || "—"}</td>
                                  <td>
                                    {p.patientId ? (
                                      <select
                                        className={`msd-aging-status-select msd-status-${getPatientStatusBadgeKey(
                                          normalizePatientStatus(p.status) ||
                                          p.status,
                                        )}`}
                                        value={
                                          normalizePatientStatus(p.status) || ""
                                        }
                                        disabled={updatingStatusId === p.patientId}
                                        onChange={(e) =>
                                          handleAgingStatusChange(
                                            p,
                                            e.target.value,
                                          )
                                        }
                                        aria-label={`Change status for ${p.name}`}
                                      >
                                        <option value="" disabled>
                                          Select Status
                                        </option>
                                        {!PATIENT_STATUS_OPTIONS.some(
                                          (option) =>
                                            option.value ===
                                            normalizePatientStatus(p.status),
                                        ) &&
                                          p.status &&
                                          p.status !== "—" && (
                                            <option value={p.status}>
                                              {getPatientStatusLabel(p.status) ||
                                                p.status}
                                            </option>
                                          )}
                                        {PATIENT_STATUS_OPTIONS.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : p.status && p.status !== "—" ? (
                                      <span
                                        className={`msd-status-badge msd-status-${getPatientStatusBadgeKey(p.status)}`}
                                      >
                                        {p.status}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {p.patientId ? (
                                      <select
                                        className="msd-aging-stage-select"
                                        value={
                                          normalizeAgingStage(p.stage) || ""
                                        }
                                        disabled={
                                          updatingStageId ===
                                          (p.patientId || p.id)
                                        }
                                        onChange={(e) =>
                                          handleAgingStageChange(p, e.target.value)
                                        }
                                        aria-label={`Change current stage for ${p.name}`}
                                      >
                                        <option value="" disabled>
                                          Select stage
                                        </option>
                                        {!PATIENT_AGING_STAGE_OPTIONS.some(
                                          (option) =>
                                            option.toLowerCase() ===
                                            String(
                                              normalizeAgingStage(p.stage) ||
                                              p.stage ||
                                              "",
                                            ).toLowerCase(),
                                        ) &&
                                          p.stage &&
                                          p.stage !== "—" && (
                                            <option value={p.stage}>
                                              {p.stage}
                                            </option>
                                          )}
                                        {PATIENT_AGING_STAGE_OPTIONS.map(
                                          (stage) => (
                                            <option key={stage} value={stage}>
                                              {stage}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    ) : (
                                      p.stage
                                    )}
                                  </td>
                                  <td>{p.waitingLabel}</td>
                                  <td>
                                    <span
                                      className={`msd-badge msd-badge-${p.priority}`}
                                    >
                                      {p.priorityLabel}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="msd-aging-actions">
                                      <button
                                        type="button"
                                        className="msd-aging-view-btn msd-aging-notes-btn"
                                        title="View / Add Notes"
                                        onClick={() => openAgingNotes(p)}
                                        disabled={!p.patientId}
                                      >
                                        <i className="fa fa-sticky-note-o" aria-hidden="true"></i>
                                        Notes
                                        {Array.isArray(p.raw?.discussionNotes) &&
                                          p.raw.discussionNotes.length > 0
                                          ? ` (${p.raw.discussionNotes.length})`
                                          : ""}
                                      </button>
                                      <button
                                        type="button"
                                        className="msd-aging-view-btn"
                                        onClick={() => navigateToRecord(navigate, p.raw)}
                                      >
                                        {p.recordType === "enquiry"
                                          ? "View Enquiry"
                                          : "View Patient"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {!agingLoading && filteredAgingData.length === 0 && (
                          <div className="msd-aging-empty">
                            No patients match the selected filters.
                          </div>
                        )}
                      </div>
                      {!agingLoading && effectiveTotal > 0 && (
                        <div className="msd-aging-pagination">
                          <div className="d-flex align-items-center flex-wrap gap-2">
                            <span className="msd-aging-page-info">
                              Showing {agingPageStart}–{agingPageEnd} of{" "}
                              {effectiveTotal}
                            </span>
                            <div className="msd-aging-limit-wrap">
                              <span>Per page:</span>
                              <select
                                className="msd-aging-limit-select"
                                value={agingLimit || AGING_PAGE_SIZE}
                                onChange={(e) => handleLimitChange(e.target.value)}
                                aria-label="Patients per page"
                              >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                              </select>
                            </div>
                          </div>
                          <div className="msd-aging-page-controls">
                            <button
                              type="button"
                              className="msd-aging-page-btn"
                              title="First Page"
                              disabled={safeAgingPage <= 1 || agingLoading}
                              onClick={() =>
                                loadPatientAgingPage(
                                  1,
                                  agingStageFilter,
                                  agingLimit,
                                  agingStatusFilter,
                                  agingPriorityFilter,
                                  agingSearch,
                                  agingSortDesc,
                                )
                              }
                            >
                              <i className="fa fa-angle-double-left" aria-hidden="true"></i>
                            </button>
                            <button
                              type="button"
                              className="msd-aging-page-btn"
                              title="Previous Page"
                              disabled={safeAgingPage <= 1 || agingLoading}
                              onClick={() =>
                                loadPatientAgingPage(
                                  Math.max(1, safeAgingPage - 1),
                                  agingStageFilter,
                                  agingLimit,
                                  agingStatusFilter,
                                  agingPriorityFilter,
                                  agingSearch,
                                  agingSortDesc,
                                )
                              }
                            >
                              <i className="fa fa-angle-left" aria-hidden="true"></i>
                            </button>
                            <div className="msd-aging-page-numbers">
                              {getPaginationPages(safeAgingPage, effectiveTotalPages).map((pItem, pIdx) =>
                                pItem === "..." ? (
                                  <span key={`ellipsis-${pIdx}`} className="msd-aging-page-btn-ellipsis">
                                    …
                                  </span>
                                ) : (
                                  <button
                                    key={`page-${pItem}`}
                                    type="button"
                                    className={`msd-aging-page-btn ${pItem === safeAgingPage ? "active" : ""}`}
                                    disabled={agingLoading}
                                    onClick={() =>
                                      loadPatientAgingPage(
                                        pItem,
                                        agingStageFilter,
                                        agingLimit,
                                        agingStatusFilter,
                                        agingPriorityFilter,
                                        agingSearch,
                                        agingSortDesc,
                                      )
                                    }
                                  >
                                    {pItem}
                                  </button>
                                )
                              )}
                            </div>
                            <button
                              type="button"
                              className="msd-aging-page-btn"
                              title="Next Page"
                              disabled={safeAgingPage >= effectiveTotalPages || agingLoading}
                              onClick={() =>
                                loadPatientAgingPage(
                                  Math.min(effectiveTotalPages, safeAgingPage + 1),
                                  agingStageFilter,
                                  agingLimit,
                                  agingStatusFilter,
                                  agingPriorityFilter,
                                  agingSearch,
                                  agingSortDesc,
                                )
                              }
                            >
                              <i className="fa fa-angle-right" aria-hidden="true"></i>
                            </button>
                            <button
                              type="button"
                              className="msd-aging-page-btn"
                              title="Last Page"
                              disabled={safeAgingPage >= effectiveTotalPages || agingLoading}
                              onClick={() =>
                                loadPatientAgingPage(
                                  effectiveTotalPages,
                                  agingStageFilter,
                                  agingLimit,
                                  agingStatusFilter,
                                  agingPriorityFilter,
                                  agingSearch,
                                  agingSortDesc,
                                )
                              }
                            >
                              <i className="fa fa-angle-double-right" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* <DashboardAnalytics /> */}

            </>
          )}

        </div>
      </div>

      <CaseListModal
        isOpen={caseModal.open}
        title={caseModal.title}
        endpoint={caseModal.endpoint}
        onClose={() => setCaseModal({ open: false, title: "", endpoint: "" })}
        navigate={navigate}
      />

      {notesModal.open && (
        <div
          className="msd-modal-overlay"
          onClick={closeAgingNotes}
          role="presentation"
        >
          <div
            className="msd-modal-panel msd-notes-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="aging-notes-title"
          >
            <div className="msd-modal-head">
              <h5 id="aging-notes-title" className="msd-case-modal-title">
                Notes – {notesModal.patientName}
              </h5>
              {notesModal.patientId ? (
                <span className="msd-modal-count">{notesModal.patientId}</span>
              ) : null}
              <button
                type="button"
                className="msd-modal-close"
                onClick={closeAgingNotes}
                aria-label="Close"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="msd-modal-body">
              {notesModal.patientId ? (
                <form
                  className="msd-notes-form"
                  onSubmit={handleSubmitAgingNote}
                >
                  <div className="msd-notes-form-row">
                    <label htmlFor="aging-note-text">
                      Add Note<span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="aging-note-text"
                      className="msd-notes-textarea"
                      rows={3}
                      placeholder="Write patient note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      disabled={noteSubmitting}
                    />
                    {noteError.note ? (
                      <span className="msd-notes-error">
                        Note cannot be empty
                      </span>
                    ) : null}
                  </div>
                  <div className="msd-notes-form-row">
                    <label htmlFor="aging-note-date">
                      Date<span className="text-danger">*</span>
                    </label>
                    <input
                      id="aging-note-date"
                      type="date"
                      className="msd-notes-date"
                      value={noteDate}
                      onChange={(e) => setNoteDate(e.target.value)}
                      disabled={noteSubmitting}
                    />
                    {noteError.date ? (
                      <span className="msd-notes-error">Please select a date</span>
                    ) : null}
                  </div>
                  <div className="msd-notes-form-actions">
                    <button
                      type="submit"
                      className="msd-aging-view-btn"
                      disabled={noteSubmitting}
                    >
                      {noteSubmitting ? "Saving..." : "Add Note"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="msd-aging-empty">
                  Patient ID missing — notes cannot be added.
                </div>
              )}

              <div className="msd-notes-divider">Existing Notes</div>

              {notesModal.notes.length === 0 ? (
                <div className="msd-aging-empty">No notes for this patient.</div>
              ) : (
                <div className="msd-notes-list">
                  {notesModal.notes.map((item, index) => (
                    <div
                      key={item.id || `${item.date}-${index}`}
                      className="msd-notes-item"
                    >
                      <div className="msd-notes-item-head">
                        <strong>Note-{index + 1}</strong>
                        <span>
                          {formatNoteDate(item.date)}
                          {item.addedBy && ` | ${item.addedBy}`}
                        </span>
                      </div>
                      <p className="msd-notes-item-text">{item.note || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TravelStatusModal
        open={travelStatusModal.open}
        status={travelStatusModal.status}
        patientId={travelStatusModal.patientId}
        patientName={travelStatusModal.patientName}
        onClose={handleCloseTravelStatusModal}
        onSubmit={handleSubmitTravelStatus}
        submitting={travelStatusSubmitting}
      />
      <div
        className="sidebar-overlay"
        onClick={() => {
          const sidebar = document.getElementById('sidebar');
          const sidebarOverlay = document.querySelector('.sidebar-overlay');
          const mainWrapper = document.querySelector('.main-wrapper');
          if (sidebar) sidebar.classList.remove('opened');
          if (sidebarOverlay) sidebarOverlay.classList.remove('opened');
          if (mainWrapper) mainWrapper.classList.remove('slide-nav');
          document.documentElement.classList.remove('menu-opened');
        }}
        data-reff="#sidebar"
      />
    </div>
  );
}
