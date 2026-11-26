import React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useState, useEffect, useRef, useMemo } from "react";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { useSelector, useDispatch } from "react-redux";
import {
  DeletePatient,
  GetAllPatients,
} from "../../reducer/PatientsSlice";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import { GetAllCountries2 } from "../../reducer/Countries";
import TableSortLabel from "@mui/material/TableSortLabel";
import axios from "axios";
import { baseurl } from "../../Basurl/Baseurl";
import { markRecordRead, pickPatientRecordId, markPatientSeenLocally, isPatientSeenLocally } from "../../services/unreadApi";
import { clearUnreadById, UnreadDot } from "../../components/NewTag";
import VisibilityIcon from "@mui/icons-material/Visibility";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import ClearIcon from "@mui/icons-material/Clear";
import DialogContent from "@mui/material/DialogContent";
import {
  Button,
  Dialog,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Menu,
  Divider,
  Tooltip,
  Popover,
} from "@mui/material";
import "./Patient.css";
import { toast } from "react-toastify";
import { usePDF } from "react-to-pdf";
import Loader from "../../components/Loader";
import { useSearchParams } from "react-router-dom";
import {
  getPatientStatusLabel,
  isTravelStatus,
  normalizePatientStatus,
  PATIENT_STATUS_OPTIONS,
} from "../../utils/patientStatus";
import {
  getHospitalId,
  isHospitalUser,
  isReferralUser,
  getReferralId,
  isInsuranceUser,
  getInsuranceId,
  isPhysiotherapistUser,
  isCoordinatorUser,
  getCurrentCoordinatorUser,
  isMongoObjectId,
  canViewAndEditSensitivePatientDetails,
} from "../../utils/authStorage";
import {
  hasActivityLogPermission,
  hasAssignPatientPhysioPermission,
  hasAssignPatientCoordinatorPermission,
  hasViewPatientActivityLogPermission,
  hasViewPatientTimelinePermission,
} from "../../utils/sosPermissions";
import { canStaffDelete, canStaffEdit, canStaffExport } from "../../utils/staffActions";
import TravelStatusModal from "../../components/Common/TravelStatusModal";
import AssignPhysiotherapistModal from "./components/AssignPhysiotherapistModal";
import AssignCoordinatorModal from "./components/AssignCoordinatorModal";
import AssignReferralModal from "./components/AssignReferralModal";
import AssignInsuranceModal from "./components/AssignInsuranceModal";
import { getStoredInsuranceForPatient } from "../../services/insuranceApi";
import PatientTimelineTab from "./components/PatientTimelineTab";
import ReferralModal from "../Physiotherapy/components/ReferralModal";
import {
  getAssignedCoordinator,
  isPatientAssignedToCoordinatorUser,
} from "../../services/coordinatorApi";
import {
  fetchPhysioAssignmentsMap,
  getStoredPhysioAssignments,
  quickMarkPatientNeedPhysio,
  unassignPatientFromPhysiotherapist,
} from "../../services/physiotherapyApi";
import { addPatientNotes } from "../../services/dashboardApi";
import { fetchAndApplyUserDetails } from "../../services/userDetailsService";
import {
  updatePatientNotification,
  isPatientNotificationEnabled,
} from "../../services/patientNotificationApi";

import {
  buildPatientActivityLogsExcelHtml,
  downloadActivityLogsFile,
  extractActivityLogs,
  extractActivityLogPagination,
  formatActivityLogDate,
  getActivityLogAction,
  getActivityLogDate,
  getActivityLogDescription,
  getActivityLogId,
  getActivityLogModule,
  getActivityLogUser,
} from "../ActivityLog/activityLogHelpers";

const getStaffNameFromPatient = (info) => {
  if (!info || typeof info !== "object") return "";
  const candidates = [
    info.staff_name,
    info.staffName,
    info.addedByStaff,
    info.added_by_staff,
    info.created_by_name,
    info.creator_name,
    info.userName,
    info.username,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && !/^[a-fA-F0-9]{24}$/.test(c.trim())) {
      return c.trim();
    }
    if (typeof c === "object" && c !== null && (c.name || c.staff_name)) {
      return (c.name || c.staff_name).trim();
    }
  }
  return "";
};

const truncateCellText = (text, maxLength = 15) => {
  if (!text) return "";
  const value = String(text);
  return value.length > maxLength
    ? `${value.substring(0, maxLength)}...`
    : value;
};

const isSamePatientRow = (a, b) => {
  if (!a || !b) return false;
  const aId = String(a._id || a.patientObjectId || a.id || "").trim();
  const bId = String(b._id || b.patientObjectId || b.id || "").trim();
  if (aId && bId && aId === bId) return true;

  const aNum = String(a.patientNumber || "").trim().toLowerCase();
  const bNum = String(b.patientNumber || "").trim().toLowerCase();
  if (aNum && bNum && aNum === bNum) return true;

  const aPid = String(a.patientId || "").trim().toLowerCase();
  const bPid = String(b.patientId || "").trim().toLowerCase();
  if (aPid && bPid && aPid === bPid) return true;

  return false;
};

