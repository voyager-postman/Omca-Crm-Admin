import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import CountUp from "react-countup";
import { baseurl } from "../../Basurl/Baseurl";
import { getInsuranceId } from "../../utils/authStorage";
import InsurancePatientPaymentModal from "../../pages/Insurance/InsurancePatientPaymentModal";
import {
  fetchInsurancePatientPayments,
  fetchInsurancePaymentSummary,
  fetchInsuranceAppointments,
  fetchInsuranceMessages,
  fetchInsuranceDashboard,
  fetchInsurancePatients,
} from "../../services/insuranceApi";
import "./InsuranceDashboard.css";

const STATIC_TREND = [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 8];

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

// Helper formatters
const formatDate = (dateVal) => {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
};

const formatEmergencyContact = (item) => {
  if (!item) return "—";
  const rawNum =
    item.emergency_contact ??
    item.patient_emergency_contact_no ??
    item.emergency_contact_no ??
    item.patient_relation_no ??
    item.phone ??
    item.mobile ??
    item.phone_no ??
    "";
  const phone = String(rawNum).trim();
  if (!phone || phone === "undefined" || phone === "null") return "—";
  const code = String(item.dial_code || item.phone_code || item.phoneCode || "").trim();
  if (code && !phone.startsWith("+")) {
    const cleanCode = code.startsWith("+") ? code : `+${code}`;
    return `${cleanCode} ${phone}`;
  }
  return phone;
};

const getStatusBadgeClass = (status) => {
  if (!status) return "ins-badge-pending";
  const s = String(status).toLowerCase();
  if (
    s.includes("active") ||
    s.includes("completed") ||
    s.includes("admitted") ||
    s.includes("success") ||
    s.includes("converted")
  ) {
    return "ins-badge-active";
  }
  if (s.includes("progress") || s.includes("consultation") || s.includes("review")) {
    return "ins-badge-info";
  }
  if (
    s.includes("cancel") ||
    s.includes("reject") ||
    s.includes("closed") ||
    s.includes("lost")
  ) {
    return "ins-badge-closed";
  }
  return "ins-badge-pending";
};

