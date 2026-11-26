import React, { useState, useEffect, useRef } from "react";
import PatientSearchSelect from "../../components/PatientSearchSelect";
import { Link } from "react-router-dom";
import axios from "axios";
import { AdminBaseUrl, AdminBaseUrl1, baseu11, baseurl } from "../../Basurl/Baseurl";
import { markRecordRead } from "../../services/unreadApi";
import { clearUnreadById, UnreadDot } from "../../components/NewTag";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import Swal from "sweetalert2";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { usePDF } from "react-to-pdf";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import IconButton from "@mui/material/IconButton";
import TableSortLabel from "@mui/material/TableSortLabel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ClearIcon from "@mui/icons-material/Clear";
import { useDispatch, useSelector } from "react-redux";
import { toast, ToastContainer } from "react-toastify";
import InputAdornment from "@mui/material/InputAdornment";
import {
  MenuItem,
  Box,
  Pagination,
  Stack,
  Tabs,
  Tab,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  CircularProgress,
} from "@mui/material";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import {
  formatSingleTime12Hour,
  formatTime12Hour,
  getDateInputValue,
  getTimeInputValue,
  formatDisplayDate,
  formatDisplayDateTime,
  formatPaidAmount,
  formatTimeRange,
  APPOINTMENT_TIME_OPTIONS,
  APPOINTMENT_TIME_PRESETS,
  parseAptOn,
  parseAppointmentTimeRange,
} from "../../utils/appointmentHelpers";
import { AppointmentForPatient } from "../../reducer/PatientTreatmentSlice";
import {
  getHospitalId,
  isHospitalUser,
  isInsuranceUser,
  getInsuranceId,
  isReferralUser,
  getReferralId,
} from "../../utils/authStorage";
import { canStaffDelete, canStaffEdit, canStaffExport } from "../../utils/staffActions";
import AppointmentTransportFields, {
  LOCATION_TYPES,
  PICK_DROP_STATUSES,
  PRESET_MANAGERS,
} from "../../components/Common/AppointmentTransportFields";
import "../Genera Enquiry/PickDropApp.css";

const getAppointmentStatusValue = (status) => {
  if (status === "Follow-Up") return 2;
  if (status === "Complete" || status === "Completed") return 3;
  if (status === "Cancelled") return 4;
  if (status === "Reschedule") return 5;
  if (status === "Confirmed") return 6;
  return "Schedule";
};

const getAppStatusApiValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const s = String(value).trim().toLowerCase();
  if (s === "1" || s === "confirmed") return 1;
  if (s === "2" || s === "completed" || s === "complete") return 2;
  if (s === "3" || s === "cancelled" || s === "cancel") return 3;
  if (s === "4" || s === "follow-up" || s === "follow up" || s === "followup") return 4;
  if (s === "5" || s === "rescheduled" || s === "reschedule") return 5;
  const num = parseInt(value, 10);
  return isNaN(num) ? value : num;
};

const getAppAppointmentStatusCode = (status) => {
  if (status === null || status === undefined || status === "") return "";
  const s = String(status).trim().toLowerCase();
  if (s === "1" || s === "confirmed") return "1";
  if (s === "2" || s === "completed" || s === "complete") return "2";
  if (s === "3" || s === "cancelled" || s === "cancel") return "3";
  if (s === "4" || s === "follow-up" || s === "follow up" || s === "followup") return "4";
  if (s === "5" || s === "rescheduled" || s === "reschedule") return "5";
  return String(status);
};

const getAppAppointmentStatusLabel = (status) => {
  if (status === null || status === undefined || status === "") return "-";
  const s = String(status).trim().toLowerCase();
  if (s === "1" || s === "confirmed") return "Confirmed";
  if (s === "2" || s === "completed" || s === "complete") return "Completed";
  if (s === "3" || s === "cancelled" || s === "cancel") return "Cancelled";
  if (s === "4" || s === "follow-up" || s === "follow up" || s === "followup") return "Follow-Up";
  if (s === "5" || s === "rescheduled" || s === "reschedule") return "Rescheduled";
  return String(status);
};

const getCRMAppointmentStatusLabel = (status) => {
  if (status === "2" || status === 2) return "Follow-Up";
  if (status === "3" || status === 3) return "Completed";
  if (status === "4" || status === 4) return "Cancelled";
  if (status === "5" || status === 5) return "Rescheduled";
  if (status === "6" || status === 6) return "Confirmed";
  return status || "Schedule";
};

const isAutoAppointmentNote = (val) => {
  if (!val || typeof val !== "string") return false;
  const lower = val.trim().toLowerCase();
  return (
    lower === "appointment updated" ||
    lower === "appointment created" ||
    lower.startsWith("booking type:")
  );
};

const getAppAppointmentStatusValue = (status) => getAppAppointmentStatusCode(status);

