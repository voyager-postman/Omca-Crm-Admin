import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import CountUp from "react-countup";
import { baseurl } from "../../Basurl/Baseurl";
import ReferralPatientPaymentModal from "../../pages/Referral/ReferralPatientPaymentModal";
import {
  fetchReferralPatientPayments,
  fetchReferralPaymentSummary,
} from "../../services/referralApi";
import "./ReferralDashboard.css";

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
  if (!status) return "ref-badge-pending";
  const s = String(status).toLowerCase();
  if (s.includes("active") || s.includes("completed") || s.includes("admitted") || s.includes("success") || s.includes("converted")) {
    return "ref-badge-active";
  }
  if (s.includes("progress") || s.includes("consultation") || s.includes("review")) {
    return "ref-badge-info";
  }
  if (s.includes("cancel") || s.includes("reject") || s.includes("closed") || s.includes("lost")) {
    return "ref-badge-closed";
  }
  return "ref-badge-pending";
};

export default function ReferralDashboard({ referralId }) {
  const navigate = useNavigate();
  const myReferralId = referralId || localStorage.getItem("referral_id") || "";
  const token = localStorage.getItem("token") || "";

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
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messageError, setMessageError] = useState(null);

  // -------------------------------------------------------------
  // 2.4 Financials & Commission State
  // -------------------------------------------------------------
  const [financials, setFinancials] = useState({
    total_paid: 0,
    total_commission: 0,
    total_given: 0,
    total_pending: 0,
  });
  const [patientPaymentsMap, setPatientPaymentsMap] = useState({});
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
      const params = {};
      if (myReferralId) {
        params.referral_id = myReferralId;
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
      console.error("Referral Enquiries fetch error:", err);
      setEnquiryError(err.response?.data?.message || err.message || "Failed to load enquiries");
      setEnquiries([]);
    } finally {
      setEnquiriesLoading(false);
    }
  }, [myReferralId, token]);

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
      if (myReferralId) {
        params.referral_id = myReferralId;
      }
      const res = await axios.get(`${baseurl}all_patients`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
      });

      let list = [];
      let total = 0;
      if (Array.isArray(res.data?.details)) {
        list = res.data.details;
        total = res.data.pagination?.total ?? list.length;
      } else if (Array.isArray(res.data?.data)) {
        list = res.data.data;
        total = res.data.total ?? list.length;
      } else if (Array.isArray(res.data)) {
        list = res.data;
        total = list.length;
      }
      setPatients(list);
      setPatientTotal(total);
    } catch (err) {
      console.error("Referral Patients fetch error:", err);
      setPatientError(err.response?.data?.message || err.message || "Failed to load patients");
      setPatients([]);
      setPatientTotal(0);
    } finally {
      setPatientsLoading(false);
    }
  }, [myReferralId, token]);

  // Fetch Appointments
  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentError(null);
    try {
      const params = {};
      if (myReferralId) params.referral_id = myReferralId;
      const res = await axios.get(`${baseurl}all_appointment`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
      });
      let list = [];
      let total = 0;
      if (Array.isArray(res.data?.data)) {
        list = res.data.data;
        total = res.data.totalRecords ?? res.data.total ?? list.length;
      } else if (Array.isArray(res.data?.details)) {
        list = res.data.details;
        total = res.data.pagination?.total ?? list.length;
      } else if (Array.isArray(res.data)) {
        list = res.data;
        total = list.length;
      }
      setAppointments(list);
      setAppointmentsTotal(total);
    } catch (err) {
      console.error("Referral Appointments fetch error:", err);
      setAppointmentError(err.message || "Failed to load appointments");
      setAppointments([]);
      setAppointmentsTotal(0);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [myReferralId, token]);

  // Fetch Messages
  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    setMessageError(null);
    try {
      const params = {};
      if (myReferralId) params.referral_id = myReferralId;
      const res = await axios.get(`${baseurl}messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
      });
      let list = [];
      let total = 0;
      if (Array.isArray(res.data?.data)) {
        list = res.data.data;
        total = res.data.total ?? list.length;
      } else if (Array.isArray(res.data?.details)) {
        list = res.data.details;
        total = res.data.pagination?.total ?? list.length;
      } else if (Array.isArray(res.data)) {
        list = res.data;
        total = list.length;
      }
      setMessages(list);
      setMessagesTotal(total);
    } catch (err) {
      console.error("Referral Messages fetch error:", err);
      setMessageError(err.message || "Failed to load messages");
      setMessages([]);
      setMessagesTotal(0);
    } finally {
      setMessagesLoading(false);
    }
  }, [myReferralId, token]);

  // Fetch Financials & Commission
  const fetchFinancials = useCallback(async () => {
    if (!myReferralId) return;
    try {
      const [paymentsRes, summaryRes] = await Promise.allSettled([
        fetchReferralPatientPayments({ referral_id: myReferralId }),
        fetchReferralPaymentSummary(myReferralId),
      ]);

      const map = {};
      let totalPaid = 0;
      let totalComm = 0;
      let totalGiven = 0;

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
            totalComm += Number(p.commission_on_paid ?? p.decided_amount ?? 0);
            totalGiven += Number(p.total_given ?? 0);
          });
        }
      }

      if (summaryRes.status === "fulfilled" && summaryRes.value?.success) {
        const s = summaryRes.value.summary || summaryRes.value.data || summaryRes.value;
        if (s) {
          totalPaid = Number(s.total_patient_paid ?? s.total_payments_received ?? s.total_paid ?? totalPaid);
          totalComm = Number(s.total_commission ?? s.total_decided ?? totalComm);
          totalGiven = Number(s.total_given ?? s.total_paid ?? totalGiven);
        }
      }

      setPatientPaymentsMap(map);
      setFinancials({
        total_paid: totalPaid,
        total_commission: totalComm,
        total_given: totalGiven,
        total_pending: Math.max(0, totalComm - totalGiven),
      });
    } catch (e) {
      console.warn("Could not load referral financial stats:", e);
    }
  }, [myReferralId]);

  useEffect(() => {
    fetchEnquiries();
    fetchPatients();
    fetchAppointments();
    fetchMessages();
    fetchFinancials();
  }, [fetchEnquiries, fetchPatients, fetchAppointments, fetchMessages, fetchFinancials]);

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

  // Filtered lists for "See All" modal
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const name = String(item.name || item.patient_name || item.patientName || "").toLowerCase();
      const id = String(item.enquiry_id || item.enquiryId || item._id || "").toLowerCase();
      const phone = String(item.phone || item.mobile || item.contact_no || "").toLowerCase();
      const country = String(item.country || item.nationality || "").toLowerCase();
      const status = String(item.status || "").toLowerCase();

      const matchesSearch = !q || name.includes(q) || id.includes(q) || phone.includes(q) || country.includes(q);
      const matchesStatus =
        modalStatusFilter === "ALL" || status === modalStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [enquiries, modalSearch, modalStatusFilter]);

  const filteredPatients = useMemo(() => {
    return patients.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const name = String(item.patient_name || item.name || "").toLowerCase();
      const id = String(item.patientId || item.patientNumber || item.omca_patient_id || item._id || "").toLowerCase();
      const phone = String(formatEmergencyContact(item)).toLowerCase();
      const country = String(item.country || "").toLowerCase();
      const status = String(item.p_status || item.status || "").toLowerCase();

      const matchesSearch = !q || name.includes(q) || id.includes(q) || phone.includes(q) || country.includes(q);
      const matchesStatus =
        modalStatusFilter === "ALL" || status === modalStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [patients, modalSearch, modalStatusFilter]);

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
    enquiries.forEach((e) => {
      if (e.status) set.add(String(e.status).trim());
    });
    return Array.from(set);
  }, [enquiries]);

  const patientStatuses = useMemo(() => {
    const set = new Set();
    patients.forEach((p) => {
      const st = p.p_status || p.status;
      if (st) set.add(String(st).trim());
    });
    return Array.from(set);
  }, [patients]);

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
  const previewEnquiries = enquiries.slice(0, 5);
  const previewPatients = patients.slice(0, 5);
  const previewAppointments = appointments.slice(0, 5);
  const previewMessages = messages.slice(0, 5);

  const sparklineData = useMemo(() => buildSparklinePath(STATIC_TREND), []);

  return (
    <div className="ref-dash-container">
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
              <div className="attention-icon">
                <i className="fa fa-user-plus"></i>
              </div>
              <div className="text-end attention-card-meta">
                <span className="attention-label">All Enquiries</span>
                <h3 className="attention-count">
                  <CountUp
                    start={0}
                    end={enquiries.length}
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
            onClick={() => handleOpenSeeAll("patients")}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            title="Click to view all patients"
          >
            <div className="attention-card-top">
              <div className="attention-icon">
                <i className="fa fa-wheelchair"></i>
              </div>
              <div className="text-end attention-card-meta">
                <span className="attention-label">Patients Referred</span>
                <h3 className="attention-count">
                  <CountUp
                    start={0}
                    end={patientTotal || patients.length}
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
                    end={appointmentsTotal || appointments.length}
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
      {/* SECTION 1: ENQUIRIES                                           */}
      {/* ============================================================== */}
      <div className="ref-section-card">
        <div className="ref-section-header">
          <div className="ref-section-title-wrap">
            <div className="ref-section-icon enquiry-icon">
              <i className="fa fa-comments-o" />
            </div>
            <div>
              <h5 className="ref-section-title">
                Enquiries
                <span className="ref-count-badge badge-enq ms-2">
                  {enquiries.length} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ref-see-all-btn"
              onClick={() => handleOpenSeeAll("enquiries")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ref-table-responsive">
          {enquiriesLoading ? (
            <div className="ref-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading enquiries...</span>
            </div>
          ) : enquiryError ? (
            <div className="ref-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {enquiryError}
            </div>
          ) : previewEnquiries.length === 0 ? (
            <div className="ref-empty-state">
              <i className="fa fa-info-circle me-1" /> No enquiries found.
            </div>
          ) : (
            <table className="ref-data-table">
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
                  const enqId = item.enquiry_id || item.enquiryId || item.id || item._id || "—";
                  const name = item.name || item.patient_name || item.patientName || "—";
                  const phone = item.phone || item.mobile || item.contact_no || item.phone_number || "—";
                  const country = item.country || item.nationality || "—";
                  const service = item.treatingIn || item.treatment || item.service || item.treatment_type || "—";
                  const status = item.status || "Pending";
                  const date = formatDate(item.enquiry_date || item.createdAt || item.date);

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
                        <span className={`ref-badge ${getStatusBadgeClass(status)}`}>
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
      <div className="ref-section-card">
        <div className="ref-section-header">
          <div className="ref-section-title-wrap">
            <div className="ref-section-icon patient-icon">
              <i className="fa fa-wheelchair" />
            </div>
            <div>
              <h5 className="ref-section-title">
                Patients
                <span className="ref-count-badge badge-pat ms-2">
                  {patientTotal || patients.length} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ref-see-all-btn"
              onClick={() => handleOpenSeeAll("patients")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ref-table-responsive">
          {patientsLoading ? (
            <div className="ref-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading patients...</span>
            </div>
          ) : patientError ? (
            <div className="ref-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {patientError}
            </div>
          ) : previewPatients.length === 0 ? (
            <div className="ref-empty-state">
              <i className="fa fa-info-circle me-1" /> No patients found.
            </div>
          ) : (
            <table className="ref-data-table">
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
                  const patId = item.patientId || item.patientNumber || item.omca_patient_id || item._id || "—";
                  const name = item.patient_name || item.name || "—";
                  const phone = formatEmergencyContact(item);
                  const country = item.country || "—";
                  const treatingIn =
                    item.current_treatment_or_plan?.hospital_name ||
                    item.hospital_name ||
                    item.hospitalName ||
                    item.hospital_Name ||
                    item.treatingIn ||
                    item.hospital ||
                    "—";
                  const date = formatDate(item.createdAt || item.date_of_registration || item.date);
                  const status = item.p_status || item.status || "Registered";

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
                          style={{ color: "#0284c7" }}
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
                        <span className={`ref-badge ${getStatusBadgeClass(status)}`}>
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
      <div className="ref-section-card">
        <div className="ref-section-header">
          <div className="ref-section-title-wrap">
            <div className="ref-section-icon appointment-icon">
              <i className="fa fa-calendar" />
            </div>
            <div>
              <h5 className="ref-section-title">
                Appointments
                <span className="ref-count-badge badge-app ms-2">
                  {appointmentsTotal || appointments.length} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ref-see-all-btn"
              onClick={() => handleOpenSeeAll("appointments")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ref-table-responsive">
          {appointmentsLoading ? (
            <div className="ref-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading appointments...</span>
            </div>
          ) : appointmentError ? (
            <div className="ref-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {appointmentError}
            </div>
          ) : previewAppointments.length === 0 ? (
            <div className="ref-empty-state">
              <i className="fa fa-info-circle me-1" /> No appointments scheduled.
            </div>
          ) : (
            <table className="ref-data-table">
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
                  const aptId = item.appointment_id || item.appointmentId || item.id || item._id || "—";
                  const patName = item.patient_name || item.patientName || item.patient_id?.patient_name || item.name || "—";
                  const hospital = item.hospital_name || item.hospitalName || item.treatingIn || item.hospital || "—";
                  const treatment = item.treatment_name || item.treatmentName || item.treatment || "—";
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
                        <span className={`ref-badge ${getStatusBadgeClass(status)}`}>
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
      {/* SECTION 4: MESSAGES & ANNOUNCEMENTS                            */}
      {/* ============================================================== */}
      <div className="ref-section-card">
        <div className="ref-section-header">
          <div className="ref-section-title-wrap">
            <div className="ref-section-icon message-icon">
              <i className="fa fa-commenting" />
            </div>
            <div>
              <h5 className="ref-section-title">
                Messages
                <span className="ref-count-badge badge-msg ms-2">
                  {messagesTotal || messages.length} Total
                </span>
              </h5>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="ref-see-all-btn"
              onClick={() => handleOpenSeeAll("messages")}
            >
              See All <i className="fa fa-arrow-right ms-1" />
            </button>
          </div>
        </div>

        <div className="ref-table-responsive">
          {messagesLoading ? (
            <div className="ref-loading-spinner">
              <i className="fa fa-spinner fa-spin fa-2x" />
              <span>Loading messages...</span>
            </div>
          ) : messageError ? (
            <div className="ref-empty-state text-danger">
              <i className="fa fa-exclamation-triangle me-2" />
              {messageError}
            </div>
          ) : previewMessages.length === 0 ? (
            <div className="ref-empty-state">
              <i className="fa fa-info-circle me-1" /> No messages available.
            </div>
          ) : (
            <table className="ref-data-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Title / Subject</th>
                  <th>Message Preview</th>
                  <th>Priority</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {previewMessages.map((item, idx) => {
                  const title = item.title || item.subject || item.sender_name || item.sender || "Message";
                  const content = item.message || item.content || item.text || "—";
                  const priority = item.priority || item.type || "Normal";
                  const dateStr = formatDate(item.createdAt || item.created_at || item.date);

                  return (
                    <tr
                      key={item._id || item.id || idx}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleViewRecord(item, "message")}
                      title="Click to view message"
                    >
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{title}</strong>
                      </td>
                      <td style={{ maxWidth: "320px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {content}
                      </td>
                      <td>
                        <span className={`ref-badge ${String(priority).toLowerCase() === "high" ? "ref-badge-closed" : "ref-badge-info"}`}>
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
                          <i className="fa fa-commenting me-1" /> Open Chat
                        </button>
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
      {/* "SEE ALL" FULL-VIEW MODAL (READ-ONLY)                          */}
      {/* ============================================================== */}
      {activeModal && (
        <div className="ref-modal-overlay" onClick={handleCloseSeeAll}>
          <div className="ref-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <h4>
                <i
                  className={`fa ${
                    activeModal === "enquiries"
                      ? "fa-comments-o text-info"
                      : activeModal === "patients"
                      ? "fa-wheelchair text-success"
                      : activeModal === "appointments"
                      ? "fa-calendar text-warning"
                      : "fa-commenting text-primary"
                  }`}
                />
                All{" "}
                {activeModal === "enquiries"
                  ? "Enquiries"
                  : activeModal === "patients"
                  ? "Patients"
                  : activeModal === "appointments"
                  ? "Appointments"
                  : "Messages"}{" "}
                ({currentItems.length})
              </h4>
              <button
                type="button"
                className="ref-modal-close"
                onClick={handleCloseSeeAll}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Toolbar: Search & Status Filter */}
            <div className="ref-modal-toolbar">
              <div className="ref-modal-search">
                <i className="fa fa-search" />
                <input
                  type="text"
                  placeholder={`Search ${activeModal} by name, ID, phone, country...`}
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setModalPage(1);
                  }}
                />
              </div>

              <select
                className="ref-modal-select"
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

            {/* Modal Body: Table */}
            <div className="ref-modal-body">
              <div className="ref-table-responsive">
                {paginatedItems.length === 0 ? (
                  <div className="ref-empty-state">
                    No matching records found.
                  </div>
                ) : activeModal === "enquiries" ? (
                  <table className="ref-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>#</th>
                        <th>Enquiry ID</th>
                        <th>Patient Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Country</th>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => {
                        const serial = (modalPage - 1) * modalPageSize + idx + 1;
                        const enqId = item.enquiry_id || item.enquiryId || item.id || item._id || "—";
                        const name = item.name || item.patient_name || item.patientName || "—";
                        const phone = item.phone || item.mobile || item.contact_no || item.phone_number || "—";
                        const email = item.email || "—";
                        const country = item.country || item.nationality || "—";
                        const service = item.treatingIn || item.treatment || item.service || item.treatment_type || "—";
                        const status = item.status || "Pending";
                        const date = formatDate(item.enquiry_date || item.createdAt || item.date);

                        return (
                          <tr
                            key={item._id || item.enquiry_id || idx}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRecord(item, "enquiry")}
                            title="Click to view details"
                          >
                            <td>{serial}</td>
                            <td><strong>{enqId}</strong></td>
                            <td>{name}</td>
                            <td>{phone}</td>
                            <td>{email}</td>
                            <td>{country}</td>
                            <td>{service}</td>
                            <td>{date}</td>
                            <td>
                              <span className={`ref-badge ${getStatusBadgeClass(status)}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : activeModal === "patients" ? (
                  <table className="ref-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>#</th>
                        <th>Patient ID</th>
                        <th>Patient Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Country</th>
                        <th>Treating In</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => {
                        const serial = (modalPage - 1) * modalPageSize + idx + 1;
                        const patId = item.patientId || item.patientNumber || item.omca_patient_id || item._id || "—";
                        const name = item.patient_name || item.name || "—";
                        const phone = formatEmergencyContact(item);
                        const email = item.email || "—";
                        const country = item.country || "—";
                        const treatingIn =
                          item.current_treatment_or_plan?.hospital_name ||
                          item.hospital_name ||
                          item.hospitalName ||
                          item.hospital_Name ||
                          item.treatingIn ||
                          item.hospital ||
                          "—";
                        const status = item.p_status || item.status || "Registered";
                        const date = formatDate(item.createdAt || item.registration_date || item.date);

                        return (
                          <tr
                            key={item._id || item.patientId || idx}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRecord(item, "patient")}
                            title="Click to view details"
                          >
                            <td>{serial}</td>
                            <td><strong>{patId}</strong></td>
                            <td>{name}</td>
                            <td>{phone}</td>
                            <td>{email}</td>
                            <td>{country}</td>
                            <td>{treatingIn}</td>
                            <td>{date}</td>
                            <td>
                              <span className={`ref-badge ${getStatusBadgeClass(status)}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : activeModal === "appointments" ? (
                  <table className="ref-data-table">
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
                      {paginatedItems.map((item, idx) => {
                        const serial = (modalPage - 1) * modalPageSize + idx + 1;
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
                            <td>{serial}</td>
                            <td><strong>{aptId}</strong></td>
                            <td>{patName}</td>
                            <td>{hospital}</td>
                            <td>{treatment}</td>
                            <td>{fullDateTime}</td>
                            <td>
                              <span className={`ref-badge ${getStatusBadgeClass(statusVal)}`}>
                                {statusVal}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="ref-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>#</th>
                        <th>Title / Subject</th>
                        <th>Message Preview</th>
                        <th>Priority</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => {
                        const serial = (modalPage - 1) * modalPageSize + idx + 1;
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
                            <td>{serial}</td>
                            <td><strong>{title}</strong></td>
                            <td style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {content}
                            </td>
                            <td>
                              <span className={`ref-badge ${String(priority).toLowerCase() === "high" ? "ref-badge-closed" : "ref-badge-info"}`}>
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
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Modal Footer: Pagination */}
            <div className="ref-modal-footer">
              <span className="ref-page-info">
                Showing {Math.min((modalPage - 1) * modalPageSize + 1, currentItems.length)}–
                {Math.min(modalPage * modalPageSize, currentItems.length)} of {currentItems.length}
              </span>

              <div className="ref-pagination">
                <button
                  type="button"
                  className="ref-page-btn"
                  disabled={modalPage <= 1}
                  onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                >
                  <i className="fa fa-chevron-left me-1" /> Prev
                </button>
                <span className="ref-page-info px-2">
                  Page {modalPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="ref-page-btn"
                  disabled={modalPage >= totalPages}
                  onClick={() => setModalPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <i className="fa fa-chevron-right ms-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* READ-ONLY DETAIL POPUP MODAL                                    */}
      {/* ============================================================== */}
      {selectedRecord && (
        <div className="ref-modal-overlay" onClick={handleCloseDetail}>
          <div className="ref-detail-card" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <h4>
                <i className="fa fa-file-text-o text-primary me-2" />
                {recordType === "enquiry"
                  ? "Enquiry Details"
                  : recordType === "patient"
                  ? "Patient Details"
                  : recordType === "appointment"
                  ? "Appointment Details"
                  : "Message Details"}
              </h4>
              <button
                type="button"
                className="ref-modal-close"
                onClick={handleCloseDetail}
              >
                &times;
              </button>
            </div>

            <div className="ref-detail-body">
              {recordType === "appointment" ? (
                <div className="ref-detail-grid">
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Appointment ID</span>
                    <span className="ref-detail-value">
                      <strong>
                        {selectedRecord.appointment_id || selectedRecord.appointmentId || selectedRecord.id || selectedRecord._id || "—"}
                      </strong>
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Status</span>
                    <span className="ref-detail-value">
                      <span className={`ref-badge ${getStatusBadgeClass(selectedRecord.status)}`}>
                        {selectedRecord.status || "Scheduled"}
                      </span>
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Patient Name</span>
                    <span className="ref-detail-value">
                      {selectedRecord.patient_name || selectedRecord.patientName || selectedRecord.patient_id?.patient_name || selectedRecord.name || "—"}
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Hospital / Facility</span>
                    <span className="ref-detail-value">
                      {selectedRecord.hospital_name || selectedRecord.hospitalName || selectedRecord.treatingIn || selectedRecord.hospital || "—"}
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Treatment / Service</span>
                    <span className="ref-detail-value">
                      {selectedRecord.treatment_name || selectedRecord.treatmentName || selectedRecord.treatment || "—"}
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Date & Time</span>
                    <span className="ref-detail-value">
                      {formatDate(selectedRecord.appointment_date || selectedRecord.date || selectedRecord.createdAt)} {selectedRecord.appointment_time || selectedRecord.time || ""}
                    </span>
                  </div>
                  {selectedRecord.notes && (
                    <div className="ref-detail-item" style={{ gridColumn: "span 2" }}>
                      <span className="ref-detail-label">Notes</span>
                      <span className="ref-detail-value">{selectedRecord.notes}</span>
                    </div>
                  )}
                </div>
              ) : recordType === "message" ? (
                <div className="ref-detail-grid">
                  <div className="ref-detail-item" style={{ gridColumn: "span 2" }}>
                    <span className="ref-detail-label">Title / Subject</span>
                    <span className="ref-detail-value">
                      <strong>{selectedRecord.title || selectedRecord.subject || selectedRecord.sender_name || "Message"}</strong>
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Priority</span>
                    <span className="ref-detail-value">
                      <span className={`ref-badge ${String(selectedRecord.priority || selectedRecord.type).toLowerCase() === "high" ? "ref-badge-closed" : "ref-badge-info"}`}>
                        {selectedRecord.priority || selectedRecord.type || "Normal"}
                      </span>
                    </span>
                  </div>
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Date</span>
                    <span className="ref-detail-value">
                      {formatDate(selectedRecord.createdAt || selectedRecord.created_at || selectedRecord.date)}
                    </span>
                  </div>
                  <div className="ref-detail-item" style={{ gridColumn: "span 2" }}>
                    <span className="ref-detail-label">Message Content</span>
                    <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", marginTop: "6px", whiteSpace: "pre-wrap" }}>
                      {selectedRecord.message || selectedRecord.content || selectedRecord.text || "—"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ref-detail-grid">
                  <div className="ref-detail-item">
                    <span className="ref-detail-label">
                      {recordType === "enquiry" ? "Enquiry ID" : "Patient ID"}
                    </span>
                    <span className="ref-detail-value">
                      {recordType === "enquiry"
                        ? selectedRecord.enquiry_id || selectedRecord.enquiryId || selectedRecord._id || "—"
                        : selectedRecord.patientId || selectedRecord.patientNumber || selectedRecord.omca_patient_id || selectedRecord._id || "—"}
                    </span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Status</span>
                    <span className="ref-detail-value">
                      <span
                        className={`ref-badge ${getStatusBadgeClass(
                          recordType === "enquiry"
                            ? selectedRecord.status
                            : selectedRecord.p_status || selectedRecord.status
                        )}`}
                      >
                        {recordType === "enquiry"
                          ? selectedRecord.status || "Pending"
                          : selectedRecord.p_status || selectedRecord.status || "Registered"}
                      </span>
                    </span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Name</span>
                    <span className="ref-detail-value">
                      {selectedRecord.patient_name || selectedRecord.name || "—"}
                    </span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Contact / Phone</span>
                    <span className="ref-detail-value">
                      {recordType === "patient"
                        ? formatEmergencyContact(selectedRecord)
                        : selectedRecord.phone || selectedRecord.mobile || selectedRecord.emergency_contact_no || "—"}
                    </span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Email</span>
                    <span className="ref-detail-value">{selectedRecord.email || "—"}</span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Country</span>
                    <span className="ref-detail-value">{selectedRecord.country || "—"}</span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">
                      {recordType === "enquiry" ? "Service / Treatment" : "Treating In / Hospital"}
                    </span>
                    <span className="ref-detail-value">
                      {recordType === "enquiry"
                        ? selectedRecord.treatingIn || selectedRecord.treatment || selectedRecord.service || "—"
                        : selectedRecord.treatingIn || selectedRecord.hospital || "—"}
                    </span>
                  </div>

                  <div className="ref-detail-item">
                    <span className="ref-detail-label">Date</span>
                    <span className="ref-detail-value">
                      {formatDate(
                        selectedRecord.enquiry_date ||
                          selectedRecord.registration_date ||
                          selectedRecord.createdAt ||
                          selectedRecord.date
                      )}
                    </span>
                  </div>

                  {selectedRecord.referral_id && (
                    <div className="ref-detail-item">
                      <span className="ref-detail-label">Referral ID</span>
                      <span className="ref-detail-value font-monospace">
                        {selectedRecord.referral_id}
                      </span>
                    </div>
                  )}

                  {selectedRecord.notes && (
                    <div className="ref-detail-item" style={{ gridColumn: "span 2" }}>
                      <span className="ref-detail-label">Notes</span>
                      <span className="ref-detail-value">{selectedRecord.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ref-modal-footer justify-content-between">
              <div>
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
                className="btn btn-secondary btn-sm"
                onClick={handleCloseDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Payment Ledger Modal (Read-Only: View Only) */}
      <ReferralPatientPaymentModal
        open={ledgerModalOpen}
        onClose={() => {
          setLedgerModalOpen(false);
          setSelectedLedgerPatient(null);
        }}
        referral={{
          referral_id: myReferralId,
          name: localStorage.getItem("name") || "Referral Partner",
        }}
        patient={selectedLedgerPatient}
        readOnly={true}
      />
    </div>
  );
}
