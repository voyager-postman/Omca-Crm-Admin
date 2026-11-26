import React from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useState, useEffect, useCallback, useRef } from "react";
import { DeleteEnquiry, GetAllEnquiry } from "../../src/reducer/EnquirySlice";
import { todayDateInput } from "../utils/dateInput";
import { GetAllCountries2 } from "../reducer/Countries";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import { EnquiryStatus } from "../../src/reducer/EnquirySlice";
import MenuItem from "@mui/material/MenuItem";
import { ImportEnquirys } from "../../src/reducer/EnquirySlice";
import IconButton from "@mui/material/IconButton";
import ClearIcon from "@mui/icons-material/Clear";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import VisibilityIcon from "@mui/icons-material/Visibility";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AssignmentIcon from "@mui/icons-material/Assignment";
import axios from "axios";
import CameraFileUpload from "../components/Common/CameraFileUpload";
import { AdminBaseUrl, baseurl } from "../Basurl/Baseurl";
import { formatTime12Hour } from "../utils/appointmentHelpers";
import AppointmentTransportFields from "../components/Common/AppointmentTransportFields";
import { GetAllTreatment } from "../reducer/TreatmentSlice";
import { Autocomplete, OutlinedInput, Pagination, Stack } from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import { usePDF } from "react-to-pdf";
import { GetAllHositalData } from "../reducer/HospitalSlice";
import { Field } from "formik";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import {
  SOS_STATUS_OPTIONS,
  formatEmergencyContacts,
  formatSosDisplayValue,
  getSosItemKey,
  getSosPatientPhone,
  normalizeSosData,
} from "../utils/sosHelpers";
import {
  SOS_EMERGENCY_PERMISSION,
  CAMPAIGN_CONTACTS_PERMISSION,
  CHATBOT_LEADS_PERMISSION,
  ENQUIRY_SUB_TAB_PERMISSIONS,
  hasEnquirySubTabPermission,
  hasDashboardPermission,
  hasDoctorReviewPermission,
  hasActivityLogPermission,
  openSosAlertFromListing,
  isSocialMediaRole,
} from "../utils/sosPermissions";
import EnquiryActivityLogsModal from "./Enquiry/EnquiryActivityLogsModal";
import { useKeyedSubmitLock } from "../hooks/useSubmitLock";
import {
  connectSosSocket,
  onSosAlertDismissed,
  onSosWebAlert,
} from "../services/sosSocket";
import {
  fetchCampaignContacts,
  fetchChatbotLeads,
  updateLeadStatus,
  markLeadAsConverted,
  getConvertedLeadIds,
  CAMPAIGN_ALLOWED_STATUSES,
  syncCampaignContacts,
  fetchCampaignStatuses,
  getCountryNameFromPhone,
} from "../services/leadsApi";
import CreateEnquiryModal from "../components/Common/CreateEnquiryModal";
import {
  fetchUnreadCounts,
  getCachedUnreadCounts,
  markRecordRead,
  markRequestRead,
  normalizeOtherEnquiryUnread,
  publishOtherEnquiryUnread,
  UNREAD_REFRESH_EVENT,
} from "../services/unreadApi";
import { clearUnreadById, UnreadDot } from "../components/NewTag";
import { canStaffDelete, canStaffEdit, canStaffExport } from "../utils/staffActions";
import AssignEnquiryStaffModal from "./Enquiry/components/AssignEnquiryStaffModal";
import UploadEnquiryReportsModal, {
  UploadEnquiryReportsIcon,
} from "../components/Common/UploadEnquiryReportsModal";
import {
  getAssignedCoordinator,
  getAssignedStaffList,
} from "../services/coordinatorApi";

const SOS_LIST_POLL_MS = 10000;

const truncateCellText = (text, maxLength = 15) => {
  if (!text) return "";
  const value = String(text);
  return value.length > maxLength
    ? `${value.substring(0, maxLength)}...`
    : value;
};

const ENQUIRY_FILTER_STORAGE_KEY = "omca_enquiry_filter";
const ENQUIRY_SEARCH_STORAGE_KEY = "omca_enquiry_search";
const ENQUIRY_PAGE_STORAGE_KEY = "omca_enquiry_page";
const ENQUIRY_START_DATE_STORAGE_KEY = "omca_enquiry_start_date";
const ENQUIRY_END_DATE_STORAGE_KEY = "omca_enquiry_end_date";

export const isClosedStatus = (status) => {
  if (status === null || status === undefined) return false;
  const s = String(status).toLowerCase().trim();
  return (
    s === "dead" ||
    s === "close" ||
    s === "closed" ||
    s === "4" ||
    s === "8"
  );
};

export const applyDateRangeFilter = (data, start, end) => {
  if (!start && !end) return data;
  const startTs = start ? new Date(start + "T00:00:00").getTime() : null;
  const endTs = end ? new Date(end + "T23:59:59.999").getTime() : null;

  return (Array.isArray(data) ? data : []).filter((item) => {
    const raw =
      item.interakt_created_at ||
      item.interaktCreatedAt ||
      item.raw?.interakt_created_at ||
      item.raw?.raw_data?.created_at_utc ||
      item.raw_data?.created_at_utc ||
      item.date ||
      item.createdAt ||
      item.created_at ||
      item.createdDate;
    if (!raw) return false;
    const d = new Date(raw);
    const ts = d.getTime();
    if (isNaN(ts)) return false;
    if (startTs !== null && ts < startTs) return false;
    if (endTs !== null && ts > endTs) return false;
    return true;
  });
};

const getInitialEnquiryFilter = () => {
  try {
    const raw = sessionStorage.getItem(ENQUIRY_FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          country: parsed.country || "",
          treatingIn: parsed.treatingIn || "",
          status: parsed.status || "",
        };
      }
    }
  } catch (e) {
    console.error("Failed to parse saved enquiry filter", e);
  }
  return { country: "", treatingIn: "", status: "" };
};

const getInitialSearchFilter = () => {
  try {
    return sessionStorage.getItem(ENQUIRY_SEARCH_STORAGE_KEY) || "";
  } catch (e) {
    return "";
  }
};

const getInitialStartDate = () => {
  try {
    return sessionStorage.getItem(ENQUIRY_START_DATE_STORAGE_KEY) || "";
  } catch (e) {
    return "";
  }
};

const getInitialEndDate = () => {
  try {
    return sessionStorage.getItem(ENQUIRY_END_DATE_STORAGE_KEY) || "";
  } catch (e) {
    return "";
  }
};

const getInitialEnquiryPage = () => {
  try {
    const val = sessionStorage.getItem(ENQUIRY_PAGE_STORAGE_KEY);
    return val !== null && !isNaN(Number(val)) ? Number(val) : 0;
  } catch (e) {
    return 0;
  }
};