function TabPanel({ children, value, index }) {
  return value === index && <Box sx={{ p: 2 }}>{children}</Box>;
}
export default function Appointments() {
  const dispatch = useDispatch();
  const role = localStorage.getItem("Role");
  const hospitalUser = isHospitalUser();
  const allowEdit = canStaffEdit();
  const allowDelete = canStaffDelete();
  const allowExport = canStaffExport();
  const [tabValue, setTabValue] = useState(0);
  const [openEdit, setOpenEdit] = useState(false);
  const [editData, setEditData] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [appointmentTotalPages, setAppointmentTotalPages] = useState(1);
  const [appointmentTotalRecords, setAppointmentTotalRecords] = useState(0);
  const [searchApiData, setSearchApiData] = useState([]);
  const [loadingCRM, setLoadingCRM] = useState(true);
  const searchDebounceTimerRef = useRef(null);
  const [loadingAPP, setLoadingAPP] = useState(true);
  const [loadingENQ, setLoadingENQ] = useState(true);
  const [page, setPage] = useState(0);
  const [orderByCRM, setOrderByCRM] = useState("");
  const [orderDirectionCRM, setOrderDirectionCRM] = useState("asc");
  const [hospitalList, setHospitalList] = useState([]);
  const [orderByAPP, setOrderByAPP] = useState("");
  const [orderDirectionAPP, setOrderDirectionAPP] = useState("asc");
  const [pageAPP, setPageAPP] = useState(0);
  const [rowsPerPageAPP] = useState(10);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dataApp, setDataApp] = useState([]);
  const [searchDataApp, setSearchDataApp] = useState([]);
  const [searchDataEnq, setSearchDataEnq] = useState([]);
  const fullWidth = true;
  const [openViewEnq, setOpenViewEnq] = useState(false);
  const [selectedEnq, setSelectedEnq] = useState(null);
  const maxWidth = "md"; // xs | sm | md | lg | xl
  const [open, setOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [pdfRowLimit, setPdfRowLimit] = useState(null);
  const [statuddropdown, setStatuddropdown] = useState("offline");
  const [filterValue, setFilterValue] = useState("");
  const { toPDF, targetRef } = usePDF({ filename: "page.pdf" });
  const { Treatment, error } = useSelector((state) => state.Treatment);
  const [enquiryAppointments, setEnquiryAppointments] = useState([]);
  const [pageENQ, setPageENQ] = useState(0);
  const [orderByENQ, setOrderByENQ] = useState("");
  const [orderDirectionENQ, setOrderDirectionENQ] = useState("asc");
  const [rowsPerPageENQ] = useState(10);
  const [openReschedule, setOpenReschedule] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    type: "",
    appointmentId: "",
    patientName: "",
    currentAppointment: "",
    appointment_Date: "",
    appointment_Time: "",
  });
  const [openConfirm, setOpenConfirm] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmData, setConfirmData] = useState({
    appointmentId: "",
    patientName: "",
    currentAppointment: "",
    appointment_Date: "",
    appointment_Time: "",
  });
  const [openCancel, setOpenCancel] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelData, setCancelData] = useState({
    appointmentId: "",
    patientName: "",
    currentAppointment: "",
    cancel_reason_id: "",
    cancel_note: "",
  });
  const [openCreate, setOpenCreate] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [patientTreatments, setPatientTreatments] = useState([]);
  const [createSelectedManager, setCreateSelectedManager] = useState("NONE");
  const [createData, setCreateData] = useState({
    patient: null,
    treatment_id: "",
    treatment_name: "",
    hospital_id: "",
    hospital_Name: "",
    hospital_email: "",
    appointment_Date: "",
    appointment_Time: "",
    appointment_Time_From: "",
    appointment_Time_To: "",
    note: "",
    mode: "offline",
    needTransport: false,
    hasPickDrop: false,
    pickup_time: "",
    pickup_location: "",
    pickup_location_type: "",
    drop_location: "",
    drop_location_type: "",
    drop_time: "",
    hasDriver: false,
    pickup_manager_name: "",
    pickup_manager_phone: "",
    driver_name: "",
    driver_contact: "",
    vehicle_no: "",
    pickDropStatus: "New",
  });
  const [openCreateEnquiry, setOpenCreateEnquiry] = useState(false);
  const [createEnquirySubmitting, setCreateEnquirySubmitting] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [createEnquiryImages, setCreateEnquiryImages] = useState([]);
  const [createEnquiryData, setCreateEnquiryData] = useState({
    enquiryId: "",
    patientId: "",
    enq_userName: "",
    enq_phoneNumber: "",
    enq_email: "",
    hospital_id: "",
    hospitalName: "",
    hospital_email: "",
    treatment_id: "",
    treatment_name: "",
    health_issue: "",
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
    hasDriver: true,
    pickup_manager_name: "Ravi Kumar",
    pickup_manager_phone: "9217993173, 7453 034 087",
    driver_name: "Ravi Kumar",
    driver_contact: "9217993173, 7453 034 087",
    vehicle_no: "",
    pickDropStatus: "New",
  });

  const fetchCancelReasons = async () => {
    try {
      const formData = new FormData();
      formData.append("type", "doctor");
      const response = await axios.post(
        `${AdminBaseUrl1}appointment_cancel_reasons`,
        formData
      );
      const reasons =
        response.data?.data ||
        response.data?.reasons ||
        [];
      setCancelReasons(Array.isArray(reasons) ? reasons : []);
    } catch (error) {
      console.error("Error fetching cancel reasons:", error);
      toast.error("Failed to load cancellation reasons");
    }
  };

  const openCancelDialog = (appointmentId, item) => {
    fetchCancelReasons();
    setCancelData({
      appointmentId,
      patientName: item?.name || item?.patientName || "-",
      currentAppointment:
        item?.apt_on ||
        formatDisplayDateTime(
          item?.appointment_Date,
          item?.appointment_Time,
        ),
      cancel_reason_id: "",
      cancel_note: "",
    });
    setOpenCancel(true);
  };

  const openRescheduleDialog = (type, appointmentId, item) => {
    let aptDate = item?.appointment_Date || "";
    let aptTime = item?.appointment_Time || "";

    if (!aptDate && item?.apt_on) {
      const parts = String(item.apt_on).trim().split(" ");
      if (parts[0] && parts[0].includes("/")) {
        const [d, m, y] = parts[0].split("/");
        aptDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      if (parts.length >= 2) {
        aptTime = parts.slice(1).join(" ");
      }
    }

    setRescheduleData({
      type,
      appointmentId,
      patientName: item?.patientName || item?.name || "-",
      currentAppointment:
        item?.apt_on ||
        formatDisplayDateTime(
          item?.appointment_Date,
          item?.appointment_Time,
        ),
      appointment_Date: getDateInputValue(aptDate),
      appointment_Time: getTimeInputValue(aptDate, aptTime),
    });
    setOpenReschedule(true);
  };

  const openConfirmDialog = (appointmentId, item) => {
    let aptDate = item?.appointment_Date || "";
    let aptTime = item?.appointment_Time || "";

    if (!aptDate && item?.apt_on) {
      const parts = String(item.apt_on).trim().split(" ");
      if (parts[0] && parts[0].includes("/")) {
        const [d, m, y] = parts[0].split("/");
        aptDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      if (parts.length >= 2) {
        aptTime = parts.slice(1).join(" ");
      }
    }

    setConfirmData({
      appointmentId,
      patientName: item?.patientName || item?.name || "-",
      currentAppointment:
        item?.apt_on ||
        formatDisplayDateTime(
          item?.appointment_Date,
          item?.appointment_Time,
        ),
      appointment_Date: getDateInputValue(aptDate),
      appointment_Time: getTimeInputValue(aptDate, aptTime),
    });
    setOpenConfirm(true);
  };

  const handleCreateManagerChange = (managerName) => {
    if (!createData.hasPickDrop) return;
    setCreateSelectedManager(managerName);
    if (managerName === "NONE" || managerName === "None") {
      setCreateData((prev) => ({
        ...prev,
        hasDriver: false,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
        vehicle_no: "",
      }));
    } else if (managerName === "Ravi Kumar") {
      setCreateData((prev) => ({
        ...prev,
        hasDriver: true,
        pickup_manager_name: "Ravi Kumar",
        pickup_manager_phone: "9217993173, 7453 034 087",
        driver_name: "Ravi Kumar",
        driver_contact: "9217993173, 7453 034 087",
      }));
    } else if (managerName === "Shivam Kumar") {
      setCreateData((prev) => ({
        ...prev,
        hasDriver: true,
        pickup_manager_name: "Shivam Kumar",
        pickup_manager_phone: "88905 06958",
        driver_name: "Shivam Kumar",
        driver_contact: "88905 06958",
      }));
    } else {
      // Other / Custom Driver
      setCreateData((prev) => ({
        ...prev,
        hasDriver: true,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
      }));
    }
  };

  const handleToggleCreateNeedTransport = (checked) => {
    setCreateData((prev) => ({
      ...prev,
      needTransport: checked,
      hasPickDrop: checked,
      ...(!checked && {
        hasDriver: false,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
        vehicle_no: "",
      }),
    }));
    if (!checked) {
      setCreateSelectedManager("NONE");
    }
  };

  const handleToggleCreateHasDriver = (checked) => {
    if (!createData.hasPickDrop) return;
    setCreateData((prev) => ({
      ...prev,
      hasDriver: checked,
      ...(checked
        ? {
            pickup_manager_name: prev.pickup_manager_name || "Ravi Kumar",
            pickup_manager_phone: prev.pickup_manager_phone || "9217993173, 7453 034 087",
            driver_name: prev.driver_name || "Ravi Kumar",
            driver_contact: prev.driver_contact || "9217993173, 7453 034 087",
          }
        : {
            pickup_manager_name: "",
            pickup_manager_phone: "",
            driver_name: "",
            driver_contact: "",
            vehicle_no: "",
          }),
    }));
    if (checked) {
      if (createSelectedManager === "NONE" || createSelectedManager === "None") {
        setCreateSelectedManager("Ravi Kumar");
      }
    } else {
      setCreateSelectedManager("NONE");
    }
  };

  const resetCreateForm = () => {
    setCreateSelectedManager("NONE");
    setCreateData({
      patient: null,
      treatment_id: "",
      treatment_name: "",
      hospital_id: hospitalUser ? getHospitalId() : "",
      hospital_Name: "",
      hospital_email: "",
      appointment_Date: "",
      appointment_Time: "",
      appointment_Time_From: "",
      appointment_Time_To: "",
      note: "",
      mode: "offline",
      needTransport: false,
      hasPickDrop: false,
      pickup_time: "",
      pickup_location: "",
      pickup_location_type: "",
      drop_location: "",
      drop_location_type: "",
      drop_time: "",
      hasDriver: false,
      pickup_manager_name: "",
      pickup_manager_phone: "",
      driver_name: "",
      driver_contact: "",
      vehicle_no: "",
      pickDropStatus: "New",
    });
    setPatientTreatments([]);
  };

  const handleOpenCreate = () => {
    resetCreateForm();
    if (!hospitalList?.length) {
      getHospitalList();
    }
    if (!Treatment?.length) {
      dispatch(GetAllTreatment());
    }
    setOpenCreate(true);
  };

  const handleCloseCreate = () => {
    setOpenCreate(false);
    resetCreateForm();
  };

  const handleOpenCreateEnquiry = () => {
    if (!hospitalList?.length) {
      getHospitalList();
    }
    setCreateEnquiryData({
      enquiryId: "",
      patientId: "",
      enq_userName: "",
      enq_phoneNumber: "",
      enq_email: "",
      hospital_id: hospitalUser ? getHospitalId() : "",
      hospitalName: "",
      hospital_email: "",
      treatment_id: "",
      treatment_name: "",
      health_issue: "",
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
      hasDriver: true,
      pickup_manager_name: "Ravi Kumar",
      pickup_manager_phone: "9217993173, 7453 034 087",
      driver_name: "Ravi Kumar",
      driver_contact: "9217993173, 7453 034 087",
      vehicle_no: "",
      pickDropStatus: "New",
    });
    setCreateEnquiryImages([]);
    setOpenCreateEnquiry(true);
  };

  const handleCloseCreateEnquiry = () => {
    setOpenCreateEnquiry(false);
    setCreateEnquiryImages([]);
  };

  const handleCreateEnquirySubmit = async () => {
    if (!createEnquiryData.appointment_Date) {
      return Swal.fire("Error", "Please select appointment date", "error");
    }
    if (!createEnquiryData.appointment_Time) {
      return Swal.fire("Error", "Please select appointment time", "error");
    }

    setCreateEnquirySubmitting(true);
    try {
      const formData = new FormData();
      if (createEnquiryData.enquiryId) formData.append("enquiryId", createEnquiryData.enquiryId);
      if (createEnquiryData.patientId) formData.append("patientId", createEnquiryData.patientId);
      if (createEnquiryData.enq_userName) formData.append("enq_userName", createEnquiryData.enq_userName);
      if (createEnquiryData.enq_phoneNumber) formData.append("enq_phoneNumber", createEnquiryData.enq_phoneNumber);
      if (createEnquiryData.enq_email) formData.append("enq_email", createEnquiryData.enq_email);
      if (createEnquiryData.hospital_id) formData.append("hospital_id", createEnquiryData.hospital_id);
      if (createEnquiryData.hospitalName) formData.append("hospitalName", createEnquiryData.hospitalName);
      if (createEnquiryData.hospital_email) formData.append("hospital_email", createEnquiryData.hospital_email);
      if (createEnquiryData.treatment_id) formData.append("treatment_id", createEnquiryData.treatment_id);
      if (createEnquiryData.treatment_name) formData.append("treatment_name", createEnquiryData.treatment_name);
      if (createEnquiryData.health_issue) formData.append("health_issue", createEnquiryData.health_issue);
      const createNote = (createEnquiryData.Notes || "").trim();
      if (createNote && !isAutoAppointmentNote(createNote)) {
        formData.append("Notes", createNote);
        formData.append("discussionNotes", createNote);
      }
      formData.append("appointment_Date", String(createEnquiryData.appointment_Date).split("T")[0]);
      formData.append("appointment_Time", formatTime12Hour(createEnquiryData.appointment_Time));
      formData.append("mode", createEnquiryData.mode || "offline");

      const isEnquiryDriverAssigned = Boolean(
        createEnquiryData.mode !== "online" &&
        createEnquiryData.needTransport &&
        createEnquiryData.hasDriver !== false &&
        createEnquiryData.pickup_manager_name &&
        createEnquiryData.pickup_manager_name !== "NONE" &&
        createEnquiryData.pickup_manager_name !== "None"
      );
      formData.append("hasDriver", isEnquiryDriverAssigned ? "true" : "false");
      formData.append("needDriver", isEnquiryDriverAssigned ? "true" : "false");
      formData.append("driverAssigned", isEnquiryDriverAssigned ? "true" : "false");

      if (createEnquiryData.mode !== "online" && createEnquiryData.needTransport) {
        if (createEnquiryData.pickup_time) formData.append("pickup_time", createEnquiryData.pickup_time);
        if (createEnquiryData.pickup_location) formData.append("pickup_location", createEnquiryData.pickup_location);
        if (createEnquiryData.pickup_location_type) formData.append("pickup_location_type", createEnquiryData.pickup_location_type);
        if (createEnquiryData.drop_location) formData.append("drop_location", createEnquiryData.drop_location);
        if (createEnquiryData.drop_location_type) formData.append("drop_location_type", createEnquiryData.drop_location_type);
        if (createEnquiryData.drop_time) formData.append("drop_time", createEnquiryData.drop_time);
        if (isEnquiryDriverAssigned) {
          if (createEnquiryData.pickup_manager_name) formData.append("pickup_manager_name", createEnquiryData.pickup_manager_name);
          if (createEnquiryData.pickup_manager_phone) formData.append("pickup_manager_phone", createEnquiryData.pickup_manager_phone);
          if (createEnquiryData.driver_name) formData.append("driver_name", createEnquiryData.driver_name);
          if (createEnquiryData.driver_contact) formData.append("driver_contact", createEnquiryData.driver_contact);
          if (createEnquiryData.vehicle_no) formData.append("vehicle_no", createEnquiryData.vehicle_no);
        } else {
          formData.append("pickup_manager_name", "");
          formData.append("driver_name", "");
          formData.append("driver_contact", "");
          formData.append("vehicle_no", "");
        }
        if (createEnquiryData.pickDropStatus) formData.append("pickDropStatus", createEnquiryData.pickDropStatus);
      } else {
        formData.append("pickup_manager_name", "");
        formData.append("driver_name", "");
        formData.append("driver_contact", "");
        formData.append("vehicle_no", "");
      }

      createEnquiryImages.forEach((file) => {
        formData.append("reports", file);
      });

      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("_id") || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(
        `${baseurl}create_enquiry_appointment/${userId}`,
        formData,
        { headers }
      );

      if (res.data?.success || res.status === 200 || res.status === 201) {
        Swal.fire("Success", res.data?.message || "Appointment Created Successfully", "success");
        setOpenCreateEnquiry(false);
        setCreateEnquiryImages([]);
        getEnquiryAppointments();
      } else {
        Swal.fire("Error", res.data?.message || "Failed to create appointment", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "Failed to create appointment",
        "error"
      );
    } finally {
      setCreateEnquirySubmitting(false);
    }
  };

  const fetchPatientTreatments = async (patientId) => {
    if (!patientId) {
      setPatientTreatments([]);
      return;
    }
    try {
      const response = await axios.get(`${baseurl}get_patient/${patientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      const treatments =
        response?.data?.detail?.treatments ||
        response?.data?.detail?.treatment ||
        response?.data?.treatments ||
        [];
      setPatientTreatments(Array.isArray(treatments) ? treatments : []);
    } catch (err) {
      console.error("Error fetching patient treatments:", err);
      setPatientTreatments([]);
      toast.error("Failed to load patient treatments");
    }
  };

  const createTreatmentOptions = React.useMemo(() => {
    const list = [];
    const seenIds = new Set();
    const seenNames = new Set();

    if (Array.isArray(patientTreatments) && patientTreatments.length > 0) {
      patientTreatments.forEach((pt) => {
        const id = pt.treatment_id || pt.id || pt._id;
        const name = pt.treatment_name || pt.name || pt.disease_name;
        if (name) {
          const keyName = String(name).trim().toLowerCase();
          seenNames.add(keyName);
          if (id) seenIds.add(String(id));
          list.push({
            id: id || name,
            name: `${name} (Patient Enrolled)`,
            rawName: name,
          });
        }
      });
    }

    if (Array.isArray(Treatment)) {
      Treatment.forEach((t) => {
        const id = t.id || t._id;
        const name = t.name || t.treatment_name;
        if (name) {
          const keyName = String(name).trim().toLowerCase();
          const keyId = id ? String(id) : null;
          if (!seenNames.has(keyName) && (!keyId || !seenIds.has(keyId))) {
            if (keyId) seenIds.add(keyId);
            seenNames.add(keyName);
            list.push({
              id: id || name,
              name: name,
              rawName: name,
            });
          }
        }
      });
    }

    return list;
  }, [patientTreatments, Treatment]);

  const handleCreateSubmit = async () => {
    const {
      patient,
      treatment_id,
      hospital_id,
      hospital_Name,
      hospital_email,
      appointment_Date,
      appointment_Time,
      appointment_Time_From,
      appointment_Time_To,
      note,
      mode,
    } = createData;

    const patientId = patient?.patientId || "";
    const resolvedHospitalId = hospitalUser
      ? getHospitalId() || hospital_id
      : hospital_id;

    if (!patientId) {
      return Swal.fire("Error", "Please select a patient", "error");
    }
    if (!resolvedHospitalId && !hospital_Name) {
      return Swal.fire("Error", "Please select a hospital", "error");
    }
    if (!appointment_Date) {
      return Swal.fire("Error", "Please select appointment date", "error");
    }

    let finalTime = "";
    if (appointment_Time_From && appointment_Time_To) {
      finalTime = `${formatTime12Hour(appointment_Time_From)} to ${formatTime12Hour(appointment_Time_To)}`;
    } else if (appointment_Time_From) {
      finalTime = formatTime12Hour(appointment_Time_From);
    } else if (appointment_Time) {
      finalTime = formatTime12Hour(appointment_Time);
    }

    if (!finalTime) {
      return Swal.fire("Error", "Please select appointment time range", "error");
    }
    if (mode === "offline" && Boolean(createData.hasPickDrop ?? createData.needTransport)) {
      if (!createData.pickup_location?.trim()) {
        return Swal.fire("Error", "Please enter Pickup Location", "error");
      }
      if (!createData.drop_location?.trim()) {
        return Swal.fire("Error", "Please enter Drop Location", "error");
      }
    }
    if (createSubmitting) return;

    const isTransportNeeded = Boolean(
      mode === "offline" && (createData.hasPickDrop ?? createData.needTransport)
    );
    const isDriverAssigned = Boolean(
      isTransportNeeded &&
      createData.hasDriver &&
      createSelectedManager !== "NONE" &&
      createSelectedManager !== "None"
    );

    setCreateSubmitting(true);
    try {
      const appointmentPayload = {
        patientId,
        patient_id: patientId,
        hospital_id: resolvedHospitalId,
        hospitalId: resolvedHospitalId,
        hospital_Name: hospital_Name || undefined,
        hospital_email: hospital_email || undefined,
        treatment_id: treatment_id || undefined,
        treatment_name: createData.treatment_name || undefined,
        treatment: createData.treatment_name || undefined,
        note: (note || "").trim(),
        mode,
        appointment_Date,
        appointment_Time: finalTime,
        hasPickDrop: isTransportNeeded,
        hasDriver: isDriverAssigned,
        needPickDrop: isTransportNeeded,
        pickDropRequired: isTransportNeeded,
        isPickDropNeeded: isTransportNeeded,
        needTransport: isTransportNeeded,
        needDriver: isDriverAssigned,
        driverAssigned: isDriverAssigned,
      };

      if (isTransportNeeded) {
        if (createData.pickup_time) appointmentPayload.pickup_time = createData.pickup_time;
        if (createData.pickup_location) appointmentPayload.pickup_location = createData.pickup_location.trim();
        if (createData.pickup_location_type) appointmentPayload.pickup_location_type = createData.pickup_location_type;
        if (createData.drop_location) appointmentPayload.drop_location = createData.drop_location.trim();
        if (createData.drop_location_type) appointmentPayload.drop_location_type = createData.drop_location_type;
        if (createData.drop_time) appointmentPayload.drop_time = createData.drop_time;
        appointmentPayload.pickDropStatus = createData.pickDropStatus || "New";

        if (isDriverAssigned) {
          appointmentPayload.pickup_manager_name =
            createData.pickup_manager_name ||
            (createSelectedManager !== "Other" ? createSelectedManager : "") ||
            "Ravi Kumar";
          appointmentPayload.pickup_manager_phone =
            createData.pickup_manager_phone || "9217993173, 7453 034 087";
          appointmentPayload.driver_name =
            createData.driver_name ||
            createData.pickup_manager_name ||
            (createSelectedManager !== "Other" ? createSelectedManager : "") ||
            "Ravi Kumar";
          appointmentPayload.driver_contact =
            createData.driver_contact ||
            createData.pickup_manager_phone ||
            "9217993173, 7453 034 087";
          if (createData.vehicle_no) appointmentPayload.vehicle_no = createData.vehicle_no;
        } else {
          appointmentPayload.pickup_manager_name = null;
          appointmentPayload.driver_name = null;
          appointmentPayload.driver_contact = null;
          appointmentPayload.vehicle_no = null;
        }
      }

      await dispatch(
        AppointmentForPatient(appointmentPayload)
      ).unwrap();

      Swal.fire("Success!", "Appointment created successfully!", "success");
      handleCloseCreate();
      await getAppointments();
    } catch (err) {
      Swal.fire(
        "Error!",
        err?.message ||
          (Array.isArray(err) ? err.join(", ") : null) ||
          "Failed to create appointment",
        "error",
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    const { type, appointmentId, appointment_Date, appointment_Time } =
      rescheduleData;

    if (!appointment_Date) {
      return Swal.fire("Error", "Please select appointment date", "error");
    }
    if (!appointment_Time) {
      return Swal.fire("Error", "Please select appointment time", "error");
    }
    if (rescheduleSubmitting) return;

    setRescheduleSubmitting(true);
    try {
      const formattedTime = formatTime12Hour(appointment_Time);

      if (type === "app") {
        try {
          const response = await axios.post(
            `${AdminBaseUrl}update_user_request_status`,
            {
              id: appointmentId,
              model: "Patientcontact",
              status: 5,
              apt_date: appointment_Date,
              apt_time: formattedTime,
            },
          );

          if (
            response.data?.success === false ||
            response.data?.success === "false" ||
            response.data?.status === false
          ) {
            throw new Error(
              response.data?.message || "Failed to reschedule appointment",
            );
          }

          setDataApp((prev) =>
            prev.map((appItem) =>
              appItem.id === appointmentId || appItem._id === appointmentId
                ? {
                    ...appItem,
                    status: "5",
                    apt_on: `${formatDisplayDate(appointment_Date)} ${formattedTime}`,
                  }
                : appItem,
            ),
          );
          setSearchDataApp((prev) =>
            prev.map((appItem) =>
              appItem.id === appointmentId || appItem._id === appointmentId
                ? {
                    ...appItem,
                    status: "5",
                    apt_on: `${formatDisplayDate(appointment_Date)} ${formattedTime}`,
                  }
                : appItem,
            ),
          );

          Swal.fire(
            "Success!",
            response.data?.message || "Appointment rescheduled successfully!",
            "success",
          );
          setOpenReschedule(false);
          getAppFromApp();
        } catch (apiErr) {
          console.error("Reschedule app appointment API error:", apiErr);
          const errMsg =
            apiErr.response?.data?.message ||
            apiErr.message ||
            "Failed to reschedule appointment";
          Swal.fire("Error!", errMsg, "error");
          toast.error(errMsg);
          getAppFromApp();
        }
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authorization token is missing");
      }

      const payload =
        type === "treatment"
          ? {
              status: 5,
              appointment_Date,
              appointment_Time: formattedTime,
            }
          : {
              status: "Reschedule",
              appointment_Date,
              appointment_Time: formattedTime,
            };

      const endpoint =
        type === "treatment"
          ? `${baseurl}update_appointment_status/${appointmentId}`
          : `${baseurl}update_enqAppointment_status/${appointmentId}`;

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200 || response.status === 201) {
        Swal.fire("Success!", "Appointment rescheduled successfully!", "success");
        setOpenReschedule(false);
        if (type === "treatment") {
          await getAppointments();
        } else {
          getEnquiryAppointments();
        }
      } else {
        throw new Error("Failed to reschedule appointment. Please try again!");
      }
    } catch (err) {
      console.error("Reschedule Error:", err);
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else if (err.message) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again!");
      }
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    const { appointmentId, appointment_Date, appointment_Time } = confirmData;

    if (!appointment_Date) {
      return Swal.fire("Error", "Please select appointment date", "error");
    }
    if (!appointment_Time) {
      return Swal.fire("Error", "Please select exact appointment time", "error");
    }
    if (confirmSubmitting) return;

    setConfirmSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authorization token is missing");
      }

      const formattedTime = formatTime12Hour(appointment_Time);
      const payload = {
        status: 6,
        appointment_Date,
        appointment_Time: formattedTime,
      };

      const response = await axios.post(
        `${baseurl}update_appointment_status/${appointmentId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        Swal.fire("Success!", "Appointment confirmed successfully!", "success");
        setOpenConfirm(false);
        await getAppointments();
      } else {
        throw new Error("Failed to confirm appointment. Please try again!");
      }
    } catch (err) {
      console.error("Confirm Appointment Error:", err);
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else if (err.message) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again!");
      }
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    const {
      appointmentId,
      cancel_reason_id,
      cancel_note,
    } = cancelData;

    if (!cancel_reason_id) {
      return Swal.fire("Error", "Please select a cancellation reason", "error");
    }
    if (cancelSubmitting) return;

    setCancelSubmitting(true);
    try {
      const response = await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        {
          id: appointmentId,
          model: "Patientcontact",
          status: 3,
          cancel_reason_id: cancel_reason_id,
          cancel_note: cancel_note ? cancel_note.trim() : "",
        }
      );

      if (
        response.data?.success === false ||
        response.data?.success === "false" ||
        response.data?.status === false
      ) {
        throw new Error(
          response.data?.message || "Failed to cancel appointment"
        );
      }

      setDataApp((prev) =>
        prev.map((appItem) =>
          appItem.id === appointmentId || appItem._id === appointmentId
            ? { ...appItem, status: "3" }
            : appItem
        )
      );
      setSearchDataApp((prev) =>
        prev.map((appItem) =>
          appItem.id === appointmentId || appItem._id === appointmentId
            ? { ...appItem, status: "3" }
            : appItem
        )
      );

      Swal.fire(
        "Success!",
        response.data?.message || "Appointment cancelled successfully!",
        "success"
      );
      setOpenCancel(false);
      getAppFromApp();
    } catch (err) {
      console.error("Cancel appointment error:", err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to cancel appointment";
      Swal.fire("Error!", errMsg, "error");
      toast.error(errMsg);
      getAppFromApp();
    } finally {
      setCancelSubmitting(false);
    }
  };

  const markAppointmentAction = (item, fallbackId) => {
    const recordId =
      item?.appointmentId || item?.enquiryId || item?.id || item?._id || fallbackId;
    if (!recordId) return;
    markRecordRead("appointments", recordId);
    const keys = ["appointmentId", "enquiryId", "id", "_id"];
    setAppointments((prev) => clearUnreadById(prev, recordId, keys));
    setDataApp((prev) => clearUnreadById(prev, recordId, keys));
    setEnquiryAppointments((prev) => clearUnreadById(prev, recordId, keys));
  };

  const handleAppStatusChange = async (e, appointmentId, item) => {
    markAppointmentAction(item, appointmentId);
    const rawValue = e.target.value;
    const apiStatus = getAppStatusApiValue(rawValue);

    if (
      rawValue === "5" ||
      rawValue === 5 ||
      apiStatus === 5 ||
      apiStatus === "Reschedule" ||
      apiStatus === "Rescheduled"
    ) {
      openRescheduleDialog("app", appointmentId, item);
      return;
    }

    if (
      rawValue === "3" ||
      rawValue === 3 ||
      apiStatus === 3 ||
      apiStatus === "Cancelled" ||
      apiStatus === "Cancel" ||
      apiStatus === "cancel"
    ) {
      openCancelDialog(appointmentId, item);
      return;
    }

    try {
      const response = await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        {
          id: appointmentId,
          model: "Patientcontact",
          status: apiStatus,
        },
      );

      if (
        response.data?.success === false ||
        response.data?.success === "false" ||
        response.data?.status === false
      ) {
        throw new Error(
          response.data?.message || "Failed to update status",
        );
      }

      setDataApp((prev) =>
        prev.map((appItem) =>
          appItem.id === appointmentId || appItem._id === appointmentId
            ? { ...appItem, status: rawValue }
            : appItem,
        ),
      );
      setSearchDataApp((prev) =>
        prev.map((appItem) =>
          appItem.id === appointmentId || appItem._id === appointmentId
            ? { ...appItem, status: rawValue }
            : appItem,
        ),
      );

      Swal.fire(
        "Success!",
        response.data?.message || "Status updated successfully!",
        "success",
      );
      getAppFromApp();
    } catch (err) {
      console.error("App status update error:", err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to update status";
      Swal.fire("Error!", errMsg, "error");
      toast.error(errMsg);
      getAppFromApp();
    }
  };

  const handleChange = async (e, i, item) => {
    markAppointmentAction(item, i);
    const statusValue = parseInt(e.target.value, 10);
    if (statusValue === 5) {
      openRescheduleDialog("treatment", i, item);
      return;
    }
    if (statusValue === 6) {
      openConfirmDialog(i, item);
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Authorization token is missing");
      }
      const response = await axios.post(
        `${baseurl}update_appointment_status/${i}`,
        { status: statusValue },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.status === 200 || response.status === 201) {
        Swal.fire("Success!", "Status updated successfully!", "success");
        try {
          await getAppointments(); // make sure it's awaited if it’s async
        } catch (refreshError) {
          console.error("Error refreshing appointments:", refreshError);
          toast.error("Failed to refresh appointments!");
        }
        return response.data;
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

  const getEnquiryAppointments = async () => {
    setLoadingENQ(true);
    try {
      const params = {};
      if (isInsuranceUser()) {
        const insId = getInsuranceId();
        if (insId) params.insurance_id = insId;
      } else if (isReferralUser()) {
        const refId = getReferralId();
        if (refId) params.referral_id = refId;
      }
      const response = await axios.get(`${baseurl}get_enquiry_appointments`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.status === 200) {
        const enqData = response.data.data || [];
        setEnquiryAppointments(enqData);
        setSearchDataEnq(enqData);
      }
    } catch (error) {
      console.log("Error fetching enquiry appointments:", error);
    } finally {
      setLoadingENQ(false);
    }
  };
  const getAppointments = (pageNum = page, searchQuery = filterValue) => {
    setLoadingCRM(true);
    const params = {
      page: pageNum + 1,
      limit: 10,
    };
    const query = typeof searchQuery === "string" ? searchQuery.trim() : "";
    if (query) {
      params.search = query;
    }
    if (isInsuranceUser()) {
      const insId = getInsuranceId();
      if (insId) params.insurance_id = insId;
    } else if (isReferralUser()) {
      const refId = getReferralId();
      if (refId) params.referral_id = refId;
    }
    const endpoint = isInsuranceUser() ? `${baseurl}insurance/appointments` : `${baseurl}all_appointment`;
    const fallbackEndpoint = `${baseurl}all_appointment`;
    return axios
      .get(endpoint, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      })
      .catch((err) => {
        if (isInsuranceUser() && endpoint !== fallbackEndpoint) {
          return axios.get(fallbackEndpoint, {
            params,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
          });
        }
        throw err;
      })
      .then((response) => {
        console.log(response.data);
        if (response.status === 200) {
          const list = response.data.data || [];
          setAppointments(list);
          setSearchApiData(list);
          const total =
            response.data.totalRecords ??
            response.data.total ??
            response.data.pagination?.total ??
            response.data.pagination?.totalRecords ??
            list.length;
          setAppointmentTotalRecords(Number(total) || 0);

          const pages =
            response.data.totalPages ??
            response.data.pagination?.totalPages ??
            Math.ceil((Number(total) || 0) / 10);
          setAppointmentTotalPages(Math.max(1, Number(pages) || 1));

          const serverPage =
            response.data.currentPage ??
            response.data.page ??
            response.data.pagination?.currentPage ??
            response.data.pagination?.page;
          if (serverPage !== undefined && serverPage !== null) {
            setPage(Number(serverPage) - 1);
          }
        } else {
          console.error("Failed to fetch appointments:", response.data.message);
        }
      })
      .catch((error) => {
        console.error("Error fetching appointments:", error);
      })
      .finally(() => {
        setLoadingCRM(false);
      });
  };
  useEffect(() => {
    getAppointments();
    getEnquiryAppointments();
    getAppFromApp();
    dispatch(GetAllTreatment());
    getHospitalList(); // 👈 ye missing tha
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);
  const handleFilter = (event) => {
    const rawVal = event.target.value;
    const value = rawVal.toLowerCase();
    setFilterValue(rawVal);
    setPage(0); // ⭐ IMPORTANT
    setPageAPP(0);
    setPageENQ(0);

    // Tab 0: CRM Appointments server-side debounced search
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    searchDebounceTimerRef.current = setTimeout(() => {
      getAppointments(0, rawVal);
    }, 350);

    if (value === "") {
      setDataApp(searchDataApp);
      setEnquiryAppointments(searchDataEnq);
      return;
    }

    // Tabs 1 & 2 client-side filtering

    const filterResultAPP = searchDataApp.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const email = item.email?.toLowerCase() || "";
      const city = item.city?.toLowerCase() || "";
      const health_issue = item.health_issue?.toLowerCase() || "";
      const doctor = item.doctor?.toLowerCase() || "";
      const treatment = item.treatment?.toLowerCase() || "";
      const apt_on = item.apt_on?.toLowerCase() || "";
      const statusRaw = String(item.status || item.appointement_status || "").toLowerCase();
      const statusLabel = getAppAppointmentStatusLabel(item.status || item.appointement_status).toLowerCase();

      return (
        name.includes(value) ||
        email.includes(value) ||
        city.includes(value) ||
        health_issue.includes(value) ||
        doctor.includes(value) ||
        treatment.includes(value) ||
        apt_on.includes(value) ||
        statusRaw.includes(value) ||
        statusLabel.includes(value)
      );
    });
    setDataApp(filterResultAPP);

    const filterResultENQ = searchDataEnq.filter((item) => {
      const patientName = item.patientName?.toLowerCase() || "";
      const health_issue = item.health_issue?.toLowerCase() || "";
      const treatment_name = item.treatment_name?.toLowerCase() || "";
      const status = item.status?.toLowerCase() || "";

      return (
        patientName.includes(value) ||
        health_issue.includes(value) ||
        treatment_name.includes(value) ||
        status.includes(value)
      );
    });
    setEnquiryAppointments(filterResultENQ);
  };
  const getHospitalList = async () => {
    try {
      const res = await axios.post(`${AdminBaseUrl}hospital_list`);
      if (res.status === 200) {
        setHospitalList(res.data.data);
      }
    } catch (err) {
      console.log("Hospital list error:", err);
    }
  };
  const handleClearFilter = () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    setFilterValue("");
    setPage(0);
    setPageAPP(0);
    setPageENQ(0);
    getAppointments(0, "");
    setDataApp(searchDataApp);
    setEnquiryAppointments(searchDataEnq);
  };
  const handleTabChange = (_, newVal) => {
    setTabValue(newVal);

    if (newVal === 0) setPage(0);
    else if (newVal === 1) setPageAPP(0);
    else if (newVal === 2) setPageENQ(0); // ✅ NEW
  };
  const handleDelete = async (item) => {
    markAppointmentAction(item);
    try {
      const confirm = await Swal.fire({
        title: "Are you sure?",
        text: "You want to delete this appointment!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6e7881",
        confirmButtonText: "Yes, delete it!",
      });
      if (!confirm.isConfirmed) return;
      const response = await axios.post(
        `${baseurl}delete_enqAppointment/${item._id}`,
      );
      if (response.status === 200 || response.status === 201) {
        Swal.fire("Deleted!", "Appointment deleted successfully.", "success");

        // 🔁 refresh list after delete
        getEnquiryAppointments();
      } else {
        Swal.fire("Error!", "Failed to delete appointment.", "error");
      }
    } catch (error) {
      console.log(error);
      Swal.fire("Error!", "Something went wrong.", "error");
    }
  };
  const handleEdit = (item) => {
    console.log("handleEdit item:", item);
    const appointmentId = item.appointmentId || item._id || item.id || "";

    // Resolve hospital matching against hospitalList
    let foundHospital = null;
    const rawHospId = item.hospital_id ?? item.Hospital_id ?? item.hospitalId ?? "";
    const rawHospName = item.Hospital_name ?? item.hospitalName ?? item.hospital_name ?? "";
    if (rawHospId && hospitalList?.length) {
      foundHospital = hospitalList.find(
        (h) => String(h.id ?? h.hospital_id) === String(rawHospId)
      );
    }
    if (!foundHospital && rawHospName && hospitalList?.length) {
      foundHospital = hospitalList.find(
        (h) =>
          (h.name && h.name.toLowerCase() === rawHospName.toLowerCase()) ||
          (h.hospital_Name && h.hospital_Name.toLowerCase() === rawHospName.toLowerCase())
      );
    }
    const resolvedHospitalId = foundHospital
      ? (foundHospital.id ?? foundHospital.hospital_id)
      : rawHospId;
    const resolvedHospitalName = foundHospital
      ? (foundHospital.name ?? foundHospital.hospital_Name)
      : rawHospName;

    // Resolve treatment matching against Treatment slice
    const rawTrId = item.treatment_id ?? item.treatmentId ?? "";
    const rawTrName = item.treatment_name ?? item.treatment ?? item.disease_name ?? "";
    let foundTr = null;
    if (rawTrId && Treatment?.length) {
      foundTr = Treatment.find((t) => String(t.id) === String(rawTrId));
    }
    if (!foundTr && rawTrName && Treatment?.length) {
      foundTr = Treatment.find(
        (t) => t.name && t.name.toLowerCase() === rawTrName.toLowerCase()
      );
    }
    const resolvedTreatmentId = foundTr ? foundTr.id : rawTrId;
    const resolvedTreatmentName = foundTr ? foundTr.name : rawTrName;

    // Resolve Date & Time
    let rawDate = item.appointment_Date || "";
    let rawTime = item.appointment_Time || "";
    if (item.apt_on) {
      const parsedApt = parseAptOn(item.apt_on);
      if (!rawDate && parsedApt.date) rawDate = parsedApt.date;
      if (!rawTime && parsedApt.time) rawTime = parsedApt.time;
    }
    const resolvedDate = getDateInputValue(rawDate || item.appointment_Date || item.apt_on);
    const timeRange = parseAppointmentTimeRange(rawTime);

    // Resolve Mode (Online / Offline)
    const detectedMode =
      item.mode ||
      (item.apt_type && /video|online/i.test(item.apt_type) ? "online" : "offline");

    // Transport / Pick & Drop
    const hasPickDrop = Boolean(
      item.hasPickDrop !== undefined && item.hasPickDrop !== null
        ? item.hasPickDrop
        : item.needTransport !== undefined && item.needTransport !== null
        ? item.needTransport
        : (item.pickup_location ||
          item.drop_location ||
          item.pickup_time ||
          item.drop_time ||
          item.vehicle_no ||
          (item.pickup_manager_name && item.pickup_manager_name !== "Ravi Kumar"))
    );
    const hasDriver = Boolean(
      hasPickDrop &&
      (item.hasDriver !== undefined && item.hasDriver !== null
        ? item.hasDriver
        : Boolean(item.driver_name || item.vehicle_no || (item.pickup_manager_name && item.pickup_manager_name !== "NONE")))
    );

    const rawNotes = (item.discussionNotes || item.Notes || item.notes || "").trim();
    const resolvedNotes = isAutoAppointmentNote(rawNotes) ? "" : rawNotes;

    const resolvedPatientName =
      item.patientName || item.patient_name || item.name || "";
    const resolvedPatientId =
      item.patientId || item.patient_id || item.omca_id || item.omca_patient_id || "";

    const isApp = Boolean(
      item.apt_type ||
      item.home_visit_address !== undefined ||
      dataApp?.some((a) => String(a.id) === String(appointmentId))
    );

    setEditData({
      ...item,
      source: isApp ? "app" : item.source || "crm",
      appointmentId,
      _id: item._id || appointmentId,
      id: item.id || appointmentId,
      patientName: resolvedPatientName,
      patient_name: resolvedPatientName,
      name: resolvedPatientName,
      patientId: resolvedPatientId,
      patient_id: resolvedPatientId,
      hospital_id: resolvedHospitalId,
      hospitalName: resolvedHospitalName,
      treatment_id: resolvedTreatmentId,
      treatment_name: resolvedTreatmentName,
      health_issue: item.health_issue || item.disease_name || item.treatment || "",
      discussionNotes: resolvedNotes,
      Notes: resolvedNotes,
      appointment_Date: resolvedDate,
      appointment_Time: rawTime,
      appointment_Time_From: timeRange.from,
      appointment_Time_To: timeRange.to,
      mode: detectedMode,
      hasPickDrop,
      hasDriver,
      needTransport: hasPickDrop,
      pickup_time: item.pickup_time || "",
      pickup_location: item.pickup_location || "",
      pickup_location_type: item.pickup_location_type || "",
      drop_location: item.drop_location || resolvedHospitalName || "",
      drop_location_type: item.drop_location_type || "",
      drop_time: item.drop_time || "",
      pickup_manager_name:
        item.pickup_manager_name || item.driver_name || "Ravi Kumar",
      pickup_manager_phone:
        item.pickup_manager_phone ||
        item.driver_contact ||
        "9217993173, 7453 034 087",
      driver_name:
        item.driver_name || item.pickup_manager_name || "Ravi Kumar",
      driver_contact:
        item.driver_contact ||
        item.pickup_manager_phone ||
        "9217993173, 7453 034 087",
      vehicle_no: item.vehicle_no || "",
      pickDropStatus: item.pickDropStatus || "New",
    });
    setOpenEdit(true);
    markAppointmentAction(item);
  };

  const handleSampleFile = () => {
    fetch(`${baseurl}export_appointments`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = ""; // Let browser use filename from API
        a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  const handleViewEnq = (item) => {
    setSelectedEnq(item);
    setOpenViewEnq(true);
    markAppointmentAction(item);
  };

  const handleCloseViewEnq = () => {
    setOpenViewEnq(false);
  };
  const downloadPdf = async () => {
    const maxRows = appointments.length || 1;
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
  const getAppFromApp = async () => {
    setLoadingAPP(true);
    try {
      const response = await axios.post(`${AdminBaseUrl}app_appointments`);
      console.log(response.data.data);
      const appData = response.data.data || [];
      setDataApp(appData);
      setSearchDataApp(appData);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingAPP(false);
    }
  };
  const handleView = (record) => {
    setSelectedRecord(record);
    setOpen(true);
    markAppointmentAction(record);
  };
  const handleClose = () => setOpen(false);
  const InfoItem = ({ label, value }) => (
    <div className="">
      <h6>{label}</h6>
      <p>{value || "-"}</p>
    </div>
  );
  const sortData = (data, field, direction) => {
    return [...data].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];
      if (field === "appointment_Date" || field === "apt_on") {
        return direction === "asc"
          ? new Date(valA) - new Date(valB)
          : new Date(valB) - new Date(valA);
      }
      if (field === "paid_amount") {
        return direction === "asc"
          ? Number(valA) - Number(valB)
          : Number(valB) - Number(valA);
      }
      if (typeof valA === "string") {
        return direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return 0;
    });
  };
  const handleUpdate = async () => {
    try {
      // ✅ Validation
      if (!editData.appointment_Date) {
        return Swal.fire("Error", "Appointment Date is required", "error");
      }

      const finalTime =
        formatTimeRange(
          editData.appointment_Time_From,
          editData.appointment_Time_To
        ) ||
        formatTime12Hour(editData.appointment_Time) ||
        "";

      if (!finalTime) {
        return Swal.fire("Error", "Appointment Time is required", "error");
      }

      const noteText = (editData.discussionNotes || editData.Notes || "").trim();

      const appointmentId = editData.appointmentId || editData._id || editData.id;
      if (!appointmentId) {
        return Swal.fire("Error", "Appointment ID is required", "error");
      }

      setUpdateSubmitting(true);

      const isAppAppointment =
        editData.source === "app" ||
        dataApp?.some(
          (a) => String(a.id) === String(appointmentId) || String(a._id) === String(appointmentId)
        );

      let appUpdateSuccess = false;
      if (isAppAppointment) {
        try {
          const appRes = await axios.post(`${AdminBaseUrl}update_user_request_status`, {
            id: appointmentId,
            model: "Patientcontact",
            apt_date: String(editData.appointment_Date).split("T")[0],
            apt_time: finalTime,
          });
          if (appRes.data?.success !== false) {
            appUpdateSuccess = true;
          }
        } catch (appErr) {
          console.warn("Could not update app appointment status via CRM endpoint:", appErr);
        }
      }

      // ✅ API Call
      const formData = new FormData();
      formData.append("appointmentId", appointmentId);
      if (editData.hospital_id) formData.append("hospital_id", editData.hospital_id);
      if (editData.hospitalName) formData.append("hospitalName", editData.hospitalName);
      if (editData.treatment_id) formData.append("treatment_id", editData.treatment_id);
      if (editData.treatment_name) formData.append("treatment_name", editData.treatment_name);
      if (editData.health_issue) formData.append("health_issue", editData.health_issue);
      if (noteText && !isAutoAppointmentNote(noteText)) {
        formData.append("discussionNotes", noteText);
        formData.append("Notes", noteText);
      }
      formData.append(
        "appointment_Date",
        String(editData.appointment_Date).split("T")[0]
      );
      formData.append("appointment_Time", finalTime);
      formData.append("mode", editData.mode || "offline");

      const isEditDriverAssigned = Boolean(
        editData.mode !== "online" &&
        editData.needTransport &&
        editData.hasDriver !== false &&
        editData.pickup_manager_name &&
        editData.pickup_manager_name !== "NONE" &&
        editData.pickup_manager_name !== "None"
      );
      formData.append("hasPickDrop", editData.needTransport ? "true" : "false");
      formData.append("hasDriver", isEditDriverAssigned ? "true" : "false");
      formData.append("needDriver", isEditDriverAssigned ? "true" : "false");
      formData.append("driverAssigned", isEditDriverAssigned ? "true" : "false");

      if (editData.mode !== "online" && editData.needTransport) {
        if (editData.pickup_time) formData.append("pickup_time", editData.pickup_time);
        if (editData.pickup_location) formData.append("pickup_location", editData.pickup_location);
        if (editData.pickup_location_type)
          formData.append("pickup_location_type", editData.pickup_location_type);
        if (editData.drop_location) formData.append("drop_location", editData.drop_location);
        if (editData.drop_location_type)
          formData.append("drop_location_type", editData.drop_location_type);
        if (editData.drop_time) formData.append("drop_time", editData.drop_time);
        if (isEditDriverAssigned) {
          if (editData.pickup_manager_name)
            formData.append("pickup_manager_name", editData.pickup_manager_name);
          if (editData.pickup_manager_phone)
            formData.append("pickup_manager_phone", editData.pickup_manager_phone);
          if (editData.driver_name) formData.append("driver_name", editData.driver_name);
          if (editData.driver_contact) formData.append("driver_contact", editData.driver_contact);
          if (editData.vehicle_no) formData.append("vehicle_no", editData.vehicle_no);
        } else {
          formData.append("pickup_manager_name", "");
          formData.append("driver_name", "");
          formData.append("driver_contact", "");
          formData.append("vehicle_no", "");
        }
        if (editData.pickDropStatus) formData.append("pickDropStatus", editData.pickDropStatus);
      } else if (editData.mode === "online") {
        formData.append("pickDropStatus", "Cancelled");
      }



      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let crmSuccess = false;
      let crmMessage = "";
      try {
        const res = await axios.post(
          `${baseurl}update_enquiry_appointment/${encodeURIComponent(appointmentId)}`,
          formData,
          { headers }
        );
        if (res.data?.success || res.status === 200 || res.status === 201) {
          crmSuccess = true;
          crmMessage = res.data?.message || "Updated Successfully";
        }
      } catch (crmErr) {
        if (!isAppAppointment) throw crmErr;
      }

      if (crmSuccess || appUpdateSuccess || isAppAppointment) {
        Swal.fire("Success", crmMessage || "Appointment Updated Successfully", "success");
        setOpenEdit(false);
        getAppointments();
        getEnquiryAppointments();
        getAppFromApp();
      } else {
        Swal.fire("Error", "Update Failed. Please check the details and try again.", "error");
      }
    } catch (err) {
      console.log(err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "Update Failed",
        "error"
      );
    } finally {
      setUpdateSubmitting(false);
    }
  };
  const handleSortCRM = (field) => {
    const isAsc = orderByCRM === field && orderDirectionCRM === "asc";
    const direction = isAsc ? "desc" : "asc";

    setOrderByCRM(field);
    setOrderDirectionCRM(direction);

    const sorted = sortData(appointments, field, direction);
    setAppointments(sorted);
  };
  const handleSortAPP = (field) => {
    const isAsc = orderByAPP === field && orderDirectionAPP === "asc";
    const direction = isAsc ? "desc" : "asc";
    setOrderByAPP(field);
    setOrderDirectionAPP(direction);
    const sorted = sortData(dataApp, field, direction);
    setDataApp(sorted);
  };
  const handleSortENQ = (field) => {
    const isAsc = orderByENQ === field && orderDirectionENQ === "asc";
    const direction = isAsc ? "desc" : "asc";

    setOrderByENQ(field);
    setOrderDirectionENQ(direction);

    const sorted = sortData(enquiryAppointments, field, direction);
    setEnquiryAppointments(sorted);
  };

  const handleEnqStatusChange = async (e, appointmentId, item) => {
    markAppointmentAction(item, appointmentId);
    if (e.target.value === "Reschedule") {
      openRescheduleDialog("enquiry", appointmentId, item);
      return;
    }

    try {
      console.log(e.target.value);
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${baseurl}update_enqAppointment_status/${appointmentId}`,
        { status: e.target.value },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (res.status === 200 || res.status === 201) {
        Swal.fire("Success!", "Status updated successfully!", "success");

        // refresh data
        getEnquiryAppointments();
      }
    } catch (err) {
      console.log(err);
      toast.error("Failed to update status");
    }
  };
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3">
            <div className="col-md-12">
              <div className="topmainhd">
                <h6>Manage Appointments</h6>
              </div>
            </div>
            <div className="col-md-12">
              <div className="country-top appointment-country-top">
                <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
                  <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    TabIndicatorProps={{
                      style: {
                        display: "none",
                      },
                    }}
                    sx={{
                      minHeight: "40px",
                      width: "100%",
                      maxWidth: "100%",
                      "& .MuiTabs-scroller": {
                        overflowX: "auto !important",
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "none",
                        "&::-webkit-scrollbar": {
                          display: "none",
                        },
                      },
                      "& .MuiTabs-flexContainer": {
                        gap: "8px",
                        flexWrap: "nowrap",
                      },
                      "& .MuiTabs-scrollButtons": {
                        color: "#22c7b8",
                        width: "32px",
                        "&.Mui-disabled": {
                          opacity: 0.25,
                        },
                      },
                      "& .MuiTab-root": {
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      },
                    }}
                  >
                    <Tab
                      label="Appointments By CRM"
                      sx={{
                        textTransform: "none",
                        fontSize: "12px",
                        fontWeight: 500,
                        fontFamily: "Rubik",
                        padding: "8px 18px",
                        lineHeight: "22px",
                        border: "1px solid #ccc",
                        borderRadius: "5px",
                        color: "#666",
                        transition: "0.3s",
                        minHeight: "0px",
                        "&.Mui-selected": {
                          background: "#22c7b8",
                          color: "#fff",
                        },
                      }}
                    />

                    <Tab
                      label="Appointments By APP"
                      sx={{
                        textTransform: "none",
                        fontSize: "12px",
                        fontWeight: 500,
                        fontFamily: "Rubik",
                        padding: "8px 18px",
                        lineHeight: "22px",
                        border: "1px solid #ccc",
                        borderRadius: "5px",
                        color: "#666",
                        transition: "0.3s",
                        minHeight: "0px",
                        "&.Mui-selected": {
                          background: "#22c7b8",
                          color: "#fff",
                        },
                      }}
                    />

                    <Tab
                      label="Enquiry Appointments"
                      sx={{
                        textTransform: "none",
                        fontSize: "12px",
                        fontWeight: 500,
                        fontFamily: "Rubik",
                        padding: "8px 18px",
                        lineHeight: "22px",
                        border: "1px solid #ccc",
                        borderRadius: "5px",
                        color: "#666",
                        transition: "0.3s",
                        minHeight: "0px",
                        "&.Mui-selected": {
                          background: "#22c7b8",
                          color: "#fff",
                        },
                      }}
                    />
                  </Tabs>
                </Box>
                <div className="search-btn-main">
                  <div className="">
                    <TextField
                      className="field-count"
                      label="Search"
                      id="outlined-size-small"
                      size="small"
                      value={filterValue}
                      onChange={(e) => handleFilter(e)}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end" className="input-set">
                            {filterValue && (
                              <IconButton
                                onClick={handleClearFilter}
                                edge="end"
                              >
                                <ClearIcon />
                              </IconButton>
                            )}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (tabValue === 0) getAppointments();
                      else if (tabValue === 1) getAppFromApp();
                      else getEnquiryAppointments();
                    }}
                    className="add-button"
                    disabled={tabValue === 0 ? loadingCRM : tabValue === 1 ? loadingAPP : loadingENQ}
                    title="Refresh appointments"
                  >
                    <span>
                      <i
                        className={`fa fa-refresh me-2 ${
                          (tabValue === 0 ? loadingCRM : tabValue === 1 ? loadingAPP : loadingENQ)
                            ? "fa-spin"
                            : ""
                        }`}
                      ></i>
                    </span>
                    Refresh
                  </button>
                  {tabValue === 2 ? (
                    <button onClick={handleOpenCreateEnquiry} className="add-button">
                      <span>
                        <i className="fa fa-plus me-2"></i>
                      </span>
                      Schedule Enquiry Appointment
                    </button>
                  ) : (
                    <button onClick={handleOpenCreate} className="add-button">
                      <span>
                        <i className="fa fa-plus me-2"></i>
                      </span>
                      Create Appointment
                    </button>
                  )}
                  {allowExport && (
                  <button onClick={handleSampleFile} className="add-button">
                    <span>
                      <i className="fa fa-file me-2"></i>
                    </span>
                    Export File
                  </button>
                  )}
                  {role === "Admin" ? (
                    <button onClick={downloadPdf} className="add-button ">
                      <span>
                        <i className="fa fa-file-pdf-o me-2"></i>
                      </span>
                      Pdf
                    </button>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-12">
              <TabPanel value={tabValue} index={0}>
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
                        <TableHead>
                          <TableRow>
                            <TableCell>Sr.No.</TableCell>
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "patientId"}
                                direction={
                                  orderByCRM === "patientId"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() => handleSortCRM("patientId")}
                              >
                                Patient ID
                              </TableSortLabel>
                            </TableCell>
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "patientName"}
                                direction={
                                  orderByCRM === "patientName"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() => handleSortCRM("patientName")}
                              >
                                Patient Name
                              </TableSortLabel>
                            </TableCell>
                            {/* <TableCell>Disease Name</TableCell> */}
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "disease_name"}
                                direction={
                                  orderByCRM === "disease_name"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() => handleSortCRM("disease_name")}
                              >
                                Disease Name
                              </TableSortLabel>
                            </TableCell>
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "patientName"}
                                direction={
                                  orderByCRM === "patientName"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() => handleSortCRM("patientName")}
                              >
                                Appointment Id
                              </TableSortLabel>
                            </TableCell>
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "appointment_Date"}
                                direction={
                                  orderByCRM === "appointment_Date"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() =>
                                  handleSortCRM("appointment_Date")
                                }
                              >
                                Appointment Date & Time
                              </TableSortLabel>
                            </TableCell>
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "Hospital_name"}
                                direction={
                                  orderByCRM === "Hospital_name"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() => handleSortCRM("Hospital_name")}
                              >
                                Hospital Name
                              </TableSortLabel>
                            </TableCell>
                            <TableCell>
                              <TableSortLabel
                                active={orderByCRM === "appointement_status"}
                                direction={
                                  orderByCRM === "appointement_status"
                                    ? orderDirectionCRM
                                    : "asc"
                                }
                                onClick={() =>
                                  handleSortCRM("appointement_status")
                                }
                              >
                                Status
                              </TableSortLabel>
                            </TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {loadingCRM ? (
                            <TableRow>
                              <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                                <CircularProgress size={36} sx={{ color: "#22c7b8" }} />
                                <p className="mt-2 text-muted mb-0" style={{ fontSize: "14px", fontWeight: 500 }}>
                                  Loading appointments...
                                </p>
                              </TableCell>
                            </TableRow>
                          ) : appointments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} align="center">
                                No data found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (pdfRowLimit
                              ? appointments.slice(0, pdfRowLimit)
                              : appointments
                            ).map((info, i) => (
                              <TableRow
                                role="checkbox"
                                tabIndex={-1}
                                key={info.code || info.appointmentId || i}
                                className={info.isUnread ? "unread-row" : undefined}
                              >
                                <TableCell>
                                  {pdfRowLimit
                                    ? i + 1
                                    : page * rowsPerPage + i + 1}
                                </TableCell>
                                <TableCell>{info.patientId}</TableCell>
                                <TableCell
                                  title={info?.patientName}
                                  onClick={() => handleView(info)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <span
                                    style={{
                                      color: "#0284c7",
                                      fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                  >
                                    {info?.patientName?.slice(0, 16)}
                                    {info?.patientName?.length > 16 ? "..." : ""}
                                  </span>
                                </TableCell>
                                <TableCell title={info?.disease_name}>
                                  {info?.disease_name?.slice(0, 16)}
                                  {info?.disease_name?.length > 16 ? "..." : ""}
                                </TableCell>
                                <TableCell
                                  onClick={() => handleView(info)}
                                  style={{ cursor: "pointer" }}
                                  title="View Appointment Details"
                                >
                                  <span
                                    style={{
                                      color: "#0284c7",
                                      fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                  >
                                    {info.appointmentId}
                                  </span>
                                  <UnreadDot unread={info.isUnread === true} />
                                </TableCell>
                                <TableCell>
                                  {formatDisplayDateTime(
                                    info.appointment_Date,
                                    info.appointment_Time,
                                  )}
                                </TableCell>
                                <TableCell title={info?.Hospital_name}>
                                  {info?.Hospital_name?.slice(0, 16)}
                                  {info?.Hospital_name?.length > 16
                                    ? "..."
                                    : ""}
                                </TableCell>
                                <TableCell>
                                  <FormControl
                                    sx={{ m: 1, minWidth: 120 }}
                                    size="small"
                                    className="cont-main"
                                  >
                                    <Select
                                      value={getAppointmentStatusValue(
                                        info.appointement_status,
                                      )}
                                      onChange={(e) =>
                                        handleChange(e, info.appointmentId, info)
                                      }
                                      displayEmpty
                                      inputProps={{
                                        "aria-label": "Without label",
                                      }}
                                      className="status-direct"
                                    >
                                      <MenuItem value="Schedule" disabled>
                                        Schedule
                                      </MenuItem>
                                      <MenuItem value="6">Confirmed</MenuItem>
                                      <MenuItem value="2">Follow-Up</MenuItem>
                                      <MenuItem value="3"> Completed</MenuItem>
                                      <MenuItem value="4">Cancelled</MenuItem>
                                      <MenuItem value="5">Reschedule</MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                                <TableCell>
                                  <div className="action-icon">
                                    <VisibilityIcon
                                      className="eye-icon"
                                      onClick={() => handleView(info)}
                                      style={{ cursor: "pointer" }}
                                      titleAccess="View Appointment Details"
                                    />
                                    {allowEdit && (
                                      <i
                                        className="fa-solid fa-pen-to-square"
                                        onClick={() => handleEdit(info)}
                                        style={{ cursor: "pointer", marginLeft: "10px" }}
                                        title="Edit Appointment"
                                      ></i>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      {!loadingCRM && !pdfRowLimit && (
                        <div className="d-flex justify-content-between align-items-center mt-2 px-3">
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {appointmentTotalRecords > 0 && (
                              <span>
                                Showing <strong>{page * rowsPerPage + 1}</strong> to{" "}
                                <strong>{Math.min(page * rowsPerPage + (appointments || []).length, appointmentTotalRecords)}</strong> of{" "}
                                <strong>{appointmentTotalRecords}</strong> appointments
                              </span>
                            )}
                          </div>
                          <Stack spacing={2} alignItems="end">
                            <Pagination
                              count={Math.max(1, appointmentTotalPages || 1)}
                              page={page + 1}
                              onChange={(event, value) => {
                                const targetPage = value - 1;
                                setPage(targetPage);
                                getAppointments(targetPage, filterValue);
                              }}
                              shape="rounded"
                              className="page-item"
                            />
                          </Stack>
                        </div>
                      )}
                    </TableContainer>
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
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <div className="main_content">
                  <div className="row">
                    <div className="col-md-12">
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
                            <TableHead>
                              <TableRow>
                                <TableCell>Sr.No.</TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "name"}
                                    direction={
                                      orderByAPP === "name"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() => handleSortAPP("name")}
                                  >
                                    Name
                                  </TableSortLabel>
                                </TableCell>
                                {/* <TableCell>Patient email</TableCell> */}
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "email"}
                                    direction={
                                      orderByAPP === "email"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() => handleSortAPP("email")}
                                  >
                                    Email
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "city"}
                                    direction={
                                      orderByAPP === "city"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() => handleSortAPP("city")}
                                  >
                                    City
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "health_issue"}
                                    direction={
                                      orderByAPP === "health_issue"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() =>
                                      handleSortAPP("health_issue")
                                    }
                                  >
                                    Disease Name
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "apt_on"}
                                    direction={
                                      orderByAPP === "apt_on"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() => handleSortAPP("apt_on")}
                                  >
                                    Appointment Date & Time
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "paid_amount"}
                                    direction={
                                      orderByAPP === "paid_amount"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() => handleSortAPP("paid_amount")}
                                  >
                                    Paid Amount
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByAPP === "status"}
                                    direction={
                                      orderByAPP === "status"
                                        ? orderDirectionAPP
                                        : "asc"
                                    }
                                    onClick={() => handleSortAPP("status")}
                                  >
                                    Status
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {loadingAPP ? (
                                <TableRow>
                                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                                    <CircularProgress size={36} sx={{ color: "#22c7b8" }} />
                                    <p className="mt-2 text-muted mb-0" style={{ fontSize: "14px", fontWeight: 500 }}>
                                      Loading app appointments...
                                    </p>
                                  </TableCell>
                                </TableRow>
                              ) : dataApp.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} align="center">
                                    No data found
                                  </TableCell>
                                </TableRow>
                              ) : (
                                dataApp
                                  .slice(
                                    pageAPP * rowsPerPageAPP,
                                    pageAPP * rowsPerPageAPP + rowsPerPageAPP,
                                  )
                                  .map((info, i) => (
                                    <TableRow
                                      role="checkbox"
                                      tabIndex={-1}
                                      key={info.id || info.code || i}
                                      className={info.isUnread === true ? "unread-row" : undefined}
                                    >
                                      <TableCell>
                                        {pdfRowLimit
                                          ? i + 1
                                          : pageAPP * rowsPerPageAPP + i + 1}
                                      </TableCell>
                                      <TableCell
                                        title={info?.name}
                                        onClick={() => handleView(info)}
                                        style={{ cursor: "pointer" }}
                                      >
                                        <span
                                          style={{
                                            color: "#0284c7",
                                            fontWeight: 500,
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                        >
                                          {info?.name?.slice(0, 12)}
                                          {info?.name?.length > 12 ? "..." : ""}
                                        </span>
                                        <UnreadDot unread={info.isUnread === true} />
                                      </TableCell>
                                      {/* <TableCell>{info.name}</TableCell> */}
                                      <TableCell>{info.email}</TableCell>
                                      <TableCell>{info.city}</TableCell>
                                      <TableCell>{info.health_issue}</TableCell>
                                      <TableCell>
                                        {info?.apt_on ? info?.apt_on : "-"}
                                      </TableCell>
                                      <TableCell>
                                        {formatPaidAmount(info.paid_amount)}
                                      </TableCell>
                                        <TableCell>
                                          <FormControl
                                            size="small"
                                            sx={{ minWidth: 120 }}
                                            className="cont-main"
                                          >
                                            <Select
                                              className="status-direct"
                                              value={getAppAppointmentStatusCode(
                                                info.status ||
                                                  info.appointement_status,
                                              )}
                                              onChange={(e) =>
                                                handleAppStatusChange(
                                                  e,
                                                  info.id || info._id,
                                                  info,
                                                )
                                              }
                                              displayEmpty
                                              inputProps={{
                                                "aria-label": "Without label",
                                              }}
                                            >
                                              <MenuItem value="1">
                                                Confirmed
                                              </MenuItem>
                                              <MenuItem value="2">
                                                Completed
                                              </MenuItem>
                                              <MenuItem value="3">
                                                Cancelled
                                              </MenuItem>
                                              <MenuItem value="4">
                                                Follow-Up
                                              </MenuItem>
                                              <MenuItem value="5">
                                                Rescheduled
                                              </MenuItem>
                                            </Select>
                                          </FormControl>
                                        </TableCell>
                                      <TableCell>
                                        <div className="action-icon">
                                          <VisibilityIcon
                                            className="eye-icon"
                                            onClick={() => handleView(info)}
                                            style={{ cursor: "pointer" }}
                                            titleAccess="View Appointment Details"
                                          />
                                          {allowEdit && (
                                            <i
                                              className="fa-solid fa-pen-to-square"
                                              onClick={() => handleEdit(info)}
                                              style={{ cursor: "pointer", marginLeft: "10px" }}
                                              title="Edit Appointment"
                                            ></i>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))
                              )}
                            </TableBody>
                          </Table>
                          {!loadingAPP && !pdfRowLimit && (
                            <Stack spacing={2} alignItems="end" marginTop={2}>
                              <Pagination
                                count={Math.max(
                                  1,
                                  Math.ceil(dataApp.length / rowsPerPageAPP),
                                )}
                                page={pageAPP + 1}
                                onChange={(event, value) =>
                                  setPageAPP(value - 1)
                                }
                                shape="rounded"
                                className="page-item"
                              />
                            </Stack>
                          )}
                        </TableContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>
              <TabPanel value={tabValue} index={2}>
                <div className="main_content">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="table-responsive">
                        <TableContainer
                          component={Paper}
                          style={{ overflowX: "auto" }}
                        >
                          <Table stickyHeader className="table-no-card">
                            <TableHead>
                              <TableRow>
                                <TableCell>Sr.No.</TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByENQ === "patientName"}
                                    direction={orderDirectionENQ}
                                    onClick={() => handleSortENQ("patientName")}
                                  >
                                    Patient Name
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByENQ === "health_issue"}
                                    direction={orderDirectionENQ}
                                    onClick={() =>
                                      handleSortENQ("health_issue")
                                    }
                                  >
                                    Health Issue
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByENQ === "treatment_name"}
                                    direction={orderDirectionENQ}
                                    onClick={() =>
                                      handleSortENQ("treatment_name")
                                    }
                                  >
                                    Treatment Name
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                  <TableSortLabel
                                    active={orderByENQ === "appointment_Date"}
                                    direction={orderDirectionENQ}
                                    onClick={() =>
                                      handleSortENQ("appointment_Date")
                                    }
                                  >
                                    Appointment Date & Time
                                  </TableSortLabel>
                                </TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {loadingENQ ? (
                                <TableRow>
                                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                                    <CircularProgress size={36} sx={{ color: "#22c7b8" }} />
                                    <p className="mt-2 text-muted mb-0" style={{ fontSize: "14px", fontWeight: 500 }}>
                                      Loading enquiry appointments...
                                    </p>
                                  </TableCell>
                                </TableRow>
                              ) : enquiryAppointments.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} align="center">
                                    No data found
                                  </TableCell>
                                </TableRow>
                              ) : (
                                enquiryAppointments
                                  .slice(
                                    pageENQ * rowsPerPageENQ,
                                    pageENQ * rowsPerPageENQ + rowsPerPageENQ,
                                  )
                                  .map((item, i) => (
                                    <TableRow key={i}>
                                      <TableCell>
                                        {pageENQ * rowsPerPageENQ + i + 1}
                                      </TableCell>
                                      <TableCell
                                        title={item?.patientName}
                                        onClick={() => handleViewEnq(item)}
                                        style={{ cursor: "pointer" }}
                                      >
                                        <span
                                          style={{
                                            color: "#0284c7",
                                            fontWeight: 500,
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                        >
                                          {item?.patientName?.slice(0, 20)}
                                          {item?.patientName?.length > 20
                                            ? "..."
                                            : ""}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        {item?.health_issue}
                                      </TableCell>
                                      <TableCell title={item?.treatment_name}>
                                        {item?.treatment_name?.slice(0, 20)}
                                        {item?.treatment_name?.length > 20
                                          ? "..."
                                          : ""}
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          {formatDisplayDateTime(
                                            item?.appointment_Date,
                                            item?.appointment_Time,
                                          )}
                                        </div>
                                        <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                                          {item.mode === "online" ? (
                                            <span style={{ fontSize: "11px", background: "#e0f2fe", color: "#0369a1", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
                                              Online
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: "11px", background: "#f0fdf4", color: "#15803d", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
                                              Offline
                                            </span>
                                          )}
                                          {item.pickDropStatus && (
                                            <span style={{ fontSize: "11px", background: "#fef3c7", color: "#b45309", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
                                              <i className="fa-solid fa-van-shuttle me-1"></i>
                                              {item.pickDropStatus}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <FormControl
                                          size="small"
                                          sx={{ minWidth: 120 }}
                                          className="cont-main"
                                        >
                                          <Select
                                            className="status-direct"
                                            value={item.status}
                                            onChange={(e) =>
                                              handleEnqStatusChange(
                                                e,
                                                item._id,
                                                item,
                                              )
                                            }
                                          >
                                            <MenuItem value="Pending">
                                              Pending
                                            </MenuItem>
                                            <MenuItem value="Schedule">
                                              Schedule
                                            </MenuItem>
                                            <MenuItem value="Follow-Up">
                                              Follow-Up
                                            </MenuItem>
                                            <MenuItem value="Complete">
                                              Complete
                                            </MenuItem>
                                            <MenuItem value="Cancelled">
                                              Cancelled
                                            </MenuItem>
                                            <MenuItem value="Reschedule">
                                              Reschedule
                                            </MenuItem>
                                          </Select>
                                        </FormControl>
                                      </TableCell>
                                      <TableCell>
                                        <div className="action-icon">
                                          <VisibilityIcon
                                            className="eye-icon"
                                            onClick={() => handleViewEnq(item)}
                                          />
                                          {allowEdit && (
                                          <i
                                            className="fa-solid fa-pen-to-square"
                                            onClick={() => handleEdit(item)}
                                          ></i>
                                          )}
                                          {allowDelete && (
                                            <i
                                              className="fa-solid fa-trash"
                                              onClick={() => handleDelete(item)}
                                            ></i>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))
                              )}
                            </TableBody>
                          </Table>
                          {!loadingENQ && (
                            <Stack spacing={2} alignItems="end" marginTop={2}>
                              <Pagination
                                count={Math.max(
                                  1,
                                  Math.ceil(enquiryAppointments.length / rowsPerPageENQ),
                                )}
                                page={pageENQ + 1}
                                onChange={(e, val) => setPageENQ(val - 1)}
                                shape="rounded"
                                className="page-item"
                              />
                            </Stack>
                          )}
                        </TableContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={openCreate}
        onClose={() => !createSubmitting && handleCloseCreate()}
        fullWidth
        maxWidth="md"
        scroll="paper"
        sx={{
          "& .MuiDialog-container": {
            height: "100vh",
            padding: "12px",
            alignItems: "center",
            justifyContent: "center",
          },
          "& .MuiDialog-paper": {
            margin: "0 !important",
            width: "100% !important",
            maxHeight: "calc(100vh - 24px) !important",
            display: "flex !important",
            flexDirection: "column !important",
            borderRadius: "16px !important",
            overflow: "hidden !important",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35) !important",
          },
        }}
      >
        {/* FIXED HEADER */}
        <div className="pickdrop-modal-header" style={{ flex: "0 0 auto" }}>
          <div className="header-left">
            <div className="header-icon-box">
              <i className="fa-solid fa-calendar-plus"></i>
            </div>
            <div>
              <h5 className="modal-title">Create Appointment</h5>
              <p className="modal-subtitle">
                Schedule patient consultation & pick/drop transit duty
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            disabled={createSubmitting}
            onClick={handleCloseCreate}
            title="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div
          className="pickdrop-modal-body"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px 20px",
          }}
        >
          {/* SECTION 1: Patient & Appointment Details */}
          <div className="form-section-card">
            <div className="section-header">
              <h6 className="section-title">
                <span className="section-step-badge">1</span>
                Patient & Appointment Details
              </h6>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Basic Booking Information
              </span>
            </div>
            <div className="section-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Patient</span>
                      <span className="req-star">* required</span>
                    </label>
                    <PatientSearchSelect
                      value={createData.patient}
                      onChange={(newValue) => {
                        setCreateData((prev) => ({
                          ...prev,
                          patient: newValue,
                          treatment_id: "",
                          treatment_name: "",
                        }));
                        fetchPatientTreatments(newValue?.patientId);
                      }}
                      placeholder="Search patient by name or ID"
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Treatment</span>
                      <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>Optional</span>
                    </label>
                    <Autocomplete
                      size="small"
                      options={createTreatmentOptions}
                      getOptionLabel={(option) =>
                        typeof option === "string" ? option : option?.name || ""
                      }
                      value={
                        createTreatmentOptions.find(
                          (item) =>
                            String(item.id) === String(createData.treatment_id) ||
                            (createData.treatment_name &&
                              (item.name?.toLowerCase() === createData.treatment_name.toLowerCase() ||
                               item.rawName?.toLowerCase() === createData.treatment_name.toLowerCase()))
                        ) || (createData.treatment_name ? { id: createData.treatment_id || "", name: createData.treatment_name, rawName: createData.treatment_name } : null)
                      }
                      isOptionEqualToValue={(option, value) => {
                        if (!option || !value) return false;
                        return (
                          String(option.id) === String(value.id) ||
                          (option.rawName && value.rawName && option.rawName.toLowerCase() === value.rawName.toLowerCase()) ||
                          (option.name && value.name && option.name.toLowerCase() === value.name.toLowerCase())
                        );
                      }}
                      onChange={(e, value) => {
                        setCreateData((prev) => ({
                          ...prev,
                          treatment_id: value?.id || "",
                          treatment_name: value?.rawName || value?.name || "",
                        }));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Treatment (Optional)"
                          size="small"
                        />
                      )}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          padding: "0px",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                        },
                      }}
                    />
                  </div>
                </div>

                {!hospitalUser && (
                  <div className="col-md-6">
                    <div className="form-field-wrapper">
                      <label className="form-field-label">
                        <span>Select Hospital</span>
                        <span className="req-star">*</span>
                      </label>
                      <FormControl fullWidth size="small">
                        <Select
                          value={createData.hospital_id || ""}
                          displayEmpty
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const selectedHospital = hospitalList.find(
                              (item) =>
                                String(item.id) === String(selectedId) ||
                                String(item.hospital_id) === String(selectedId),
                            );
                            const hName = selectedHospital?.name || selectedHospital?.hospital_Name || "";
                            setCreateData((prev) => ({
                              ...prev,
                              hospital_id: selectedId,
                              hospital_Name: hName,
                              hospital_email:
                                selectedHospital?.email ||
                                selectedHospital?.hospital_email ||
                                "",
                            }));
                          }}
                          MenuProps={{
                            PaperProps: { style: { maxHeight: 250 } },
                          }}
                        >
                          <MenuItem value="" disabled>
                            Select Hospital
                          </MenuItem>
                          {hospitalList?.map((item) => (
                            <MenuItem
                              key={item.id || item.hospital_id}
                              value={item.id ?? item.hospital_id}
                            >
                              {item.name || item.hospital_Name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </div>
                  </div>
                )}

                <div className={!hospitalUser ? "col-md-6" : "col-md-12"}>
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Appointment Mode</span>
                    </label>
                    <div className="d-flex gap-3 mt-1">
                      <div className="radio-on">
                        <label>
                          <input
                            type="radio"
                            name="create_mode"
                            value="online"
                            checked={createData.mode === "online"}
                            onChange={(e) =>
                              setCreateData((prev) => ({
                                ...prev,
                                mode: e.target.value,
                              }))
                            }
                          />{" "}
                          Online
                        </label>
                      </div>
                      <div className="radio-on">
                        <label>
                          <input
                            type="radio"
                            name="create_mode"
                            value="offline"
                            checked={createData.mode === "offline"}
                            onChange={(e) =>
                              setCreateData((prev) => ({
                                ...prev,
                                mode: e.target.value,
                              }))
                            }
                          />{" "}
                          Offline (In-Person / Transit)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Appointment Date</span>
                      <span className="req-star">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      min={new Date().toISOString().split("T")[0]}
                      value={createData.appointment_Date}
                      onChange={(e) =>
                        setCreateData((prev) => ({
                          ...prev,
                          appointment_Date: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Appointment Time (Slot / Range)</span>
                      <span className="req-star">*</span>
                    </label>
                    <div className="row g-2">
                      <div className="col-6">
                        <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px", display: "block" }}>
                          From Time*
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={formatSingleTime12Hour(createData.appointment_Time_From) || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCreateData((prev) => {
                              let nextTo = prev.appointment_Time_To;
                              const idx = APPOINTMENT_TIME_OPTIONS.indexOf(val);
                              if (!nextTo && idx !== -1 && idx + 4 < APPOINTMENT_TIME_OPTIONS.length) {
                                nextTo = APPOINTMENT_TIME_OPTIONS[idx + 4];
                              }
                              return {
                                ...prev,
                                appointment_Time_From: val,
                                appointment_Time_To: nextTo,
                              };
                            });
                          }}
                        >
                          <option value="">Select From Time</option>
                          {createData.appointment_Time_From && !APPOINTMENT_TIME_OPTIONS.includes(formatSingleTime12Hour(createData.appointment_Time_From)) && (
                            <option value={formatSingleTime12Hour(createData.appointment_Time_From)}>
                              {formatSingleTime12Hour(createData.appointment_Time_From)}
                            </option>
                          )}
                          {APPOINTMENT_TIME_OPTIONS.map((timeOpt) => (
                            <option key={timeOpt} value={timeOpt}>
                              {timeOpt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6">
                        <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px", display: "block" }}>
                          To Time*
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={formatSingleTime12Hour(createData.appointment_Time_To) || ""}
                          onChange={(e) =>
                            setCreateData((prev) => ({
                              ...prev,
                              appointment_Time_To: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select To Time</option>
                          {createData.appointment_Time_To && !APPOINTMENT_TIME_OPTIONS.includes(formatSingleTime12Hour(createData.appointment_Time_To)) && (
                            <option value={formatSingleTime12Hour(createData.appointment_Time_To)}>
                              {formatSingleTime12Hour(createData.appointment_Time_To)}
                            </option>
                          )}
                          {APPOINTMENT_TIME_OPTIONS.map((timeOpt) => (
                            <option key={timeOpt} value={timeOpt}>
                              {timeOpt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Quick Slots */}
                    <div className="mt-2 d-flex flex-wrap gap-1 align-items-center">
                      <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                        Quick Slots:
                      </span>
                      {APPOINTMENT_TIME_PRESETS.slice(0, 5).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="btn btn-sm"
                          style={{
                            fontSize: "11px",
                            padding: "2px 7px",
                            borderRadius: "12px",
                            border: "1px solid #cbd5e1",
                            backgroundColor:
                              createData.appointment_Time_From === preset.from &&
                              createData.appointment_Time_To === preset.to
                                ? "#0f766e"
                                : "#f8fafc",
                            color:
                              createData.appointment_Time_From === preset.from &&
                              createData.appointment_Time_To === preset.to
                                ? "#ffffff"
                                : "#334155",
                            fontWeight: 500,
                            cursor: "pointer",
                            lineHeight: "1.2",
                          }}
                          onClick={() => {
                            setCreateData((prev) => ({
                              ...prev,
                              appointment_Time_From: preset.from,
                              appointment_Time_To: preset.to,
                            }));
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    {createData.appointment_Time_From && (
                      <div className="mt-1" style={{ fontSize: "11px", color: "#0f766e" }}>
                        <i className="fa-solid fa-clock me-1"></i>
                        Selected: <strong>{formatSingleTime12Hour(createData.appointment_Time_From)}{createData.appointment_Time_To ? ` to ${formatSingleTime12Hour(createData.appointment_Time_To)}` : ""}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-12">
                  <div className="form-field-wrapper mb-0">
                    <label className="form-field-label">
                      <span>Notes</span>
                      <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>Optional</span>
                    </label>
                    <textarea
                      rows="3"
                      className="form-control"
                      placeholder="Enter appointment notes, symptoms, or special instructions"
                      value={createData.note}
                      onChange={(e) =>
                        setCreateData((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 & 3: Pick & Drop Details (Shown when mode === 'offline') */}
          {createData.mode === "offline" && (
            <>
              {/* SECTION 2: Pick & Drop Locations & Timing */}
              <div className="form-section-card">
                <div className="section-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h6 className="section-title mb-0">
                      <span className="section-step-badge">2</span>
                      Pick & Drop Locations & Timing
                    </h6>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Transit Route, Timing & Destination
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    htmlFor="hasPickDropToggle"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      background: createData.hasPickDrop ? "#ecfdf5" : "#f8fafc",
                      border: `1.5px solid ${createData.hasPickDrop ? "#10b981" : "#cbd5e1"}`,
                      borderRadius: "24px",
                      padding: "5px 14px",
                      margin: 0,
                      userSelect: "none",
                      transition: "all 0.2s ease",
                      boxShadow: createData.hasPickDrop
                        ? "0 1px 3px rgba(16, 185, 129, 0.15)"
                        : "none",
                    }}
                  >
                    <span
                      style={{
                        position: "relative",
                        display: "inline-block",
                        width: "38px",
                        height: "22px",
                        backgroundColor: createData.hasPickDrop ? "#059669" : "#cbd5e1",
                        borderRadius: "22px",
                        transition: "background-color 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        id="hasPickDropToggle"
                        checked={Boolean(createData.hasPickDrop)}
                        onChange={(e) =>
                          handleToggleCreateNeedTransport(e.target.checked)
                        }
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: "100%",
                          height: "100%",
                          margin: 0,
                          cursor: "pointer",
                          zIndex: 2,
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: createData.hasPickDrop ? "18px" : "2px",
                          width: "18px",
                          height: "18px",
                          backgroundColor: "#ffffff",
                          borderRadius: "50%",
                          transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                        }}
                      />
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: createData.hasPickDrop ? "#065f46" : "#64748b",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {createData.hasPickDrop
                        ? "Enable Pick & Drop"
                        : "Enable Pick & Drop (Off)"}
                    </span>
                  </label>
                </div>

                <div className="section-body">
                  {!createData.hasPickDrop ? (
                    <div
                      className="p-3 mb-2 rounded"
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #94a3b8",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <i
                        className="fa-solid fa-van-shuttle text-secondary"
                        style={{ fontSize: 20 }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: 13, color: "#334155" }}>
                          Pick & Drop is Disabled
                        </strong>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          Patient will arrange own transit. Pickup & drop route details and driver assignment are not needed.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>
                              <i className="fa-solid fa-location-dot text-primary me-1"></i>
                              Pickup Location
                            </span>
                            <span className="req-star">*</span>
                          </label>
                          <input
                            className="form-control"
                            list="create_apt_pickup_location_presets"
                            value={createData.pickup_location}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                pickup_location: e.target.value,
                              })
                            }
                          />
                          <datalist id="create_apt_pickup_location_presets">
                            <option value="Terminal 3, IGI Airport, New Delhi" />
                            <option value="Terminal 2, IGI Airport, New Delhi" />
                            <option value="Terminal 1, IGI Airport, New Delhi" />
                            <option value="New Delhi Railway Station (NDLS)" />
                            <option value="Hazrat Nizamuddin Railway Station (NZM)" />
                            <option value="Old Delhi Railway Station (DLI)" />
                            <option value="Patient Hotel / Accommodation" />
                          </datalist>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>Pickup Location Type</span>
                          </label>
                          <select
                            className="form-select"
                            value={createData.pickup_location_type}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                pickup_location_type: e.target.value,
                              })
                            }
                          >
                            <option value="">Select Location Type</option>
                            {LOCATION_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>
                              <i className="fa-solid fa-clock text-teal me-1"></i>
                              Pickup Time
                            </span>
                          </label>
                          <input
                            className="form-control"
                            list="create_apt_pickup_time_presets"
                            value={createData.pickup_time}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                pickup_time: e.target.value,
                              })
                            }
                          />
                          <datalist id="create_apt_pickup_time_presets">
                            <option value="08:00 AM" />
                            <option value="08:30 AM" />
                            <option value="09:00 AM" />
                            <option value="09:30 AM" />
                            <option value="10:00 AM" />
                            <option value="10:30 AM" />
                            <option value="11:00 AM" />
                            <option value="11:30 AM" />
                            <option value="12:00 PM" />
                            <option value="01:00 PM" />
                            <option value="02:00 PM" />
                            <option value="03:30 PM" />
                            <option value="05:00 PM" />
                          </datalist>
                        </div>
                      </div>

                      <div className="col-md-5">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>
                              <i className="fa-solid fa-flag-checkered text-success me-1"></i>
                              Drop Location
                            </span>
                            <span className="req-star">*</span>
                          </label>
                          <input
                            className="form-control"
                            list="create_apt_drop_location_presets"
                            placeholder="e.g. Artemis Hospital / Hotel"
                            value={createData.drop_location}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                drop_location: e.target.value,
                              })
                            }
                          />
                          <datalist id="create_apt_drop_location_presets">
                            {hospitalList?.slice(0, 30).map((h) => (
                              <option
                                key={`drop-${h.id || h.hospital_id}`}
                                value={h.name || h.hospital_Name}
                              />
                            ))}
                            <option value="Terminal 3, IGI Airport, New Delhi" />
                            <option value="Terminal 2, IGI Airport, New Delhi" />
                            <option value="Terminal 1, IGI Airport, New Delhi" />
                          </datalist>
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>Drop Location Type</span>
                          </label>
                          <select
                            className="form-select"
                            value={createData.drop_location_type}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                drop_location_type: e.target.value,
                              })
                            }
                          >
                            <option value="">Select Type</option>
                            {LOCATION_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="col-md-2">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>
                              <i className="fa-solid fa-clock text-teal me-1"></i>
                              Drop Time
                            </span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            list="create_apt_drop_time_presets"
                            placeholder="e.g. 11:30 AM"
                            value={createData.drop_time || ""}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                drop_time: e.target.value,
                              })
                            }
                          />
                          <datalist id="create_apt_drop_time_presets">
                            <option value="08:00 AM" />
                            <option value="08:30 AM" />
                            <option value="09:00 AM" />
                            <option value="09:30 AM" />
                            <option value="10:00 AM" />
                            <option value="10:30 AM" />
                            <option value="11:00 AM" />
                            <option value="11:30 AM" />
                            <option value="12:00 PM" />
                            <option value="01:00 PM" />
                            <option value="02:00 PM" />
                            <option value="03:30 PM" />
                            <option value="05:00 PM" />
                            <option value="06:00 PM" />
                          </datalist>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="form-field-wrapper">
                          <label className="form-field-label">
                            <span>Initial Duty Status</span>
                          </label>
                          <select
                            className="form-select"
                            value={createData.pickDropStatus || "New"}
                            onChange={(e) =>
                              setCreateData({
                                ...createData,
                                pickDropStatus: e.target.value,
                              })
                            }
                          >
                            {PICK_DROP_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: Driver & Pickup Manager Assignment */}
              <div
                className="form-section-card"
                style={{
                  opacity: createData.hasPickDrop ? 1 : 0.7,
                  transition: "all 0.2s ease",
                }}
              >
                <div className="section-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h6 className="section-title mb-0">
                      <span className="section-step-badge">3</span>
                      Driver & Vehicle Assignment
                    </h6>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Auto-fill Preset Manager or Custom Driver
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    htmlFor="hasDriverToggle"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: createData.hasPickDrop ? "pointer" : "not-allowed",
                      background: (createData.hasPickDrop && createData.hasDriver) ? "#ecfdf5" : "#f8fafc",
                      border: `1.5px solid ${(createData.hasPickDrop && createData.hasDriver) ? "#10b981" : "#cbd5e1"}`,
                      borderRadius: "24px",
                      padding: "5px 14px",
                      margin: 0,
                      userSelect: "none",
                      transition: "all 0.2s ease",
                      boxShadow: (createData.hasPickDrop && createData.hasDriver)
                        ? "0 1px 3px rgba(16, 185, 129, 0.15)"
                        : "none",
                    }}
                  >
                    <span
                      style={{
                        position: "relative",
                        display: "inline-block",
                        width: "38px",
                        height: "22px",
                        backgroundColor: (createData.hasPickDrop && createData.hasDriver) ? "#059669" : "#cbd5e1",
                        borderRadius: "22px",
                        transition: "background-color 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        id="hasDriverToggle"
                        disabled={!createData.hasPickDrop}
                        checked={Boolean(createData.hasPickDrop && createData.hasDriver)}
                        onChange={(e) => handleToggleCreateHasDriver(e.target.checked)}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: "100%",
                          height: "100%",
                          margin: 0,
                          cursor: createData.hasPickDrop ? "pointer" : "not-allowed",
                          zIndex: 2,
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: (createData.hasPickDrop && createData.hasDriver) ? "18px" : "2px",
                          width: "18px",
                          height: "18px",
                          backgroundColor: "#ffffff",
                          borderRadius: "50%",
                          transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                        }}
                      />
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: (createData.hasPickDrop && createData.hasDriver) ? "#065f46" : "#64748b",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {!createData.hasPickDrop
                        ? "Disabled (Enable Pick & Drop first)"
                        : createData.hasDriver
                        ? "Assign Driver / Vehicle"
                        : "No Driver Needed"}
                    </span>
                  </label>
                </div>

                <div className="section-body">
                  {!createData.hasPickDrop ? (
                    <div
                      className="p-3 mb-2 rounded"
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #cbd5e1",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <i className="fa-solid fa-lock text-muted" style={{ fontSize: 18 }}></i>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Driver & vehicle assignment is only available when <strong>Pick & Drop</strong> is enabled in Section 2.
                      </div>
                    </div>
                  ) : (!createData.hasDriver || createSelectedManager === "NONE") ? (
                    <div
                      className="p-3 mb-2 rounded"
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #94a3b8",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <i className="fa-solid fa-ban text-secondary" style={{ fontSize: 20 }}></i>
                      <div>
                        <strong style={{ fontSize: 13, color: "#334155" }}>
                          No Driver / Vehicle Assigned
                        </strong>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          Pickup & drop details will be saved without assigning a driver. You can assign a driver later.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row g-3 mb-2">
                        <div className="col-md-7">
                          <div className="form-field-wrapper">
                            <label className="form-field-label">
                              <span>
                                <i className="fa-solid fa-user-tie text-primary me-1"></i>
                                Select Pickup Manager (Preset Dropdown)
                              </span>
                            </label>
                            <select
                              className="form-select"
                              style={{ fontWeight: 600 }}
                              value={createSelectedManager}
                              onChange={(e) => handleCreateManagerChange(e.target.value)}
                            >
                              <option value="NONE">None (No Driver Needed)</option>
                              {PRESET_MANAGERS.map((mgr) => (
                                <option key={mgr.name} value={mgr.name}>
                                  {mgr.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="col-md-5">
                          <div className="form-field-wrapper">
                            <label className="form-field-label">
                              <span>
                                <i className="fa-solid fa-id-card-clip text-secondary me-1"></i>
                                Vehicle No
                              </span>
                            </label>
                            <input
                              className="form-control"
                              placeholder="e.g. DL 01 AB 1234"
                              value={createData.vehicle_no}
                              onChange={(e) =>
                                setCreateData({
                                  ...createData,
                                  vehicle_no: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Status Alert Banner */}
                      {createSelectedManager !== "Other" ? (
                        <div className="autofill-alert-box mb-3">
                          <i className="fa-solid fa-circle-check text-success" style={{ fontSize: 16 }}></i>
                          <div>
                            <strong>Preset Manager Assigned:</strong> {createData.pickup_manager_name}{" "}
                            ({createData.pickup_manager_phone}). Driver details are locked to the verified contact.
                          </div>
                        </div>
                      ) : (
                        <div className="customdriver-alert-box mb-3">
                          <i className="fa-solid fa-triangle-exclamation text-warning" style={{ fontSize: 16 }}></i>
                          <div>
                            <strong>Custom Driver Mode:</strong> You can enter custom driver name and phone number below.
                          </div>
                        </div>
                      )}

                      <div className="row g-3">
                        <div className="col-md-6">
                          <div className="form-field-wrapper">
                            <label className="form-field-label">
                              <span>Driver / Manager Name</span>
                              {createSelectedManager !== "Other" && (
                                <span style={{ fontSize: 10, color: "#059669" }}>
                                  <i className="fa-solid fa-lock me-1"></i>Preset
                                </span>
                              )}
                            </label>
                            <input
                              className="form-control"
                              placeholder="e.g. Ramesh Kumar"
                              value={createData.pickup_manager_name}
                              disabled={createSelectedManager !== "Other"}
                              onChange={(e) =>
                                setCreateData({
                                  ...createData,
                                  pickup_manager_name: e.target.value,
                                  driver_name: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="form-field-wrapper">
                            <label className="form-field-label">
                              <span>Driver Phone / Contact</span>
                              {createSelectedManager !== "Other" && (
                                <span style={{ fontSize: 10, color: "#059669" }}>
                                  <i className="fa-solid fa-lock me-1"></i>Verified
                                </span>
                              )}
                            </label>
                            <input
                              className="form-control"
                              placeholder="+91 98765 43210"
                              value={createData.pickup_manager_phone}
                              disabled={createSelectedManager !== "Other"}
                              onChange={(e) =>
                                setCreateData({
                                  ...createData,
                                  pickup_manager_phone: e.target.value,
                                  driver_contact: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* FIXED FOOTER */}
        <div className="pickdrop-modal-footer" style={{ flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              <i className="fa-solid fa-circle-info text-primary me-1"></i>
              {createData.patient?.name
                ? `${createData.patient.name} (${createData.patient.patientId})`
                : "Select Patient"}{" "}
              {createData.hospital_Name ? `• ${createData.hospital_Name}` : ""}{" "}
              • {createData.mode === "offline" ? "In-Person / Transit" : "Online Consultation"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-light"
              disabled={createSubmitting}
              onClick={handleCloseCreate}
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
              type="button"
              className="add-button"
              disabled={createSubmitting}
              onClick={handleCreateSubmit}
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
                boxShadow: "0 2px 6px rgba(15, 118, 110, 0.25)",
              }}
            >
              {createSubmitting ? (
                <>
                  <CircularProgress size={16} color="inherit" /> Creating...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i> Create Appointment
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={openReschedule}
        onClose={() => setOpenReschedule(false)}
        fullWidth={fullWidth}
        maxWidth="sm"
        className="reschedule-dialog"
        PaperProps={{ sx: { borderRadius: "8px", overflow: "hidden" } }}
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6>Reschedule Appointment</h6>
          </div>
          <div
            className="cross-icon reschedule-close"
            onClick={() => setOpenReschedule(false)}
          >
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="reschedule-body">
          <div className="reschedule-info">
            <div>
              <div className="reschedule-info-label">Patient Name</div>
              <div className="reschedule-info-value">
                {rescheduleData.patientName}
              </div>
            </div>
            <div>
              <div className="reschedule-info-label">Current Appointment</div>
              <div className="reschedule-info-value">
                {rescheduleData.currentAppointment}
              </div>
            </div>
          </div>
          <div className="reschedule-fields-row">
            <div className="field-set">
              <label>
                Appointment Date<span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={rescheduleData.appointment_Date}
                onChange={(e) =>
                  setRescheduleData((prev) => ({
                    ...prev,
                    appointment_Date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="field-set">
              <label>
                Appointment Time<span className="text-danger">*</span>
              </label>
              <input
                type="time"
                className="form-control"
                value={rescheduleData.appointment_Time}
                onChange={(e) =>
                  setRescheduleData((prev) => ({
                    ...prev,
                    appointment_Time: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </DialogContent>
        <div className="reschedule-actions">
          <Button
            onClick={() => setOpenReschedule(false)}
            className="reschedule-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRescheduleSubmit}
            className="reschedule-submit-btn"
            variant="contained"
            disabled={rescheduleSubmitting}
          >
            {rescheduleSubmitting ? "Submitting..." : "Reschedule"}
          </Button>
        </div>
      </Dialog>
      {/* Confirm Appointment Dialog */}
      <Dialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        fullWidth={fullWidth}
        maxWidth="sm"
        className="reschedule-dialog"
        PaperProps={{ sx: { borderRadius: "8px", overflow: "hidden" } }}
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6>Confirm Appointment</h6>
          </div>
          <div
            className="cross-icon reschedule-close"
            onClick={() => setOpenConfirm(false)}
          >
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="reschedule-body">
          <div className="reschedule-info">
            <div>
              <div className="reschedule-info-label">Patient Name</div>
              <div className="reschedule-info-value">
                {confirmData.patientName}
              </div>
            </div>
            <div>
              <div className="reschedule-info-label">Requested Time</div>
              <div className="reschedule-info-value">
                {confirmData.currentAppointment}
              </div>
            </div>
          </div>
          <div className="reschedule-fields-row">
            <div className="field-set">
              <label>
                Confirmed Date<span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={confirmData.appointment_Date}
                onChange={(e) =>
                  setConfirmData((prev) => ({
                    ...prev,
                    appointment_Date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="field-set">
              <label>
                Exact Time<span className="text-danger">*</span>
              </label>
              <input
                type="time"
                className="form-control"
                value={confirmData.appointment_Time}
                onChange={(e) =>
                  setConfirmData((prev) => ({
                    ...prev,
                    appointment_Time: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </DialogContent>
        <div className="reschedule-actions">
          <Button
            onClick={() => setOpenConfirm(false)}
            className="reschedule-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSubmit}
            className="reschedule-submit-btn"
            variant="contained"
            disabled={confirmSubmitting}
            style={{ backgroundColor: "#28a745", borderColor: "#28a745" }}
          >
            {confirmSubmitting ? "Confirming..." : "Confirm & Save Exact Time"}
          </Button>
        </div>
      </Dialog>
      {/* Cancel Appointment Dialog */}
      <Dialog
        open={openCancel}
        onClose={() => setOpenCancel(false)}
        fullWidth={fullWidth}
        maxWidth="sm"
        className="cancel-appointment-dialog"
        PaperProps={{ sx: { borderRadius: "8px", overflow: "hidden" } }}
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6>Cancel Appointment</h6>
          </div>
          <div
            className="cross-icon cancel-dialog-close"
            onClick={() => setOpenCancel(false)}
          >
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="cancel-dialog-body">
          <div className="cancel-dialog-info">
            <div>
              <div className="cancel-dialog-info-label">Patient Name</div>
              <div className="cancel-dialog-info-value">
                {cancelData.patientName}
              </div>
            </div>
            <div>
              <div className="cancel-dialog-info-label">Current Appointment</div>
              <div className="cancel-dialog-info-value">
                {cancelData.currentAppointment}
              </div>
            </div>
          </div>
          <div className="cancel-dialog-fields">
            <div className="field-set mb-3">
              <label>
                Cancellation Reason<span className="text-danger">*</span>
              </label>
              <select
                className="form-control"
                value={cancelData.cancel_reason_id}
                onChange={(e) =>
                  setCancelData((prev) => ({
                    ...prev,
                    cancel_reason_id: e.target.value,
                  }))
                }
              >
                <option value="">Select Cancellation Reason</option>
                {cancelReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reason}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-set mb-0">
              <label>
                Cancel Note <span className="text-muted" style={{ fontSize: "12px" }}>(optional)</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Enter cancellation note..."
                value={cancelData.cancel_note}
                onChange={(e) =>
                  setCancelData((prev) => ({
                    ...prev,
                    cancel_note: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </DialogContent>
        <div className="cancel-dialog-actions">
          <Button
            onClick={() => setOpenCancel(false)}
            className="cancel-dialog-cancel-btn"
          >
            Close
          </Button>
          <Button
            onClick={handleCancelSubmit}
            className="cancel-dialog-submit-btn"
            variant="contained"
            disabled={cancelSubmitting}
          >
            {cancelSubmitting ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        fullWidth={fullWidth}
        maxWidth="md"
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6 style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: 0 }}>
              <span>Edit Appointment #{editData.appointmentId || editData._id || editData.id || ""}</span>
              {(editData.patientName || editData.name) && (
                <span
                  style={{
                    fontSize: "12px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    padding: "3px 10px",
                    borderRadius: "14px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <i className="fa-solid fa-user" style={{ fontSize: "11px" }}></i>
                  {editData.patientName || editData.name}
                  {(editData.patientId || editData.omca_id) ? ` (${editData.patientId || editData.omca_id})` : ""}
                </span>
              )}
            </h6>
          </div>
          <div className="cross-icon" onClick={() => setOpenEdit(false)}>
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="main-box view-table-detail">
          <Box
            className="contact-form"
            component="form"
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              minHeight: "350px",
            }}
          >
            <div className="row g-3">
              <div className="col-md-6">
                <div className="field-set">
                  <FormControl fullWidth size="small">
                    <label>
                      Select Hospital
                    </label>
                    <Select
                      value={
                        (hospitalList?.find(
                          (item) => String(item.id ?? item.hospital_id) === String(editData.hospital_id)
                        )?.id ?? hospitalList?.find(
                          (item) => item.name && editData.hospitalName && item.name.toLowerCase() === editData.hospitalName.toLowerCase()
                        )?.id) || (editData.hospitalName ? "custom" : "")
                      }
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (selectedId === "custom") return;
                        const selectedHospital = hospitalList?.find(
                          (item) => String(item.id ?? item.hospital_id) === String(selectedId)
                        );
                        setEditData((prev) => ({
                          ...prev,
                          hospital_id: selectedId,
                          hospitalName: selectedHospital?.name || selectedHospital?.hospital_Name || prev.hospitalName,
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
                      <MenuItem value="">-- Select Hospital --</MenuItem>
                      {hospitalList?.map((item) => (
                        <MenuItem key={item.id ?? item.hospital_id} value={item.id ?? item.hospital_id}>
                          {item.name || item.hospital_Name}
                        </MenuItem>
                      ))}
                      {editData.hospitalName && !hospitalList?.some(
                        (h) =>
                          String(h.id ?? h.hospital_id) === String(editData.hospital_id) ||
                          (h.name && h.name.toLowerCase() === editData.hospitalName.toLowerCase())
                      ) && (
                        <MenuItem value="custom">
                          {editData.hospitalName}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </div>
              </div>
              <div className="col-md-6">
                <div className="field-set">
                  <label>
                    Treatment Name
                  </label>
                  <Autocomplete
                    options={Treatment || []}
                    getOptionLabel={(option) => (typeof option === "string" ? option : option?.name || "")}
                    value={
                      Treatment?.find(
                        (item) =>
                          String(item.id) === String(editData.treatment_id) ||
                          (editData.treatment_name && item.name && item.name.toLowerCase() === editData.treatment_name.toLowerCase())
                      ) || (editData.treatment_name ? { id: editData.treatment_id || "", name: editData.treatment_name } : null)
                    }
                    isOptionEqualToValue={(option, value) => {
                      if (!option || !value) return false;
                      return (
                        String(option.id) === String(value.id) ||
                        (option.name && value.name && option.name.toLowerCase() === value.name.toLowerCase())
                      );
                    }}
                    onChange={(e, value) => {
                      setEditData((prev) => ({
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
                  <label>
                    Health Issue
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Patient health issue / complaint"
                    value={editData.health_issue || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        health_issue: e.target.value,
                      })
                    }
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
                    className="form-control"
                    value={getDateInputValue(editData.appointment_Date || editData.apt_on)}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        appointment_Date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="field-set">
                  <label>
                    Appointment Time (Slot / Range)<span className="text-danger">*</span>
                  </label>
                  <div className="row g-2">
                    <div className="col-6">
                      <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px", display: "block" }}>
                        From Time*
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={formatSingleTime12Hour(editData.appointment_Time_From || editData.appointment_Time) || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditData((prev) => {
                            let nextTo = prev.appointment_Time_To;
                            const idx = APPOINTMENT_TIME_OPTIONS.indexOf(val);
                            if (!nextTo && idx !== -1 && idx + 4 < APPOINTMENT_TIME_OPTIONS.length) {
                              nextTo = APPOINTMENT_TIME_OPTIONS[idx + 4];
                            }
                            return {
                              ...prev,
                              appointment_Time_From: val,
                              appointment_Time_To: nextTo,
                              appointment_Time: nextTo ? `${val} to ${nextTo}` : val,
                            };
                          });
                        }}
                      >
                        <option value="">Select From Time</option>
                        {(editData.appointment_Time_From || editData.appointment_Time) &&
                          !APPOINTMENT_TIME_OPTIONS.includes(formatSingleTime12Hour(editData.appointment_Time_From || editData.appointment_Time)) && (
                            <option value={formatSingleTime12Hour(editData.appointment_Time_From || editData.appointment_Time)}>
                              {formatSingleTime12Hour(editData.appointment_Time_From || editData.appointment_Time)}
                            </option>
                          )}
                        {APPOINTMENT_TIME_OPTIONS.map((timeOpt) => (
                          <option key={timeOpt} value={timeOpt}>
                            {timeOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px", display: "block" }}>
                        To Time
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={formatSingleTime12Hour(editData.appointment_Time_To) || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditData((prev) => ({
                            ...prev,
                            appointment_Time_To: val,
                            appointment_Time: prev.appointment_Time_From ? `${prev.appointment_Time_From} to ${val}` : val,
                          }));
                        }}
                      >
                        <option value="">Select To Time (Optional)</option>
                        {editData.appointment_Time_To &&
                          !APPOINTMENT_TIME_OPTIONS.includes(formatSingleTime12Hour(editData.appointment_Time_To)) && (
                            <option value={formatSingleTime12Hour(editData.appointment_Time_To)}>
                              {formatSingleTime12Hour(editData.appointment_Time_To)}
                            </option>
                          )}
                        {APPOINTMENT_TIME_OPTIONS.map((timeOpt) => (
                          <option key={timeOpt} value={timeOpt}>
                            {timeOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Quick Slots */}
                  <div className="mt-2 d-flex flex-wrap gap-1 align-items-center">
                    <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                      Quick Slots:
                    </span>
                    {APPOINTMENT_TIME_PRESETS.slice(0, 5).map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="btn btn-sm"
                        style={{
                          fontSize: "11px",
                          padding: "2px 7px",
                          borderRadius: "12px",
                          border: "1px solid #cbd5e1",
                          backgroundColor:
                            editData.appointment_Time_From === preset.from &&
                            editData.appointment_Time_To === preset.to
                              ? "#0284c7"
                              : "#f8fafc",
                          color:
                            editData.appointment_Time_From === preset.from &&
                            editData.appointment_Time_To === preset.to
                              ? "#ffffff"
                              : "#334155",
                          fontWeight: 500,
                          cursor: "pointer",
                          lineHeight: "1.2",
                        }}
                        onClick={() => {
                          setEditData((prev) => ({
                            ...prev,
                            appointment_Time_From: preset.from,
                            appointment_Time_To: preset.to,
                            appointment_Time: `${preset.from} to ${preset.to}`,
                          }));
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {(editData.appointment_Time_From || editData.appointment_Time) && (
                    <div className="mt-2" style={{ fontSize: "11px", color: "#0284c7" }}>
                      <i className="fa-solid fa-clock me-1"></i>
                      Active Time: <strong>{formatTime12Hour(editData.appointment_Time || (editData.appointment_Time_From ? `${editData.appointment_Time_From}${editData.appointment_Time_To ? ` to ${editData.appointment_Time_To}` : ""}` : ""))}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra Transport, Pick/Drop & Mode Fields */}
              <div className="col-md-12">
                <AppointmentTransportFields
                  data={editData}
                  onChange={(updates) =>
                    setEditData((prev) => ({ ...prev, ...updates }))
                  }
                />
              </div>

              <div className="col-md-12">
                <div className="field-set">
                  <label>
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Discussion notes / patient instructions"
                    value={editData.discussionNotes || editData.Notes || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        discussionNotes: e.target.value,
                        Notes: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

            </div>
          </Box>
          <DialogActions className="submit-main">
            <Button onClick={() => setOpenEdit(false)} disabled={updateSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              className="add-button"
              variant="contained"
              disabled={updateSubmitting}
            >
              {updateSubmitting ? (
                <>
                  <CircularProgress size={16} color="inherit" className="me-2" />
                  Updating...
                </>
              ) : (
                "Update Appointment"
              )}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Dialog
        fullWidth={fullWidth}
        maxWidth={maxWidth}
        open={openViewEnq}
        onClose={handleCloseViewEnq}
      >
        <div className="main-card-header">
          <div className="top-fixed-hd">
            <div className="note-hd">
              <h6>Enquiry Appointment Details</h6>
            </div>
            <div className="cross-icon" onClick={handleCloseViewEnq}>
              <i className="fa-solid fa-xmark"></i>
            </div>
          </div>
        </div>
        <DialogContent className="main-box view-table-detail">
          {selectedEnq && (
            <Box>
              <div className="row">
                <div className="col-md-12 mb-3">
                  <div className="card">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4">
                          <InfoItem
                            label="Patient Name"
                            value={selectedEnq.patientName}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Hospital Name"
                            value={selectedEnq.hospitalName}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Health Issue"
                            value={selectedEnq.health_issue}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Treatment Name"
                            value={selectedEnq.treatment_name}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Appointment Date"
                            value={new Date(
                              selectedEnq.appointment_Date,
                            ).toLocaleDateString("en-GB")}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Appointment Time"
                            value={selectedEnq.appointment_Time}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem label="Status" value={selectedEnq.status} />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Mode"
                            value={
                              selectedEnq.mode === "online"
                                ? "Online (Teleconsultation)"
                                : "Offline (In-Person Consultation)"
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Appointment ID"
                            value={selectedEnq.appointmentId || selectedEnq._id}
                          />
                        </div>

                        {/* Transport Details Card if present */}
                        {(selectedEnq.pickup_location ||
                          selectedEnq.drop_location ||
                          selectedEnq.pickup_manager_name ||
                          selectedEnq.vehicle_no ||
                          selectedEnq.pickDropStatus) && (
                          <div className="col-md-12 mt-2 mb-2">
                            <div
                              style={{
                                background: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "12px 16px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "10px",
                                  borderBottom: "1px solid #e2e8f0",
                                  paddingBottom: "6px",
                                }}
                              >
                                <h6
                                  style={{
                                    margin: 0,
                                    fontSize: "13px",
                                    color: "#0f766e",
                                    fontWeight: 700,
                                  }}
                                >
                                  <i className="fa-solid fa-van-shuttle me-2"></i>
                                  Pick & Drop Transport Details
                                </h6>
                                {selectedEnq.pickDropStatus && (
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      background: "#e0f2fe",
                                      color: "#0369a1",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Duty Status: {selectedEnq.pickDropStatus}
                                  </span>
                                )}
                              </div>
                              <div className="row g-2">
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Pickup Location"
                                    value={
                                      selectedEnq.pickup_location
                                        ? selectedEnq.pickup_location_type
                                          ? `${selectedEnq.pickup_location} (${selectedEnq.pickup_location_type})`
                                          : selectedEnq.pickup_location
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Pickup Time"
                                    value={selectedEnq.pickup_time || "-"}
                                  />
                                </div>
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Drop Location"
                                    value={
                                      selectedEnq.drop_location
                                        ? selectedEnq.drop_location_type
                                          ? `${selectedEnq.drop_location} (${selectedEnq.drop_location_type})`
                                          : selectedEnq.drop_location
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Drop Time"
                                    value={selectedEnq.drop_time || "-"}
                                  />
                                </div>
                                <div className="col-md-4">
                                  <InfoItem
                                    label="Pickup Manager"
                                    value={
                                      selectedEnq.pickup_manager_name
                                        ? `${selectedEnq.pickup_manager_name} (${selectedEnq.pickup_manager_phone || "-"})`
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-4">
                                  <InfoItem
                                    label="Driver"
                                    value={
                                      selectedEnq.driver_name
                                        ? `${selectedEnq.driver_name} (${selectedEnq.driver_contact || "-"})`
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-4">
                                  <InfoItem
                                    label="Vehicle Number"
                                    value={selectedEnq.vehicle_no || "-"}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Notes full width */}
                        <div className="col-md-12">
                          <h6>Notes</h6>
                          <p>
                            {(!isAutoAppointmentNote(selectedEnq.discussionNotes || selectedEnq.Notes)
                              ? (selectedEnq.discussionNotes || selectedEnq.Notes)
                              : "") || "-"}
                          </p>
                        </div>

                        {/* Reports full width */}
                        <div className="col-md-12 mt-2">
                          <h6>Reports</h6>

                          {selectedEnq.reports?.length > 0 ? (
                            selectedEnq.reports.map((file, i) => (
                              <div key={i}>
                                <a
                                  href={`${baseu11}/${file}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View Report {i + 1}
                                </a>
                              </div>
                            ))
                          ) : (
                            <p>-</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* SCHEDULE ENQUIRY APPOINTMENT MODAL */}
      <Dialog
        open={openCreateEnquiry}
        onClose={handleCloseCreateEnquiry}
        fullWidth={fullWidth}
        maxWidth="md"
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6>Schedule Enquiry Appointment</h6>
          </div>
          <div className="cross-icon" onClick={handleCloseCreateEnquiry}>
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="main-box view-table-detail">
          <Box
            className="contact-form"
            component="form"
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
            }}
          >
            <div className="row g-3">
              <div className="col-md-4">
                <div className="field-set">
                  <label>Patient / Contact Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Patient or Contact Name"
                    value={createEnquiryData.enq_userName}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        enq_userName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="field-set">
                  <label>Contact Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. +91 9876543210"
                    value={createEnquiryData.enq_phoneNumber}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        enq_phoneNumber: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="field-set">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="email@example.com"
                    value={createEnquiryData.enq_email}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        enq_email: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="field-set">
                  <label>Enquiry ID (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ENQ-12345"
                    value={createEnquiryData.enquiryId}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        enquiryId: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="field-set">
                  <FormControl fullWidth size="small">
                    <label>Select Hospital</label>
                    <Select
                      value={createEnquiryData.hospital_id || ""}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedHospital = hospitalList.find(
                          (item) => item.id === selectedId
                        );
                        setCreateEnquiryData((prev) => ({
                          ...prev,
                          hospital_id: selectedId,
                          hospitalName: selectedHospital?.name || "",
                          hospital_email: selectedHospital?.email || "",
                        }));
                      }}
                      MenuProps={{
                        PaperProps: {
                          style: { maxHeight: 250 },
                        },
                      }}
                    >
                      {hospitalList?.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              </div>
              <div className="col-md-4">
                <div className="field-set">
                  <label>Treatment Name</label>
                  <Autocomplete
                    options={Treatment || []}
                    getOptionLabel={(option) => option.name || ""}
                    value={
                      Treatment?.find(
                        (item) => item.id == createEnquiryData.treatment_id
                      ) || null
                    }
                    onChange={(e, value) => {
                      setCreateEnquiryData((prev) => ({
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
                    className="form-control"
                    placeholder="Patient health issue / complaint"
                    value={createEnquiryData.health_issue}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        health_issue: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="field-set">
                  <label>
                    Appointment Date<span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    min={new Date().toISOString().split("T")[0]}
                    value={createEnquiryData.appointment_Date}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        appointment_Date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="field-set">
                  <label>
                    Appointment Time (Slot / Range)<span className="text-danger">*</span>
                  </label>
                  <div className="row g-2">
                    <div className="col-6">
                      <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px", display: "block" }}>
                        From Time*
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={formatSingleTime12Hour(createEnquiryData.appointment_Time_From || createEnquiryData.appointment_Time) || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreateEnquiryData((prev) => {
                            let nextTo = prev.appointment_Time_To;
                            const idx = APPOINTMENT_TIME_OPTIONS.indexOf(val);
                            if (!nextTo && idx !== -1 && idx + 4 < APPOINTMENT_TIME_OPTIONS.length) {
                              nextTo = APPOINTMENT_TIME_OPTIONS[idx + 4];
                            }
                            return {
                              ...prev,
                              appointment_Time_From: val,
                              appointment_Time_To: nextTo,
                              appointment_Time: nextTo ? `${val} to ${nextTo}` : val,
                            };
                          });
                        }}
                      >
                        <option value="">Select From Time</option>
                        {(createEnquiryData.appointment_Time_From || createEnquiryData.appointment_Time) &&
                          !APPOINTMENT_TIME_OPTIONS.includes(formatSingleTime12Hour(createEnquiryData.appointment_Time_From || createEnquiryData.appointment_Time)) && (
                            <option value={formatSingleTime12Hour(createEnquiryData.appointment_Time_From || createEnquiryData.appointment_Time)}>
                              {formatSingleTime12Hour(createEnquiryData.appointment_Time_From || createEnquiryData.appointment_Time)}
                            </option>
                          )}
                        {APPOINTMENT_TIME_OPTIONS.map((timeOpt) => (
                          <option key={timeOpt} value={timeOpt}>
                            {timeOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px", display: "block" }}>
                        To Time
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={formatSingleTime12Hour(createEnquiryData.appointment_Time_To) || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreateEnquiryData((prev) => ({
                            ...prev,
                            appointment_Time_To: val,
                            appointment_Time: prev.appointment_Time_From ? `${prev.appointment_Time_From} to ${val}` : val,
                          }));
                        }}
                      >
                        <option value="">Select To Time (Optional)</option>
                        {createEnquiryData.appointment_Time_To &&
                          !APPOINTMENT_TIME_OPTIONS.includes(formatSingleTime12Hour(createEnquiryData.appointment_Time_To)) && (
                            <option value={formatSingleTime12Hour(createEnquiryData.appointment_Time_To)}>
                              {formatSingleTime12Hour(createEnquiryData.appointment_Time_To)}
                            </option>
                          )}
                        {APPOINTMENT_TIME_OPTIONS.map((timeOpt) => (
                          <option key={timeOpt} value={timeOpt}>
                            {timeOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Quick Slots */}
                  <div className="mt-2 d-flex flex-wrap gap-1 align-items-center">
                    <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                      Quick Slots:
                    </span>
                    {APPOINTMENT_TIME_PRESETS.slice(0, 5).map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="btn btn-sm"
                        style={{
                          fontSize: "11px",
                          padding: "2px 7px",
                          borderRadius: "12px",
                          border: "1px solid #cbd5e1",
                          backgroundColor:
                            createEnquiryData.appointment_Time_From === preset.from &&
                            createEnquiryData.appointment_Time_To === preset.to
                              ? "#0f766e"
                              : "#f8fafc",
                          color:
                            createEnquiryData.appointment_Time_From === preset.from &&
                            createEnquiryData.appointment_Time_To === preset.to
                              ? "#ffffff"
                              : "#334155",
                          fontWeight: 500,
                          cursor: "pointer",
                          lineHeight: "1.2",
                        }}
                        onClick={() => {
                          setCreateEnquiryData((prev) => ({
                            ...prev,
                            appointment_Time_From: preset.from,
                            appointment_Time_To: preset.to,
                            appointment_Time: `${preset.from} to ${preset.to}`,
                          }));
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {(createEnquiryData.appointment_Time_From || createEnquiryData.appointment_Time) && (
                    <div className="mt-2" style={{ fontSize: "11px", color: "#0f766e" }}>
                      <i className="fa-solid fa-clock me-1"></i>
                      Selected: <strong>{formatTime12Hour(createEnquiryData.appointment_Time || (createEnquiryData.appointment_Time_From ? `${createEnquiryData.appointment_Time_From}${createEnquiryData.appointment_Time_To ? ` to ${createEnquiryData.appointment_Time_To}` : ""}` : ""))}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra Transport & Mode Fields */}
              <div className="col-md-12">
                <AppointmentTransportFields
                  data={createEnquiryData}
                  onChange={(updates) =>
                    setCreateEnquiryData((prev) => ({ ...prev, ...updates }))
                  }
                />
              </div>

              <div className="col-md-12">
                <div className="field-set">
                  <label>
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Instructions / discussion notes for the appointment"
                    value={createEnquiryData.Notes}
                    onChange={(e) =>
                      setCreateEnquiryData((prev) => ({
                        ...prev,
                        Notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-md-12">
                <div className="field-set">
                  <label>Upload Reports / Attachments</label>
                  <input
                    type="file"
                    multiple
                    className="form-control"
                    onChange={(e) =>
                      setCreateEnquiryImages(Array.from(e.target.files))
                    }
                  />
                </div>
              </div>
            </div>
          </Box>
          <DialogActions className="submit-main">
            <Button onClick={handleCloseCreateEnquiry} disabled={createEnquirySubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEnquirySubmit}
              className="add-button"
              variant="contained"
              disabled={createEnquirySubmitting}
            >
              {createEnquirySubmitting ? (
                <>
                  <CircularProgress size={16} color="inherit" className="me-2" />
                  Scheduling...
                </>
              ) : (
                "Schedule Appointment"
              )}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Dialog
        fullWidth={fullWidth}
        maxWidth={maxWidth}
        open={open}
        onClose={handleClose}
      >
        <div className="main-card-header">
          <div className="top-fixed-hd">
            <div className="note-hd">
              <h6>
                Appointment Details
                {(selectedRecord?.appointmentId || selectedRecord?.id || selectedRecord?._id) && (
                  <span
                    className="badge bg-primary text-white ms-2"
                    style={{ fontSize: "12px", fontWeight: 500, verticalAlign: "middle" }}
                  >
                    {selectedRecord?.appointmentId || selectedRecord?.id || selectedRecord?._id}
                  </span>
                )}
              </h6>
            </div>
            <div className="cross-icon" onClick={handleClose}>
              <i className="fa-solid fa-xmark"></i>
            </div>
          </div>
        </div>
        <DialogContent className="main-box view-table-detail">
          {selectedRecord && (
            <Box>
              <div className="row">
                <div className="col-md-12 mb-3">
                  <div className="card">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4">
                          <InfoItem
                            label="Patient Name"
                            value={selectedRecord.patientName || selectedRecord.name}
                          />
                        </div>
                        {selectedRecord.patientId && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Patient ID"
                              value={selectedRecord.patientId}
                            />
                          </div>
                        )}
                        <div className="col-md-4">
                          <InfoItem
                            label="Appointment ID"
                            value={selectedRecord.appointmentId || selectedRecord.id || selectedRecord._id}
                          />
                        </div>
                        {(selectedRecord.Hospital_name || selectedRecord.hospitalName) && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Hospital Name"
                              value={selectedRecord.Hospital_name || selectedRecord.hospitalName}
                            />
                          </div>
                        )}
                        <div className="col-md-4">
                          <InfoItem
                            label="Disease / Health Issue"
                            value={selectedRecord.disease_name || selectedRecord.health_issue}
                          />
                        </div>
                        {(selectedRecord.treatment_name || selectedRecord.treatment) && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Treatment"
                              value={selectedRecord.treatment_name || selectedRecord.treatment}
                            />
                          </div>
                        )}
                        <div className="col-md-4">
                          <InfoItem
                            label="Appointment Date & Time"
                            value={
                              selectedRecord.appointment_Date
                                ? formatDisplayDateTime(
                                    selectedRecord.appointment_Date,
                                    selectedRecord.appointment_Time,
                                  )
                                : selectedRecord.apt_on || "-"
                            }
                          />
                        </div>
                        {selectedRecord.doctor && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Doctor"
                              value={selectedRecord.doctor}
                            />
                          </div>
                        )}
                        <div className="col-md-4">
                          <InfoItem
                            label="Status"
                            value={
                              selectedRecord.appointement_status
                                ? getCRMAppointmentStatusLabel(selectedRecord.appointement_status)
                                : getAppAppointmentStatusLabel(selectedRecord.status)
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Consultation Mode"
                            value={
                              selectedRecord.mode === "online"
                                ? "Online (Teleconsultation)"
                                : selectedRecord.mode === "offline"
                                ? "Offline (In-Person Consultation)"
                                : selectedRecord.apt_type || "-"
                            }
                          />
                        </div>
                        {selectedRecord.email && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Email"
                              value={selectedRecord.email}
                            />
                          </div>
                        )}
                        {selectedRecord.phone && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Phone Number"
                              value={selectedRecord.phone}
                            />
                          </div>
                        )}
                        {(selectedRecord.city || selectedRecord.country) && (
                          <div className="col-md-4">
                            <InfoItem
                              label="City / Country"
                              value={[selectedRecord.city, selectedRecord.country]
                                .filter(Boolean)
                                .join(", ")}
                            />
                          </div>
                        )}
                        {selectedRecord.paid_amount != null && selectedRecord.paid_amount !== "" && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Paid Amount"
                              value={formatPaidAmount(selectedRecord.paid_amount)}
                            />
                          </div>
                        )}
                        {selectedRecord.home_visit_address && (
                          <div className="col-md-4">
                            <InfoItem
                              label="Home Visit Address"
                              value={selectedRecord.home_visit_address}
                            />
                          </div>
                        )}

                        {/* Transport Details Card if present */}
                        {(selectedRecord.pickup_location ||
                          selectedRecord.drop_location ||
                          selectedRecord.pickup_manager_name ||
                          selectedRecord.vehicle_no ||
                          selectedRecord.pickDropStatus) && (
                          <div className="col-md-12 mt-2 mb-2">
                            <div
                              style={{
                                background: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "12px 16px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "10px",
                                  borderBottom: "1px solid #e2e8f0",
                                  paddingBottom: "6px",
                                }}
                              >
                                <h6
                                  style={{
                                    margin: 0,
                                    fontSize: "13px",
                                    color: "#0f766e",
                                    fontWeight: 700,
                                  }}
                                >
                                  <i className="fa-solid fa-van-shuttle me-2"></i>
                                  Pick & Drop Transport Details
                                </h6>
                                {selectedRecord.pickDropStatus && (
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      background: "#e0f2fe",
                                      color: "#0369a1",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Duty Status: {selectedRecord.pickDropStatus}
                                  </span>
                                )}
                              </div>
                              <div className="row g-2">
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Pickup Location"
                                    value={
                                      selectedRecord.pickup_location
                                        ? selectedRecord.pickup_location_type
                                          ? `${selectedRecord.pickup_location} (${selectedRecord.pickup_location_type})`
                                          : selectedRecord.pickup_location
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Pickup Time"
                                    value={selectedRecord.pickup_time || "-"}
                                  />
                                </div>
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Drop Location"
                                    value={
                                      selectedRecord.drop_location
                                        ? selectedRecord.drop_location_type
                                          ? `${selectedRecord.drop_location} (${selectedRecord.drop_location_type})`
                                          : selectedRecord.drop_location
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-6">
                                  <InfoItem
                                    label="Drop Time"
                                    value={selectedRecord.drop_time || "-"}
                                  />
                                </div>
                                <div className="col-md-4">
                                  <InfoItem
                                    label="Pickup Manager"
                                    value={
                                      selectedRecord.pickup_manager_name
                                        ? `${selectedRecord.pickup_manager_name} (${selectedRecord.pickup_manager_phone || "-"})`
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-4">
                                  <InfoItem
                                    label="Driver"
                                    value={
                                      selectedRecord.driver_name
                                        ? `${selectedRecord.driver_name} (${selectedRecord.driver_contact || "-"})`
                                        : "-"
                                    }
                                  />
                                </div>
                                <div className="col-md-4">
                                  <InfoItem
                                    label="Vehicle Number"
                                    value={selectedRecord.vehicle_no || "-"}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Notes full width */}
                        {Boolean(
                          (selectedRecord.discussionNotes || selectedRecord.Notes) &&
                          !isAutoAppointmentNote(selectedRecord.discussionNotes || selectedRecord.Notes)
                        ) && (
                          <div className="col-md-12 mt-2">
                            <h6>Consultation Notes</h6>
                            <p
                              className="p-2 rounded bg-light border"
                              style={{ whiteSpace: "pre-wrap" }}
                            >
                              {selectedRecord.discussionNotes || selectedRecord.Notes}
                            </p>
                          </div>
                        )}

                        {/* Reports full width */}
                        {selectedRecord.reports?.length > 0 && (
                          <div className="col-md-12 mt-2">
                            <h6>Reports / Documents</h6>
                            <div className="d-flex flex-wrap gap-2">
                              {selectedRecord.reports.map((file, i) => (
                                <a
                                  key={i}
                                  href={`${baseu11}/${file}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-primary"
                                >
                                  <i className="fa-solid fa-file-pdf me-1"></i>
                                  View Report {i + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      <ToastContainer position="top-right" autoClose={3500} limit={3} />
    </>
  );
}