const mapMenuIcon = (iconStr) => {
  switch (iconStr) {
    case "dashboard":
      return "fa fa-dashboard";
    case "users":
      return "fa fa-users";
    case "medical-bag":
      return "fa fa-medkit";
    case "file-invoice-dollar":
      return "fa fa-file-text-o";
    case "hospital":
      return "fa fa-hospital-o";
    case "plane":
      return "fa fa-plane";
    case "ambulance":
      return "fa fa-ambulance";
    case "home-heart":
      return "fa fa-heartbeat";
    case "stethoscope":
      return "fa fa-stethoscope";
    case "credit-card":
      return "fa fa-credit-card";
    case "chart-line":
      return "fa fa-line-chart";
    case "envelope":
      return "fa fa-envelope";
    case "calendar-check":
      return "fa fa-calendar-check-o";
    default:
      return "fa fa-th-large";
  }
};

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export default function InsuranceDashboard({ insuranceId }) {
  const navigate = useNavigate();
  const myInsuranceId =
    insuranceId ||
    getInsuranceId() ||
    localStorage.getItem("insurance_id") ||
    localStorage.getItem("insurance_mysql_id") ||
    localStorage.getItem("_id") ||
    "";
  const token = localStorage.getItem("token") || "";

  // -------------------------------------------------------------
  // 0. All-in-One Dashboard State (/insurance/dashboard)
  // -------------------------------------------------------------
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [activityTab, setActivityTab] = useState("enquiries"); // 'enquiries' | 'patients' | 'cases' | 'emergencies' | 'appointments'
  const [activityPages, setActivityPages] = useState({
    enquiries: 1,
    patients: 1,
    cases: 1,
    emergencies: 1,
    appointments: 1,
  });

  // -------------------------------------------------------------
  // 1. Enquiries State
  // -------------------------------------------------------------
  const [enquiries, setEnquiries] = useState([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(true);
  const [enquiryError, setEnquiryError] = useState(null);

  // -------------------------------------------------------------
  // 2. Patients State
  // -------------------------------------------------------------
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientTotal, setPatientTotal] = useState(0);
  const [patientError, setPatientError] = useState(null);

  // -------------------------------------------------------------
  // 2.2 Appointments State
  // -------------------------------------------------------------
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsTotal, setAppointmentsTotal] = useState(0);
  const [appointmentError, setAppointmentError] = useState(null);

  // -------------------------------------------------------------
  // 2.3 Messages State
  // -------------------------------------------------------------
  const [messages, setMessages] = useState([]);
  const [messagesTotal, setMessagesTotal] = useState(0);

  // -------------------------------------------------------------
  // 2.4 Financials & Settlement State
  // -------------------------------------------------------------
  const [financials, setFinancials] = useState({
    total_paid: 0,
    total_claim: 0,
    total_settled: 0,
    total_pending: 0,
  });
  const [, setPatientPaymentsMap] = useState({});
  const [selectedLedgerPatient, setSelectedLedgerPatient] = useState(null);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  // -------------------------------------------------------------
  // 3. "See All" Modal State
  // -------------------------------------------------------------
  const [activeModal, setActiveModal] = useState(null); // 'enquiries' | 'patients' | 'appointments' | 'messages' | null
  const [modalSearch, setModalSearch] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("ALL");
  const [modalPage, setModalPage] = useState(1);
  const modalPageSize = 10;

  // -------------------------------------------------------------
  // 4. Read-Only Record Detail Modal
  // -------------------------------------------------------------
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordType, setRecordType] = useState(null); // 'enquiry' | 'patient' | 'appointment' | 'message'

  // Fetch Enquiries
  const fetchEnquiries = useCallback(async () => {
    setEnquiriesLoading(true);
    setEnquiryError(null);
    try {
      if (myInsuranceId) {
        const res = await fetchInsuranceDashboard(myInsuranceId, {
          paginate: false,
          enquiries_limit: "all",
        });
        const list =
          res?.all_enquiries ||
          res?.allEnquiries ||
          res?.enquiries ||
          res?.recent_activity?.all_enquiries;
        if (Array.isArray(list) && list.length > 0) {
          setEnquiries(list);
          setEnquiriesLoading(false);
          return;
        }
      }

      const params = {};
      if (myInsuranceId) {
        params.insurance_id = myInsuranceId;
      }
      const res = await axios.get(`${baseurl}all_Enq`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
      });

      let list = [];
      if (Array.isArray(res.data?.details)) {
        list = res.data.details;
      } else if (Array.isArray(res.data?.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }
      setEnquiries(list);
    } catch (err) {
      console.warn("Insurance Enquiries fetch note:", err?.message || err);
    } finally {
      setEnquiriesLoading(false);
    }
  }, [myInsuranceId, token]);

  // Fetch Patients
  const fetchPatients = useCallback(async () => {
    setPatientsLoading(true);
    setPatientError(null);
    try {
      const params = {
        page: 1,
        limit: 10,
        search: "",
      };
      if (myInsuranceId) {
        params.insurance_id = myInsuranceId;
      }
      const res = await fetchInsurancePatients(myInsuranceId, params);

      let list = [];
      let total = 0;
      if (Array.isArray(res?.patients)) {
        list = res.patients;
        total = res.total ?? res.pagination?.total ?? list.length;
      } else if (Array.isArray(res?.data)) {
        list = res.data;
        total = res.total ?? res.pagination?.total ?? list.length;
      } else if (Array.isArray(res)) {
        list = res;
        total = list.length;
      }

      if (list.length === 0) {
        const fbRes = await axios.get(`${baseurl}all_patients`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          params,
        });
        if (Array.isArray(fbRes.data?.details)) {
          list = fbRes.data.details;
          total = fbRes.data.pagination?.total ?? list.length;
        } else if (Array.isArray(fbRes.data?.data)) {
          list = fbRes.data.data;
          total = fbRes.data.total ?? list.length;
        }
      }

      setPatients(list);
      setPatientTotal(total);
    } catch (err) {
      console.warn("Insurance Patients fetch note:", err?.message || err);
    } finally {
      setPatientsLoading(false);
    }
  }, [myInsuranceId, token]);

  // Fetch Appointments
  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentError(null);
    try {
      const params = {
        page: 1,
        limit: 10,
      };
      if (myInsuranceId) {
        params.insurance_id = myInsuranceId;
      }
      const res = await fetchInsuranceAppointments(params);
      let list = [];
      let total = 0;
      if (Array.isArray(res?.data)) {
        list = res.data;
        total = res.total ?? list.length;
      } else if (Array.isArray(res?.appointments)) {
        list = res.appointments;
        total = res.total ?? list.length;
      } else if (Array.isArray(res?.details)) {
        list = res.details;
        total = res.pagination?.total ?? list.length;
      } else if (Array.isArray(res)) {
        list = res;
        total = list.length;
      }
      setAppointments(list);
      setAppointmentsTotal(total);
    } catch (err) {
      console.error("Insurance Appointments fetch error:", err);
      setAppointmentError(err.message || "Failed to load appointments");
      setAppointments([]);
      setAppointmentsTotal(0);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [myInsuranceId]);

  // Fetch Messages
  const fetchMessages = useCallback(async () => {
    try {
      const params = {};
      if (myInsuranceId) {
        params.insurance_id = myInsuranceId;
      }
      const res = await fetchInsuranceMessages(params);
      let list = [];
      let total = 0;
      if (Array.isArray(res?.data)) {
        list = res.data;
        total = res.total ?? list.length;
      } else if (Array.isArray(res?.details)) {
        list = res.details;
        total = res.pagination?.total ?? list.length;
      } else if (Array.isArray(res?.messages)) {
        list = res.messages;
        total = list.length;
      } else if (Array.isArray(res)) {
        list = res;
        total = list.length;
      }
      setMessages(list);
      setMessagesTotal(total);
    } catch (err) {
      console.error("Insurance Messages fetch error:", err);
      setMessages([]);
      setMessagesTotal(0);
    }
  }, [myInsuranceId]);

  // Fetch Financials & Claim / Settlement
  const fetchFinancials = useCallback(async () => {
    if (!myInsuranceId) return;
    try {
      const [paymentsRes, summaryRes] = await Promise.allSettled([
        fetchInsurancePatientPayments({ insurance_id: myInsuranceId }),
        fetchInsurancePaymentSummary(myInsuranceId),
      ]);

      const map = {};
      let totalPaid = 0;
      let totalClaim = 0;
      let totalSettled = 0;

      if (paymentsRes.status === "fulfilled" && paymentsRes.value) {
        const pList =
          paymentsRes.value.patients ||
          paymentsRes.value.data ||
          paymentsRes.value.paymentDetails ||
          [];
        if (Array.isArray(pList)) {
          pList.forEach((p) => {
            const k1 = p.patientId || p.patient_id || p.id;
            const k2 = p.omcaPatientId || p.omca_patient_id;
            if (k1) map[String(k1)] = p;
            if (k2) map[String(k2)] = p;
            let pPaid = Number(p.total_paid ?? p.payments_received ?? p.paid_bill ?? p.paid_amount ?? 0);
            if (pPaid > 365 && pPaid < 430) {
              // Exclude OMCA non-treatment charges 20.111
              pPaid = pPaid > 20.111 ? Math.round((pPaid - 20.111) * 100) / 100 : 390;
            }
            totalPaid += pPaid;
            totalClaim += Number(p.insurance_on_paid ?? p.claim_amount ?? p.decided_amount ?? 0);
            totalSettled += Number(p.total_given ?? p.total_settled ?? 0);
          });
        }
      }

      if (summaryRes.status === "fulfilled" && summaryRes.value?.success) {
        const s = summaryRes.value.summary || summaryRes.value.data || summaryRes.value;
        if (s) {
          totalPaid = Number(s.total_patient_paid ?? s.total_payments_received ?? s.total_paid ?? totalPaid);
          totalClaim = Number(s.total_commission ?? s.total_claim_amount ?? s.total_decided ?? totalClaim);
          totalSettled = Number(s.total_given ?? s.total_settled_amount ?? s.total_paid ?? totalSettled);
        }
      }

      setPatientPaymentsMap(map);
      setFinancials({
        total_paid: totalPaid,
        total_claim: totalClaim,
        total_settled: totalSettled,
        total_pending: Math.max(0, totalClaim - totalSettled),
      });
    } catch (e) {
      console.warn("Could not load insurance financial stats:", e);
    }
  }, [myInsuranceId]);

  // Fetch All-in-One Insurance Dashboard Data
  const fetchDashboardData = useCallback(
    async (overrides = {}) => {
      setDashboardLoading(true);
      try {
        const curPages = overrides.pages || activityPages;
        const params = {
          insurance_id: myInsuranceId,
          limit: 10,
          enquiries_page: curPages.enquiries || 1,
          enquiries_limit: 10,
          patients_page: curPages.patients || 1,
          patients_limit: 10,
          cases_page: curPages.cases || 1,
          cases_limit: 10,
          emergencies_page: curPages.emergencies || 1,
          emergencies_limit: 10,
          appointments_page: curPages.appointments || 1,
          appointments_limit: 10,
          ...overrides,
        };
        delete params.pages;

        const res = await fetchInsuranceDashboard(myInsuranceId, params);
        if (
          res &&
          (res.success ||
            res.dashboard_statistics ||
            res.dashboardStatistics ||
            res.company_information ||
            res.recent_activity)
        ) {
          setDashboardData(res);
          const enqList = res.all_enquiries || res.allEnquiries || res.enquiries;
          if (Array.isArray(enqList) && enqList.length > 0) {
            setEnquiries(enqList);
          }
          const ptList = res.recent_activity?.recent_patients || res.recentPatients;
          if (Array.isArray(ptList) && ptList.length > 0) {
            setPatients((prev) => (prev.length === 0 ? ptList : prev));
          }
        }
      } catch (err) {
        console.warn("Insurance dashboard data fetch error:", err);
      } finally {
        setDashboardLoading(false);
      }
    },
    [myInsuranceId, activityPages]
  );

  const handleActivityPageChange = (tab, newPage) => {
    if (newPage < 1) return;
    const p =
      dashboardData?.recent_activity?.pagination?.[tab] ||
      dashboardData?.recentActivity?.pagination?.[tab] ||
      dashboardData?.pagination?.[tab] ||
      {};
    if (p.totalPages && newPage > p.totalPages) return;

    const updatedPages = { ...activityPages, [tab]: newPage };
    setActivityPages(updatedPages);
    const paramKey = `${tab}_page`;
    fetchDashboardData({ pages: updatedPages, [paramKey]: newPage });
  };

  useEffect(() => {
    fetchDashboardData();
    fetchEnquiries();
    fetchPatients();
    fetchAppointments();
    fetchMessages();
    fetchFinancials();
  }, [fetchDashboardData, fetchEnquiries, fetchPatients, fetchAppointments, fetchMessages, fetchFinancials]);

  const handleMenuCardClick = (item) => {
    if (!item) return;
    if (item.key === "dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (item.key === "members") {
      setActivityTab("patients");
      document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.key === "medical_cases") {
      setActivityTab("cases");
      document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.key === "claims") {
      navigate("/Admin/insurances");
      return;
    }
    if (item.key === "appointment") {
      setActivityTab("appointments");
      document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.key === "messages") {
      handleOpenSeeAll("messages");
      return;
    }
    if (item.key === "ambulance_services") {
      setActivityTab("emergencies");
      document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (
      item.key === "local_healthcare" ||
      item.key === "international_treatment" ||
      item.key === "home_care" ||
      item.key === "diagnostic_clinic"
    ) {
      setActivityTab("cases");
      document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.key === "payments") {
      navigate("/Admin/insurances");
      return;
    }
    if (item.key === "reports") {
      navigate("/Admin/Reports");
      return;
    }
    if (item.path) {
      navigate(item.path);
    }
  };

  // Navigate to Patient-Detail page
  const handleNavigateToPatientDetail = (pt) => {
    if (!pt) return;
    const targetPid =
      pt.patientId ||
      pt.patient_id ||
      pt.omcaPatientId ||
      pt.omca_patient_id ||
      pt._id ||
      pt.id;
    const patientNumber =
      pt.patientNumber ||
      pt.patient_number ||
      pt.patientId ||
      pt.patient_id ||
      pt.omcaPatientId ||
      pt.omca_patient_id;
    const userId = pt.user_id || pt.userId || pt.id;

    if (targetPid) {
      sessionStorage.setItem("patient_detail_patientId", targetPid);
    }
    if (userId) {
      sessionStorage.setItem("patient_detail_userId", String(userId));
    }

    navigate("/Admin/Patient-Detail", {
      state: {
        patientId: targetPid,
        patientNumber: patientNumber,
        user_id: userId,
        createdAt: pt.createdAt || pt.created_at || pt.date,
      },
    });
  };

  const handleOpenLedger = (item) => {
    setSelectedLedgerPatient(item);
    setLedgerModalOpen(true);
  };

  // Open "See All" modal
  const handleOpenSeeAll = (type) => {
    setActiveModal(type);
    setModalSearch("");
    setModalStatusFilter("ALL");
    setModalPage(1);
  };

  const handleCloseSeeAll = () => {
    setActiveModal(null);
    setModalSearch("");
    setModalStatusFilter("ALL");
  };

  // Open read-only details modal
  const handleViewRecord = (item, type) => {
    setSelectedRecord(item);
    setRecordType(type);
  };

  const handleCloseDetail = () => {
    setSelectedRecord(null);
    setRecordType(null);
  };

  // Unified sources for all enquiries & patients (ensures data is always available from dashboard or list API)
  const allEnquiriesSource = useMemo(() => {
    if (Array.isArray(enquiries) && enquiries.length > 0) {
      return enquiries;
    }
    if (Array.isArray(dashboardData?.all_enquiries) && dashboardData.all_enquiries.length > 0) {
      return dashboardData.all_enquiries;
    }
    if (Array.isArray(dashboardData?.allEnquiries) && dashboardData.allEnquiries.length > 0) {
      return dashboardData.allEnquiries;
    }
    if (Array.isArray(dashboardData?.enquiries) && dashboardData.enquiries.length > 0) {
      return dashboardData.enquiries;
    }
    return [];
  }, [enquiries, dashboardData]);

  const allPatientsSource = useMemo(() => {
    if (Array.isArray(patients) && patients.length > 0) {
      return patients;
    }
    const recent =
      dashboardData?.recent_activity?.recent_patients ||
      dashboardData?.recentActivity?.recentPatients;
    if (Array.isArray(recent) && recent.length > 0) {
      return recent;
    }
    return [];
  }, [patients, dashboardData]);

  // Filtered lists for "See All" modal
  const filteredEnquiries = useMemo(() => {
    return allEnquiriesSource.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const name = String(
        item.name || item.patient_name || item.patientName || ""
      ).toLowerCase();
      const id = String(
        item.enquiry_id || item.enquiryId || item.id || item._id || ""
      ).toLowerCase();
      const phone = String(
        item.phone || item.mobile || item.contact_no || item.phone_number || ""
      ).toLowerCase();
      const country = String(item.country || item.nationality || "").toLowerCase();
      const status = String(item.status || "").toLowerCase();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        id.includes(q) ||
        phone.includes(q) ||
        country.includes(q);
      const matchesStatus =
        modalStatusFilter === "ALL" || status === modalStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [allEnquiriesSource, modalSearch, modalStatusFilter]);

  const filteredPatients = useMemo(() => {
    return allPatientsSource.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const name = String(item.patient_name || item.name || "").toLowerCase();
      const id = String(
        item.patientId ||
          item.patientNumber ||
          item.omca_patient_id ||
          item._id ||
          ""
      ).toLowerCase();
      const phone = String(formatEmergencyContact(item)).toLowerCase();
      const country = String(item.country || "").toLowerCase();
      const status = String(item.p_status || item.status || "").toLowerCase();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        id.includes(q) ||
        phone.includes(q) ||
        country.includes(q);
      const matchesStatus =
        modalStatusFilter === "ALL" || status === modalStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [allPatientsSource, modalSearch, modalStatusFilter]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const id = String(
        item.appointment_id || item.appointmentId || item.id || item._id || ""
      ).toLowerCase();
      const patName = String(
        item.patient_name || item.patientName || item.patient_id?.patient_name || item.name || ""
      ).toLowerCase();
      const hospital = String(
        item.hospital_name || item.hospitalName || item.treatingIn || item.hospital || ""
      ).toLowerCase();
      const treatment = String(
        item.treatment_name || item.treatmentName || item.treatment || ""
      ).toLowerCase();
      const status = String(item.status || "").toLowerCase();

      const matchesSearch =
        !q ||
        id.includes(q) ||
        patName.includes(q) ||
        hospital.includes(q) ||
        treatment.includes(q);
      const matchesStatus =
        modalStatusFilter === "ALL" || status === modalStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [appointments, modalSearch, modalStatusFilter]);

  const filteredMessages = useMemo(() => {
    return messages.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const title = String(
        item.title || item.subject || item.sender_name || item.sender || ""
      ).toLowerCase();
      const text = String(
        item.message || item.content || item.text || ""
      ).toLowerCase();
      const priority = String(
        item.priority || item.type || ""
      ).toLowerCase();

      const matchesSearch = !q || title.includes(q) || text.includes(q);
      const matchesStatus =
        modalStatusFilter === "ALL" || priority === modalStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [messages, modalSearch, modalStatusFilter]);

  // Unique statuses for filter dropdown
  const enquiryStatuses = useMemo(() => {
    const set = new Set();
    allEnquiriesSource.forEach((e) => {
      if (e.status) set.add(String(e.status).trim());
    });
    return Array.from(set);
  }, [allEnquiriesSource]);

  const patientStatuses = useMemo(() => {
    const set = new Set();
    allPatientsSource.forEach((p) => {
      const st = p.p_status || p.status;
      if (st) set.add(String(st).trim());
    });
    return Array.from(set);
  }, [allPatientsSource]);

  const appointmentStatuses = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      if (a.status) set.add(String(a.status).trim());
    });
    return Array.from(set);
  }, [appointments]);

  const messagePriorities = useMemo(() => {
    const set = new Set();
    messages.forEach((m) => {
      const p = m.priority || m.type;
      if (p) set.add(String(p).trim());
    });
    return Array.from(set);
  }, [messages]);

  // Paginated items for "See All"
  const currentItems = useMemo(() => {
    if (activeModal === "enquiries") return filteredEnquiries;
    if (activeModal === "patients") return filteredPatients;
    if (activeModal === "appointments") return filteredAppointments;
    if (activeModal === "messages") return filteredMessages;
    return [];
  }, [activeModal, filteredEnquiries, filteredPatients, filteredAppointments, filteredMessages]);

  const totalPages = Math.ceil(currentItems.length / modalPageSize) || 1;
  const paginatedItems = currentItems.slice(
    (modalPage - 1) * modalPageSize,
    modalPage * modalPageSize
  );

  // Top 5 preview items for dashboard cards
  const previewEnquiries = allEnquiriesSource.slice(0, 5);
  const previewPatients = allPatientsSource.slice(0, 5);
  const previewAppointments = appointments.slice(0, 5);

  const sparklineData = useMemo(() => buildSparklinePath(STATIC_TREND), []);

  const companyInfo = dashboardData?.company_information || dashboardData?.companyInformation || null;
  const stats = dashboardData?.dashboard_statistics || dashboardData?.dashboardStatistics || null;
  const financial = dashboardData?.financial_dashboard || dashboardData?.financialDashboard || null;
  const financialReports = financial?.financial_reports || financial?.financialReports || {};
  const mainMenu = dashboardData?.main_menu || dashboardData?.mainMenu || [];
  const recentActivity = useMemo(
    () => dashboardData?.recent_activity || dashboardData?.recentActivity || {},
    [dashboardData]
  );

  const recentPatients = recentActivity.recent_patients || recentActivity.recentPatients || [];
  const recentCases = recentActivity.recent_cases || recentActivity.recentCases || [];
  const recentEmergencies = recentActivity.recent_emergencies || recentActivity.recentEmergencies || [];
  const recentAppointmentsList = recentActivity.recent_appointments || recentActivity.recentAppointments || [];

  const totalPatientsCount =
    recentActivity.total_patients ??
    recentActivity.pagination?.patients?.total ??
    dashboardData?.total_patients ??
    dashboardData?.pagination?.patients?.total ??
    stats?.total_members ??
    stats?.total_active_members ??
    patientTotal ??
    recentPatients.length;

  const totalCasesCount =
    recentActivity.total_cases ??
    recentActivity.pagination?.cases?.total ??
    dashboardData?.total_cases ??
    dashboardData?.pagination?.cases?.total ??
    stats?.total_medical_cases ??
    stats?.active_medical_cases ??
    recentCases.length;

  const totalEmergenciesCount =
    recentActivity.total_emergencies ??
    recentActivity.pagination?.emergencies?.total ??
    dashboardData?.total_emergencies ??
    dashboardData?.pagination?.emergencies?.total ??
    stats?.emergency_sos_cases ??
    stats?.emergency_cases ??
    recentEmergencies.length;

  const totalAppointmentsCount =
    recentActivity.total_appointments ??
    recentActivity.pagination?.appointments?.total ??
    dashboardData?.total_appointments ??
    dashboardData?.pagination?.appointments?.total ??
    stats?.appointments_count ??
    appointmentsTotal ??
    recentAppointmentsList.length;

  const totalEnquiriesCount =
    dashboardData?.total_enquiries ??
    dashboardData?.pagination?.enquiries?.total ??
    enquiries.length;

  const currentTabPagination = useMemo(() => {
    const p =
      recentActivity.pagination?.[activityTab] ||
      dashboardData?.pagination?.[activityTab] ||
      {};

    let total = 0;
    let sliceLength = 0;
    if (activityTab === "enquiries") {
      total = totalEnquiriesCount;
      sliceLength = (dashboardData?.all_enquiries || enquiries).length;
    } else if (activityTab === "patients") {
      total = totalPatientsCount;
      sliceLength = recentPatients.length;
    } else if (activityTab === "cases") {
      total = totalCasesCount;
      sliceLength = recentCases.length;
    } else if (activityTab === "emergencies") {
      total = totalEmergenciesCount;
      sliceLength = recentEmergencies.length;
    } else if (activityTab === "appointments") {
      total = totalAppointmentsCount;
      sliceLength = recentAppointmentsList.length;
    }

    const page = p.page || activityPages[activityTab] || 1;
    const limit = p.limit || 10;
    const totalPages = p.totalPages || (Math.ceil(total / limit) || 1);
    const hasMore = p.hasMore ?? (page < totalPages);

    return {
      total: p.total ?? total,
      page,
      limit,
      totalPages,
      hasMore,
      sliceLength,
    };
  }, [
    recentActivity,
    dashboardData,
    activityTab,
    activityPages,
    totalEnquiriesCount,
    totalPatientsCount,
    totalCasesCount,
    totalEmergenciesCount,
    totalAppointmentsCount,
    enquiries,
    recentPatients.length,
    recentCases.length,
    recentEmergencies.length,
    recentAppointmentsList.length,
  ]);

  return (
    <div className="ins-dash-container">
      {/* ============================================================== */}
      {/* 0. COMPANY INFORMATION BANNER                                  */}
      {/* ============================================================== */}
      <div className="ins-company-banner">
        <div className="ins-company-left">
          <div className="ins-company-logo-wrap">
            {companyInfo?.company_logo &&
            !companyInfo.company_logo.includes("default") &&
            companyInfo.company_logo.startsWith("http") ? (
              <img
                src={companyInfo.company_logo}
                alt="Logo"
                className="ins-company-logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <i className="fa fa-shield ins-company-logo-fallback" />
            )}
          </div>
          <div className="ins-company-info">
            <h4>
              {companyInfo?.company_name ||
                localStorage.getItem("name") ||
                "Insurance Partner"}
              <span className="ins-badge ins-badge-active ms-2">
                {companyInfo?.status || "Active"}
              </span>
            </h4>
            <div className="ins-company-submeta">
              <span>
                <i className="fa fa-id-card-o text-muted" /> ID:{" "}
                <strong>{companyInfo?.insurance_id || myInsuranceId || "—"}</strong>
              </span>
              {companyInfo?.contact_person && (
                <span>
                  <i className="fa fa-user-circle text-muted" />{" "}
                  {companyInfo.contact_person}
                </span>
              )}
              {companyInfo?.contact_details?.email && (
                <span>
                  <i className="fa fa-envelope-o text-muted" />{" "}
                  {companyInfo.contact_details.email}
                </span>
              )}
              {companyInfo?.contact_details?.phone && (
                <span>
                  <i className="fa fa-phone text-muted" />{" "}
                  {companyInfo.contact_details.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="ins-company-right">
          <span className="ins-policy-pill">
            <i className="fa fa-shield me-1" />
            {companyInfo?.policy_types || "Cashless, TPA, Reimbursement"}
          </span>
          {companyInfo?.contact_details?.city && (
            <small className="text-muted">
              <i className="fa fa-map-marker me-1" />
              {[
                companyInfo.contact_details.city,
                companyInfo.contact_details.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </small>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* KPI CARDS (Today's Priorities)                                */}
      {/* ============================================================== */}
      <div className="row gx-2 gy-3 mb-4">
        <div className="col-md-12">
          <div className="treat-hd">
            <h6>Today's Priorities</h6>
            <span className="line"></span>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 col-sm-6">
          <div
            className="attention-card"
            onClick={() => handleOpenSeeAll("enquiries")}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            title="Click to view all enquiries"
          >
            <div className="attention-card-top">
              <div className="attention-icon" style={{ backgroundColor: "#e0f2fe", color: "#0284c7" }}>
                <i className="fa fa-comments-o"></i>
              </div>
              <div className="text-end attention-card-meta">
                <span className="attention-label">All Enquiries</span>
                <h3 className="attention-count">
                  <CountUp start={0} end={totalEnquiriesCount} duration={2} />
                </h3>
              </div>
            </div>
            <svg
              className="attention-sparkline"
              viewBox="0 0 160 40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={sparklineData.area} className="attention-sparkline-fill" />
              <path d={sparklineData.line} className="attention-sparkline-line" />
            </svg>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 col-sm-6">
          <div
            className="attention-card"
            onClick={() => handleOpenSeeAll("patients")}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            title="Click to view all patients"
          >
            <div className="attention-card-top">
              <div className="attention-icon" style={{ backgroundColor: "#cffafe", color: "#0891b2" }}>
                <i className="fa fa-wheelchair"></i>
              </div>
              <div className="text-end attention-card-meta">
                <span className="attention-label">Insured Patients</span>
                <h3 className="attention-count">
                  <CountUp
                    start={0}
                    end={totalPatientsCount}
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
              <path d={sparklineData.area} className="attention-sparkline-fill" />
              <path d={sparklineData.line} className="attention-sparkline-line" />
            </svg>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 col-sm-6">
          <div
            className="attention-card"
            onClick={() => handleOpenSeeAll("appointments")}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            title="Click to view all appointments"
          >
            <div className="attention-card-top">
              <div className="attention-icon" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
                <i className="fa fa-calendar"></i>
              </div>
              <div className="text-end attention-card-meta">
                <span className="attention-label">Appointments</span>
                <h3 className="attention-count">
                  <CountUp
                    start={0}
                    end={totalAppointmentsCount}
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
              <path d={sparklineData.area} className="attention-sparkline-fill" />
              <path d={sparklineData.line} className="attention-sparkline-line" />
            </svg>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 col-sm-6">
          <div
            className="attention-card"
            onClick={() => handleOpenSeeAll("messages")}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            title="Click to view all messages"
          >
            <div className="attention-card-top">
              <div className="attention-icon" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>
                <i className="fa fa-commenting"></i>
              </div>
              <div className="text-end attention-card-meta">
                <span className="attention-label">Messages</span>
                <h3 className="attention-count">
                  <CountUp
                    start={0}
                    end={messagesTotal || messages.length}
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
              <path d={sparklineData.area} className="attention-sparkline-fill" />
              <path d={sparklineData.line} className="attention-sparkline-line" />
            </svg>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* DASHBOARD STATISTICS KPI GRID (9 Metrics)                      */}
      {/* ============================================================== */}
      <div className="row mb-4">
        <div className="col-md-12 mb-2">
          <div className="treat-hd">
            <h6>Dashboard Statistics</h6>
            <span className="line"></span>
          </div>
        </div>
        <div className="col-md-12">
          <div className="ins-stat-kpi-grid">
            <div
              className="ins-kpi-tile"
              onClick={() => handleOpenSeeAll("patients")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view members"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#e0f2fe", color: "#0284c7" }}>
                <i className="fa fa-users" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Active Members</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={
                      stats?.total_members ??
                      stats?.total_active_members ??
                      stats?.totalActiveMembers ??
                      totalPatientsCount
                    }
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view medical cases"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#dcfce7", color: "#16a34a" }}>
                <i className="fa fa-medkit" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Active Medical Cases</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={
                      stats?.active_medical_cases ??
                      stats?.total_medical_cases ??
                      stats?.activeMedicalCases ??
                      totalCasesCount
                    }
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view pending medical cases"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
                <i className="fa fa-hourglass-half" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Pending Cases</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={stats?.pending_medical_cases ?? stats?.pendingMedicalCases ?? 0}
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="View overseas treatment cases"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
                <i className="fa fa-plane" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Overseas Treatment</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={stats?.overseas_treatment_cases ?? stats?.overseasTreatmentCases ?? 0}
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="View local healthcare cases"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#ccfbf1", color: "#0d9488" }}>
                <i className="fa fa-hospital-o" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Local Healthcare</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={stats?.local_treatment_cases ?? stats?.localTreatmentCases ?? 0}
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("emergencies");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="View emergency SOS cases"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
                <i className="fa fa-ambulance" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Emergency SOS</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={
                      stats?.emergency_sos_cases ??
                      stats?.emergency_cases ??
                      stats?.emergencyCases ??
                      totalEmergenciesCount
                    }
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="View cases under review"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>
                <i className="fa fa-search" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Under Review</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={stats?.cases_under_review ?? stats?.casesUnderReview ?? 0}
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="View cases awaiting approval"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#ffedd5", color: "#ea580c" }}>
                <i className="fa fa-clock-o" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Awaiting Approval</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={stats?.cases_awaiting_approval ?? stats?.casesAwaitingApproval ?? 0}
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>

            <div
              className="ins-kpi-tile"
              onClick={() => {
                setActivityTab("cases");
                document.getElementById("ins-recent-activity-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="View cases completed"
            >
              <div className="ins-kpi-icon" style={{ backgroundColor: "#d1fae5", color: "#059669" }}>
                <i className="fa fa-check-circle" />
              </div>
              <div className="ins-kpi-meta">
                <span className="ins-kpi-label">Cases Completed</span>
                <h4 className="ins-kpi-val">
                  <CountUp
                    start={0}
                    end={stats?.cases_completed ?? stats?.casesCompleted ?? 0}
                    duration={1.5}
                  />
                </h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FINANCIAL DASHBOARD & SETTLEMENT SUMMARY                       */}
      {/* ============================================================== */}
      <div className="ins-financial-card">
        <div className="ins-financial-header">
          <div className="d-flex align-items-center gap-2">
            <div className="ins-section-icon" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>
              <i className="fa fa-money" />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-dark">Financial & Claims Overview</h5>
              <small className="text-muted">Settlement performance and transaction summary</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="ins-see-all-btn"
              onClick={() => handleOpenLedger(recentPatients[0] || null)}
            >
              <i className="fa fa-file-text-o me-1" /> View Financial Ledger
            </button>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="ins-loading-spinner">
            <i className="fa fa-spinner fa-spin fa-2x" />
            <span>Loading financial &amp; claims data...</span>
          </div>
        ) : (
          <>
            <div className="ins-fin-grid">
              <div className="ins-fin-box">
                <div className="ins-fin-box-title">Total Claims Decided</div>
                <h3 className="ins-fin-box-amount text-claim">
                  {formatCurrency(
                    financialReports.total_claims_amount ||
                      financials.total_claim ||
                      0
                  )}
                </h3>
                <small className="text-muted">
                  {financialReports.total_claims_count ?? 0} total claims logged
                </small>
              </div>

              <div className="ins-fin-box">
                <div className="ins-fin-box-title">Completed (Settled)</div>
                <h3 className="ins-fin-box-amount text-settled">
                  {formatCurrency(
                    financial?.completed_payments ||
                      financialReports.total_settled_amount ||
                      financials.total_settled ||
                      0
                  )}
                </h3>
                <small className="text-muted">Total amount disbursed</small>
              </div>

              <div className="ins-fin-box">
                <div className="ins-fin-box-title">Pending Payments</div>
                <h3 className="ins-fin-box-amount text-pending">
                  {formatCurrency(
                    financial?.pending_payments ||
                      financialReports.total_pending_amount ||
                      financials.total_pending ||
                      0
                  )}
                </h3>
                <small className="text-muted">Awaiting settlement</small>
              </div>

              <div className="ins-fin-box">
                <div className="ins-fin-box-title">Outstanding Bills</div>
                <h3 className="ins-fin-box-amount text-outstanding">
                  {formatCurrency(
                    financial?.outstanding_bills ||
                      financial?.pending_payments ||
                      0
                  )}
                </h3>
                <small className="text-muted">Due for processing</small>
              </div>
            </div>

            <div className="ins-settlement-progress-wrap">
              <div className="d-flex align-items-center gap-2">
                <strong className="text-dark">Settlement Rate:</strong>
                <span className="badge bg-success" style={{ fontSize: "0.85rem" }}>
                  {financialReports.settlement_rate_percentage ??
                    (financialReports.total_claims_amount
                      ? Math.round(
                          (Number(financialReports.total_settled_amount || 0) /
                            Number(financialReports.total_claims_amount || 1)) *
                            100
                        )
                      : 0)}
                  %
                </span>
              </div>
              <div className="ins-progress-bar-bg">
                <div
                  className="ins-progress-bar-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        financialReports.settlement_rate_percentage ??
                          (financialReports.total_claims_amount
                            ? Math.round(
                                (Number(financialReports.total_settled_amount || 0) /
                                  Number(financialReports.total_claims_amount || 1)) *
                                  100
                              )
                            : 0)
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="text-muted small">
                <i className="fa fa-calendar-check-o me-1 text-primary" />
                {financial?.monthly_claims?.current_month || "Current Month"}:{" "}
                <strong>
                  {financial?.monthly_claims?.current_month_count || 0} claims (
                  {formatCurrency(financial?.monthly_claims?.current_month_amount || 0)})
                </strong>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* MAIN SERVICES & NAVIGATION GRID (13 Main Menu Cards)           */}
      {/* ============================================================== */}
      {mainMenu.length > 0 && (
        <div className="mb-4">
          <div className="treat-hd ins-menu-section-header">
            <h6>Services & Navigation</h6>
            <span className="line"></span>
          </div>
          <div className="ins-menu-grid">
            {mainMenu.map((item) => (
              <div
                key={item.key || item.title}
                className="ins-menu-tile"
                onClick={() => handleMenuCardClick(item)}
                role="button"
                tabIndex={0}
                title={`Open ${item.title}`}
              >
                <div className="ins-menu-tile-left">
                  <div
                    className="ins-menu-tile-icon"
                    style={{
                      backgroundColor: "#f1f5f9",
                      color: "#0284c7",
                    }}
                  >
                    <i className={mapMenuIcon(item.icon)} />
                  </div>
                  <span className="ins-menu-tile-title">{item.title}</span>
                </div>
                {item.count !== null && item.count !== undefined && (
                  <span className="ins-menu-tile-badge">{item.count}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* RECENT ACTIVITY SECTION (Patients, Cases, SOS, Appointments)   */}
      {/* ============================================================== */}
      <div className="ins-section-card" id="ins-recent-activity-section">
        <div className="ins-section-header">
          <div className="ins-section-title-wrap">
            <div className="ins-section-icon" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>
              <i className="fa fa-history" />
            </div>
            <div>
              <h5 className="ins-section-title">Recent Activity</h5>
            </div>
          </div>
        </div>

        <div className="ins-activity-tabs-nav">
          <button
            type="button"
            className={`ins-tab-btn ${activityTab === "enquiries" ? "active" : ""}`}
            onClick={() => setActivityTab("enquiries")}
          >
            <i className="fa fa-comments-o" /> All Enquiries
            <span className="ins-tab-pill">{totalEnquiriesCount}</span>
          </button>
          <button
            type="button"
            className={`ins-tab-btn ${activityTab === "patients" ? "active" : ""}`}
            onClick={() => setActivityTab("patients")}
          >
            <i className="fa fa-wheelchair" /> Recent Members
            <span className="ins-tab-pill">{totalPatientsCount}</span>
          </button>
          <button
            type="button"
            className={`ins-tab-btn ${activityTab === "cases" ? "active" : ""}`}
            onClick={() => setActivityTab("cases")}
          >
            <i className="fa fa-medkit" /> Medical Cases
            <span className="ins-tab-pill">{totalCasesCount}</span>
          </button>
          <button
            type="button"
            className={`ins-tab-btn ${activityTab === "emergencies" ? "active" : ""}`}
            onClick={() => setActivityTab("emergencies")}
          >
            <i className="fa fa-ambulance" /> Emergency SOS
            <span className="ins-tab-pill">{totalEmergenciesCount}</span>
          </button>
          <button
            type="button"
            className={`ins-tab-btn ${activityTab === "appointments" ? "active" : ""}`}
            onClick={() => setActivityTab("appointments")}
          >
            <i className="fa fa-calendar" /> Appointments
            <span className="ins-tab-pill">{totalAppointmentsCount}</span>
          </button>
        </div>

        <div className="ins-table-responsive p-0">
          {activityTab === "enquiries" && (
            (dashboardData?.all_enquiries || enquiries).length === 0 ? (
              <div className="ins-empty-state">No enquiries assigned to your insurance account.</div>
            ) : (
              <table className="ins-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>#</th>
                    <th>Enquiry ID</th>
                    <th>Patient Name</th>
                    <th>Contact</th>
                    <th>Country</th>
                    <th>Service / Treatment</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboardData?.all_enquiries || enquiries).slice(0, 10).map((item, idx) => {
                    const enqId =
                      item.enquiry_id || item.enquiryId || item.id || item._id || "—";
                    const name =
                      item.name || item.patient_name || item.patientName || "—";
                    const phone =
                      item.phone ||
                      item.mobile ||
                      item.contact_no ||
                      item.phone_number ||
                      "—";
                    const country = item.country || item.nationality || "—";
                    const service =
                      item.treatingIn ||
                      item.treatment ||
                      item.service ||
                      item.treatment_type ||
                      "—";
                    const dateStr = formatDate(
                      item.enquiry_date ||
                        item.createdAt ||
                        item.created_at ||
                        item.date
                    );
                    const status = item.status || "Pending";

                    return (
                      <tr
                        key={item._id || item.enquiry_id || item.id || idx}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleViewRecord(item, "enquiry")}
                        title="Click to view details"
                      >
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{enqId}</strong>
                        </td>
                        <td>{name}</td>
                        <td>{phone}</td>
                        <td>{country}</td>
                        <td>{service}</td>
                        <td>{dateStr}</td>
                        <td>
                          <span
                            className={`ins-badge ${
                              String(status).toLowerCase().includes("approve")
                                ? "ins-badge-active"
                                : String(status).toLowerCase().includes("closed")
                                ? "ins-badge-closed"
                                : "ins-badge-pending"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
          {activityTab === "patients" && (
            recentPatients.length === 0 ? (
              <div className="ins-empty-state">No recent patients recorded.</div>
            ) : (
              <table className="ins-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Country</th>
                    <th>Decided Claim</th>
                    <th>Settled</th>
                    <th>Pending Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPatients.map((rp, idx) => (
                    <tr
                      key={rp.id || rp.patient_id || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleNavigateToPatientDetail(rp)}
                    >
                      <td>{idx + 1}</td>
                      <td><strong>{rp.patient_id || rp.omca_patient_id || "—"}</strong></td>
                      <td>
                        <strong style={{ color: "#0891b2" }}>{rp.patient_name || rp.name || "—"}</strong>
                      </td>
                      <td>{rp.country || "—"}</td>
                      <td>{formatCurrency(rp.decided_amount || rp.claim_amount || 0)}</td>
                      <td className="text-success fw-bold">{formatCurrency(rp.total_settled || rp.settled_amount || 0)}</td>
                      <td className="text-danger fw-bold">{formatCurrency(rp.remaining_due || rp.pending_amount || 0)}</td>
                      <td>
                        <span className={`ins-badge ${getStatusBadgeClass(rp.p_status || rp.status)}`}>
                          {rp.p_status || rp.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activityTab === "cases" && (
            recentCases.length === 0 ? (
              <div className="ins-empty-state">No recent medical cases.</div>
            ) : (
              <table className="ins-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Treatment ID</th>
                    <th>Patient ID</th>
                    <th>Course / Service</th>
                    <th>Hospital</th>
                    <th>Created Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((rc, idx) => (
                    <tr
                      key={rc._id || rc.treatment_id || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(rc, "case")}
                      title="Click to view case details"
                    >
                      <td>{idx + 1}</td>
                      <td><strong>{rc.treatment_id || rc.treatmentId || rc.id || rc._id || "—"}</strong></td>
                      <td>{rc.patientId || rc.patient_id || rc.omca_patient_id || "—"}</td>
                      <td>{rc.treatment_course_name || rc.course_name || rc.treatment_name || "Medical Treatment"}</td>
                      <td>{rc.hospital?.[0]?.hospital_Name || rc.hospital_name || rc.hospitalName || "—"}</td>
                      <td>{formatDate(rc.createdAt || rc.created_at || rc.date)}</td>
                      <td>
                        <span className={`ins-badge ${getStatusBadgeClass(rc.status)}`}>
                          {rc.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activityTab === "emergencies" && (
            recentEmergencies.length === 0 ? (
              <div className="ins-empty-state">No recent emergency SOS events.</div>
            ) : (
              <table className="ins-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>SOS ID</th>
                    <th>Emergency ID</th>
                    <th>Patient ID</th>
                    <th>Type</th>
                    <th>Activated At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmergencies.map((re, idx) => (
                    <tr
                      key={re._id || re.sosId || re.id || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(re, "emergency")}
                      title="Click to view SOS details"
                    >
                      <td>{idx + 1}</td>
                      <td><strong>{re.sosId || re.sos_id || re.id || "—"}</strong></td>
                      <td>{re.emergencyCaseId || re.emergency_case_id || re.caseId || "—"}</td>
                      <td>{re.patientId || re.patient_id || re.omca_patient_id || "—"}</td>
                      <td><span className="ins-badge ins-badge-info">{re.sosType || re.sos_type || "Voice"}</span></td>
                      <td>{formatDate(re.activatedAt || re.activated_at || re.createdAt)}</td>
                      <td>
                        <span className={`ins-badge ${re.status === "Closed" ? "ins-badge-closed" : "ins-badge-pending"}`}>
                          {re.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activityTab === "appointments" && (
            recentAppointmentsList.length === 0 ? (
              <div className="ins-empty-state">No recent appointments.</div>
            ) : (
              <table className="ins-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Appt ID</th>
                    <th>Patient Name</th>
                    <th>Hospital</th>
                    <th>Treatment</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAppointmentsList.map((ra, idx) => (
                    <tr
                      key={ra._id || ra.appointmentId || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(ra, "appointment")}
                    >
                      <td>{idx + 1}</td>
                      <td><strong>{ra.appointmentId || "—"}</strong></td>
                      <td>{ra.patientName || "—"}</td>
                      <td>{ra.hospitalName || "—"}</td>
                      <td>{ra.treatment_name || "—"}</td>
                      <td>{formatDate(ra.appointment_Date)} {ra.appointment_Time || ""}</td>
                      <td>
                        <span className={`ins-badge ${getStatusBadgeClass(ra.status)}`}>
                          {ra.status || "Scheduled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* ============================================================== */}
        {/* Pagination Footer for Recent Activity Active Tab               */}
        {/* ============================================================== */}
        <div className="ins-card-footer">
          <div className="ins-page-info">
            Showing{" "}
            {currentTabPagination.total === 0
              ? 0
              : (currentTabPagination.page - 1) * currentTabPagination.limit + 1}{" "}
            to{" "}
            {Math.min(
              currentTabPagination.total,
              (currentTabPagination.page - 1) * currentTabPagination.limit +
                currentTabPagination.sliceLength
            )}{" "}
            of {currentTabPagination.total} records
          </div>
          <div className="ins-pagination">
            <button
              type="button"
              className="ins-page-btn"
              disabled={currentTabPagination.page <= 1}
              onClick={() =>
                handleActivityPageChange(activityTab, currentTabPagination.page - 1)
              }
            >
              <i className="fa fa-chevron-left me-1" /> Prev
            </button>
            <span className="ins-page-info">
              Page {currentTabPagination.page} of {currentTabPagination.totalPages}
            </span>
            <button
              type="button"
              className="ins-page-btn"
              disabled={
                currentTabPagination.page >= currentTabPagination.totalPages ||
                !currentTabPagination.hasMore
              }
              onClick={() =>
                handleActivityPageChange(activityTab, currentTabPagination.page + 1)
              }
            >
              Next <i className="fa fa-chevron-right ms-1" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: ENQUIRIES                                           */}
      {/* ============================================================== */}
      <div className="ins-section-card">
        <div className="ins-section-header">
          <div className="ins-section-title-wrap">
            <div className="ins-section-icon enquiry-icon">
              <i className="fa fa-comments-o" />
            </div>
            <div>
              <h5 className="ins-section-title">
                All Enquiries
                <span className="ins-count-badge badge-enq ms-2">
                  {totalEnquiriesCount} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ins-see-all-btn"
              onClick={() => handleOpenSeeAll("enquiries")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ins-table-responsive">
          {enquiriesLoading ? (
            <div className="ins-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading enquiries...</span>
            </div>
          ) : enquiryError ? (
            <div className="ins-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {enquiryError}
            </div>
          ) : previewEnquiries.length === 0 ? (
            <div className="ins-empty-state">
              <i className="fa fa-info-circle me-1" /> No enquiries assigned to your insurance account.
            </div>
          ) : (
            <table className="ins-data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>Enquiry ID</th>
                  <th>Patient Name</th>
                  <th>Contact</th>
                  <th>Country</th>
                  <th>Service / Treatment</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewEnquiries.map((item, idx) => {
                  const enqId =
                    item.enquiry_id || item.enquiryId || item.id || item._id || "—";
                  const name =
                    item.name || item.patient_name || item.patientName || "—";
                  const phone =
                    item.phone ||
                    item.mobile ||
                    item.contact_no ||
                    item.phone_number ||
                    "—";
                  const country = item.country || item.nationality || "—";
                  const service =
                    item.treatingIn ||
                    item.treatment ||
                    item.service ||
                    item.treatment_type ||
                    "—";
                  const status = item.status || "Pending";
                  const date = formatDate(
                    item.enquiry_date || item.createdAt || item.date
                  );

                  return (
                    <tr
                      key={item._id || item.enquiry_id || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(item, "enquiry")}
                      title="Click to view details"
                    >
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{enqId}</strong>
                      </td>
                      <td>{name}</td>
                      <td>{phone}</td>
                      <td>{country}</td>
                      <td>{service}</td>
                      <td>{date}</td>
                      <td>
                        <span className={`ins-badge ${getStatusBadgeClass(status)}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: PATIENTS                                            */}
      {/* ============================================================== */}
      <div className="ins-section-card">
        <div className="ins-section-header">
          <div className="ins-section-title-wrap">
            <div className="ins-section-icon patient-icon">
              <i className="fa fa-wheelchair" />
            </div>
            <div>
              <h5 className="ins-section-title">
                Patients
                <span className="ins-count-badge badge-pat ms-2">
                  {totalPatientsCount} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ins-see-all-btn"
              onClick={() => handleOpenSeeAll("patients")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ins-table-responsive">
          {patientsLoading ? (
            <div className="ins-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading patients...</span>
            </div>
          ) : patientError ? (
            <div className="ins-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {patientError}
            </div>
          ) : previewPatients.length === 0 ? (
            <div className="ins-empty-state">
              <i className="fa fa-info-circle me-1" /> No patients assigned to your insurance account.
            </div>
          ) : (
            <table className="ins-data-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Contact</th>
                  <th>Country</th>
                  <th>Treating In</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewPatients.map((item, idx) => {
                  const patId =
                    item.omca_patient_id ||
                    item.patientId ||
                    item.patientNumber ||
                    item._id ||
                    "—";
                  const name = item.patient_name || item.name || "—";
                  const phone = formatEmergencyContact(item);
                  const country = item.country || "—";
                  const treatingIn =
                    item.current_treatment_or_plan?.hospital_name ||
                    item.hospital_name ||
                    item.hospital_Name ||
                    item.hospitalName ||
                    item.treatingIn ||
                    item.hospital ||
                    "—";
                  const date = formatDate(
                    item.date_of_registration ||
                      item.createdAt ||
                      item.date
                  );
                  const status = item.p_status || item.status || "Pending";

                  return (
                    <tr
                      key={item._id || item.patientId || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(item, "patient")}
                      title="Click to view details"
                    >
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{patId}</strong>
                      </td>
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToPatientDetail(item);
                        }}
                        title="Click to view Patient Details"
                      >
                        <strong
                          style={{ color: "#0891b2" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {name}
                        </strong>
                        <i className="fa fa-external-link ms-1 text-muted" style={{ fontSize: "10px", opacity: 0.7 }} />
                      </td>
                      <td>{phone}</td>
                      <td>{country}</td>
                      <td>{treatingIn}</td>
                      <td>{date}</td>
                      <td>
                        <span className={`ins-badge ${getStatusBadgeClass(status)}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: APPOINTMENTS                                        */}
      {/* ============================================================== */}
      <div className="ins-section-card">
        <div className="ins-section-header">
          <div className="ins-section-title-wrap">
            <div className="ins-section-icon appointment-icon">
              <i className="fa fa-calendar" />
            </div>
            <div>
              <h5 className="ins-section-title">
                Appointments
                <span className="ins-count-badge badge-app ms-2">
                  {totalAppointmentsCount} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ins-see-all-btn"
              onClick={() => handleOpenSeeAll("appointments")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ins-table-responsive">
          {appointmentsLoading ? (
            <div className="ins-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading appointments...</span>
            </div>
          ) : appointmentError ? (
            <div className="ins-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {appointmentError}
            </div>
          ) : previewAppointments.length === 0 ? (
            <div className="ins-empty-state">
              <i className="fa fa-info-circle me-1" /> No appointments scheduled for your insurance account.
            </div>
          ) : (
            <table className="ins-data-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Appointment ID</th>
                  <th>Patient Name</th>
                  <th>Hospital / Facility</th>
                  <th>Treatment / Service</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewAppointments.map((item, idx) => {
                  const aptId =
                    item.appointment_id || item.appointmentId || item.id || item._id || "—";
                  const patName =
                    item.patient_name || item.patientName || item.patient_id?.patient_name || item.name || "—";
                  const hospital =
                    item.hospital_name || item.hospitalName || item.treatingIn || item.hospital || "—";
                  const treatment =
                    item.treatment_name || item.treatmentName || item.treatment || "—";
                  const dateStr = formatDate(item.appointment_date || item.date || item.createdAt);
                  const timeStr = item.appointment_time || item.time || "";
                  const fullDateTime = timeStr ? `${dateStr} ${timeStr}` : dateStr;
                  const status = item.status || "Scheduled";

                  return (
                    <tr
                      key={item._id || aptId || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(item, "appointment")}
                      title="Click to view appointment details"
                    >
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{aptId}</strong>
                      </td>
                      <td>{patName}</td>
                      <td>{hospital}</td>
                      <td>{treatment}</td>
                      <td>{fullDateTime}</td>
                      <td>
                        <span className={`ins-badge ${getStatusBadgeClass(status)}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: "SEE ALL" MODAL                                       */}
      {/* ============================================================== */}
      {activeModal && (
        <div className="ins-modal-overlay" onClick={handleCloseSeeAll}>
          <div className="ins-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ins-modal-header">
              <h4>
                <i
                  className={
                    activeModal === "enquiries"
                      ? "fa fa-comments-o"
                      : activeModal === "patients"
                      ? "fa fa-wheelchair"
                      : activeModal === "appointments"
                      ? "fa fa-calendar"
                      : "fa fa-commenting"
                  }
                />
                All{" "}
                {activeModal === "enquiries"
                  ? "Enquiries"
                  : activeModal === "patients"
                  ? "Patients"
                  : activeModal === "appointments"
                  ? "Appointments"
                  : "Messages"}
              </h4>
              <button
                type="button"
                className="ins-modal-close"
                onClick={handleCloseSeeAll}
              >
                &times;
              </button>
            </div>

            <div className="ins-modal-toolbar">
              <div className="ins-modal-search">
                <i className="fa fa-search" />
                <input
                  type="text"
                  placeholder={`Search ${activeModal} by name, ID, hospital, priority...`}
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setModalPage(1);
                  }}
                />
              </div>

              <div>
                <select
                  className="ins-modal-select"
                  value={modalStatusFilter}
                  onChange={(e) => {
                    setModalStatusFilter(e.target.value);
                    setModalPage(1);
                  }}
                >
                  <option value="ALL">All Statuses / Priorities</option>
                  {(activeModal === "enquiries"
                    ? enquiryStatuses
                    : activeModal === "patients"
                    ? patientStatuses
                    : activeModal === "appointments"
                    ? appointmentStatuses
                    : messagePriorities
                  ).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ins-modal-body">
              {paginatedItems.length === 0 ? (
                <div className="ins-empty-state">
                  <i className="fa fa-search me-1" /> No records matched your search.
                </div>
              ) : (
                <table className="ins-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "50px" }}>#</th>
                      {activeModal === "enquiries" && (
                        <>
                          <th>Enquiry ID</th>
                          <th>Patient Name</th>
                          <th>Contact</th>
                          <th>Country</th>
                          <th>Service / Treatment</th>
                          <th>Date</th>
                          <th>Status</th>
                        </>
                      )}
                      {activeModal === "patients" && (
                        <>
                          <th>Patient ID</th>
                          <th>Patient Name</th>
                          <th>Contact</th>
                          <th>Country</th>
                          <th>Treating In</th>
                          <th>Registration Date</th>
                          <th>Status</th>
                        </>
                      )}
                      {activeModal === "appointments" && (
                        <>
                          <th>Appointment ID</th>
                          <th>Patient Name</th>
                          <th>Hospital / Facility</th>
                          <th>Treatment / Service</th>
                          <th>Date & Time</th>
                          <th>Status</th>
                        </>
                      )}
                      {activeModal === "messages" && (
                        <>
                          <th>Title / Subject</th>
                          <th>Message Preview</th>
                          <th>Priority</th>
                          <th>Date</th>
                          <th>Action</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item, idx) => {
                      const rowNum = (modalPage - 1) * modalPageSize + idx + 1;

                      if (activeModal === "enquiries") {
                        const idVal = item.enquiry_id || item.enquiryId || item.id || item._id || "—";
                        const nameVal = item.name || item.patient_name || item.patientName || "—";
                        const phoneVal = item.phone || item.mobile || item.contact_no || "—";
                        const countryVal = item.country || item.nationality || "—";
                        const serviceVal = item.treatingIn || item.treatment || item.service || "—";
                        const dateVal = formatDate(item.enquiry_date || item.createdAt || item.date);
                        const statusVal = item.status || "Pending";

                        return (
                          <tr
                            key={item._id || idVal || idx}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRecord(item, "enquiry")}
                            title="Click to view details"
                          >
                            <td>{rowNum}</td>
                            <td><strong>{idVal}</strong></td>
                            <td>{nameVal}</td>
                            <td>{phoneVal}</td>
                            <td>{countryVal}</td>
                            <td>{serviceVal}</td>
                            <td>{dateVal}</td>
                            <td>
                              <span className={`ins-badge ${getStatusBadgeClass(statusVal)}`}>
                                {statusVal}
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      if (activeModal === "patients") {
                        const patId = item.omca_patient_id || item.patientId || item.patientNumber || item._id || "—";
                        const nameVal = item.patient_name || item.name || "—";
                        const phoneVal = formatEmergencyContact(item);
                        const countryVal = item.country || "—";
                        const treatingInVal =
                          item.current_treatment_or_plan?.hospital_name ||
                          item.hospital_name ||
                          item.hospital_Name ||
                          item.hospitalName ||
                          item.treatingIn ||
                          item.hospital ||
                          "—";
                        const dateVal = formatDate(item.date_of_registration || item.createdAt || item.date);
                        const statusVal = item.p_status || item.status || "Pending";

                        return (
                          <tr
                            key={item._id || patId || idx}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRecord(item, "patient")}
                            title="Click to view details"
                          >
                            <td>{rowNum}</td>
                            <td><strong>{patId}</strong></td>
                            <td>{nameVal}</td>
                            <td>{phoneVal}</td>
                            <td>{countryVal}</td>
                            <td>{treatingInVal}</td>
                            <td>{dateVal}</td>
                            <td>
                              <span className={`ins-badge ${getStatusBadgeClass(statusVal)}`}>
                                {statusVal}
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      if (activeModal === "appointments") {
                        const aptId = item.appointment_id || item.appointmentId || item.id || item._id || "—";
                        const patName = item.patient_name || item.patientName || item.patient_id?.patient_name || item.name || "—";
                        const hospital = item.hospital_name || item.hospitalName || item.treatingIn || item.hospital || "—";
                        const treatment = item.treatment_name || item.treatmentName || item.treatment || "—";
                        const dateStr = formatDate(item.appointment_date || item.date || item.createdAt);
                        const timeStr = item.appointment_time || item.time || "";
                        const fullDateTime = timeStr ? `${dateStr} ${timeStr}` : dateStr;
                        const statusVal = item.status || "Scheduled";

                        return (
                          <tr
                            key={item._id || aptId || idx}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRecord(item, "appointment")}
                            title="Click to view details"
                          >
                            <td>{rowNum}</td>
                            <td><strong>{aptId}</strong></td>
                            <td>{patName}</td>
                            <td>{hospital}</td>
                            <td>{treatment}</td>
                            <td>{fullDateTime}</td>
                            <td>
                              <span className={`ins-badge ${getStatusBadgeClass(statusVal)}`}>
                                {statusVal}
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      if (activeModal === "messages") {
                        const title = item.title || item.subject || item.sender_name || item.sender || "Message";
                        const content = item.message || item.content || item.text || "—";
                        const priority = item.priority || item.type || "Normal";
                        const dateStr = formatDate(item.createdAt || item.created_at || item.date);

                        return (
                          <tr
                            key={item._id || item.id || idx}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRecord(item, "message")}
                            title="Click to view details"
                          >
                            <td>{rowNum}</td>
                            <td><strong>{title}</strong></td>
                            <td style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {content}
                            </td>
                            <td>
                              <span className={`ins-badge ${String(priority).toLowerCase() === "high" ? "ins-badge-closed" : "ins-badge-info"}`}>
                                {priority}
                              </span>
                            </td>
                            <td>{dateStr}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary py-0 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/Admin/messages");
                                }}
                              >
                                <i className="fa fa-commenting me-1" /> Chat
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return null;
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="ins-modal-footer">
              <div className="ins-page-info">
                Showing {Math.min(currentItems.length, (modalPage - 1) * modalPageSize + 1)} to{" "}
                {Math.min(currentItems.length, modalPage * modalPageSize)} of {currentItems.length}{" "}
                records
              </div>
              <div className="ins-pagination">
                <button
                  type="button"
                  className="ins-page-btn"
                  disabled={modalPage <= 1}
                  onClick={() => setModalPage((p) => p - 1)}
                >
                  <i className="fa fa-chevron-left me-1" /> Prev
                </button>
                <span className="ins-page-info">
                  Page {modalPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="ins-page-btn"
                  disabled={modalPage >= totalPages}
                  onClick={() => setModalPage((p) => p + 1)}
                >
                  Next <i className="fa fa-chevron-right ms-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: READ-ONLY RECORD DETAIL DIALOG                        */}
      {/* ============================================================== */}
      {selectedRecord && (
        <div className="ins-modal-overlay" onClick={handleCloseDetail}>
          <div className="ins-detail-card" onClick={(e) => e.stopPropagation()}>
            <div className="ins-modal-header">
              <h4>
                <i
                  className={
                    recordType === "enquiry"
                      ? "fa fa-comments-o"
                      : recordType === "patient"
                      ? "fa fa-wheelchair"
                      : recordType === "case"
                      ? "fa fa-medkit"
                      : recordType === "emergency"
                      ? "fa fa-ambulance"
                      : recordType === "appointment"
                      ? "fa fa-calendar"
                      : "fa fa-commenting"
                  }
                />
                {recordType === "enquiry"
                  ? "Enquiry Details"
                  : recordType === "patient"
                  ? "Patient Details"
                  : recordType === "case"
                  ? "Medical Case Details"
                  : recordType === "emergency"
                  ? "Emergency SOS Details"
                  : recordType === "appointment"
                  ? "Appointment Details"
                  : "Message Details"}
              </h4>
              <button
                type="button"
                className="ins-modal-close"
                onClick={handleCloseDetail}
              >
                &times;
              </button>
            </div>

            <div className="ins-detail-body">
              {recordType === "enquiry" && (
                <div className="ins-detail-grid">
                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Enquiry ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.enquiry_id ||
                          selectedRecord.enquiryId ||
                          selectedRecord.id ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Status</span>
                    <span className="ins-detail-value">
                      <span
                        className={`ins-badge ${getStatusBadgeClass(
                          selectedRecord.status
                        )}`}
                      >
                        {selectedRecord.status || "Pending"}
                      </span>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient Name</span>
                    <span className="ins-detail-value">
                      {selectedRecord.name ||
                        selectedRecord.patient_name ||
                        selectedRecord.patientName ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Contact Number</span>
                    <span className="ins-detail-value">
                      {selectedRecord.phone ||
                        selectedRecord.mobile ||
                        selectedRecord.contact_no ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Email</span>
                    <span className="ins-detail-value">
                      {selectedRecord.email || "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Country</span>
                    <span className="ins-detail-value">
                      {selectedRecord.country ||
                        selectedRecord.nationality ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Service / Treatment</span>
                    <span className="ins-detail-value">
                      {selectedRecord.treatingIn ||
                        selectedRecord.treatment ||
                        selectedRecord.service ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Date</span>
                    <span className="ins-detail-value">
                      {formatDate(
                        selectedRecord.enquiry_date ||
                          selectedRecord.createdAt ||
                          selectedRecord.date
                      )}
                    </span>
                  </div>

                  {selectedRecord.remarks && (
                    <div
                      className="ins-detail-item"
                      style={{ gridColumn: "span 2" }}
                    >
                      <span className="ins-detail-label">Remarks</span>
                      <span className="ins-detail-value">
                        {selectedRecord.remarks}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {recordType === "patient" && (
                <div className="ins-detail-grid">
                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.omca_patient_id ||
                          selectedRecord.patientId ||
                          selectedRecord.patientNumber ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Status</span>
                    <span className="ins-detail-value">
                      <span
                        className={`ins-badge ${getStatusBadgeClass(
                          selectedRecord.p_status || selectedRecord.status
                        )}`}
                      >
                        {selectedRecord.p_status ||
                          selectedRecord.status ||
                          "Pending"}
                      </span>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient Name</span>
                    <span className="ins-detail-value">
                      {selectedRecord.patient_name ||
                        selectedRecord.name ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Contact</span>
                    <span className="ins-detail-value">
                      {formatEmergencyContact(selectedRecord)}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Country</span>
                    <span className="ins-detail-value">
                      {selectedRecord.country || "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Treating In</span>
                    <span className="ins-detail-value">
                      {selectedRecord.current_treatment_or_plan?.hospital_name ||
                        selectedRecord.hospital_name ||
                        selectedRecord.hospital_Name ||
                        selectedRecord.hospitalName ||
                        selectedRecord.treatingIn ||
                        selectedRecord.hospital ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Registration Date</span>
                    <span className="ins-detail-value">
                      {formatDate(
                        selectedRecord.date_of_registration ||
                          selectedRecord.createdAt ||
                          selectedRecord.date
                      )}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient Type</span>
                    <span className="ins-detail-value">
                      {selectedRecord.patient_type_new ||
                        selectedRecord.patient_type ||
                        "Insurance"}
                    </span>
                  </div>
                </div>
              )}

              {recordType === "case" && (
                <div className="ins-detail-grid">
                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Treatment ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.treatment_id ||
                          selectedRecord.treatmentId ||
                          selectedRecord.id ||
                          selectedRecord._id ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Status</span>
                    <span className="ins-detail-value">
                      <span className={`ins-badge ${getStatusBadgeClass(selectedRecord.status)}`}>
                        {selectedRecord.status || "Active"}
                      </span>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.patientId ||
                          selectedRecord.patient_id ||
                          selectedRecord.omca_patient_id ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Hospital</span>
                    <span className="ins-detail-value">
                      {selectedRecord.hospital?.[0]?.hospital_Name ||
                        selectedRecord.hospital_name ||
                        selectedRecord.hospitalName ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item" style={{ gridColumn: "span 2" }}>
                    <span className="ins-detail-label">Course / Treatment Name</span>
                    <span className="ins-detail-value">
                      {selectedRecord.treatment_course_name ||
                        selectedRecord.course_name ||
                        selectedRecord.treatment_name ||
                        "Medical Treatment"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Created Date</span>
                    <span className="ins-detail-value">
                      {formatDate(
                        selectedRecord.createdAt ||
                          selectedRecord.created_at ||
                          selectedRecord.date
                      )}
                    </span>
                  </div>
                </div>
              )}

              {recordType === "emergency" && (
                <div className="ins-detail-grid">
                  <div className="ins-detail-item">
                    <span className="ins-detail-label">SOS ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.sosId ||
                          selectedRecord.sos_id ||
                          selectedRecord.id ||
                          selectedRecord._id ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Emergency Case ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.emergencyCaseId ||
                          selectedRecord.emergency_case_id ||
                          selectedRecord.caseId ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient ID</span>
                    <span className="ins-detail-value">
                      {selectedRecord.patientId ||
                        selectedRecord.patient_id ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Alert Type</span>
                    <span className="ins-detail-value">
                      <span className="ins-badge ins-badge-info">
                        {selectedRecord.sosType || selectedRecord.sos_type || "Voice Alert"}
                      </span>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Activated At</span>
                    <span className="ins-detail-value">
                      {formatDate(
                        selectedRecord.activatedAt ||
                          selectedRecord.activated_at ||
                          selectedRecord.createdAt
                      )}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Status</span>
                    <span className="ins-detail-value">
                      <span
                        className={`ins-badge ${
                          selectedRecord.status === "Closed"
                            ? "ins-badge-closed"
                            : "ins-badge-pending"
                        }`}
                      >
                        {selectedRecord.status || "Active"}
                      </span>
                    </span>
                  </div>

                  {selectedRecord.ambulance_distance_km && (
                    <div className="ins-detail-item">
                      <span className="ins-detail-label">Ambulance Distance</span>
                      <span className="ins-detail-value">
                        {selectedRecord.ambulance_distance_km} km
                      </span>
                    </div>
                  )}
                </div>
              )}

              {recordType === "appointment" && (
                <div className="ins-detail-grid">
                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Appointment ID</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.appointment_id ||
                          selectedRecord.appointmentId ||
                          selectedRecord.id ||
                          selectedRecord._id ||
                          "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Status</span>
                    <span className="ins-detail-value">
                      <span
                        className={`ins-badge ${getStatusBadgeClass(
                          selectedRecord.status
                        )}`}
                      >
                        {selectedRecord.status || "Scheduled"}
                      </span>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Patient Name</span>
                    <span className="ins-detail-value">
                      {selectedRecord.patient_name ||
                        selectedRecord.patientName ||
                        selectedRecord.patient_id?.patient_name ||
                        selectedRecord.name ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Hospital / Facility</span>
                    <span className="ins-detail-value">
                      {selectedRecord.hospital_name ||
                        selectedRecord.hospitalName ||
                        selectedRecord.treatingIn ||
                        selectedRecord.hospital ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Treatment / Service</span>
                    <span className="ins-detail-value">
                      {selectedRecord.treatment_name ||
                        selectedRecord.treatmentName ||
                        selectedRecord.treatment ||
                        "—"}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Date</span>
                    <span className="ins-detail-value">
                      {formatDate(
                        selectedRecord.appointment_date ||
                          selectedRecord.date ||
                          selectedRecord.createdAt
                      )}
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Time</span>
                    <span className="ins-detail-value">
                      {selectedRecord.appointment_time ||
                        selectedRecord.time ||
                        "—"}
                    </span>
                  </div>

                  {selectedRecord.treating_doctor && (
                    <div className="ins-detail-item">
                      <span className="ins-detail-label">Doctor</span>
                      <span className="ins-detail-value">
                        {selectedRecord.treating_doctor}
                      </span>
                    </div>
                  )}

                  {selectedRecord.notes && (
                    <div
                      className="ins-detail-item"
                      style={{ gridColumn: "span 2" }}
                    >
                      <span className="ins-detail-label">Notes</span>
                      <span className="ins-detail-value">
                        {selectedRecord.notes}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {recordType === "message" && (
                <div className="ins-detail-grid">
                  <div className="ins-detail-item" style={{ gridColumn: "span 2" }}>
                    <span className="ins-detail-label">Title / Subject</span>
                    <span className="ins-detail-value">
                      <strong>
                        {selectedRecord.title ||
                          selectedRecord.subject ||
                          selectedRecord.sender_name ||
                          "Message"}
                      </strong>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Priority</span>
                    <span className="ins-detail-value">
                      <span
                        className={`ins-badge ${
                          String(selectedRecord.priority || selectedRecord.type).toLowerCase() === "high"
                            ? "ins-badge-closed"
                            : "ins-badge-info"
                        }`}
                      >
                        {selectedRecord.priority || selectedRecord.type || "Normal"}
                      </span>
                    </span>
                  </div>

                  <div className="ins-detail-item">
                    <span className="ins-detail-label">Date</span>
                    <span className="ins-detail-value">
                      {formatDate(
                        selectedRecord.createdAt ||
                          selectedRecord.created_at ||
                          selectedRecord.date
                      )}
                    </span>
                  </div>

                  <div
                    className="ins-detail-item"
                    style={{ gridColumn: "span 2" }}
                  >
                    <span className="ins-detail-label">Message Content</span>
                    <div
                      style={{
                        padding: "12px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        marginTop: "6px",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {selectedRecord.message ||
                        selectedRecord.content ||
                        selectedRecord.text ||
                        "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              className="ins-modal-footer"
              style={{ justifyContent: "space-between" }}
            >
              <div>
                {recordType === "case" && selectedRecord.patientId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      const pid = selectedRecord.patientId;
                      handleCloseDetail();
                      handleNavigateToPatientDetail({ patientId: pid });
                    }}
                  >
                    <i className="fa fa-wheelchair me-1" /> View Patient Detail
                  </button>
                )}
                {recordType === "emergency" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      handleCloseDetail();
                      navigate("/Admin/inquiry");
                    }}
                  >
                    <i className="fa fa-ambulance me-1" /> View in SOS & Enquiries
                  </button>
                )}
                {recordType === "appointment" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      handleCloseDetail();
                      navigate("/Admin/Appointments");
                    }}
                  >
                    <i className="fa fa-calendar me-1" /> View Appointments
                  </button>
                )}
                {recordType === "message" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      handleCloseDetail();
                      navigate("/Admin/messages");
                    }}
                  >
                    <i className="fa fa-commenting me-1" /> Open in Chat
                  </button>
                )}
              </div>
              <button
                type="button"
                className="ins-see-all-btn"
                onClick={handleCloseDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Payment Ledger Modal (Read-Only: View Only for Insurance Partner) */}
      <InsurancePatientPaymentModal
        open={ledgerModalOpen}
        onClose={() => {
          setLedgerModalOpen(false);
          setSelectedLedgerPatient(null);
        }}
        insurance={{
          insurance_id: myInsuranceId,
          name: localStorage.getItem("name") || "Insurance Partner",
        }}
        patient={selectedLedgerPatient}
        readOnly={true}
      />
    </div>
  );
}