export default function Inquiry() {
  const { toPDF, targetRef } = usePDF({ filename: "inquiry.pdf" });
  const role = localStorage.getItem("Role");
  const isInsurance =
    String(role || "").toUpperCase() === "INSURANCE" ||
    Boolean(localStorage.getItem("insurance_id"));
  const isReferral = (role || "").toUpperCase() === "REFERRAL" || isInsurance;
  const allowEdit = isReferral || canStaffEdit();
  const allowDelete = canStaffDelete();
  const allowExport = isReferral || canStaffExport();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [date, setDate] = useState();
  const [datauserId, setDatauserId] = useState([]);
  const [open2, setOpen2] = React.useState(false);
  const [reportUpload, setReportUpload] = useState({
    open: false,
    enquiryId: "",
    recordId: "",
    model: "enquiry",
    label: "",
  });
  const [fullWidth, setFullWidth] = React.useState(true);
  const [maxWidth, setMaxWidth] = React.useState("sm");
  const [open3, setOpen3] = React.useState(false);
  const [open4, setOpen4] = React.useState(false);
  const [open9, setOpen9] = React.useState(false);
  const [filterValue, setFilterValue] = useState(getInitialSearchFilter);
  const filterValueRef = useRef(filterValue);
  const campaignSearchDebounceTimerRef = useRef(null);
  const chatbotSearchDebounceTimerRef = useRef(null);
  useEffect(() => {
    filterValueRef.current = filterValue;
  }, [filterValue]);
  const [startDate, setStartDate] = useState(getInitialStartDate);
  const [endDate, setEndDate] = useState(getInitialEndDate);
  const [tratmentenqId, setTratmentenqId] = useState("");
  const [page, setPage] = useState(getInitialEnquiryPage);
  const [selectedImage, setSelectedImage] = useState(null);
  const [orderDirection, setOrderDirection] = useState("asc");
  const [orderBy, setOrderBy] = useState("");
  const [Title, setTitle] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState([]);
  const [searchApiData, setSearchApiData] = useState([]);
  const [hospitalList, setHospitalList] = useState([]);
  const [roleStatuses, setRoleStatuses] = useState([]);
  const [getcountries, setGetcountries] = useState([]);
  const dispatch = useDispatch();
  const { Enquiry, loading, error } = useSelector((state) => state.Enquiry);
  const { hospital } = useSelector((state) => state.hospital);
  const { Countries } = useSelector((state) => state.Countries);
  const { Treatment } = useSelector((state) => state.Treatment);
  const isSocialMedia = isSocialMediaRole(role);
  const [tabValue, setTabValue] = useState(() => {
    const saved = localStorage.getItem("tabenquiry");
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0;
  });
  const [enquiryFilter, setEnquiryFilter] = useState(getInitialEnquiryFilter);
  const [recommend, setRecommend] = useState("");
  const [images, setImages] = useState([]);
  const [airAmbulanceData, setAirAmbulanceData] = useState([]);
  const [ambulanceData, setAmbulanceData] = useState([]);
  const [otherEnquiryUnread, setOtherEnquiryUnread] = useState(
    normalizeOtherEnquiryUnread(),
  );
  const [enquiryUnread, setEnquiryUnread] = useState(() => Number(getCachedUnreadCounts()?.enquiries) || 0);
  const [hospitlID, setHospitlID] = useState([]);
  const [openAppointment, setOpenAppointment] = useState(false);
  const [appointmentData, setAppointmentData] = useState({
    hospital_id: "",
    hospitalName: "",
    health_issue: "",
    Notes: "",
    appointment_Date: "",
    appointment_Time: "",
    enq_userName: "",
    user_id: "",
    enq_phoneNumber: "",
    enq_email: "",
    enquiryId: "",
  });
  const [treatmentData, setTreatmentData] = useState([]);
  const [sosData, setSosData] = useState([]);
  const [sosLoading, setSosLoading] = useState(false);
  const [socialMediaData, setSocialMediaData] = useState([]);
  const [chatbotLeadsData, setChatbotLeadsData] = useState([]);
  const [socialMediaLoading, setSocialMediaLoading] = useState(false);
  const [chatbotLeadsLoading, setChatbotLeadsLoading] = useState(false);
  const [socialMediaPage, setSocialMediaPage] = useState(1);
  const [chatbotLeadsPage, setChatbotLeadsPage] = useState(1);
  const [socialMediaTotalPages, setSocialMediaTotalPages] = useState(1);
  const [socialMediaTotalCount, setSocialMediaTotalCount] = useState(0);
  const [chatbotLeadsTotalPages, setChatbotLeadsTotalPages] = useState(1);
  const [chatbotLeadsTotalCount, setChatbotLeadsTotalCount] = useState(0);
  const [chatbotStatusFilter, setChatbotStatusFilter] = useState("all");
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("all");
  const [campaignDateFrom, setCampaignDateFrom] = useState("");
  const [campaignDateTo, setCampaignDateTo] = useState("");
  const [campaignTag, setCampaignTag] = useState("");
  const [campaignPerPage, setCampaignPerPage] = useState(10);
  const [campaignStatusCounts, setCampaignStatusCounts] = useState(null);
  const [campaignAvailableStatuses, setCampaignAvailableStatuses] = useState(
    CAMPAIGN_ALLOWED_STATUSES || [
      "Pending",
      "Follow-up",
      "Close",
      "Connected",
      "Not Connected",
      "Donation",
    ]
  );
  const [campaignSyncing, setCampaignSyncing] = useState(false);

  const getCampaignStatusBadgeStyle = (status) => {
    const norm = String(status || "").trim().toLowerCase();
    switch (norm) {
      case "pending":
        return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
      case "follow-up":
        return { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" };
      case "connected":
        return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "not connected":
      case "not-connected":
        return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
      case "close":
      case "closed":
      case "dead":
        return { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" };
      case "donation":
        return { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" };
      default:
        return { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" };
    }
  };
  const { busyKey, run: runSubmit } = useKeyedSubmitLock();
  // testForms removed to avoid redundant API calls
  useEffect(() => {
    getUserId();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadEnquiryUnread = async () => {
      try {
        const result = await fetchUnreadCounts();
        if (cancelled || !result?.success || !result.counts) return;
        setEnquiryUnread(Number(result.counts.enquiries) || 0);
      } catch (error) {
        console.log(error);
      }
    };
    loadEnquiryUnread();
    window.addEventListener(UNREAD_REFRESH_EVENT, loadEnquiryUnread);
    return () => {
      cancelled = true;
      window.removeEventListener(UNREAD_REFRESH_EVENT, loadEnquiryUnread);
    };
  }, []);
  useEffect(() => {
    setHospitalFunction();
  }, []);
  const handleNoteChange = (e) => {
    setNote(e.target.value);
  };
  const permissions = localStorage.getItem("permissionArray") || "";
  const canDoctorReview = hasDoctorReviewPermission(permissions, role);
  const canTrackActivity = hasActivityLogPermission(permissions, role);
  console.log(permissions);

  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedEnquiryForActivity, setSelectedEnquiryForActivity] = useState(null);

  const [assignStaffModalOpen, setAssignStaffModalOpen] = useState(false);
  const [selectedEnquiryForStaff, setSelectedEnquiryForStaff] = useState(null);

  const handleOpenAssignStaff = (info) => {
    if (isReferral) return;
    markEnquiryAction(info, info?.enquiryId || info?.id);
    setSelectedEnquiryForStaff(info?.raw || info);
    setAssignStaffModalOpen(true);
  };

  const handleCloseAssignStaff = () => {
    setAssignStaffModalOpen(false);
    setSelectedEnquiryForStaff(null);
  };

  const handleAssignStaffSuccess = (newCoord, targetId, newlyAssigned) => {
    setRows((prev) =>
      prev.map((r) => {
        const currentId = r.enquiryId || r.id || r._id;
        if (String(currentId) === String(targetId)) {
          const updatedStaff = Array.isArray(newlyAssigned) && newlyAssigned.length > 0
            ? newlyAssigned
            : (newCoord ? [newCoord] : (r.assignedStaff || []));
          return {
            ...r,
            assignedCoordinator: newCoord || r.assignedCoordinator,
            assignedStaff: updatedStaff,
            raw: {
              ...(r.raw || {}),
              assignedCoordinator: newCoord || r.raw?.assignedCoordinator,
              assignedStaff: updatedStaff,
            },
          };
        }
        return r;
      })
    );
    dispatch(GetAllEnquiry());
  };

  const handleOpenEnquiryActivity = (info) => {
    setSelectedEnquiryForActivity(info);
    setActivityModalOpen(true);
  };

  const handleCloseEnquiryActivity = () => {
    setActivityModalOpen(false);
    setSelectedEnquiryForActivity(null);
  };
  const handleRecommendTitle = (e) => {
    setTitle(e.target.value);
  };
  const handleRecommendChange = (e) => {
    setRecommend(e.target.value);
  };
  const tabsConfig = [
    {
      label: isInsurance ? "All Enquiry" : "Enquiry",
      value: 0,
      permission: "/Enquiries",
      unread: enquiryUnread,
    },
    {
      label: "Ambulance Service",
      value: 1,
      permission: "/Ambulance_Service",
      unread: otherEnquiryUnread.ambulance_requests,
    },
    {
      label: "Air Medical Escort",
      value: 2,
      permission: "/Air_Medical_Escort",
      unread: otherEnquiryUnread.air_ambulance,
    },
    {
      label: "Treatment Estimate",
      value: 3,
      permission: "/Treatment_Estimate",
      unread: otherEnquiryUnread.get_treatment_estimate,
    },
    {
      label: "Emergency SOS",
      value: 4,
      permission: SOS_EMERGENCY_PERMISSION,
    },
    {
      label: "CAMPAIGN CONTACTS",
      value: 5,
      permission: CAMPAIGN_CONTACTS_PERMISSION,
    },
    {
      label: "CHATBOT LEADS",
      value: 6,
      permission: CHATBOT_LEADS_PERMISSION,
    },
    {
      label: "Closed",
      value: 7,
      permission: "/Enquiries",
    },
  ];
  const isLeadTab = tabValue === 5 || tabValue === 6;
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
  };
  const filteredTabs = tabsConfig.filter((tab) => {
    if (String(role || "").toLowerCase() === "admin") {
      return true;
    }
    if (isInsurance) {
      return [0, 1, 2, 3, 4, 7].includes(tab.value);
    }
    return ENQUIRY_SUB_TAB_PERMISSIONS.includes(tab.permission)
      ? hasEnquirySubTabPermission(permissions, tab.permission, role)
      : (permissions.includes(tab.permission) ||
          hasDashboardPermission(permissions, tab.permission, role));
  });
  const handleNotesdataqw = async (e) => {
    e.preventDefault();
    if (!Title || !note || !recommend) {
      return Swal.fire("Error", "All fields are required", "error");
    }

    await runSubmit("review", async () => {
      try {
        let response;
        if (tabValue === 0) {
          const enquiryPayload = new FormData();
          enquiryPayload.append("title", Title); // <-- Add this
          enquiryPayload.append("review_notes", note);
          enquiryPayload.append("Recommendations", recommend); // ⚠️ old API key
          enquiryPayload.append("enquiryId", enqId);
          enquiryPayload.append("user_type", statusRole);
          images.forEach((img) => {
            enquiryPayload.append("images", img);
          });
          console.log("OLD API PAYLOAD →", [...enquiryPayload.entries()]);
          response = await axios.post(
            `${baseurl}addDoctorReview`,
            enquiryPayload,
          );
        } else {
          const newPayload = new FormData();
          const typeMap = {
            1: "AmbulanceRequest",
            2: "AirAmbulance",
            3: "PatientQuery",
          };
          newPayload.append("review_notes", note);
          newPayload.append("enquiry_id", tratmentenqId);
          newPayload.append("recommendations", recommend);
          newPayload.append("title", Title);
          newPayload.append("user_type", statusRole);
          newPayload.append("reference_id", enqId);
          newPayload.append("model_type", typeMap[tabValue]);
          images.forEach((img) => {
            newPayload.append("images[]", img);
          });
          console.log("NEW API PAYLOAD →", [...newPayload.entries()]);
          response = await axios.post(`${AdminBaseUrl}review/store`, newPayload);
        }
        if (response?.data?.success) {
          handleClose4();
          Swal.fire("Success", "Doctor Review Added Successfully", "success");
          setTitle(""); // <-- Clear title
          setNote("");
          setRecommend("");
          setImages([]);
        }
      } catch (error) {
        console.log(error);

        let message = "Something went wrong";

        if (error.response) {
          message = error.response.data?.message || message;
        } else if (error.request) {
          message = "No response from server";
        } else {
          message = error.message;
        }
        Swal.fire("Error", message, "error");
      }
    });
  };
  const statusRole = localStorage.getItem("Role");
  const get3tabdata = async (datauserId, getcountry, rolestatus) => {
    const payload = {
      user_ids: datauserId,
      accessCountries: getcountry,
      roleStatuses: rolestatus,
      is_admin: statusRole === "Admin" ? 1 : 0,
    };
    try {
      const response = await axios.post(
        `${AdminBaseUrl}other_enquiry_requests`,
        payload,
      );
      console.log(response.data.data);
      setAirAmbulanceData(response.data?.data?.air_ambulance || []);
      setAmbulanceData(response?.data?.data?.ambulance_requests || []);
      setTreatmentData(response?.data?.data?.get_treatment_estimate || []);
      if (response?.data?.unreadCount) {
        setOtherEnquiryUnread(
          normalizeOtherEnquiryUnread(response.data.unreadCount),
        );
        publishOtherEnquiryUnread(response.data.unreadCount);
      }
    } catch (error) {
      console.log(error);
    }
  };
  const getSosList = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSosLoading(true);
    try {
      const response = await axios.get(`${baseurl}sos/list`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const apiData = response.data?.data || [];
      if (response.data?.success && Array.isArray(apiData)) {
        setSosData(apiData);
      } else if (Array.isArray(apiData)) {
        setSosData(apiData);
      } else {
        setSosData([]);
      }
    } catch (error) {
      console.log(error);
      if (!silent) setSosData([]);
    } finally {
      if (!silent) setSosLoading(false);
    }
  }, []);

  const getSocialMediaList = useCallback(
    async (pageNum = 1, overrideParams = {}) => {
      setSocialMediaLoading(true);
      try {
        const queryParams = {
          page: pageNum,
          per_page: overrideParams.per_page ?? campaignPerPage,
          status: overrideParams.status ?? campaignStatusFilter,
          search:
            overrideParams.search !== undefined
              ? overrideParams.search
              : (tabValue === 5 ? (filterValueRef.current || "") : ""),
          date_from: overrideParams.date_from ?? campaignDateFrom,
          date_to: overrideParams.date_to ?? campaignDateTo,
          tag: overrideParams.tag ?? campaignTag,
        };
        const result = await fetchCampaignContacts(queryParams);
        const convertedIds = getConvertedLeadIds("campaign");
        const activeData = (result.data || []).filter(
          (item) =>
            !convertedIds.includes(String(item.id)) &&
            !convertedIds.includes(String(item.enquiryId)),
        );
        setSocialMediaData(activeData);
        setSocialMediaTotalPages(result.lastPage || 1);
        setSocialMediaPage(result.currentPage || pageNum);
        setSocialMediaTotalCount(
          result.total !== undefined ? result.total : activeData.length,
        );
        if (result.statuses && Array.isArray(result.statuses) && result.statuses.length > 0) {
          const valid = result.statuses.filter((s) =>
            CAMPAIGN_ALLOWED_STATUSES.some(
              (allowed) => allowed.toLowerCase() === String(s).trim().toLowerCase()
            )
          );
          setCampaignAvailableStatuses(
            valid.length > 0 ? valid : CAMPAIGN_ALLOWED_STATUSES
          );
        } else {
          setCampaignAvailableStatuses(CAMPAIGN_ALLOWED_STATUSES);
        }
        if (result.countsByStatus) {
          setCampaignStatusCounts(result.countsByStatus);
        }
      } catch (error) {
        console.log(error);
        setSocialMediaData([]);
        setSocialMediaTotalPages(1);
        setSocialMediaTotalCount(0);
        toast.error(
          error?.response?.data?.message || "Failed to load Campaign Contacts",
        );
      } finally {
        setSocialMediaLoading(false);
      }
    },
    [
      campaignPerPage,
      campaignStatusFilter,
      tabValue,
      campaignDateFrom,
      campaignDateTo,
      campaignTag,
    ]
  );

  const handleCampaignStatusFilterChange = (status) => {
    setCampaignStatusFilter(status);
    setSocialMediaPage(1);
    getSocialMediaList(1, { status });
  };

  const handleResetCampaignFilters = () => {
    if (campaignSearchDebounceTimerRef.current) {
      clearTimeout(campaignSearchDebounceTimerRef.current);
    }
    setCampaignStatusFilter("all");
    setCampaignDateFrom("");
    setCampaignDateTo("");
    setCampaignTag("");
    setFilterValue("");
    filterValueRef.current = "";
    sessionStorage.removeItem(ENQUIRY_SEARCH_STORAGE_KEY);
    setSocialMediaPage(1);
    getSocialMediaList(1, {
      status: "all",
      date_from: "",
      date_to: "",
      tag: "",
      search: "",
    });
  };

  const handleSyncCampaignContacts = async () => {
    if (campaignSyncing) return;
    setCampaignSyncing(true);
    try {
      const res = await syncCampaignContacts({
        page: 1,
        limit: 100,
        tag: campaignTag || undefined,
      });
      const respMsg =
        res?.message ||
        res?.data?.message ||
        "Contacts fetched and synchronized successfully.";

      Swal.fire({
        icon: "success",
        title: "Sync Completed",
        text: respMsg,
        showConfirmButton: true,
      });
      getSocialMediaList(1);
    } catch (err) {
      console.error("Sync contacts failed:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.msg ||
        err?.message ||
        "Could not sync contacts";
      Swal.fire({
        icon: "error",
        title: "Sync Failed",
        text: errMsg,
      });
    } finally {
      setCampaignSyncing(false);
    }
  };

  const getChatbotLeadsList = useCallback(
    async (pageNum = 1, overrideParams = {}) => {
      setChatbotLeadsLoading(true);
      try {
        const queryLimit = overrideParams.limit ?? rowsPerPage;
        const querySearch =
          overrideParams.search !== undefined
            ? overrideParams.search
            : (tabValue === 6 ? (filterValueRef.current || "") : "");
        const queryStartDate =
          overrideParams.startDate !== undefined
            ? overrideParams.startDate
            : (overrideParams.date_from !== undefined
              ? overrideParams.date_from
              : (tabValue === 6 ? startDate : ""));
        const queryEndDate =
          overrideParams.endDate !== undefined
            ? overrideParams.endDate
            : (overrideParams.date_to !== undefined
              ? overrideParams.date_to
              : (tabValue === 6 ? endDate : ""));
        const queryStatus =
          overrideParams.status !== undefined
            ? overrideParams.status
            : (tabValue === 6 ? chatbotStatusFilter : "all");

        const result = await fetchChatbotLeads({
          page: pageNum,
          limit: queryLimit,
          search: querySearch,
          startDate: queryStartDate,
          endDate: queryEndDate,
          status: queryStatus,
        });

        const convertedIds = getConvertedLeadIds("chatbot");
        const activeData = (result.data || []).filter(
          (item) =>
            !convertedIds.includes(String(item.id)) &&
            !convertedIds.includes(String(item.enquiryId)),
        );

        setChatbotLeadsData(activeData);
        setChatbotLeadsTotalPages(result.lastPage || 1);
        setChatbotLeadsPage(result.currentPage || pageNum);
        setChatbotLeadsTotalCount(
          result.total !== undefined ? result.total : activeData.length,
        );
      } catch (error) {
        console.log(error);
        setChatbotLeadsData([]);
        setChatbotLeadsTotalPages(1);
        setChatbotLeadsTotalCount(0);
        toast.error(
          error?.response?.data?.message || "Failed to load Chatbot Leads",
        );
      } finally {
        setChatbotLeadsLoading(false);
      }
    },
    [rowsPerPage, tabValue, startDate, endDate, chatbotStatusFilter]
  );

  const getSosListRef = useRef(getSosList);
  getSosListRef.current = getSosList;
  const getPatientPhone = (info) => getSosPatientPhone(info);
  const markEnquiryAction = (info, fallbackId) => {
    const recordId = String(
      (info && typeof info === "object"
        ? info.enquiryId || info.sosId || info.id
        : "") ||
        fallbackId ||
        "",
    ).trim();
    if (!recordId) return;
    markRecordRead("enquiries", recordId);
    const keys = ["enquiryId", "sosId", "id"];
    setRows((prev) => clearUnreadById(prev, recordId, keys));
    setSosData((prev) => clearUnreadById(prev, recordId, keys));
  };
  const REQUEST_READ_TABS = {
    1: { model: "ambulance_requests", setData: setAmbulanceData },
    2: { model: "air_ambulance", setData: setAirAmbulanceData },
    3: { model: "get_treatment_estimate", setData: setTreatmentData },
  };
  const markRequestRowRead = async (info) => {
    const config = REQUEST_READ_TABS[tabValue];
    if (!config || info?.isUnread !== true || !info?.id) return;
    const ok = await markRequestRead(config.model, info.id);
    if (!ok) return;
    config.setData((prev) =>
      prev.map((item) =>
        String(item.id) === String(info.id)
          ? { ...item, isUnread: false, is_seen: 1 }
          : item,
      ),
    );
    setOtherEnquiryUnread((prev) => {
      const next = {
        ...prev,
        [config.model]: Math.max(0, (prev[config.model] || 0) - 1),
      };
      publishOtherEnquiryUnread(next);
      return next;
    });
  };
  const handleAcceptSos = async (info) => {
    markEnquiryAction(info);
    const result = await Swal.fire({
      title: "Accept Case?",
      text: `Accept SOS case for ${info.name}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Accept",
    });
    if (!result.isConfirmed) return;
    const sosId = info.sosId || info.id;
    try {
      const res = await axios.put(
        `${baseurl}sos/${sosId}/accept`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      if (res?.data?.success !== false) {
        Swal.fire("Success", "Case accepted successfully", "success");
        getSosList();
      }
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to accept SOS case",
        "error",
      );
    }
  };
  const postSosListAction = async (sosId, type) => {
    return axios.post(
      `${baseurl}sos/${sosId}/action`,
      { type },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      },
    );
  };
  const handleCallPatient = async (info) => {
    markEnquiryAction(info);
    const phone = getPatientPhone(info);
    if (!phone) {
      return Swal.fire("Error", "Patient phone number not available", "error");
    }
    window.location.href = `tel:${phone}`;
    try {
      await postSosListAction(info.sosId || info.id, "Call");
    } catch (error) {
      console.log(error);
    }
  };
  const handleWhatsAppPatient = async (info) => {
    markEnquiryAction(info);
    const phone = getPatientPhone(info).replace(/\+/g, "");
    if (!phone) {
      return Swal.fire("Error", "Patient phone number not available", "error");
    }
    window.open(`https://wa.me/${phone}`, "_blank");
    try {
      await postSosListAction(info.sosId || info.id, "WhatsApp");
    } catch (error) {
      console.log(error);
    }
  };
  const handleDispatchAmbulance = async (info) => {
    markEnquiryAction(info);
    const sosId = info.sosId || info.id;
    try {
      await postSosListAction(sosId, "DispatchAmbulance");
      Swal.fire({
        title: "Ambulance Dispatched",
        text: `Ambulance dispatch logged for ${info.name}.`,
        icon: "success",
      });
      getSosList();
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to dispatch ambulance",
        "error",
      );
    }
  };
  const handleArrangeAirAmbulance = async (info) => {
    markEnquiryAction(info);
    const sosId = info.sosId || info.id;
    try {
      await postSosListAction(sosId, "AirAmbulance");
      Swal.fire({
        title: "Air Ambulance Arranged",
        text: `Air ambulance arrangement logged for ${info.name}.`,
        icon: "success",
      });
      getSosList();
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to arrange air ambulance",
        "error",
      );
    }
  };
  const ViewSosDetail = (e, info) => {
    markEnquiryAction(info);
    localStorage.setItem("tabenquiry", 4);
    navigate("/Admin/SOS-Detail", {
      state: {
        id: info.sosId || info.id,
        data: info.raw || info,
      },
    });
  };
  const OpenSosAlertModal = (e, info) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    markEnquiryAction(info);
    const sosId = info?.sosId || info?.id;
    if (!sosId) return;
    openSosAlertFromListing(sosId, {
      type: "SOS_REOPEN_FROM_LIST",
      sosId,
      emergencyCaseId: info.emergencyCaseId,
      patientName: info.name,
      status: info.status,
      title: "SOS ALERT",
      body: `${info.name || "Patient"} — Emergency case from listing`,
      ...(info.raw || info),
    });
  };
  const handleSosStatusChange = async (e, info) => {
    markEnquiryAction(info);
    const status = e.target.value;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Update SOS status to ${status}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes",
    });
    if (!result.isConfirmed) return;
    const sosId = info.sosId || info.id;
    const itemKey = getSosItemKey(info);

    // Prefer dedicated close endpoint when closing
    if (String(status).toLowerCase() === "closed") {
      try {
        await axios.put(
          `${baseurl}sos/${sosId}/close`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );
        setSosData((prev) =>
          prev.map((item) =>
            getSosItemKey(item) === itemKey ? { ...item, status } : item,
          ),
        );
        setSosStatus((prev) => ({ ...prev, [itemKey]: status }));
        return;
      } catch (error) {
        Swal.fire(
          "Error",
          error?.response?.data?.message || "Failed to close SOS",
          "error",
        );
        return;
      }
    }

    try {
      const response = await axios.post(
        `${baseurl}sos/update_status`,
        { sosId, status },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      if (response?.data?.success) {
        setSosData((prev) =>
          prev.map((item) =>
            getSosItemKey(item) === itemKey ? { ...item, status } : item,
          ),
        );
        setSosStatus((prev) => ({ ...prev, [itemKey]: status }));
      }
    } catch (error) {
      setSosData((prev) =>
        prev.map((item) =>
          getSosItemKey(item) === itemKey ? { ...item, status } : item,
        ),
      );
      setSosStatus((prev) => ({ ...prev, [itemKey]: status }));
    }
  };
  useEffect(() => {
    dispatch(GetAllHositalData());
    console.log(error, hospital);
  }, [dispatch]);
  const [seekerStatus, setSeekerStatus] = React.useState({});
  const [sosStatus, setSosStatus] = React.useState({});
  const [blogErr, setBlogErr] = useState(false);
  const [pdfRowLimit, setPdfRowLimit] = useState(false);
  console.log(Enquiry);
  const [enqId, setEnqId] = useState("");
  const handleClose3 = () => {
    setOpen3(false);
  };
  const handleClose2 = () => {
    setOpen2(false);
  };
  const handleClose4 = () => {
    setOpen4(false);
    setImages([]);
    setTitle("");
    setNote("");
    setRecommend("");
  };
  const handleClose2wew = () => {
    setOpen9(false);
  };
  const handleClickOpen2modla = () => {
    setOpen9(true);
  };
  const ENQUIRY_REPORT_MODELS = {
    0: "enquiry",
    1: "ambulance_requests",
    2: "air_ambulance",
    3: "get_treatment_estimate",
  };

  const canUploadEnquiryReports = (info) => {
    const src = tabValue === 7 ? info?.tabSource ?? 0 : tabValue;
    return src === 0 || src === 1 || src === 2 || src === 3;
  };

  const handleOpenEnquiryReports = (e, info) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const src = tabValue === 7 ? info?.tabSource ?? 0 : tabValue;
    setReportUpload({
      open: true,
      enquiryId: info?.enquiryId || info?.id || "",
      recordId: info?.id || info?.enquiryId || "",
      model: ENQUIRY_REPORT_MODELS[src] || "enquiry",
      label: info?.enquiryId || info?.id || "",
    });
  };

  const handleCloseEnquiryReports = () => {
    setReportUpload({
      open: false,
      enquiryId: "",
      recordId: "",
      model: "enquiry",
      label: "",
    });
  };

  const handleClickOpen2 = (e, enq) => {
    markEnquiryAction(null, enq);
    setOpen2(true);
    setEnqId(enq);
  };
  const handleClickOpen4 = (e, enq, info) => {
    markEnquiryAction(info, enq);
    console.log(info);
    setImages([]);
    setTitle("");
    setNote("");
    setRecommend("");
    setOpen4(true);
    setEnqId(enq);
    setTratmentenqId(info.id);
  };
  const handleClickOpen3 = (e) => {
    setOpen3(true);
  };
  const statusMap = {
    0: "Pending",
    1: "Confirmed",
    2: "Hold",
    3: "Follow-Up",
    4: "Close",
    5: "1 Visit",
    6: "2 Visit",
    7: "Visa",
    8: "Close",
    9: "Connected",
    10: "Not Connected",
  };

  const getEnquiryStatusValue = (enquiryStatus) => {
    if (enquiryStatus === "Hold" || enquiryStatus === "2" || enquiryStatus === 2) return "2";
    if (enquiryStatus === "Follow-Up" || enquiryStatus === "follow-up" || enquiryStatus === "3" || enquiryStatus === 3) return "3";
    if (enquiryStatus === "Dead" || enquiryStatus === "Close" || enquiryStatus === "close" || enquiryStatus === "closed" || enquiryStatus === "8" || enquiryStatus === 8 || enquiryStatus === "4" || enquiryStatus === 4) return "8";
    if (enquiryStatus === "1 Visit" || enquiryStatus === "Visit 1" || enquiryStatus === "5" || enquiryStatus === 5) return "5";
    if (enquiryStatus === "2 Visit" || enquiryStatus === "Visit 2" || enquiryStatus === "6" || enquiryStatus === 6) return "6";
    if (enquiryStatus === "Visa" || enquiryStatus === "7" || enquiryStatus === 7) return "7";
    if (enquiryStatus === "Connected" || enquiryStatus === "connected" || enquiryStatus === "9" || enquiryStatus === 9) return "9";
    if (enquiryStatus === "Not Connected" || enquiryStatus === "not connected" || enquiryStatus === "not-connected" || enquiryStatus === "10" || enquiryStatus === 10) return "10";
    if (enquiryStatus === "Confirmed" || enquiryStatus === "Confirm" || enquiryStatus === "1" || enquiryStatus === 1) return "1";
    return "0";
  };
  useEffect(() => {
    if (!isSocialMedia) {
      const savedFilter = getInitialEnquiryFilter();
      const hasFilter =
        Boolean(savedFilter.country) ||
        Boolean(savedFilter.treatingIn) ||
        Boolean(savedFilter.status);

      if (hasFilter) {
        dispatch(
          GetAllEnquiry({
            country: savedFilter.country || undefined,
            treatingIn: savedFilter.treatingIn || undefined,
            status: savedFilter.status || undefined,
          }),
        );
      } else {
        dispatch(GetAllEnquiry());
      }
      dispatch(GetAllCountries2());
    }
    console.log(error, Enquiry);
  }, [dispatch, isSocialMedia]);

  const handleEnquiryFilterChange = (event) => {
    const { name, value } = event.target;
    setEnquiryFilter((prev) => {
      const next = { ...prev, [name]: value };
      sessionStorage.setItem(ENQUIRY_FILTER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleEnquiryFilterSubmit = () => {
    setFilterValue("");
    sessionStorage.removeItem(ENQUIRY_SEARCH_STORAGE_KEY);
    setPage(0);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");
    sessionStorage.setItem(
      ENQUIRY_FILTER_STORAGE_KEY,
      JSON.stringify(enquiryFilter),
    );
    dispatch(
      GetAllEnquiry({
        country: enquiryFilter.country || undefined,
        treatingIn: enquiryFilter.treatingIn || undefined,
        status: enquiryFilter.status || undefined,
      }),
    );
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDate(val);
    sessionStorage.setItem(ENQUIRY_START_DATE_STORAGE_KEY, val);
    setPage(0);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setEndDate(val);
    sessionStorage.setItem(ENQUIRY_END_DATE_STORAGE_KEY, val);
    setPage(0);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");
  };

  const handleClearDateRange = () => {
    setStartDate("");
    setEndDate("");
    sessionStorage.removeItem(ENQUIRY_START_DATE_STORAGE_KEY);
    sessionStorage.removeItem(ENQUIRY_END_DATE_STORAGE_KEY);
    setPage(0);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");
  };

  const handleEnquiryFilterClear = () => {
    const reset = { country: "", treatingIn: "", status: "" };
    setEnquiryFilter(reset);
    setFilterValue("");
    setStartDate("");
    setEndDate("");
    setPage(0);
    sessionStorage.removeItem(ENQUIRY_FILTER_STORAGE_KEY);
    sessionStorage.removeItem(ENQUIRY_SEARCH_STORAGE_KEY);
    sessionStorage.removeItem(ENQUIRY_START_DATE_STORAGE_KEY);
    sessionStorage.removeItem(ENQUIRY_END_DATE_STORAGE_KEY);
    sessionStorage.removeItem(ENQUIRY_PAGE_STORAGE_KEY);
    dispatch(GetAllEnquiry());
  };

  useEffect(() => {
    if (tabValue === 4) {
      getSosList();
    }
  }, [tabValue, getSosList]);

  useEffect(() => {
    if (tabValue === 5) {
      getSocialMediaList(socialMediaPage);
    }
  }, [tabValue, socialMediaPage, getSocialMediaList]);

  useEffect(() => {
    if (tabValue === 6) {
      getChatbotLeadsList(chatbotLeadsPage);
    }
  }, [tabValue, chatbotLeadsPage, getChatbotLeadsList]);

  // Keep Emergency SOS list live: socket events + polling + tab focus
  useEffect(() => {
    if (tabValue !== 4) return undefined;

    const token = localStorage.getItem("token");
    if (token) connectSosSocket(token);

    const refreshQuiet = () => getSosListRef.current?.({ silent: true });

    // Debounce rapid socket bursts (new alert + escalation + dismiss)
    let debounceTimer = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshQuiet, 400);
    };

    const unsubAlert = onSosWebAlert(() => {
      scheduleRefresh();
    });
    const unsubDismiss = onSosAlertDismissed(() => {
      scheduleRefresh();
    });

    const pollId = setInterval(refreshQuiet, SOS_LIST_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshQuiet();
    };
    const onFocus = () => refreshQuiet();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubAlert();
      unsubDismiss();
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [tabValue]);

  useEffect(() => {
    const savedTab = localStorage.getItem("tabenquiry");
    const permittedValues = filteredTabs.map((t) => t.value);

    if (savedTab !== null && permittedValues.includes(Number(savedTab))) {
      setTabValue(Number(savedTab));
    } else if (permittedValues.length > 0) {
      setTabValue(permittedValues[0]);
      localStorage.setItem("tabenquiry", permittedValues[0]);
    }
  }, [permissions, filteredTabs.length]);
  console.log(searchApiData);
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, String(newPage));
  };
  const EditButton = (e, id) => {
    markEnquiryAction(null, id);
    navigate("/Admin/edit-Enquiry", {
      state: {
        enquiryId: id,
      },
    });
  };
  const EditAmbulance = (e, info) => {
    markEnquiryAction(info);
    localStorage.setItem("tabenquiry", "1");
    navigate("/Admin/edit-ambulance", {
      state: {
        id: info?.raw?.id || info?.id,
        user_id: info?.raw?.user_id || info?.user_id,
        enquiryId: info?.enquiryId,
      },
    });
  };
  const EditAirAmbulance = (e, info) => {
    markEnquiryAction(info);
    localStorage.setItem("tabenquiry", "2");
    navigate("/Admin/edit-air-ambulance", {
      state: {
        id: info?.raw?.id || info?.id,
        enquiryId: info?.enquiryId,
      },
    });
  };
  const EditTreatmentEstimate = (e, info) => {
    markEnquiryAction(info);
    localStorage.setItem("tabenquiry", "3");
    navigate("/Admin/edit-treatment-estimate", {
      state: {
        id: info?.raw?.id || info?.id,
        enquiryId: info?.enquiryId,
      },
    });
  };
  const handleDeleteExternal = async (row) => {
    markEnquiryAction(row);
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you want to delete this request?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!result.isConfirmed) return;
    try {
      const payload = {
        id: row.raw?.id || row.enquiryId, // ✅ safe id
        model:
          tabValue === 1
            ? "AmbulanceRequest"
            : tabValue === 2
              ? "AirAmbulance"
              : tabValue === 3
                ? "PatientQuery"
                : "",
        status: "Deleted",
      };
      const res = await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        payload,
      );
      if (res?.data?.success) {
        Swal.fire("Deleted!", "Record deleted successfully", "success");
        await getUserId(); // tab data reload
      }
    } catch (error) {
      console.log(error);
      Swal.fire("Error!", "Something went wrong", "error");
    }
  };
  const ViewDetail = (e, type, info) => {
    console.log(e, type, info);
    markEnquiryAction(info);
    const resolvedType = type === 7 ? (info?.tabSource ?? 0) : type;
    const routeMap = {
      0: "/Admin/Enquiry-Detail",
      1: "/Admin/Enquiry-DetailAmbulance",
      2: "/Admin/airambulanceview",
      3: "/Admin/medicalescortservice",
    };
    const path = routeMap[resolvedType];
    if (!path) return;
    console.log(resolvedType);
    localStorage.setItem("tabenquiry", resolvedType);
    navigate(path, {
      state: {
        id: resolvedType === 0 ? info.enquiryId : info.id, // ✅ FIX
        enquiryId: info.enquiryId, // optional
        type: resolvedType,
      },
    });
  };
  const sendToPatientAPI = async (type, data) => {
    console.log(data);
    try {
      const response = await axios.post(`${baseurl}createPatientFromExternal`, {
        enquiry_type: type,
        data: data,
      });
      if (response.data.success) {
        await get3tabdata(datauserId, getcountries, roleStatuses);
        // Swal.fire("Success!", `${type} converted to patient`, "success");
      }
    } catch (error) {
      console.log(error);
      Swal.fire("Error!", "Something went wrong", "error");
    }
  };
  const handleChangtype = async (e, b) => {
    markEnquiryAction(b);
    const value = e?.value || e?.target?.value;
    console.log(tabValue);
    console.log(e);
    console.log(value);
    const data1 = parseInt(value);
    const data = {
      id: b?.id,
      status: statusMap[data1],
      model:
        tabValue === 1
          ? "AmbulanceRequest"
          : tabValue === 2
            ? "AirAmbulance"
            : tabValue === 3
              ? "PatientQuery"
              : "",
    };
    try {
      const response = await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        data,
      );
      await get3tabdata(datauserId, getcountries, roleStatuses);
      if (response?.data?.success) {
        // Swal.fire("Success", "Status Updated Successfully", "success");
      }
    } catch (error) {
      console.log(error);
      Swal.fire("Error", "Something went wrong", "error");
    }
  };
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    localStorage.setItem("tabenquiry", newValue);
    setRows([]);
    setSearchApiData([]);
    setPage(0);
    setFilterValue("");
    if (newValue === 5) setSocialMediaPage(1);
    if (newValue === 6) setChatbotLeadsPage(1);
  };

  const handleViewLeadDetail = (info) => {
    if (info?.enquiryId || info?.sosId) markEnquiryAction(info);
    setSelectedLead(info);
    setLeadDetailOpen(true);
  };

  const handleCloseLeadDetail = () => {
    setLeadDetailOpen(false);
    setSelectedLead(null);
  };

  const [createEnquiryModalOpen, setCreateEnquiryModalOpen] = useState(false);
  const [selectedLeadForEnquiry, setSelectedLeadForEnquiry] = useState(null);
  const [leadEnquirySourceType, setLeadEnquirySourceType] = useState("campaign");
  const [leadModalMode, setLeadModalMode] = useState("create"); // "create" | "edit"

  const handleOpenEditLeadModal = (info, currentTab = tabValue) => {
    if (!info) return;
    setSelectedLeadForEnquiry(info);
    setLeadEnquirySourceType(currentTab === 5 ? "campaign" : "chatbot");
    setLeadModalMode("edit");
    setCreateEnquiryModalOpen(true);
  };

  const handleOpenCreateEnquiryModal = (info, currentTab = tabValue) => {
    if (!info) return;
    if (info?.enquiryId || info?.id) markEnquiryAction(info);
    setSelectedLeadForEnquiry(info);
    setLeadEnquirySourceType(currentTab === 5 ? "campaign" : "chatbot");
    setLeadModalMode("create");
    setCreateEnquiryModalOpen(true);
  };

  const handleSaveLeadDetails = (updatedData) => {
    if (!updatedData?.id) return;
    const updateItem = (item) => {
      if (
        String(item.id) !== String(updatedData.id) &&
        String(item.enquiryId) !== String(updatedData.id) &&
        String(item?.raw?.id) !== String(updatedData.id)
      ) {
        return item;
      }
      return {
        ...item,
        name: updatedData.name,
        patient_name: updatedData.name,
        countryCode: updatedData.country_code || updatedData.dialCode || item.countryCode,
        phoneCode: updatedData.country_code || updatedData.dialCode || item.phoneCode,
        phone: updatedData.phone_number || updatedData.phone || item.phone,
        phoneNumber: updatedData.phone_number || updatedData.phone || item.phoneNumber,
        fullPhone:
          updatedData.full_phone ||
          updatedData.fullPhone ||
          `${String(updatedData.dialCode || "").replace("+", "")}${updatedData.phone}`,
        email: updatedData.email ?? item.email,
        age: updatedData.age ?? item.age,
        gender: updatedData.gender ?? item.gender,
        treatment: updatedData.treatment_ad_name || updatedData.treatment || item.treatment,
        treatment_ad_name: updatedData.treatment_ad_name || updatedData.treatment || item.treatment_ad_name,
        treatment_name: updatedData.treatment_ad_name || updatedData.treatment || item.treatment_name,
        disease_name: updatedData.treatment_ad_name || updatedData.treatment || item.disease_name,
        adName: updatedData.treatment_ad_name || updatedData.treatment || item.adName,
      };
    };

    if (leadEnquirySourceType === "campaign") {
      setSocialMediaData((prev) => prev.map(updateItem));
      getSocialMediaList(socialMediaPage);
    } else {
      setChatbotLeadsData((prev) => prev.map(updateItem));
      getChatbotLeadsList(chatbotLeadsPage);
    }
    setRows((prev) => prev.map(updateItem));
  };

  const handleCreateEnquiryFromLead = (info) => {
    handleOpenCreateEnquiryModal(info, tabValue);
  };

  const handleEnquiryCreatedSuccess = async (createdResult, leadInfo) => {
    const leadId = leadInfo?.id || leadInfo?.enquiryId;
    if (leadId) {
      markLeadAsConverted(leadId, leadEnquirySourceType);
      if (leadInfo?.enquiryId && leadInfo.enquiryId !== leadId) {
        markLeadAsConverted(leadInfo.enquiryId, leadEnquirySourceType);
      }
      

      if (leadEnquirySourceType === "campaign") {
        setSocialMediaData((prev) =>
          prev.filter(
            (item) =>
              String(item.id) !== String(leadId) &&
              String(item.enquiryId) !== String(leadId)
          )
        );
        getSocialMediaList(socialMediaPage);
      } else {
        setChatbotLeadsData((prev) =>
          prev.filter(
            (item) =>
              String(item.id) !== String(leadId) &&
              String(item.enquiryId) !== String(leadId)
          )
        );
        getChatbotLeadsList(chatbotLeadsPage);
      }

      setRows((prev) =>
        prev.filter(
          (item) =>
            String(item.id) !== String(leadId) &&
            String(item.enquiryId) !== String(leadId)
        )
      );
    }

    Swal.fire({
      icon: "success",
      title: "Enquiry Created",
      text: `Enquiry has been created successfully. The lead has been removed from ${
        leadEnquirySourceType === "campaign" ? "Campaign Contacts" : "Chatbot Leads"
      }.`,
      timer: 2200,
      showConfirmButton: false,
    });
  };

  const handleLeadStatusChange = async (event, leadInfo, currentTab, prefilledStatus) => {
    let statusName = "";
    let statusNotes = leadInfo?.statusNotes || "";

    if (currentTab === 5 || currentTab === 6) {
      if (!event) {
        const { value: formValues } = await Swal.fire({
          title: "Update Status & Notes",
          html: `
            <div style="text-align: left; font-size: 14px;">
              <label style="font-weight: 600; margin-bottom: 4px; display: block;">Select Status</label>
              <select id="swal_campaign_status" class="swal2-select" style="width: 100%; margin: 0 0 12px 0;">
                ${CAMPAIGN_ALLOWED_STATUSES.map(
                  (st) =>
                    `<option value="${st}" ${
                      st.toLowerCase() ===
                      (prefilledStatus || leadInfo.status || "").toLowerCase()
                        ? "selected"
                        : ""
                    }>${st}</option>`
                ).join("")}
              </select>
              <label style="font-weight: 600; margin-bottom: 4px; display: block;">Notes</label>
              <textarea id="swal_campaign_notes" class="swal2-textarea" style="width: 100%; margin: 0; min-height: 80px;" placeholder="Enter discussion notes or follow-up details...">${
                leadInfo.statusNotes || ""
              }</textarea>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: "Update Status",
          cancelButtonText: "Cancel",
          preConfirm: () => {
            const st = document.getElementById("swal_campaign_status").value;
            const nt = document.getElementById("swal_campaign_notes").value;
            return { status: st, notes: nt };
          },
        });
        if (!formValues) return;
        statusName = formValues.status;
        statusNotes = formValues.notes;
      } else {
        const value = event?.target?.value ?? event?.value;
        const matched = CAMPAIGN_ALLOWED_STATUSES.find(
          (s) => s.toLowerCase() === String(value || "").trim().toLowerCase()
        );
        statusName = matched || "Pending";

        const result = await Swal.fire({
          title: "Change Status?",
          text: `Update status of "${leadInfo.name || "this lead"}" to "${statusName}"?`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Yes, Update",
          cancelButtonText: "Cancel",
        });
        if (!result.isConfirmed) return;
      }
    } else {
      const value = event?.target?.value ?? event?.value;
      const numVal = parseInt(value, 10);
      statusName = statusMap[numVal] || "Pending";

      const result = await Swal.fire({
        title: "Change Status?",
        text: `Update status of "${leadInfo.name || "this lead"}" to "${statusName}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Update",
        cancelButtonText: "Cancel",
      });
      if (!result.isConfirmed) return;
    }

    try {
      const leadType = currentTab === 5 ? "campaign" : "chatbot";
      await updateLeadStatus(leadInfo, statusName, leadType, statusNotes);

      if (currentTab === 5) {
        setSocialMediaData((prev) =>
          prev.map((item) =>
            item.id === leadInfo.id ||
            (leadInfo.enquiryId && item.enquiryId === leadInfo.enquiryId)
              ? { ...item, status: statusName, statusNotes }
              : item
          )
        );
        getSocialMediaList(socialMediaPage);
      } else {
        setChatbotLeadsData((prev) =>
          prev.map((item) =>
            item.id === leadInfo.id ||
            (leadInfo.enquiryId && item.enquiryId === leadInfo.enquiryId)
              ? { ...item, status: statusName, statusNotes }
              : item
          )
        );
        getChatbotLeadsList(chatbotLeadsPage);
      }
      setRows((prev) =>
        prev.map((item) =>
          item.id === leadInfo.id ||
          (leadInfo.enquiryId && item.enquiryId === leadInfo.enquiryId)
            ? { ...item, status: statusName, statusNotes }
            : item
        )
      );

      Swal.fire({
        icon: "success",
        title: "Status Updated",
        text: `Status changed to ${statusName}`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Failed to update lead status:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || error?.message || "Failed to update status",
        "error"
      );
    }
  };

  const formatLeadDate = (dateValue) => {
    if (!dateValue) return "—";
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return String(dateValue);
    return `${d.toLocaleDateString("en-GB")} - ${d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })}`;
  };
  const handleChange = async (event, id, tabValue, data) => {
    if (isReferral) return;
    markEnquiryAction(data, id);
    const effectiveTab = tabValue === 7 ? (data?.tabSource ?? 0) : tabValue;
    const effectiveId = effectiveTab === 0 ? (data?.enquiryId || id) : (data?.id || id);
    console.log(event, effectiveId, effectiveTab, data);
    const { value } = event.target;
    const status = Number(value);
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you really want to update / convert?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes",
    });
    if (!result.isConfirmed) return;
    if (effectiveTab === 0) {
      // if (status === 1) {
      //   console.log(data);
      //   try {

      //     const payload = {
      //       full_name: data.raw.name,
      //       email: data.raw.email,
      //       phone_code: data.raw.phoneCode,
      //       phone: data.raw.emergency_contact,
      //       passport_number: data.raw.passport_num,
      //       user_type: 2,
      //       doctor_review: data.raw.doctorReview,
      //       age: data.raw.age,
      //       address: data.raw.address,
      //       town: data.raw.town,
      //       country: data.raw.country,
      //       passport_number: data.raw.passport_num,
      //     };
      //     if (
      //       data.raw.user_id === "" ||
      //       data.raw.user_id === null ||
      //       data.raw.user_id === undefined
      //     ) {
      //       console.log("11111111111111111");

      //       const response = await axios.post(
      //         "https://omcacrm.com/omca/api/user_registration",
      //         payload
      //       );
      //         if (response.data.success) {
      //           await dispatch(
      //             EnquiryStatus({
      //               id,
      //               status,
      //               enquiry_type: "OMCA Enquiry",
      //               user_id: response.data.data.id,
      //             }),
      //           ).unwrap();
      //         }
      //       }else{
      //       console.log("22222222222222");
      //         await dispatch(
      //           EnquiryStatus({
      //             id,
      //             status,
      //             enquiry_type: "OMCA Enquiry",
      //             user_id: data.raw.user_id,
      //           }),
      //         ).unwrap();
      //       }
      //       Swal.fire("Success!", "Converted to patient!", "success");
      //       dispatch(GetAllEnquiry());
      //   } catch (err) {
      //     Swal.fire("Error!", err?.message || "Error", "error");
      //   }
      // } else {
      //   await dispatch(
      //     EnquiryStatus({
      //       id,
      //       status,
      //       enquiry_type: "OMCA Enquiry",
      //     }),
      //   ).unwrap();
      //   Swal.fire("Success!", "Status Change Successfully!", "success");
      //   dispatch(GetAllEnquiry());
      // }

      if (status === 1) {
        console.log(data);
        let effectivePassport = String(
          data.raw?.passport_num || data.raw?.passport_number || ""
        ).trim();

        try {
          let userId = data.raw.user_id;

          const payload = {
            full_name: data.raw.name,
            email: data.raw.email,
            phone_code: data.raw.phoneCode,
            phone: data.raw.emergency_contact,
            passport_number: data.raw.passport_num,
            user_type: 2,
            doctor_review: data.raw.doctorReview,
            age: data.raw.age,
            address: data.raw.address,
            town: data.raw.town,
            country: data.raw.country,
          };

          // Create/Get user only if user_id is missing
          // if (!userId) {
          //   console.log("Creating user...");

          //   try {
          //     const response = await axios.post(
          //       "https://omcacrm.com/omca/api/user_registration",
          //       payload,
          //     );

          //     // Take ID whether success is true or false
          //     userId = response?.data?.data?.id;
          //   } catch (error) {
          //     // Do not show frontend error
          //     console.error(
          //       "User registration API error:",
          //       error?.response?.data || error.message,
          //     );

          //     // Try to get user id from error response if available
          //     userId = error?.response?.data?.data?.id;
          //   }
          // }

          const existingPatientId = data.raw?.patientId;
          const hasUserId = Boolean(userId && String(userId).trim() !== "");
          const isNewPatient = !hasUserId && !existingPatientId;

          effectivePassport = String(
            data.raw?.passport_num || data.raw?.passport_number || ""
          ).trim();

          if (isNewPatient && !effectivePassport) {
            const { value: enteredPassport, isDismissed } = await Swal.fire({
              title: "Passport / NIC Required",
              text: "Passport number is required to confirm enquiry and create patient.",
              input: "text",
              inputPlaceholder: "Enter Passport / NIC number (6–15 characters)",
              showCancelButton: true,
              confirmButtonText: "Submit & Confirm",
              cancelButtonText: "Cancel",
              confirmButtonColor: "#008080",
              cancelButtonColor: "#d33",
              inputValidator: (val) => {
                const trimmed = (val || "").trim();
                if (!trimmed) {
                  return "Passport number is required to confirm enquiry and create patient";
                }
                if (trimmed.length < 6 || trimmed.length > 15) {
                  return "Passport number must be between 6 and 15 characters";
                }
              },
            });

            if (isDismissed || !enteredPassport) {
              dispatch(GetAllEnquiry());
              return;
            }
            effectivePassport = enteredPassport.trim();
          }

          const res = await dispatch(
            EnquiryStatus({
              id,
              status,
              enquiry_type: "OMCA Enquiry",
              user_id: userId,
              patientId: existingPatientId || undefined,
              createNewPatient: isNewPatient,
              passport_num: effectivePassport || undefined,
            }),
          ).unwrap();

          if (res?.isDuplicatePhone) {
            const confirmDup = await Swal.fire({
              title: "Duplicate Phone Number Detected",
              text: res.message,
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes",
              cancelButtonText: "No",
              confirmButtonColor: "#3085d6",
              cancelButtonColor: "#d33",
            });

            if (confirmDup.isConfirmed) {
              const forcedRes = await dispatch(
                EnquiryStatus({
                  id,
                  status,
                  enquiry_type: "OMCA Enquiry",
                  user_id: userId,
                  forceCreate: true,
                  patientId: existingPatientId || undefined,
                  createNewPatient: isNewPatient,
                  passport_num: effectivePassport || undefined,
                }),
              ).unwrap();

              if (forcedRes?.success === false) {
                Swal.fire("Error!", forcedRes?.message || "Failed to convert to patient!", "error");
              } else {
                Swal.fire("Success!", forcedRes?.message || "Converted to patient!", "success");
              }
              dispatch(GetAllEnquiry());
            } else {
              Swal.fire({
                icon: "info",
                title: "New Phone Number Required",
                text: "Please edit the enquiry to use a different phone number before confirming as patient.",
              });
              dispatch(GetAllEnquiry());
            }
            return;
          }

          if (res?.success === false) {
            Swal.fire("Error!", res?.message || "Failed to convert to patient!", "error");
            dispatch(GetAllEnquiry());
            return;
          }

          Swal.fire("Success!", "Converted to patient!", "success");
          dispatch(GetAllEnquiry());
        } catch (err) {
          if (err?.isDuplicatePhone) {
            const existingPatientId = data.raw?.patientId;
            const hasUserId = Boolean(data.raw?.user_id && String(data.raw?.user_id).trim() !== "");
            const isNewPatient = !hasUserId && !existingPatientId;

            const confirmDup = await Swal.fire({
              title: "Duplicate Phone Number Detected",
              text: err.message,
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes",
              cancelButtonText: "No",
              confirmButtonColor: "#3085d6",
              cancelButtonColor: "#d33",
            });

            if (confirmDup.isConfirmed) {
              try {
                const forcedRes = await dispatch(
                  EnquiryStatus({
                    id,
                    status,
                    enquiry_type: "OMCA Enquiry",
                    user_id: data.raw?.user_id,
                    forceCreate: true,
                    patientId: existingPatientId || undefined,
                    createNewPatient: isNewPatient,
                    passport_num: effectivePassport || undefined,
                  }),
                ).unwrap();

                if (forcedRes?.success === false) {
                  Swal.fire("Error!", forcedRes?.message || "Failed to convert to patient!", "error");
                } else {
                  Swal.fire("Success!", forcedRes?.message || "Converted to patient!", "success");
                }
              } catch (forcedErr) {
                Swal.fire("Error!", forcedErr?.message || "Error", "error");
              }
              dispatch(GetAllEnquiry());
            } else {
              Swal.fire({
                icon: "info",
                title: "New Phone Number Required",
                text: "Please edit the enquiry to use a different phone number before confirming as patient.",
              });
              dispatch(GetAllEnquiry());
            }
            return;
          }

          Swal.fire(
            "Error!",
            err?.response?.data?.message || err?.message || "Failed to update status",
            "error",
          );
          dispatch(GetAllEnquiry());
        }
      } else {
        try {
          const res = await dispatch(
            EnquiryStatus({
              id,
              status,
              enquiry_type: "OMCA Enquiry",
              passport_num:
                data.raw?.passport_num || data.raw?.passport_number || undefined,
            }),
          ).unwrap();

          if (res?.success === false) {
            Swal.fire("Error!", res?.message || "Failed to update status", "error");
          } else {
            Swal.fire("Success!", "Status Change Successfully!", "success");
          }
          dispatch(GetAllEnquiry());
        } catch (err) {
          Swal.fire("Error!", err?.message || "Error", "error");
          dispatch(GetAllEnquiry());
        }
      }
    } else {
      if (status === 1) {
        try {
          if (effectiveTab === 1) {
            await sendToPatientAPI("Ambulance Service", data.raw);
          }
          if (effectiveTab === 2) {
            await sendToPatientAPI("Air Medical Escort", data.raw);
          }
          if (effectiveTab === 3) {
            await sendToPatientAPI("Treatment Estimate", data.raw);
          }
          await handleChangtype({ value }, data.raw);
          Swal.fire("Success!", "Converted to patient!", "success");
          dispatch(GetAllEnquiry());
          get3tabdata(datauserId, getcountries, roleStatuses);
        } catch (err) {
          Swal.fire("Error!", err?.message || "Error", "error");
        }
      } else {
        await handleChangtype({ value }, data.raw);

        Swal.fire("Success!", "Status changed!", "success");
        dispatch(GetAllEnquiry());
        get3tabdata(datauserId, getcountries, roleStatuses);
      }
    }
  };
  const handleSampleFile = async () => {
    try {
      const response = await axios.get(`${baseurl}export_enquiries`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Sample Enquiry.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Swal.fire({
        icon: "success",
        title: "Download Complete",
        text: "Sample_Enquiry.xlsx has been downloaded successfully!",
        timer: 3000,
        showConfirmButton: false,
      });
      return response.data;
    } catch (err) {
      console.error(
        "Error downloading the sample file:",
        err.response?.data?.message || err.message,
      );
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: err.response?.data?.message || "Something went wrong!",
      });
      throw err;
    }
  };
  const handleHospitalChange = (event, newValue) => {
    setReport((prev) => ({ ...prev, hospital: newValue }));
  };
  const handleImportFile = async (e) => {
    e.preventDefault();
    if (!selectedImage) {
      toast.error("Please select a file before uploading.");
      return;
    }
    await runSubmit("import", async () => {
      const formData = new FormData();
      formData.append("file", selectedImage);
      for (let pair of formData.entries()) {
        console.log(`${pair[0]}:`, pair[1]);
      }
      try {
        const result = await dispatch(ImportEnquirys(formData)).unwrap();
        setOpen3(false);
        dispatch(GetAllEnquiry());
        Swal.fire("Success!", `${result.message}`, "success");
      } catch (err) {
        console.log(err);
        setOpen3(false);
        Swal.fire("Error!", err?.error || "An error occurred", "error");
      }
    });
  };
  const applySearchFilter = useCallback((data, query, currentTab) => {
    const value = String(query || "").toLowerCase().trim();
    if (!value) return data;

    return (Array.isArray(data) ? data : []).filter((item) => {
      // Tab 0-3 and 7: Manage Enquiries, Ambulance, Air Medical, Treatment Estimate, Closed
      if (
        currentTab === 0 ||
        currentTab === 1 ||
        currentTab === 2 ||
        currentTab === 3 ||
        currentTab === 7
      ) {
        const name = String(item.name || "").toLowerCase();
        const treatment = String(
          item.treatment_name || item.disease_name || item.treatment || "",
        ).toLowerCase();
        const enquiryId = String(item.enquiryId || item.id || "").toLowerCase();
        const country = String(item.country || "").toLowerCase();
        const treatingIn = String(item.treatingIn || "").toLowerCase();
        const phone = String(
          item.emergency_contact || item.phone || item.mobileNumber || "",
        ).toLowerCase();
        const isEmailSearch = value.includes("@");
        const email = String(item.email || item.enq_email || "").toLowerCase();

        return (
          name.includes(value) ||
          treatment.includes(value) ||
          enquiryId.includes(value) ||
          country.includes(value) ||
          treatingIn.includes(value) ||
          phone.includes(value) ||
          (isEmailSearch && email.includes(value))
        );
      }

      // Tab 4: SOS Emergency Requests
      if (currentTab === 4) {
        const name = String(
          item.name || item.patientName || item.user_name || "",
        ).toLowerCase();
        const caseId = String(
          item.emergencyCaseId || item.sosId || item.id || "",
        ).toLowerCase();
        const contact = String(
          item.emergency_contact ||
            item.phone ||
            item.mobileNumber ||
            item.contact_no ||
            "",
        ).toLowerCase();
        const sosType = String(item.sosType || "").toLowerCase();
        const status = String(item.status || "").toLowerCase();
        const emergencyContacts = formatEmergencyContacts(
          item.emergency_contacts,
        ).toLowerCase();

        return (
          name.includes(value) ||
          caseId.includes(value) ||
          contact.includes(value) ||
          sosType.includes(value) ||
          status.includes(value) ||
          emergencyContacts.includes(value)
        );
      }

      // Tab 5: Campaign Contacts, Tab 6: Chatbot Leads
      if (currentTab === 5 || currentTab === 6) {
        const name = String(item.name || "").toLowerCase();
        const phone = String(
          item.phone || item.mobileNumber || item.phoneNumber || item.fullPhone || item.full_phone || "",
        ).toLowerCase();
        const country = String(item.country || item.country_name || "").toLowerCase();
        const treatingIn = String(item.treatingIn || item.treating_in || "").toLowerCase();
        const source = String(
          item.source || item.channelType || item.leadSource || item.lead_source || "",
        ).toLowerCase();
        const status = String(item.status || "").toLowerCase();
        const adName = String(
          item.adName || item.treatment || item.campaign || item.treatment_ad_name || item.treatmentAdName || "",
        ).toLowerCase();
        const isEmailSearch = value.includes("@");
        const email = String(item.email || "").toLowerCase();
        const ctwaClid = String(
          item.ctwaClid || item.ctwa_clid || item.traits?.ctwa_clid || ""
        ).toLowerCase();
        const sourceId = String(
          item.sourceId || item.source_id || item.traits?.source_id || ""
        ).toLowerCase();
        const interaktId = String(
          item.interaktId || item.interakt_id || item.raw_data?.id || ""
        ).toLowerCase();
        const id = String(item.id || item.enquiryId || "").toLowerCase();
        const notes = String(
          item.statusNotes || item.status_notes || item.notes || ""
        ).toLowerCase();
        const tags = Array.isArray(item.tags)
          ? item.tags.join(" ").toLowerCase()
          : String(item.tags || "").toLowerCase();

        return (
          name.includes(value) ||
          phone.includes(value) ||
          adName.includes(value) ||
          country.includes(value) ||
          treatingIn.includes(value) ||
          source.includes(value) ||
          status.includes(value) ||
          email.includes(value) ||
          ctwaClid.includes(value) ||
          sourceId.includes(value) ||
          interaktId.includes(value) ||
          id.includes(value) ||
          notes.includes(value) ||
          tags.includes(value)
        );
      }

      const name = String(item.name || "").toLowerCase();
      const id = String(item.enquiryId || item.id || "").toLowerCase();
      return name.includes(value) || id.includes(value);
    });
  }, []);

  const handleFilter = (event) => {
    const value = event.target.value;
    setFilterValue(value);
    filterValueRef.current = value;
    sessionStorage.setItem(ENQUIRY_SEARCH_STORAGE_KEY, value);
    setPage(0);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");

    if (tabValue === 5) {
      setSocialMediaPage(1);
      if (campaignSearchDebounceTimerRef.current) {
        clearTimeout(campaignSearchDebounceTimerRef.current);
      }
      campaignSearchDebounceTimerRef.current = setTimeout(() => {
        getSocialMediaList(1, { search: value });
      }, 400);
    } else if (tabValue === 6) {
      setChatbotLeadsPage(1);
      if (chatbotSearchDebounceTimerRef.current) {
        clearTimeout(chatbotSearchDebounceTimerRef.current);
      }
      chatbotSearchDebounceTimerRef.current = setTimeout(() => {
        getChatbotLeadsList(1, { search: value });
      }, 400);
    } else {
      setRows(applySearchFilter(searchApiData, value, tabValue));
    }
  };
  const handleClearFilter = () => {
    setFilterValue("");
    filterValueRef.current = "";
    sessionStorage.removeItem(ENQUIRY_SEARCH_STORAGE_KEY);
    setPage(0);
    sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");

    if (campaignSearchDebounceTimerRef.current) {
      clearTimeout(campaignSearchDebounceTimerRef.current);
    }
    if (chatbotSearchDebounceTimerRef.current) {
      clearTimeout(chatbotSearchDebounceTimerRef.current);
    }
    if (tabValue === 5) {
      setSocialMediaPage(1);
      getSocialMediaList(1, { search: "" });
    } else if (tabValue === 6) {
      setChatbotLeadsPage(1);
      getChatbotLeadsList(1, { search: "" });
    } else {
      setRows(searchApiData);
    }
  };
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
    if (page > maxPage && rows.length > 0) {
      setPage(0);
      sessionStorage.setItem(ENQUIRY_PAGE_STORAGE_KEY, "0");
    }
  }, [rows, page, rowsPerPage]);
  const [age, setAge] = React.useState("");
  const handleChange3 = (event) => {
    setAge(event.target.value);
  };
  const handleNotesdata = async (e) => {
    e.preventDefault();
    setBlogErr({
      note: false,
      date: false,
    });
    if (!note) {
      setBlogErr((prevState) => ({ ...prevState, note: true }));
    }
    if (!date) {
      setBlogErr((prevState) => ({ ...prevState, date: true }));
    }
    if (!note || !date) {
      return;
    }
    await runSubmit("notes", async () => {
      try {
        let response;
        if (tabValue === 1 || tabValue === 2 || tabValue === 3) {
          const noteModelTypeMap = {
            1: "AmbulanceRequest",
            2: "AirAmbulance",
            3: "PatientQuery",
          };
          response = await axios.post(`${AdminBaseUrl}enquiry_note/store`, {
            enquiry_id: enqId,
            model_type: noteModelTypeMap[tabValue],
            notes: note,
            date: date,
          });
        } else {
          response = await axios.post(`${baseurl}add_notes/${enqId}`, {
            note: note,
            date: date,
          });
        }
        console.log(response);
        setBlogErr(false);
        if (response.status === 200 || response?.data?.success) {
          setOpen2(false);
          Swal.fire("Success", "Notes added successfully!", "success");
        }
        setNote("");
        setDate("");
      } catch (error) {
        setOpen2(false);
        console.log(error);
        Swal.fire("Error", `${error?.response?.data?.message}`, "error");
      }
    });
  };

  const handledelete = (e, patientId) => {
    markEnquiryAction(typeof e === "object" ? e : null, typeof e === "object" ? undefined : e);
    console.log(e);
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
      .then((result) => {
        if (result.isConfirmed) {
          dispatch(DeleteEnquiry({ id: e }))
            .unwrap()
            .then(() => {
              return dispatch(GetAllEnquiry());
            })
            .then((newData) => {
              Swal.fire("Deleted!", " enquiry has been deleted.", "success");
              const normalized = normalizeData(
                newData.payload || [],
                "enquiry",
              );
              setRows(normalized);
              setSearchApiData(normalized);
            })
            .catch((err) => {
              Swal.fire("Error!", err?.message || "An error occurred", "error");
            });
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          swalWithBootstrapButtons.fire({
            title: "Cancelled",
            icon: "error",
          });
        }
      });
  };
  const donloadpdf = async () => {
    const maxRows = rows.length || 1;
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
          setPdfRowLimit(null); // reset to normal view
        }, 300);
      }
    });
  };
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && orderDirection === "asc";
    const direction = isAsc ? "desc" : "asc";
    setOrderDirection(direction);
    setOrderBy(property);
    const sortedData = [...rows].sort((a, b) => {
      let valA = a[property];
      let valB = b[property];
      // ✅ Handle null/undefined
      if (!valA) valA = "";
      if (!valB) valB = "";
      // ✅ Special handling for DATE
      if (property === "date") {
        if (tabValue === 5) {
          valA =
            a.interakt_created_at ||
            a.interaktCreatedAt ||
            a.raw?.interakt_created_at ||
            a.raw?.raw_data?.created_at_utc ||
            a.date;
          valB =
            b.interakt_created_at ||
            b.interaktCreatedAt ||
            b.raw?.interakt_created_at ||
            b.raw?.raw_data?.created_at_utc ||
            b.date;
        }
        return direction === "asc"
          ? new Date(valA) - new Date(valB)
          : new Date(valB) - new Date(valA);
      }
      if (property === "enquiryId" || property === "age") {
        return direction === "asc"
          ? Number(valA) - Number(valB)
          : Number(valB) - Number(valA);
      }
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });
    setRows(sortedData);
  };
  useEffect(() => {
    let filtered = [];
    if (tabValue === 0 && Enquiry?.length) {
      filtered = normalizeData(Enquiry, "enquiry").filter(
        (item) => !isClosedStatus(item.Enquiry_status),
      );
    }
    if (tabValue === 1 && ambulanceData?.length) {
      filtered = normalizeData(ambulanceData, "ambulance").filter(
        (item) => !isClosedStatus(item.Enquiry_status),
      );
    }
    if (tabValue === 2 && airAmbulanceData?.length) {
      filtered = normalizeData(airAmbulanceData, "air").filter(
        (item) => !isClosedStatus(item.Enquiry_status),
      );
    }
    if (tabValue === 3 && treatmentData?.length) {
      filtered = normalizeData(treatmentData, "treatment").filter(
        (item) => !isClosedStatus(item.Enquiry_status),
      );
    }
    if (tabValue === 4 && sosData?.length) {
      filtered = normalizeSosData(sosData);
    }
    if (tabValue === 5) {
      filtered = socialMediaData || [];
    }
    if (tabValue === 6) {
      filtered = chatbotLeadsData || [];
    }
    if (tabValue === 7) {
      const closedEnq = Enquiry?.length
        ? normalizeData(Enquiry, "enquiry")
            .filter((item) => isClosedStatus(item.Enquiry_status))
            .map((item) => ({ ...item, tabSource: 0, serviceCategory: "OMCA Enquiry" }))
        : [];
      const closedAmb = ambulanceData?.length
        ? normalizeData(ambulanceData, "ambulance")
            .filter((item) => isClosedStatus(item.Enquiry_status))
            .map((item) => ({ ...item, tabSource: 1, serviceCategory: "Ambulance" }))
        : [];
      const closedAir = airAmbulanceData?.length
        ? normalizeData(airAmbulanceData, "air")
            .filter((item) => isClosedStatus(item.Enquiry_status))
            .map((item) => ({ ...item, tabSource: 2, serviceCategory: "Air Medical" }))
        : [];
      const closedTreat = treatmentData?.length
        ? normalizeData(treatmentData, "treatment")
            .filter((item) => isClosedStatus(item.Enquiry_status))
            .map((item) => ({ ...item, tabSource: 3, serviceCategory: "Treatment Estimate" }))
        : [];
      let closedList = [...closedEnq, ...closedAmb, ...closedAir, ...closedTreat];
      if (enquiryFilter.country) {
        closedList = closedList.filter(
          (item) =>
            (item.country || "").toLowerCase() ===
            enquiryFilter.country.toLowerCase(),
        );
      }
      filtered = closedList;
    }

    const dateFiltered = applyDateRangeFilter(filtered, startDate, endDate);
    setSearchApiData(dateFiltered);
    if (tabValue === 5 || tabValue === 6) {
      // Tab 5 & 6 search and filtering are handled via API call.
      // Do not discard backend matches with secondary client-side filtering.
      setRows(dateFiltered);
    } else if (filterValue && filterValue.trim()) {
      setRows(applySearchFilter(dateFiltered, filterValue, tabValue));
    } else {
      setRows(dateFiltered);
    }
  }, [
    tabValue,
    Enquiry,
    ambulanceData,
    airAmbulanceData,
    treatmentData,
    sosData,
    socialMediaData,
    chatbotLeadsData,
    filterValue,
    startDate,
    endDate,
    enquiryFilter.country,
    applySearchFilter,
  ]);
  const handleSubmitAppointment = async () => {
    const { appointment_Date, appointment_Time, Notes } = appointmentData;
    if (!appointment_Date) {
      return Swal.fire("Error", "Please select appointment date", "error");
    }
    if (!appointment_Time) {
      return Swal.fire("Error", "Please select appointment time", "error");
    }
    if (!Notes || !Notes.trim()) {
      return Swal.fire("Error", "Please enter notes", "error");
    }

    await runSubmit("appointment", async () => {
      try {
        const formData = new FormData();
        formData.append("enquiryId", appointmentData.enquiry_id || "");
        if (appointmentData.patientId) {
          formData.append("patientId", appointmentData.patientId);
        }
        formData.append("enq_userName", appointmentData.enq_userName || "");
        formData.append("enq_phoneNumber", appointmentData?.enq_phoneNumber || "");
        formData.append("user_id", appointmentData?.user_id || "");
        formData.append("enq_email", appointmentData.enq_email || "");
        if (appointmentData.hospital_id) formData.append("hospital_id", appointmentData.hospital_id);
        if (appointmentData.hospitalName) formData.append("hospitalName", appointmentData.hospitalName);
        if (appointmentData.hospital_email) formData.append("hospital_email", appointmentData.hospital_email);
        if (appointmentData.treatment_id) formData.append("treatment_id", appointmentData.treatment_id);
        if (appointmentData.treatment_name) formData.append("treatment_name", appointmentData.treatment_name);
        if (appointmentData.Notes?.trim()) {
          formData.append("Notes", appointmentData.Notes.trim());
          formData.append("discussionNotes", appointmentData.Notes.trim());
        }
        formData.append(
          "appointment_Date",
          String(appointmentData.appointment_Date).split("T")[0]
        );
        formData.append(
          "appointment_Time",
          formatTime12Hour(appointmentData.appointment_Time),
        );
        formData.append("mode", appointmentData.mode || "offline");

        if (appointmentData.mode !== "online" && appointmentData.needTransport) {
          if (appointmentData.pickup_time) formData.append("pickup_time", appointmentData.pickup_time);
          if (appointmentData.pickup_location) formData.append("pickup_location", appointmentData.pickup_location);
          if (appointmentData.pickup_location_type)
            formData.append("pickup_location_type", appointmentData.pickup_location_type);
          if (appointmentData.drop_location) formData.append("drop_location", appointmentData.drop_location);
          if (appointmentData.drop_location_type)
            formData.append("drop_location_type", appointmentData.drop_location_type);
          if (appointmentData.drop_time) formData.append("drop_time", appointmentData.drop_time);
          if (appointmentData.pickup_manager_name)
            formData.append("pickup_manager_name", appointmentData.pickup_manager_name);
          if (appointmentData.pickup_manager_phone)
            formData.append("pickup_manager_phone", appointmentData.pickup_manager_phone);
          if (appointmentData.driver_name) formData.append("driver_name", appointmentData.driver_name);
          if (appointmentData.driver_contact) formData.append("driver_contact", appointmentData.driver_contact);
          if (appointmentData.vehicle_no) formData.append("vehicle_no", appointmentData.vehicle_no);
          if (appointmentData.pickDropStatus) formData.append("pickDropStatus", appointmentData.pickDropStatus);
        }

        images.forEach((file) => {
          formData.append("reports", file);
        });

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.post(
          `${baseurl.replace(/\/+$/, "")}/create_enquiry_appointment/${usrFount}`,
          formData,
          { headers },
        );
        if (res.data?.success || res.status === 200 || res.status === 201) {
          Swal.fire("Success", res.data?.message || "Appointment Created Successfully", "success");
          handleCloseAppointment();
        } else {
          Swal.fire("Error", res.data?.message || "Failed to create appointment", "error");
        }
      } catch (err) {
        console.log(err);
        Swal.fire(
          "Error",
          err.response?.data?.message || "Something went wrong",
          "error",
        );
      }
    });
  };
  const usrFount = localStorage.getItem("_id");
  const handleAppointmentChange = (e) => {
    const { name, value } = e.target;
    setAppointmentData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleOpenAppointment = (info) => {
    markEnquiryAction(info);
    console.log(info);
    if (!Treatment || Treatment.length === 0) {
      dispatch(GetAllTreatment());
    }
    setImages([]);
    setAppointmentData({
      hospital_id: "",
      hospitalName: "",
      hospital_email: "",
      treatment_id: "",
      treatment_name: "",
      health_issue: info.disease_name || "",
      Notes: "",
      appointment_Date: "",
      appointment_Time: "",
      mode: "offline",
      needTransport: false,
      pickup_time: "",
      pickup_location: "",
      pickup_location_type: "",
      drop_location: "",
      drop_location_type: "",
      drop_time: "",
      pickup_manager_name: "Ravi Kumar",
      pickup_manager_phone: "9217993173, 7453 034 087",
      driver_name: "Ravi Kumar",
      driver_contact: "9217993173, 7453 034 087",
      vehicle_no: "",
      pickDropStatus: "New",
      enq_userName: info.name || "",
      enq_phoneNumber: info.raw?.phone || info.raw?.emergency_contact || "",
      user_id: info.raw?.user_id || "",
      patientId: info.raw?.patientId || "",
      enq_email: info.email || "",
      enquiry_id: info.enquiryId || "",
    });
    setOpenAppointment(true);
  };
  const handleCloseAppointment = () => {
    setOpenAppointment(false);
    setImages([]);
    setAppointmentData({
      patient_name: "",
      doctor_name: "",
      date: "",
      time: "",
      notes: "",
      user_id: "",
      enq_userName: "",
      enq_phoneNumber: "",
      enq_email: "",
    });
  };
  const normalizeData = (data, type) => {
    return data.map((item) => ({
      enquiryId: item.enquiryId || item.id || 0,
      name: item.name || item.first_name || "",
      email: item.email || "",
      country: item.country || "",
      createdBy: item.createdBy || "",
      treatingIn: Array.isArray(item.treatingIn)
        ? item.treatingIn.join(", ")
        : item.treatingIn || item.treating_in_country || "",
      emergency_contact: item.emergency_contact || item.phone || "",
      disease_name:
        item.disease_name ||
        item.treatment_name ||
        item.treatment ||
        item.services?.replaceAll("_", " ") ||
        "",
      treatment_name:
        item.treatment_name ||
        item.disease_name ||
        item.treatment ||
        item.services?.replaceAll("_", " ") ||
        "",
      Enquiry_status: item.Enquiry_status || item.status || "",
      date: item.createdAt || item.created_at || "",
      id: item.id,
      raw: item,
      enq_userName: item.name,
      hasAppointment: item.hasAppointment,
      hasDoctorReview: item.hasDoctorReview,
      isUnread: item.isUnread === true,
      enq_email: item.email,
      assignedCoordinator: item.assignedCoordinator || item.raw?.assignedCoordinator || null,
      assignedStaff: item.assignedStaff || item.raw?.assignedStaff || [],
    }));
  };
  const setHospitalFunction = async () => {
    try {
      const response = await axios.post(`${AdminBaseUrl}hospital_list`);
      if (response.data.success) {
        console.log(response.data.data);
        setHospitalList(response.data.data);
      }
    } catch (error) { }
  };
  const getUserId = async () => {
    try {
      const response = await axios.get(`${baseurl}get_patient_user_ids`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.data.success) {
        console.log(response.data);
        console.log("a");
        get3tabdata(
          response.data.user_ids,
          response.data.accessCountries,
          response.data.roleStatuses,
        );
        console.log("b");
        setGetcountries(response.data.accessCountries);
        setRoleStatuses(response.data.roleStatuses);
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3">
            <div className="col-md-12">
              <div className="topmainhd">
                <h6>
                  {tabValue === 0
                    ? "Manage Enquiries"
                    : tabValue === 1
                      ? "Manage Ambulance Service"
                      : tabValue === 2
                        ? "Manage Air Medical escort"
                        : tabValue === 3
                          ? "Manage Treatment Estimate"
                          : tabValue === 4
                            ? "SOS Emergency Requests"
                            : tabValue === 5
                              ? "Campaign Contacts"
                              : tabValue === 6
                                ? "Chatbot Leads"
                                : tabValue === 7
                                  ? "Closed Enquiries"
                                  : ""}
                </h6>
              </div>
            </div>
            <div className="col-md-12">
              <div
                className="enquiry-tabs-wrap"
                style={{
                  width: "100%",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                {filteredTabs.map((tab) => {
                  const isSelected = tabValue === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={(e) => handleTabChange(e, tab.value)}
                      className={`tab-btn enquiry-tab-pill ${isSelected ? "active" : ""}`}
                      style={{
                        textTransform: "none",
                        fontSize: "12px",
                        fontWeight: 500,
                        fontFamily: "Rubik",
                        padding: "8px 16px",
                        lineHeight: "22px",
                        border: isSelected ? "1px solid #22c7b8" : "1px solid #ccc",
                        borderRadius: "5px",
                        color: isSelected ? "#fff" : "#666",
                        background: isSelected ? "#22c7b8" : "#fff",
                        transition: "all 0.2s ease-in-out",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                        outline: "none",
                      }}
                    >
                      <span>{tab.label}</span>
                      {tab.unread > 0 && (
                        <span className="sidebar-badge" style={{ marginLeft: "4px" }}>
                          {tab.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="country-top enquiry-country-top">
                <div className="search-btn-main">
                  <div className="">
                    <TextField
                      className="field-count"
                      label="Search"
                      id="outlined-required"
                      size="small"
                      value={filterValue}
                      onChange={handleFilter} // Pass event directly
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (tabValue === 5) {
                            if (campaignSearchDebounceTimerRef.current) {
                              clearTimeout(campaignSearchDebounceTimerRef.current);
                            }
                            setSocialMediaPage(1);
                            getSocialMediaList(1, { search: filterValue });
                          } else if (tabValue === 6) {
                            if (chatbotSearchDebounceTimerRef.current) {
                              clearTimeout(chatbotSearchDebounceTimerRef.current);
                            }
                            setChatbotLeadsPage(1);
                            getChatbotLeadsList(1, { search: filterValue });
                          }
                        }
                      }}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            {filterValue && (
                              <IconButton
                                onClick={handleClearFilter}
                                edge="end"
                                className="input-set"
                              >
                                <ClearIcon />
                              </IconButton>
                            )}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </div>
                  {tabValue === 0 ? (
                    <>
                      <Link to="/Admin/add-Enquiry" className="add-button">
                        <i className="fa fa-plus me-2"></i>New Enquiry
                      </Link>
                      <button
                        onClick={(e) => handleClickOpen3(e)}
                        className="add-button"
                      >
                        <i className="fa fa-file-excel-o me-2"></i>Import
                      </button>
                      {allowExport && (
                        <button onClick={handleSampleFile} className="add-button">
                          <i className="fa fa-file me-2"></i>Export
                        </button>
                      )}
                      {role === "Admin" ? (
                        <button onClick={donloadpdf} className="add-button">
                          <i className="fa fa-file-pdf-o me-2"></i>Pdf
                        </button>
                      ) : (
                        ""
                      )}
                    </>
                  ) : tabValue === 1 ? (
                    <Link
                      to="/Admin/add-ambulance"
                      className="add-button"
                      onClick={() => localStorage.setItem("tabenquiry", "1")}
                    >
                      <i className="fa fa-plus me-2"></i>Create
                    </Link>
                  ) : tabValue === 2 ? (
                    <Link
                      to="/Admin/add-air-ambulance"
                      className="add-button"
                      onClick={() => localStorage.setItem("tabenquiry", "2")}
                    >
                      <i className="fa fa-plus me-2"></i>Create
                    </Link>
                  ) : tabValue === 3 ? (
                    <Link
                      to="/Admin/add-treatment-estimate"
                      className="add-button"
                      onClick={() => localStorage.setItem("tabenquiry", "3")}
                    >
                      <i className="fa fa-plus me-2"></i>Create
                    </Link>
                  ) : tabValue === 5 ? (
                    <button
                      type="button"
                      className="add-button"
                      onClick={handleSyncCampaignContacts}
                      disabled={campaignSyncing}
                      style={{
                        cursor: campaignSyncing ? "not-allowed" : "pointer",
                        opacity: campaignSyncing ? 0.75 : 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      title="Sync campaign contacts from server"
                    >
                      {campaignSyncing ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                            aria-hidden="true"
                            style={{ width: "13px", height: "13px", borderWidth: "2px" }}
                          ></span>
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa fa-refresh"></i>
                          <span>Sync Contacts</span>
                        </>
                      )}
                    </button>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
            {tabValue === 0 && (
              <div className="col-md-12">
                <div className="main_content mb-3">
                  <div className="row gx-3 align-items-end">
                    <div className="col-md-2">
                      <div className="field-set">
                        <label>Country</label>
                        <FormControl fullWidth size="small">
                          <Select
                            name="country"
                            value={enquiryFilter.country}
                            onChange={handleEnquiryFilterChange}
                            displayEmpty
                            input={<OutlinedInput placeholder="Select Country" />}
                            sx={{ height: 40 }}
                            className="select-country form-control"
                            MenuProps={{
                              PaperProps: { style: { maxHeight: 200 } },
                            }}
                            renderValue={(selected) =>
                              selected || <span>Select Country</span>
                            }
                          >
                            <MenuItem value="" className="custmselect">
                              Select Country
                            </MenuItem>
                            {Countries && Countries.length > 0 ? (
                              Countries.map((con, idx) => (
                                <MenuItem
                                  className="custmselect"
                                  key={idx}
                                  value={con.name}
                                >
                                  {con.name}
                                </MenuItem>
                              ))
                            ) : (
                              <MenuItem disabled>No countries available</MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="field-set">
                        <label>Treating In Country</label>
                        <FormControl fullWidth size="small">
                          <Select
                            name="treatingIn"
                            value={enquiryFilter.treatingIn}
                            onChange={handleEnquiryFilterChange}
                            displayEmpty
                            input={<OutlinedInput placeholder="Select Country" />}
                            sx={{ height: 40 }}
                            className="select-country form-control"
                            MenuProps={{
                              PaperProps: { style: { maxHeight: 200 } },
                            }}
                            renderValue={(selected) =>
                              selected || <span>Select Country</span>
                            }
                          >
                            <MenuItem value="" className="custmselect">
                              Select Country
                            </MenuItem>
                            {Countries && Countries.length > 0 ? (
                              Countries.map((con, idx) => (
                                <MenuItem
                                  className="custmselect"
                                  key={idx}
                                  value={con.name}
                                >
                                  {con.name}
                                </MenuItem>
                              ))
                            ) : (
                              <MenuItem disabled>No countries available</MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="field-set">
                        <label>Status</label>
                        <FormControl fullWidth size="small">
                          <Select
                            name="status"
                            value={enquiryFilter.status}
                            onChange={handleEnquiryFilterChange}
                            displayEmpty
                            input={<OutlinedInput placeholder="Select Status" />}
                            sx={{ height: 40 }}
                            className="select-country form-control"
                            MenuProps={{
                              PaperProps: { style: { maxHeight: 200 } },
                            }}
                            renderValue={(selected) => {
                              if (!selected) return <span>Select Status</span>;
                              if (selected === "1 Visit") return "Visit 1";
                              if (selected === "2 Visit") return "Visit 2";
                              return selected;
                            }}
                          >
                            <MenuItem value="" className="custmselect">
                              Select Status
                            </MenuItem>
                            <MenuItem value="Pending" className="custmselect">
                              Pending
                            </MenuItem>
                            <MenuItem value="Hold" className="custmselect">
                              Hold
                            </MenuItem>
                            <MenuItem value="Follow-Up" className="custmselect">
                              Follow-Up
                            </MenuItem>
                            <MenuItem value="1 Visit" className="custmselect">
                              Visit 1
                            </MenuItem>
                            <MenuItem value="2 Visit" className="custmselect">
                              Visit 2
                            </MenuItem>
                            <MenuItem value="Visa" className="custmselect">
                              Visa
                            </MenuItem>
                            <MenuItem value="Connected" className="custmselect">
                              Connected
                            </MenuItem>
                            <MenuItem value="Not Connected" className="custmselect">
                              Not Connected
                            </MenuItem>
                            <MenuItem value="Close" className="custmselect">
                              Close
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="field-set">
                        <label>From Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={startDate}
                          onChange={handleStartDateChange}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="field-set">
                        <label>To Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={endDate}
                          onChange={handleEndDateChange}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-md-2 mb-4">
                      <div className="d-flex gap-2 align-items-center">
                        <button
                          type="button"
                          className="add-button"
                          onClick={handleEnquiryFilterSubmit}
                        >
                          Filter
                        </button>
                        {(enquiryFilter.country ||
                          enquiryFilter.treatingIn ||
                          enquiryFilter.status ||
                          startDate ||
                          endDate) && (
                          <button
                            type="button"
                            className="add-button"
                            onClick={handleEnquiryFilterClear}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tabValue === 7 && (
              <div className="col-md-12">
                <div className="main_content mb-3">
                  <div className="row gx-3 align-items-end">
                    <div className="col-md-3">
                      <div className="field-set">
                        <label>Country</label>
                        <FormControl fullWidth size="small">
                          <Select
                            name="country"
                            value={enquiryFilter.country}
                            onChange={handleEnquiryFilterChange}
                            displayEmpty
                            input={<OutlinedInput placeholder="Select Country" />}
                            sx={{ height: 40 }}
                            className="select-country form-control"
                            MenuProps={{
                              PaperProps: { style: { maxHeight: 200 } },
                            }}
                            renderValue={(selected) =>
                              selected || <span>Select Country</span>
                            }
                          >
                            <MenuItem value="" className="custmselect">
                              Select Country
                            </MenuItem>
                            {Countries && Countries.length > 0 ? (
                              Countries.map((con, idx) => (
                                <MenuItem
                                  className="custmselect"
                                  key={idx}
                                  value={con.name}
                                >
                                  {con.name}
                                </MenuItem>
                              ))
                            ) : (
                              <MenuItem disabled>No countries available</MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="field-set">
                        <label>From Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={startDate}
                          onChange={handleStartDateChange}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="field-set">
                        <label>To Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={endDate}
                          onChange={handleEndDateChange}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-md-3 mb-4">
                      <div className="d-flex gap-2 align-items-center">
                        {(enquiryFilter.country || startDate || endDate) && (
                          <button
                            type="button"
                            className="add-button"
                            onClick={() => {
                              setEnquiryFilter((prev) => ({ ...prev, country: "" }));
                              handleClearDateRange();
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tabValue !== 0 && tabValue !== 5 && tabValue !== 6 && tabValue !== 7 && (
              <div className="col-md-12">
                <div className="main_content mb-3">
                  <div className="row gx-3 align-items-end">
                    <div className="col-6 col-md-3">
                      <div className="field-set">
                        <label>From Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={startDate}
                          onChange={handleStartDateChange}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="field-set">
                        <label>To Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={endDate}
                          onChange={handleEndDateChange}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-12 col-md-3 mb-2">
                      <div className="d-flex gap-2 align-items-center">
                        {(startDate || endDate) && (
                          <button
                            type="button"
                            className="add-button"
                            onClick={handleClearDateRange}
                          >
                            Clear Date
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tabValue === 6 && (
              <div className="col-md-12">
                <div className="main_content mb-3">
                  <div className="row gx-3 align-items-end">
                    <div className="col-12 col-sm-6 col-md-3">
                      <div className="field-set">
                        <label>Status</label>
                        <FormControl fullWidth size="small">
                          <Select
                            value={chatbotStatusFilter}
                            onChange={(e) => {
                              const val = e.target.value;
                              setChatbotStatusFilter(val);
                              setChatbotLeadsPage(1);
                              getChatbotLeadsList(1, { status: val });
                            }}
                            displayEmpty
                            className="form-control"
                            sx={{ height: 40, bgcolor: "#fff" }}
                          >
                            <MenuItem value="all">All Statuses</MenuItem>
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Follow-up">Follow-up</MenuItem>
                            <MenuItem value="Close">Close</MenuItem>
                            <MenuItem value="Connected">Connected</MenuItem>
                            <MenuItem value="Not Connected">Not Connected</MenuItem>
                            <MenuItem value="Donation">Donation</MenuItem>
                            <MenuItem value="1">Confirm</MenuItem>
                            <MenuItem value="2">Hold</MenuItem>
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                    <div className="col-6 col-sm-6 col-md-3">
                      <div className="field-set">
                        <label>From Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={startDate}
                          onChange={(e) => {
                            handleStartDateChange(e);
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-6 col-sm-6 col-md-3">
                      <div className="field-set">
                        <label>To Date</label>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={endDate}
                          onChange={(e) => {
                            handleEndDateChange(e);
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ height: 40, bgcolor: "#fff" }}
                        />
                      </div>
                    </div>
                    <div className="col-12 col-md-3 mb-2">
                      <div className="d-flex gap-2 align-items-center">
                        <button
                          type="button"
                          className="add-button"
                          onClick={() => {
                            setChatbotLeadsPage(1);
                            getChatbotLeadsList(1, {
                              startDate,
                              endDate,
                              status: chatbotStatusFilter,
                              search: filterValue,
                            });
                          }}
                        >
                          Filter
                        </button>
                        {(startDate ||
                          endDate ||
                          (chatbotStatusFilter && chatbotStatusFilter !== "all") ||
                          filterValue) && (
                          <button
                            type="button"
                            className="add-button"
                            onClick={() => {
                              setStartDate("");
                              setEndDate("");
                              setChatbotStatusFilter("all");
                              setFilterValue("");
                              filterValueRef.current = "";
                              sessionStorage.removeItem(ENQUIRY_SEARCH_STORAGE_KEY);
                              sessionStorage.removeItem(ENQUIRY_START_DATE_STORAGE_KEY);
                              sessionStorage.removeItem(ENQUIRY_END_DATE_STORAGE_KEY);
                              setChatbotLeadsPage(1);
                              getChatbotLeadsList(1, {
                                startDate: "",
                                endDate: "",
                                status: "all",
                                search: "",
                              });
                            }}
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          className="add-button"
                          title="Refresh Chatbot Leads"
                          disabled={chatbotLeadsLoading}
                          onClick={() => {
                            getChatbotLeadsList(chatbotLeadsPage);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <i className={`fa fa-refresh ${chatbotLeadsLoading ? "fa-spin" : ""}`}></i>
                          <span>Refresh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tabValue === 5 && (
              <div className="col-md-12 mb-3">
                {/* Syncing Progress Banner Loader */}
                {campaignSyncing && (
                  <div
                    className="alert alert-info d-flex align-items-center mb-3 shadow-sm"
                    style={{
                      borderRadius: "8px",
                      fontSize: "13px",
                      padding: "10px 16px",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                    }}
                  >
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    <strong>Syncing in progress...</strong>
                    <span className="ms-2">
                      Fetching and synchronizing latest contacts from campaign server. Please wait...
                    </span>
                  </div>
                )}

                {/* Status Summary Quick Pills */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  {[
                    { label: "All", value: "all", count: campaignStatusCounts?.all },
                    {
                      label: "Pending",
                      value: "Pending",
                      count: campaignStatusCounts?.["Pending"],
                    },
                    {
                      label: "Follow-up",
                      value: "Follow-up",
                      count: campaignStatusCounts?.["Follow-up"],
                    },
                    {
                      label: "Close",
                      value: "Close",
                      count: campaignStatusCounts?.["Close"],
                    },
                    {
                      label: "Connected",
                      value: "Connected",
                      count: campaignStatusCounts?.["Connected"],
                    },
                    {
                      label: "Not Connected",
                      value: "Not Connected",
                      count: campaignStatusCounts?.["Not Connected"],
                    },
                    {
                      label: "Donation",
                      value: "Donation",
                      count: campaignStatusCounts?.["Donation"],
                    },
                  ].map((tabItem) => {
                    const isActive = campaignStatusFilter === tabItem.value;
                    const bStyle =
                      tabItem.value === "all"
                        ? { bg: "#f1f5f9", color: "#334155" }
                        : getCampaignStatusBadgeStyle(tabItem.value);
                    return (
                      <button
                        key={tabItem.value}
                        type="button"
                        onClick={() =>
                          handleCampaignStatusFilterChange(tabItem.value)
                        }
                        style={{
                          padding: "6px 14px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: isActive
                            ? "2px solid #2563eb"
                            : "1px solid #e2e8f0",
                          backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                          color: isActive ? "#1d4ed8" : "#334155",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.15s ease",
                          boxShadow: isActive
                            ? "0 2px 4px rgba(37,99,235,0.15)"
                            : "none",
                        }}
                      >
                        {tabItem.value !== "all" && (
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: bStyle.color,
                              display: "inline-block",
                            }}
                          />
                        )}
                        <span>{tabItem.label}</span>
                        {tabItem.count !== undefined && tabItem.count !== null && (
                          <span
                            style={{
                              backgroundColor: isActive ? "#2563eb" : bStyle.bg,
                              color: isActive ? "#ffffff" : bStyle.color,
                              borderRadius: "10px",
                              padding: "1px 7px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {tabItem.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Filter Toolbar Card */}
                <div
                  className="card p-3 shadow-sm"
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div className="row gx-2 gy-2 align-items-end">
                    <div className="col-md-2 col-sm-6">
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "4px",
                          display: "block",
                        }}
                      >
                        Status
                      </label>
                      <FormControl fullWidth size="small">
                        <Select
                          value={campaignStatusFilter}
                          onChange={(e) =>
                            handleCampaignStatusFilterChange(e.target.value)
                          }
                          sx={{
                            height: 38,
                            backgroundColor: "#fff",
                            fontSize: "13px",
                          }}
                        >
                          <MenuItem value="all">All Statuses</MenuItem>
                          {campaignAvailableStatuses.map((st) => (
                            <MenuItem key={st} value={st}>
                              {st}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </div>

                    <div className="col-md-2 col-sm-6">
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "4px",
                          display: "block",
                        }}
                      >
                        From Date
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        style={{ height: 38, fontSize: "13px" }}
                        value={campaignDateFrom}
                        onChange={(e) => setCampaignDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="col-md-2 col-sm-6">
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "4px",
                          display: "block",
                        }}
                      >
                        To Date
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        style={{ height: 38, fontSize: "13px" }}
                        value={campaignDateTo}
                        onChange={(e) => setCampaignDateTo(e.target.value)}
                      />
                    </div>

                    <div className="col-md-2 col-sm-6">
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "4px",
                          display: "block",
                        }}
                      >
                        Campaign Tag
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. facebook_ad"
                        style={{ height: 38, fontSize: "13px" }}
                        value={campaignTag}
                        onChange={(e) => setCampaignTag(e.target.value)}
                      />
                    </div>

                    <div className="col-md-2 col-sm-6">
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "4px",
                          display: "block",
                        }}
                      >
                        Page Size
                      </label>
                      <FormControl fullWidth size="small">
                        <Select
                          value={campaignPerPage}
                          onChange={(e) => {
                            setCampaignPerPage(e.target.value);
                            setSocialMediaPage(1);
                            getSocialMediaList(1, { per_page: e.target.value });
                          }}
                          sx={{
                            height: 38,
                            backgroundColor: "#fff",
                            fontSize: "13px",
                          }}
                        >
                          <MenuItem value={10}>10 per page</MenuItem>
                          <MenuItem value={20}>20 per page</MenuItem>
                          <MenuItem value={50}>50 per page</MenuItem>
                          <MenuItem value={100}>100 per page</MenuItem>
                        </Select>
                      </FormControl>
                    </div>

                    <div className="col-md-2 col-sm-6 d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-100"
                        style={{
                          height: 38,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                        onClick={() => {
                          if (campaignSearchDebounceTimerRef.current) {
                            clearTimeout(campaignSearchDebounceTimerRef.current);
                          }
                          setSocialMediaPage(1);
                          getSocialMediaList(1, { search: filterValue });
                        }}
                      >
                        <i className="fa fa-filter"></i> Apply
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        style={{
                          height: 38,
                          minWidth: "38px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Reset Filters"
                        onClick={handleResetCampaignFilters}
                      >
                        <i className="fa fa-refresh"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="col-md-12">
              <div className="main_content">
                <div className="table-responsive">
                  <TableContainer
                    component={Paper}
                    style={{ overflowX: "auto" }}
                    ref={targetRef}
                  >
                    <Table
                      stickyHeader
                      aria-label="sticky table"
                      className="table-no-card"
                    >
                      {tabValue === 4 ? (
                        <>
                          <TableHead>
                            <TableRow>
                              <TableCell>Sr.No.</TableCell>
                              <TableCell>Emergency Case</TableCell>
                              <TableCell>User Name</TableCell>
                              <TableCell>Contact Number</TableCell>
                              <TableCell>SOS Type</TableCell>
                              <TableCell>Date & Time</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sosLoading ? (
                              <TableRow>
                                <TableCell colSpan={8}>
                                  <div className="flex justify-center py-4">
                                    <p className="text-center text-gray-500">
                                      Loading SOS requests...
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (pdfRowLimit
                              ? rows.slice(0, pdfRowLimit)
                              : rows.slice(
                                page * rowsPerPage,
                                page * rowsPerPage + rowsPerPage,
                              )
                            ).length > 0 ? (
                              (pdfRowLimit
                                ? rows.slice(0, pdfRowLimit)
                                : rows.slice(
                                  page * rowsPerPage,
                                  page * rowsPerPage + rowsPerPage,
                                )
                              ).map((info, i) => (
                                <TableRow
                                  key={info.sosId || info.id || i}
                                  className={info.isUnread === true ? "unread-row" : undefined}
                                >
                                  <TableCell>
                                    {pdfRowLimit
                                      ? i + 1
                                      : page * rowsPerPage + i + 1}
                                  </TableCell>
                                  <TableCell
                                    title={formatSosDisplayValue(
                                      info.emergencyCaseId,
                                    )}
                                  >
                                    {formatSosDisplayValue(info.emergencyCaseId)}
                                    <UnreadDot unread={info.isUnread} />
                                  </TableCell>
                                  <TableCell
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => ViewSosDetail(e, info)}
                                    title={`${info.name}${info.patientId ? ` (${info.patientId})` : ""}`}
                                  >
                                    {truncateCellText(info.name)}
                                  </TableCell>
                                  <TableCell
                                    style={{ minWidth: 180, maxWidth: 240 }}
                                    title={formatSosDisplayValue(info.mobileNumber)}
                                  >
                                    {truncateCellText(
                                      formatSosDisplayValue(info.mobileNumber),
                                      50,
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatSosDisplayValue(info.sosType)}
                                  </TableCell>
                                  <TableCell>
                                    {info.date
                                      ? `${new Date(info.date).toLocaleDateString("en-GB")} - ${new Date(info.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })}`
                                      : "—"}
                                  </TableCell>
                                  <TableCell
                                    title={formatSosDisplayValue(info.status)}
                                  >
                                    {truncateCellText(
                                      formatSosDisplayValue(info.status),
                                      15,
                                    )}
                                  </TableCell>
                                  <TableCell className="action-icon">
                                    <Tooltip title="Open SOS Alert">
                                      <NotificationsActiveIcon
                                        className="eye-icon"
                                        style={{
                                          color: "#e53935",
                                          marginRight: 8,
                                          cursor: "pointer",
                                        }}
                                        onClick={(e) => OpenSosAlertModal(e, info)}
                                      />
                                    </Tooltip>
                                    <Tooltip title="View SOS Details">
                                      <VisibilityIcon
                                        className="eye-icon"
                                        onClick={(e) => ViewSosDetail(e, info)}
                                      />
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={8}>
                                  <div className="flex justify-center py-4">
                                    <p className="text-center text-gray-500">
                                      No SOS Requests Found
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </>
                      ) : isLeadTab ? (
                        <>
                          <TableHead>
                            <TableRow>
                              <TableCell>Sr.No.</TableCell>
                              {tabValue === 5 ? (
                                <>
                                  <TableCell>
                                    <TableSortLabel
                                      active={orderBy === "name"}
                                      direction={
                                        orderBy === "name"
                                          ? orderDirection
                                          : "asc"
                                      }
                                      onClick={() => handleRequestSort("name")}
                                    >
                                      Name
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Phone</TableCell>
                                  <TableCell>
                                    <TableSortLabel
                                      active={orderBy === "country"}
                                      direction={
                                        orderBy === "country"
                                          ? orderDirection
                                          : "asc"
                                      }
                                      onClick={() => handleRequestSort("country")}
                                    >
                                      Country
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Notes</TableCell>
                                  <TableCell>
                                    <TableSortLabel
                                      active={orderBy === "date"}
                                      direction={
                                        orderBy === "date"
                                          ? orderDirection
                                          : "asc"
                                      }
                                      onClick={() => handleRequestSort("date")}
                                    >
                                      Date & Time
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Actions</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell>
                                    <TableSortLabel
                                      active={orderBy === "name"}
                                      direction={
                                        orderBy === "name"
                                          ? orderDirection
                                          : "asc"
                                      }
                                      onClick={() => handleRequestSort("name")}
                                    >
                                      Name
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Phone</TableCell>
                                  <TableCell>
                                    <TableSortLabel
                                      active={orderBy === "country"}
                                      direction={
                                        orderBy === "country"
                                          ? orderDirection
                                          : "asc"
                                      }
                                      onClick={() =>
                                        handleRequestSort("country")
                                      }
                                    >
                                      Country
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>
                                    <TableSortLabel
                                      active={orderBy === "date"}
                                      direction={
                                        orderBy === "date"
                                          ? orderDirection
                                          : "asc"
                                      }
                                      onClick={() => handleRequestSort("date")}
                                    >
                                      Date & Time
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Actions</TableCell>
                                </>
                              )}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(tabValue === 5
                              ? (socialMediaLoading || campaignSyncing)
                              : chatbotLeadsLoading) ? (
                              <TableRow>
                                <TableCell
                                  colSpan={tabValue === 5 ? 8 : 7}
                                >
                                  <div className="flex justify-center py-4 text-center">
                                    <span
                                      className="spinner-border text-primary me-2"
                                      role="status"
                                      aria-hidden="true"
                                      style={{ width: "24px", height: "24px" }}
                                    ></span>
                                    <p className="text-center text-gray-500 mt-2 mb-0">
                                      {campaignSyncing
                                        ? "Syncing Campaign Contacts from server..."
                                        : tabValue === 5
                                          ? "Loading Campaign Contacts..."
                                          : "Loading Chatbot Leads..."}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : rows.length > 0 ? (
                              rows.map((info, i) => {
                                const pageOffset =
                                  ((tabValue === 5
                                    ? socialMediaPage
                                    : chatbotLeadsPage) -
                                    1) *
                                  (tabValue === 5 ? campaignPerPage : rowsPerPage);
                                return (
                                  <TableRow
                                    key={info.id || info.enquiryId || i}
                                  >
                                    <TableCell>
                                      {pageOffset + i + 1}
                                    </TableCell>
                                    {tabValue === 5 ? (
                                      <>
                                        <TableCell title={info.name || ""}>
                                          <div
                                            style={{
                                              fontWeight: 600,
                                              color: "#1e293b",
                                              fontSize: "13px",
                                            }}
                                          >
                                            {truncateCellText(
                                              info.name || "—",
                                              25
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell
                                          title={
                                            info.fullPhone ||
                                            info.phone ||
                                            ""
                                          }
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "6px",
                                              fontSize: "13px",
                                            }}
                                          >
                                            <i
                                              className="fa-brands fa-whatsapp text-success"
                                              style={{ fontSize: "15px" }}
                                            ></i>
                                            <span>
                                              {info.fullPhone ||
                                                info.phone ||
                                                "—"}
                                            </span>
                                          </div>
                                        </TableCell>
                                        <TableCell
                                          title={
                                            getCountryNameFromPhone(
                                              info.countryCode || info.phoneCode,
                                              info.fullPhone || info.phone,
                                              info.country
                                            ) || ""
                                          }
                                        >
                                          <span
                                            className="badge"
                                            style={{
                                              backgroundColor: "#f1f5f9",
                                              color: "#334155",
                                              fontSize: "12px",
                                              fontWeight: 600,
                                              padding: "4px 8px",
                                              borderRadius: "4px",
                                              border: "1px solid #cbd5e1",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "5px",
                                            }}
                                          >
                                            <i
                                              className="fa-solid fa-earth-americas text-primary"
                                              style={{ fontSize: "11px" }}
                                            ></i>
                                            <span>
                                              {getCountryNameFromPhone(
                                                info.countryCode || info.phoneCode,
                                                info.fullPhone || info.phone,
                                                info.country
                                              ) || "—"}
                                            </span>
                                          </span>
                                        </TableCell>
                                        <TableCell style={{ minWidth: 155 }}>
                                          {(() => {
                                            const badgeStyle =
                                              getCampaignStatusBadgeStyle(
                                                info.status
                                              );
                                            return (
                                              <FormControl
                                                size="small"
                                                fullWidth
                                              >
                                                <Select
                                                  value={
                                                    info.status || "Pending"
                                                  }
                                                  onChange={(e) =>
                                                    handleLeadStatusChange(
                                                      e,
                                                      info,
                                                      5
                                                    )
                                                  }
                                                  displayEmpty
                                                  sx={{
                                                    height: 32,
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    borderRadius: "6px",
                                                    backgroundColor:
                                                      badgeStyle.bg,
                                                    color: badgeStyle.color,
                                                    "& .MuiOutlinedInput-notchedOutline":
                                                      {
                                                        borderColor:
                                                          badgeStyle.border,
                                                      },
                                                    "&:hover .MuiOutlinedInput-notchedOutline":
                                                      {
                                                        borderColor:
                                                          badgeStyle.color,
                                                      },
                                                    "& .MuiSelect-select": {
                                                      padding: "4px 8px",
                                                    },
                                                  }}
                                                >
                                                  {campaignAvailableStatuses.map(
                                                    (st) => (
                                                      <MenuItem
                                                        key={st}
                                                        value={st}
                                                        style={{
                                                          fontSize: "13px",
                                                          fontWeight: 600,
                                                        }}
                                                      >
                                                        <span
                                                          style={{
                                                            display:
                                                              "inline-block",
                                                            width: "8px",
                                                            height: "8px",
                                                            borderRadius: "50%",
                                                            marginRight: "8px",
                                                            backgroundColor:
                                                              getCampaignStatusBadgeStyle(
                                                                st
                                                              ).color,
                                                          }}
                                                        />
                                                        {st}
                                                      </MenuItem>
                                                    )
                                                  )}
                                                </Select>
                                              </FormControl>
                                            );
                                          })()}
                                        </TableCell>
                                        <TableCell
                                          title={info.statusNotes || ""}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "6px",
                                              maxWidth: "160px",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: "12px",
                                                color: info.statusNotes
                                                  ? "#334155"
                                                  : "#94a3b8",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                display: "inline-block",
                                              }}
                                            >
                                              {info.statusNotes
                                                ? truncateCellText(
                                                    info.statusNotes,
                                                    18
                                                  )
                                                : "No notes"}
                                            </span>
                                            <i
                                              className="fa fa-pencil"
                                              style={{
                                                cursor: "pointer",
                                                color: "#64748b",
                                                fontSize: "11px",
                                              }}
                                              title="Edit Status & Notes"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleLeadStatusChange(
                                                  null,
                                                  info,
                                                  5,
                                                  info.status || "Pending"
                                                );
                                              }}
                                            />
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          {formatLeadDate(
                                            info.interakt_created_at ||
                                            info.interaktCreatedAt ||
                                            info.raw?.interakt_created_at ||
                                            info.raw?.interaktCreatedAt ||
                                            info.raw?.raw_data?.created_at_utc ||
                                            info.raw_data?.created_at_utc ||
                                            info.date
                                          )}
                                        </TableCell>
                                          <TableCell className="action-icon" style={{ whiteSpace: "nowrap" }}>
                                            <Tooltip title="Edit Contact" arrow>
                                              <IconButton
                                                size="small"
                                                style={{ color: "#0284c7", padding: "5px", marginRight: "6px" }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenEditLeadModal(info, 5);
                                                }}
                                              >
                                                <i className="fa fa-pencil" style={{ fontSize: "15px" }} />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="View Details" arrow>
                                              <IconButton
                                                size="small"
                                                style={{ color: "#64748b", padding: "5px", marginRight: "6px" }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleViewLeadDetail(info);
                                                }}
                                              >
                                                <VisibilityIcon style={{ fontSize: "18px" }} />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Create Enquiry / Upload Reports" arrow>
                                              <IconButton
                                                size="small"
                                                style={{ color: "#16a34a", padding: "5px" }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenCreateEnquiryModal(info, 5);
                                                }}
                                              >
                                                <i className="fa fa-user-plus" style={{ fontSize: "15px" }} />
                                              </IconButton>
                                            </Tooltip>
                                          </TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell title={info.name || ""}>
                                          {truncateCellText(info.name || "—")}
                                        </TableCell>
                                        <TableCell title={info.phone || ""}>
                                          {truncateCellText(
                                            info.phone || "—",
                                            18,
                                          )}
                                        </TableCell>
                                        <TableCell
                                          title={
                                            getCountryNameFromPhone(
                                              info.countryCode || info.phoneCode,
                                              info.fullPhone || info.phone,
                                              info.country
                                            ) || ""
                                          }
                                        >
                                          {truncateCellText(
                                            getCountryNameFromPhone(
                                              info.countryCode || info.phoneCode,
                                              info.fullPhone || info.phone,
                                              info.country
                                            ) || "—",
                                          )}
                                        </TableCell>
                                         <TableCell style={{ minWidth: 155 }}>
                                           {(() => {
                                             const rawSt = info.status || "Pending";
                                             const matchedSt =
                                               CAMPAIGN_ALLOWED_STATUSES.find(
                                                 (s) =>
                                                   s.toLowerCase() ===
                                                   String(rawSt).toLowerCase()
                                               ) || rawSt;
                                             const badgeStyle =
                                               getCampaignStatusBadgeStyle(matchedSt);
                                             return (
                                               <div
                                                 style={{
                                                   display: "flex",
                                                   alignItems: "center",
                                                   gap: "6px",
                                                 }}
                                               >
                                                 <FormControl size="small" fullWidth>
                                                   <Select
                                                     value={matchedSt}
                                                     onChange={(e) =>
                                                       handleLeadStatusChange(
                                                         e,
                                                         info,
                                                         6
                                                       )
                                                     }
                                                     displayEmpty
                                                     sx={{
                                                       height: 32,
                                                       fontSize: "12px",
                                                       fontWeight: 700,
                                                       borderRadius: "6px",
                                                       backgroundColor:
                                                         badgeStyle.bg,
                                                       color: badgeStyle.color,
                                                       "& .MuiOutlinedInput-notchedOutline":
                                                         {
                                                           borderColor:
                                                             badgeStyle.border,
                                                         },
                                                       "&:hover .MuiOutlinedInput-notchedOutline":
                                                         {
                                                           borderColor:
                                                             badgeStyle.color,
                                                         },
                                                       "& .MuiSelect-select": {
                                                         padding: "4px 8px",
                                                       },
                                                     }}
                                                   >
                                                     {CAMPAIGN_ALLOWED_STATUSES.map(
                                                       (st) => (
                                                         <MenuItem
                                                           key={st}
                                                           value={st}
                                                           style={{
                                                             fontSize: "13px",
                                                             fontWeight: 600,
                                                           }}
                                                         >
                                                           <span
                                                             style={{
                                                               display:
                                                                 "inline-block",
                                                               width: "8px",
                                                               height: "8px",
                                                               borderRadius: "50%",
                                                               marginRight: "8px",
                                                               backgroundColor:
                                                                 getCampaignStatusBadgeStyle(
                                                                   st
                                                                 ).color,
                                                             }}
                                                           />
                                                           {st}
                                                         </MenuItem>
                                                       )
                                                     )}
                                                   </Select>
                                                 </FormControl>
                                                 <Tooltip title="Edit Status & Notes" arrow>
                                                   <IconButton
                                                     size="small"
                                                     style={{
                                                       color: "#64748b",
                                                       padding: "4px",
                                                     }}
                                                     onClick={(e) => {
                                                       e.stopPropagation();
                                                       handleLeadStatusChange(
                                                         null,
                                                         info,
                                                         6,
                                                         matchedSt
                                                       );
                                                     }}
                                                   >
                                                     <i
                                                       className="fa fa-pencil"
                                                       style={{ fontSize: "12px" }}
                                                     />
                                                   </IconButton>
                                                 </Tooltip>
                                               </div>
                                             );
                                           })()}
                                         </TableCell>
                                         <TableCell>
                                           {formatLeadDate(info.date)}
                                         </TableCell>
                                         <TableCell
                                           className="action-icon"
                                           style={{ whiteSpace: "nowrap" }}
                                         >
                                           <Tooltip title="Edit Contact" arrow>
                                             <IconButton
                                               size="small"
                                               style={{
                                                 color: "#0284c7",
                                                 padding: "5px",
                                                 marginRight: "6px",
                                               }}
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleOpenEditLeadModal(info, 6);
                                               }}
                                             >
                                               <i
                                                 className="fa fa-pencil"
                                                 style={{ fontSize: "15px" }}
                                               />
                                             </IconButton>
                                           </Tooltip>
                                           <Tooltip title="View Details" arrow>
                                             <IconButton
                                               size="small"
                                               style={{
                                                 color: "#64748b",
                                                 padding: "5px",
                                                 marginRight: "6px",
                                               }}
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleViewLeadDetail(info);
                                               }}
                                             >
                                               <VisibilityIcon
                                                 style={{ fontSize: "18px" }}
                                               />
                                             </IconButton>
                                           </Tooltip>
                                           <Tooltip
                                             title="Create Enquiry / Upload Reports"
                                             arrow
                                           >
                                             <IconButton
                                               size="small"
                                               style={{
                                                 color: "#16a34a",
                                                 padding: "5px",
                                               }}
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleOpenCreateEnquiryModal(
                                                   info,
                                                   6
                                                 );
                                               }}
                                             >
                                               <i
                                                 className="fa fa-user-plus"
                                                 style={{ fontSize: "15px" }}
                                               />
                                             </IconButton>
                                           </Tooltip>
                                         </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell
                                  colSpan={tabValue === 5 ? 8 : 7}
                                >
                                  <div className="flex justify-center py-4">
                                    <p className="text-center text-gray-500">
                                      {tabValue === 5
                                        ? "No Campaign Contacts Found"
                                        : "No Chatbot Leads Found"}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </>
                      ) : (
                        <>
                          <TableHead>
                            <TableRow>
                              <TableCell>Sr.No.</TableCell>
                              <TableCell>
                                <TableSortLabel
                                  active={orderBy === "enquiryId"}
                                  direction={
                                    orderBy === "enquiryId" ? orderDirection : "asc"
                                  }
                                  onClick={() => handleRequestSort("enquiryId")}
                                >
                                  Enquiry IDs
                                </TableSortLabel>
                              </TableCell>
                              <TableCell>
                                <TableSortLabel
                                  active={orderBy === "name"}
                                  direction={
                                    orderBy === "name" ? orderDirection : "asc"
                                  }
                                  onClick={() => handleRequestSort("name")}
                                >
                                  Name
                                </TableSortLabel>
                              </TableCell>
                              <TableCell>
                                <TableSortLabel
                                  active={
                                    orderBy === "disease_name" ||
                                    orderBy === "treatment_name"
                                  }
                                  direction={
                                    orderBy === "disease_name" ||
                                    orderBy === "treatment_name"
                                      ? orderDirection
                                      : "asc"
                                  }
                                  onClick={() => handleRequestSort("disease_name")}
                                >
                                  Treatment Name
                                </TableSortLabel>
                              </TableCell>

                              <TableCell>
                                <TableSortLabel
                                  active={orderBy === "country"}
                                  direction={
                                    orderBy === "country" ? orderDirection : "asc"
                                  }
                                  onClick={() => handleRequestSort("country")}
                                >
                                  Country
                                </TableSortLabel>
                              </TableCell>

                              <TableCell>
                                <TableSortLabel
                                  active={orderBy === "treatingIn"}
                                  direction={
                                    orderBy === "treatingIn"
                                      ? orderDirection
                                      : "asc"
                                  }
                                  onClick={() => handleRequestSort("treatingIn")}
                                >
                                  Treating In
                                </TableSortLabel>
                              </TableCell>
                              {/* <TableCell>
                            <TableSortLabel
                              active={orderBy === "createdBy"}
                              direction={
                                orderBy === "createdBy" ? orderDirection : "asc"
                              }
                              onClick={() => handleRequestSort("createdBy")}
                            >
                              Created By
                            </TableSortLabel>
                          </TableCell> */}
                              <TableCell>
                                <TableSortLabel
                                  active={orderBy === "date"}
                                  direction={
                                    orderBy === "date" ? orderDirection : "asc"
                                  }
                                  onClick={() => handleRequestSort("date")}
                                >
                                  Date / Time
                                </TableSortLabel>
                              </TableCell>
                              <TableCell>
                                <TableSortLabel
                                  active={orderBy === "Enquiry_status"}
                                  direction={
                                    orderBy === "Enquiry_status"
                                      ? orderDirection
                                      : "asc"
                                  }
                                  onClick={() =>
                                    handleRequestSort("Enquiry_status")
                                  }
                                >
                                  Status
                                </TableSortLabel>
                              </TableCell>
                              {/* <TableCell>Status</TableCell> */}
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(pdfRowLimit
                              ? rows.slice(0, pdfRowLimit)
                              : rows.slice(
                                page * rowsPerPage,
                                page * rowsPerPage + rowsPerPage,
                              )
                            ).length > 0 ? (
                              (pdfRowLimit
                                ? rows.slice(0, pdfRowLimit)
                                : rows.slice(
                                  page * rowsPerPage,
                                  page * rowsPerPage + rowsPerPage,
                                )
                              ).map((info, i) => {
                                console.log(info);
                                return (
                                  <>
                                    <TableRow
                                      role="checkbox"
                                      tabIndex={-1}
                                      key={info.code}
                                      className={info.isUnread === true ? "unread-row" : undefined}
                                    >
                                      <TableCell>
                                        {pdfRowLimit
                                          ? i + 1
                                          : page * rowsPerPage + i + 1}
                                      </TableCell>
                                      <TableCell>
                                        {info.enquiryId}
                                        <UnreadDot unread={info.isUnread} />
                                      </TableCell>
                                      <TableCell
                                        style={{ cursor: "pointer" }}
                                        onClick={(e) =>
                                          ViewDetail(e, tabValue, info)
                                        }
                                        title={info.name}
                                      >
                                        <div style={{ fontWeight: 600 }}>{truncateCellText(info.name)}</div>
                                        {/* Assigned Staff / Coordinator Badge */}
                                        {(() => {
                                          const coord = getAssignedCoordinator(info);
                                          const staffList = getAssignedStaffList(info);
                                          const otherStaff = staffList.filter(
                                            (s) => String(s.role || "").toLowerCase() !== "coordinator"
                                          );

                                          if (!coord?.name && otherStaff.length === 0) return null;

                                          return (
                                            <div
                                              className="d-flex align-items-center gap-1 mt-1 flex-wrap"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenAssignStaff(info);
                                              }}
                                              title="Click to manage staff & coordinator"
                                              style={{ cursor: "pointer" }}
                                            >
                                              {coord?.name && (
                                                <span
                                                  className="badge"
                                                  style={{
                                                    backgroundColor: "#e0f2fe",
                                                    color: "#0369a1",
                                                    border: "1px solid #bae6fd",
                                                    fontSize: "10px",
                                                    fontWeight: 600,
                                                    padding: "2px 5px",
                                                    borderRadius: "4px",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "3px",
                                                  }}
                                                >
                                                  <i className="fa-solid fa-user-tie"></i>
                                                  {truncateCellText(coord.name, 12)}
                                                </span>
                                              )}
                                              {otherStaff.length > 0 && (
                                                <span
                                                  className="badge"
                                                  style={{
                                                    backgroundColor: "#ecfdf5",
                                                    color: "#065f46",
                                                    border: "1px solid #a7f3d0",
                                                    fontSize: "10px",
                                                    fontWeight: 600,
                                                    padding: "2px 5px",
                                                    borderRadius: "4px",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "3px",
                                                  }}
                                                >
                                                  +{otherStaff.length} Staff
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell
                                        title={
                                          info.treatment_name ||
                                          info.disease_name ||
                                          "—"
                                        }
                                      >
                                        {truncateCellText(
                                          info.treatment_name ||
                                          info.disease_name ||
                                          "—",
                                        )}
                                      </TableCell>
                                      <TableCell title={info.country}>
                                        {truncateCellText(info.country)}
                                      </TableCell>
                                      <TableCell title={info.treatingIn}>
                                        {truncateCellText(info.treatingIn)}
                                      </TableCell>
                                      {/* <TableCell>{info.createdBy}</TableCell> */}
                                      <TableCell>
                                        {new Date(info.date).toLocaleDateString(
                                          "en-GB",
                                        )}
                                        -
                                        {new Date(info.date).toLocaleTimeString(
                                          "en-GB",
                                          {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true,
                                          },
                                        )}
                                      </TableCell>

                                      <TableCell>
                                        {info.Enquiry_status === "Confirmed" ? (
                                          // ✅ Only show text
                                          <span style={{ fontWeight: "bold" }}>
                                            Confirm
                                          </span>
                                        ) : (
                                          // ✅ Otherwise show dropdown
                                          <FormControl
                                            sx={{ m: 1, minWidth: 120 }}
                                            size="small"
                                            className="cont-main"
                                          >
                                            <Select
                                              value={
                                                seekerStatus[info.enquiryId]
                                                  ? seekerStatus[info.enquiryId]
                                                  : getEnquiryStatusValue(
                                                      info.Enquiry_status,
                                                    )
                                              }
                                              onChange={(e) => {
                                                if (isReferral) return;
                                                handleChange(
                                                  e,
                                                  info.enquiryId,
                                                  tabValue,
                                                  info,
                                                );
                                              }}
                                              disabled={isReferral}
                                              displayEmpty
                                              className="status-direct"
                                              sx={
                                                isReferral
                                                  ? {
                                                      "&.Mui-disabled": {
                                                        cursor: "not-allowed",
                                                        backgroundColor: "#f9f9f9",
                                                      },
                                                      "& .MuiSelect-select.Mui-disabled": {
                                                        WebkitTextFillColor: "var(--bs-text-color, #333)",
                                                        fontWeight: 600,
                                                        cursor: "not-allowed",
                                                      },
                                                    }
                                                  : {}
                                              }
                                              renderValue={(selected) => {
                                                switch (String(selected)) {
                                                  case "0":
                                                    return "Pending";
                                                  case "1":
                                                    return "Confirm";
                                                  case "2":
                                                    return "Hold";
                                                  case "3":
                                                    return "Follow-up";
                                                  case "5":
                                                    return "Visit 1";
                                                  case "6":
                                                    return "Visit 2";
                                                  case "7":
                                                    return "Visa";
                                                  case "4":
                                                  case "8":
                                                    return "Close";
                                                  case "9":
                                                    return "Connected";
                                                  case "10":
                                                    return "Not Connected";
                                                  default:
                                                    return selected || "Pending";
                                                }
                                              }}
                                            >
                                              <MenuItem value="0">Pending</MenuItem>
                                              <MenuItem value="1">
                                                Confirm
                                              </MenuItem>
                                              <MenuItem value="2">Hold</MenuItem>
                                              <MenuItem value="3">
                                                Follow-up
                                              </MenuItem>
                                              <MenuItem value="5">Visit 1</MenuItem>
                                              <MenuItem value="6">Visit 2</MenuItem>
                                              <MenuItem value="7">Visa</MenuItem>
                                               <MenuItem value="8">Close</MenuItem>
                                               <MenuItem value="9">Connected</MenuItem>
                                               <MenuItem value="10">Not Connected</MenuItem>
                                            </Select>
                                          </FormControl>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className="action-icon"
                                        onClickCapture={() =>
                                          markRequestRowRead(info)
                                        }
                                      >
                                        {isReferral ? (
                                          <>
                                            <VisibilityIcon
                                              className="eye-icon"
                                              style={{ cursor: "pointer" }}
                                              titleAccess="View Details"
                                              onClick={(e) =>
                                                ViewDetail(e, tabValue, info)
                                              }
                                            />
                                            {canUploadEnquiryReports(info) && (
                                              <UploadEnquiryReportsIcon
                                                onClick={(e) =>
                                                  handleOpenEnquiryReports(e, info)
                                                }
                                              />
                                            )}
                                            {canTrackActivity && (
                                              <i
                                                className="fa-solid fa-clock-rotate-left"
                                                title="Activity Logs"
                                                style={{ cursor: "pointer" }}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleOpenEnquiryActivity(info);
                                                }}
                                              ></i>
                                            )}
                                            {/* Assign / Manage Staff Icon */}
                                            {(() => {
                                              const coord = getAssignedCoordinator(info);
                                              const staffList = getAssignedStaffList(info);
                                              const hasStaff = Boolean(coord?.name || staffList.length > 0);
                                              return (
                                                <i
                                                  className={hasStaff ? "fa-solid fa-user-check" : "fa-solid fa-user-tie"}
                                                  title={
                                                    hasStaff
                                                      ? `Staff Assigned: ${coord?.name || `${staffList.length} assigned`} (Click to Manage)`
                                                      : "Assign Staff / Coordinator"
                                                  }
                                                  style={{
                                                    cursor: "pointer",
                                                    color: "var(--bs-primary-color)",
                                                  }}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleOpenAssignStaff(info);
                                                  }}
                                                ></i>
                                              );
                                            })()}
                                            <i
                                              className="fa-solid fa-pen-to-square"
                                              title="Edit"
                                              style={{ cursor: "pointer" }}
                                              onClick={(e) => {
                                                const src = tabValue === 7 ? (info?.tabSource ?? 0) : tabValue;
                                                return src === 1
                                                  ? EditAmbulance(e, info)
                                                  : src === 2
                                                    ? EditAirAmbulance(e, info)
                                                    : src === 3
                                                      ? EditTreatmentEstimate(e, info)
                                                      : EditButton(e, src === 0 ? info.enquiryId : info.id);
                                              }}
                                            ></i>
                                          </>
                                        ) : (
                                          <>
                                            {(tabValue === 0 || tabValue === 1 || tabValue === 2 || tabValue === 3 || tabValue === 7) ? (
                                              <>
                                                <i
                                                  className="fa-solid fa-notes-medical"
                                                  title="Create Notes"
                                                  style={{ cursor: "pointer" }}
                                                  onClick={(e) =>
                                                    handleClickOpen2(
                                                      e,
                                                      (tabValue === 0 || (tabValue === 7 && (info?.tabSource === 0 || info?.tabSource === undefined)))
                                                        ? info.enquiryId
                                                        : info.id,
                                                    )
                                                  }
                                                ></i>
                                                <UploadEnquiryReportsIcon
                                                  onClick={(e) =>
                                                    handleOpenEnquiryReports(e, info)
                                                  }
                                                />
                                              </>
                                            ) : (
                                              ""
                                            )}
                                            {/* {tabValue === 0
                                      ? !info?.hasDoctorReview && (
                                          <i
                                            className="fa-solid fa-stethoscope"
                                            onClick={(e) =>
                                              handleClickOpen4(
                                                e,
                                                info.enquiryId,
                                                info,
                                              )
                                            }
                                          ></i>
                                        )
                                      : Object.keys(
                                          info?.raw?.doctor_review || {},
                                        ).length === 0 && (
                                          <i
                                            className="fa-solid fa-stethoscope"
                                            onClick={(e) =>
                                              handleClickOpen4(
                                                e,
                                                info.enquiryId,
                                                info,
                                              )
                                            }
                                          ></i>
                                        )} */}
                                            {/* {(localStorage.getItem("Role") ===
                                      "Admin" ||
                                      localStorage.getItem("Role") ===
                                      "Doctor") &&
                                      (tabValue === 0
                                        ? !info?.hasDoctorReview && (
                                          <i
                                            className="fa-solid fa-stethoscope"
                                            onClick={(e) =>
                                              handleClickOpen4(
                                                e,
                                                info.enquiryId,
                                                info,
                                              )
                                            }
                                          ></i>
                                        )
                                        : Object.keys(
                                          info?.raw?.doctor_review || {},
                                        ).length === 0 && (
                                          <i
                                            className="fa-solid fa-stethoscope"
                                            onClick={(e) =>
                                              handleClickOpen4(
                                                e,
                                                info.enquiryId,
                                                info,
                                              )
                                            }
                                          ></i>
                                        ))} */}
                                            {canDoctorReview && (
                                              <i
                                                className="fa-solid fa-stethoscope"
                                                onClick={(e) =>
                                                  handleClickOpen4(
                                                    e,
                                                    info.enquiryId,
                                                    info,
                                                  )
                                                }
                                              ></i>
                                            )}
                                            {info?.hasAppointment === true ? (
                                              ""
                                            ) : (
                                              <i
                                                className="fa-solid fa-calendar-plus"
                                                title="Add Appointment"
                                                style={{ cursor: "pointer" }}
                                                onClick={() =>
                                                  handleOpenAppointment(info)
                                                }
                                              ></i>
                                            )}
                                            <VisibilityIcon
                                              className="eye-icon"
                                              onClick={(e) =>
                                                ViewDetail(e, tabValue, info)
                                              }
                                            />
                                            {canTrackActivity && (
                                              <i
                                                className="fa-solid fa-clock-rotate-left"
                                                title="Activity Logs"
                                                style={{ cursor: "pointer" }}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleOpenEnquiryActivity(info);
                                                }}
                                              ></i>
                                            )}
                                            {/* Assign / Manage Staff Icon */}
                                            {(() => {
                                              const coord = getAssignedCoordinator(info);
                                              const staffList = getAssignedStaffList(info);
                                              const hasStaff = Boolean(coord?.name || staffList.length > 0);
                                              return (
                                                <i
                                                  className={hasStaff ? "fa-solid fa-user-check" : "fa-solid fa-user-tie"}
                                                  title={
                                                    hasStaff
                                                      ? `Staff Assigned: ${coord?.name || `${staffList.length} assigned`} (Click to Manage)`
                                                      : "Assign Staff / Coordinator"
                                                  }
                                                  style={{
                                                    cursor: "pointer",
                                                    color: "var(--bs-primary-color)",
                                                  }}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleOpenAssignStaff(info);
                                                  }}
                                                ></i>
                                              );
                                            })()}
                                            {(tabValue === 0 || (tabValue === 7 && (info?.tabSource === 0 || info?.tabSource === undefined))) ? (
                                              <>
                                                {allowEdit && (
                                                  <i
                                                    className="fa-solid fa-pen-to-square"
                                                    onClick={(e) =>
                                                      EditButton(e, info.enquiryId)
                                                    }
                                                  ></i>
                                                )}
                                                {allowDelete && (
                                                    <i
                                                      className="fa-solid fa-trash"
                                                      onClick={() => handledelete(info)}
                                                    ></i>
                                                  )}
                                              </>
                                            ) : (
                                              <>
                                                {allowEdit &&
                                                  ((tabValue === 1 || (tabValue === 7 && info?.tabSource === 1)) ||
                                                  (tabValue === 2 || (tabValue === 7 && info?.tabSource === 2)) ||
                                                  (tabValue === 3 || (tabValue === 7 && info?.tabSource === 3))) && (
                                                  <i
                                                    className="fa-solid fa-pen-to-square"
                                                    title="Edit"
                                                    style={{ cursor: "pointer" }}
                                                    onClick={(e) => {
                                                      const src = tabValue === 7 ? info?.tabSource : tabValue;
                                                      return src === 1
                                                        ? EditAmbulance(e, info)
                                                        : src === 2
                                                          ? EditAirAmbulance(e, info)
                                                          : EditTreatmentEstimate(e, info);
                                                    }}
                                                  ></i>
                                                )}
                                                {allowDelete && (
                                                <i
                                                  className="fa-solid fa-trash"
                                                  onClick={() =>
                                                    handleDeleteExternal(info)
                                                  }
                                                ></i>
                                                )}
                                              </>
                                            )}
                                          </>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  </>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={11}>
                                  <div className="flex justify-center py-4">
                                    <p className="text-center text-gray-500">
                                      No Data Found
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </>
                      )}
                    </Table>
                    {!pdfRowLimit && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 20px",
                          flexWrap: "wrap",
                          gap: "12px",
                          borderTop: "1px solid #e2e8f0",
                          backgroundColor: "#fafbfc",
                        }}
                      >
                        <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                          {tabValue === 5 ? (
                            (() => {
                              const totalCount = socialMediaTotalCount || rows.length;
                              if (totalCount === 0 || rows.length === 0) return "No campaign contacts found";
                              const start = (socialMediaPage - 1) * campaignPerPage + 1;
                              const end = Math.min(start + rows.length - 1, totalCount);
                              return (
                                <span>
                                  Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalCount}</strong> campaign contacts
                                </span>
                              );
                            })()
                          ) : tabValue === 6 ? (
                            (() => {
                              const totalCount = chatbotLeadsTotalCount || rows.length;
                              if (totalCount === 0 || rows.length === 0) return "No chatbot leads found";
                              const start = (chatbotLeadsPage - 1) * rowsPerPage + 1;
                              const end = Math.min(start + rows.length - 1, totalCount);
                              return (
                                <span>
                                  Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalCount}</strong> chatbot leads
                                </span>
                              );
                            })()
                          ) : (
                            (() => {
                              const totalCount = rows.length;
                              if (totalCount === 0) return "No records found";
                              const start = page * rowsPerPage + 1;
                              const end = Math.min((page + 1) * rowsPerPage, totalCount);
                              return (
                                <span>
                                  Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalCount}</strong> entries
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <Stack spacing={2} direction="row" alignItems="center">
                          <Pagination
                            className="page-nation"
                            count={
                              tabValue === 5
                                ? Math.max(1, socialMediaTotalPages)
                                : tabValue === 6
                                  ? Math.max(1, chatbotLeadsTotalPages)
                                  : Math.max(1, Math.ceil(rows.length / rowsPerPage))
                            }
                            page={
                              tabValue === 5
                                ? Math.min(
                                    socialMediaPage,
                                    Math.max(1, socialMediaTotalPages)
                                  )
                                : tabValue === 6
                                  ? Math.min(
                                      chatbotLeadsPage,
                                      Math.max(1, chatbotLeadsTotalPages)
                                    )
                                  : page + 1
                            }
                            onChange={(event, value) => {
                              if (tabValue === 5) {
                                setSocialMediaPage(value);
                              } else if (tabValue === 6) {
                                setChatbotLeadsPage(value);
                              } else {
                                setPage(value - 1);
                              }
                            }}
                            color="primary"
                            showFirstButton
                            showLastButton
                          />
                        </Stack>
                      </div>
                    )}
                  </TableContainer>
                </div>
              </div>
            </div>
            <div
              id="delete_appointment"
              className="modal fade delete-modal"
              role="dialog"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-body text-center">
                    <img
                      src="assets/img/sent.png"
                      alt=""
                      width="50"
                      height="46"
                    />
                    <h3>Are you sure want to delete this Appointment?</h3>
                    <div className="m-t-20">
                      {" "}
                      <a
                        href="#"
                        className="btn btn-white"
                        data-dismiss="modal"
                      >
                        Close
                      </a>
                      <button type="submit" className="btn btn-danger">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <React.Fragment>
        <Dialog
          fullWidth={fullWidth}
          maxWidth={maxWidth}
          open={open3}
          onClose={handleClose3}
        >
          <div className="main-card-header">
            <div className="note-hd">
              <h6>Import Excel File</h6>
            </div>
            <div className="cross-icon" onClick={handleClose3}>
              <i class="fa-solid fa-xmark"></i>
            </div>
          </div>
          <DialogContent className="main-box">
            <Box
              noValidate
              component="form"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "fit-content",
              }}
              className="Date / Time-form"
            >
              <Box>
                <form id="contact-form" className="contact-form">
                  <div className="field-set">
                    <label>
                      Choose File<span className="text-danger">*</span>
                    </label>
                    <input
                      className="form-control"
                      type="file"
                      id="fileSelect"
                      accept=".xlsx, .xls, .csv"
                      onChange={(event) => {
                        const file = event.target.files[0];
                        console.log("Selected file:", file);
                        setSelectedImage(file);
                      }}
                    />
                  </div>
                  <DialogActions className="submit-main">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busyKey === "import"}
                      onClick={(e) => handleImportFile(e)}
                    >
                      {busyKey === "import" ? "Submitting..." : "Submit"}
                    </Button>
                  </DialogActions>
                </form>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </React.Fragment>
      <React.Fragment>
        <Dialog
          open={openAppointment}
          onClose={handleCloseAppointment}
          fullWidth
          maxWidth="md"
        >
          <div className="main-card-header">
            <div className="note-hd">
              <h6>Add Enquiry Appointment</h6>
            </div>
            <div className="cross-icon" onClick={handleCloseAppointment}>
              <i className="fa-solid fa-xmark"></i>
            </div>
          </div>
          <DialogContent className="view-table-detail">
            <Box className="contact-form">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="field-set">
                    <FormControl fullWidth size="small">
                      <label>Select Hospital</label>
                      <Select
                        value={appointmentData.hospital_id || ""}
                        onChange={(e) => {
                          const selectedId = e.target.value;

                          const selectedHospital = hospitalList.find(
                            (item) => item.id === selectedId,
                          );

                          setAppointmentData((prev) => ({
                            ...prev,
                            hospital_id: selectedId,
                            hospitalName: selectedHospital?.name || "",
                            hospital_email: selectedHospital?.email || "",
                          }));
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 250,
                            },
                          },
                        }}
                      >
                        {hospitalList.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="field-set">
                    <label>Treatment Name</label>
                    <Autocomplete
                      options={Treatment || []}
                      getOptionLabel={(option) => option.name || ""}
                      value={
                        Treatment?.find(
                          (item) => item.id == appointmentData.treatment_id
                        ) || null
                      }
                      onChange={(e, value) => {
                        setAppointmentData((prev) => ({
                          ...prev,
                          treatment_id: value?.id || "",
                          treatment_name: value?.name || "",
                        }));
                      }}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Select Treatment" size="small" />
                      )}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          padding: "0px",
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="col-md-12">
                  <div className="field-set">
                    <label>Health Issue</label>
                    <input
                      type="text"
                      name="health_issue"
                      className="form-control"
                      placeholder="Patient health issue / complaint"
                      value={appointmentData.health_issue}
                      onChange={handleAppointmentChange}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="field-set">
                    <label>
                      Date<span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      name="appointment_Date"
                      className="form-control"
                      value={appointmentData.appointment_Date}
                      onChange={handleAppointmentChange}
                      min={todayDateInput()}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="field-set">
                    <label>
                      Time<span className="text-danger">*</span>
                    </label>
                    <input
                      type="time"
                      name="appointment_Time"
                      className="form-control"
                      value={appointmentData.appointment_Time}
                      onChange={handleAppointmentChange}
                    />
                  </div>
                </div>

                {/* Extra Transport, Pick/Drop & Mode Fields */}
                <div className="col-md-12">
                  <AppointmentTransportFields
                    data={appointmentData}
                    onChange={(updates) =>
                      setAppointmentData((prev) => ({ ...prev, ...updates }))
                    }
                  />
                </div>

                <div className="col-md-12">
                  <div className="field-set">
                    <label>
                      Notes<span className="text-danger">*</span>
                    </label>
                    <textarea
                      name="Notes"
                      rows={3}
                      className="form-control"
                      placeholder="Discussion notes / instructions"
                      value={appointmentData.Notes}
                      onChange={handleAppointmentChange}
                    />
                  </div>
                </div>

                <div className="col-md-12">
                  <div className="field-set">
                    <CameraFileUpload
                      label="Upload Reports / Documents"
                      files={images}
                      setFiles={setImages}
                      multiple={true}
                      accept="image/*,.pdf,application/pdf"
                      helperText="Take photos of reports or upload PDF/images"
                    />
                  </div>
                </div>
              </div>

              <DialogActions className="submit-main">
                <Button onClick={handleCloseAppointment}>Cancel</Button>
                <Button
                  variant="contained"
                  disabled={busyKey === "appointment"}
                  onClick={handleSubmitAppointment}
                  className="add-button"
                >
                  {busyKey === "appointment" ? "Submitting..." : "Schedule Appointment"}
                </Button>
              </DialogActions>
            </Box>
          </DialogContent>
        </Dialog>
      </React.Fragment>
      <React.Fragment>
        <Dialog
          fullWidth={fullWidth}
          maxWidth={maxWidth}
          open={open9}
          onClose={handleClose2wew}
        >
          <div className="main-card-header">
            <div className="note-hd">
              <h6>Add Hospitals</h6>
            </div>
            <div className="cross-icon" onClick={handleClose2wew}>
              <i class="fa-solid fa-xmark"></i>
            </div>
          </div>
          <DialogContent className="main-box">
            <Box
              noValidate
              component="form"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "fit-content",
              }}
              className="contact-form"
            >
              <Box>
                <form id="contact-form">
                  <div className="col-sm-12">
                    <div className="field-set">
                      <label>
                        Select Hospital<span className="text-danger">*</span>
                      </label>
                      <Autocomplete
                        multiple
                        options={
                          hospital && hospital.length > 0
                            ? hospital.map((h) => h.name)
                            : []
                        }
                        value={report.hospital || []}
                        onChange={handleHospitalChange}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Search & Select Hospital"
                            variant="outlined"
                            size="small"
                          />
                        )}
                      />
                    </div>
                  </div>
                  <DialogActions className="submit-main">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busyKey === "notes"}
                      onClick={handleNotesdata}
                    >
                      {busyKey === "notes" ? "Submitting..." : "Submit"}
                    </Button>
                  </DialogActions>
                </form>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </React.Fragment>
      <React.Fragment>
        <Dialog
          fullWidth={fullWidth}
          maxWidth={maxWidth}
          open={open2}
          onClose={handleClose2}
        >
          <div className="main-card-header">
            <div className="note-hd">
              <h6>Create Notes</h6>
            </div>
            <div className="cross-icon" onClick={handleClose2}>
              <i class="fa-solid fa-xmark"></i>
            </div>
          </div>
          <DialogContent className="main-box">
            <Box
              noValidate
              component="form"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "fit-content",
              }}
              className="contact-form"
            >
              <Box>
                <form id="contact-form">
                  <div className="field-set">
                    <label>
                      Notes<span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="w3review"
                      name="discussionNotes"
                      rows="4"
                      cols="50"
                      className="form-control"
                      placeholder="Note"
                      onChange={(e) => setNote(e.target.value)}
                      value={note}
                    />
                    <span style={{ color: "red" }}>
                      {blogErr && !note ? "Please Enter Your  note" : ""}
                    </span>
                  </div>
                  <div className="field-set">
                    <label>
                      Date<span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      id="birthday"
                      name="date"
                      placeholder="Date"
                      className="form-control"
                      onChange={(e) => setDate(e.target.value)}
                      value={date}
                      min={todayDateInput()}
                    />
                    <span style={{ color: "red" }}>
                      {blogErr && !date ? "Please Enter Your  date" : ""}
                    </span>
                  </div>
                  <DialogActions className="submit-main">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busyKey === "notes"}
                      onClick={handleNotesdata}
                    >
                      {busyKey === "notes" ? "Submitting..." : "Submit"}
                    </Button>
                  </DialogActions>
                </form>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </React.Fragment>
      <React.Fragment>
        <Dialog fullWidth maxWidth="sm" open={open4} onClose={handleClose4}>
          <div className="main-card-header d-flex justify-content-between align-items-center px-3 py-2">
            <div className="note-hd">
              <h6>Doctor Review</h6>
            </div>
            <div className="cross-icon" onClick={handleClose4}>
              <i class="fa-solid fa-xmark"></i>
            </div>
          </div>
          <DialogContent className="main-box">
            <Box
              noValidate
              component="form"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <Box>
                <form id="contact-form">
                  <div className="field-set">
                    <label>
                      Subject<span className="text-danger">*</span>
                    </label>
                    <input
                      id=""
                      name="Title"
                      onChange={handleRecommendTitle}
                      className="form-control"
                      value={Title}
                      placeholder="Subject"
                    />
                  </div>
                  <div className="field-set">
                    <label>
                      Review Notes<span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="w3review"
                      name="discussionNotes"
                      rows="4"
                      cols="50"
                      className="form-control"
                      placeholder="Review"
                      onChange={handleNoteChange}
                      value={note}
                    />
                    <span style={{ color: "red" }}>
                      {blogErr && !note ? "Please Enter Your  note" : ""}
                    </span>
                  </div>
                  <div className="field-set">
                    <CameraFileUpload
                      label="Upload Images / Take Picture"
                      files={images}
                      setFiles={setImages}
                      multiple={true}
                      accept="image/*,.pdf,application/pdf"
                      helperText="Take photos or select images from device"
                    />
                  </div>
                  <div className="field-set">
                    <label>
                      Recommendations<span className="text-danger">*</span>
                    </label>
                    <textarea
                      id=""
                      name="recommend"
                      rows="4"
                      cols="50"
                      onChange={handleRecommendChange}
                      className="form-control"
                      value={recommend}
                      placeholder="Recommendations"
                    />
                  </div>

                  <DialogActions className="submit-main">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busyKey === "review"}
                      onClick={handleNotesdataqw}
                    >
                      {busyKey === "review" ? "Submitting..." : "Submit"}
                    </Button>
                  </DialogActions>
                </form>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </React.Fragment>
      <React.Fragment>
        <Dialog
          open={leadDetailOpen}
          onClose={handleCloseLeadDetail}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.25)",
            },
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              background: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: tabValue === 5 ? "#dcfce7" : "#e0f2fe",
                  color: tabValue === 5 ? "#16a34a" : "#0284c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                <i className={tabValue === 5 ? "fa-brands fa-whatsapp" : "fa-solid fa-robot"}></i>
              </div>
              <div>
                <h6 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                  {tabValue === 5
                    ? "Campaign Contact Detail"
                    : "Chatbot Lead Detail"}
                </h6>
                <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                  {selectedLead?.name ? <strong style={{ color: "#0f172a" }}>{selectedLead.name}</strong> : ""}
                  {selectedLead?.phone || selectedLead?.phoneNumber ? ` • ${selectedLead.phone || selectedLead.phoneNumber}` : ""}
                  {selectedLead?.country ? ` (${getCountryNameFromPhone(selectedLead.countryCode || selectedLead.phoneCode, selectedLead.phone || selectedLead.phoneNumber, selectedLead.country)})` : ""}
                  {selectedLead?.interakt_created_at ||
                  selectedLead?.interaktCreatedAt ||
                  selectedLead?.raw?.interakt_created_at ||
                  selectedLead?.raw?.raw_data?.created_at_utc ||
                  selectedLead?.date
                    ? ` • ${formatLeadDate(
                        (tabValue === 5
                          ? selectedLead.interakt_created_at ||
                            selectedLead.interaktCreatedAt ||
                            selectedLead.raw?.interakt_created_at ||
                            selectedLead.raw?.raw_data?.created_at_utc
                          : null) || selectedLead.date
                      )}`
                    : ""}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseLeadDetail}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "none",
                background: "#f1f5f9",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e2e8f0";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.color = "#64748b";
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <DialogContent
            style={{
              padding: "20px 24px",
              background: "#f8fafc",
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            {selectedLead ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "12px",
                }}
              >
                {[
                      {
                        label: tabValue === 5 ? "Contact Name" : "Lead Name",
                        value: selectedLead.name || selectedLead.patient_name || selectedLead.full_name,
                        icon: "fa-solid fa-user",
                      },
                      {
                        label: "Phone Number",
                        value: selectedLead.phone || selectedLead.phoneNumber || selectedLead.emergency_contact_no,
                        icon: "fa-solid fa-phone",
                      },
                      {
                        label: "Country",
                        value:
                          selectedLead.country ||
                          getCountryNameFromPhone(
                            selectedLead.countryCode || selectedLead.phoneCode,
                            selectedLead.phone || selectedLead.phoneNumber,
                            selectedLead.country
                          ),
                        icon: "fa-solid fa-earth-americas",
                      },
                      {
                        label: "Email Address",
                        value:
                          selectedLead.email ||
                          selectedLead.raw?.email ||
                          selectedLead.raw?.traits?.email,
                        icon: "fa-regular fa-envelope",
                      },
                      {
                        label: "Treatment / Ad Name",
                        value:
                          selectedLead.treatment_ad_name ||
                          selectedLead.treatment ||
                          selectedLead.adName ||
                          selectedLead.treatment_name ||
                          selectedLead.disease_name ||
                          selectedLead.raw?.service_selected ||
                          selectedLead.service_selected ||
                          selectedLead.raw?.treatment_ad_name ||
                          selectedLead.raw?.traits?.treatment_ad_name,
                        icon: "fa-solid fa-notes-medical",
                      },
                      {
                        label: "Age",
                        value:
                          selectedLead.age ||
                          selectedLead.raw?.age ||
                          selectedLead.raw?.traits?.age ||
                          selectedLead.patient_age,
                        icon: "fa-solid fa-cake-candles",
                      },
                      {
                        label: "Gender",
                        value:
                          selectedLead.gender ||
                          selectedLead.raw?.gender ||
                          selectedLead.raw?.traits?.gender ||
                          selectedLead.patient_gender,
                        icon: "fa-solid fa-venus-mars",
                      },
                      {
                        label: "Status",
                        value:
                          selectedLead.status === 1 || selectedLead.status === "1"
                            ? "Pending"
                            : selectedLead.status || (tabValue === 5 ? "Pending" : "New Lead"),
                        isBadge: true,
                        badgeType:
                          String(selectedLead.status).toLowerCase() === "connected" ||
                          String(selectedLead.status).toLowerCase() === "donation" ||
                          String(selectedLead.status).toLowerCase() === "new lead"
                            ? "success"
                            : String(selectedLead.status).toLowerCase() === "close"
                            ? "error"
                            : "warning",
                        icon: "fa-solid fa-circle-check",
                      },
                      {
                        label: "Notes",
                        value:
                          selectedLead.statusNotes ||
                          selectedLead.status_notes ||
                          selectedLead.notes ||
                          selectedLead.message,
                        fullWidth: true,
                        isMultiline: true,
                        icon: "fa-regular fa-comment-dots",
                      },
                      {
                        label: "Date & Time",
                        value: formatLeadDate(
                          (tabValue === 5
                            ? selectedLead.interakt_created_at ||
                              selectedLead.interaktCreatedAt ||
                              selectedLead.raw?.interakt_created_at ||
                              selectedLead.raw?.raw_data?.created_at_utc
                            : null) || selectedLead.date
                        ),
                        icon: "fa-regular fa-clock",
                      },
                    ]
                  .filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== "")
                  .map((item, idx) => (
                    <div
                      key={item.label || idx}
                      style={{
                        gridColumn: item.fullWidth ? "1 / -1" : "auto",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {item.icon && <i className={item.icon} style={{ fontSize: "11px", color: "#94a3b8" }}></i>}
                        <span>{item.label}</span>
                      </div>
                      <div>
                        {item.isBadge ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background:
                                item.badgeType === "success"
                                  ? "#ecfdf5"
                                  : item.badgeType === "warning"
                                    ? "#fef3c7"
                                    : item.badgeType === "info"
                                      ? "#e0f2fe"
                                      : "#f1f5f9",
                              color:
                                item.badgeType === "success"
                                  ? "#065f46"
                                  : item.badgeType === "warning"
                                    ? "#92400e"
                                    : item.badgeType === "info"
                                      ? "#0369a1"
                                      : "#475569",
                              border: `1px solid ${
                                item.badgeType === "success"
                                  ? "#a7f3d0"
                                  : item.badgeType === "warning"
                                    ? "#fde68a"
                                    : item.badgeType === "info"
                                      ? "#bae6fd"
                                      : "#e2e8f0"
                              }`,
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background:
                                  item.badgeType === "success"
                                    ? "#10b981"
                                    : item.badgeType === "warning"
                                      ? "#f59e0b"
                                      : item.badgeType === "info"
                                        ? "#0ea5e9"
                                        : "#94a3b8",
                              }}
                            />
                            {String(item.value)}
                          </span>
                        ) : item.isUrl ? (
                          <a
                            href={String(item.value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#0284c7",
                              textDecoration: "none",
                              fontSize: "13px",
                              fontWeight: 500,
                              wordBreak: "break-all",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>{String(item.value)}</span>
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "11px" }}></i>
                          </a>
                        ) : item.isCode ? (
                          <code
                            style={{
                              fontFamily: "monospace",
                              fontSize: "12.5px",
                              color: "#0f172a",
                              background: "#f1f5f9",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              wordBreak: "break-all",
                              display: "inline-block",
                            }}
                          >
                            {String(item.value)}
                          </code>
                        ) : item.isMultiline ? (
                          <div
                            style={{
                              whiteSpace: "pre-line",
                              fontSize: "13.5px",
                              color: "#1e293b",
                              lineHeight: 1.5,
                              background: "#f8fafc",
                              padding: "10px 12px",
                              borderRadius: "6px",
                              border: "1px dashed #cbd5e1",
                            }}
                          >
                            {String(item.value)}
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 500,
                              color: "#1e293b",
                              wordBreak: "break-word",
                            }}
                          >
                            {String(item.value)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </DialogContent>

          <DialogActions
            style={{
              padding: "16px 24px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <Button
              variant="contained"
              onClick={() => {
                const lead = selectedLead;
                handleCloseLeadDetail();
                handleCreateEnquiryFromLead(lead);
              }}
              style={{
                background: "linear-gradient(135deg, #0ba6df 0%, #0284c7 100%)",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "13px",
                textTransform: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                boxShadow: "0 2px 6px rgba(11, 166, 223, 0.3)",
              }}
            >
              <i className="fa fa-user-plus me-2"></i>
              Create Enquiry / Upload Reports
            </Button>
            <Button
              variant="outlined"
              onClick={handleCloseLeadDetail}
              style={{
                borderColor: "#cbd5e1",
                color: "#475569",
                fontWeight: 500,
                fontSize: "13px",
                textTransform: "none",
                borderRadius: "8px",
                padding: "8px 18px",
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
        <EnquiryActivityLogsModal
          open={activityModalOpen}
          onClose={handleCloseEnquiryActivity}
          enquiryId={selectedEnquiryForActivity?.enquiryId || selectedEnquiryForActivity?.id}
          enquiryName={selectedEnquiryForActivity?.name || selectedEnquiryForActivity?.patient_name}
          allowExport={allowExport}
        />
        <UploadEnquiryReportsModal
          open={reportUpload.open}
          onClose={handleCloseEnquiryReports}
          enquiryId={reportUpload.enquiryId}
          recordId={reportUpload.recordId}
          model={reportUpload.model}
          enquiryLabel={reportUpload.label}
        />
        <CreateEnquiryModal
          open={createEnquiryModalOpen}
          onClose={() => {
            setCreateEnquiryModalOpen(false);
            setSelectedLeadForEnquiry(null);
          }}
          leadData={selectedLeadForEnquiry}
          sourceType={leadEnquirySourceType}
          mode={leadModalMode}
          onSuccess={handleEnquiryCreatedSuccess}
          onSaveLead={handleSaveLeadDetails}
        />
        <AssignEnquiryStaffModal
          open={assignStaffModalOpen}
          onClose={handleCloseAssignStaff}
          enquiry={selectedEnquiryForStaff}
          onSuccess={handleAssignStaffSuccess}
        />
      </React.Fragment>
      <ToastContainer
        position="top-right"
        autoClose={3500}
        limit={3}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}