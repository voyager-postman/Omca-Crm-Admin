import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  fetchInsurances,
  fetchInsuranceById,
  createInsurance,
  updateInsurance,
  deleteInsurance,
  fetchInsurancePatients,
  fetchInsurancePaymentSummary,
  fetchInsurancePatientPayments,
} from "../../services/insuranceApi";
import InsurancePatientPaymentModal from "./InsurancePatientPaymentModal";
import { markRecordRead } from "../../services/unreadApi";
import { clearUnreadById, UnreadDot } from "../../components/NewTag";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { GetAllCountries2 } from "../../reducer/Countries";
import CountryCodeSelect from "../Enquiry/CountryCodeSelect";
import CloseIcon from "@mui/icons-material/Close";
import { PATIENT_STATUS_OPTIONS, normalizePatientStatus } from "../../utils/patientStatus";
import "./Insurances.css";

// Robust multi-format Date Parser for patient registration dates
const parseAnyDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  const str = String(dateVal).trim();
  if (!str) return null;

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Check if a patient's date falls within [dateFrom, dateTo]
const isDateInRange = (patientDate, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  const d = parseAnyDate(patientDate);
  if (!d) return false;

  if (fromStr) {
    const from = new Date(`${fromStr}T00:00:00`);
    if (!isNaN(from.getTime()) && d < from) return false;
  }
  if (toStr) {
    const to = new Date(`${toStr}T23:59:59`);
    if (!isNaN(to.getTime()) && d > to) return false;
  }
  return true;
};

