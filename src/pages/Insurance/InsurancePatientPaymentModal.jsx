import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { baseurl } from "../../Basurl/Baseurl";
import {
  Dialog,
  DialogContent,
  CircularProgress,
} from "@mui/material";
import Swal from "sweetalert2";
import {
  addInsurancePaymentRecord,
  fetchInsurancePatientPayments,
  deleteInsurancePaymentRecord,
  setTreatmentInsurancePercentage,
} from "../../services/insuranceApi";
import {
  fetchPatientTreatmentsAndDetails,
  savePayoutRecordTreatment,
  getPayoutRecordTreatment,
  saveTreatmentCommissionData,
  resolveTreatmentHospitalName,
  clearPatientTreatmentsCache,
} from "../../utils/treatmentCommissionHelpers";

export default function InsurancePatientPaymentModal({
  open,
  onClose,
  insurance,
  patient,
  readOnly = false,
  onPaymentUpdated,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [treatments, setTreatments] = useState([]);
  const [patientDataState, setPatientDataState] = useState(null);
  const [records, setRecords] = useState([]);
  const [expandedTreatments, setExpandedTreatments] = useState({});

  // New Payment form state (treatment-wise)
  const [paymentForm, setPaymentForm] = useState({
    treatment_id: "",
    amount_given: "",
    date_given: new Date().toISOString().split("T")[0],
    details: "",
    given_by: localStorage.getItem("name") || "Accounts / Admin",
  });
  const [addingPayment, setAddingPayment] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [resolvedPatientId, setResolvedPatientId] = useState("");
  const [editRateModal, setEditRateModal] = useState({
    open: false,
    treatment: null,
    rate: "",
  });

  const insuranceId = insurance?.insurance_id || insurance?.id || "";
  const patientId =
    patient?.patientId ||
    patient?.patient_id ||
    patient?.id ||
    patient?.omcaPatientId ||
    patient?.omca_patient_id ||
    "";
  const patientDisplayId =
    patient?.omcaPatientId ||
    patient?.omca_patient_id ||
    (patient?.patientId ? `PT-${patient.patientId}` : (patient?.id ? `PT-${patient.id}` : ""));
  const patientName = patient?.patientName || patient?.name || "Patient";

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!insuranceId || !patientId) return;
    if (!treatments || treatments.length === 0) {
      setLoading(true);
    }
    try {
      // 1. Fetch Insurance Payout / Settlement Records & Treatments
      let recs = [];
      let apiTreatments = [];
      try {
        const res = await fetchInsurancePatientPayments({
          insurance_id: insuranceId,
          patient_id: patientId,
          drill: "treatments",
        });

        if (Array.isArray(res?.treatments) && res.treatments.length > 0) {
          apiTreatments = res.treatments;
        } else if (Array.isArray(res?.patient?.treatments) && res.patient.treatments.length > 0) {
          apiTreatments = res.patient.treatments;
        } else if (Array.isArray(res?.paymentDetails?.treatments) && res.paymentDetails.treatments.length > 0) {
          apiTreatments = res.paymentDetails.treatments;
        } else if (Array.isArray(res?.data?.treatments) && res.data.treatments.length > 0) {
          apiTreatments = res.data.treatments;
        }

        if (Array.isArray(res?.records)) {
          recs = res.records;
        } else if (res?.paymentDetails?.records) {
          recs = res.paymentDetails.records;
        } else if (res?.patient?.records) {
          recs = res.patient.records;
        } else if (res?.data?.records) {
          recs = res.data.records;
        } else if (res?.data?.paymentDetails?.records) {
          recs = res.data.paymentDetails.records;
        } else if (Array.isArray(res?.patients)) {
          const pIdStr = String(patientId || "").trim().toLowerCase();
          const pDispStr = String(patientDisplayId || "").trim().toLowerCase();
          const pNameStr = String(patient?.patientName || patient?.name || "").trim().toLowerCase();

          const matched = res.patients.find((p) => {
            const curPid = String(p.patientId || p.patient_id || p.id || "").trim().toLowerCase();
            const curOmca = String(p.omcaPatientId || p.omca_patient_id || "").trim().toLowerCase();
            const curName = String(p.patientName || p.name || "").trim().toLowerCase();
            return (
              (pIdStr && (curPid === pIdStr || curOmca === pIdStr)) ||
              (pDispStr && (curPid === pDispStr || curOmca === pDispStr)) ||
              (pNameStr && curName === pNameStr)
            );
          });
          if (matched) {
            recs = matched.records || matched.payment_records || [];
            if (matched.patientId || matched.patient_id) {
              setResolvedPatientId(matched.patientId || matched.patient_id);
            }
          }
        } else if (Array.isArray(res?.data)) {
          const pIdStr = String(patientId || "").trim().toLowerCase();
          const pDispStr = String(patientDisplayId || "").trim().toLowerCase();
          const pNameStr = String(patient?.patientName || patient?.name || "").trim().toLowerCase();

          const matched = res.data.find((p) => {
            const curPid = String(p.patientId || p.patient_id || p.id || "").trim().toLowerCase();
            const curOmca = String(p.omcaPatientId || p.omca_patient_id || "").trim().toLowerCase();
            const curName = String(p.patientName || p.name || "").trim().toLowerCase();
            return (
              (pIdStr && (curPid === pIdStr || curOmca === pIdStr)) ||
              (pDispStr && (curPid === pDispStr || curOmca === pDispStr)) ||
              (pNameStr && curName === pNameStr)
            );
          });
          if (matched) {
            recs = matched.records || matched.payment_records || [];
            if (matched.patientId || matched.patient_id) {
              setResolvedPatientId(matched.patientId || matched.patient_id);
            }
          }
        }
      } catch (payErr) {
        console.warn("Could not fetch insurance payments API:", payErr);
      }

      // 2. Fetch All Treatments and Payment Details across endpoints
      const targetPatient = {
        ...patient,
        patientId: resolvedPatientId || patientId,
        records: recs,
        treatments: apiTreatments.length > 0 ? apiTreatments : (patient?.treatments || []),
      };

      const { treatments: fetchedTreatments, patientData } = await fetchPatientTreatmentsAndDetails(targetPatient, forceRefresh);

      setTreatments(fetchedTreatments);
      setPatientDataState(patientData);
      setRecords(Array.isArray(recs) ? recs : []);
      if (fetchedTreatments.length === 1) {
        setPaymentForm((prev) => ({
          ...prev,
          treatment_id: prev.treatment_id || fetchedTreatments[0].treatment_id,
        }));
      }
    } catch (err) {
      console.warn("Error fetching insurance patient payments & treatments:", err);
    } finally {
      setLoading(false);
    }
  }, [insuranceId, patientId, patientDisplayId]);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (open) {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        if (Array.isArray(patient?.treatments) && patient.treatments.length > 0) {
          setTreatments(patient.treatments);
        }
        loadData(false);
        setExpandedTreatments({});
        setPaymentForm({
          treatment_id: "",
          amount_given: "",
          date_given: new Date().toISOString().split("T")[0],
          details: "",
          given_by: localStorage.getItem("name") || "Accounts / Admin",
        });
      }
    } else {
      hasLoadedRef.current = false;
    }
  }, [open, patientId, insuranceId]);

  // Navigate to Patient-Detail page (Treatment Tab)
  const handleNavigateToPatientDetail = (targetTreatment = null) => {
    const targetPid = resolvedPatientId || patientId;
    const patientNumber = patientDisplayId || targetPid;
    const userId = patient?.user_id || patient?.userId;

    if (targetPid) {
      sessionStorage.setItem("patient_detail_patientId", targetPid);
    }
    if (userId) {
      sessionStorage.setItem("patient_detail_userId", String(userId));
    }
    localStorage.setItem("patientMainTab", "treatment");

    if (typeof onClose === "function") {
      onClose();
    }

    const tId = targetTreatment?.treatment_id || targetTreatment?.id || targetTreatment?._id || "";

    navigate(`/Admin/Patient-Detail?tab=treatment${tId ? `&treatmentId=${encodeURIComponent(tId)}` : ""}`, {
      state: {
        patientId: targetPid,
        patientNumber: patientNumber,
        user_id: userId,
        mainTab: "treatment",
        tab: "treatment",
        treatmentId: tId,
        treatment_id: tId,
        selectedTreatmentId: tId,
        createdAt: patient?.createdAt || patient?.created_at || patient?.date,
      },
    });
  };

  // Open Edit Percentage Modal (Controlled React Input)
  const handleOpenEditRate = (t) => {
    const currentRate = Number(
      t?.insurance_percentage !== undefined && t?.insurance_percentage !== null
        ? t.insurance_percentage
        : (t?.commission_percentage ?? 10)
    );
    setEditRateModal({
      open: true,
      treatment: t,
      rate: String(currentRate),
    });
  };

  const handleSaveInsuranceRate = async () => {
    const t = editRateModal.treatment;
    if (!t) return;
    const tId = t?.treatment_id || t?.id || t?._id;
    const tName = t?.treatment_name || t?.treatment_course_name || "Treatment";
    const val = editRateModal.rate;
    if (val === "" || val === null || val === undefined) {
      return Swal.fire("Validation Error", "Please enter a valid percentage", "warning");
    }
    const rateNum = Number(val);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return Swal.fire("Validation Error", "Percentage must be between 0 and 100", "warning");
    }

    setEditRateModal({ open: false, treatment: null, rate: "" });

    const cleanPId = resolvedPatientId || patientId || patient?.patientId || patient?.id || patient?.omcaPatientId || patient?.patient_id;

    // 1. Immediate local UI update
    setTreatments((prev) =>
      prev.map((item) => {
        const itemId = item.treatment_id || item.treatmentId || item.id || item._id;
        if (String(itemId) === String(tId)) {
          const paymentsRec = Number(item.payments_received || 0);
          const covEarned = Math.round(((paymentsRec * rateNum) / 100) * 100) / 100;
          return {
            ...item,
            insurance_percentage: rateNum,
            insurance_on_paid: covEarned,
          };
        }
        return item;
      })
    );

    // 2. Persist to localStorage store
    saveTreatmentCommissionData({
      treatmentId: tId,
      patientId: cleanPId,
      insurancePercentage: rateNum,
      commissionPercentage: t?.commission_percentage,
      totalCharge: t?.total_charge,
      finalAmount: t?.final_amount,
      treatmentName: tName,
    });

    // 3. Persist to backend with complete treatment payload
    try {
      if (tId) {
        try {
          await setTreatmentInsurancePercentage({
            treatment_id: tId,
            patient_id: cleanPId,
            insurance_percentage: rateNum,
          });
        } catch (setErr) {
          console.warn("setTreatmentInsurancePercentage call failed, attempting edit_treatment fallback:", setErr);
        }
      }

      if (tId && !String(tId).startsWith("tx-")) {
        let existingData = {};
        try {
          const getRes = await axios.get(`${baseurl}get_treatment_by_id/${tId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          });
          if (getRes?.data?.data) {
            existingData = getRes.data.data;
          } else if (getRes?.data && typeof getRes.data === "object" && !Array.isArray(getRes.data)) {
            existingData = getRes.data;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch full treatment by ID for edit, will merge local object:", fetchErr);
        }

        const payload = {
          ...existingData,
          treatment_id: tId,
          patientId: existingData.patientId || cleanPId || t?.patientId,
          hospital_ID: existingData.hospital_ID || t?.hospital_ID || "",
          treatment_course_id: existingData.treatment_course_id || t?.treatment_course_id || tId,
          treatment_course_name: existingData.treatment_course_name || tName,
          total_charge: Number(existingData.total_charge ?? t?.total_charge ?? 0),
          ...(existingData.discount_percentage !== undefined ? { discount_percentage: Number(existingData.discount_percentage) } : {}),
          final_amount: Number(existingData.final_amount ?? t?.final_amount ?? existingData.total_charge ?? t?.total_charge ?? 0),
          insurance_percentage: rateNum,
          commission_percentage: existingData.commission_percentage !== undefined ? Number(existingData.commission_percentage) : (t?.commission_percentage !== undefined ? Number(t.commission_percentage) : 10),
          referral_commission_percentage: existingData.referral_commission_percentage !== undefined ? Number(existingData.referral_commission_percentage) : (t?.referral_commission_percentage !== undefined ? Number(t.referral_commission_percentage) : 10),
          services: existingData.services || t?.services || [],
          paymentMethod: existingData.paymentMethod || t?.paymentMethod || "Cash",
          Currency: existingData.Currency || t?.Currency || "USD",
        };

        await axios.put(`${baseurl}edit_treatment/${tId}`, payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (e) {
      console.warn("Backend edit_treatment call failed, updated locally:", e);
    }

    Swal.fire({
      icon: "success",
      title: "Percentage Updated",
      text: `Insurance coverage percentage set to ${rateNum}% for ${tName}`,
      timer: 1500,
      showConfirmButton: false,
    });

    clearPatientTreatmentsCache();
    await loadData();
    if (typeof onPaymentUpdated === "function") {
      onPaymentUpdated();
    }
  };

  // Aggregate Summary Metrics across all treatments
  const summary = useMemo(() => {
    let totalBilling = 0;
    let paymentsReceived = 0;
    let coverageEarned = 0;
    let duesPending = 0;

    treatments.forEach((t) => {
      totalBilling += Number(t.total_billing || t.final_amount || t.total_charge || 0);
      paymentsReceived += Number(t.payments_received || 0);
      coverageEarned += Number(t.insurance_on_paid || 0);
      duesPending += Number(t.dues_pending || 0);
    });

    const totalSettled = records.reduce((sum, r) => {
      return sum + Number(r?.amount_given ?? r?.amount ?? r?.total_settled ?? 0);
    }, 0);

    const remainingDue = Math.max(0, Math.round((coverageEarned - totalSettled) * 100) / 100);

    let status = "Pending";
    if (coverageEarned > 0 && totalSettled >= coverageEarned) {
      status = "Completed";
    } else if (totalSettled > 0) {
      status = "Partial";
    }

    const avgInsRate =
      treatments.length > 0
        ? Math.round(
          (treatments.reduce((sum, t) => sum + Number(t.insurance_percentage || 0), 0) /
            treatments.length) *
          10
        ) / 10
        : 0;

    return {
      totalBilling,
      paymentsReceived,
      coverageEarned,
      duesPending,
      totalSettled,
      remainingDue,
      status,
      avgInsRate,
    };
  }, [treatments, records]);

  // Per-treatment breakdown of insurance payouts/settlements
  const treatmentMetrics = useMemo(() => {
    const map = {};

    treatments.forEach((t) => {
      const tId = String(t.treatment_id || "");
      const tBilling = Number(t.total_billing || t.final_amount || t.total_charge || 0);
      const tPaid = Number(t.payments_received || 0);
      const tInsRate = Number(t.insurance_percentage || 0);
      const tCoverageEarned = Number(t.insurance_on_paid || 0);

      // Match settlement records explicitly recorded for this treatment
      const tRecords = records.filter((r) => {
        const pInfo = getPayoutRecordTreatment(r);
        const recTId = String(r.treatment_id || r.treatmentId || pInfo.treatmentId || "");
        const recTName = (r.treatment_name || r.treatmentName || pInfo.treatmentName || "").trim().toLowerCase();

        if (recTId) return recTId === tId;
        if (recTName && t.treatment_name) return recTName === t.treatment_name.trim().toLowerCase();
        // If the patient has only 1 treatment, any unassigned records belong to it
        if (treatments.length === 1) return true;
        return false;
      });

      const tSettled = tRecords.reduce(
        (sum, r) => sum + Number(r?.amount_given ?? r?.amount ?? r?.total_settled ?? 0),
        0
      );
      const tRemainingDue = Math.max(0, Math.round((tCoverageEarned - tSettled) * 100) / 100);

      let tStatus = "Pending";
      if (tCoverageEarned > 0 && tSettled >= tCoverageEarned) {
        tStatus = "Completed";
      } else if (tSettled > 0) {
        tStatus = "Partial";
      }

      map[tId] = {
        treatmentId: tId,
        treatmentName: t.treatment_name,
        billing: tBilling,
        patientPaid: tPaid,
        insuranceRate: tInsRate,
        coverageEarned: tCoverageEarned,
        settled: tSettled,
        remainingDue: tRemainingDue,
        status: tStatus,
        records: tRecords,
      };
    });

    return map;
  }, [treatments, records]);

  // Quick Action: Pre-fill settlement form for specific treatment and scroll into view
  const handleSelectTreatmentForPayment = (t, forcedRemaining = null) => {
    const tId = String(t.treatment_id || t.id || "");
    const metric = treatmentMetrics[tId] || treatmentMetrics[String(t.treatment_id || "")];
    let rem = forcedRemaining;
    if (rem === null || rem === undefined) {
      if (metric?.remainingDue !== undefined) {
        rem = metric.remainingDue;
      } else {
        const coverageEarned = Number(t.insurance_on_paid || 0);
        const settled = Number(metric?.settled || 0);
        rem = Math.max(0, Math.round((coverageEarned - settled) * 100) / 100);
      }
    }
    const remNum = Number(rem || 0);
    setPaymentForm((prev) => ({
      ...prev,
      treatment_id: tId,
      amount_given: remNum > 0 ? String(remNum) : "",
    }));
    const formEl = document.getElementById("record-insurance-payment-form");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Toggle treatment accordion
  const toggleTreatmentExpand = (treatmentKey) => {
    setExpandedTreatments((prev) => ({
      ...prev,
      [treatmentKey]: !prev[treatmentKey],
    }));
  };

  // Add Payment / Settlement Record (Treatment-Wise)
  const handleAddPaymentRecord = async (e) => {
    if (e) e.preventDefault();
    const amt = Number(paymentForm.amount_given);
    if (!amt || amt <= 0) {
      return Swal.fire("Validation Error", "Please enter a valid amount greater than 0", "warning");
    }
    if (!paymentForm.date_given) {
      return Swal.fire("Validation Error", "Please select the date payment was given", "warning");
    }

    let targetTId = paymentForm.treatment_id;
    if (!targetTId && treatments.length === 1) {
      targetTId = treatments[0].treatment_id;
    }
    if (!targetTId && treatments.length > 0) {
      return Swal.fire("Validation Error", "Please select which Treatment this settlement is for", "warning");
    }

    const chosenTreatment = treatments.find((t) => String(t.treatment_id) === String(targetTId));
    const treatmentName = chosenTreatment?.treatment_name || "";

    const targetPid = resolvedPatientId || patientId;
    setAddingPayment(true);
    try {
      const payload = {
        insurance_id: insuranceId,
        patient_id: targetPid,
        treatment_id: targetTId || "",
        treatment_name: treatmentName,
        amount_given: amt,
        date_given: paymentForm.date_given,
        details: paymentForm.details.trim(),
        given_by: paymentForm.given_by.trim() || localStorage.getItem("name") || "Accounts / Admin",
      };

      const res = await addInsurancePaymentRecord(payload);
      const recId = res?.id || res?.data?.id || res?.record_id || Date.now();
      savePayoutRecordTreatment(recId, {
        treatmentId: targetTId,
        treatmentName: treatmentName,
      });

      Swal.fire({
        icon: "success",
        title: "Settlement Recorded",
        text: res?.message || `Settlement of $ ${amt.toLocaleString()} recorded for ${treatmentName || "treatment"}`,
        timer: 1600,
        showConfirmButton: false,
      });
      setPaymentForm({
        treatment_id: targetTId || "",
        amount_given: "",
        date_given: new Date().toISOString().split("T")[0],
        details: "",
        given_by: localStorage.getItem("name") || "Accounts / Admin",
      });
      await loadData();
      if (onPaymentUpdated) onPaymentUpdated();
    } catch (err) {
      console.error("Add insurance payment record error:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to record payment",
        "error"
      );
    } finally {
      setAddingPayment(false);
    }
  };

  // Delete Payment Record
  const handleDeleteRecord = async (recordId) => {
    const result = await Swal.fire({
      title: "Delete Payment Record?",
      text: "Are you sure you want to delete this payment transaction? Remaining balance and status will be updated accordingly.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
    });

    if (!result.isConfirmed) return;

    setDeletingRecordId(recordId);
    try {
      const res = await deleteInsurancePaymentRecord(recordId);
      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: res?.message || "Payment record deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      await loadData();
      if (onPaymentUpdated) onPaymentUpdated();
    } catch (err) {
      console.error("Delete insurance payment record error:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to delete payment record",
        "error"
      );
    } finally {
      setDeletingRecordId(null);
    }
  };

  const percentClaimPaid =
    summary.coverageEarned > 0
      ? Math.min(
        100,
        Math.round(((summary.totalSettled || 0) / (summary.coverageEarned || 1)) * 100)
      )
      : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      scroll="paper"
      disableAutoFocus
      disableRestoreFocus
      disableEnforceFocus
      PaperProps={{
        style: {
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: "calc(100vh - 80px)",
          maxHeight: "calc(100vh - 80px)",
          margin: "20px auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        },
      }}
    >
      {/* Sticky Styled Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
          color: "#ffffff",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "19px",
            }}
          >
            <i className="fa fa-shield-heart" />
          </div>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "16.5px", letterSpacing: "-0.01em" }}>
              Patient Payment Ledger & Insurance Settlement
            </h5>
            <small style={{ color: "rgba(255,255,255,0.85)", fontSize: "12.5px" }}>
              Patient:{" "}
              <strong
                className="text-white"
                style={{ cursor: "pointer", textDecoration: "underline" }}
                onClick={handleNavigateToPatientDetail}
                title="Click to view Patient Details"
              >
                {patientName}
              </strong>{" "}
              ({patientDisplayId || `ID: ${patientId}`}) &bull; Insurance Partner:{" "}
              <strong className="text-white">{insurance?.name || insuranceId}</strong>
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "50%",
            width: "34px",
            height: "34px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Close"
        >
          <i className="fa-solid fa-xmark fs-6" />
        </button>
      </div>

      <DialogContent
        dividers
        sx={{
          overflowY: "auto",
          minHeight: 0,
          padding: "20px 24px",
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
        {loading ? (
          <div className="text-center py-5">
            <CircularProgress size={32} />
            <div className="mt-2 text-muted small">Loading patient treatments & settlement records...</div>
          </div>
        ) : (
          <div>
            {/* 4 User-Friendly Summary Cards */}
            <div className="row g-3 mb-3">
              {/* Card 1: Total Amount (Patient Paid Bill) */}
              <div className="col-6 col-lg-3">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{
                    borderRadius: "12px",
                    backgroundColor: "#ecfdf5",
                    borderLeft: "4px solid #10b981",
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-semibold">Total Amount</span>
                      <i className="fa fa-receipt text-success fs-5" />
                    </div>
                    <div className="fs-5 fw-bold text-success">
                      $ {summary.paymentsReceived.toLocaleString()}
                    </div>
                    <small className="text-muted d-block mt-1" style={{ fontSize: "11px" }}>
                      Patient Paid Amount
                    </small>
                  </div>
                </div>
              </div>

              {/* Card 2: Total Claim */}
              <div className="col-6 col-lg-3">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{
                    borderRadius: "12px",
                    backgroundColor: "#f0fdfa",
                    borderLeft: "4px solid #0d9488",
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-semibold">Total Claim</span>
                      <i className="fa fa-shield fs-5" style={{ color: "#0d9488" }} />
                    </div>
                    <div className="fs-5 fw-bold" style={{ color: "#0d9488" }}>
                      $ {summary.coverageEarned.toLocaleString()}
                    </div>
                    <small className="text-muted d-block mt-1" style={{ fontSize: "11px" }}>
                      Total Claim {summary.avgInsRate > 0 && `(${summary.avgInsRate}%)`}
                    </small>
                  </div>
                </div>
              </div>

              {/* Card 3: Claim Received / Settled Amount */}
              <div className="col-6 col-lg-3">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{
                    borderRadius: "12px",
                    backgroundColor: "#f8fafc",
                    borderLeft: "4px solid #0284c7",
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-semibold">
                        {readOnly ? "Claim Received" : "Settled Amount"}
                      </span>
                      <i className="fa fa-check-circle text-primary fs-5" />
                    </div>
                    <div className="fs-5 fw-bold text-primary">
                      $ {summary.totalSettled.toLocaleString()}
                    </div>
                    <small className="text-muted d-block mt-1" style={{ fontSize: "11px" }}>
                      {records.length} settlement record{records.length === 1 ? "" : "s"}
                    </small>
                  </div>
                </div>
              </div>

              {/* Card 4: Commission Due */}
              <div className="col-6 col-lg-3">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{
                    borderRadius: "12px",
                    backgroundColor:
                      (summary.remainingDue || 0) > 0 ? "#fffbeb" : "#f0fdf4",
                    borderLeft: `4px solid ${(summary.remainingDue || 0) > 0 ? "#f59e0b" : "#10b981"
                      }`,
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-semibold">Commission Due</span>
                      <i className="fa fa-hourglass-half text-warning fs-5" />
                    </div>
                    <div
                      className={`fs-5 fw-bold ${(summary.remainingDue || 0) > 0 ? "text-warning" : "text-success"
                        }`}
                    >
                      $ {summary.remainingDue.toLocaleString()}
                    </div>
                    <div className="mt-1 d-flex justify-content-between align-items-center">
                      <span
                        className={`badge ${summary.status === "Completed"
                          ? "bg-success"
                          : summary.status === "Partial"
                            ? "bg-warning text-dark"
                            : "bg-secondary"
                          }`}
                        style={{ fontSize: "10.5px" }}
                      >
                        {summary.status || "Pending"}
                      </span>
                      {summary.coverageEarned > 0 && (
                        <span className="text-muted" style={{ fontSize: "10px" }}>
                          {percentClaimPaid}% settled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Data Style Card: Treatments under Patient */}
            <div className="card mb-4 border-0 shadow-sm" style={{ borderRadius: "14px" }}>
              {/* Card Header matching Payment Data UI */}
              <div
                className="card-header bg-white border-bottom p-3 d-flex flex-wrap align-items-center justify-content-between gap-2"
                style={{ borderRadius: "14px 14px 0 0" }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      backgroundColor: "#ecfdf5",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    <i className="fa fa-users" />
                  </div>
                  <div>
                    <h6 className="mb-0 fw-bold" style={{ fontSize: "15px", color: "#1e293b" }}>
                      Treatments under {patientName}
                    </h6>
                    <small className="text-muted" style={{ fontSize: "12px" }}>
                      Drilldown Breakdown (&drill=treatments)
                    </small>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#ecfdf5",
                      color: "#059669",
                      border: "1px solid #a7f3d0",
                      fontSize: "12px",
                      padding: "6px 12px",
                      fontWeight: 600,
                      borderRadius: "6px",
                    }}
                  >
                    {treatments.length} Treatment{treatments.length === 1 ? "" : "s"}
                  </span>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5"
                    disabled={loading}
                    onClick={() => loadData(true)}
                    style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "6px" }}
                    title="Refresh treatments"
                  >
                    <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`} /> Refresh
                  </button>
                </div>
              </div>

              {/* Table styled exactly like Payment Data screenshot */}
              <div className="table-responsive border rounded" style={{ maxHeight: "300px", overflowY: "auto", background: "#ffffff" }}>
                <table className="table table-hover align-middle mb-0" style={{ fontSize: "12.5px" }}>
                  <thead style={{ backgroundColor: "#f1f5f9", position: "sticky", top: 0, zIndex: 2 }}>
                    <tr>
                      <th
                        style={{
                          width: 38,
                          fontWeight: 600,
                          color: "#475569",
                          padding: "10px 8px",
                          textAlign: "center",
                        }}
                      >
                        <i className="fa fa-stethoscope text-muted" style={{ fontSize: "11px", opacity: 0.6 }} />
                      </th>
                      <th style={{ fontWeight: 600, color: "#475569", padding: "10px 8px" }}>#</th>
                      <th style={{ fontWeight: 600, color: "#475569", padding: "10px 8px" }}>
                        Treatment Name / ID
                      </th>
                      <th style={{ fontWeight: 600, color: "#475569", padding: "10px 8px" }}>
                        Location / Hospital
                      </th>
                      <th
                        className="text-end"
                        style={{ fontWeight: 600, color: "#0284c7", padding: "10px 12px" }}
                        title="Patient Payments Received / Total Amount"
                      >
                        Total Amount
                      </th>
                      <th
                        className="text-center"
                        style={{ fontWeight: 600, color: "#475569", padding: "10px 8px" }}
                      >
                        Insurance %
                      </th>
                      <th
                        className="text-end"
                        style={{ fontWeight: 600, color: "#0f766e", padding: "10px 12px" }}
                      >
                        Claim on Paid
                      </th>
                      <th
                        className="text-end"
                        style={{ fontWeight: 600, color: "#047857", padding: "10px 12px" }}
                      >
                        Settled Amount
                      </th>
                      <th
                        className="text-end"
                        style={{ fontWeight: 600, color: "#e11d48", padding: "10px 12px" }}
                      >
                        Commission Due
                      </th>
                      <th
                        className="text-center"
                        style={{ fontWeight: 600, color: "#475569", padding: "10px 8px" }}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-5 text-muted">
                          <i className="fa fa-notes-medical fa-2x mb-2 text-secondary opacity-50" />
                          <div className="fw-semibold">No treatments found for this patient</div>
                          <small style={{ fontSize: "11.5px" }}>
                            Treatments added for this patient will automatically appear here with their insurance breakdown.
                          </small>
                        </td>
                      </tr>
                    ) : (
                      treatments.map((t, idx) => {
                        const tKey = t.treatment_id || `t-${idx}`;
                        const isExpanded = Boolean(expandedTreatments[tKey]);
                        const tPaid = Number(t.payments_received || 0);
                        const tInsRate = Number(t.insurance_percentage || 0);
                        const tCoverage = Number(t.insurance_on_paid || 0);
                        const tMetric = treatmentMetrics[String(t.treatment_id || "")];
                        const tSettled = tMetric?.settled ?? 0;
                        const tRemaining = tMetric?.remainingDue ?? Math.max(0, tCoverage - tSettled);
                        const tPaymentsList = Array.isArray(t.payment_details) ? t.payment_details : [];

                        return (
                          <React.Fragment key={tKey}>
                            <tr
                              style={{
                                cursor: "pointer",
                                backgroundColor: isExpanded ? "#f0fdf4" : idx % 2 === 1 ? "#fafcff" : "#ffffff",
                                borderLeft: isExpanded ? "3px solid #059669" : "none",
                                transition: "background-color 0.15s ease",
                              }}
                              onClick={() => toggleTreatmentExpand(tKey)}
                            >
                              {/* Expand Chevron */}
                              <td
                                className="text-center"
                                style={{ padding: "8px 4px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTreatmentExpand(tKey);
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-sm p-0"
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "4px",
                                    backgroundColor: isExpanded ? "#059669" : "#f1f5f9",
                                    borderColor: isExpanded ? "#059669" : "#cbd5e1",
                                    color: isExpanded ? "#ffffff" : "#475569",
                                    transition: "all 0.2s ease",
                                    border: "1px solid",
                                  }}
                                  title={isExpanded ? "Collapse payment records" : "Expand payments"}
                                >
                                  <i
                                    className="fa fa-chevron-right"
                                    style={{
                                      fontSize: "9px",
                                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                      transition: "transform 0.2s ease",
                                    }}
                                  />
                                </button>
                              </td>

                              <td style={{ color: "#64748b", fontWeight: 500 }}>{idx + 1}</td>

                              {/* Treatment Name & ID */}
                              <td>
                                <div className="d-flex flex-column">
                                  <span
                                    style={{
                                      color: "#047857",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      cursor: "pointer",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigateToPatientDetail(t);
                                    }}
                                    title="Click to view Patient Details"
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                  >
                                    {t.treatment_name}
                                    <i className="fa fa-external-link" style={{ fontSize: "10px", opacity: 0.7 }} />
                                  </span>
                                  <small className="text-muted" style={{ fontSize: "11px" }}>
                                    ID: {t.treatment_id || "—"}
                                    {t.treatment_status && (
                                      <span className="badge bg-light text-muted border ms-2" style={{ fontSize: "9.5px" }}>
                                        {t.treatment_status}
                                      </span>
                                    )}
                                  </small>
                                </div>
                              </td>

                              {/* Location / Hospital */}
                              <td style={{ color: "#475569" }}>
                                {t.hospital_name && t.hospital_name !== "—" && t.hospital_name !== "-"
                                  ? t.hospital_name
                                  : resolveTreatmentHospitalName(t, patientDataState, patient)}
                              </td>

                              {/* Payments Received */}
                              <td className="text-end" style={{ fontWeight: 600, color: "#0284c7" }}>
                                $ {tPaid.toLocaleString()}
                              </td>

                              {/* Insurance % */}
                              <td
                                className="text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="d-inline-flex align-items-center justify-content-center gap-1">
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: tInsRate > 0 ? "#ecfdf5" : "#f1f5f9",
                                      color: tInsRate > 0 ? "#059669" : "#64748b",
                                      border: `1px solid ${tInsRate > 0 ? "#a7f3d0" : "#cbd5e1"}`,
                                      fontSize: "11px",
                                      padding: "4px 8px",
                                      borderRadius: "5px",
                                    }}
                                  >
                                    {tInsRate}%
                                  </span>
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                                      style={{
                                        width: "22px",
                                        height: "22px",
                                        borderRadius: "4px",
                                        backgroundColor: "#ecfdf5",
                                        border: "1px solid #a7f3d0",
                                        color: "#059669",
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                      }}
                                      title="Edit Percentage (%)"
                                      onClick={() => handleOpenEditRate(t)}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#d1fae5";
                                        e.currentTarget.style.color = "#047857";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "#ecfdf5";
                                        e.currentTarget.style.color = "#059669";
                                      }}
                                    >
                                      <i className="fa fa-pencil" style={{ fontSize: "10.5px" }} />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Coverage on Paid */}
                              <td className="text-end" style={{ fontWeight: 700, color: "#0f766e" }}>
                                $ {tCoverage.toLocaleString()}
                              </td>

                              {/* Amount Settled */}
                              <td className="text-end" style={{ fontWeight: 600, color: "#047857" }}>
                                $ {tSettled.toLocaleString()}
                              </td>

                              {/* Remaining Due */}
                              <td
                                className="text-end"
                                style={{
                                  fontWeight: 700,
                                  color: tRemaining > 0 ? "#e11d48" : "#10b981",
                                }}
                              >
                                $ {tRemaining.toLocaleString()}
                              </td>

                              {/* Action */}
                              <td className="text-center">
                                <div className="d-flex align-items-center justify-content-center gap-1.5">
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-success py-1 px-2 d-inline-flex align-items-center gap-1"
                                      style={{ fontSize: "11px", borderRadius: "5px", fontWeight: 600 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectTreatmentForPayment(t, tRemaining);
                                      }}
                                      title={`Record settlement for ${t.treatment_name}`}
                                    >
                                      <i className="fa fa-hand-holding-dollar" />
                                      <span>Pay</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success py-1 px-2 d-inline-flex align-items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTreatmentExpand(tKey);
                                    }}
                                    style={{
                                      fontSize: "11px",
                                      borderRadius: "5px",
                                      fontWeight: 500,
                                    }}
                                    title={isExpanded ? "Hide individual transaction ledger" : "View individual transaction ledger"}
                                  >
                                    <i className="fa fa-eye" />
                                    <span>{isExpanded ? "Hide" : "View"}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Nested Level 3 Row: Individual Treatment Transaction Ledger */}
                            {isExpanded && (
                              <tr style={{ backgroundColor: "#f8fafc" }}>
                                <td colSpan={10} style={{ padding: "0 0 12px 0", borderTop: "none" }}>
                                  <div
                                    style={{
                                      margin: "8px 16px 8px 36px",
                                      padding: "14px 16px",
                                      backgroundColor: "#ffffff",
                                      borderRadius: "10px",
                                      border: "1px solid #a7f3d0",
                                      boxShadow: "0 2px 8px rgba(5, 150, 105, 0.08)",
                                    }}
                                  >
                                    <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom flex-wrap gap-2">
                                      <div className="d-flex align-items-center gap-2">
                                        <div
                                          style={{
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "6px",
                                            backgroundColor: "#ecfdf5",
                                            color: "#059669",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "13px",
                                          }}
                                        >
                                          <i className="fa fa-history" />
                                        </div>
                                        <div>
                                          <h6 className="mb-0 fw-bold" style={{ fontSize: "13px", color: "#065f46" }}>
                                            Transaction Ledger: {t.treatment_name}
                                          </h6>
                                          <small className="text-muted" style={{ fontSize: "11px" }}>
                                            Insurance on Paid: <strong className="text-dark">$ {tCoverage.toLocaleString()}</strong> &bull; Settled: <strong className="text-success">$ {tSettled.toLocaleString()}</strong> &bull; Commission Due: <strong className={tRemaining > 0 ? "text-danger" : "text-success"}>$ {tRemaining.toLocaleString()}</strong>
                                          </small>
                                        </div>
                                      </div>

                                      <div className="d-flex align-items-center gap-2">
                                        <span
                                          className="badge"
                                          style={{
                                            backgroundColor: "#ecfdf5",
                                            color: "#059669",
                                            border: "1px solid #6ee7b7",
                                            fontSize: "11px",
                                            padding: "4px 8px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {(tMetric?.records || []).length} Settlement {(tMetric?.records || []).length === 1 ? "Entry" : "Entries"}
                                        </span>
                                        {!readOnly && tRemaining > 0 && (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-success py-0.5 px-2 d-inline-flex align-items-center gap-1"
                                            style={{ fontSize: "11px", borderRadius: "5px" }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSelectTreatmentForPayment(t, tRemaining);
                                            }}
                                            title="Settle Commission Due"
                                          >
                                            <i className="fa fa-plus" /> Settle Due ($ {tRemaining.toLocaleString()})
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {(tMetric?.records || []).length === 0 ? (
                                      <div className="text-center py-3 text-muted" style={{ fontSize: "12px" }}>
                                        <i className="fa fa-info-circle me-1 text-secondary opacity-50" />
                                        No settlement transactions recorded for this treatment yet. Click <strong>Pay</strong> to record a settlement.
                                      </div>
                                    ) : (
                                      <div className="table-responsive">
                                        <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: "11.5px" }}>
                                          <thead style={{ backgroundColor: "#ecfdf5", color: "#065f46" }}>
                                            <tr>
                                              <th>#</th>
                                              <th>Date Given</th>
                                              <th className="text-end">Amount Settled</th>
                                              <th>Settled / Given By</th>
                                              <th>Payment Details / Method</th>
                                              {!readOnly && <th className="text-center" style={{ width: "70px" }}>Action</th>}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(tMetric?.records || []).map((r, rIdx) => {
                                              const recId = r.id || r._id || r.record_id || rIdx;
                                              const amt = Number(r.amount_given ?? r.amount ?? r.total_settled ?? 0);
                                              const dt = r.date_given || r.date || r.payment_date || r.created_at;
                                              return (
                                                <tr key={recId}>
                                                  <td>{rIdx + 1}</td>
                                                  <td>
                                                    <strong>
                                                      {dt ? new Date(dt).toLocaleDateString("en-GB") : "—"}
                                                    </strong>
                                                  </td>
                                                  <td className="text-end fw-bold text-success">
                                                    $ {amt.toLocaleString()}
                                                  </td>
                                                  <td>{r.given_by || r.settled_by || "Admin"}</td>
                                                  <td>{r.details || r.notes || r.payment_method || r.method || "—"}</td>
                                                  {!readOnly && (
                                                    <td className="text-center">
                                                      <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-danger py-0.5 px-2"
                                                        style={{ fontSize: "10.5px", borderRadius: "4px" }}
                                                        onClick={() => handleDeleteRecord(recId)}
                                                        disabled={deletingRecordId === recId}
                                                        title="Delete settlement entry"
                                                      >
                                                        {deletingRecordId === recId ? (
                                                          <i className="fa fa-spinner fa-spin" />
                                                        ) : (
                                                          <i className="fa fa-trash" />
                                                        )}
                                                      </button>
                                                    </td>
                                                  )}
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>

                  {/* TOTALS FOOTER ROW */}
                  {treatments.length > 0 && (
                    <tfoot style={{ backgroundColor: "#f8fafc", borderTop: "2px solid #cbd5e1" }}>
                      <tr>
                        <td colSpan={4} style={{ padding: "12px", fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>
                          <i className="fa fa-calculator text-success me-2" />
                          TOTAL ({treatments.length} Treatment{treatments.length === 1 ? "" : "s"})
                        </td>
                        <td className="text-end" style={{ padding: "12px", fontWeight: 700, fontSize: "13px", color: "#0284c7" }}>
                          $ {summary.paymentsReceived.toLocaleString()}
                        </td>
                        <td className="text-center" style={{ padding: "12px" }}>
                          <span className="badge bg-secondary" style={{ fontSize: "11px" }}>
                            Total
                          </span>
                        </td>
                        <td className="text-end" style={{ padding: "12px", fontWeight: 700, fontSize: "13px", color: "#0f766e" }}>
                          $ {summary.coverageEarned.toLocaleString()}
                        </td>
                        <td className="text-end" style={{ padding: "12px", fontWeight: 700, fontSize: "13px", color: "#047857" }}>
                          $ {summary.totalSettled.toLocaleString()}
                        </td>
                        <td className="text-end" style={{ padding: "12px", fontWeight: 700, fontSize: "13px", color: summary.remainingDue > 0 ? "#e11d48" : "#10b981" }}>
                          $ {summary.remainingDue.toLocaleString()}
                        </td>
                        <td className="text-center" style={{ padding: "12px" }}>
                          —
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Add Payment Given / Settlement Form (Admin Only, Treatment-Wise) */}
            {!readOnly && (
              <div id="record-insurance-payment-form" className="card mb-4 border-0 shadow-sm" style={{ borderRadius: "14px" }}>
                <div
                  className="card-header bg-white border-bottom fw-bold text-dark d-flex justify-content-between align-items-center"
                  style={{ fontSize: "13.5px", padding: "12px 18px", borderRadius: "14px 14px 0 0" }}
                >
                  <span>
                    <i className="fa fa-money-bill-transfer text-success me-2" />
                    Record Payment / Claim Settlement to Insurance Partner (Treatment-Wise)
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: "11px" }}
                    onClick={() => loadData(true)}
                    title="Refresh data"
                  >
                    <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`} /> Refresh
                  </button>
                </div>
                <div className="card-body p-3">
                  {/* Informational Banner */}
                  {(() => {
                    const selectedT = treatments.find((t) => String(t.treatment_id) === String(paymentForm.treatment_id));
                    const selMetric = selectedT ? treatmentMetrics[String(selectedT.treatment_id)] : null;

                    if (selectedT && selMetric) {
                      return (
                        <div
                          className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                          style={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #a7f3d0", backgroundColor: "#f0fdf4" }}
                        >
                          <div>
                            <i className="fa fa-stethoscope text-success me-1.5" />
                            Selected Treatment: <strong className="text-success">{selectedT.treatment_name}</strong>
                            &bull; Patient Paid: <strong>$ {selMetric.patientPaid.toLocaleString()}</strong>
                            &bull; Ins Rate: <strong>{selMetric.insuranceRate}%</strong>
                            &bull; Claim Earned: <strong className="text-success">$ {selMetric.coverageEarned.toLocaleString()}</strong>
                            &bull; Already Settled: <strong className="text-primary">$ {selMetric.settled.toLocaleString()}</strong>
                            &bull; Commission Due: <strong className="text-danger">$ {selMetric.remainingDue.toLocaleString()}</strong>
                          </div>
                          {selMetric.remainingDue > 0 && (
                            <button
                              type="button"
                              className="btn btn-xs btn-success py-0.5 px-2"
                              style={{ fontSize: "11px", borderRadius: "5px" }}
                              onClick={() =>
                                setPaymentForm((prev) => ({
                                  ...prev,
                                  amount_given: String(selMetric.remainingDue),
                                }))
                              }
                            >
                              Fill Due ($ {selMetric.remainingDue.toLocaleString()})
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                        style={{ fontSize: "12px", borderRadius: "8px" }}
                      >
                        <div>
                          <i className="fa fa-calculator me-1" />
                          Total Insurance Claim on Paid Bills: <strong>$ {summary.coverageEarned.toLocaleString()}</strong> &bull; Total Settled: <strong>$ {summary.totalSettled.toLocaleString()}</strong> &bull; Commission Due: <strong className="text-danger">$ {summary.remainingDue.toLocaleString()}</strong>
                        </div>
                        <span className="text-muted" style={{ fontSize: "11.5px" }}>
                          Please select a Treatment below or click <strong>Settle</strong> on any treatment row above.
                        </span>
                      </div>
                    );
                  })()}

                  <form onSubmit={handleAddPaymentRecord}>
                    <div className="row g-2 align-items-end">
                      {/* Select Treatment Dropdown */}
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Select Treatment <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select form-select-sm"
                          required
                          value={paymentForm.treatment_id}
                          onChange={(e) => {
                            const chosenTId = e.target.value;
                            const metric = treatmentMetrics[chosenTId] || treatmentMetrics[String(chosenTId)];
                            const matchedT = treatments.find((tx) => String(tx.treatment_id || tx.id) === String(chosenTId));
                            const rem = metric?.remainingDue !== undefined
                              ? metric.remainingDue
                              : matchedT
                                ? Math.max(0, Math.round(((Number(matchedT.insurance_on_paid || 0)) - Number(metric?.settled || 0)) * 100) / 100)
                                : 0;
                            const remNum = Number(rem || 0);
                            setPaymentForm((prev) => ({
                              ...prev,
                              treatment_id: chosenTId,
                              amount_given: remNum > 0 ? String(remNum) : "",
                            }));
                          }}
                        >
                          <option value="">-- Choose Treatment ({treatments.length}) --</option>
                          {treatments.map((t) => {
                            const metric = treatmentMetrics[String(t.treatment_id)];
                            const rem = metric?.remainingDue ?? 0;
                            return (
                              <option key={t.treatment_id} value={t.treatment_id}>
                                {t.treatment_name} (Due: $ {rem.toLocaleString()})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="col-md-2">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Amount Given ($) <span className="text-danger">*</span>
                        </label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-light">$</span>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            className="form-control"
                            placeholder="e.g. 1500"
                            required
                            value={paymentForm.amount_given}
                            onChange={(e) =>
                              setPaymentForm({ ...paymentForm, amount_given: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="col-md-2">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Date Given <span className="text-danger">*</span>
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          required
                          value={paymentForm.date_given}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, date_given: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Settled / Given By
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Accounts / Admin"
                          value={paymentForm.given_by}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, given_by: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Settlement Details / Method
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Bank Transfer, Claim Ref, Cash"
                          value={paymentForm.details}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, details: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-12 text-end mt-2">
                        <button
                          type="submit"
                          className="btn btn-sm btn-success fw-semibold px-3"
                          style={{ borderRadius: "6px" }}
                          disabled={addingPayment}
                        >
                          {addingPayment ? (
                            <>
                              <i className="fa fa-spinner fa-spin me-1" /> Recording...
                            </>
                          ) : (
                            <>
                              <i className="fa fa-plus-circle me-1" /> Add Payment Record
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Payout Transactions & Ledger Table */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: "14px" }}>
              <div
                className="card-header bg-white border-bottom fw-bold text-dark d-flex justify-content-between align-items-center"
                style={{ fontSize: "13.5px", padding: "12px 18px", borderRadius: "14px 14px 0 0" }}
              >
                <span>
                  <i className="fa fa-history text-success me-2" />
                  Transaction Ledger ({records.length} {records.length === 1 ? "Entry" : "Entries"})
                </span>
                <span className="badge bg-light text-muted border" style={{ fontSize: "11px" }}>
                  Insurance Settlement Payouts Given
                </span>
              </div>
              <div className="card-body p-0">
                {records.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="fa fa-receipt fa-2x mb-2 text-secondary opacity-50" />
                    <div className="small fw-semibold">No payment transactions found</div>
                    <div style={{ fontSize: "11px" }}>
                      Use the form above to record insurance settlement payments given for this patient.
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive border rounded" style={{ maxHeight: "250px", overflowY: "auto", background: "#ffffff" }}>
                    <table className="table table-hover align-middle mb-0" style={{ fontSize: "12.5px" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 2 }}>
                        <tr>
                          <th>#</th>
                          <th>Date Given</th>
                          <th>Treatment</th>
                          <th>Amount Given</th>
                          <th>Given By</th>
                          <th>Payment Details / Method</th>
                          {!readOnly && <th className="text-center">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, idx) => {
                          const recId = r.id || r._id || r.record_id || idx;
                          const amt = Number(r.amount_given ?? r.amount ?? r.total_settled ?? 0);
                          const dt = r.date_given || r.date || r.payment_date || r.created_at;
                          const recTreatment = getPayoutRecordTreatment(r);
                          const tName = r.treatment_name || r.treatmentName || recTreatment.treatmentName;
                          const tId = r.treatment_id || r.treatmentId || recTreatment.treatmentId;

                          return (
                            <tr key={recId}>
                              <td className="text-muted">{idx + 1}</td>
                              <td>
                                <strong>
                                  {dt ? new Date(dt).toLocaleDateString("en-GB") : "—"}
                                </strong>
                              </td>
                              {/* Treatment column */}
                              <td>
                                {tName ? (
                                  <div className="d-flex flex-column">
                                    <span
                                      className="badge text-start"
                                      style={{
                                        backgroundColor: "#ecfdf5",
                                        color: "#065f46",
                                        border: "1px solid #a7f3d0",
                                        fontSize: "11px",
                                        padding: "4px 8px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        width: "fit-content",
                                      }}
                                    >
                                      <i className="fa fa-stethoscope" />
                                      {tName}
                                    </span>
                                    {tId && (
                                      <small className="text-muted" style={{ fontSize: "10px", marginTop: "2px" }}>
                                        ID: {tId}
                                      </small>
                                    )}
                                  </div>
                                ) : (
                                  <span className="badge bg-light text-muted border" style={{ fontSize: "11px" }}>
                                    General / Patient Level
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="fw-bold text-success">
                                  $ {amt.toLocaleString()}
                                </span>
                              </td>
                              <td>{r.given_by || r.settled_by || "Admin"}</td>
                              <td>{r.details || r.notes || "—"}</td>
                              {!readOnly && (
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline-danger py-0.5 px-2"
                                    style={{ fontSize: "11px", borderRadius: "5px" }}
                                    onClick={() => handleDeleteRecord(recId)}
                                    disabled={deletingRecordId === recId}
                                    title="Delete payment entry"
                                  >
                                    {deletingRecordId === recId ? (
                                      <i className="fa fa-spinner fa-spin" />
                                    ) : (
                                      <i className="fa fa-trash" />
                                    )}
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <div
        style={{
          padding: "12px 24px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          flexShrink: 0,
          position: "sticky",
          bottom: 0,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary btn-sm px-4 fw-semibold"
          style={{ borderRadius: "6px" }}
        >
          Close
        </button>
      </div>

      {/* Edit Insurance Percentage Modal (Controlled React Input with unblocked onChange) */}
      {editRateModal.open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setEditRateModal({ open: false, treatment: null, rate: "" })}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              padding: "24px 28px",
              width: "100%",
              maxWidth: "430px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              style={{
                textAlign: "center",
                fontWeight: 700,
                fontSize: "20px",
                color: "#1e293b",
                marginBottom: "16px",
              }}
            >
              Edit Percentage %
            </h4>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "14px", textAlign: "left" }}>
              <div>
                <strong>Treatment:</strong> {editRateModal.treatment?.treatment_name || "Treatment"}
              </div>
              <div style={{ marginTop: "4px" }}>
                <strong>Treatment ID:</strong> {editRateModal.treatment?.treatment_id || "—"}
              </div>
            </div>
            <div
              style={{
                textAlign: "left",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "6px",
              }}
            >
              Insurance Coverage / Commission Percentage (%)
            </div>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              className="form-control text-center fw-bold"
              style={{ fontSize: "18px", color: "#059669", padding: "10px", borderColor: "#a7f3d0" }}
              value={editRateModal.rate}
              onChange={(e) => setEditRateModal((prev) => ({ ...prev, rate: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveInsuranceRate();
                } else if (e.key === "Escape") {
                  setEditRateModal({ open: false, treatment: null, rate: "" });
                }
              }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn btn-info text-white px-4 fw-semibold"
                style={{ backgroundColor: "#0284c7", borderColor: "#0284c7", minWidth: "90px" }}
                onClick={handleSaveInsuranceRate}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-danger px-4 fw-semibold"
                style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", minWidth: "90px" }}
                onClick={() => setEditRateModal({ open: false, treatment: null, rate: "" })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
