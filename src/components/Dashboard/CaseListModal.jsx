import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  addEnquiryNotes,
  addPatientNotes,
  agingToPriority,
  changeEnquiryStatus,
  changePatientStatus,
  ENQUIRY_STATUS_OPTIONS,
  fetchCaseList,
  fetchTravelPatientDetail,
  formatWaitingDuration,
  getEnquiryStatusBadgeKey,
  getEnquiryStatusLabel,
  getEnquiryStatusValue,
  getWaitingHours,
  navigateToRecord,
} from "../../services/dashboardApi";
import TravelStatusModal from "../Common/TravelStatusModal";
import StinkerBadges from "../TreatmentPlan/StinkerBadges";
import {
  getPatientStatusBadgeKey,
  getPatientStatusLabel,
  isTravelStatus,
  normalizePatientStatus,
  PATIENT_STATUS_OPTIONS,
} from "../../utils/patientStatus";

const priorityBadgeLabel = {
  critical: "Critical",
  high: "High Priority",
  warning: "Warning",
  normal: "Normal",
};

const cleanModalTitle = (title) => {
  if (!title || typeof title !== "string") return title || "Cases";
  return (
    title
      .replace(/\s*[-–—]\s*More than 24 hours/gi, "")
      .replace(/\s*More than 24 hours/gi, "")
      .trim() || "Cases"
  );
};

const formatCaseDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const escapeCsvCell = (value) => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatPatientWaiting = (row) => {
  if (row.waitingDays != null && Number.isFinite(Number(row.waitingDays))) {
    const days = Number(row.waitingDays);
    return days === 1 ? "1 Day" : `${days} Days`;
  }
  if (row.daysOverdue != null && Number.isFinite(Number(row.daysOverdue))) {
    const days = Number(row.daysOverdue);
    return days === 1 ? "1 Day overdue" : `${days} Days overdue`;
  }
  return formatWaitingDuration(getWaitingHours(row) || row.waitingLabel);
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
  return phone || code || "";
};