const getPatientFullPhone = (info) => {
  if (!info) return "—";
  const code = String(info.phoneCode || info.phone_code || info.dial_code || "").trim();
  const phone = String(
    info.emergency_contact_no ||
    info.emergency_contact ||
    info.patient_emergency_contact_no ||
    info.phone_no ||
    info.phone ||
    info.phoneNumber ||
    info.mobile ||
    info.mobileNumber ||
    info.contact_no ||
    info.patient_phone ||
    "",
  ).trim();
  if (!phone && !code) return "—";
  if (code && phone) {
    const cleanCode = code.replace(/^\+/, "");
    const cleanPhone = phone.replace(/^\+/, "");
    if (cleanPhone.startsWith(cleanCode)) {
      return phone.startsWith("+") ? phone : `+${phone}`;
    }
    const prefix = code.startsWith("+") ? code : `+${code}`;
    return `${prefix} ${phone}`;
  }
  return phone || code || "—";
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

export const getPatientTreatmentInfo = (info) => {
  if (!info) {
    return {
      name: "—",
      type: "",
      isConverted: false,
      id: "",
      status: "",
      hospitalName: "",
      createdAt: "",
      tooltip: "—",
    };
  }

  const planObj = info.current_treatment_or_plan || null;

  const rawName =
    info.current_treatment_name ||
    info.treatment_or_plan_name ||
    planObj?.name ||
    info.treatment_name ||
    info.treatmentName ||
    info.treatment ||
    info?.patient_disease?.[0]?.disease_name ||
    info?.disease_name ||
    info?.patientDisease ||
    info?.disease ||
    "";

  const name = rawName ? String(rawName).trim() : "—";

  const rawType =
    info.current_treatment_type ||
    planObj?.type ||
    (info.is_treatment_converted || planObj?.is_converted
      ? "Treatment"
      : planObj
        ? "Treatment Plan"
        : "");

  const type = rawType ? String(rawType).trim() : "";

  const isConverted = Boolean(
    info.is_treatment_converted ??
    planObj?.is_converted ??
    (type.toLowerCase() === "treatment"),
  );

  const id = String(planObj?.id || planObj?.treatment_id || "").trim();
  const status = String(planObj?.status || "").trim();
  const hospitalName = String(planObj?.hospital_name || "").trim();
  const createdAt = planObj?.created_at || "";

  const tooltipParts = [];
  if (name && name !== "—") tooltipParts.push(name);
  if (type) tooltipParts.push(`Type: ${type}`);
  if (status) tooltipParts.push(`Status: ${status}`);
  if (hospitalName) tooltipParts.push(`Hospital: ${hospitalName}`);

  return {
    name,
    type,
    isConverted,
    id,
    status,
    hospitalName,
    createdAt,
    tooltip: tooltipParts.join(" | ") || (name !== "—" ? name : "—"),
  };
};

const downloadPatientsExcel = (patientRows = [], isAdmin = true) => {
  const headers = [
    "Sr.No.",
    "Patient ID",
    "Patient Name",
    "Treatment Name",
    "Treatment Type",
    ...(isAdmin ? ["Phone Number"] : []),
    "Treating In",
    "Date/Time",
    "Country",
    "Patient Type",
    "Status",
  ];
  const headerRow = headers
    .map(
      (header) =>
        `<th style="background-color:#0ba6df;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #ddd;">${escapeHtmlCell(
          header,
        )}</th>`,
    )
    .join("");

  const bodyRows = patientRows
    .map((info, idx) => {
      const phone = getPatientFullPhone(info);
      const createdDate = info.createdAt
        ? `${new Date(info.createdAt).toLocaleDateString("en-GB")} ${new Date(
          info.createdAt,
        ).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}`
        : "";
      const treatInfo = getPatientTreatmentInfo(info);
      const cells = [
        idx + 1,
        info.patientNumber || info.patientId || "",
        info.patient_name || info.name || "",
        treatInfo.name !== "—" ? treatInfo.name : "",
        treatInfo.type || "",
        ...(isAdmin ? [phone !== "—" ? phone : ""] : []),
        info.treatingIn || "",
        createdDate,
        info.country || "",
        info.patient_type_new || "None",
        getPatientStatusLabel(info.p_status) || info.p_status || "",
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
<x:Name>Patients</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<h3 style="color:#0ba6df;font-family:sans-serif;">Patients List</h3>
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
  link.setAttribute("download", `patients-${stamp}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadPatientsCsv = (patientRows = [], isAdmin = true) => {
  const headers = [
    "Sr.No.",
    "Patient ID",
    "Patient Name",
    "Treatment Name",
    "Treatment Type",
    ...(isAdmin ? ["Phone Number"] : []),
    "Treating In",
    "Date/Time",
    "Country",
    "Patient Type",
    "Status",
  ];
  const lines = [
    headers.join(","),
    ...patientRows.map((info, idx) => {
      const phone = getPatientFullPhone(info);
      const createdDate = info.createdAt
        ? `${new Date(info.createdAt).toLocaleDateString("en-GB")} ${new Date(
          info.createdAt,
        ).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}`
        : "";
      const treatInfo = getPatientTreatmentInfo(info);
      return [
        escapeCsvCell(idx + 1),
        escapeCsvCell(info.patientNumber || info.patientId || ""),
        escapeCsvCell(info.patient_name || info.name || ""),
        escapeCsvCell(treatInfo.name !== "—" ? treatInfo.name : ""),
        escapeCsvCell(treatInfo.type || ""),
        ...(isAdmin ? [escapeCsvCell(phone !== "—" ? phone : "")] : []),
        escapeCsvCell(info.treatingIn || ""),
        escapeCsvCell(createdDate),
        escapeCsvCell(info.country || ""),
        escapeCsvCell(info.patient_type_new || "None"),
        escapeCsvCell(
          getPatientStatusLabel(info.p_status) || info.p_status || "",
        ),
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
  link.setAttribute("download", `patients-${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


const EMPTY_PATIENT_FILTERS = {
  patient: "",
  p_status: "",
  patient_type_new: "",
  country: "",
  treatingIn: "",
  treatment: "",
  date_from: "",
  date_to: "",
};

const PATIENT_TYPE_FILTER_VALUES = [
  "Private",
  "Foundation",
  "Insurance",
  "Insurance + Private",
];

const autocompleteSx = {
  "& .MuiInputBase-root": { height: 40, backgroundColor: "#fff" },
  "& .MuiInputBase-input": { padding: "6px 12px" },
};

const getTreatmentFilterLabel = (item) =>
  item?.name || item?.course_name || item?.treatment_course_name || "";

const hasAnyPatientFilter = (filters = {}) =>
  Boolean(
    filters.patient ||
    filters.p_status ||
    filters.patient_type_new ||
    filters.country ||
    filters.treatingIn ||
    filters.treatment ||
    filters.date_from ||
    filters.date_to,
  );

export const isPatientRecordUnseen = (item) => {
  if (!item) return false;

  // 1. Session / local read cache takes immediate precedence
  if (isPatientSeenLocally(item)) {
    return false;
  }

  // 2. Primary source of truth: root boolean fields from API (per API spec)
  // Read:   { isSeen: true, isUnseen: false, isBold: false, isUnread: false }
  // Unread: { isSeen: false, isUnseen: true, isBold: true, isUnread: true }
  if (typeof item.isSeen === "boolean") {
    return !item.isSeen;
  }
  if (typeof item.isUnseen === "boolean") {
    return Boolean(item.isUnseen);
  }
  if (typeof item.isUnread === "boolean") {
    return Boolean(item.isUnread);
  }

  // 3. Fallbacks for snake_case / numeric values from backend
  if (item.is_seen === true || item.is_seen === 1 || item.is_seen === "1") {
    return false;
  }
  if (item.is_seen === false || item.is_seen === 0 || item.is_seen === "0") {
    return true;
  }
  if (item.is_unseen === true || item.is_unseen === 1 || item.is_unseen === "1") {
    return true;
  }
  if (item.is_unread === true || item.is_unread === 1 || item.is_unread === "1") {
    return true;
  }

  // 4. isBold indicator
  if (typeof item.isBold === "boolean") {
    return item.isBold;
  }
  if (item.is_bold === true || item.is_bold === 1) {
    return true;
  }

  return false;
};

export const isPatientRecordBold = (item) => {
  if (!item) return false;
  if (isPatientSeenLocally(item)) return false;
  if (typeof item.isBold === "boolean") return item.isBold;
  if (item.is_bold === true || item.is_bold === 1) return true;
  return isPatientRecordUnseen(item);
};

function pinUnreadPatientsFirst(list) {
  const unread = [];
  const rest = [];
  list.forEach((row) => {
    if (isPatientRecordUnseen(row)) unread.push(row);
    else rest.push(row);
  });
  return [...unread, ...rest];
}

function getInitials(name) {
  if (!name) return "PT";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarGradient(name) {
  const gradients = [
    "linear-gradient(135deg, #0ba6df, #0284c7)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #ec4899, #be185d)",
    "linear-gradient(135deg, #06b6d4, #0891b2)",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function getTypePillClass(type) {
  switch (String(type || "").toLowerCase()) {
    case "private": return "type-pill-private";
    case "foundation": return "type-pill-foundation";
    case "insurance": return "type-pill-insurance";
    case "insurance + private":
    case "insurance+private": return "type-pill-insurance-private";
    default: return "type-pill-none";
  }
}

function getStatusPillClass(status) {
  const norm = normalizePatientStatus(status).toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  switch (norm) {
    case "ongoing-treatment":
    case "under-treatment":
      return "status-pill-ongoing-treatment";
    case "ongoing-fundraising":
      return "status-pill-ongoing-fundraising";
    case "treatment-completed":
      return "status-pill-treatment-completed";
    case "travelled":
    case "traveling-today":
    case "travelling-today":
    case "arriving":
      return "status-pill-travelled";
    case "in-process":
    case "confirmed":
      return "status-pill-in-process";
    case "pending":
    case "on-hold":
      return "status-pill-pending";
    case "cancelled":
    case "passed-away":
      return "status-pill-cancelled";
    default:
      return "status-pill-default";
  }
}

export default function Patient() {
  const role = localStorage.getItem("Role");
  const normalizedRole = (role || "").trim().toLowerCase();
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "super admin";
  const canViewSensitive = isAdmin || canViewAndEditSensitivePatientDetails(role);
  const isReferral = isReferralUser() || isInsuranceUser();
  const isInsurance = isInsuranceUser();
  const allowEdit = !isReferral && !isInsurance && (canStaffEdit() || canViewSensitive);
  const allowDelete = !isReferral && !isInsurance && canStaffDelete();
  const allowExport = isReferral || isInsurance || canStaffExport();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const canAssignPhysio = hasAssignPatientPhysioPermission(permissionsRaw, role);
  const canAssignCoordinator = hasAssignPatientCoordinatorPermission(permissionsRaw, role);
  const canViewActivityLog = hasViewPatientActivityLogPermission(permissionsRaw, role);
  const canViewTimeline = hasViewPatientTimelinePermission(permissionsRaw, role);
  const canTrackActivity = canViewActivityLog || canViewTimeline;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pagination } = useSelector((state) => state.patient);
  const { patient, loading, error } = useSelector((state) => state.patient);
  const { Treatment } = useSelector((state) => state.Treatment);
  const { Countries } = useSelector((state) => state.Countries);
  const [showActions, setShowActions] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [onVaue, setOnVaue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [seekerStatus, setSeekerStatus] = React.useState({});
  const [treatmentname, setTreatmentname] = useState([]);
  const { toPDF, targetRef } = usePDF({ filename: "Patient.pdf" });
  const [selectedJobTitle, setSelectedJobTitle] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [searchApiData, setSearchApiData] = useState([]);
  const [pdfRowLimit, setPdfRowLimit] = useState(null);
  const [orderBy, setOrderBy] = useState("");
  const [order, setOrder] = useState("");
  const [report, setReport] = useState({
    country: " ",
    gender: " ",
    age: " ",
  });

  const [dashboardStatusCounts, setDashboardStatusCounts] = useState({});
  const [dashboardTotalPatients, setDashboardTotalPatients] = useState(0);

  useEffect(() => {
    if (isReferral || isInsurance) return;
    let isMounted = true;
    const fetchDashboardCounts = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get(`${baseurl}Dashboard_count`, {
          params: { period: "all" },
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (isMounted && res.data) {
          if (res.data.patientStatusCounts) {
            setDashboardStatusCounts(res.data.patientStatusCounts);
          }
          if (res.data.Patients != null) {
            setDashboardTotalPatients(Number(res.data.Patients) || 0);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch dashboard counts for patient cards:", err);
      }
    };
    fetchDashboardCounts();
    return () => {
      isMounted = false;
    };
  }, [isReferral, isInsurance]);

  const [appliedFilters, setAppliedFilters] = useState(EMPTY_PATIENT_FILTERS);
  const [patientNameInput, setPatientNameInput] = useState("");
  const appliedPatientRef = useRef("");
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const typeFromUrl = searchParams.get("type");
  const [fullWidth, setFullWidth] = React.useState(true);
  const [maxWidth, setMaxWidth] = React.useState("md");
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPatientId, setActivityPatientId] = useState("");
  const [activityPatient, setActivityPatient] = useState(null);
  const [activityTab, setActivityTab] = useState("logs");
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityTotalRecords, setActivityTotalRecords] = useState(0);
  const [openPatientNotes, setOpenPatientNotes] = useState(false);
  const [notePatientId, setNotePatientId] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notePatientName, setNotePatientName] = useState("");
  const [notePatientNumber, setNotePatientNumber] = useState("");
  const [notePatientRow, setNotePatientRow] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState({ note: false, date: false });
  const [travelStatusModal, setTravelStatusModal] = useState({
    open: false,
    patientId: "",
    patientName: "",
    status: "",
  });
  const [travelStatusSubmitting, setTravelStatusSubmitting] = useState(false);
  const [rows, setRows] = useState([]);
  const [physioAssignmentsMap, setPhysioAssignmentsMap] = useState({});
  const [assignPhysioModalOpen, setAssignPhysioModalOpen] = useState(false);
  const [assignPhysioPatient, setAssignPhysioPatient] = useState(null);
  const [assignPhysioExistingCase, setAssignPhysioExistingCase] = useState(null);
  const [createPhysioModalOpen, setCreatePhysioModalOpen] = useState(false);
  const [createPhysioPatient, setCreatePhysioPatient] = useState(null);
  const [assignCoordModalOpen, setAssignCoordModalOpen] = useState(false);
  const [assignCoordPatient, setAssignCoordPatient] = useState(null);
  const [assignReferralModalOpen, setAssignReferralModalOpen] = useState(false);
  const [assignReferralPatient, setAssignReferralPatient] = useState(null);
  const [assignInsuranceModalOpen, setAssignInsuranceModalOpen] = useState(false);
  const [assignInsurancePatient, setAssignInsurancePatient] = useState(null);

  // Density, Display & Action View customization
  const [tableDensity, setTableDensity] = useState(() => localStorage.getItem("patient_table_density") || "compact");
  const [actionViewMode, setActionViewMode] = useState(() => localStorage.getItem("patient_action_mode") || "full");
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuPatient, setActionMenuPatient] = useState(null);
  const [assignmentPopoverAnchor, setAssignmentPopoverAnchor] = useState(null);
  const [assignmentPopoverPatient, setAssignmentPopoverPatient] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [onlyPhysioFilter, setOnlyPhysioFilter] = useState(false);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);

  const DEFAULT_COLUMNS = {
    srNo: true,
    patientName: true,
    treatment: true,
    treatingIn: true,
    dateTime: true,
    patientType: true,
    status: true,
    actions: true,
  };

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("patient_table_columns_v6");
      return saved ? { ...DEFAULT_COLUMNS, ...JSON.parse(saved) } : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("patient_table_columns_v6", JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };

  const toggleDensity = () => {
    setTableDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      localStorage.setItem("patient_table_density", next);
      return next;
    });
  };

  const toggleActionMode = () => {
    setActionViewMode((prev) => {
      const next = prev === "compact" ? "full" : "compact";
      localStorage.setItem("patient_action_mode", next);
      return next;
    });
  };

  const handleOpenActionMenu = (e, patientInfo) => {
    e.stopPropagation();
    markPatientAction(patientInfo);
    setActionMenuAnchor(e.currentTarget);
    setActionMenuPatient(patientInfo);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setActionMenuPatient(null);
  };

  const handleOpenAssignmentPopover = (e, patientInfo) => {
    e.stopPropagation();
    setAssignmentPopoverAnchor(e.currentTarget);
    setAssignmentPopoverPatient(patientInfo);
  };

  const handleCloseAssignmentPopover = () => {
    setAssignmentPopoverAnchor(null);
    setAssignmentPopoverPatient(null);
  };

  const handleRowsPerPageChange = (e) => {
    const newLimit = parseInt(e.target.value, 10) || 10;
    setRowsPerPage(newLimit);
    setPage(1);
    fetchPatientsList({ limit: newLimit, page: 1 });
  };

  const handleOpenAssignCoordinator = (patient) => {
    if (isReferral || (!isAdmin && !canAssignCoordinator)) return;
    markPatientAction(patient);
    setAssignCoordPatient(patient);
    setAssignCoordModalOpen(true);
  };

  const handleOpenAssignReferral = (patient) => {
    if (isReferral || isInsurance || (!isAdmin && !canViewSensitive)) return;
    markPatientAction(patient);
    setAssignReferralPatient(patient);
    setAssignReferralModalOpen(true);
  };

  const handleAssignReferralSuccess = (updatedData) => {
    const targetPatientId =
      updatedData?.patientId ||
      updatedData?.patientNumber ||
      updatedData?._id ||
      updatedData?.id;

    setRows((prev) =>
      prev.map((row) => {
        const id = row.patientId || row.patientNumber || row._id || row.id;
        if (String(id) === String(targetPatientId)) {
          return {
            ...row,
            referral_id: updatedData?.referral_id || "",
            Referral_Name: updatedData?.Referral_Name || "",
            referral_name: updatedData?.Referral_Name || "",
          };
        }
        return row;
      })
    );
    fetchPatientsList();
  };

  const handleOpenAssignInsurance = (patient) => {
    if (isReferral || isInsurance || (!isAdmin && !canViewSensitive)) return;
    markPatientAction(patient);
    const pId = patient?.patientId || patient?.patientNumber || patient?._id || patient?.id;
    const stored = getStoredInsuranceForPatient(pId);
    const enrichedPatient = stored
      ? {
          ...patient,
          insurance_id: patient.insurance_id || stored.insurance_id,
          Insurance_Name: patient.Insurance_Name || stored.insurance_name,
          insurance_name: patient.insurance_name || stored.insurance_name,
        }
      : patient;
    setAssignInsurancePatient(enrichedPatient);
    setAssignInsuranceModalOpen(true);
  };

  const handleAssignInsuranceSuccess = (updatedData) => {
    const targetPatientId =
      updatedData?.patientId ||
      updatedData?.patientNumber ||
      updatedData?._id ||
      updatedData?.id;

    setRows((prev) =>
      prev.map((row) => {
        const id = row.patientId || row.patientNumber || row._id || row.id;
        if (String(id) === String(targetPatientId)) {
          return {
            ...row,
            insurance_id: updatedData?.insurance_id || "",
            Insurance_Name: updatedData?.Insurance_Name || updatedData?.insurance_name || "",
            insurance_name: updatedData?.Insurance_Name || updatedData?.insurance_name || "",
          };
        }
        return row;
      })
    );
    fetchPatientsList();
  };

  const handleAssignCoordinatorSuccess = (assignedCoordinator, targetPatientId) => {
    setRows((prev) =>
      prev.map((row) => {
        const id = row.patientId || row.patientNumber || row._id || row.id;
        if (String(id) === String(targetPatientId)) {
          return {
            ...row,
            assignedCoordinator: assignedCoordinator || {
              userId: null,
              name: "",
              email: "",
              role: "Coordinator",
              phone: "",
              assignedAt: null,
              assignedBy: null,
            },
          };
        }
        return row;
      })
    );
    fetchPatientsList();
  };

  const [updatingNotificationId, setUpdatingNotificationId] = useState(null);

  const handleToggleNotification = async (e, patientInfo) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!patientInfo) return;

    const currentEnabled = isPatientNotificationEnabled(patientInfo);
    const targetState = !currentEnabled;
    const pName = patientInfo.patient_name || patientInfo.name || "Patient";

    const result = await Swal.fire({
      title: targetState ? "Enable Notifications?" : "Disable Notifications?",
      text: targetState
        ? `Are you sure you want to enable notifications for ${pName}?`
        : `Are you sure you want to disable notifications for ${pName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: targetState ? "Yes, Enable" : "Yes, Disable",
      confirmButtonColor: targetState ? "#16a34a" : "#dc2626",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    const pid =
      patientInfo.patientNumber ||
      patientInfo.patientId ||
      patientInfo._id ||
      patientInfo.id;
    setUpdatingNotificationId(pid);

    try {
      const response = await updatePatientNotification(patientInfo, targetState);
      const updatedEnabled =
        response?.data?.notificationEnabled !== undefined
          ? response.data.notificationEnabled
          : targetState;

      setRows((prev) =>
        prev.map((r) => {
          return isSamePatientRow(r, patientInfo)
            ? { ...r, notificationEnabled: updatedEnabled }
            : r;
        })
      );

      toast.success(
        response?.message ||
          `Notifications ${updatedEnabled ? "enabled" : "disabled"} for ${pName}`
      );
    } catch (err) {
      console.error("Failed to update notification status:", err);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text:
          err?.response?.data?.message ||
          err?.message ||
          "Could not update notification settings.",
      });
    } finally {
      setUpdatingNotificationId(null);
    }
  };

  const isPhysioUser = isPhysiotherapistUser();
  const currentUserId = (localStorage.getItem("_id") || "").toLowerCase();
  const currentUserName = (localStorage.getItem("name") || "").trim().toLowerCase();
  const currentUserEmail = (localStorage.getItem("email") || "").trim().toLowerCase();

  const loadPhysioMap = async () => {
    try {
      const map = await fetchPhysioAssignmentsMap();
      if (map) setPhysioAssignmentsMap(map);
    } catch (e) {
      console.warn("Could not load physio assignments map:", e);
    }
  };

  useEffect(() => {
    loadPhysioMap();
  }, []);

  const getPatientLookupKeys = (info) => {
    if (!info) return [];
    return [
      typeof info.patientId === "string" ? info.patientId : null,
      typeof info.patientId === "object" ? (info.patientId?.patientNumber || info.patientId?._id) : null,
      info.patientNumber,
      info.patientObjectId,
      info._id,
      info.id,
    ]
      .filter(Boolean)
      .map((k) => String(k).trim().toLowerCase())
      .filter((k) => k && k !== "[object object]" && k !== "undefined" && k !== "null");
  };

  const getPatientPhysioAssignment = (info) => {
    if (!info) return null;
    // If patient was unassigned or completed, do not show active assignment
    if (
      (info.needsPhysiotherapy === false && !info.assignedPhysiotherapist?.name) ||
      info.physiotherapyStatus === "Completed" ||
      info.physiotherapyStatus === "Cancelled" ||
      info.assignedPhysiotherapist === null
    ) {
      return null;
    }

    // 1. Direct from patient object (provided by backend /all_patients)
    if (info.assignedPhysiotherapist?.name) {
      return info.assignedPhysiotherapist;
    }

    const pKeys = getPatientLookupKeys(info);

    // 2. From live physio cases map ONLY if the case is active
    for (const k of pKeys) {
      const physCase = physioAssignmentsMap[k];
      if (
        physCase &&
        physCase.status !== "Completed" &&
        physCase.status !== "Cancelled" &&
        physCase.assignedPhysiotherapist?.name
      ) {
        return physCase.assignedPhysiotherapist;
      }
    }

    return null;
  };

  const getPatientPhysioCase = (info, activeOnly = false) => {
    if (!info) return null;
    const pKeys = getPatientLookupKeys(info);

    for (const k of pKeys) {
      const physCase = physioAssignmentsMap[k];
      if (physCase) {
        if (activeOnly) {
          if (
            physCase.status !== "Completed" &&
            physCase.status !== "Cancelled"
          ) {
            return physCase;
          }
        } else {
          return physCase;
        }
      }
    }
    return null;
  };

  const isPatientPhysioActive = (info) => {
    if (!info) return false;

    // 1. Explicitly unassigned or completed in patient document
    if (
      info.needsPhysiotherapy === false &&
      !info.assignedPhysiotherapist?.name
    ) {
      return false;
    }
    if (
      (info.physiotherapyStatus === "Completed" || info.physiotherapyStatus === "Cancelled") &&
      info.needsPhysiotherapy !== true &&
      info.needsPhysiotherapy !== 1 &&
      info.needsPhysiotherapy !== "true"
    ) {
      return false;
    }

    // 2. Flagged as needs physiotherapy
    if (
      info.needsPhysiotherapy === true ||
      info.needsPhysiotherapy === 1 ||
      info.needsPhysiotherapy === "true"
    ) {
      return true;
    }

    // 3. Active assigned physiotherapist
    if (getPatientPhysioAssignment(info)) {
      return true;
    }

    // 4. Active physiotherapy case (status NOT Completed or Cancelled)
    if (getPatientPhysioCase(info, true)) {
      return true;
    }

    return false;
  };

  const isCoordinator = isCoordinatorUser();
  const currentCoordUser = getCurrentCoordinatorUser();

  const isPatientAssignedToMe = (info) => {
    const therapist = getPatientPhysioAssignment(info);
    if (!therapist) return false;
    const tId = String(therapist.userId || therapist._id || therapist.staffId || "").toLowerCase();
    const tName = String(therapist.name || "").trim().toLowerCase();
    const tEmail = String(therapist.email || "").trim().toLowerCase();

    if (currentUserId && tId && (currentUserId === tId)) return true;
    if (currentUserName && tName && (currentUserName === tName)) return true;
    if (currentUserEmail && tEmail && (currentUserEmail === tEmail)) return true;
    return false;
  };

  const isPatientAssignedToMeCoordinator = (info) => {
    return isPatientAssignedToCoordinatorUser(info, currentCoordUser);
  };

  const coordinatorFilteredRows = useMemo(() => {
    if (!isCoordinator) return rows;
    return rows.filter((r) => isPatientAssignedToMeCoordinator(r));
  }, [rows, isCoordinator, currentCoordUser]);

  const displayedRows = useMemo(() => {
    let list = rows;
    if (isPhysioUser) {
      list = rows.filter((r) => isPatientAssignedToMe(r));
    } else if (isCoordinator) {
      list = coordinatorFilteredRows;
    }

    if (onlyPhysioFilter) {
      list = list.filter((r) => isPatientPhysioActive(r));
    }

    if (appliedFilters.date_from || appliedFilters.date_to) {
      list = list.filter((r) => {
        const rawDate = r.createdAt || r.created_at || r.date;
        if (!rawDate) return false;
        const itemDate = new Date(rawDate);
        if (isNaN(itemDate.getTime())) return false;
        if (appliedFilters.date_from) {
          const from = new Date(appliedFilters.date_from);
          from.setHours(0, 0, 0, 0);
          if (itemDate < from) return false;
        }
        if (appliedFilters.date_to) {
          const to = new Date(appliedFilters.date_to);
          to.setHours(23, 59, 59, 999);
          if (itemDate > to) return false;
        }
        return true;
      });
    }

    if (isCoordinator && list.length > rowsPerPage) {
      const start = (page - 1) * rowsPerPage;
      list = list.slice(start, start + rowsPerPage);
    }

    if (pdfRowLimit) {
      return (isCoordinator ? coordinatorFilteredRows : rows).slice(0, pdfRowLimit);
    }

    return list;
  }, [
    rows,
    isPhysioUser,
    isCoordinator,
    coordinatorFilteredRows,
    onlyPhysioFilter,
    page,
    rowsPerPage,
    pdfRowLimit,
    physioAssignmentsMap,
    currentUserId,
    currentUserName,
    currentUserEmail,
    appliedFilters.date_from,
    appliedFilters.date_to,
  ]);

  const stats = useMemo(() => {
    if (isCoordinator || isReferral || isInsurance) {
      const sourceList = isCoordinator ? coordinatorFilteredRows : rows;
      const total = isCoordinator
        ? coordinatorFilteredRows.length
        : (Number(pagination?.totalRecords) || rows.length || 0);
      let travelled = 0;
      let confirmed = 0;
      let pending = 0;
      let onHold = 0;
      let completed = 0;

      sourceList.forEach((r) => {
        const st = normalizePatientStatus(r.p_status || r.status);
        if (st === "Travelled") travelled++;
        else if (st === "Confirmed") confirmed++;
        else if (st === "Pending") pending++;
        else if (st === "On Hold") onHold++;
        else if (st === "Treatment Completed") completed++;
      });
      return { total, travelled, confirmed, pending, onHold, completed };
    }

    const total = dashboardTotalPatients || Number(pagination?.totalRecords) || rows.length || 0;
    const travelled = Number(dashboardStatusCounts?.Travelled) || 0;
    const confirmed = Number(dashboardStatusCounts?.Confirmed) || 0;
    const pending = Number(dashboardStatusCounts?.Pending) || 0;
    const onHold = Number(dashboardStatusCounts?.["On Hold"]) || 0;
    const completed = Number(dashboardStatusCounts?.["Treatment Completed"]) || 0;

    return { total, travelled, confirmed, pending, onHold, completed };
  }, [
    isCoordinator,
    isReferral,
    isInsurance,
    coordinatorFilteredRows,
    rows,
    dashboardTotalPatients,
    pagination?.totalRecords,
    dashboardStatusCounts,
  ]);

  const coordinatorPageCount = Math.max(
    1,
    Math.ceil(coordinatorFilteredRows.length / rowsPerPage),
  );
  const totalPagesToDisplay = isCoordinator
    ? coordinatorPageCount
    : (pagination?.totalPages || 1);

  const handleOpenAssignPhysio = (patientRow) => {
    if (isReferral || (!isAdmin && !canAssignPhysio)) return;
    markPatientAction(patientRow.patientId, patientRow.patientNumber);
    const existingCase = getPatientPhysioCase(patientRow);
    const existingAssignment = getPatientPhysioAssignment(patientRow);
    setAssignPhysioPatient(patientRow);
    setAssignPhysioExistingCase(
      existingCase || (existingAssignment ? { assignedPhysiotherapist: existingAssignment } : null)
    );
    setAssignPhysioModalOpen(true);
  };

  const handleQuickMarkPhysio = async (patientRow) => {
    if (isReferral || (!isAdmin && !canAssignPhysio)) return;
    markPatientAction(patientRow.patientId, patientRow.patientNumber);

    const isMarked = isPatientPhysioActive(patientRow);

    const patientName = patientRow.patient_name || patientRow.name || "Patient";
    const patientIdentifier = patientRow.patientNumber || patientRow.patientId;

    if (isMarked) {
      const result = await Swal.fire({
        title: "Physiotherapy Status",
        html: `<b>${patientName}</b> (<code>${patientIdentifier}</code>) is marked as <b>Needs Physiotherapy</b>.<br/><br/>Choose an action:`,
        icon: "info",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonColor: "#0284c7",
        denyButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: '<i class="fa fa-file-medical me-1"></i> Create / Edit Case',
        denyButtonText: '<i class="fa fa-user-xmark me-1"></i> Unassign / Clear Physio',
        cancelButtonText: "Close",
      });

      if (result.isConfirmed) {
        setCreatePhysioPatient(patientRow);
        setCreatePhysioModalOpen(true);
      } else if (result.isDenied) {
        // Direct unassign flow using Option A (or fallback Option B)
        const confirmUnassign = await Swal.fire({
          title: "Unassign Physiotherapy?",
          html: `Are you sure you want to unassign physiotherapy for <b>${patientName}</b> (<code>${patientIdentifier}</code>)?<br/><br/><small class="text-muted">This will unassign the physiotherapist and clear their need-physiotherapy flag.</small>`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#64748b",
          confirmButtonText: '<i class="fa fa-user-xmark me-1"></i> Yes, Unassign Immediately',
          cancelButtonText: "Cancel",
        });

        if (confirmUnassign.isConfirmed) {
          try {
            Swal.fire({
              title: "Unassigning...",
              text: "Please wait while unassigning patient...",
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              },
            });

            await unassignPatientFromPhysiotherapist({
              patient: patientRow,
              patientId: patientRow.patientNumber || patientRow.patientId,
              patientObjectId: patientRow._id,
              notes: "Physiotherapist unassigned",
            });

            // Update ONLY this patient row locally
            setRows((prev) =>
              prev.map((r) =>
                isSamePatientRow(r, patientRow)
                  ? { ...r, needsPhysiotherapy: false }
                  : r
              )
            );

            loadPhysioMap();
            fetchPatientsList();

            Swal.fire({
              title: "Unassigned Successfully",
              html: `<b>${patientName}</b> (<code>${patientIdentifier}</code>) has been unassigned from Physiotherapy.`,
              icon: "success",
            });
          } catch (err) {
            Swal.fire(
              "Error",
              typeof err === "string" ? err : err?.message || "Failed to unassign patient",
              "error"
            );
          }
        }
      }
      return;
    }

    // Stage 1: Quick Mark Patient
    const confirmResult = await Swal.fire({
      title: "Mark for Physiotherapy?",
      html: `Clicking <b>Need Physio</b> will flag <b>${patientName}</b> (<code>${patientIdentifier}</code>) as needing physiotherapy.<br/><br/><small class="text-muted">Stage 1: No doctor or form is needed now. The patient will appear in the Physiotherapy Create Case dropdown.</small>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0284c7",
      cancelButtonColor: "#64748b",
      confirmButtonText: '<i class="fa fa-check me-1"></i> Yes, Mark Need Physio',
      cancelButtonText: "Cancel",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      await quickMarkPatientNeedPhysio(patientRow);

      // Instantly update ONLY this patient row locally
      setRows((prev) =>
        prev.map((r) =>
          isSamePatientRow(r, patientRow)
            ? { ...r, needsPhysiotherapy: true }
            : r
        )
      );

      loadPhysioMap();
      fetchPatientsList();

      const nextAction = await Swal.fire({
        title: "Marked for Physiotherapy!",
        html: `<b>${patientName}</b> is now flagged for Physiotherapy.<br/>They are now available in the <b>Create Physiotherapy Case</b> form.`,
        icon: "success",
        showCancelButton: true,
        confirmButtonColor: "#0284c7",
        cancelButtonColor: "#64748b",
        confirmButtonText: '<i class="fa fa-file-medical me-1"></i> Create Case Now',
        cancelButtonText: "Stay on Patient List",
      });

      if (nextAction.isConfirmed) {
        setCreatePhysioPatient(patientRow);
        setCreatePhysioModalOpen(true);
      }
    } catch (err) {
      Swal.fire(
        "Error",
        typeof err === "string" ? err : err?.message || "Failed to mark patient for physiotherapy",
        "error"
      );
    }
  };

  const handleAssignPhysioSuccess = (assignedTherapist, targetPatientId) => {
    if (targetPatientId) {
      setRows((prev) =>
        prev.map((row) => {
          const id = row.patientId || row.patientNumber || row._id || row.id;
          if (String(id) === String(targetPatientId)) {
            return {
              ...row,
              assignedPhysiotherapist: assignedTherapist || null,
              needsPhysiotherapy: Boolean(assignedTherapist),
            };
          }
          return row;
        })
      );
    }
    loadPhysioMap();
    fetchPatientsList();
  };

  const getPatientFetchParams = (overrides = {}) => {
    const refId = isReferralUser() ? getReferralId() : "";
    const insId = isInsuranceUser() ? getInsuranceId() : "";
    const dFrom = overrides.startDate || overrides.dateFrom || overrides.date_from || overrides.fromDate || appliedFilters.date_from;
    const dTo = overrides.endDate || overrides.dateTo || overrides.date_to || overrides.toDate || appliedFilters.date_to;
    return {
      page: overrides.page ?? page,
      limit: overrides.limit ?? rowsPerPage,
      search: overrides.search ?? searchTerm,
      p_status: overrides.p_status ?? appliedFilters.p_status,
      patient_type_new:
        overrides.patient_type_new ?? appliedFilters.patient_type_new,
      country: overrides.country ?? appliedFilters.country,
      treatingIn: overrides.treatingIn ?? appliedFilters.treatingIn,
      patient: overrides.patient ?? appliedFilters.patient,
      treatment: overrides.treatment ?? appliedFilters.treatment,
      sortField: overrides.sortField ?? orderBy,
      sortOrder: overrides.sortOrder ?? order,
      ...(dFrom ? { startDate: dFrom, dateFrom: dFrom, date_from: dFrom, fromDate: dFrom } : {}),
      ...(dTo ? { endDate: dTo, dateTo: dTo, date_to: dTo, toDate: dTo } : {}),
      ...(refId ? { referral_id: refId } : {}),
      ...(isReferralUser() && overrides.referral_id ? { referral_id: overrides.referral_id } : {}),
      ...(insId ? { insurance_id: insId } : {}),
      ...(isInsuranceUser() && overrides.insurance_id ? { insurance_id: overrides.insurance_id } : {}),
      ...(isCoordinator && currentCoordUser.id ? { coordinatorId: currentCoordUser.id, coordinator_id: currentCoordUser.id } : {}),
      ...(isCoordinator && currentCoordUser.name ? { coordinatorName: currentCoordUser.name } : {}),
    };
  };

  const resolveHospitalId = async () => {
    const cached = getHospitalId();
    if (cached) return cached;
    const userId = localStorage.getItem("_id");
    if (!userId || !isMongoObjectId(userId) || isReferralUser() || isInsuranceUser()) {
      return "";
    }
    try {
      const userResult = await fetchAndApplyUserDetails(
        userId,
        localStorage.getItem("token")
      );
      const details = userResult?.details || {};
      const hospitalId =
        details.hospital_id ??
        details.hospitalId ??
        details.hospital?.hospital_id ??
        details.hospital?.hospitalId ??
        details.hospital?.id ??
        "";
      if (hospitalId !== "" && hospitalId != null) {
        localStorage.setItem("hospital_id", String(hospitalId));
        return String(hospitalId);
      }
    } catch (err) {
      console.error("Failed to resolve hospital id:", err);
    }
    return "";
  };

  const fetchPatientsList = async (overrides = {}) => {
    const params = getPatientFetchParams(overrides);
    return dispatch(GetAllPatients(params));
  };

  const handleJobTitleChange = (event, value) => {
    setSelectedJobTitle(value);
  };

  useEffect(() => {
    dispatch(GetAllTreatment());
    dispatch(GetAllCountries2());
  }, [dispatch]);
  useEffect(() => {
    if (Treatment) {
      setTreatmentname(Treatment);
    }
  }, [Treatment]);
  useEffect(() => {
    if (statusFromUrl) {
      const normalized = normalizePatientStatus(statusFromUrl);
      const next = { ...EMPTY_PATIENT_FILTERS, p_status: normalized };
      appliedPatientRef.current = "";
      setPatientNameInput("");
      setAppliedFilters(next);
      setPage(1);
    }
  }, [statusFromUrl]);

  useEffect(() => {
    if (typeFromUrl) {
      const next = { ...EMPTY_PATIENT_FILTERS, patient_type_new: typeFromUrl };
      appliedPatientRef.current = "";
      setPatientNameInput("");
      setAppliedFilters(next);
      setPage(1);
    }
  }, [typeFromUrl]);

  useEffect(() => {
    if (!showActions) return;
    fetchPatientsList();
  }, [
    dispatch,
    page,
    rowsPerPage,
    searchTerm,
    appliedFilters,
    orderBy,
    order,
    showActions,
  ]);
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };
  useEffect(() => {
    // If API returns empty or undefined → clear table
    if (!patient || patient.length === 0) {
      setRows([]);
      setSearchApiData([]);
    } else {
      const processed = patient.map((row) => {
        const unseen = isPatientRecordUnseen(row);
        const bold = isPatientRecordBold(row);
        return {
          ...row,
          isUnread: unseen,
          isUnseen: unseen,
          isSeen: !unseen,
          isBold: bold,
          p_status: normalizePatientStatus(row.p_status) || row.p_status,
        };
      });
      setRows(pinUnreadPatientsFirst(processed));
      setSearchApiData(processed);
    }
  }, [patient]);
  useEffect(() => {
    // If API gives 404 or error → clear table
    if (error) {
      setRows([]);
      setSearchApiData([]);
    }
  }, [error]);

  const markPatientAction = (patientOrId, optionalPatientNumber) => {
    const patientObj = (patientOrId && typeof patientOrId === "object") ? patientOrId : null;
    const pId = patientObj
      ? (patientObj.patientId || patientObj.patientNumber || patientObj.id || patientObj._id)
      : patientOrId;
    const pNum = patientObj
      ? (patientObj.patientNumber || patientObj.patientId)
      : optionalPatientNumber;

    const row = patientObj || rows.find(
      (item) =>
        (pId && (
          String(item.patientId || "") === String(pId) ||
          String(item.patientNumber || "") === String(pId) ||
          String(item.id || "") === String(pId) ||
          String(item._id || "") === String(pId)
        )) ||
        (pNum && (
          String(item.patientNumber || "") === String(pNum) ||
          String(item.patientId || "") === String(pNum)
        )),
    );

    const recordId = pickPatientRecordId(
      pNum,
      row?.patientNumber,
      pId,
      row?.patientId,
      row?.id,
      row?._id,
    );
    if (!recordId) return;

    markRecordRead("patients", recordId);
    markPatientSeenLocally(recordId, row?.patientNumber, row?.patientId, pNum, pId);
    setRows((prev) =>
      clearUnreadById(prev, recordId, ["patientNumber", "patientId", "id", "_id"]),
    );
  };

  const handleMarkSinglePatientRead = async (patient) => {
    if (!patient) return;
    const recordId = pickPatientRecordId(
      patient.patientNumber,
      patient.patientId,
      patient.id,
      patient._id,
    );
    if (!recordId) return;

    await markRecordRead("patients", recordId);
    markPatientSeenLocally(recordId, patient.patientNumber, patient.patientId);

    setRows((prev) =>
      prev.map((r) => {
        const matches =
          String(r.patientNumber || "") === String(recordId) ||
          String(r.patientId || "") === String(recordId) ||
          String(r.id || "") === String(recordId) ||
          String(r._id || "") === String(recordId);
        if (matches) {
          return {
            ...r,
            isUnread: false,
            is_unread: 0,
            isUnseen: false,
            is_unseen: 0,
            isSeen: true,
            is_seen: 1,
            isBold: false,
            is_bold: false,
          };
        }
        return r;
      })
    );

    toast.success(`Patient ${recordId} marked as read`);
  };
  const EditButton = (e, id, rowData) => {
    if (isReferral) return;
    markPatientAction(id, rowData?.patientNumber);
    navigate("/Admin/edit-patient", {
      state: {
        patientId: id,
        patientData: rowData,
      },
    });
  };
  const PatientDetail = (e, id, enq, c, d, treat, createdAt, patientNumber) => {
    console.log(
      e,
      id,
      enq,
      c,
      d,
      "dddddddddddddddddddddddddddddddddddddddddddsh",
    );
    markPatientAction(id, patientNumber);
    navigate("/Admin/Patient-Detail", {
      state: {
        patientId: id,
        patientNumber,
        enqId: enq,
        testid: c,
        // tratmentlit: d,
        user_id: d,
        createdAt: createdAt,
      },
    });
  };

  const fetchPatientActivityLogs = async (patientId, pageNum) => {
    if (!patientId) return;
    setActivityLoading(true);
    try {
      const response = await axios.get(
        `${baseurl}get_patient_activity_logs/${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          params: { page: pageNum, limit: 10 },
        },
      );

      const logs = extractActivityLogs(response.data);
      const pagination = extractActivityLogPagination(response.data, 10);

      setActivityLogs(logs);
      setActivityPage(pageNum);
      setActivityTotalPages(pagination.totalPages);
      setActivityTotalRecords(pagination.totalRecords);
    } catch (err) {
      setActivityLogs([]);
      setActivityTotalPages(1);
      setActivityTotalRecords(0);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch patient activity logs",
      );
    } finally {
      setActivityLoading(false);
    }
  };

  const handleOpenPatientActivity = (patientId, patientInfo = null, defaultTab = "logs") => {
    markPatientAction(patientId);
    if (!patientId) return;
    setActivityPatientId(patientId);
    setActivityPatient(patientInfo);
    setActivityTab(defaultTab);
    setActivityOpen(true);
    setActivityPage(1);
    if (defaultTab === "logs") {
      fetchPatientActivityLogs(patientId, 1);
    }
  };

  const handleClosePatientActivity = () => {
    setActivityOpen(false);
    setActivityPatientId("");
    setActivityPatient(null);
    setActivityPage(1);
    setActivityTotalPages(1);
    setActivityTotalRecords(0);
    setActivityLogs([]);
  };

  const handleActivityPageChange = (event, newPage) => {
    fetchPatientActivityLogs(activityPatientId, newPage);
  };

  const formatNoteDate = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(d);
    }
  };

  const handleOpenPatientNotes = async (e, patientInfo) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!patientInfo) return;

    const targetId =
      typeof patientInfo === "object"
        ? patientInfo.patientNumber || patientInfo.patientId || patientInfo.id || patientInfo._id
        : patientInfo;

    const fallbackId =
      typeof patientInfo === "object"
        ? patientInfo.patientId || patientInfo.patientNumber || patientInfo.id || patientInfo._id
        : patientInfo;

    const actionId =
      typeof patientInfo === "object"
        ? patientInfo.patientId || patientInfo.id || targetId
        : targetId;

    const patientName =
      typeof patientInfo === "object"
        ? patientInfo.patient_name || patientInfo.name || ""
        : "";

    const patientNum =
      typeof patientInfo === "object"
        ? patientInfo.patientNumber || patientInfo.patientId || ""
        : "";

    markPatientAction(actionId, patientNum);

    setNotePatientId(fallbackId || targetId);
    setNotePatientName(patientName);
    setNotePatientNumber(patientNum);

    const initialNotes = Array.isArray(patientInfo?.discussionNotes)
      ? patientInfo.discussionNotes
      : [];
    setDiscussionNotes(initialNotes);
    setNotePatientRow(patientInfo);
    setNoteText("");
    setNoteDate(new Date().toISOString().slice(0, 10));
    setNoteError({ note: false, date: false });
    setNoteSubmitting(false);

    setOpenPatientNotes(true);
    setNotesLoading(true);

    const token = localStorage.getItem("token");
    try {
      let notes = [];
      let detail = null;
      try {
        const res = await axios.get(
          `${baseurl}get_patient/${encodeURIComponent(targetId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        detail = res.data?.detail || res.data?.data || res.data;
        notes = Array.isArray(detail?.discussionNotes)
          ? detail.discussionNotes
          : Array.isArray(detail?.discussion_notes)
            ? detail.discussion_notes
            : [];
      } catch (err1) {
        if (fallbackId && fallbackId !== targetId) {
          const res2 = await axios.get(
            `${baseurl}get_patient/${encodeURIComponent(fallbackId)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );
          detail = res2.data?.detail || res2.data?.data || res2.data;
          notes = Array.isArray(detail?.discussionNotes)
            ? detail.discussionNotes
            : Array.isArray(detail?.discussion_notes)
              ? detail.discussion_notes
              : [];
        } else {
          throw err1;
        }
      }

      setDiscussionNotes(notes);
      if (!patientName && (detail?.patient_name || detail?.name)) {
        setNotePatientName(detail?.patient_name || detail?.name);
      }
      if (!patientNum && (detail?.patientNumber || detail?.patientId)) {
        setNotePatientNumber(detail?.patientNumber || detail?.patientId);
      }
      if (detail?.patientId) {
        setNotePatientId(detail.patientId);
      }
    } catch (err) {
      console.error("Failed to fetch discussion notes via get_patient:", err);
      if (initialNotes.length === 0) {
        toast.error("Failed to load discussion notes");
      }
    } finally {
      setNotesLoading(false);
    }
  };

  const handleClosePatientNotes = () => {
    setOpenPatientNotes(false);
    setNotePatientId("");
    setNotePatientName("");
    setNotePatientNumber("");
    setNotePatientRow(null);
    setDiscussionNotes([]);
    setNotesLoading(false);
    setNoteText("");
    setNoteDate("");
    setNoteError({ note: false, date: false });
    setNoteSubmitting(false);
  };

  const handleAddPatientNote = async (e) => {
    e?.preventDefault?.();
    if (isReferral) return;
    const nextError = {
      note: !noteText.trim(),
      date: !noteDate,
    };
    setNoteError(nextError);
    if (nextError.note || nextError.date) return;

    const targetPatientId =
      notePatientNumber ||
      notePatientId ||
      notePatientRow?.patientNumber ||
      notePatientRow?.patientId ||
      notePatientRow?._id ||
      notePatientRow?.id;

    if (!targetPatientId) {
      toast.error("Patient ID missing — cannot add note");
      return;
    }

    setNoteSubmitting(true);
    try {
      const candidateIds = [
        targetPatientId,
        notePatientRow?.patientNumber,
        notePatientRow?.patientId,
        notePatientRow?._id,
        notePatientRow?.id,
      ].filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx);

      let success = false;
      let lastError = null;

      for (const cId of candidateIds) {
        try {
          await addPatientNotes(cId, {
            note: noteText.trim(),
            date: noteDate,
          });
          success = true;
          break;
        } catch (err) {
          lastError = err;
          if (err?.response?.status === 404 && candidateIds.length > 1) {
            continue;
          }
          throw err;
        }
      }

      if (!success && lastError) {
        throw lastError;
      }

      const addedByName = localStorage.getItem("name") || "";
      const addedByRole = localStorage.getItem("Role") || "";
      const addedBy =
        addedByName && addedByRole
          ? `${addedByName} (${addedByRole})`
          : addedByName || addedByRole || "";

      const newNote = {
        note: noteText.trim(),
        date: noteDate,
        addedBy,
      };

      setDiscussionNotes((prev) => [
        newNote,
        ...(Array.isArray(prev) ? prev : []),
      ]);

      if (notePatientRow) {
        setRows((prev) =>
          prev.map((r) => {
            if (!isSamePatientRow(r, notePatientRow)) return r;
            const existing = Array.isArray(r.discussionNotes)
              ? r.discussionNotes
              : [];
            return {
              ...r,
              discussionNotes: [newNote, ...existing],
            };
          })
        );
      }

      toast.success("Note added successfully");
      setNoteText("");
      setNoteDate(new Date().toISOString().slice(0, 10));
      setNoteError({ note: false, date: false });
    } catch (err) {
      console.error("Failed to add patient note:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to add note"
      );
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handledelet = (e, patientId) => {
    if (isReferral) return;
    markPatientAction(patientId);
    e.preventDefault();
    const swalWithBootstrapButtons = Swal.mixin({
      customClass: {
        confirmButton: "btn btn-success",
        cancelButton: "btn btn-danger",
      },
      buttonsStyling: false,
    });
    swalWithBootstrapButtons
      .fire({
        title: "Are you sure?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "No, cancel!",
        reverseButtons: true,
      })
      .then(async (result) => {
        if (result.isConfirmed) {
          try {
            await dispatch(DeletePatient({ id: patientId })).unwrap();
            await fetchPatientsList();
            Swal.fire("Deleted!", "Patient has been deleted.", "success");
          } catch (err) {
            Swal.fire("Error!", err?.message || "An error occurred", "error");
          }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          swalWithBootstrapButtons.fire({
            title: "Cancelled",
            icon: "info",
          });
        }
      });
  };
  const handleSampleFile = async () => {
    try {
      const params = getPatientFetchParams({ page: 1, limit: 10000 });
      const queryParams = new URLSearchParams();
      queryParams.append("page", 1);
      queryParams.append("limit", 10000);
      if (params.search) queryParams.append("search", params.search);
      if (params.p_status) queryParams.append("p_status", params.p_status);
      if (params.patient_type_new)
        queryParams.append("patient_type_new", params.patient_type_new);
      if (params.country) queryParams.append("country", params.country);
      if (params.treatingIn) queryParams.append("treatingIn", params.treatingIn);
      if (params.patient) queryParams.append("patient", params.patient);
      if (params.treatment) {
        queryParams.append("treatment", params.treatment);
        queryParams.append("treatment_course_name", params.treatment);
      }
      if (params.startDate || params.date_from) {
        const fromVal = params.startDate || params.date_from;
        queryParams.append("startDate", fromVal);
        queryParams.append("dateFrom", fromVal);
        queryParams.append("date_from", fromVal);
      }
      if (params.endDate || params.date_to) {
        const toVal = params.endDate || params.date_to;
        queryParams.append("endDate", toVal);
        queryParams.append("dateTo", toVal);
        queryParams.append("date_to", toVal);
      }
      if (isReferralUser() && params.referral_id) queryParams.append("referral_id", params.referral_id);
      if (isInsuranceUser() && params.insurance_id) queryParams.append("insurance_id", params.insurance_id);
      if (isCoordinator && currentCoordUser.id) {
        queryParams.append("coordinatorId", currentCoordUser.id);
        queryParams.append("coordinator_id", currentCoordUser.id);
      }

      let patientsToExport = isCoordinator ? coordinatorFilteredRows : rows;
      try {
        const response = await axios.get(
          `${baseurl}all_patients?${queryParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );
        const data =
          response?.data?.details ||
          response?.data?.data?.details ||
          response?.data?.patients ||
          response?.data?.data ||
          response?.data;
        if (Array.isArray(data) && data.length > 0) {
          patientsToExport = isCoordinator
            ? data.filter((p) => isPatientAssignedToMeCoordinator(p))
            : data;
        }
      } catch (e) {
        console.warn("Using current rows for export:", e);
      }

      if (isCoordinator) {
        patientsToExport = patientsToExport.filter((p) =>
          isPatientAssignedToMeCoordinator(p)
        );
      }

      if (!patientsToExport || patientsToExport.length === 0) {
        Swal.fire("Info", "No patients available to export", "info");
        return;
      }

      downloadPatientsExcel(patientsToExport, isAdmin);
      Swal.fire("Success", "Patient sheet exported to Excel successfully!", "success");
    } catch (err) {
      console.error(
        "Error downloading patient file:",
        err.response?.data?.message || err.message,
      );
      Swal.fire(
        "Error",
        err.response?.data?.message || "Failed to export patient sheet",
        "error",
      );
    }
  };
  const handleExportPatientActivityExcel = () => {
    if (!activityLogs || activityLogs.length === 0) {
      Swal.fire("Info", "No activity logs available to export", "info");
      return;
    }
    const excelHtml = `\uFEFF${buildPatientActivityLogsExcelHtml(
      activityLogs,
      activityPatientId,
    )}`;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `patient-activity-logs-${activityPatientId || "export"}-${stamp}.xls`;
    downloadActivityLogsFile(
      excelHtml,
      filename,
      "application/vnd.ms-excel;charset=utf-8;",
    );
    toast.success("Patient activity logs exported to Excel successfully!");
  };
  const downloadPdf = async () => {
    const listToPdf = isCoordinator ? coordinatorFilteredRows : rows;
    const maxRows = listToPdf.length || 1;
    Swal.fire({
      title: "Enter number of rows for PDF",
      input: "number",
      inputLabel: `Choose between 1 and ${maxRows}`,
      inputAttributes: {
        min: "1",
        max: maxRows.toString(),
        step: "1",
      },
      inputValue: rowsPerPage,
      showCancelButton: true,
      confirmButtonText: "Generate PDF",
    }).then((result) => {
      if (result.isConfirmed) {
        const userInput = parseInt(result.value, 10);
        if (isNaN(userInput) || userInput < 1 || userInput > maxRows) {
          Swal.fire(
            "Invalid entry",
            `Please enter a number between 1 and ${maxRows}`,
            "error",
          );
          return;
        }
        setPdfRowLimit(userInput);
        setTimeout(() => {
          toPDF();
          setPdfRowLimit(null);
        }, 300);
      }
    });
  };
  const handleChangtype = async (e, i) => {
    if (isReferral) return;
    markPatientAction(i);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authorization token is missing");
      }
      const response = await axios.post(
        `${baseurl}changePatientTypeStatus/${i}`,
        { p_status: e.target.value },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.status === 200 || response.status === 201) {
        fetchPatientsList();
        Swal.fire(
          "Success!",
          "patient status updated successfully!",
          "success",
        );
      } else {
        throw new Error("Failed to update status. Please try again!");
      }
    } catch (err) {
      console.error("Full Error:", err);
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else if (err.message) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again!");
      }
    }
  };
  const applyPatientStatusUpdate = (patientId, savedStatus) => {
    setRows((prev) =>
      prev.map((row) =>
        row.patientId === patientId ? { ...row, p_status: savedStatus } : row,
      ),
    );
    fetchPatientsList();
  };

  const postPatientStatus = async (patientId, payload) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authorization token is missing");
    }

    const formData = new FormData();
    const statusVal = payload.p_status || payload.status;
    if (statusVal) {
      formData.append("p_status", statusVal);
    }
    if (payload.travelDetails) {
      const detailsStr = typeof payload.travelDetails === "object"
        ? JSON.stringify(payload.travelDetails)
        : payload.travelDetails;
      formData.append("travelDetails", detailsStr);
    }
    if (payload.travelDocuments) {
      const docs = Array.isArray(payload.travelDocuments)
        ? payload.travelDocuments
        : [payload.travelDocuments];
      docs.forEach((file) => {
        if (file) {
          formData.append("travelDocuments", file);
        }
      });
    }
    if (payload.travelDocumentLabels) {
      if (Array.isArray(payload.travelDocumentLabels)) {
        if (payload.travelDocumentLabels.length === 1) {
          formData.append("travelDocumentLabels", payload.travelDocumentLabels[0]);
        } else {
          formData.append("travelDocumentLabels", JSON.stringify(payload.travelDocumentLabels));
        }
      } else {
        formData.append("travelDocumentLabels", payload.travelDocumentLabels);
      }
    }

    const response = await axios.post(
      `${baseurl}changePatientStatus/${patientId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );
    if (response.status !== 200 && response.status !== 201) {
      throw new Error("Failed to update status. Please try again!");
    }
    return normalizePatientStatus(
      response.data?.data?.p_status ??
      response.data?.p_status ??
      response.data?.details?.p_status ??
      statusVal,
    );
  };

  const handleChangefffff = async (e, patientId, patientName = "") => {
    if (isReferral) return;
    markPatientAction(patientId);
    const newStatus = normalizePatientStatus(e.target.value);
    if (isTravelStatus(newStatus)) {
      setTravelStatusModal({
        open: true,
        patientId,
        patientName:
          patientName ||
          rows.find((row) => row.patientId === patientId)?.patient_name ||
          rows.find((row) => row.patientId === patientId)?.name ||
          "",
        status: newStatus,
      });
      return;
    }
    try {
      const savedStatus = await postPatientStatus(patientId, {
        p_status: newStatus,
      });
      applyPatientStatusUpdate(patientId, savedStatus);
      Swal.fire(
        "Success!",
        "patient status updated successfully!",
        "success",
      );
    } catch (err) {
      console.error("Full Error:", err);
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else if (err.message) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again!");
      }
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
    markPatientAction(patientId);
    if (!patientId) return;
    setTravelStatusSubmitting(true);
    try {
      const savedStatus = await postPatientStatus(patientId, payload);
      applyPatientStatusUpdate(patientId, savedStatus);
      setTravelStatusModal({
        open: false,
        patientId: "",
        patientName: "",
        status: "",
      });
      Swal.fire(
        "Success!",
        "patient status updated successfully!",
        "success",
      );
    } catch (err) {
      console.error("Full Error:", err);
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else if (err.message) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again!");
      }
    } finally {
      setTravelStatusSubmitting(false);
    }
  };
  const handleclickondata = () => {
    setShowActions(true);
    fetchPatientsList();
  };
  const handleclickpostdatadesltes = async () => {
    setShowActions(false);
    try {
      const response = await axios.get(`${baseurl}getAllDeletedPatients`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      if (response) {
        setRows(response.data.data);
      } else {
        console.log("something went wrong");
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = patientNameInput.trim();
      if (appliedPatientRef.current === next) return;
      appliedPatientRef.current = next;
      setAppliedFilters((prev) => ({ ...prev, patient: next }));
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [patientNameInput]);

  const updatePatientFilter = (field, value) => {
    setAppliedFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const clearPatientFilter = () => {
    appliedPatientRef.current = "";
    setPatientNameInput("");
    setAppliedFilters(EMPTY_PATIENT_FILTERS);
    setOnVaue("");
    setPage(1);
    navigate("/Admin/patients", { replace: true });
  };
  const hasActiveFilter =
    hasAnyPatientFilter(appliedFilters) || Boolean(patientNameInput.trim());
  const countryFilterOptions = [
    ...new Set((Countries || []).map((con) => con?.name).filter(Boolean)),
  ];
  const treatmentFilterOptions = [
    ...new Set(
      (treatmentname || [])
        .map((item) => getTreatmentFilterLabel(item))
        .filter(Boolean),
    ),
  ];
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    const direction = isAsc ? "desc" : "asc";

    setOrder(direction);
    setOrderBy(property);
  };

  return (
    <>
      <div className="page-wrapper patient-page-wrapper">
        <div className="content">
          {/* Workspace notice alerts */}
          {isPhysioUser && (
            <div
              className="alert alert-info d-flex align-items-center justify-content-between p-2 px-3 mb-3 rounded-3 shadow-sm"
              style={{
                background: "#e0f2fe",
                border: "1px solid #7dd3fc",
                color: "#0369a1",
                fontSize: "13.5px",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-person-walking fa-lg" />
                <span>
                  <strong>Physiotherapist Workspace:</strong> Displaying only patients assigned to you ({displayedRows.length} {displayedRows.length === 1 ? "patient" : "patients"}).
                </span>
              </div>
              <span className="badge bg-primary">Physiotherapy Role</span>
            </div>
          )}
          {isCoordinator && (
            <div
              className="alert alert-info d-flex align-items-center justify-content-between p-2 px-3 mb-3 rounded-3 shadow-sm"
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                color: "#166534",
                fontSize: "13.5px",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-user-tie fa-lg" />
                <span>
                  <strong>Coordinator Workspace:</strong> Displaying only patients assigned to you ({coordinatorFilteredRows.length} {coordinatorFilteredRows.length === 1 ? "patient" : "patients"}).
                </span>
              </div>
              <span className="badge bg-success">Coordinator Role</span>
            </div>
          )}

          {/* Top KPI Cards Grid (Matches CRM Patient Statuses & Dashboard counts) */}
          {showActions && (
            <div className="patient-kpi-grid">
              {/* 1. Total Patients */}
              <div
                className={`patient-kpi-card ${!appliedFilters.p_status && !onlyPhysioFilter ? "active-kpi" : ""}`}
                onClick={() => {
                  setOnlyPhysioFilter(false);
                  updatePatientFilter("p_status", "");
                }}
                title="Click to view all patients"
              >
                <div className="patient-kpi-icon blue">
                  <i className="fa-solid fa-users" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{stats.total ?? 0}</h3>
                  <span>Total Patients</span>
                </div>
              </div>

              {/* 2. Travelled */}
              <div
                className={`patient-kpi-card ${appliedFilters.p_status === "Travelled" ? "active-kpi" : ""}`}
                onClick={() => {
                  setOnlyPhysioFilter(false);
                  if (appliedFilters.p_status === "Travelled") {
                    updatePatientFilter("p_status", "");
                  } else {
                    updatePatientFilter("p_status", "Travelled");
                  }
                }}
                title="Click to filter Travelled patients"
              >
                <div className="patient-kpi-icon green">
                  <i className="fa-solid fa-plane" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{stats.travelled ?? 0}</h3>
                  <span>Travelled</span>
                </div>
              </div>

              {/* 3. Confirmed */}
              <div
                className={`patient-kpi-card ${appliedFilters.p_status === "Confirmed" ? "active-kpi" : ""}`}
                onClick={() => {
                  setOnlyPhysioFilter(false);
                  if (appliedFilters.p_status === "Confirmed") {
                    updatePatientFilter("p_status", "");
                  } else {
                    updatePatientFilter("p_status", "Confirmed");
                  }
                }}
                title="Click to filter Confirmed patients"
              >
                <div className="patient-kpi-icon teal">
                  <i className="fa-solid fa-circle-check" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{stats.confirmed ?? 0}</h3>
                  <span>Confirmed</span>
                </div>
              </div>

              {/* 4. Pending */}
              <div
                className={`patient-kpi-card ${appliedFilters.p_status === "Pending" ? "active-kpi" : ""}`}
                onClick={() => {
                  setOnlyPhysioFilter(false);
                  if (appliedFilters.p_status === "Pending") {
                    updatePatientFilter("p_status", "");
                  } else {
                    updatePatientFilter("p_status", "Pending");
                  }
                }}
                title="Click to filter Pending patients"
              >
                <div className="patient-kpi-icon amber">
                  <i className="fa-solid fa-clock" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{stats.pending ?? 0}</h3>
                  <span>Pending</span>
                </div>
              </div>

              {/* 5. On Hold */}
              <div
                className={`patient-kpi-card ${appliedFilters.p_status === "On Hold" ? "active-kpi" : ""}`}
                onClick={() => {
                  setOnlyPhysioFilter(false);
                  if (appliedFilters.p_status === "On Hold") {
                    updatePatientFilter("p_status", "");
                  } else {
                    updatePatientFilter("p_status", "On Hold");
                  }
                }}
                title="Click to filter On Hold patients"
              >
                <div className="patient-kpi-icon purple">
                  <i className="fa-solid fa-circle-pause" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{stats.onHold ?? 0}</h3>
                  <span>On Hold</span>
                </div>
              </div>

              {/* 6. Treatment Completed */}
              <div
                className={`patient-kpi-card ${appliedFilters.p_status === "Treatment Completed" ? "active-kpi" : ""}`}
                onClick={() => {
                  setOnlyPhysioFilter(false);
                  if (appliedFilters.p_status === "Treatment Completed") {
                    updatePatientFilter("p_status", "");
                  } else {
                    updatePatientFilter("p_status", "Treatment Completed");
                  }
                }}
                title="Click to filter Treatment Completed patients"
              >
                <div className="patient-kpi-icon indigo">
                  <i className="fa-solid fa-suitcase-medical" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{stats.completed ?? 0}</h3>
                  <span>Treatment Completed</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Toolbar & Search Card */}
          <div className="patient-toolbar-card">
            <div className="patient-header-flex">
              <div className="patient-title-area">
                <h6 className="patient-page-title">
                  {showActions ? "Patients Directory" : "Deleted Patients Archive"}
                </h6>
                <span className="patient-count-badge">
                  {displayedRows.length} of {pagination?.totalRecords || rows.length} Patients
                </span>
                {onlyPhysioFilter && (
                  <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1" style={{ fontSize: "11px" }}>
                    <i className="fa-solid fa-filter" /> Physio Filter Active
                    <i
                      className="fa-solid fa-times ms-1"
                      style={{ cursor: "pointer" }}
                      onClick={() => setOnlyPhysioFilter(false)}
                    />
                  </span>
                )}
              </div>

              <div className="patient-actions-group">
                {/* Search Box */}
                <div className="patient-search-input-box">
                  <TextField
                    fullWidth
                    placeholder="Search by name, ID, phone..."
                    size="small"
                    value={searchTerm}
                    onChange={handleSearch}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <i className="fa-solid fa-magnifying-glass text-muted" style={{ fontSize: 13 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          {searchTerm && (
                            <IconButton onClick={() => setSearchTerm("")} size="small">
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          )}
                        </InputAdornment>
                      ),
                      sx: { height: 36, fontSize: "13px", backgroundColor: "#fff", borderRadius: "8px" },
                    }}
                  />
                </div>

                {/* Filter Toggle Button */}
                {showActions && (
                  <button
                    type="button"
                    className={`patient-btn ${showAdvancedFilters || hasActiveFilter ? "active" : ""}`}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    title="Toggle Advanced Filters"
                  >
                    <i className="fa-solid fa-sliders" />
                    Filters
                    {hasActiveFilter && <span className="badge-pill">Active</span>}
                  </button>
                )}

                {/* Density Switch Button */}
                <button
                  type="button"
                  className="patient-btn"
                  onClick={toggleDensity}
                  title={`Current density: ${tableDensity}. Click to toggle.`}
                >
                  <i className={`fa-solid ${tableDensity === "compact" ? "fa-compress" : "fa-expand"}`} />
                  {tableDensity === "compact" ? "Compact" : "Normal"}
                </button>

                {/* Columns Visibility Customizer */}
                <button
                  type="button"
                  className="patient-btn"
                  onClick={(e) => setColumnsMenuAnchor(e.currentTarget)}
                  title="Customize Columns"
                >
                  <i className="fa-solid fa-table-columns" />
                  Columns
                </button>

                {/* Excel Export */}
                {allowExport && (
                  <button
                    type="button"
                    onClick={handleSampleFile}
                    className="patient-btn patient-btn-success"
                    title="Export to Excel"
                  >
                    <i className="fa-solid fa-file-excel" />
                    Export
                  </button>
                )}

                {/* PDF Export */}
                {role === "Admin" && (
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="patient-btn"
                    title="Download PDF"
                  >
                    <i className="fa-solid fa-file-pdf text-danger" />
                    PDF
                  </button>
                )}


                {/* Deleted Data / Patients View Toggle */}
                {localStorage.getItem("Role") === "Admin" && (
                  showActions ? (
                    <button
                      type="button"
                      className="patient-btn"
                      onClick={handleclickpostdatadesltes}
                      title="View Deleted Patients"
                    >
                      <i className="fa-solid fa-trash-can text-danger" />
                      Deleted
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="patient-btn patient-btn-primary"
                      onClick={handleclickondata}
                      title="Back to Active Patients"
                    >
                      <i className="fa-solid fa-arrow-left" />
                      Active Patients
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Quick Status Chips Bar */}
            {showActions && (
              <div className="patient-quick-filters-bar">
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginRight: 4 }}>
                  Quick:
                </span>
                <button
                  type="button"
                  className={`quick-filter-chip ${!hasActiveFilter && !onlyPhysioFilter ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    clearPatientFilter();
                  }}
                >
                  All Patients
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.p_status === "Ongoing Treatment" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("p_status", "Ongoing Treatment");
                  }}
                >
                  <i className="fa-solid fa-circle" style={{ fontSize: 6, color: "#10b981" }} />
                  Ongoing Treatment
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.p_status === "Ongoing Fundraising" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("p_status", "Ongoing Fundraising");
                  }}
                >
                  <i className="fa-solid fa-circle" style={{ fontSize: 6, color: "#d946ef" }} />
                  Ongoing Fundraising
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.p_status === "Travelled" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("p_status", "Travelled");
                  }}
                >
                  <i className="fa-solid fa-circle" style={{ fontSize: 6, color: "#0284c7" }} />
                  Travelled
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.p_status === "In_Process" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("p_status", "In_Process");
                  }}
                >
                  <i className="fa-solid fa-circle" style={{ fontSize: 6, color: "#3b82f6" }} />
                  In Process
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.p_status === "Confirmed" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("p_status", "Confirmed");
                  }}
                >
                  <i className="fa-solid fa-circle" style={{ fontSize: 6, color: "#06b6d4" }} />
                  Confirmed
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.p_status === "Treatment Completed" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("p_status", "Treatment Completed");
                  }}
                >
                  <i className="fa-solid fa-circle" style={{ fontSize: 6, color: "#8b5cf6" }} />
                  Treatment Completed
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${onlyPhysioFilter ? "active" : ""}`}
                  onClick={() => setOnlyPhysioFilter(!onlyPhysioFilter)}
                >
                  <i className="fa-solid fa-person-walking" style={{ fontSize: 10 }} />
                  Needs Physio
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.patient_type_new === "Private" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("patient_type_new", "Private");
                  }}
                >
                  Private
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${appliedFilters.patient_type_new === "Insurance" ? "active" : ""}`}
                  onClick={() => {
                    setOnlyPhysioFilter(false);
                    updatePatientFilter("patient_type_new", "Insurance");
                  }}
                >
                  Insurance
                </button>
                {hasActiveFilter && (
                  <button
                    type="button"
                    className="quick-filter-chip text-danger"
                    onClick={clearPatientFilter}
                    style={{ background: "#fee2e2", borderColor: "#fecaca" }}
                  >
                    <i className="fa-solid fa-times" /> Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* Collapsible Advanced Filters Panel */}
            {showActions && showAdvancedFilters && (
              <div className="advanced-filters-panel">
                <div className="row gx-3 gy-2 align-items-center">
                  <div className="col-md-2 col-sm-6">
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                      Patient Name
                    </label>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Enter patient name"
                      value={patientNameInput}
                      onChange={(e) => setPatientNameInput(e.target.value)}
                      sx={autocompleteSx}
                    />
                  </div>
                  <div className="col-md-2 col-sm-6">
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                      Status
                    </label>
                    <Autocomplete
                      options={PATIENT_STATUS_OPTIONS}
                      value={PATIENT_STATUS_OPTIONS.find((option) => option.value === appliedFilters.p_status) || null}
                      getOptionLabel={(option) => option?.label || ""}
                      isOptionEqualToValue={(option, value) => option?.value === value?.value}
                      onChange={(_, newValue) => updatePatientFilter("p_status", newValue?.value || "")}
                      ListboxProps={{ style: { maxHeight: 220 } }}
                      renderInput={(params) => (
                        <TextField {...params} size="small" placeholder="All Statuses" sx={autocompleteSx} />
                      )}
                    />
                  </div>
                  <div className="col-md-2 col-sm-6">
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                      Patient Type
                    </label>
                    <Autocomplete
                      options={PATIENT_TYPE_FILTER_VALUES}
                      value={appliedFilters.patient_type_new || null}
                      onChange={(_, newValue) => updatePatientFilter("patient_type_new", newValue || "")}
                      ListboxProps={{ style: { maxHeight: 220 } }}
                      renderInput={(params) => (
                        <TextField {...params} size="small" placeholder="All Types" sx={autocompleteSx} />
                      )}
                    />
                  </div>
                  <div className="col-md-2 col-sm-6">
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                      Country
                    </label>
                    <Autocomplete
                      options={countryFilterOptions}
                      value={appliedFilters.country || null}
                      onChange={(_, newValue) => updatePatientFilter("country", newValue || "")}
                      ListboxProps={{ style: { maxHeight: 220 } }}
                      renderInput={(params) => (
                        <TextField {...params} size="small" placeholder="All Countries" sx={autocompleteSx} />
                      )}
                    />
                  </div>
                  <div className="col-md-2 col-sm-6">
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                      Treating In
                    </label>
                    <Autocomplete
                      options={countryFilterOptions}
                      value={appliedFilters.treatingIn || null}
                      onChange={(_, newValue) => updatePatientFilter("treatingIn", newValue || "")}
                      ListboxProps={{ style: { maxHeight: 220 } }}
                      renderInput={(params) => (
                        <TextField {...params} size="small" placeholder="Destination" sx={autocompleteSx} />
                      )}
                    />
                  </div>
                  <div className="col-md-2 col-sm-6">
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                      Treatment
                    </label>
                    <Autocomplete
                      options={treatmentFilterOptions}
                      value={appliedFilters.treatment || null}
                      onChange={(_, newValue) => updatePatientFilter("treatment", newValue || "")}
                      ListboxProps={{ style: { maxHeight: 220 } }}
                      renderInput={(params) => (
                        <TextField {...params} size="small" placeholder="Treatment" sx={autocompleteSx} />
                      )}
                    />
                  </div>

                  {/* Date Range Group (Matches Manage Patients) */}
                  <div className="col-12 patient-date-range-group">
                    <div className="patient-date-range-label">Date Range</div>
                    <div className="row gx-3 gy-2 align-items-end">
                      <div className="col-md-2 col-sm-6">
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Date From
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={appliedFilters.date_from || ""}
                          onChange={(e) => updatePatientFilter("date_from", e.target.value)}
                        />
                      </div>
                      <div className="col-md-2 col-sm-6">
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Date To
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={appliedFilters.date_to || ""}
                          onChange={(e) => updatePatientFilter("date_to", e.target.value)}
                        />
                      </div>
                      {(appliedFilters.date_from || appliedFilters.date_to) && (
                        <div className="col-md-auto col-sm-6">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            style={{ height: 31, fontSize: "12px", borderRadius: "6px" }}
                            onClick={() => {
                              setAppliedFilters((prev) => ({ ...prev, date_from: "", date_to: "" }));
                              setPage(1);
                            }}
                          >
                            Clear Dates
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasActiveFilter && (
                    <div className="col-md-auto ms-auto mt-2">
                      <button
                        type="button"
                        className="patient-btn"
                        onClick={clearPatientFilter}
                        style={{ height: 36, color: "#dc2626" }}
                      >
                        <i className="fa-solid fa-times me-1" /> Clear All Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Table Card */}
          <div className="patient-table-card">
            <div className="patient-table-wrapper" ref={targetRef}>
              <TableContainer
                component={Paper}
                elevation={0}
                style={{ overflowX: "auto" }}
                className={tableDensity === "compact" ? "patient-table-compact" : ""}
              >
                <Table stickyHeader className="patient-modern-table" aria-label="patients table">
                  <TableHead>
                    <TableRow>
                      {visibleColumns.srNo && <TableCell style={{ width: 45 }}>#</TableCell>}

                      {/* Deleted data specific columns */}
                      {!showActions && (
                        <>
                          <TableCell>Deleted By</TableCell>
                          <TableCell>Deleted By Email</TableCell>
                          <TableCell>Deleted Time</TableCell>
                          <TableCell>Deleted Date</TableCell>
                        </>
                      )}

                      {/* Patient Details (Name, Patient ID, Country, S/R/P Badges) */}
                      {visibleColumns.patientName && (
                        <TableCell style={{ minWidth: 230 }}>
                          <TableSortLabel
                            active={orderBy === "patient_name"}
                            direction={orderBy === "patient_name" ? order : "asc"}
                            onClick={() => handleRequestSort("patient_name")}
                          >
                            Patient Details
                          </TableSortLabel>
                        </TableCell>
                      )}

                      {/* Treatment */}
                      {visibleColumns.treatment && (
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "current_treatment_name" || orderBy === "treatment_name" || orderBy === "disease_name"}
                            direction={orderBy === "current_treatment_name" || orderBy === "treatment_name" || orderBy === "disease_name" ? order : "asc"}
                            onClick={() => handleRequestSort("current_treatment_name")}
                          >
                            Treatment Name
                          </TableSortLabel>
                        </TableCell>
                      )}

                      {/* Destination / Treating In */}
                      {visibleColumns.treatingIn && (
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "treatingIn"}
                            direction={orderBy === "treatingIn" ? order : "asc"}
                            onClick={() => handleRequestSort("treatingIn")}
                          >
                            Treating In
                          </TableSortLabel>
                        </TableCell>
                      )}

                      {/* Date/Time */}
                      {visibleColumns.dateTime && (
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "createdAt"}
                            direction={orderBy === "createdAt" ? order : "asc"}
                            onClick={() => handleRequestSort("createdAt")}
                          >
                            Date/Time
                          </TableSortLabel>
                        </TableCell>
                      )}

                      {/* Active Patient Columns */}
                      {showActions && (
                        <>
                          {visibleColumns.patientType && (
                            <TableCell>
                              <TableSortLabel
                                active={orderBy === "patient_type_new"}
                                direction={orderBy === "patient_type_new" ? order : "asc"}
                                onClick={() => handleRequestSort("patient_type_new")}
                              >
                                Patient Type
                              </TableSortLabel>
                            </TableCell>
                          )}

                          {visibleColumns.status && (
                            <TableCell>
                              <TableSortLabel
                                active={orderBy === "p_status"}
                                direction={orderBy === "p_status" ? order : "asc"}
                                onClick={() => handleRequestSort("p_status")}
                              >
                                Status
                              </TableSortLabel>
                            </TableCell>
                          )}

                          {visibleColumns.actions && (
                            <TableCell className="patient-sticky-action-header" style={{ minWidth: 145, width: 145 }}>
                              Action
                            </TableCell>
                          )}
                        </>
                      )}
                    </TableRow>
                  </TableHead>

                  {loading ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={15} align="center" style={{ padding: "40px 0" }}>
                          <Loader />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <TableBody>
                      {displayedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={15} align="center" style={{ padding: "40px 0", color: "#64748b" }}>
                            <div className="d-flex flex-column align-items-center gap-2">
                              <i className="fa-solid fa-folder-open text-muted" style={{ fontSize: 32 }} />
                              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                                {isPhysioUser
                                  ? "No patients assigned to you for Physiotherapy yet."
                                  : isCoordinator
                                    ? "No patients assigned to you yet."
                                    : onlyPhysioFilter
                                      ? "No patients marked for Physiotherapy found."
                                      : "No patient records found."}
                              </span>
                              {hasActiveFilter && (
                                <button
                                  type="button"
                                  className="patient-btn patient-btn-primary mt-2"
                                  onClick={clearPatientFilter}
                                >
                                  Clear Filters
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedRows.map((info, i) => {
                          const assignedTherapist = getPatientPhysioAssignment(info);
                          const isPhysioMarked = isPatientPhysioActive(info);
                          const treatInfo = getPatientTreatmentInfo(info);
                          const isTreatmentType = treatInfo.isConverted || treatInfo.type.toLowerCase() === "treatment";
                          const coord = getAssignedCoordinator(info);
                          const patientName = info.patient_name || info.name || "Patient";
                          const patientNumber = info.patientNumber || info.patientId || "—";
                          const fullPhone = getPatientFullPhone(info);
                          const staffName = getStaffNameFromPatient(info);
                          const hasStaff = Boolean(staffName && staffName.trim());

                          const hasCoord = Boolean(coord && (coord.name || coord.userId));
                          const hasPhysio = Boolean(assignedTherapist && assignedTherapist.name);
                          const refName =
                            (typeof info.Referral_Name === "string" && info.Referral_Name.trim()) ||
                            (typeof info.referral_name === "string" && info.referral_name.trim()) ||
                            (typeof info.referral?.name === "string" && info.referral.name.trim()) ||
                            (typeof info.referral === "string" && info.referral.trim()) ||
                            (info.referral_id ? String(info.referral_id) : "");
                          const hasReferral = Boolean(refName && refName.trim());
                          const storedIns = getStoredInsuranceForPatient(
                            info.patientId || info.patientNumber || info._id || info.id
                          );
                          const insName =
                            (typeof info.Insurance_Name === "string" && info.Insurance_Name.trim()) ||
                            (typeof info.insurance_name === "string" && info.insurance_name.trim()) ||
                            (typeof info.insurance?.name === "string" && info.insurance.name.trim()) ||
                            (typeof info.insurance === "string" && info.insurance.trim()) ||
                            (info.insurance_id ? String(info.insurance_id) : "") ||
                            storedIns?.insurance_name ||
                            "";
                          const hasInsurance = Boolean(insName && insName.trim());

                          return (
                            <TableRow
                              key={info._id || info.patientNumber || info.patientId || i}
                              className={`patient-row ${isPatientRecordUnseen(info) ? "unread-patient-row" : ""}`}
                            >
                              {/* Sr.No */}
                              {visibleColumns.srNo && (
                                <TableCell style={{ color: "#64748b", fontWeight: 500 }}>
                                  {(page - 1) * rowsPerPage + i + 1}
                                </TableCell>
                              )}

                              {/* Deleted Data Columns */}
                              {!showActions && (
                                <>
                                  <TableCell>{info?.deletedBy?.name || "—"}</TableCell>
                                  <TableCell>{info?.deletedBy?.email || "—"}</TableCell>
                                  <TableCell>
                                    {info.deletedAt
                                      ? new Date(info.deletedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                                      : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {info.deletedAt
                                      ? new Date(info.deletedAt).toLocaleDateString("en-GB")
                                      : "—"}
                                  </TableCell>
                                </>
                              )}

                              {/* Patient Details: Combined Name + Patient ID + Country + Assignment Badges (S, R, P) */}
                              {visibleColumns.patientName && (
                                <TableCell style={{ minWidth: 230, maxWidth: 320 }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    
                                    {/* Line 1: Notification Bell + Patient Name + Unread Dot */}
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                      <Tooltip
                                        title={
                                          isPatientNotificationEnabled(info)
                                            ? "Notifications Enabled · Click to Turn Off"
                                            : "Notifications Disabled · Click to Turn On"
                                        }
                                        arrow
                                        placement="top"
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => handleToggleNotification(e, info)}
                                          disabled={updatingNotificationId === (info.patientNumber || info.patientId || info._id || info.id)}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            padding: 0,
                                            margin: 0,
                                            cursor: updatingNotificationId === (info.patientNumber || info.patientId || info._id || info.id) ? "wait" : "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            lineHeight: 1,
                                          }}
                                          aria-label="Toggle Notification"
                                        >
                                          <i
                                            className={`fa-solid ${
                                              updatingNotificationId === (info.patientNumber || info.patientId || info._id || info.id)
                                                ? "fa-spinner fa-spin"
                                                : "fa-bell"
                                            }`}
                                            style={{
                                              color: isPatientNotificationEnabled(info) ? "#16a34a" : "#dc2626",
                                              fontSize: "12px",
                                              transition: "transform 0.15s ease",
                                            }}
                                          />
                                        </button>
                                      </Tooltip>
                                      <span
                                        style={{
                                          cursor: "pointer",
                                          fontWeight: isPatientRecordBold(info) ? 700 : 500,
                                          color: "#0284c7",
                                          fontSize: "13.5px",
                                          lineHeight: "1.2",
                                        }}
                                        onClick={(e) =>
                                          PatientDetail(
                                            e,
                                            info.patientId,
                                            info.enquiryId,
                                            info.id,
                                            info.user_id,
                                            null,
                                            info.createdAt,
                                            info.patientNumber,
                                          )
                                        }
                                        title={`View profile of ${patientName}`}
                                      >
                                        {patientName}
                                      </span>
                                      <UnreadDot unread={isPatientRecordUnseen(info)} />
                                    </div>

                                    {/* Line 2: Patient ID badge + Phone Number */}
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "nowrap" }}>
                                      <span
                                        style={{
                                          backgroundColor: "#f1f5f9",
                                          color: "#334155",
                                          border: "1px solid #e2e8f0",
                                          borderRadius: "4px",
                                          padding: "1px 6px",
                                          fontWeight: 700,
                                          fontFamily: "monospace",
                                          fontSize: "11px",
                                        }}
                                        title="Patient ID"
                                      >
                                        {patientNumber}
                                      </span>
                                      {fullPhone && fullPhone !== "—" ? (
                                        <a
                                          href={`tel:${String(fullPhone).replace(/\s+/g, "")}`}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            color: "#334155",
                                            fontSize: "11.5px",
                                            fontWeight: 600,
                                            textDecoration: "none",
                                          }}
                                          title={`Phone: ${fullPhone}${info.country ? ` · Country: ${info.country}` : ""}`}
                                        >
                                          <i className="fa-solid fa-phone" style={{ fontSize: "10px", color: "#64748b" }} />
                                          <span>{fullPhone}</span>
                                        </a>
                                      ) : (
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            color: "#94a3b8",
                                            fontSize: "11px",
                                            fontWeight: 500,
                                          }}
                                          title={info.country ? `Country: ${info.country}` : "No phone number available"}
                                        >
                                          <i className="fa-solid fa-phone" style={{ fontSize: "10px", color: "#cbd5e1" }} />
                                          <span>—</span>
                                        </span>
                                      )}

                                    </div>

                                    {/* Line 3: Assignment Badges (S: Staff / Coordinator, R: Referral Partner, P: Physio) */}
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        marginTop: "2px",
                                      }}
                                    >
                                      {/* S: Staff / Coordinator Badge (only if assigned) */}
                                      {(hasStaff || hasCoord) && (
                                        <Tooltip
                                          title={
                                            <div style={{ fontSize: "11.5px", lineHeight: 1.4 }}>
                                              <div style={{ fontWeight: 700, color: "#c084fc", marginBottom: "2px" }}>
                                                <i className="fa-solid fa-user-gear" style={{ marginRight: 5 }} />
                                                Staff / Coordinator
                                              </div>
                                              <div style={{ fontWeight: 600 }}>{hasStaff ? staffName : hasCoord ? coord.name : "Not Assigned"}</div>
                                              {hasCoord && coord.phone && <div style={{ fontSize: "11px", color: "#cbd5e1" }}>📞 {coord.phone}</div>}
                                              <div style={{ fontSize: "10px", marginTop: "3px", color: "#cbd5e1" }}>
                                                Click to view or manage assignment
                                              </div>
                                            </div>
                                          }
                                          arrow
                                          placement="top"
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => handleOpenAssignmentPopover(e, info)}
                                            className="assignment-letter-badge is-assigned staff"
                                            aria-label="Staff / Coordinator Assignment"
                                          >
                                            S
                                          </button>
                                        </Tooltip>
                                      )}

                                      {/* R: Referral Partner Badge (only if assigned) */}
                                      {hasReferral && (
                                        <Tooltip
                                          title={
                                            <div style={{ fontSize: "11.5px", lineHeight: 1.4 }}>
                                              <div style={{ fontWeight: 700, color: "#fdba74", marginBottom: "2px" }}>
                                                <i className="fa-solid fa-handshake" style={{ marginRight: 5 }} />
                                                Referral Partner
                                              </div>
                                              <div style={{ fontWeight: 600 }}>{refName}</div>
                                              <div style={{ fontSize: "10px", marginTop: "3px", color: "#fdba74" }}>
                                                Click to view or change referral partner
                                              </div>
                                            </div>
                                          }
                                          arrow
                                          placement="top"
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => handleOpenAssignmentPopover(e, info)}
                                            className="assignment-letter-badge is-assigned referral"
                                            aria-label="Referral Assignment"
                                          >
                                            R
                                          </button>
                                        </Tooltip>
                                      )}

                                      {/* I: Insurance Partner Badge (only if assigned) */}
                                      {hasInsurance && (
                                        <Tooltip
                                          title={
                                            <div style={{ fontSize: "11.5px", lineHeight: 1.4 }}>
                                              <div style={{ fontWeight: 700, color: "#0891b2", marginBottom: "2px" }}>
                                                <i className="fa-solid fa-shield-alt fa-shield" style={{ marginRight: 5 }} />
                                                Insurance Partner
                                              </div>
                                              <div style={{ fontWeight: 600 }}>{insName}</div>
                                              <div style={{ fontSize: "10px", marginTop: "3px", color: "#0891b2" }}>
                                                Click to view or change insurance partner
                                              </div>
                                            </div>
                                          }
                                          arrow
                                          placement="top"
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => handleOpenAssignmentPopover(e, info)}
                                            className="assignment-letter-badge is-assigned insurance"
                                            aria-label="Insurance Assignment"
                                          >
                                            I
                                          </button>
                                        </Tooltip>
                                      )}

                                      {/* P: Physio Badge (if active or flagged) */}
                                      {(hasPhysio || isPhysioMarked) && (
                                        <Tooltip
                                          title={
                                            <div style={{ fontSize: "11.5px", lineHeight: 1.4 }}>
                                              <div style={{ fontWeight: 700, color: hasPhysio ? "#86efac" : "#fde68a", marginBottom: "2px" }}>
                                                <i className="fa-solid fa-person-walking" style={{ marginRight: 5 }} />
                                                Physiotherapist
                                              </div>
                                              <div style={{ fontWeight: 600 }}>{hasPhysio ? assignedTherapist.name : "Needs Physio"}</div>
                                              <div style={{ fontSize: "10px", marginTop: "3px", color: hasPhysio ? "#86efac" : "#fde68a" }}>
                                                Click to view or change physio
                                              </div>
                                            </div>
                                          }
                                          arrow
                                          placement="top"
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => handleOpenAssignmentPopover(e, info)}
                                            className={`assignment-letter-badge ${hasPhysio ? "is-assigned physio" : "flagged physio"}`}
                                            aria-label="Physiotherapy Assignment"
                                          >
                                            P
                                          </button>
                                        </Tooltip>
                                      )}


                                    </div>

                                  </div>
                                </TableCell>
                              )}

                              {/* Treatment Cell */}
                              {visibleColumns.treatment && (
                                <TableCell title={treatInfo.tooltip}>
                                  {treatInfo.name === "—" ? (
                                    <span className="text-muted" style={{ fontSize: "12px" }}>—</span>
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "200px" }}>
                                      <span
                                        style={{
                                          fontWeight: isPatientRecordBold(info) ? 700 : 500,
                                          color: "#1e293b",
                                          fontSize: "12.5px",
                                        }}
                                        title={treatInfo.name}
                                      >
                                        {truncateCellText(treatInfo.name, 24)}
                                      </span>
                                      {treatInfo.type && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                                          <span
                                            className="badge"
                                            style={{
                                              fontSize: "9.5px",
                                              fontWeight: 600,
                                              padding: "2px 6px",
                                              borderRadius: "4px",
                                              backgroundColor: isTreatmentType ? "#ecfdf5" : "#fef3c7",
                                              color: isTreatmentType ? "#065f46" : "#92400e",
                                              border: `1px solid ${isTreatmentType ? "#a7f3d0" : "#fde68a"}`,
                                            }}
                                          >
                                            {treatInfo.type === "Treatment Plan" ? "+ Treatment Plan" : treatInfo.type}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              )}

                              {/* Treating In */}
                              {visibleColumns.treatingIn && (
                                <TableCell title={info.treatingIn}>
                                  {info.treatingIn ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#334155" }}>
                                      <i className="fa-solid fa-location-dot" style={{ fontSize: "11px", color: "#94a3b8" }} />
                                      {truncateCellText(info.treatingIn, 18)}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </TableCell>
                              )}

                              {/* Date & Time */}
                              {visibleColumns.dateTime && (
                                <TableCell style={{ whiteSpace: "nowrap" }}>
                                  {info.createdAt ? (
                                    <span style={{ fontSize: "12px", color: "#334155" }}>
                                      {new Date(info.createdAt).toLocaleDateString("en-GB")}/
                                      {new Date(info.createdAt).toLocaleTimeString("en-GB", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                      }).toLowerCase()}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </TableCell>
                              )}

                              {/* Actions & Dropdowns (Active Patients) */}
                              {showActions && (
                                <>
                                  {/* Patient Type Select */}
                                  {visibleColumns.patientType && (
                                    <TableCell style={{ whiteSpace: "nowrap" }}>
                                      <select
                                        className={`compact-pill-select ${getTypePillClass(info.patient_type_new)}`}
                                        value={info.patient_type_new || "None"}
                                        onChange={(e) => {
                                          if (isReferral) return;
                                          handleChangtype(e, info.patientId);
                                        }}
                                        disabled={isReferral}
                                        title={isReferral ? "Patient Type (Read-only)" : "Change Patient Type"}
                                      >
                                        <option value="None">None</option>
                                        <option value="Private">Private</option>
                                        <option value="Foundation">Foundation</option>
                                        <option value="Insurance">Insurance</option>
                                        <option value="Insurance + Private">Insurance + Private</option>
                                      </select>
                                    </TableCell>
                                  )}

                                  {/* Patient Status Select */}
                                  {visibleColumns.status && (
                                    <TableCell style={{ whiteSpace: "nowrap" }}>
                                      <select
                                        className={`compact-pill-select ${getStatusPillClass(info.p_status)}`}
                                        value={normalizePatientStatus(info.p_status) || ""}
                                        onChange={(e) => {
                                          if (isReferral) return;
                                          handleChangefffff(e, info.patientId, info.patient_name || info.name || "");
                                        }}
                                        disabled={isReferral}
                                        title={isReferral ? "Status (Read-only)" : "Change Patient Status"}
                                      >
                                        <option value="" disabled>Select Status</option>
                                        {PATIENT_STATUS_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </TableCell>
                                  )}

                                  {/* Sticky Action Column */}
                                  {visibleColumns.actions && (
                                    <TableCell className="patient-sticky-action-col" style={{ whiteSpace: "nowrap", width: 145, minWidth: 145 }}>
                                      {isReferral ? (
                                        <div className="patient-action-btns-flex" style={{ gap: 4 }}>
                                          <Tooltip title={Array.isArray(info.discussionNotes) && info.discussionNotes.length > 0 ? `Notes (${info.discussionNotes.length})` : "Discussion Notes"} arrow placement="top">
                                            <button
                                              type="button"
                                              className="p-action-btn p-action-btn-notes"
                                              onClick={(e) => {
                                                markPatientAction(info);
                                                handleOpenPatientNotes(e, info);
                                              }}
                                            >
                                              <i className="fa-solid fa-notes-medical" />
                                              {Array.isArray(info.discussionNotes) && info.discussionNotes.length > 0 && (
                                                <span className="p-notes-count-badge">{info.discussionNotes.length}</span>
                                              )}
                                            </button>
                                          </Tooltip>
                                          <Tooltip title="View Details" arrow placement="top">
                                            <button
                                              type="button"
                                              className="p-action-btn p-action-btn-view"
                                              onClick={(e) => {
                                                markPatientAction(info);
                                                PatientDetail(
                                                  e,
                                                  info.patientId,
                                                  info.enquiryId,
                                                  info.id,
                                                  info.user_id,
                                                  null,
                                                  info.createdAt,
                                                  info.patientNumber,
                                                );
                                              }}
                                            >
                                              <VisibilityIcon style={{ fontSize: 15 }} />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      ) : (
                                        <div className="patient-action-btns-flex" style={{ gap: 4 }}>
                                          {/* Notes */}
                                          <Tooltip
                                            title={
                                              Array.isArray(info.discussionNotes) && info.discussionNotes.length > 0
                                                ? `Discussion Notes (${info.discussionNotes.length})`
                                                : "Discussion Notes"
                                            }
                                            arrow
                                            placement="top"
                                          >
                                            <button
                                              type="button"
                                              className="p-action-btn p-action-btn-notes"
                                              onClick={(e) => {
                                                markPatientAction(info);
                                                handleOpenPatientNotes(e, info);
                                              }}
                                            >
                                              <i className="fa-solid fa-notes-medical" />
                                              {Array.isArray(info.discussionNotes) && info.discussionNotes.length > 0 && (
                                                <span className="p-notes-count-badge">
                                                  {info.discussionNotes.length}
                                                </span>
                                              )}
                                            </button>
                                          </Tooltip>

                                          {/* Chat */}
                                          <Tooltip title={info.user_id ? `Chat with ${patientName}` : "Patient Chat (No user ID)"} arrow placement="top">
                                            <button
                                              type="button"
                                              className="p-action-btn p-action-btn-chat"
                                              style={{
                                                opacity: info.user_id ? 1 : 0.45,
                                                cursor: info.user_id ? "pointer" : "not-allowed",
                                              }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                markPatientAction(info);
                                                if (!info.user_id) {
                                                  toast.error("Patient user id not found");
                                                  return;
                                                }
                                                navigate("/Admin/messages", {
                                                  state: {
                                                    patientUserId: String(info.user_id),
                                                    patientName: patientName,
                                                  },
                                                });
                                              }}
                                            >
                                              <i className="fa-solid fa-comment" />
                                            </button>
                                          </Tooltip>

                                           {/* View Details */}
                                          <Tooltip title="View Patient Details" arrow placement="top">
                                            <button
                                              type="button"
                                              className="p-action-btn p-action-btn-view"
                                              onClick={(e) => {
                                                markPatientAction(info);
                                                PatientDetail(
                                                  e,
                                                  info.patientId,
                                                  info.enquiryId,
                                                  info.id,
                                                  info.user_id,
                                                  null,
                                                  info.createdAt,
                                                  info.patientNumber,
                                                );
                                              }}
                                            >
                                              <VisibilityIcon style={{ fontSize: 15 }} />
                                            </button>
                                          </Tooltip>

                                          {/* Three Dots Menu Button (⋮) */}
                                          <Tooltip title="More Actions" arrow placement="top">
                                            <button
                                              type="button"
                                              className="p-action-btn p-action-btn-more"
                                              onClick={(e) => {
                                                markPatientAction(info);
                                                handleOpenActionMenu(e, info);
                                              }}
                                              aria-label="More actions"
                                            >
                                              <i className="fa-solid fa-ellipsis-vertical" />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      )}
                                    </TableCell>
                                  )}
                                </>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  )}
                </Table>
              </TableContainer>

              {/* Modern Pagination Footer Toolbar */}
              {!pdfRowLimit && (
                <div className="patient-pagination-bar">
                  <div className="patient-pagination-info">
                    {displayedRows.length > 0 ? (
                      <>
                        Showing <strong>{(page - 1) * rowsPerPage + 1}</strong> to{" "}
                        <strong>
                          {Math.min(
                            page * rowsPerPage,
                            isCoordinator
                              ? coordinatorFilteredRows.length
                              : (pagination?.totalRecords || displayedRows.length),
                          )}
                        </strong>{" "}
                        of{" "}
                        <strong>
                          {isCoordinator
                            ? coordinatorFilteredRows.length
                            : (pagination?.totalRecords || displayedRows.length)}
                        </strong>{" "}
                        patients
                      </>
                    ) : (
                      "0 records"
                    )}
                  </div>

                  <div className="patient-pagination-controls">
                    <div className="rows-per-page-selector">
                      <span>Rows per page:</span>
                      <select
                        className="rows-select"
                        value={rowsPerPage}
                        onChange={handleRowsPerPageChange}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <Pagination
                      count={totalPagesToDisplay}
                      page={page}
                      onChange={(event, value) => setPage(value)}
                      color="primary"
                      shape="rounded"
                      size="small"
                      showFirstButton
                      showLastButton
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kebab More Options Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
        PaperProps={{
          elevation: 4,
          sx: {
            borderRadius: "10px",
            minWidth: "220px",
            padding: "4px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06)",
            "& .MuiMenuItem-root": {
              fontSize: "12.5px",
              borderRadius: "6px",
              gap: "10px",
              padding: "7px 12px",
              "&:hover": {
                backgroundColor: "#f1f5f9",
              },
            },
          },
        }}
      >


        {/* View Details */}
        <MenuItem
          onClick={(e) => {
            const targetPatient = actionMenuPatient;
            handleCloseActionMenu();
            if (!targetPatient) return;
            PatientDetail(
              e,
              targetPatient.patientId,
              targetPatient.enquiryId,
              targetPatient.id,
              targetPatient.user_id,
              null,
              targetPatient.createdAt,
              targetPatient.patientNumber
            );
          }}
        >
          <VisibilityIcon style={{ width: 16, height: 16, color: "#0284c7" }} />
          <span>View Patient Details</span>
        </MenuItem>

        {/* Discussion Notes */}
        <MenuItem
          onClick={(e) => {
            const targetPatient = actionMenuPatient;
            handleCloseActionMenu();
            if (!targetPatient) return;
            handleOpenPatientNotes(e, targetPatient);
          }}
        >
          <i className="fa-solid fa-notes-medical" style={{ width: 16, color: "#d97706" }} />
          <span>
            Discussion Notes
            {Array.isArray(actionMenuPatient?.discussionNotes) && actionMenuPatient.discussionNotes.length > 0 && (
              <span
                style={{
                  marginLeft: "6px",
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  borderRadius: "8px",
                  fontSize: "9.5px",
                  padding: "1px 6px",
                  fontWeight: 700,
                }}
              >
                {actionMenuPatient.discussionNotes.length}
              </span>
            )}
          </span>
        </MenuItem>

        {/* Edit Patient */}
        {allowEdit && (
          <MenuItem
            onClick={(e) => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              if (!targetPatient) return;
              EditButton(e, targetPatient.patientId, targetPatient);
            }}
          >
            <i className="fa-solid fa-pen-to-square" style={{ width: 16, color: "#9333ea" }} />
            <span>Edit Patient</span>
          </MenuItem>
        )}

        {/* Chat with Patient */}
        <MenuItem
          onClick={() => {
            const targetPatient = actionMenuPatient;
            handleCloseActionMenu();
            if (!targetPatient?.user_id) {
              toast.error("Patient user id not found");
              return;
            }
            markPatientAction(targetPatient.patientId, targetPatient.patientNumber);
            navigate("/Admin/messages", {
              state: {
                patientUserId: String(targetPatient.user_id),
                patientName: targetPatient.patient_name || targetPatient.name || "Patient",
              },
            });
          }}
          disabled={!actionMenuPatient?.user_id}
        >
          <i
            className="fa-solid fa-comment"
            style={{ width: 16, color: actionMenuPatient?.user_id ? "#0d9488" : "#94a3b8" }}
          />
          <span>Chat with Patient</span>
        </MenuItem>

        {/* Toggle Notification Option */}
        <MenuItem
          onClick={(e) => {
            const targetPatient = actionMenuPatient;
            handleCloseActionMenu();
            if (!targetPatient) return;
            handleToggleNotification(e, targetPatient);
          }}
        >
          <i
            className="fa-solid fa-bell"
            style={{
              width: 16,
              color: isPatientNotificationEnabled(actionMenuPatient) ? "#dc2626" : "#16a34a",
            }}
          />
          <span>
            {isPatientNotificationEnabled(actionMenuPatient)
              ? "Turn Off Notifications"
              : "Turn On Notifications"}
          </span>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Coordinator */}
        {canAssignCoordinator && (
          <MenuItem
            onClick={() => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              handleOpenAssignCoordinator(targetPatient);
            }}
          >
            <i className="fa-solid fa-user-tie" style={{ width: 16, color: "#4f46e5" }} />
            <span>
              {getAssignedCoordinator(actionMenuPatient)?.name
                ? `Staff: ${getAssignedCoordinator(actionMenuPatient)?.name}`
                : "Assign Staff / Coordinator"}
            </span>
          </MenuItem>
        )}

        {/* Physiotherapy */}
        {canAssignPhysio && (
          <MenuItem
            onClick={() => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              handleOpenAssignPhysio(targetPatient);
            }}
          >
            <i className="fa-solid fa-person-walking" style={{ width: 16, color: "#0284c7" }} />
            <span>
              {getPatientPhysioAssignment(actionMenuPatient)?.name
                ? `Physio: ${getPatientPhysioAssignment(actionMenuPatient)?.name}`
                : isPatientPhysioActive(actionMenuPatient)
                  ? "Manage Physiotherapy"
                  : 'Assign Physiotherapy'}
            </span>
          </MenuItem>
        )}

        {/* Referral Partner */}
        {isAdmin && (
          <MenuItem
            onClick={() => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              handleOpenAssignReferral(targetPatient);
            }}
          >
            <i className="fa-solid fa-handshake" style={{ width: 16, color: "#ea580c" }} />
            <span>
              {actionMenuPatient?.Referral_Name || actionMenuPatient?.referral_name || actionMenuPatient?.referral_id
                ? `Referral: ${actionMenuPatient?.Referral_Name || actionMenuPatient?.referral_name || actionMenuPatient?.referral_id}`
                : "Assign Referral Partner"}
            </span>
          </MenuItem>
        )}

        {/* Insurance Partner */}
        {isAdmin && (
          <MenuItem
            onClick={() => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              handleOpenAssignInsurance(targetPatient);
            }}
          >
            <i className="fa-solid fa-shield-alt fa-shield" style={{ width: 16, color: "#0891b2" }} />
            <span>
              {actionMenuPatient?.Insurance_Name || actionMenuPatient?.insurance_name || actionMenuPatient?.insurance_id
                ? `Insurance: ${actionMenuPatient?.Insurance_Name || actionMenuPatient?.insurance_name || actionMenuPatient?.insurance_id}`
                : "Assign Insurance Partner"}
            </span>
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        {/* Track Activity Logs */}
        {canViewActivityLog && (
          <MenuItem
            onClick={() => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              handleOpenPatientActivity(targetPatient.patientId, targetPatient, "logs");
            }}
          >
            <i className="fa-solid fa-clock-rotate-left" style={{ width: 16, color: "#0284c7" }} />
            <span>Track Activity Logs</span>
          </MenuItem>
        )}

        {/* Journey Timeline */}
        {canViewTimeline && (
          <MenuItem
            onClick={() => {
              const targetPatient = actionMenuPatient;
              handleCloseActionMenu();
              handleOpenPatientActivity(targetPatient.patientId, targetPatient, "timeline");
            }}
          >
            <i className="fa-solid fa-timeline" style={{ width: 16, color: "#10b981" }} />
            <span>Journey Timeline</span>
          </MenuItem>
        )}

        {/* Delete Patient */}
        {allowDelete && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={(e) => {
                const targetPatient = actionMenuPatient;
                handleCloseActionMenu();
                handledelet(e, targetPatient.patientId);
              }}
              sx={{ color: "#dc2626 !important", "&:hover": { backgroundColor: "#fee2e2 !important" } }}
            >
              <i className="fa-solid fa-trash" style={{ width: 16, color: "#dc2626" }} />
              <span>Delete Patient</span>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Assignment Details Popover */}
      <Popover
        open={Boolean(assignmentPopoverAnchor && assignmentPopoverPatient)}
        anchorEl={assignmentPopoverAnchor}
        onClose={handleCloseAssignmentPopover}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        PaperProps={{
          elevation: 6,
          sx: {
            width: 320,
            maxWidth: "92vw",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 14px 28px rgba(0, 0, 0, 0.12), 0 10px 10px rgba(0, 0, 0, 0.06)",
          },
        }}
      >
        {assignmentPopoverPatient && (() => {
          const popPatient = assignmentPopoverPatient;
          const popPatientName = popPatient.patient_name || popPatient.name || "Patient";
          const popPatientNumber = popPatient.patientNumber || popPatient.patientId || "";

          const popCoord = getAssignedCoordinator(popPatient);
          const popHasCoord = Boolean(popCoord && (popCoord.name || popCoord.userId));

          const popPhysio = getPatientPhysioAssignment(popPatient);
          const popHasPhysio = Boolean(popPhysio && popPhysio.name);
          const popNeedsPhysio = isPatientPhysioActive(popPatient);

          const popRefName =
            (typeof popPatient.Referral_Name === "string" && popPatient.Referral_Name.trim()) ||
            (typeof popPatient.referral_name === "string" && popPatient.referral_name.trim()) ||
            (typeof popPatient.referral?.name === "string" && popPatient.referral.name.trim()) ||
            (typeof popPatient.referral === "string" && popPatient.referral.trim()) ||
            (popPatient.referral_id ? String(popPatient.referral_id) : "");
          const popHasRef = Boolean(popRefName && popRefName.trim());

          const popStoredIns = getStoredInsuranceForPatient(
            popPatient.patientId || popPatient.patientNumber || popPatient._id || popPatient.id
          );
          const popInsName =
            (typeof popPatient.Insurance_Name === "string" && popPatient.Insurance_Name.trim()) ||
            (typeof popPatient.insurance_name === "string" && popPatient.insurance_name.trim()) ||
            (typeof popPatient.insurance?.name === "string" && popPatient.insurance.name.trim()) ||
            (typeof popPatient.insurance === "string" && popPatient.insurance.trim()) ||
            (popPatient.insurance_id ? String(popPatient.insurance_id) : "") ||
            popStoredIns?.insurance_name ||
            "";
          const popHasIns = Boolean(popInsName && popInsName.trim());

          return (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div
                style={{
                  padding: "12px 14px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.9, fontWeight: 700 }}>
                    <i className="fa-solid fa-users me-1" /> Assigned Team
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.2, marginTop: "2px" }}>
                    {popPatientName}
                  </div>
                  {popPatientNumber && (
                    <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "1px" }}>
                      ID: {popPatientNumber}
                    </div>
                  )}
                </div>
                <IconButton
                  size="small"
                  onClick={handleCloseAssignmentPopover}
                  sx={{ color: "#ffffff", opacity: 0.85, "&:hover": { opacity: 1, backgroundColor: "rgba(255,255,255,0.18)" } }}
                >
                  <ClearIcon style={{ fontSize: 16 }} />
                </IconButton>
              </div>

              {/* Content List */}
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "#f8fafc" }}>
                
                {/* 1. Staff / Coordinator Card */}
                <div
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#3730a3" }}>
                      <i className="fa-solid fa-user-tie" style={{ color: "#4f46e5" }} />
                      <span>Staff / Coordinator</span>
                    </div>
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "6px",
                        backgroundColor: popHasCoord ? "#e0e7ff" : "#f1f5f9",
                        color: popHasCoord ? "#3730a3" : "#64748b",
                      }}
                    >
                      {popHasCoord ? "Assigned" : "Not Assigned"}
                    </span>
                  </div>
                  {popHasCoord ? (
                    <div style={{ fontSize: "12px", color: "#1e293b", marginTop: "4px" }}>
                      <div style={{ fontWeight: 600 }}>{popCoord.name}</div>
                      {popCoord.phone && <div style={{ fontSize: "11px", color: "#64748b" }}>📞 {popCoord.phone}</div>}
                      {popCoord.email && <div style={{ fontSize: "11px", color: "#64748b" }}>✉️ {popCoord.email}</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic", marginTop: "2px" }}>
                      No coordinator assigned yet
                    </div>
                  )}
                  {(canAssignCoordinator || isAdmin) && (
                    <div style={{ marginTop: "6px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const target = popPatient;
                          handleCloseAssignmentPopover();
                          handleOpenAssignCoordinator(target);
                        }}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#4f46e5",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 0",
                          textDecoration: "underline",
                        }}
                      >
                        {popHasCoord ? "Change Coordinator" : "+ Assign Coordinator"}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Physiotherapist Card */}
                <div
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#065f46" }}>
                      <i className="fa-solid fa-person-walking" style={{ color: "#0284c7" }} />
                      <span>Physiotherapist</span>
                    </div>
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "6px",
                        backgroundColor: popHasPhysio ? "#ecfdf5" : popNeedsPhysio ? "#fef3c7" : "#f1f5f9",
                        color: popHasPhysio ? "#047857" : popNeedsPhysio ? "#b45309" : "#64748b",
                      }}
                    >
                      {popHasPhysio ? "Assigned" : popNeedsPhysio ? "Needs Physio" : "Not Assigned"}
                    </span>
                  </div>
                  {popHasPhysio ? (
                    <div style={{ fontSize: "12px", color: "#1e293b", marginTop: "4px" }}>
                      <div style={{ fontWeight: 600 }}>{popPhysio.name}</div>
                    </div>
                  ) : popNeedsPhysio ? (
                    <div style={{ fontSize: "11.5px", color: "#b45309", fontStyle: "italic", marginTop: "2px" }}>
                      Needs Physiotherapy (Therapist pending)
                    </div>
                  ) : (
                    <div style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic", marginTop: "2px" }}>
                      No physiotherapy assigned
                    </div>
                  )}
                  {(canAssignPhysio || isAdmin) && (
                    <div style={{ marginTop: "6px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const target = popPatient;
                          handleCloseAssignmentPopover();
                          handleOpenAssignPhysio(target);
                        }}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0284c7",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 0",
                          textDecoration: "underline",
                        }}
                      >
                        {popHasPhysio ? "Change Physio" : "+ Assign Physio"}
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Referral Partner Card */}
                <div
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#c2410c" }}>
                      <i className="fa-solid fa-handshake" style={{ color: "#ea580c" }} />
                      <span>Referral Partner</span>
                    </div>
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "6px",
                        backgroundColor: popHasRef ? "#fff7ed" : "#f1f5f9",
                        color: popHasRef ? "#c2410c" : "#64748b",
                      }}
                    >
                      {popHasRef ? "Assigned" : "Not Assigned"}
                    </span>
                  </div>
                  {popHasRef ? (
                    <div style={{ fontSize: "12px", color: "#1e293b", marginTop: "4px" }}>
                      <div style={{ fontWeight: 600 }}>{popRefName}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic", marginTop: "2px" }}>
                      No referral partner assigned
                    </div>
                  )}
                  {isAdmin && (
                    <div style={{ marginTop: "6px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const target = popPatient;
                          handleCloseAssignmentPopover();
                          handleOpenAssignReferral(target);
                        }}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#ea580c",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 0",
                          textDecoration: "underline",
                        }}
                      >
                        {popHasRef ? "Change Referral" : "+ Assign Referral"}
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Insurance Partner Card */}
                <div
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#0891b2" }}>
                      <i className="fa-solid fa-shield-alt fa-shield" style={{ color: "#0891b2" }} />
                      <span>Insurance Partner</span>
                    </div>
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "6px",
                        backgroundColor: popHasIns ? "#ecfeff" : "#f1f5f9",
                        color: popHasIns ? "#0891b2" : "#64748b",
                      }}
                    >
                      {popHasIns ? "Assigned" : "Not Assigned"}
                    </span>
                  </div>
                  {popHasIns ? (
                    <div style={{ fontSize: "12px", color: "#1e293b", marginTop: "4px" }}>
                      <div style={{ fontWeight: 600 }}>{popInsName}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic", marginTop: "2px" }}>
                      No insurance partner assigned
                    </div>
                  )}
                  {isAdmin && (
                    <div style={{ marginTop: "6px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const target = popPatient;
                          handleCloseAssignmentPopover();
                          handleOpenAssignInsurance(target);
                        }}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0891b2",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 0",
                          textDecoration: "underline",
                        }}
                      >
                        {popHasIns ? "Change Insurance" : "+ Assign Insurance"}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })()}
      </Popover>

      {/* Columns Visibility Menu */}
      <Menu
        anchorEl={columnsMenuAnchor}
        open={Boolean(columnsMenuAnchor)}
        onClose={() => setColumnsMenuAnchor(null)}
        PaperProps={{
          elevation: 4,
          sx: {
            borderRadius: "10px",
            minWidth: "220px",
            padding: "10px 14px",
          },
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>
          Display Columns
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="col-toggle-label">
            <input type="checkbox" checked={visibleColumns.patientName} onChange={() => toggleColumn("patientName")} />
            <span>Patient Details</span>
          </label>
          <label className="col-toggle-label">
            <input type="checkbox" checked={visibleColumns.treatment} onChange={() => toggleColumn("treatment")} />
            <span>Treatment</span>
          </label>
          <label className="col-toggle-label">
            <input type="checkbox" checked={visibleColumns.treatingIn} onChange={() => toggleColumn("treatingIn")} />
            <span>Treating In</span>
          </label>
          <label className="col-toggle-label">
            <input type="checkbox" checked={visibleColumns.dateTime} onChange={() => toggleColumn("dateTime")} />
            <span>Date & Time</span>
          </label>
          <label className="col-toggle-label">
            <input type="checkbox" checked={visibleColumns.patientType} onChange={() => toggleColumn("patientType")} />
            <span>Patient Type</span>
          </label>
          <label className="col-toggle-label">
            <input type="checkbox" checked={visibleColumns.status} onChange={() => toggleColumn("status")} />
            <span>Status</span>
          </label>
        </div>
      </Menu>
      {openPatientNotes && (
        <div
          className="msd-modal-overlay"
          onClick={handleClosePatientNotes}
          role="presentation"
        >
          <div
            className="msd-modal-panel msd-notes-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-notes-title"
          >
            <div className="msd-modal-head">
              <h5 id="patient-notes-title" className="msd-case-modal-title">
                Notes – {notePatientName || "Patient"}
              </h5>
              {(notePatientNumber || notePatientId) ? (
                <span className="msd-modal-count">
                  {notePatientNumber || notePatientId}
                </span>
              ) : null}
              <button
                type="button"
                className="msd-modal-close"
                onClick={handleClosePatientNotes}
                aria-label="Close"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="msd-modal-body">
              {!isReferral &&
                ((notePatientNumber || notePatientId || notePatientRow) ? (
                  <form
                    className="msd-notes-form"
                    onSubmit={handleAddPatientNote}
                  >
                    <div className="msd-notes-form-row">
                      <label htmlFor="patient-note-text">
                        Add Note<span className="text-danger">*</span>
                      </label>
                      <textarea
                        id="patient-note-text"
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
                      <label htmlFor="patient-note-date">
                        Date<span className="text-danger">*</span>
                      </label>
                      <input
                        id="patient-note-date"
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
                ))}

              <div className="msd-notes-divider">Existing Notes</div>

              {notesLoading ? (
                <div className="msd-aging-empty">
                  <i className="fa fa-spinner fa-spin me-2"></i>
                  Loading notes...
                </div>
              ) : discussionNotes.length === 0 ? (
                <div className="msd-aging-empty">No notes for this patient.</div>
              ) : (
                <div className="msd-notes-list">
                  {discussionNotes.map((item, index) => (
                    <div
                      key={item.id || item._id || `${item.date}-${index}`}
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

      <Dialog
        fullWidth
        maxWidth={activityTab === "timeline" ? "xl" : "lg"}
        open={activityOpen}
        onClose={handleClosePatientActivity}
        className="activity-log-dialog"
        sx={{
          zIndex: 1300,
          "& .MuiDialog-paper": {
            borderRadius: "16px",
            overflow: "hidden",
            height: "92vh",
            maxHeight: "92vh",
            boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.25)",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <div className="activity-log-header">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: activityTab === "timeline" ? "#ecfdf5" : "#eff6ff",
                color: activityTab === "timeline" ? "#059669" : "#0284c7",
                border: `1px solid ${activityTab === "timeline" ? "#a7f3d0" : "#bfdbfe"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                boxShadow:
                  activityTab === "timeline"
                    ? "0 2px 6px rgba(5, 150, 105, 0.1)"
                    : "0 2px 6px rgba(2, 132, 199, 0.1)",
              }}
            >
              <i
                className={`fa-solid ${activityTab === "timeline" ? "fa-timeline" : "fa-clock-rotate-left"
                  }`}
              ></i>
            </div>
            <div>
              <h6 className="mb-1 fw-bold">
                {activityTab === "timeline"
                  ? "Patient Activity Timeline & Journey"
                  : "Track Activity"}
              </h6>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-semibold text-dark" style={{ fontSize: "0.84rem" }}>
                  {activityPatient?.patient_name ||
                    activityPatient?.name ||
                    `Patient: ${activityPatientId}`}
                </span>
                <span
                  style={{
                    backgroundColor: "#f1f5f9",
                    color: activityTab === "timeline" ? "#059669" : "#0284c7",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "1px 7px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  ID: {activityPatient?.patientNumber || activityPatientId}
                </span>
                {activityTab === "logs" && (
                  <span
                    style={{
                      backgroundColor: "#ecfdf5",
                      color: "#059669",
                      border: "1px solid #a7f3d0",
                      borderRadius: "6px",
                      padding: "1px 7px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {activityTotalRecords} Total Records
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {activityTab === "logs" && allowExport && (
              <button
                type="button"
                className="export-excel-btn"
                onClick={handleExportPatientActivityExcel}
                disabled={activityLoading || activityLogs.length === 0}
                title="Export to Excel"
              >
                <i className="fa-solid fa-file-excel"></i> Export Excel
              </button>
            )}
            <button
              className="activity-modal-close-btn"
              onClick={handleClosePatientActivity}
              type="button"
              title="Close Dialog"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <DialogContent
          className="p-3"
          style={{
            backgroundColor: "#f8fafc",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Patient Activity Timeline & Journey Tracker Content */}
          {activityTab === "timeline" ? (
            activityOpen && activityPatientId && (
              <PatientTimelineTab
                patient={activityPatient}
                patientId={activityPatientId}
                onNavigateTab={(targetTab) => {
                  const targetPid = activityPatientId;
                  handleClosePatientActivity();
                  navigate("/Admin/Patient-Detail", {
                    state: {
                      patientId: targetPid,
                      mainTab: targetTab,
                      tab: targetTab,
                    },
                  });
                }}
              />
            )
          ) : (
            <div className="d-flex flex-column" style={{ minHeight: 0, flex: 1, height: "100%" }}>
              {activityLoading ? (
                <div className="py-5 text-center my-auto">
                  <Loader />
                  <p className="text-muted mt-2" style={{ fontSize: "0.85rem" }}>
                    Loading patient activity audit logs...
                  </p>
                </div>
              ) : (
                <>
                  <TableContainer
                    component={Paper}
                    sx={{
                      flex: 1,
                      minHeight: "240px",
                      maxHeight: "calc(92vh - 210px)",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      overflowY: "auto !important",
                      overflowX: "auto !important",
                      background: "#ffffff",
                    }}
                  >
                    <Table stickyHeader size="small" className="activity-log-table">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: "60px" }}>#</TableCell>
                          <TableCell sx={{ width: "180px" }}>User</TableCell>
                          <TableCell sx={{ width: "130px" }}>Role</TableCell>
                          <TableCell sx={{ width: "140px" }}>Module</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell sx={{ width: "180px" }}>Date / Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activityLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                              <div className="text-center text-muted">
                                <i className="fa-solid fa-clock-rotate-left mb-2" style={{ fontSize: "2rem", color: "#cbd5e1" }}></i>
                                <h6>No Activity Logs Recorded</h6>
                                <p className="small mb-0">No recorded audit logs found for this patient.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          activityLogs.map((log, idx) => (
                            <TableRow key={log?.id || idx} hover>
                              <TableCell sx={{ fontWeight: 600, color: "#64748b" }}>
                                {(activityPage - 1) * 25 + idx + 1}
                              </TableCell>
                              <TableCell>
                                <div className="activity-user-pill">
                                  <div className="activity-user-avatar">
                                    {(log?.performedBy || "U").charAt(0).toUpperCase()}
                                  </div>
                                  <span>{log?.performedBy || "System"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`activity-role-badge ${String(log?.userRole || "").toLowerCase().includes("doc")
                                      ? "activity-role-doctor"
                                      : String(log?.userRole || "").toLowerCase().includes("coord")
                                        ? "activity-role-coordinator"
                                        : String(log?.userRole || "").toLowerCase().includes("physio")
                                          ? "activity-role-physio"
                                          : String(log?.userRole || "").toLowerCase().includes("hosp")
                                            ? "activity-role-hospital"
                                            : String(log?.userRole || "").toLowerCase().includes("admin") ||
                                              String(log?.userRole || "").toLowerCase().includes("manag")
                                              ? "activity-role-admin"
                                              : "activity-role-default"
                                    }`}
                                >
                                  {log?.userRole || "-"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="activity-module-badge">
                                  <i className="fa-regular fa-folder me-1 text-muted"></i>
                                  {log?.module || "-"}
                                </span>
                              </TableCell>
                              <TableCell sx={{ minWidth: "260px" }}>
                                <div style={{ wordBreak: "break-word", lineHeight: "1.45", color: "#1e293b" }}>
                                  {log?.description || "-"}
                                </div>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap", color: "#64748b", fontSize: "0.78rem" }}>
                                <i className="fa-regular fa-clock me-1 text-muted"></i>
                                {log?.dateTime || "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {!activityLoading && (activityTotalPages > 1 || activityTotalRecords > 0) && (
                    <div
                      className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2 px-3 py-2 bg-white"
                      style={{
                        flexShrink: 0,
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                      }}
                    >
                      <div className="text-muted small">
                        Showing <strong>{(activityPage - 1) * 25 + 1}</strong> to{" "}
                        <strong>{Math.min(activityPage * 25, activityTotalRecords)}</strong> of{" "}
                        <strong>{activityTotalRecords}</strong> records
                      </div>
                      {activityTotalPages > 1 && (
                        <Pagination
                          className="page-nation"
                          count={activityTotalPages}
                          page={activityPage}
                          onChange={handleActivityPageChange}
                          color="primary"
                          size="small"
                          shape="rounded"
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AssignPhysiotherapistModal
        open={assignPhysioModalOpen}
        onClose={() => {
          setAssignPhysioModalOpen(false);
          setAssignPhysioPatient(null);
          setAssignPhysioExistingCase(null);
        }}
        patient={assignPhysioPatient}
        existingAssignment={assignPhysioExistingCase}
        onSuccess={handleAssignPhysioSuccess}
      />
      <ReferralModal
        open={createPhysioModalOpen}
        onClose={() => {
          setCreatePhysioModalOpen(false);
          setCreatePhysioPatient(null);
        }}
        prefilledPatient={createPhysioPatient}
        onSuccess={() => {
          loadPhysioMap();
          fetchPatientsList();
        }}
      />
      <AssignCoordinatorModal
        open={assignCoordModalOpen}
        onClose={() => {
          setAssignCoordModalOpen(false);
          setAssignCoordPatient(null);
        }}
        patient={assignCoordPatient}
        onSuccess={handleAssignCoordinatorSuccess}
      />
      <AssignReferralModal
        open={assignReferralModalOpen}
        onClose={() => {
          setAssignReferralModalOpen(false);
          setAssignReferralPatient(null);
        }}
        patient={assignReferralPatient}
        onSuccess={handleAssignReferralSuccess}
      />
      <AssignInsuranceModal
        open={assignInsuranceModalOpen}
        onClose={() => {
          setAssignInsuranceModalOpen(false);
          setAssignInsurancePatient(null);
        }}
        patient={assignInsurancePatient}
        onSuccess={handleAssignInsuranceSuccess}
      />
    </>
  );
}