export default function Insurances() {
  const navigate = useNavigate();
  const userRole = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toUpperCase();
  const rawIns = localStorage.getItem("insurance_id") || "";
  const isInsuranceUser =
    userRole === "INSURANCE" ||
    Boolean(rawIns && rawIns !== "undefined" && rawIns !== "null");
  const myInsuranceId = rawIns && rawIns !== "undefined" && rawIns !== "null" ? rawIns : "";
  const myName = localStorage.getItem("name") || "Insurance Partner";

  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Filter Criteria State (Matches Manage Patients Dashboard & Filters)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [referrerFilter, setReferrerFilter] = useState("ALL");
  const [patientStatusFilter, setPatientStatusFilter] = useState("ALL");
  const [quickFilter, setQuickFilter] = useState("");

  // All Insurance Partners List & Patients / Payment Cache
  const [allInsurancesList, setAllInsurancesList] = useState([]);
  const [insuranceDataMap, setInsuranceDataMap] = useState({});
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [modalShowAll, setModalShowAll] = useState(false);

  const dispatch = useDispatch();
  const { Countries } = useSelector((state) => state.Countries || {});

  useEffect(() => {
    if (!Countries || Countries.length === 0) {
      dispatch(GetAllCountries2());
    }
  }, [dispatch, Countries]);

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentInsurance, setCurrentInsurance] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    insurance_id: "",
    name: "",
    phone_code: "",
    phone: "",
    email: "",
    password: "",
    status: 1,
  });

  // Details & Linked Patients Modal State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailInsurance, setDetailInsurance] = useState(null);
  const [linkedPatients, setLinkedPatients] = useState([]);
  const [linkedPatientsCount, setLinkedPatientsCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  // Payment Ledger & Commission Tracking State
  const [patientPaymentModalOpen, setPatientPaymentModalOpen] = useState(false);
  const [selectedPaymentPatient, setSelectedPaymentPatient] = useState(null);
  const [selectedPaymentInsurance, setSelectedPaymentInsurance] = useState(null);
  const [paymentModalReadOnly, setPaymentModalReadOnly] = useState(false);
  const [insurancePaymentSummary, setInsurancePaymentSummary] = useState({
    total_patients: 0,
    total_decided: 0,
    total_given: 0,
    total_pending: 0,
  });
  const [patientPaymentsMap, setPatientPaymentsMap] = useState({});

  // Helper to open Patient Payment Ledger Modal
  const handleOpenPatientPayment = (patientItem, insuranceItem, isReadOnly = false) => {
    const pKey =
      patientItem?.patientId ||
      patientItem?.id ||
      patientItem?.patient_id ||
      patientItem?.omcaPatientId ||
      patientItem?.omca_patient_id;
    const paymentInfo =
      patientPaymentsMap[String(pKey)] ||
      patientPaymentsMap[String(patientItem?.patientId)] ||
      patientPaymentsMap[String(patientItem?.id)] ||
      patientPaymentsMap[String(patientItem?.omcaPatientId)] ||
      patientPaymentsMap[String(patientItem?.omca_patient_id)] ||
      {};

    setSelectedPaymentPatient({
      ...patientItem,
      ...paymentInfo,
      id: patientItem?.id || patientItem?.patientId || paymentInfo?.id,
      patientId: patientItem?.patientId || patientItem?.id || paymentInfo?.patientId,
      patientName: patientItem?.patientName || patientItem?.name || paymentInfo?.patientName,
      omcaPatientId:
        patientItem?.omcaPatientId ||
        patientItem?.omca_patient_id ||
        patientItem?.patientNumber ||
        paymentInfo?.omcaPatientId,
      patientNumber:
        patientItem?.patientNumber ||
        patientItem?.omcaPatientId ||
        patientItem?.omca_patient_id ||
        paymentInfo?.omcaPatientId,
      treatments: patientItem?.treatments || paymentInfo?.treatments || [],
    });
    setSelectedPaymentInsurance(insuranceItem || detailInsurance);
    setPaymentModalReadOnly(isReadOnly);
    setPatientPaymentModalOpen(true);
  };

  // Helper to process payments API data (supports { patients: [...] } structure)
  const processPaymentsData = (paymentsValue, summaryValue, patientsList = null) => {
    const rawList =
      paymentsValue?.patients ||
      paymentsValue?.data ||
      paymentsValue?.paymentDetails ||
      [];
    const list = Array.isArray(rawList)
      ? rawList
      : paymentsValue?.patient
        ? [paymentsValue.patient]
        : paymentsValue?.paymentDetails
          ? [paymentsValue.paymentDetails]
          : [];

    const pts = patientsList || linkedPatients || [];
    const map = {};
    let calcPaid = 0;
    let calcInsurance = 0;
    let calcGiven = 0;
    let calcRemaining = 0;

    if (!pts || pts.length === 0) {
      setPatientPaymentsMap({});
      setInsurancePaymentSummary({
        total_patients: 0,
        total_paid: 0,
        total_insurance: 0,
        total_decided: 0,
        total_given: 0,
        total_pending: 0,
      });
      return;
    }

    if (Array.isArray(list) && list.length > 0) {
      list.forEach((p) => {
        const pId = p.patientId ?? p.patient_id ?? p.id ?? "";
        const omcaId = p.omcaPatientId ?? p.omca_patient_id ?? "";
        const name = p.patientName ?? p.patient_name ?? p.name ?? "";
        const given = Number(
          p.totalSettled ??
          p.total_settled ??
          p.totalGiven ??
          p.total_given ??
          0
        );

        const pNameClean = String(name || p.patient_name || p.patientName || "").trim().toLowerCase();
        const pIdClean = String(pId || "").trim().toLowerCase();
        const omcaIdClean = String(omcaId || "").trim().toLowerCase();

        const matchedPt = pts.find((item) => {
          const itemId = String(item.patientId ?? item.id ?? item._id ?? item.patient_id ?? "").trim().toLowerCase();
          const itemOmca = String(item.omcaPatientId ?? item.omca_patient_id ?? item.patientNumber ?? "").trim().toLowerCase();
          const itemName = String(item.patientName ?? item.name ?? "").trim().toLowerCase();
          if (pIdClean && itemId && pIdClean === itemId) return true;
          if (omcaIdClean && itemOmca && omcaIdClean === itemOmca) return true;
          if (pIdClean && itemOmca && pIdClean === itemOmca) return true;
          if (omcaIdClean && itemId && omcaIdClean === itemId) return true;
          // Only fallback to name match if neither has an ID
          if (!pIdClean && !omcaIdClean && pNameClean && itemName && pNameClean === itemName) return true;
          return false;
        }) || { patientId: pId, omcaPatientId: omcaId, patientName: name };

        let insEarned = Number(
          matchedPt?.claim_on_paid ??
          matchedPt?.insurance_on_paid ??
          p.claim_on_paid ??
          p.insurance_on_paid ??
          p.insuranceOnPaid ??
          0
        );

        let ptPaid = Number(
          matchedPt?.hospital_paid ??
          matchedPt?.total_paid ??
          p.hospital_paid ??
          p.total_paid ??
          p.payments_received ??
          p.paid_bill ??
          0
        );

        if (matchedPt && Array.isArray(matchedPt.treatments) && matchedPt.treatments.length > 0) {
          if (ptPaid === 0) {
            ptPaid = matchedPt.treatments.reduce(
              (sum, t) => sum + Number(t.hospital_paid ?? t.payments_received ?? 0),
              0
            );
          }
          if (insEarned === 0) {
            insEarned = matchedPt.treatments.reduce(
              (sum, t) => sum + Number(t.claim_on_paid ?? t.insurance_on_paid ?? 0),
              0
            );
          }
        }

        const remaining = Number(
          matchedPt?.commission_due ??
          matchedPt?.remaining_due ??
          p.commission_due ??
          p.remaining_due ??
          Math.max(0, Math.round((insEarned - given) * 100) / 100)
        );

        const status =
          insEarned > 0 && given >= insEarned
            ? "Completed"
            : given > 0
              ? "Partial"
              : "Pending";

        calcPaid += ptPaid;
        calcInsurance += insEarned;
        calcGiven += given;
        calcRemaining += remaining;

        const pData = {
          patientId: pId || matchedPt?.patientId,
          omcaPatientId: omcaId || matchedPt?.omcaPatientId,
          patientName: name || matchedPt?.patientName,
          phone: p.phone || matchedPt?.phone || "",
          email: p.email || matchedPt?.email || "",
          total_paid: ptPaid,
          insurance_on_paid: insEarned,
          decided_amount: insEarned,
          total_given: given,
          remaining_due: remaining,
          status: status,
          records: Array.isArray(p.records) ? p.records : [],
          treatments: matchedPt?.treatments || [],
        };

        const mapKeys = [
          pId,
          omcaId,
          p.id,
          name,
          String(name).toLowerCase(),
          matchedPt?.patientId,
          matchedPt?.id,
          matchedPt?.omcaPatientId,
          matchedPt?.omca_patient_id,
          matchedPt?.patientNumber,
          matchedPt?.patientName,
          matchedPt?.name,
          String(matchedPt?.patientName || "").toLowerCase(),
          String(matchedPt?.name || "").toLowerCase(),
        ].filter(Boolean);

        mapKeys.forEach((k) => {
          map[String(k)] = pData;
        });
      });
    }

    // Also include pts that may not have payments API record yet
    pts.forEach((pt) => {
      const pKey = pt.patientId || pt.patient_id || pt.id || pt.omcaPatientId || pt.omca_patient_id || pt.patientNumber;
      const existingData =
        (pKey && map[String(pKey)]) ||
        (pt.patientId && map[String(pt.patientId)]) ||
        (pt.patient_id && map[String(pt.patient_id)]) ||
        (pt.id && map[String(pt.id)]) ||
        (pt.omcaPatientId && map[String(pt.omcaPatientId)]) ||
        (pt.omca_patient_id && map[String(pt.omca_patient_id)]) ||
        null;

      if (!existingData) {
        let ptPaid = Number(
          pt.hospital_paid ??
          pt.total_paid ??
          (Array.isArray(pt.treatments)
            ? pt.treatments.reduce((sum, t) => sum + Number(t.hospital_paid ?? t.payments_received ?? 0), 0)
            : 0)
        );

        let insEarned = Number(
          pt.claim_on_paid ??
          pt.insurance_on_paid ??
          (Array.isArray(pt.treatments)
            ? pt.treatments.reduce((sum, t) => sum + Number(t.claim_on_paid ?? t.insurance_on_paid ?? 0), 0)
            : 0)
        );

        const given = Number(pt.total_given || pt.totalGiven || pt.totalSettled || pt.total_settled || 0);
        const remaining = Number(
          pt.commission_due ??
          pt.remaining_due ??
          Math.max(0, Math.round((insEarned - given) * 100) / 100)
        );

        calcPaid += ptPaid;
        calcInsurance += insEarned;
        calcGiven += given;
        calcRemaining += remaining;

        const ptData = {
          patientId: pt.patientId || pt.patient_id || pt.id,
          omcaPatientId: pt.omcaPatientId || pt.omca_patient_id || pt.patientNumber,
          patientName: pt.patientName || pt.name,
          phone: pt.phone || "",
          email: pt.email || "",
          total_paid: ptPaid,
          insurance_on_paid: insEarned,
          decided_amount: insEarned,
          total_given: given,
          remaining_due: remaining,
          status: insEarned > 0 && given >= insEarned ? "Completed" : given > 0 ? "Partial" : "Pending",
          records: [],
          treatments: pt.treatments || [],
        };

        const keys = [
          pKey,
          pt.patientId,
          pt.patient_id,
          pt.id,
          pt.omcaPatientId,
          pt.omca_patient_id,
          pt.patientNumber,
        ].filter(Boolean);

        keys.forEach((k) => {
          map[String(k)] = ptData;
        });
      }
    });

    setPatientPaymentsMap(map);

    const backendSummary =
      summaryValue?.summary ||
      summaryValue?.dashboardStats ||
      (summaryValue && typeof summaryValue === "object" && (summaryValue.total_hospital_paid !== undefined || summaryValue.total_claim_on_paid !== undefined || summaryValue.total_patients !== undefined || summaryValue.total_settled !== undefined)
        ? summaryValue
        : null);
    if (backendSummary && typeof backendSummary === "object") {
      setInsurancePaymentSummary({
        total_patients: Number(backendSummary.total_patients ?? pts.length),
        total_paid: Number(backendSummary.total_hospital_paid ?? calcPaid),
        total_insurance: Number(backendSummary.total_claim_on_paid ?? calcInsurance),
        total_decided: Number(backendSummary.total_claim_amount ?? calcInsurance),
        total_given: Number(backendSummary.total_settled ?? calcGiven),
        total_pending: Number(backendSummary.total_commission_due ?? backendSummary.total_remaining_due ?? calcRemaining),
      });
    } else {
      setInsurancePaymentSummary({
        total_patients: pts.length || list.length,
        total_paid: calcPaid,
        total_insurance: calcInsurance,
        total_decided: calcInsurance,
        total_given: calcGiven,
        total_pending: calcRemaining,
      });
    }
  };

  // Helper to refresh payments for current insurance
  const refreshPaymentsForCurrentReferral = async () => {
    const refId =
      detailInsurance?.insurance_id ||
      detailInsurance?.id ||
      myInsuranceId ||
      "";
    if (!refId) return;

    try {
      const [summaryRes, paymentsRes] = await Promise.allSettled([
        fetchInsurancePaymentSummary(refId),
        fetchInsurancePatientPayments({ insurance_id: refId }),
      ]);

      processPaymentsData(
        paymentsRes.status === "fulfilled" ? paymentsRes.value : null,
        summaryRes.status === "fulfilled" ? summaryRes.value : null,
        linkedPatients
      );
    } catch (e) {
      console.warn("Failed to refresh payments:", e);
    }
  };

  // Load Insurance Partners list (for Admin / Staff)
  const loadInsurances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchInsurances({
        page,
        limit,
        search,
        status: statusFilter === "ALL" ? undefined : Number(statusFilter),
      });

      if (res && res.success) {
        setInsurances(Array.isArray(res.insurances) ? res.insurances : []);
        setTotal(res.total || 0);
      } else {
        setInsurances([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Failed to load insurances:", err);
      Swal.fire("Error", err.response?.data?.message || "Failed to load insurances", "error");
      setInsurances([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  // Load comprehensive stats & patients across insurance partners in controlled batches
  const loadAllInsuranceStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const allRes = await fetchInsurances({ limit: 50 });
      const partners = allRes?.insurances || allRes?.data || (Array.isArray(allRes) ? allRes : []);
      if (Array.isArray(partners) && partners.length > 0) {
        setAllInsurancesList(partners);

        // Fetch stats in small batch to avoid flooding backend network connection pool
        const batch = partners.slice(0, 20);
        const statsPromises = batch.map(async (r) => {
          const rId = r.insurance_id || r.id;
          if (!rId) return null;
          try {
            const [ptsRes, sumRes] = await Promise.allSettled([
              fetchInsurancePatients(rId),
              fetchInsurancePaymentSummary(rId),
            ]);

            const patients =
              ptsRes.status === "fulfilled" &&
                ptsRes.value?.success &&
                Array.isArray(ptsRes.value.patients)
                ? ptsRes.value.patients
                : [];

            const summary =
              sumRes.status === "fulfilled" &&
                (sumRes.value?.summary || sumRes.value?.data || sumRes.value)
                ? (sumRes.value.summary || sumRes.value.data || sumRes.value)
                : null;

            return {
              rId: String(rId),
              patients,
              summary,
              paymentsValue: null,
            };
          } catch (err) {
            return { rId: String(rId), patients: [], summary: null, paymentsValue: null };
          }
        });

        const results = await Promise.all(statsPromises);
        const map = {};
        const payMap = {};

        results.forEach((item) => {
          if (item && item.rId) {
            map[item.rId] = item;

            const pList =
              item.paymentsValue?.patients ||
              item.paymentsValue?.data ||
              item.paymentsValue?.paymentDetails ||
              [];
            if (Array.isArray(pList)) {
              pList.forEach((p) => {
                const pId = p.patientId ?? p.patient_id ?? p.id ?? "";
                const omcaId = p.omcaPatientId ?? p.omca_patient_id ?? "";
                const decided = Number(p.decidedAmount ?? p.decided_amount ?? 0);
                const given = Number(p.totalGiven ?? p.total_given ?? 0);
                const remaining = Number(
                  p.remainingDue ?? p.remaining_due ?? Math.max(0, decided - given)
                );
                const pData = {
                  patientId: pId,
                  omcaPatientId: omcaId,
                  patientName: p.patientName ?? p.name ?? "",
                  decided_amount: decided,
                  total_given: given,
                  remaining_due: remaining,
                  status: p.status,
                };
                if (pId) payMap[String(pId)] = pData;
                if (omcaId) payMap[String(omcaId)] = pData;
                if (p.id) payMap[String(p.id)] = pData;
              });
            }
          }
        });

        setInsuranceDataMap(map);
        setPatientPaymentsMap((prev) => ({ ...payMap, ...prev }));
      }
    } catch (err) {
      console.warn("Failed to load overall insurance stats:", err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Load Partner Portal data (for Referral partner)
  const loadPartnerData = useCallback(async () => {
    setLoading(true);
    try {
      if (myInsuranceId) {
        const [detailRes, patientsRes, paymentsRes] = await Promise.allSettled([
          fetchInsuranceById(myInsuranceId),
          fetchInsurancePatients(myInsuranceId),
          fetchInsurancePatientPayments({ insurance_id: myInsuranceId }),
        ]);

        if (detailRes.status === "fulfilled" && detailRes.value?.success) {
          setDetailInsurance(detailRes.value.insurance);
          setLinkedPatientsCount(detailRes.value.linkedPatientsCount || 0);
        }
        if (patientsRes.status === "fulfilled" && patientsRes.value?.success) {
          const rawPatients = patientsRes.value.patients || [];
          setLinkedPatients(rawPatients);
          if (patientsRes.value.totalPatients !== undefined) {
            setLinkedPatientsCount(patientsRes.value.totalPatients);
          }
          const realSummary = patientsRes.value?.summary || null;
          processPaymentsData(
            paymentsRes.status === "fulfilled" ? paymentsRes.value : null,
            realSummary,
            rawPatients
          );
        } else {
          processPaymentsData(
            paymentsRes.status === "fulfilled" ? paymentsRes.value : null,
            null
          );
        }
      }
    } catch (err) {
      console.warn("Failed to load partner data:", err);
    } finally {
      setLoading(false);
    }
  }, [myInsuranceId]);

  useEffect(() => {
    if (isInsuranceUser) {
      loadPartnerData();
    } else {
      loadInsurances();
      loadAllInsuranceStats();
    }
  }, [isInsuranceUser, loadPartnerData, loadInsurances, loadAllInsuranceStats]);

  // Debounced or on-submit search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentInsurance(null);
    setFormData({
      insurance_id: "",
      name: "",
      phone_code: "",
      phone: "",
      email: "",
      password: "",
      status: 1,
    });
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const markReferralAction = (refItem) => {
    const recordId = refItem?.insurance_id || refItem?.id;
    if (!recordId) return;
    markRecordRead("insurances", recordId);
    setInsurances((prev) =>
      clearUnreadById(prev, recordId, ["insurance_id", "id"]),
    );
  };

  const handleOpenEdit = (refItem) => {
    markReferralAction(refItem);
    setIsEditing(true);
    setCurrentInsurance(refItem);
    setFormData({
      insurance_id: refItem.insurance_id || "",
      name: refItem.name || "",
      phone_code: refItem.phone_code || "",
      phone: refItem.phone || "",
      email: refItem.email || "",
      password: "", // Leave blank if not updating
      status: refItem.status !== undefined ? Number(refItem.status) : 1,
    });
    setIsFormOpen(true);
  };

  // Save Referral (Create or Update)
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      Swal.fire("Validation Error", "Name is required", "warning");
      return;
    }
    if (!formData.phone_code.trim()) {
      Swal.fire("Validation Error", "Please select a country code", "warning");
      return;
    }
    if (!formData.phone.trim()) {
      Swal.fire("Validation Error", "Phone number is required", "warning");
      return;
    }
    if (!formData.email.trim()) {
      Swal.fire("Validation Error", "Email address is required", "warning");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      Swal.fire("Validation Error", "Please enter a valid email address", "warning");
      return;
    }
    if (!isEditing && !formData.password.trim()) {
      Swal.fire("Validation Error", "Password is required for new insurance partner", "warning");
      return;
    }

    setFormSubmitting(true);
    try {
      if (isEditing) {
        const updatePayload = {
          name: formData.name.trim(),
          phone_code: formData.phone_code.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          status: Number(formData.status),
        };
        if (formData.password.trim()) {
          updatePayload.password = formData.password.trim();
        }

        const identifier = currentInsurance?.insurance_id || currentInsurance?.id;
        const res = await updateInsurance(identifier, updatePayload);
        if (res && res.success) {
          Swal.fire("Success", res.message || "Insurance partner updated successfully", "success");
          setIsFormOpen(false);
          loadInsurances();
        } else {
          Swal.fire("Error", res.message || "Failed to update insurance partner", "error");
        }
      } else {
        const createPayload = {
          name: formData.name.trim(),
          phone_code: formData.phone_code.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          status: Number(formData.status),
        };
        if (formData.insurance_id.trim()) {
          createPayload.insurance_id = formData.insurance_id.trim();
        }

        const res = await createInsurance(createPayload);
        if (res && res.success) {
          Swal.fire("Success", res.message || "Insurance partner created successfully", "success");
          setIsFormOpen(false);
          loadInsurances();
        } else {
          Swal.fire("Error", res.message || "Failed to create insurance partner", "error");
        }
      }
    } catch (err) {
      console.error("Save insurance error:", err);
      const errMsg =
        err.response?.data?.message || err.message || "An error occurred while saving insurance";
      Swal.fire("Error", errMsg, "error");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Insurance
  const handleDelete = (refItem) => {
    markReferralAction(refItem);
    const identifier = refItem.insurance_id || refItem.id;
    Swal.fire({
      title: "Delete Insurance Partner?",
      text: `Are you sure you want to delete ${refItem.name} (${refItem.insurance_id || refItem.id})? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await deleteInsurance(identifier);
          if (res && res.success) {
            Swal.fire("Deleted!", res.message || "Insurance partner deleted successfully.", "success");
            loadInsurances();
          } else {
            Swal.fire("Error", res.message || "Failed to delete insurance partner", "error");
          }
        } catch (err) {
          console.error("Delete insurance error:", err);
          Swal.fire("Error", err.response?.data?.message || "Failed to delete insurance partner", "error");
        }
      }
    });
  };

  // Toggle status directly from table
  const handleToggleStatus = async (refItem) => {
    markReferralAction(refItem);
    const newStatus = refItem.status === 1 ? 0 : 1;
    const identifier = refItem.insurance_id || refItem.id;
    try {
      const res = await updateInsurance(identifier, { status: newStatus });
      if (res && res.success) {
        Swal.fire({
          icon: "success",
          title: "Status Updated",
          text: `${refItem.name} marked as ${newStatus === 1 ? "Active" : "Inactive"}`,
          timer: 1500,
          showConfirmButton: false,
        });
        loadInsurances();
      } else {
        Swal.fire("Error", res.message || "Failed to update status", "error");
      }
    } catch (err) {
      console.error("Toggle status error:", err);
      Swal.fire("Error", err.response?.data?.message || "Failed to update status", "error");
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

    setIsDetailOpen(false);

    localStorage.setItem("patientMainTab", "treatment");

    navigate("/Admin/Patient-Detail?tab=treatment", {
      state: {
        patientId: targetPid,
        patientNumber: patientNumber,
        user_id: userId,
        mainTab: "treatment",
        tab: "treatment",
        createdAt: pt.createdAt || pt.created_at || pt.date,
      },
    });
  };

  // View Details & Linked Patients
  const handleOpenDetails = async (refItem, initialPatients = null) => {
    markReferralAction(refItem);
    setIsDetailOpen(true);
    setDetailLoading(true);
    setDetailInsurance(refItem);
    setModalShowAll(false);

    const rId = String(refItem.insurance_id || refItem.id);
    const cachedPatients = Array.isArray(initialPatients)
      ? initialPatients
      : insuranceDataMap[rId]?.patients || [];

    setLinkedPatients(cachedPatients);
    setLinkedPatientsCount(cachedPatients.length);
    setPatientSearch("");
    setPatientPaymentsMap({});
    setInsurancePaymentSummary({
      total_patients: cachedPatients.length,
      total_decided: 0,
      total_given: 0,
      total_pending: 0,
    });

    const identifier = refItem.insurance_id || refItem.id;
    try {
      const [detailRes, patientsRes, summaryRes, paymentsRes] = await Promise.allSettled([
        fetchInsuranceById(identifier),
        fetchInsurancePatients(refItem.insurance_id || refItem.id),
        fetchInsurancePaymentSummary(refItem.insurance_id || refItem.id),
        fetchInsurancePatientPayments({ insurance_id: refItem.insurance_id || refItem.id }),
      ]);

      if (detailRes.status === "fulfilled" && detailRes.value?.success && detailRes.value.insurance) {
        setDetailInsurance(detailRes.value.insurance);
        setLinkedPatientsCount(detailRes.value.linkedPatientsCount || 0);
      }

      let currentPatients = [];
      if (patientsRes.status === "fulfilled" && patientsRes.value?.success && Array.isArray(patientsRes.value.patients)) {
        currentPatients = patientsRes.value.patients;
      } else if (Array.isArray(cachedPatients) && cachedPatients.length > 0) {
        currentPatients = cachedPatients;
      }

      setLinkedPatients(currentPatients);
      if (patientsRes.status === "fulfilled" && patientsRes.value?.totalPatients !== undefined) {
        setLinkedPatientsCount(patientsRes.value.totalPatients);
      } else {
        setLinkedPatientsCount(currentPatients.length);
      }

      const realSummary =
        (patientsRes.status === "fulfilled" && patientsRes.value?.summary)
          ? patientsRes.value.summary
          : (summaryRes.status === "fulfilled" && summaryRes.value?.summary?.total_hospital_paid !== undefined)
            ? summaryRes.value.summary
            : null;

      processPaymentsData(
        paymentsRes.status === "fulfilled" ? paymentsRes.value : null,
        realSummary,
        currentPatients
      );
    } catch (err) {
      console.warn("Error fetching details/patients/payments:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Helper to determine if a patient matches the active filter criteria (Date, Country, Referrer, Status)
  const matchesPatientFilters = useCallback(
    (p, partnerRefId) => {
      // 1. Date Range
      if (dateFrom || dateTo) {
        const pDate = p.created_at || p.createdAt || p.date || p.admission_date || p.registered_date;
        if (!isDateInRange(pDate, dateFrom, dateTo)) return false;
      }

      // 2. Country
      if (countryFilter && countryFilter !== "ALL") {
        const pCountry = String(
          p.country || p.country_name || p.patient_country || p.nationality || p.treatingIn || ""
        ).trim().toLowerCase();
        if (pCountry !== countryFilter.toLowerCase()) return false;
      }

      // 3. Referrer
      if (referrerFilter && referrerFilter !== "ALL") {
        const pRefId = String(p.insurance_id || p.insuranceId || partnerRefId || "").trim().toLowerCase();
        if (pRefId !== referrerFilter.toLowerCase()) return false;
      }

      // 4. Patient Status
      if (patientStatusFilter && patientStatusFilter !== "ALL") {
        const rawStatus = String(p.p_status || p.patient_status || p.status || "").trim();
        const normStatus = normalizePatientStatus(rawStatus);
        const target = patientStatusFilter.toLowerCase();
        if (rawStatus.toLowerCase() !== target && normStatus.toLowerCase() !== target) {
          return false;
        }
      }

      return true;
    },
    [dateFrom, dateTo, countryFilter, referrerFilter, patientStatusFilter]
  );

  // Active filters detection
  const hasActivePatientFilters = useMemo(() => {
    return Boolean(
      dateFrom ||
      dateTo ||
      (countryFilter && countryFilter !== "ALL") ||
      (patientStatusFilter && patientStatusFilter !== "ALL")
    );
  }, [dateFrom, dateTo, countryFilter, patientStatusFilter]);

  const hasActiveFilter = useMemo(() => {
    return Boolean(
      hasActivePatientFilters ||
      (referrerFilter && referrerFilter !== "ALL") ||
      statusFilter !== "ALL" ||
      quickFilter !== "" ||
      search !== ""
    );
  }, [hasActivePatientFilters, referrerFilter, statusFilter, quickFilter, search]);

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCountryFilter("ALL");
    setReferrerFilter("ALL");
    setPatientStatusFilter("ALL");
    setStatusFilter("ALL");
    setQuickFilter("");
    setSearch("");
    setSearchInput("");
    setPage(1);
  };

  // Country options dynamically merged from Redux countries + actual referred patient data
  const allCountryOptions = useMemo(() => {
    const fromRedux = (Countries || [])
      .map((c) => c?.name || c?.country_name || (typeof c === "string" ? c : ""))
      .filter(Boolean);
    const fromPatients = [];
    Object.values(insuranceDataMap).forEach((item) => {
      (item.patients || []).forEach((p) => {
        const c = p.country || p.country_name || p.patient_country || p.nationality || p.treatingIn;
        if (c && typeof c === "string") fromPatients.push(c.trim());
      });
    });
    return Array.from(new Set([...fromRedux, ...fromPatients])).sort((a, b) => a.localeCompare(b));
  }, [Countries, insuranceDataMap]);

  // Referrer partner dropdown options
  const referrerOptions = useMemo(() => {
    return allInsurancesList.length > 0 ? allInsurancesList : insurances;
  }, [allInsurancesList, insurances]);

  // Filtered linked patients for modal display
  const filteredPatients = useMemo(() => {
    let list = linkedPatients || [];

    // Filter by criteria if active and not explicitly bypassed with "Show All"
    if (hasActivePatientFilters && !modalShowAll) {
      list = list.filter((p) =>
        matchesPatientFilters(p, detailInsurance?.insurance_id || detailInsurance?.id)
      );
    }

    if (!patientSearch.trim()) return list;
    const q = patientSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.patientName?.toLowerCase().includes(q) ||
        p.omca_patient_id?.toLowerCase().includes(q) ||
        p.omcaPatientId?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.passport_number?.toLowerCase().includes(q)
    );
  }, [
    linkedPatients,
    patientSearch,
    hasActivePatientFilters,
    modalShowAll,
    matchesPatientFilters,
    detailInsurance,
  ]);

  // Compute Active/Inactive stats from full or current partners
  const activeCount = useMemo(() => {
    const list = allInsurancesList.length > 0 ? allInsurancesList : insurances;
    return list.filter((r) => r.status === 1 || r.status === "1").length;
  }, [allInsurancesList, insurances]);

  const inactiveCount = useMemo(() => {
    const list = allInsurancesList.length > 0 ? allInsurancesList : insurances;
    return list.filter((r) => r.status === 0 || r.status === "0").length;
  }, [allInsurancesList, insurances]);

  // Dynamic Dashboard Stats (Calculated from existing insurance & patient payment data)
  const dashboardStats = useMemo(() => {
    let totalPatients = 0;
    let totalCommission = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalClaimAmount = 0;
    let completedPatients = 0;

    const partners = allInsurancesList.length > 0 ? allInsurancesList : insurances;

    partners.forEach((r) => {
      const rId = String(r.insurance_id || r.id);
      const rData = insuranceDataMap[rId];
      const patients = rData?.patients || [];
      const summary = rData?.summary;

      if (referrerFilter && referrerFilter !== "ALL") {
        if (
          rId.toLowerCase() !== referrerFilter.toLowerCase() &&
          String(r.name || "").toLowerCase() !== referrerFilter.toLowerCase()
        ) {
          return;
        }
      }

      if (statusFilter !== "ALL") {
        if (String(r.status) !== String(statusFilter)) return;
      }

      const pCount = Number(
        summary?.total_patients ??
        summary?.totalPatients ??
        r.patients_count ??
        r.total_patients ??
        patients.length
      );

      const claimOnPaid = Number(
        summary?.total_claim_on_paid ??
        summary?.totalClaimOnPaid ??
        r.total_claim_on_paid ??
        r.claim_on_paid ??
        summary?.total_calculated_commission ??
        0
      );

      const claimAmt = Number(
        summary?.total_claim_amount ??
        summary?.total_decided ??
        r.total_claim_amount ??
        r.total_decided ??
        0
      );

      const settledAmt = Number(
        summary?.total_settled ??
        summary?.total_settled_amount ??
        summary?.total_given ??
        r.total_settled_amount ??
        r.total_settled ??
        0
      );

      const dueAmt = Number(
        summary?.total_commission_due ??
        summary?.totalCommissionDue ??
        r.total_commission_due ??
        r.commission_due ??
        Math.max(0, Math.round((claimOnPaid - settledAmt) * 100) / 100)
      );

      if (!hasActivePatientFilters) {
        if (pCount === 0 && patients.length === 0) {
          // No patients assigned to this partner, so no commissions or payouts
          return;
        }

        totalPatients += pCount;
        totalCommission += claimOnPaid;
        totalPaid += settledAmt;
        totalPending += dueAmt;
        totalClaimAmount += claimAmt;

        patients.forEach((p) => {
          const st = normalizePatientStatus(p.p_status || p.status);
          if (st === "Treatment Completed") completedPatients++;
        });
      } else {
        const matchingPatients = patients.filter((p) => matchesPatientFilters(p, rId));
        totalPatients += matchingPatients.length;

        matchingPatients.forEach((p) => {
          const pKey = p.patientId || p.id || p.patient_id || p.omcaPatientId || p.omca_patient_id;
          const pPay = patientPaymentsMap[String(pKey)];
          const commEarned = Number(
            pPay?.insurance_on_paid ??
            p.claim_on_paid ??
            p.insurance_on_paid ??
            (Array.isArray(p.treatments)
              ? p.treatments.reduce((sum, t) => sum + Number(t.claim_on_paid ?? t.insurance_on_paid ?? 0), 0)
              : pPay?.decided_amount ?? p.decided_amount ?? 0)
          );
          const given = Number(pPay?.total_given ?? pPay?.total_settled ?? p.total_given ?? p.total_settled ?? 0);
          const remaining = Number(
            pPay?.remaining_due ??
            p.commission_due ??
            p.remaining_due ??
            Math.max(0, Math.round((commEarned - given) * 100) / 100)
          );
          totalCommission += commEarned;
          totalPaid += given;
          totalPending += remaining;

          const st = normalizePatientStatus(p.p_status || p.status);
          if (st === "Treatment Completed") completedPatients++;
        });
      }
    });

    return {
      totalPatients,
      totalCommission,
      totalPaid,
      totalPending,
      totalClaimAmount,
      completedPatients,
    };
  }, [
    allInsurancesList,
    insurances,
    insuranceDataMap,
    patientPaymentsMap,
    referrerFilter,
    statusFilter,
    hasActivePatientFilters,
    matchesPatientFilters,
  ]);

  // Filtered Referral rows to display in table
  const displayedInsurances = useMemo(() => {
    let list = insurances;

    if (referrerFilter && referrerFilter !== "ALL") {
      list = list.filter((r) => {
        const rId = String(r.insurance_id || r.id || "").toLowerCase();
        return (
          rId === referrerFilter.toLowerCase() ||
          String(r.name || "").toLowerCase() === referrerFilter.toLowerCase()
        );
      });
    }

    if (quickFilter === "active") {
      list = list.filter((r) => r.status === 1 || r.status === "1");
    } else if (quickFilter === "inactive") {
      list = list.filter((r) => r.status === 0 || r.status === "0");
    } else if (quickFilter === "with_patients") {
      list = list.filter((r) => {
        const rId = String(r.insurance_id || r.id);
        const pts = insuranceDataMap[rId]?.patients || [];
        const pCount = Number(r.patients_count ?? r.total_patients ?? pts.length);
        return pCount > 0;
      });
    } else if (quickFilter === "paid") {
      list = list.filter((r) => {
        const rId = String(r.insurance_id || r.id);
        const sum = insuranceDataMap[rId]?.summary;
        const paidVal = Number(r.total_settled_amount ?? r.total_settled ?? sum?.total_settled ?? sum?.total_settled_amount ?? sum?.total_given ?? sum?.totalGiven ?? 0);
        return paidVal > 0;
      });
    } else if (quickFilter === "pending_payment") {
      list = list.filter((r) => {
        const rId = String(r.insurance_id || r.id);
        const sum = insuranceDataMap[rId]?.summary;
        const dueVal = Number(r.total_commission_due ?? r.commission_due ?? sum?.total_commission_due ?? sum?.totalCommissionDue ?? 0);
        return dueVal > 0;
      });
    }

    if (hasActivePatientFilters) {
      list = list.filter((r) => {
        const rId = String(r.insurance_id || r.id);
        const pts = insuranceDataMap[rId]?.patients || [];
        const matches = pts.filter((p) => matchesPatientFilters(p, rId));
        return matches.length > 0;
      });
    }

    return list;
  }, [
    insurances,
    referrerFilter,
    quickFilter,
    hasActivePatientFilters,
    insuranceDataMap,
    matchesPatientFilters,
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="page-wrapper">
      <div className="content insurances-page">
        {isInsuranceUser ? (
          <div>
            {/* Header Card */}
            <div className="insurance-header-card d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h3 className="insurance-title">
                  <i className="fa fa-shield text-success" /> Insurance Partner Portal
                </h3>
                <p className="insurance-subtitle">
                  Welcome, <strong>{detailInsurance?.name || myName}</strong>! Track your registered patients and submit new patient enquiries.
                </p>
              </div>
              <div className="d-flex align-items-center gap-3">
                <button
                  className="btn btn-success"
                  onClick={() => navigate("/Admin/add-Enquiry")}
                >
                  <i className="fa fa-user-plus me-1" /> Submit Insured Patient
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={loadPartnerData}
                  title="Refresh Patients"
                >
                  <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Summary Banner */}
            <div className="insurance-detail-banner">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <h4>{detailInsurance?.name || myName}</h4>
                  <div className="d-flex align-items-center gap-3 mt-2 flex-wrap">
                    <span className="badge bg-light text-dark font-monospace">
                      Insurance ID: {detailInsurance?.insurance_id || myInsuranceId || "—"}
                    </span>
                    {(detailInsurance?.phone || localStorage.getItem("phone")) && (
                      <span>
                        <i className="fa fa-phone me-1" />
                        {detailInsurance?.phone_code ? `${detailInsurance.phone_code} ` : ""}
                        {detailInsurance?.phone || localStorage.getItem("phone")}
                      </span>
                    )}
                    {detailInsurance?.email && (
                      <span>
                        <i className="fa fa-envelope me-1" />
                        {detailInsurance.email}
                      </span>
                    )}
                    <span className="badge bg-success">Active Partner</span>
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                    <div className="fs-3 fw-bold">{linkedPatientsCount}</div>
                    <div className="small">Linked Patients</div>
                  </div>
                  <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                    <div className="fs-3 fw-bold text-white">
                      $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_paid || 0).toLocaleString() : 0}
                    </div>
                    <div className="small">Total Amount</div>
                  </div>
                  <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                    <div className="fs-3 fw-bold text-white">
                      $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_insurance || insurancePaymentSummary.total_decided || 0).toLocaleString() : 0}
                    </div>
                    <div className="small">Total Claim</div>
                  </div>
                  <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                    <div className="fs-3 fw-bold" style={{ color: "#86efac" }}>
                      $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_given || 0).toLocaleString() : 0}
                    </div>
                    <div className="small">{isInsuranceUser ? "Claim Received" : "Settled Amount"}</div>
                  </div>
                  <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                    <div className="fs-3 fw-bold" style={{ color: "#fde047" }}>
                      $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_pending || 0).toLocaleString() : 0}
                    </div>
                    <div className="small">Commission Due</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="insurance-filter-bar d-flex flex-wrap align-items-center justify-content-between gap-3">
              <h5 className="mb-0 fw-bold">
                <i className="fa fa-wheelchair text-success me-2" />
                Your Referred Patients ({linkedPatients.length})
              </h5>
              <div className="search-input-wrapper" style={{ minWidth: 260 }}>
                <i className="fa fa-search" />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Filter your patients..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Patients Table */}
            <div className="insurance-table-container">
              {loading ? (
                <div className="text-center py-5">
                  <CircularProgress size={36} />
                  <div className="mt-2 text-muted">Loading your patients...</div>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa fa-users fa-3x mb-2 text-secondary" />
                  <p className="mb-2">
                    {linkedPatients.length === 0
                      ? "No linked patients found yet."
                      : "No matching patients found."}
                  </p>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => navigate("/Admin/add-Enquiry")}
                  >
                    + Add Patient Enquiry
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table insurance-table">
                    <thead>
                      <tr>
                        <th>Patient Name</th>
                        <th>Contact Number</th>
                        <th>Total Amount</th>
                        <th>Total Claim</th>
                        <th>Settled Amount</th>
                        <th>Commission Due</th>
                        <th className="text-center">Ledger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((pt) => {
                        const pKey =
                          pt.patientId ||
                          pt.id ||
                          pt.patient_id ||
                          pt.omcaPatientId ||
                          pt.omca_patient_id;
                        const pPay =
                          patientPaymentsMap[String(pt.patientId)] ||
                          patientPaymentsMap[String(pt.id)] ||
                          patientPaymentsMap[String(pt.omcaPatientId)] ||
                          patientPaymentsMap[String(pt.omca_patient_id)] ||
                          patientPaymentsMap[String(pKey)] ||
                          null;

                        const displayName = pt.patientName || pt.name || "Patient";
                        const displayOmcaId =
                          pt.omcaPatientId ||
                          pt.omca_patient_id ||
                          (pt.patientId ? `PT-${pt.patientId}` : pt.id ? `PT-${pt.id}` : "—");
                        const insEarned = Number(
                          pPay?.insurance_on_paid ??
                          pt.insurance_on_paid ??
                          (Array.isArray(pt.treatments)
                            ? pt.treatments.reduce((sum, t) => sum + Number(t.insurance_on_paid || 0), 0)
                            : pPay?.decided_amount ?? pt.decided_amount ?? pt.decidedAmount ?? 0)
                        );

                        const givenAmt = Number(
                          pPay?.total_given ?? pt.totalGiven ?? pt.total_given ?? 0
                        );
                        const remainingAmt = Number(
                          pPay?.remaining_due ?? pt.remainingDue ?? pt.remaining_due ?? Math.max(0, Math.round((insEarned - givenAmt) * 100) / 100)
                        );
                        const payStatus =
                          pPay?.status ||
                          pt.status ||
                          (insEarned > 0 && givenAmt >= insEarned
                            ? "Completed"
                            : givenAmt > 0
                              ? "Partial"
                              : "Pending");

                        return (
                          <tr key={pt.patientId || pt.id || pt.omca_patient_id}>
                            <td>
                              <strong>{displayName}</strong>
                              {pt.email && (
                                <div className="text-muted small">{pt.email}</div>
                              )}
                            </td>
                            <td>{pt.phone || "—"}</td>
                            <td>
                              <span className="fw-semibold" style={{ color: "#0284c7" }}>
                                $ {Number(pPay?.total_paid ?? pt?.total_paid ?? 0).toLocaleString()}
                              </span>
                            </td>
                            <td>
                              {insEarned > 0 ? (
                                <span className="fw-bold" style={{ color: "#0f766e" }}>
                                  $ {insEarned.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted small fst-italic">—</span>
                              )}
                            </td>
                            <td>
                              <span className="text-success fw-bold">
                                $ {givenAmt.toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`fw-semibold ${remainingAmt > 0 ? "text-warning" : "text-success"
                                  }`}
                              >
                                $ {remainingAmt.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success py-1 px-2"
                                style={{ fontSize: "11.5px", borderRadius: "6px" }}
                                title="View payment ledger & payout records"
                                onClick={() => handleOpenPatientPayment(pt, detailInsurance, true)}
                              >
                                <i className="fa fa-receipt me-1" /> View Ledger
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Header Card */}
            <div className="insurance-header-card d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h3 className="insurance-title">
                  <i className="fa fa-shield text-success" /> Insurance Management
                </h3>
                <p className="insurance-subtitle">
                  Manage insurance partners, monitor linked patients, and track insurance commissions.
                </p>
              </div>
              <div className="d-flex align-items-center gap-3">
                <button className="btn btn-success" onClick={handleOpenAdd}>
                  <i className="fa fa-plus me-1" /> Add New Insurance
                </button>
              </div>
            </div>

            {/* Top KPI Cards Grid (Matches Manage Patients Dashboard & CRM Statuses) */}
            <div className="patient-kpi-grid">
              {/* 1. Total Patients Referred */}
              <div
                className={`patient-kpi-card ${!hasActiveFilter ? "active-kpi" : ""}`}
                onClick={handleResetFilters}
                title="Click to reset filters and view all linked patients"
              >
                <div className="patient-kpi-icon blue">
                  <i className="fa-solid fa-users" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{dashboardStats.totalPatients}</h3>
                  <span>Total Linked Patients</span>
                </div>
              </div>

              {/* 2. Total Commission */}
              <div
                className="patient-kpi-card"
                title="Total commission for insurance patients"
              >
                <div className="patient-kpi-icon indigo">
                  <i className="fa-solid fa-file-invoice-dollar" />
                </div>
                <div className="patient-kpi-info">
                  <h3>$ {Number(dashboardStats.totalCommission || 0).toLocaleString()}</h3>
                  <span>Total Commission</span>
                </div>
              </div>

              {/* 3. Commission Paid */}
              <div
                className={`patient-kpi-card ${quickFilter === "paid" ? "active-kpi" : ""}`}
                onClick={() => setQuickFilter((prev) => (prev === "paid" ? "" : "paid"))}
                title="Click to filter partners with received payouts"
              >
                <div className="patient-kpi-icon green">
                  <i className="fa-solid fa-circle-check" />
                </div>
                <div className="patient-kpi-info">
                  <h3>$ {Number(dashboardStats.totalPaid || 0).toLocaleString()}</h3>
                  <span>Commission Paid</span>
                </div>
              </div>

              {/* 4. Pending Commission Due */}
              <div
                className={`patient-kpi-card ${quickFilter === "pending_payment" ? "active-kpi" : ""}`}
                onClick={() => setQuickFilter((prev) => (prev === "pending_payment" ? "" : "pending_payment"))}
                title="Click to filter partners with remaining pending payouts"
              >
                <div className="patient-kpi-icon amber">
                  <i className="fa-solid fa-clock" />
                </div>
                <div className="patient-kpi-info">
                  <h3>$ {Number(dashboardStats.totalPending || 0).toLocaleString()}</h3>
                  <span>Pending Due</span>
                </div>
              </div>

              {/* 5. Active Partners */}
              <div
                className={`patient-kpi-card ${statusFilter === "1" ? "active-kpi" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "1" ? "ALL" : "1"));
                  setPage(1);
                }}
                title="Click to filter Active Partners"
              >
                <div className="patient-kpi-icon teal">
                  <i className="fa-solid fa-shield-alt fa-shield" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{activeCount}</h3>
                  <span>Active Partners ({total} Total)</span>
                </div>
              </div>

              {/* 6. Treatment Completed Patients */}
              <div
                className={`patient-kpi-card ${patientStatusFilter === "Treatment Completed" ? "active-kpi" : ""}`}
                onClick={() => {
                  setPatientStatusFilter((prev) => (prev === "Treatment Completed" ? "ALL" : "Treatment Completed"));
                }}
                title="Click to filter Treatment Completed patients"
              >
                <div className="patient-kpi-icon purple">
                  <i className="fa-solid fa-suitcase-medical" />
                </div>
                <div className="patient-kpi-info">
                  <h3>{dashboardStats.completedPatients}</h3>
                  <span>Treatment Completed</span>
                </div>
              </div>
            </div>

            {/* Main Toolbar & Search Card */}
            <div className="insurance-filter-bar">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h6 className="mb-0 fw-bold" style={{ fontSize: "16px", color: "#1e293b" }}>
                    Insurance Partners Directory
                  </h6>
                  <span
                    style={{
                      backgroundColor: "#e0f2fe",
                      color: "#0284c7",
                      border: "1px solid #bae6fd",
                      borderRadius: "20px",
                      padding: "3px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {displayedInsurances.length} of {total} Partners
                  </span>
                  <span
                    style={{
                      backgroundColor: "#dcfce7",
                      color: "#15803d",
                      border: "1px solid #bbf7d0",
                      borderRadius: "20px",
                      padding: "3px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {dashboardStats.totalPatients} Linked Patients
                  </span>
                  {hasActiveFilter && (
                    <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1" style={{ fontSize: "11px" }}>
                      <i className="fa fa-filter" /> Filter Active
                      <i
                        className="fa fa-times ms-1"
                        style={{ cursor: "pointer" }}
                        onClick={handleResetFilters}
                        title="Reset Filters"
                      />
                    </span>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {/* Search Input */}
                  <form onSubmit={handleSearchSubmit} className="d-flex align-items-center gap-1">
                    <div className="search-input-wrapper">
                      <i className="fa fa-search" />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search by name, phone, email, ID..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-outline-secondary btn-sm" title="Search">
                      Search
                    </button>
                    {search && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleClearSearch}
                        title="Clear Search"
                      >
                        <i className="fa fa-times" />
                      </button>
                    )}
                  </form>

                  {/* Toggle Advanced Filters Button */}
                  <button
                    type="button"
                    className={`btn btn-sm ${showAdvancedFilters || hasActiveFilter ? "btn-primary" : "btn-outline-secondary"} d-inline-flex align-items-center gap-1`}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    title="Toggle Filter Criteria Panel"
                    style={{ height: 40 }}
                  >
                    <i className="fa fa-sliders" />
                    Filters
                    {hasActiveFilter && <span className="badge bg-light text-primary ms-1">Active</span>}
                  </button>

                  {/* Partner Status Select */}
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 130, height: 40 }}
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>

                  {/* Refresh Button */}
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      loadInsurances();
                      loadAllInsuranceStats();
                    }}
                    title="Refresh Listing & Patient Stats"
                    style={{ height: 40 }}
                  >
                    <i className={`fa fa-refresh ${loading || isStatsLoading ? "fa-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Quick Status Chips Bar (Matches Manage Patients) */}
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2 pt-2 border-top">
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginRight: 4 }}>
                  QUICK:
                </span>
                <button
                  type="button"
                  className={`quick-filter-chip ${!hasActiveFilter && !quickFilter ? "active" : ""}`}
                  onClick={handleResetFilters}
                >
                  All Partners
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${quickFilter === "active" || statusFilter === "1" ? "active" : ""}`}
                  onClick={() => {
                    setQuickFilter((prev) => (prev === "active" ? "" : "active"));
                    setStatusFilter((prev) => (prev === "1" ? "ALL" : "1"));
                    setPage(1);
                  }}
                >
                  <i className="fa fa-circle" style={{ fontSize: 7, color: "#10b981" }} /> Active Partners
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${quickFilter === "with_patients" ? "active" : ""}`}
                  onClick={() => setQuickFilter((prev) => (prev === "with_patients" ? "" : "with_patients"))}
                >
                  <i className="fa fa-wheelchair" style={{ fontSize: 11, color: "#9333ea" }} /> With Linked Patients
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${quickFilter === "paid" ? "active" : ""}`}
                  onClick={() => setQuickFilter((prev) => (prev === "paid" ? "" : "paid"))}
                >
                  <i className="fa fa-check-circle" style={{ fontSize: 11, color: "#16a34a" }} /> Commission Paid
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${quickFilter === "pending_payment" ? "active" : ""}`}
                  onClick={() => setQuickFilter((prev) => (prev === "pending_payment" ? "" : "pending_payment"))}
                >
                  <i className="fa fa-clock-o" style={{ fontSize: 11, color: "#d97706" }} /> Commission Due
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${patientStatusFilter === "Confirmed" ? "active" : ""}`}
                  onClick={() => setPatientStatusFilter((prev) => (prev === "Confirmed" ? "ALL" : "Confirmed"))}
                >
                  Confirmed Patients
                </button>
                <button
                  type="button"
                  className={`quick-filter-chip ${patientStatusFilter === "Treatment Completed" ? "active" : ""}`}
                  onClick={() => setPatientStatusFilter((prev) => (prev === "Treatment Completed" ? "ALL" : "Treatment Completed"))}
                >
                  Treatment Completed
                </button>
                {hasActiveFilter && (
                  <button
                    type="button"
                    className="quick-filter-chip text-danger"
                    onClick={handleResetFilters}
                    style={{ background: "#fee2e2", borderColor: "#fecaca" }}
                  >
                    <i className="fa fa-times" /> Reset Filters
                  </button>
                )}
              </div>

              {/* Collapsible Advanced Filters Panel (Matches Manage Patients) */}
              {showAdvancedFilters && (
                <div className="advanced-filters-panel">
                  <div className="row gx-3 gy-2 align-items-end">
                    {/* Referrer Selector */}
                    <div className="col-md-3 col-sm-6">
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                        Referrer Partner
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={referrerFilter}
                        onChange={(e) => setReferrerFilter(e.target.value)}
                      >
                        <option value="ALL">All Referrers ({allInsurancesList.length || total})</option>
                        {referrerOptions.map((r) => (
                          <option key={r.id || r.insurance_id} value={r.insurance_id || r.id}>
                            {r.name} ({r.insurance_id || `REF-${r.id}`})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Country Selector */}
                    <div className="col-md-3 col-sm-6">
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                        Country
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                      >
                        <option value="ALL">All Countries</option>
                        {allCountryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Patient Status Selector */}
                    <div className="col-md-3 col-sm-6">
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                        Patient Status
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={patientStatusFilter}
                        onChange={(e) => setPatientStatusFilter(e.target.value)}
                      >
                        <option value="ALL">All Patient Statuses</option>
                        {PATIENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Reset Button */}
                    <div className="col-md-3 col-sm-6">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm w-100"
                        onClick={handleResetFilters}
                        disabled={!hasActiveFilter}
                        style={{ height: 35 }}
                      >
                        <i className="fa fa-refresh me-1" /> Reset Filter Criteria
                      </button>
                    </div>
                  </div>

                  {/* Date Range Group (Matches Manage Patients) */}
                  <div className="patient-date-range-group">
                    <div className="patient-date-range-label">Date Range (Patient Registered / Created)</div>
                    <div className="row gx-3 gy-2 align-items-end">
                      <div className="col-md-3 col-sm-6">
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Date From
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="col-md-3 col-sm-6">
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Date To
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>
                      {(dateFrom || dateTo) && (
                        <div className="col-md-3 col-sm-6">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => {
                              setDateFrom("");
                              setDateTo("");
                            }}
                          >
                            Clear Dates
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Insurance Partners Table */}
            <div className="insurance-table-container">
              <div className="table-responsive">
                <table className="table insurance-table">
                  <thead>
                    <tr>
                      <th>Insurance ID</th>
                      <th>Partner Name</th>
                      <th>Contact Info</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Linked Patients</th>
                      <th>Joined Date</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="text-center py-5">
                          <CircularProgress size={36} />
                          <div className="mt-2 text-muted">Loading insurances...</div>
                        </td>
                      </tr>
                    ) : displayedInsurances.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-5 text-muted">
                          <i className="fa fa-folder-open-o fa-3x mb-2 text-secondary" />
                          <p className="mb-2">
                            {hasActiveFilter
                              ? "No insurance partners found matching the active filter criteria."
                              : "No insurance partners found."}
                          </p>
                          {hasActiveFilter ? (
                            <button className="btn btn-sm btn-outline-danger" onClick={handleResetFilters}>
                              <i className="fa fa-times me-1" /> Reset Filters
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-outline-success" onClick={handleOpenAdd}>
                              + Add First Insurance Partner
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      displayedInsurances.map((item) => {
                        const isActive = item.status === 1 || item.status === "1";
                        const rId = String(item.insurance_id || item.id);
                        const rData = insuranceDataMap[rId];
                        const allPatients = rData?.patients || [];
                        const matchingPatients = hasActivePatientFilters
                          ? allPatients.filter((p) => matchesPatientFilters(p, rId))
                          : allPatients;
                        const partnerPatientCount =
                          isStatsLoading && !rData
                            ? "..."
                            : hasActivePatientFilters
                              ? matchingPatients.length
                              : allPatients.length || item.linkedPatientsCount || 0;

                        return (
                          <tr
                            key={item.id || item.insurance_id}
                            className={item.isUnread ? "unread-row" : undefined}
                          >
                            <td>
                              <span
                                className="insurance-id-tag"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleOpenDetails(item, matchingPatients)}
                                title="Click to view partner details & patients"
                              >
                                {item.insurance_id || `REF-${item.id}`}
                              </span>
                              <UnreadDot unread={item.isUnread === true} />
                            </td>
                            <td>
                              <strong
                                style={{
                                  cursor: "pointer",
                                  color: "#0284c7",
                                }}
                                onClick={() => handleOpenDetails(item, matchingPatients)}
                                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                title="Click to view partner details & patients"
                              >
                                {item.name}
                              </strong>
                              {item.role && (
                                <div className="text-muted small">Role: {item.role}</div>
                              )}
                            </td>
                            <td>
                              <div>
                                <i className="fa fa-phone text-muted me-1" />
                                {item.phone_code ? `${item.phone_code} ` : ""}
                                {item.phone}
                              </div>
                            </td>
                            <td>
                              {item.email ? (
                                <a href={`mailto:${item.email}`} className="text-decoration-none">
                                  {item.email}
                                </a>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>
                              <Tooltip title="Click to toggle status">
                                <span
                                  className={`status-pill ${isActive ? "active" : "inactive"}`}
                                  onClick={() => handleToggleStatus(item)}
                                >
                                  <i className={`fa fa-circle text-${isActive ? "success" : "danger"}`} />
                                  {isActive ? "Active" : "Inactive"}
                                </span>
                              </Tooltip>
                            </td>
                            <td>
                              <span
                                className="linked-patients-badge"
                                onClick={() => handleOpenDetails(item, matchingPatients)}
                                title={`View registered patients for ${item.name}`}
                              >
                                <i className="fa fa-wheelchair" />
                                View Patients ({partnerPatientCount})
                              </span>
                            </td>
                            <td>
                              {(() => {
                                const rawDate =
                                  item.created_at ||
                                  item.createdAt ||
                                  item.date ||
                                  item.joined_date ||
                                  item.createdDate ||
                                  item.registration_date;
                                if (!rawDate) return "—";
                                try {
                                  const d = new Date(rawDate);
                                  return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleDateString();
                                } catch {
                                  return "—";
                                }
                              })()}
                            </td>
                            <td className="text-end">
                              <div className="action-btn-group justify-content-end">
                                <Tooltip title="View Details & Patients">
                                  <button
                                    className="action-btn-circle view"
                                    onClick={() => handleOpenDetails(item, matchingPatients)}
                                  >
                                    <i className="fa fa-eye" />
                                  </button>
                                </Tooltip>
                                <Tooltip title="Partner Payments & Financials">
                                  <button
                                    className="action-btn-circle"
                                    style={{ color: "#059669", borderColor: "#a7f3d0", background: "#f0fdf4" }}
                                    onClick={() => handleOpenDetails(item, matchingPatients)}
                                  >
                                    <i className="fa fa-credit-card" />
                                  </button>
                                </Tooltip>
                                <Tooltip title="Edit Insurance Partner">
                                  <button
                                    className="action-btn-circle edit"
                                    onClick={() => handleOpenEdit(item)}
                                  >
                                    <i className="fa fa-pencil" />
                                  </button>
                                </Tooltip>
                                <Tooltip title="Delete Insurance Partner">
                                  <button
                                    className="action-btn-circle delete"
                                    onClick={() => handleDelete(item)}
                                  >
                                    <i className="fa fa-trash" />
                                  </button>
                                </Tooltip>
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
              {!loading && displayedInsurances.length > 0 && (
                <div className="d-flex flex-wrap align-items-center justify-content-between p-3 border-top gap-2">
                  <div className="text-muted small">
                    Showing {displayedInsurances.length} of {total} insurance partners (Page {page} of {totalPages})
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 85 }}
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <i className="fa fa-chevron-left" /> Prev
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next <i className="fa fa-chevron-right" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ----------------- ADD / EDIT INSURANCE MODAL ----------------- */}
        <Dialog
          open={isFormOpen}
          onClose={() => !formSubmitting && setIsFormOpen(false)}
          maxWidth="sm"
          fullWidth
          sx={{
            "& .MuiFormLabel-asterisk": {
              color: "#ef4444 !important",
              fontWeight: "700 !important",
            },
          }}
        >
          <form onSubmit={handleFormSubmit}>
            <DialogTitle className="d-flex justify-content-between align-items-center border-bottom pb-2">
              <span className="fw-bold">
                <i className={`fa ${isEditing ? "fa-pencil" : "fa-user-plus"} text-success me-2`} />
                {isEditing ? "Edit Insurance Partner" : "Add New Insurance Partner"}
              </span>
              <IconButton
                size="small"
                onClick={() => setIsFormOpen(false)}
                disabled={formSubmitting}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent className="pt-3">
              <div className="row g-3">
                {/* Insurance ID */}
                <div className="col-12">
                  <TextField
                    label="Insurance ID (Code)"
                    placeholder="Auto-generated e.g. REF1005 if blank"
                    fullWidth
                    size="small"
                    value={formData.insurance_id}
                    disabled={isEditing}
                    onChange={(e) => setFormData({ ...formData, insurance_id: e.target.value })}
                    helperText={
                      isEditing
                        ? "Insurance ID cannot be changed"
                        : "Optional. Leave blank to auto-generate (REF1001, REF1002...)"
                    }
                  />
                </div>

                {/* Partner Name */}
                <div className="col-12">
                  <TextField
                    label="Full Name"
                    placeholder="e.g. Dr. John Doe"
                    fullWidth
                    size="small"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Phone Number with Country Code */}
                <div className="col-12">
                  <label
                    className="form-label mb-1"
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#64748b",
                      display: "block",
                    }}
                  >
                    Phone Number <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: "2px" }}>*</span>
                  </label>
                  <div className="country-code" style={{ position: "relative" }}>
                    <CountryCodeSelect
                      value={formData.phone_code}
                      onChange={(code) => setFormData({ ...formData, phone_code: code })}
                      countries={Countries}
                      placeholder="+Code"
                    />
                    <input
                      type="tel"
                      className="form-control code-in"
                      placeholder="10-digit mobile number"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{ height: "38px", fontSize: "14px" }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="col-12">
                  <TextField
                    label="Email Address"
                    placeholder="e.g. partner@example.com"
                    type="email"
                    fullWidth
                    size="small"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                {/* Password */}
                <div className="col-12">
                  <TextField
                    label={isEditing ? "Password (Leave blank to keep current)" : "Password"}
                    placeholder="Password for partner portal login"
                    type="password"
                    fullWidth
                    size="small"
                    required={!isEditing}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                {/* Status */}
                <div className="col-12">
                  <TextField
                    select
                    label="Account Status"
                    fullWidth
                    size="small"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: Number(e.target.value) })
                    }
                  >
                    <MenuItem value={1}>Active</MenuItem>
                    <MenuItem value={0}>Inactive</MenuItem>
                  </TextField>
                </div>
              </div>
            </DialogContent>

            <DialogActions className="border-top p-3">
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setIsFormOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="success"
                disabled={formSubmitting}
                startIcon={formSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {formSubmitting
                  ? "Saving..."
                  : isEditing
                    ? "Update Insurance"
                    : "Create Insurance"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* ----------------- DETAILS & LINKED PATIENTS MODAL ----------------- */}
        <Dialog
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          maxWidth="lg"
          fullWidth
          scroll="paper"
          disableAutoFocus
          disableRestoreFocus
          PaperProps={{
            style: {
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              maxHeight: "calc(100vh - 80px)",
              height: "calc(100vh - 80px)",
              margin: "20px auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            },
          }}
        >
          <DialogTitle
            className="d-flex justify-content-between align-items-center border-bottom pb-2"
            style={{ flexShrink: 0, padding: "14px 22px" }}
          >
            <span className="fw-bold">
              <i className="fa fa-info-circle text-info me-2" />
              Insurance Partner Details & Linked Patients
            </span>
            <IconButton size="small" onClick={() => setIsDetailOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent
            dividers
            sx={{
              overflowY: "auto",
              minHeight: 0,
              padding: "18px 22px",
              backgroundColor: "#f8fafc",
              flex: "1 1 auto",
              scrollbarWidth: "thin",
              scrollbarColor: "#94a3b8 #f1f5f9",
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "#f1f5f9",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "#cbd5e1",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                backgroundColor: "#94a3b8",
              },
            }}
          >
            {detailLoading ? (
              <div className="text-center py-5">
                <CircularProgress size={32} />
                <p className="mt-2 text-muted">Loading details & patients...</p>
              </div>
            ) : (
              detailInsurance && (
                <>
                  {/* Summary Banner */}
                  <div className="insurance-detail-banner">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                      <div>
                        <h4>{detailInsurance.name}</h4>
                        <div className="d-flex align-items-center gap-3 mt-2 flex-wrap">
                          <span className="badge bg-light text-dark font-monospace">
                            ID: {detailInsurance.insurance_id || `REF-${detailInsurance.id}`}
                          </span>
                          <span>
                            <i className="fa fa-phone me-1" />
                            {detailInsurance.phone_code ? `${detailInsurance.phone_code} ` : ""}
                            {detailInsurance.phone}
                          </span>
                          {detailInsurance.email && (
                            <span>
                              <i className="fa fa-envelope me-1" />
                              {detailInsurance.email}
                            </span>
                          )}
                          <span
                            className={`badge ${detailInsurance.status === 1 ? "bg-success" : "bg-danger"
                              }`}
                          >
                            {detailInsurance.status === 1 ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                          <div className="fs-3 fw-bold">{linkedPatientsCount}</div>
                          <div className="small">Linked Patients</div>
                        </div>
                        <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                          <div className="fs-3 fw-bold text-white">
                            $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_paid || 0).toLocaleString() : 0}
                          </div>
                          <div className="small">Total Amount</div>
                        </div>
                        <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                          <div className="fs-3 fw-bold text-white">
                            $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_insurance || insurancePaymentSummary.total_decided || 0).toLocaleString() : 0}
                          </div>
                          <div className="small">Total Claim</div>
                        </div>
                        <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                          <div className="fs-3 fw-bold" style={{ color: "#86efac" }}>
                            $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_given || 0).toLocaleString() : 0}
                          </div>
                          <div className="small">{isInsuranceUser ? "Claim Received" : "Settled Amount"}</div>
                        </div>
                        <div className="text-center bg-white bg-opacity-25 p-2 px-3 rounded">
                          <div className="fs-3 fw-bold" style={{ color: "#fde047" }}>
                            $ {linkedPatientsCount > 0 ? Number(insurancePaymentSummary.total_pending || 0).toLocaleString() : 0}
                          </div>
                          <div className="small">Commission Due</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Linked Patients Section */}
                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h5 className="mb-0 fw-bold">
                        <i className="fa fa-wheelchair text-success me-2" />
                        Patients Referred Under This Insurance Partner ({filteredPatients.length}
                        {hasActivePatientFilters && !modalShowAll ? ` of ${linkedPatients.length}` : ""})
                      </h5>
                      {hasActivePatientFilters && !modalShowAll && (
                        <span
                          style={{
                            backgroundColor: "#e0f2fe",
                            color: "#0284c7",
                            border: "1px solid #bae6fd",
                            borderRadius: "12px",
                            padding: "2px 8px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          Filtered by criteria
                        </span>
                      )}
                      {hasActivePatientFilters && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: "11px", height: "24px" }}
                          onClick={() => setModalShowAll((prev) => !prev)}
                        >
                          {modalShowAll ? "Show Filtered Only" : `Show All (${linkedPatients.length})`}
                        </button>
                      )}
                    </div>
                    {linkedPatients.length > 0 && (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ maxWidth: 220 }}
                        placeholder="Search patient..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                      />
                    )}
                  </div>

                  {filteredPatients.length === 0 ? (
                    <div className="text-center py-4 bg-light rounded text-muted">
                      <i className="fa fa-user-times fa-2x mb-2 text-secondary" />
                      <p className="mb-0">
                        {linkedPatients.length === 0
                          ? "No patients have been registered through this insurance partner yet."
                          : "No matching patients found."}
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive border rounded" style={{ maxHeight: "380px", overflowY: "auto", background: "#ffffff" }}>
                      <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
                        <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 2 }}>
                          <tr>
                            <th>Patient Name</th>
                            <th>Contact</th>
                            <th>Total Amount</th>
                            <th>Total Claim</th>
                            <th>Settled Amount</th>
                            <th>Commission Due</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPatients.map((pt, idx) => {
                            const pKey =
                              pt.patientId ||
                              pt.patient_id ||
                              pt.id ||
                              pt.omcaPatientId ||
                              pt.omca_patient_id;
                            const pPay =
                              patientPaymentsMap[String(pt.patientId)] ||
                              patientPaymentsMap[String(pt.patient_id)] ||
                              patientPaymentsMap[String(pt.id)] ||
                              patientPaymentsMap[String(pt.omcaPatientId)] ||
                              patientPaymentsMap[String(pt.omca_patient_id)] ||
                              patientPaymentsMap[String(pKey)] ||
                              null;

                            const displayName = pt.patientName || pt.name || "Patient";
                            const displayOmcaId =
                              pt.omcaPatientId ||
                              pt.omca_patient_id ||
                              (pt.patientId ? `PT-${pt.patientId}` : pt.id ? `PT-${pt.id}` : "—");
                            const insEarned = Number(
                              pPay?.insurance_on_paid ??
                              pt.insurance_on_paid ??
                              (Array.isArray(pt.treatments)
                                ? pt.treatments.reduce((sum, t) => sum + Number(t.insurance_on_paid || 0), 0)
                                : pPay?.decided_amount ?? pt.decided_amount ?? pt.decidedAmount ?? 0)
                            );

                            const givenAmt = Number(
                              pPay?.total_given ?? pt.totalGiven ?? pt.total_given ?? 0
                            );
                            const remainingAmt = Number(
                              pPay?.remaining_due ?? pt.remainingDue ?? pt.remaining_due ?? Math.max(0, Math.round((insEarned - givenAmt) * 100) / 100)
                            );
                            const payStatus =
                              pPay?.status ||
                              pt.status ||
                              (insEarned > 0 && givenAmt >= insEarned
                                ? "Completed"
                                : givenAmt > 0
                                  ? "Partial"
                                  : "Pending");

                            return (
                              <tr key={pt.patientId || pt.patient_id || pt.id || pt.omca_patient_id || `pt-${idx}`}>
                                <td
                                  style={{ cursor: "pointer" }}
                                  onClick={() => handleNavigateToPatientDetail(pt)}
                                  title="Click to view Patient Details"
                                >
                                  <div className="d-flex align-items-center gap-1">
                                    <strong
                                      style={{ color: "#0284c7" }}
                                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                    >
                                      {displayName}
                                    </strong>
                                    <i className="fa fa-external-link text-muted" style={{ fontSize: "10px", opacity: 0.7 }} />
                                  </div>
                                  {pt.email && (
                                    <div className="text-muted small">{pt.email}</div>
                                  )}
                                </td>
                                <td>{pt.phone || "—"}</td>
                                <td>
                                  <span className="fw-semibold" style={{ color: "#0284c7" }}>
                                    $ {Number(pPay?.total_paid ?? pt?.total_paid ?? 0).toLocaleString()}
                                  </span>
                                </td>
                                <td>
                                  {insEarned > 0 ? (
                                    <span className="fw-bold" style={{ color: "#0f766e" }}>
                                      $ {insEarned.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-muted small fst-italic">—</span>
                                  )}
                                </td>
                                <td>
                                  <span className="text-success fw-bold">
                                    $ {givenAmt.toLocaleString()}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`fw-semibold ${remainingAmt > 0 ? "text-warning" : "text-success"
                                      }`}
                                  >
                                    $ {remainingAmt.toLocaleString()}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary py-0.5 px-2"
                                    style={{ fontSize: "12px", borderRadius: "6px" }}
                                    title="View patient payments & record payout"
                                    onClick={() => handleOpenPatientPayment(pt, detailInsurance, false)}
                                  >
                                    <i className="fa fa-credit-card me-1" /> Ledger
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            )}
          </DialogContent>

          <DialogActions className="border-top p-2 px-3" style={{ flexShrink: 0, backgroundColor: "#ffffff", position: "sticky", bottom: 0, zIndex: 10 }}>
            <Button variant="contained" color="inherit" onClick={() => setIsDetailOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Patient Payment Ledger Modal */}
        <InsurancePatientPaymentModal
          open={patientPaymentModalOpen}
          onClose={() => {
            setPatientPaymentModalOpen(false);
            setSelectedPaymentPatient(null);
            setSelectedPaymentInsurance(null);
            refreshPaymentsForCurrentReferral();
          }}
          insurance={selectedPaymentInsurance || detailInsurance}
          patient={selectedPaymentPatient}
          readOnly={paymentModalReadOnly}
          onPaymentUpdated={refreshPaymentsForCurrentReferral}
        />
      </div>
    </div>
  );
}