const downloadCasesCsv = (rows = [], title = "cases") => {
  const headers = [
    "Patient Name",
    "Patient ID",
    "Enquiry ID",
    "Phone Number",
    "Status",
    "Stage",
    "Waiting",
    "Priority",
    "Notes Count",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => {
      const notes = Array.isArray(row.discussionNotes)
        ? row.discussionNotes.length
        : 0;
      const priority = agingToPriority(row);
      const phone = getPatientPhone(row);
      return [
        escapeCsvCell(
          row.patient_name || row.patientName || row.name || "",
        ),
        escapeCsvCell(row.patientId || ""),
        escapeCsvCell(row.enquiryId || ""),
        escapeCsvCell(phone),
        escapeCsvCell(row.p_status || row.enq_status || row.status || ""),
        escapeCsvCell(row.stageLabel || row.waitingLabel || ""),
        escapeCsvCell(formatPatientWaiting(row)),
        escapeCsvCell(
          row.priority || priorityBadgeLabel[priority] || "",
        ),
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
  const safeTitle = String(title || "cases")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  link.href = url;
  link.setAttribute("download", `${safeTitle || "cases"}-${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const isEnquiryAgingList = (endpoint, cases) => {
  if (endpoint?.includes("doctor-review-pending")) return true;
  const row = cases[0];
  return (
    cases.length > 0 &&
    Boolean(row?.enquiryId) &&
    !row?.patientId &&
    (row.stageLabel != null || row.waitingHours != null || row.waitingLabel)
  );
};

const isEnquiryList = (endpoint, cases) => {
  if (isEnquiryAgingList(endpoint, cases)) return false;
  return (
    endpoint?.includes("enquiry") ||
    (cases.length > 0 && Boolean(cases[0].enquiryId) && !cases[0].patientId)
  );
};

const isTreatmentPlanList = (endpoint, cases) =>
  endpoint?.includes("treatment-plans-issued") ||
  (cases.length > 0 &&
    Boolean(cases[0].patientId) &&
    cases[0].treatment &&
    typeof cases[0].treatment === "object" &&
    Array.isArray(cases[0].hospitals));

const isAppointmentList = (endpoint, cases) => {
  if (endpoint?.includes("today-appointments")) return true;
  const row = cases[0];
  return (
    cases.length > 0 &&
    Boolean(row?.patientId) &&
    row.appointment_Time != null &&
    !row.stageLabel
  );
};

const isTravelPatientList = (endpoint, cases) => {
  return (
    endpoint?.includes("get_travel_patients") ||
    endpoint?.includes("patients-arriving-today") ||
    endpoint?.includes("patients-departing-today") ||
    endpoint?.includes("patients-preponed-today") ||
    endpoint?.includes("patients-postponed-today") ||
    (cases.length > 0 && cases[0]?.travelDetails != null)
  );
};

const isPatientAgingList = (endpoint, cases) => {
  if (
    endpoint?.includes("treatment-plan-pending") ||
    endpoint?.includes("overdue-cases") ||
    endpoint?.includes("followup-overdue") ||
    endpoint?.includes("followups-due") ||
    endpoint?.includes("missing-documents") ||
    endpoint?.includes("appointment-pending") ||
    endpoint?.includes("patients-waiting-confirmation") ||
    endpoint?.includes("patients-travelling") ||
    endpoint?.includes("patients-contacted")
  ) {
    return true;
  }
  const row = cases[0];
  return (
    cases.length > 0 &&
    Boolean(row?.patientId) &&
    (row.stageLabel != null ||
      row.waitingHours != null ||
      row.waitingDays != null ||
      row.waitingLabel) &&
    row.appointment_Time == null &&
    !row.treatment &&
    !Array.isArray(row.hospitals) &&
    !(row.hospitalName && row.mode)
  );
};

const formatAppointmentDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatHospitalNames = (hospitals = []) => {
  if (!Array.isArray(hospitals) || !hospitals.length) return "—";
  const names = hospitals.map((h) => h?.name).filter(Boolean);
  return names.length ? names.join(", ") : "—";
};

const formatHospitalStatus = (hospitals = []) => {
  if (!Array.isArray(hospitals) || !hospitals.length) return "—";
  const statuses = [...new Set(hospitals.map((h) => h?.status).filter(Boolean))];
  return statuses.length ? statuses.join(", ") : "—";
};

export default function CaseListModal({
  isOpen,
  title,
  endpoint,
  onClose,
  navigate,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cases, setCases] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [notesModal, setNotesModal] = useState({
    open: false,
    patientName: "",
    patientId: "",
    enquiryId: "",
    notes: [],
  });
  const [noteText, setNoteText] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteError, setNoteError] = useState({ note: false, date: false });
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [travelStatusModal, setTravelStatusModal] = useState({
    open: false,
    patientId: "",
    patientName: "",
    status: "",
  });
  const [travelStatusSubmitting, setTravelStatusSubmitting] = useState(false);

  const fetchCases = async (pageNum = 1, pageSize = limit) => {
    if (!endpoint) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchCaseList(endpoint, {
        page: pageNum,
        limit: pageSize,
      });
      const dataList = result.data || [];
      const tot = result.total ?? result.count ?? dataList.length;
      const resPage = Number(result.page) || pageNum;
      const resLimit = Number(result.limit) || pageSize;
      const resTotalPages =
        Number(result.totalPages) ||
        Math.max(1, Math.ceil(tot / resLimit));

      setCases(dataList);
      setTotalRecords(tot);
      setCount(tot);
      setPage(resPage);
      setLimit(resLimit);
      setTotalPages(resTotalPages);
      setHasPrevPage(result.hasPrevPage ?? (resPage > 1));
      setHasNextPage(result.hasNextPage ?? (resPage < resTotalPages));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load cases",
      );
      setCases([]);
      setCount(0);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !endpoint) return;
    setPage(1);
    fetchCases(1, limit);
  }, [isOpen, endpoint]);

  const handlePageChange = (newPage) => {
    const targetPage = Math.max(1, Math.min(newPage, totalPages));
    setPage(targetPage);
    fetchCases(targetPage, limit);
  };

  const handleLimitChange = (newLimit) => {
    const lim = Number(newLimit) || 10;
    setLimit(lim);
    setPage(1);
    fetchCases(1, lim);
  };

  const getPaginationPages = (currentPage, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", total];
    }
    if (currentPage >= total - 3) {
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", total];
  };

  useEffect(() => {
    if (!isOpen) {
      setNotesModal({
        open: false,
        patientName: "",
        patientId: "",
        enquiryId: "",
        notes: [],
      });
      setNoteText("");
      setNoteDate("");
      setNoteError({ note: false, date: false });
      setNoteSubmitting(false);
      setUpdatingStatusId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const enquiryAgingView = isEnquiryAgingList(endpoint, cases);
  const enquiryView = !enquiryAgingView && isEnquiryList(endpoint, cases);
  const treatmentPlanView =
    !enquiryAgingView && !enquiryView && isTreatmentPlanList(endpoint, cases);
  const appointmentView =
    !enquiryAgingView &&
    !enquiryView &&
    !treatmentPlanView &&
    isAppointmentList(endpoint, cases);
  const travelPatientView =
    !enquiryAgingView &&
    !enquiryView &&
    !treatmentPlanView &&
    !appointmentView &&
    isTravelPatientList(endpoint, cases);
  const patientAgingView =
    !enquiryAgingView &&
    !enquiryView &&
    !treatmentPlanView &&
    !appointmentView &&
    !travelPatientView &&
    isPatientAgingList(endpoint, cases);

  const openNotes = (row) => {
    const notes = Array.isArray(row?.discussionNotes)
      ? row.discussionNotes
      : Array.isArray(row?.discussion_notes)
        ? row.discussion_notes
        : [];
    setNoteText("");
    setNoteDate(new Date().toISOString().slice(0, 10));
    setNoteError({ note: false, date: false });
    setNotesModal({
      open: true,
      patientName:
        row?.patient_name || row?.patientName || row?.name || "Record",
      patientId: row?.patientId || "",
      enquiryId: row?.enquiryId || "",
      notes,
    });
  };

  const closeNotes = () => {
    setNotesModal({
      open: false,
      patientName: "",
      patientId: "",
      enquiryId: "",
      notes: [],
    });
    setNoteText("");
    setNoteDate("");
    setNoteError({ note: false, date: false });
    setNoteSubmitting(false);
  };

  const handleSubmitNote = async (e) => {
    e.preventDefault();
    const nextError = {
      note: !noteText.trim(),
      date: !noteDate,
    };
    setNoteError(nextError);
    if (nextError.note || nextError.date) return;

    const patientId = notesModal.patientId;
    const enquiryId = notesModal.enquiryId;
    if (!patientId && !enquiryId) {
      toast.error("Record ID missing — cannot add note");
      return;
    }

    setNoteSubmitting(true);
    try {
      if (patientId) {
        await addPatientNotes(patientId, {
          note: noteText.trim(),
          date: noteDate,
        });
      } else {
        await addEnquiryNotes(enquiryId, {
          note: noteText.trim(),
          date: noteDate,
        });
      }
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
      setCases((prev) =>
        prev.map((row) => {
          const samePatient = patientId && row.patientId === patientId;
          const sameEnquiry =
            !patientId && enquiryId && row.enquiryId === enquiryId;
          if (!samePatient && !sameEnquiry) return row;
          const existing = Array.isArray(row.discussionNotes)
            ? row.discussionNotes
            : Array.isArray(row.discussion_notes)
              ? row.discussion_notes
              : [];
          return {
            ...row,
            discussionNotes: [newNote, ...existing],
          };
        }),
      );
      setNoteText("");
      setNoteDate(new Date().toISOString().slice(0, 10));
      setNoteError({ note: false, date: false });
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

  const handleStatusChange = async (row, nextStatus) => {
    const statusValue = normalizePatientStatus(nextStatus);
    const current = normalizePatientStatus(row?.p_status || row?.status);
    if (!statusValue || statusValue === current) return;

    const patientId = row?.patientId;
    if (!patientId) {
      toast.error("Patient ID missing — cannot update status");
      return;
    }

    if (isTravelStatus(statusValue)) {
      setTravelStatusModal({
        open: true,
        patientId,
        patientName:
          row?.patient_name || row?.patientName || row?.name || "",
        status: statusValue,
      });
      return;
    }

    setUpdatingStatusId(patientId);
    try {
      const savedRaw = await changePatientStatus(patientId, statusValue);
      const savedStatus = normalizePatientStatus(savedRaw || statusValue);
      setCases((prev) =>
        prev.map((item) =>
          item.patientId === patientId
            ? { ...item, p_status: savedStatus, status: savedStatus }
            : item,
        ),
      );
      Swal.fire(
        "Success!",
        "Patient status updated successfully!",
        "success",
      );
    } catch (err) {
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
      setCases((prev) =>
        prev.map((item) =>
          item.patientId === patientId
            ? {
                ...item,
                p_status: savedStatus,
                status: savedStatus,
                travelDetails: payload.travelDetails || item.travelDetails,
              }
            : item,
        ),
      );
      setTravelStatusModal({
        open: false,
        patientId: "",
        patientName: "",
        status: "",
      });
      Swal.fire(
        "Success!",
        "Patient status updated successfully!",
        "success",
      );
    } catch (err) {
      console.error("Travel status update error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update travel status";
      toast.error(message);
    } finally {
      setTravelStatusSubmitting(false);
    }
  };

  const handleEnquiryStatusChange = async (row, nextStatus) => {
    const statusValue = getEnquiryStatusValue(nextStatus);
    const current = getEnquiryStatusValue(row?.enq_status || row?.status);
    if (statusValue === "" || statusValue === current) return;

    const enquiryId = row?.enquiryId;
    if (!enquiryId) {
      toast.error("Enquiry ID missing — cannot update status");
      return;
    }

    setUpdatingStatusId(enquiryId);
    try {
      let effectivePassport = String(row?.passport_num || row?.passport_number || "").trim();
      const hasUserId = Boolean((row?.user_id || row?.userId) && String(row?.user_id || row?.userId).trim() !== "");
      const isNewPatient = !row?.patientId && !hasUserId;

      if (Number(statusValue) === 1 && isNewPatient && !effectivePassport) {
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
          setUpdatingStatusId(null);
          return;
        }
        effectivePassport = enteredPassport.trim();
      }

      const res = await changeEnquiryStatus(enquiryId, statusValue, "OMCA Enquiry", {
        user_id: row?.user_id || row?.userId,
        patientId: row?.patientId || undefined,
        passport_num: effectivePassport || undefined,
      });

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
          const forcedRes = await changeEnquiryStatus(
            enquiryId,
            statusValue,
            "OMCA Enquiry",
            {
              user_id: row?.user_id || row?.userId,
              patientId: row?.patientId || undefined,
              passport_num: effectivePassport || undefined,
              forceCreate: true,
            },
          );

          if (forcedRes?.success === false) {
            toast.error(forcedRes.message || "Failed to update enquiry status");
            return;
          }

          const label = getEnquiryStatusLabel(statusValue);
          setCases((prev) =>
            prev.map((item) =>
              item.enquiryId === enquiryId
                ? { ...item, enq_status: label, status: label }
                : item,
            ),
          );
          Swal.fire(
            "Success!",
            forcedRes?.message || "Enquiry status updated successfully!",
            "success",
          );
        } else {
          Swal.fire({
            icon: "info",
            title: "New Phone Number Required",
            text: "Please use a different phone number before confirming this enquiry.",
          });
        }
        return;
      }

      const label = getEnquiryStatusLabel(statusValue);
      setCases((prev) =>
        prev.map((item) =>
          item.enquiryId === enquiryId
            ? { ...item, enq_status: label, status: label }
            : item,
        ),
      );
      Swal.fire(
        "Success!",
        "Enquiry status updated successfully!",
        "success",
      );
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update enquiry status. Please try again!";
      toast.error(message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleExport = async () => {
    if (!cases.length) {
      toast.info("No cases to export");
      return;
    }
    if (totalRecords > cases.length) {
      try {
        toast.info("Preparing complete export...");
        const res = await fetchCaseList(endpoint, { limit: "all" });
        if (res.data && res.data.length) {
          downloadCasesCsv(res.data, title || "cases");
          toast.success(`Exported ${res.data.length} cases`);
          return;
        }
      } catch (e) {
        console.warn("Complete export fallback:", e);
      }
    }
    downloadCasesCsv(cases, title || "cases");
    toast.success("Cases exported");
  };

  const renderStatusSelect = (row) => {
    const statusValue = normalizePatientStatus(row.p_status || row.status);
    if (!row.patientId) {
      return row.p_status || row.status || "—";
    }
    return (
      <select
        className={`msd-aging-status-select msd-status-${getPatientStatusBadgeKey(
          statusValue || row.p_status || row.status,
        )}`}
        value={statusValue || ""}
        disabled={updatingStatusId === row.patientId}
        onChange={(e) => handleStatusChange(row, e.target.value)}
        aria-label={`Change status for ${
          row.patient_name || row.patientName || row.name || "patient"
        }`}
      >
        <option value="" disabled>
          Select Status
        </option>
        {!PATIENT_STATUS_OPTIONS.some(
          (option) => option.value === statusValue,
        ) &&
          (row.p_status || row.status) && (
            <option value={row.p_status || row.status}>
              {getPatientStatusLabel(row.p_status || row.status) ||
                row.p_status ||
                row.status}
            </option>
          )}
        {PATIENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

  const renderEnquiryStatusSelect = (row) => {
    const rawStatus = row.enq_status || row.status || "";
    const statusValue = getEnquiryStatusValue(rawStatus);
    if (!row.enquiryId) {
      return rawStatus || "—";
    }
    return (
      <select
        className={`msd-aging-status-select msd-status-${getEnquiryStatusBadgeKey(
          statusValue === "" ? rawStatus : statusValue,
        )}`}
        value={statusValue === "" ? "" : String(statusValue)}
        disabled={updatingStatusId === row.enquiryId}
        onChange={(e) => handleEnquiryStatusChange(row, e.target.value)}
        aria-label={`Change status for ${row.name || "enquiry"}`}
      >
        <option value="" disabled>
          Select Status
        </option>
        {statusValue === "" && rawStatus ? (
          <option value={rawStatus}>{rawStatus}</option>
        ) : null}
        {ENQUIRY_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

  const renderPatientActions = (row) => {
    const notesCount = Array.isArray(row.discussionNotes)
      ? row.discussionNotes.length
      : Array.isArray(row.discussion_notes)
        ? row.discussion_notes.length
        : 0;
    return (
      <div className="msd-aging-actions">
        {row.patientId || row.enquiryId ? (
          <button
            type="button"
            className="msd-aging-view-btn msd-aging-notes-btn"
            title="View / Add Notes"
            onClick={() => openNotes(row)}
          >
            <i className="fa fa-sticky-note-o" aria-hidden="true"></i>
            Notes{notesCount > 0 ? ` (${notesCount})` : ""}
          </button>
        ) : null}
        <button
          type="button"
          className="msd-aging-view-btn"
          onClick={() => navigateToRecord(navigate, row)}
        >
          View
        </button>
      </div>
    );
  };

  const safePage = Math.min(page, Math.max(1, totalPages));
  const pageStart = totalRecords === 0 ? 0 : (safePage - 1) * limit + 1;
  const pageEnd = Math.min(safePage * limit, totalRecords);

  return (
    <>
      <div className="msd-modal-overlay" onClick={onClose} role="presentation">
        <div
          className="msd-modal-panel msd-case-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-list-title"
        >
          <div className="msd-modal-head">
            <h5
              id="case-list-title"
              className="msd-case-modal-title"
              title={cleanModalTitle(title)}
            >
              {cleanModalTitle(title)}
            </h5>
            <span className="msd-modal-count">{totalRecords || count} case(s)</span>
            <button
              type="button"
              className="msd-aging-export-btn msd-case-export-btn"
              onClick={handleExport}
              disabled={loading || cases.length === 0}
              title="Export cases"
            >
              <i className="fa fa-download" aria-hidden="true"></i> Export
            </button>
            <button
              type="button"
              className="msd-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa fa-times"></i>
            </button>
          </div>

          <div className="msd-modal-body">
            {loading && (
              <div className="msd-modal-loading">Loading cases…</div>
            )}
            {error && !loading && (
              <div className="msd-modal-error">{error}</div>
            )}
            {!loading && !error && cases.length === 0 && (
              <div className="msd-aging-empty">No cases found.</div>
            )}
            {!loading && !error && cases.length > 0 && (
              <div className="msd-case-table-wrap">
                <table className="msd-aging-table msd-case-table">
                  <thead>
                    <tr>
                      {enquiryAgingView ? (
                        <>
                          <th className="msd-col-patient">Name</th>
                          <th className="msd-col-id">Enquiry ID</th>
                          <th className="msd-col-disease">Disease</th>
                          <th className="msd-col-stage">Stage</th>
                          <th className="msd-col-waiting">Waiting</th>
                          <th className="msd-col-status">Status</th>
                          <th className="msd-col-priority">Priority</th>
                          <th className="msd-col-action">Action</th>
                        </>
                      ) : enquiryView ? (
                        <>
                          <th>Name</th>
                          <th>Enquiry ID</th>
                          <th>Status</th>
                          <th>Disease</th>
                          <th>Created</th>
                          <th>Action</th>
                        </>
                      ) : treatmentPlanView ? (
                        <>
                          <th>Patient ID</th>
                          <th>Treatment</th>
                          <th>Hospital</th>
                          <th>Status</th>
                          <th>Issued</th>
                          <th>Action</th>
                        </>
                      ) : appointmentView ? (
                        <>
                          <th>Patient</th>
                          <th>Patient ID</th>
                          <th>Hospital</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Mode</th>
                          <th>Status</th>
                          <th>Action</th>
                        </>
                      ) : travelPatientView ? (
                        <>
                          <th>Patient</th>
                          <th>Patient ID</th>
                          <th>Travel Date</th>
                          <th>Time</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Services</th>
                          <th>Status</th>
                          <th>Action</th>
                        </>
                      ) : patientAgingView ? (
                        <>
                          <th className="msd-col-patient">Patient</th>
                          <th className="msd-col-id">Patient ID</th>
                          <th className="msd-col-stage">Stage</th>
                          <th className="msd-col-waiting">Waiting</th>
                          <th className="msd-col-status">Status</th>
                          <th className="msd-col-priority">Priority</th>
                          <th className="msd-col-action">Action</th>
                        </>
                      ) : (
                        <>
                          <th>Patient</th>
                          <th>ID</th>
                          <th>Stage</th>
                          <th>Waiting</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Action</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((row, idx) => {
                      if (enquiryAgingView) {
                        const priority = agingToPriority(row);
                        return (
                          <tr
                            key={row.enquiryId || row._id || idx}
                            className={`msd-aging-row-${priority}`}
                          >
                            <td className="msd-col-patient">
                              {row.name || "—"}
                            </td>
                            <td className="msd-col-id">
                              {row.enquiryId || "—"}
                            </td>
                            <td className="msd-col-disease">
                              {row.disease_name || "—"}
                            </td>
                            <td className="msd-col-stage">
                              {row.stageLabel || "—"}
                            </td>
                            <td className="msd-col-waiting">
                              {formatPatientWaiting(row)}
                            </td>
                            <td className="msd-col-status">
                              {renderEnquiryStatusSelect(row)}
                            </td>
                            <td className="msd-col-priority">
                              <span
                                className={`msd-badge msd-badge-${priority}`}
                              >
                                {row.priority ||
                                  priorityBadgeLabel[priority] ||
                                  "—"}
                              </span>
                            </td>
                            <td className="msd-col-action">
                              {renderPatientActions(row)}
                            </td>
                          </tr>
                        );
                      }

                      if (enquiryView) {
                        return (
                          <tr key={row.enquiryId || row._id || idx}>
                            <td>{row.name || "—"}</td>
                            <td>{row.enquiryId || "—"}</td>
                            <td>
                              {row.enquiryId
                                ? renderEnquiryStatusSelect(row)
                                : row.enq_status || row.status || "—"}
                            </td>
                            <td>{row.disease_name || "—"}</td>
                            <td>{formatCaseDate(row.createdAt)}</td>
                            <td>
                              {row.enquiryId
                                ? renderPatientActions(row)
                                : (
                                    <button
                                      type="button"
                                      className="msd-aging-view-btn"
                                      onClick={() =>
                                        navigateToRecord(navigate, row)
                                      }
                                    >
                                      View
                                    </button>
                                  )}
                            </td>
                          </tr>
                        );
                      }

                      if (treatmentPlanView) {
                        return (
                          <tr key={row.patientId || row._id || idx}>
                            <td>{row.patientId || "—"}</td>
                            <td>
                              {row.treatment?.name ||
                                row.treatmentName ||
                                "—"}
                            </td>
                            <td>{formatHospitalNames(row.hospitals)}</td>
                            <td>
                              <div className="stinker-case-status">
                                <span>{formatHospitalStatus(row.hospitals)}</span>
                                <StinkerBadges plan={row} />
                              </div>
                            </td>
                            <td>{formatCaseDate(row.createdAt)}</td>
                            <td>
                              <div className="msd-aging-actions">
                                {row.patientId ? (
                                  <button
                                    type="button"
                                    className="msd-aging-view-btn msd-aging-notes-btn"
                                    title="View / Add Notes"
                                    onClick={() => openNotes(row)}
                                  >
                                    <i
                                      className="fa fa-sticky-note-o"
                                      aria-hidden="true"
                                    ></i>
                                    Notes
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="msd-aging-view-btn"
                                  onClick={() =>
                                    navigateToRecord(navigate, row)
                                  }
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      if (appointmentView) {
                        return (
                          <tr key={row.patientId || row._id || idx}>
                            <td>
                              {row.patientName ||
                                row.patient_name ||
                                row.name ||
                                "—"}
                            </td>
                            <td>{row.patientId || "—"}</td>
                            <td>
                              {row.hospitalName || row.hospital || "—"}
                            </td>
                            <td>
                              {formatAppointmentDate(row.appointment_Date)}
                            </td>
                            <td>{row.appointment_Time || "—"}</td>
                            <td>{row.mode || "—"}</td>
                            <td>{row.status || "—"}</td>
                            <td>
                              <button
                                type="button"
                                className="msd-aging-view-btn"
                                onClick={() =>
                                  navigateToRecord(navigate, row)
                                }
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      if (travelPatientView) {
                        const travelDateVal = row.travelDetails?.travelDate
                          ? formatAppointmentDate(row.travelDetails.travelDate)
                          : "—";
                        return (
                          <tr key={row.patientId || row._id || idx}>
                            <td>
                              {row.patient_name ||
                                row.patientName ||
                                row.name ||
                                "—"}
                            </td>
                            <td>{row.patientId || "—"}</td>
                            <td>{travelDateVal}</td>
                            <td>{row.travelDetails?.arrivalTime || "—"}</td>
                            <td title={row.travelDetails?.from || ""}>
                              {row.travelDetails?.from || "—"}
                            </td>
                            <td title={row.travelDetails?.to || ""}>
                              {row.travelDetails?.to || "—"}
                            </td>
                            <td>{row.travelDetails?.services || "—"}</td>
                            <td>{renderStatusSelect(row)}</td>
                            <td>
                              <div className="msd-aging-actions">
                                {(row.patientId || row.enquiryId) ? (
                                  <button
                                    type="button"
                                    className="msd-aging-view-btn msd-aging-notes-btn"
                                    title="View / Add Notes"
                                    onClick={() => openNotes(row)}
                                  >
                                    <i className="fa fa-sticky-note-o" aria-hidden="true"></i>
                                    Notes
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="msd-aging-view-btn"
                                  onClick={async () => {
                                    if (row.patientId) {
                                      try {
                                        await fetchTravelPatientDetail(row.patientId);
                                      } catch (err) {
                                        console.warn("Travel detail fetch:", err.message);
                                      }
                                    }
                                    navigateToRecord(navigate, row);
                                  }}
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      if (patientAgingView) {
                        const priority = agingToPriority(row);
                        return (
                          <tr
                            key={row.patientId || row._id || idx}
                            className={`msd-aging-row-${priority}`}
                          >
                            <td className="msd-col-patient">
                              {row.patient_name ||
                                row.patientName ||
                                row.name ||
                                "—"}
                            </td>
                            <td className="msd-col-id">
                              {row.patientId || "—"}
                            </td>
                            <td className="msd-col-stage">
                              {row.stageLabel || "—"}
                            </td>
                            <td className="msd-col-waiting">
                              {formatPatientWaiting(row)}
                            </td>
                            <td className="msd-col-status">
                              {renderStatusSelect(row)}
                            </td>
                            <td className="msd-col-priority">
                              <span
                                className={`msd-badge msd-badge-${priority}`}
                              >
                                {row.priority ||
                                  priorityBadgeLabel[priority] ||
                                  "—"}
                              </span>
                            </td>
                            <td className="msd-col-action">
                              {renderPatientActions(row)}
                            </td>
                          </tr>
                        );
                      }

                      const priority = agingToPriority(row);
                      return (
                        <tr
                          key={row.patientId || row._id || idx}
                          className={`msd-aging-row-${priority}`}
                        >
                          <td>
                            {row.patient_name ||
                              row.patientName ||
                              row.name ||
                              "—"}
                          </td>
                          <td>{row.patientId || row.enquiryId || "—"}</td>
                          <td>
                            {row.stageLabel || row.waitingLabel || "—"}
                          </td>
                          <td>
                            {formatWaitingDuration(row.waitingLabel) || "—"}
                          </td>
                          <td>
                            {row.patientId
                              ? renderStatusSelect(row)
                              : row.p_status || row.status || "—"}
                          </td>
                          <td>
                            <span
                              className={`msd-badge msd-badge-${priority}`}
                            >
                              {row.priority ||
                                priorityBadgeLabel[priority] ||
                                "—"}
                            </span>
                          </td>
                          <td>
                            {row.patientId
                              ? renderPatientActions(row)
                              : (
                                  <button
                                    type="button"
                                    className="msd-aging-view-btn"
                                    onClick={() =>
                                      navigateToRecord(navigate, row)
                                    }
                                  >
                                    View
                                  </button>
                                )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalRecords > 0 && (
            <div className="msd-case-modal-footer">
              <div className="msd-aging-pagination">
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <span className="msd-aging-page-info">
                    Showing {pageStart}–{pageEnd} of {totalRecords} cases
                  </span>
                  <div className="msd-aging-limit-wrap">
                    <span>Per page:</span>
                    <select
                      className="msd-aging-limit-select"
                      value={limit}
                      onChange={(e) => handleLimitChange(e.target.value)}
                      aria-label="Cases per page"
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
                    disabled={safePage <= 1 || loading}
                    onClick={() => handlePageChange(1)}
                  >
                    <i className="fa fa-angle-double-left" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    className="msd-aging-page-btn"
                    title="Previous Page"
                    disabled={!hasPrevPage || safePage <= 1 || loading}
                    onClick={() => handlePageChange(safePage - 1)}
                  >
                    <i className="fa fa-angle-left" aria-hidden="true"></i>
                  </button>
                  <div className="msd-aging-page-numbers">
                    {getPaginationPages(safePage, totalPages).map((pItem, pIdx) =>
                      pItem === "..." ? (
                        <span key={`ellipsis-${pIdx}`} className="msd-aging-page-btn-ellipsis">
                          …
                        </span>
                      ) : (
                        <button
                          key={`page-${pItem}`}
                          type="button"
                          className={`msd-aging-page-btn ${pItem === safePage ? "active" : ""}`}
                          disabled={loading}
                          onClick={() => handlePageChange(pItem)}
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
                    disabled={!hasNextPage || safePage >= totalPages || loading}
                    onClick={() => handlePageChange(safePage + 1)}
                  >
                    <i className="fa fa-angle-right" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    className="msd-aging-page-btn"
                    title="Last Page"
                    disabled={safePage >= totalPages || loading}
                    onClick={() => handlePageChange(totalPages)}
                  >
                    <i className="fa fa-angle-double-right" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {notesModal.open && (
        <div
          className="msd-modal-overlay msd-notes-overlay"
          onClick={closeNotes}
          role="presentation"
        >
          <div
            className="msd-modal-panel msd-notes-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-notes-title"
          >
            <div className="msd-modal-head">
              <h5 id="case-notes-title" className="msd-case-modal-title">
                Notes – {notesModal.patientName}
              </h5>
              {notesModal.patientId || notesModal.enquiryId ? (
                <span className="msd-modal-count">
                  {notesModal.patientId || notesModal.enquiryId}
                </span>
              ) : null}
              <button
                type="button"
                className="msd-modal-close"
                onClick={closeNotes}
                aria-label="Close"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="msd-modal-body">
              {notesModal.patientId || notesModal.enquiryId ? (
                <form className="msd-notes-form" onSubmit={handleSubmitNote}>
                  <div className="msd-notes-form-row">
                    <label htmlFor="case-note-text">
                      Add Note<span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="case-note-text"
                      rows={3}
                      className="msd-notes-textarea"
                      placeholder="Enter note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      disabled={noteSubmitting}
                    />
                    {noteError.note ? (
                      <span className="msd-notes-error">
                        Please enter a note
                      </span>
                    ) : null}
                  </div>
                  <div className="msd-notes-form-row">
                    <label htmlFor="case-note-date">
                      Date<span className="text-danger">*</span>
                    </label>
                    <input
                      id="case-note-date"
                      type="date"
                      className="msd-notes-date"
                      value={noteDate}
                      onChange={(e) => setNoteDate(e.target.value)}
                      disabled={noteSubmitting}
                    />
                    {noteError.date ? (
                      <span className="msd-notes-error">
                        Please select a date
                      </span>
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
                    Record ID missing — notes cannot be added.
                  </div>
                )}

                <div className="msd-notes-divider">Existing Notes</div>

                {notesModal.notes.length === 0 ? (
                  <div className="msd-aging-empty">
                    No notes for this patient.
                  </div>
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
                        <p className="msd-notes-item-text">
                          {item.note || "—"}
                        </p>
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
    </>
  );
}
