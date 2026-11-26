import React, { useCallback, useEffect, useState } from "react";
import {
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Swal from "sweetalert2";
import {
  addHospitalCommissionPayment,
  bulkUpdateHospitalCommission,
  deleteHospitalCommissionPaymentRecord,
  exportHospitalCommissionMaster,
  exportHospitalCommissionReport,
  fetchHospitalCommissionMaster,
  fetchHospitalCommissionPaymentRecords,
  fetchHospitalCommissionReport,
  resetHospitalCommission,
  updateHospitalCommission,
} from "../../services/hospitalCommissionApi";
import "./HospitalCommission.css";

const formatMoney = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateDisplay = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "hc-status-completed";
  if (s === "partial") return "hc-status-partial";
  return "hc-status-pending";
};

const INITIAL_REPORT_FILTERS = {
  country: "",
  city: "",
  hospital: "",
  patient: "",
  treatment: "",
  from_date: "",
  to_date: "",
  date: "",
  search: "",
  status: "All",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const INITIAL_MASTER_FILTERS = {
  search: "",
  city: "",
  status: "all",
  commission_filter: "",
};

const INITIAL_RECORDS_FILTERS = {
  hospital_id: "",
  patient_id: "",
  treatment_id: "",
  from_date: "",
  to_date: "",
  search: "",
};

export default function HospitalCommission() {
  const [activeTab, setActiveTab] = useState("report");

  // ============================================================
  // TAB 1: OMCA Commission Report & Tracking
  // ============================================================
  const [reportFilters, setReportFilters] = useState(INITIAL_REPORT_FILTERS);
  const [appliedReportFilters, setAppliedReportFilters] = useState(INITIAL_REPORT_FILTERS);
  const [reportRows, setReportRows] = useState([]);
  const [reportSummary, setReportSummary] = useState({
    total_records: 0,
    total_bills: 0,
    total_payment: 0,
    total_omca_commission: 0,
    total_paid_commission: 0,
    total_due_commission: 0,
  });
  const [reportPagination, setReportPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
  });
  const [reportPage, setReportPage] = useState(1);
  const [reportLimit, setReportLimit] = useState(10);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  // Add Payment Modal
  const [addPaymentModal, setAddPaymentModal] = useState({
    open: false,
    row: null,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount_received: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "Bank Transfer",
    reference_no: "",
    notes: "",
    received_by: localStorage.getItem("name") || "OMCA Admin",
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payment History Modal (per report row)
  const [historyModal, setHistoryModal] = useState({
    open: false,
    row: null,
  });

  // ============================================================
  // TAB 2: Hospital Commission % Master
  // ============================================================
  const [masterFilters, setMasterFilters] = useState(INITIAL_MASTER_FILTERS);
  const [appliedMasterFilters, setAppliedMasterFilters] = useState(INITIAL_MASTER_FILTERS);
  const [masterRows, setMasterRows] = useState([]);
  const [masterSummary, setMasterSummary] = useState({
    total_hospitals: 0,
    active_hospitals: 0,
    default_30_percent_count: 0,
    custom_commission_count: 0,
    total_omca_commission_earned: 0,
    total_gross_collected: 0,
  });
  const [masterPagination, setMasterPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
  });
  const [masterPage, setMasterPage] = useState(1);
  const [masterLoading, setMasterLoading] = useState(false);
  const [exportingMaster, setExportingMaster] = useState(false);
  const [selectedHospitalIds, setSelectedHospitalIds] = useState([]);

  // Single Edit Commission Modal
  const [editHospitalModal, setEditHospitalModal] = useState({
    open: false,
    hospital: null,
    percentage: "30.00",
    notes: "",
  });
  const [savingHospitalRate, setSavingHospitalRate] = useState(false);

  // Bulk Update Commission Modal
  const [bulkModal, setBulkModal] = useState({
    open: false,
    percentage: "30.00",
    notes: "Global commission standard set to 30%",
    applyToAll: true,
  });
  const [savingBulkRate, setSavingBulkRate] = useState(false);

  // ============================================================
  // TAB 3: Commission Payment Records (Audit Trail)
  // ============================================================
  const [recordsFilters, setRecordsFilters] = useState(INITIAL_RECORDS_FILTERS);
  const [appliedRecordsFilters, setAppliedRecordsFilters] = useState(INITIAL_RECORDS_FILTERS);
  const [recordRows, setRecordRows] = useState([]);
  const [recordsSummary, setRecordsSummary] = useState({
    total_records: 0,
    total_amount_received: 0,
  });
  const [recordsPagination, setRecordsPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 20,
  });
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);

  // ============================================================
  // LOADERS
  // ============================================================
  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetchHospitalCommissionReport({
        ...appliedReportFilters,
        page: reportPage,
        limit: reportLimit,
      });
      setReportRows(Array.isArray(res?.data) ? res.data : []);
      if (res?.summary) {
        setReportSummary(res.summary);
      }
      if (res?.pagination) {
        setReportPagination(res.pagination);
      }
    } catch (err) {
      console.error("Error loading hospital commission report:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to load commission report",
        "error"
      );
    } finally {
      setReportLoading(false);
    }
  }, [appliedReportFilters, reportPage, reportLimit]);

  const loadMaster = useCallback(async () => {
    setMasterLoading(true);
    try {
      const res = await fetchHospitalCommissionMaster({
        ...appliedMasterFilters,
        page: masterPage,
        limit: 10,
      });
      setMasterRows(Array.isArray(res?.data) ? res.data : []);
      if (res?.summary) {
        setMasterSummary(res.summary);
      }
      if (res?.pagination) {
        setMasterPagination(res.pagination);
      }
    } catch (err) {
      console.error("Error loading hospital commission master:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to load hospital master list",
        "error"
      );
    } finally {
      setMasterLoading(false);
    }
  }, [appliedMasterFilters, masterPage]);

  const loadPaymentRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await fetchHospitalCommissionPaymentRecords({
        ...appliedRecordsFilters,
        page: recordsPage,
        limit: 20,
      });
      setRecordRows(Array.isArray(res?.data) ? res.data : []);
      if (res?.summary) {
        setRecordsSummary(res.summary);
      }
      if (res?.pagination) {
        setRecordsPagination(res.pagination);
      }
    } catch (err) {
      console.error("Error loading commission payment records:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to load payment records",
        "error"
      );
    } finally {
      setRecordsLoading(false);
    }
  }, [appliedRecordsFilters, recordsPage]);

  useEffect(() => {
    if (activeTab === "report") {
      loadReport();
    } else if (activeTab === "master") {
      loadMaster();
    } else if (activeTab === "records") {
      loadPaymentRecords();
    }
  }, [activeTab, loadReport, loadMaster, loadPaymentRecords]);

  // ============================================================
  // HANDLERS: REPORT & PAYMENTS
  // ============================================================
  const handleApplyReportFilters = (e) => {
    if (e) e.preventDefault();
    setReportPage(1);
    setAppliedReportFilters({ ...reportFilters });
  };

  const handleResetReportFilters = () => {
    setReportFilters(INITIAL_REPORT_FILTERS);
    setAppliedReportFilters(INITIAL_REPORT_FILTERS);
    setReportPage(1);
  };

  const handleSortReport = (field) => {
    const nextOrder =
      appliedReportFilters.sortBy === field && appliedReportFilters.sortOrder === "desc"
        ? "asc"
        : "desc";
    const nextFilters = {
      ...reportFilters,
      sortBy: field,
      sortOrder: nextOrder,
    };
    setReportFilters(nextFilters);
    setAppliedReportFilters(nextFilters);
    setReportPage(1);
  };

  const handleExportReport = async () => {
    setExportingReport(true);
    try {
      await exportHospitalCommissionReport(appliedReportFilters);
    } catch (err) {
      Swal.fire(
        "Export Failed",
        err.response?.data?.message || err.message || "Failed to export Excel report",
        "error"
      );
    } finally {
      setExportingReport(false);
    }
  };

  const openAddPayment = (row) => {
    setPaymentForm({
      amount_received: row?.due_commission > 0 ? String(row.due_commission) : "",
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "Bank Transfer",
      reference_no: "",
      notes: "",
      received_by: localStorage.getItem("name") || "OMCA Admin",
    });
    setAddPaymentModal({ open: true, row });
  };

  const handleAddPaymentSubmit = async (e) => {
    e.preventDefault();
    const row = addPaymentModal.row;
    if (!row) return;
    const amt = Number(paymentForm.amount_received);
    if (!Number.isFinite(amt) || amt <= 0) {
      Swal.fire("Validation", "Please enter a valid positive amount received.", "warning");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await addHospitalCommissionPayment({
        hospital_id: row.hospital_id,
        patient_id: row.patient_id,
        treatment_id: row.treatment_id,
        treatment_name: row.treatment_name,
        amount_received: amt,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        reference_no: paymentForm.reference_no.trim(),
        notes: paymentForm.notes.trim(),
        received_by: paymentForm.received_by.trim() || "OMCA Admin",
      });
      Swal.fire(
        "Success",
        res?.message || `Commission payment of ₹${amt} recorded successfully.`,
        "success"
      );
      setAddPaymentModal({ open: false, row: null });
      loadReport();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to record commission payment",
        "error"
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePaymentRecord = async (recordId, fromHistoryModal = false) => {
    const confirm = await Swal.fire({
      title: "Delete Payment Record?",
      text: "This will reverse the recorded commission payment and recalculate Due amount.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Yes, Delete",
    });
    if (!confirm.isConfirmed) return;

    setDeletingRecordId(recordId);
    try {
      const res = await deleteHospitalCommissionPaymentRecord(recordId);
      Swal.fire("Deleted", res?.message || "Payment record deleted successfully.", "success");
      if (fromHistoryModal && historyModal.row) {
        setHistoryModal((prev) => ({
          ...prev,
          row: {
            ...prev.row,
            payment_records: (prev.row.payment_records || []).filter((r) => r.id !== recordId),
          },
        }));
      }
      if (activeTab === "report") loadReport();
      if (activeTab === "records") loadPaymentRecords();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to delete payment record",
        "error"
      );
    } finally {
      setDeletingRecordId(null);
    }
  };

  // ============================================================
  // HANDLERS: HOSPITAL MASTER
  // ============================================================
  const handleApplyMasterFilters = (e) => {
    if (e) e.preventDefault();
    setMasterPage(1);
    setAppliedMasterFilters({ ...masterFilters });
  };

  const handleResetMasterFilters = () => {
    setMasterFilters(INITIAL_MASTER_FILTERS);
    setAppliedMasterFilters(INITIAL_MASTER_FILTERS);
    setMasterPage(1);
  };

  const handleExportMaster = async () => {
    setExportingMaster(true);
    try {
      await exportHospitalCommissionMaster(appliedMasterFilters);
    } catch (err) {
      Swal.fire(
        "Export Failed",
        err.response?.data?.message || err.message || "Failed to export master Excel",
        "error"
      );
    } finally {
      setExportingMaster(false);
    }
  };

  const handleSaveSingleHospitalRate = async (e) => {
    e.preventDefault();
    const hosp = editHospitalModal.hospital;
    if (!hosp) return;
    const pct = Number(editHospitalModal.percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      Swal.fire("Validation", "Commission percentage must be between 0 and 100.", "warning");
      return;
    }

    setSavingHospitalRate(true);
    try {
      const res = await updateHospitalCommission(hosp.hospital_id, {
        omca_commission_percentage: pct,
        notes: editHospitalModal.notes.trim(),
      });
      Swal.fire("Updated", res?.message || "Hospital commission percentage updated.", "success");
      setEditHospitalModal({ open: false, hospital: null, percentage: "30.00", notes: "" });
      loadMaster();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to update hospital commission",
        "error"
      );
    } finally {
      setSavingHospitalRate(false);
    }
  };

  const handleResetHospitalRate = async (hosp) => {
    const confirm = await Swal.fire({
      title: "Reset to Default 30%?",
      text: `Reset ${hosp.hospital_name} commission percentage back to 30.00%?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Reset to 30%",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await resetHospitalCommission(hosp.hospital_id);
      Swal.fire("Reset Complete", res?.message || "Reset to default 30.00%.", "success");
      loadMaster();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to reset commission",
        "error"
      );
    }
  };

  const handleBulkSave = async (e) => {
    e.preventDefault();
    const pct = Number(bulkModal.percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      Swal.fire("Validation", "Commission percentage must be between 0 and 100.", "warning");
      return;
    }
    if (!bulkModal.applyToAll && selectedHospitalIds.length === 0) {
      Swal.fire("Validation", "Please select at least one hospital or choose All Hospitals.", "warning");
      return;
    }

    setSavingBulkRate(true);
    try {
      const payload = {
        default_percentage: pct,
        notes: bulkModal.notes.trim(),
        ...(bulkModal.applyToAll ? {} : { hospital_ids: selectedHospitalIds }),
      };
      const res = await bulkUpdateHospitalCommission(payload);
      Swal.fire("Bulk Update Complete", res?.message || "Commission updated.", "success");
      setBulkModal((prev) => ({ ...prev, open: false }));
      setSelectedHospitalIds([]);
      loadMaster();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Bulk update failed",
        "error"
      );
    } finally {
      setSavingBulkRate(false);
    }
  };

  const toggleSelectHospital = (hospitalId) => {
    setSelectedHospitalIds((prev) =>
      prev.includes(hospitalId) ? prev.filter((id) => id !== hospitalId) : [...prev, hospitalId]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = masterRows.map((h) => h.hospital_id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedHospitalIds.includes(id));
    if (allSelected) {
      setSelectedHospitalIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedHospitalIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // ============================================================
  // HANDLERS: PAYMENT RECORDS TAB
  // ============================================================
  const handleApplyRecordsFilters = (e) => {
    if (e) e.preventDefault();
    setRecordsPage(1);
    setAppliedRecordsFilters({ ...recordsFilters });
  };

  const handleResetRecordsFilters = () => {
    setRecordsFilters(INITIAL_RECORDS_FILTERS);
    setAppliedRecordsFilters(INITIAL_RECORDS_FILTERS);
    setRecordsPage(1);
  };

  return (
    <div className="page-wrapper">
      <div className="content hc-page">
        {/* Header */}
        <div className="hc-header-card d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h3 className="hc-title">
              <i className="fa fa-hospital-o text-primary" />
              OMCA Hospital Commission Management
            </h3>
            <p className="hc-subtitle">
              Track hospital billing, OMCA commission (default 30%), payments received, and hospital commission rates.
            </p>
          </div>
          <div className="hc-tabs mb-0">
            <button
              type="button"
              className={`hc-tab-btn ${activeTab === "report" ? "active" : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <i className="fa fa-bar-chart" /> Commission Report
            </button>
            <button
              type="button"
              className={`hc-tab-btn ${activeTab === "master" ? "active" : ""}`}
              onClick={() => setActiveTab("master")}
            >
              <i className="fa fa-sliders" /> Hospital % Master
            </button>
            <button
              type="button"
              className={`hc-tab-btn ${activeTab === "records" ? "active" : ""}`}
              onClick={() => setActiveTab("records")}
            >
              <i className="fa fa-history" /> Payment Records
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: OMCA COMMISSION REPORT                                */}
        {/* ============================================================ */}
        {activeTab === "report" && (
          <>
            {/* KPI Summary Cards */}
            <div className="hc-kpi-grid">
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Bills</span>
                <span className="hc-kpi-value text-dark">₹{formatMoney(reportSummary.total_bills)}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Payment</span>
                <span className="hc-kpi-value text-primary">₹{formatMoney(reportSummary.total_payment)}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">OMCA Commission</span>
                <span className="hc-kpi-value" style={{ color: "#7c3aed" }}>
                  ₹{formatMoney(reportSummary.total_omca_commission)}
                </span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Paid Commission</span>
                <span className="hc-kpi-value text-success">
                  ₹{formatMoney(reportSummary.total_paid_commission)}
                </span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Due Commission</span>
                <span className="hc-kpi-value text-danger">
                  ₹{formatMoney(reportSummary.total_due_commission)}
                </span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Records</span>
                <span className="hc-kpi-value text-secondary">
                  {Number(reportSummary.total_records || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Search Criteria */}
            <form className="hc-filter-card" onSubmit={handleApplyReportFilters}>
              <div className="hc-filter-grid">
                <div className="hc-filter-field">
                  <label>Keyword Search</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Patient, hospital, treatment..."
                    value={reportFilters.search}
                    onChange={(e) => setReportFilters({ ...reportFilters, search: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Country</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. India, Kenya"
                    value={reportFilters.country}
                    onChange={(e) => setReportFilters({ ...reportFilters, country: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>City</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. New Delhi, Mumbai"
                    value={reportFilters.city}
                    onChange={(e) => setReportFilters({ ...reportFilters, city: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Hospital (Name or ID)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Max or 14"
                    value={reportFilters.hospital}
                    onChange={(e) => setReportFilters({ ...reportFilters, hospital: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Patient (Name or ID)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. OMCA-1042 or Ravi"
                    value={reportFilters.patient}
                    onChange={(e) => setReportFilters({ ...reportFilters, patient: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Treatment (Name or ID)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. TRT-00452 or Knee"
                    value={reportFilters.treatment}
                    onChange={(e) => setReportFilters({ ...reportFilters, treatment: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={reportFilters.from_date}
                    onChange={(e) => setReportFilters({ ...reportFilters, from_date: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={reportFilters.to_date}
                    onChange={(e) => setReportFilters({ ...reportFilters, to_date: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Single Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={reportFilters.date}
                    onChange={(e) => setReportFilters({ ...reportFilters, date: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={reportFilters.status}
                    onChange={(e) => setReportFilters({ ...reportFilters, status: e.target.value })}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-2 border-top">
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm px-3">
                    <i className="fa fa-search me-1" /> Apply Filters
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={handleResetReportFilters}
                  >
                    <i className="fa fa-undo me-1" /> Reset
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-success btn-sm px-3"
                  onClick={handleExportReport}
                  disabled={exportingReport}
                >
                  <i className={`fa ${exportingReport ? "fa-spinner fa-spin" : "fa-file-excel-o"} me-1`} />
                  {exportingReport ? "Exporting..." : "Export Excel"}
                </button>
              </div>
            </form>

            {/* Report Table */}
            <div className="hc-table-card">
              <div className="table-responsive">
                <table className="table table-hover hc-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: "pointer" }} onClick={() => handleSortReport("patient_name")}>
                        Patient {appliedReportFilters.sortBy === "patient_name" ? (appliedReportFilters.sortOrder === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th>Location</th>
                      <th style={{ cursor: "pointer" }} onClick={() => handleSortReport("hospital_name")}>
                        Hospital {appliedReportFilters.sortBy === "hospital_name" ? (appliedReportFilters.sortOrder === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th>Treatment</th>
                      <th className="text-end" style={{ cursor: "pointer" }} onClick={() => handleSortReport("total_bills")}>
                        Total Bills
                      </th>
                      <th className="text-end" style={{ cursor: "pointer" }} onClick={() => handleSortReport("total_payment")}>
                        Total Payment
                      </th>
                      <th className="text-center">Comm %</th>
                      <th className="text-end" style={{ cursor: "pointer" }} onClick={() => handleSortReport("omca_commission")}>
                        OMCA Commission
                      </th>
                      <th className="text-end" style={{ cursor: "pointer" }} onClick={() => handleSortReport("paid_commission")}>
                        Paid
                      </th>
                      <th className="text-end" style={{ cursor: "pointer" }} onClick={() => handleSortReport("due_commission")}>
                        Due
                      </th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr>
                        <td colSpan="12" className="text-center py-5">
                          <CircularProgress size={32} />
                          <div className="text-muted small mt-2">Loading OMCA commission report...</div>
                        </td>
                      </tr>
                    ) : reportRows.length === 0 ? (
                      <tr>
                        <td colSpan="12" className="text-center py-5 text-muted">
                          No commission records found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      reportRows.map((row, idx) => (
                        <tr key={`${row.patient_id}-${row.treatment_id}-${idx}`}>
                          <td>
                            <div className="fw-bold text-dark">{row.patient_name || "—"}</div>
                            <small className="text-muted font-monospace">{row.patient_id}</small>
                          </td>
                          <td>
                            <div>{row.city || "—"}</div>
                            <small className="text-muted">{row.country || "—"}</small>
                          </td>
                          <td>
                            <div className="fw-semibold">{row.hospital_name || "—"}</div>
                            {row.hospital_city && <small className="text-muted">{row.hospital_city}</small>}
                          </td>
                          <td>
                            <div className="fw-semibold">{row.treatment_name || "—"}</div>
                            <small className="text-muted font-monospace">
                              {row.treatment_id} {row.treatment_status ? `• ${row.treatment_status}` : ""}
                            </small>
                          </td>
                          <td className="text-end fw-semibold">₹{formatMoney(row.total_bills)}</td>
                          <td className="text-end text-primary fw-semibold">₹{formatMoney(row.total_payment)}</td>
                          <td className="text-center">
                            <span className="badge bg-light text-dark border">
                              {Number(row.commission_percentage ?? 30).toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-end fw-bold" style={{ color: "#7c3aed" }}>
                            ₹{formatMoney(row.omca_commission)}
                          </td>
                          <td className="text-end text-success fw-bold">
                            ₹{formatMoney(row.paid_commission)}
                          </td>
                          <td className="text-end text-danger fw-bold">
                            ₹{formatMoney(row.due_commission)}
                          </td>
                          <td className="text-center">
                            <span className={`hc-status-badge ${getStatusBadgeClass(row.status)}`}>
                              {row.status || "Pending"}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="d-inline-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-success btn-sm py-1 px-2"
                                title="Record Commission Payment Received"
                                onClick={() => openAddPayment(row)}
                              >
                                <i className="fa fa-plus me-1" /> Pay
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm py-1 px-2"
                                title="View Payment History"
                                onClick={() => setHistoryModal({ open: true, row })}
                              >
                                <i className="fa fa-history me-1" />
                                {row.payment_records_count ?? (row.payment_records || []).length}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="hc-pagination-wrap">
                <div className="d-flex align-items-center gap-2 small text-muted">
                  <span>
                    Showing page {reportPagination.currentPage || reportPage} of {reportPagination.totalPages || 1} (
                    {reportPagination.totalRecords || 0} records)
                  </span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "80px" }}
                    value={reportLimit}
                    onChange={(e) => {
                      setReportLimit(Number(e.target.value));
                      setReportPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <Stack spacing={2}>
                  <Pagination
                    count={reportPagination.totalPages || 1}
                    page={reportPage}
                    onChange={(e, val) => setReportPage(val)}
                    color="primary"
                    size="small"
                  />
                </Stack>
              </div>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 2: HOSPITAL COMMISSION % MASTER                          */}
        {/* ============================================================ */}
        {activeTab === "master" && (
          <>
            <div className="hc-kpi-grid">
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Hospitals</span>
                <span className="hc-kpi-value">{masterSummary.total_hospitals || 0}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Active Hospitals</span>
                <span className="hc-kpi-value text-success">{masterSummary.active_hospitals || 0}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Default (30%)</span>
                <span className="hc-kpi-value text-primary">{masterSummary.default_30_percent_count || 0}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Custom %</span>
                <span className="hc-kpi-value text-warning">{masterSummary.custom_commission_count || 0}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Gross Collected</span>
                <span className="hc-kpi-value">₹{formatMoney(masterSummary.total_gross_collected)}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total OMCA Commission</span>
                <span className="hc-kpi-value" style={{ color: "#7c3aed" }}>
                  ₹{formatMoney(masterSummary.total_omca_commission_earned)}
                </span>
              </div>
            </div>

            <form className="hc-filter-card" onSubmit={handleApplyMasterFilters}>
              <div className="hc-filter-grid">
                <div className="hc-filter-field">
                  <label>Search Hospital</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Name, city, email..."
                    value={masterFilters.search}
                    onChange={(e) => setMasterFilters({ ...masterFilters, search: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>City</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. New Delhi"
                    value={masterFilters.city}
                    onChange={(e) => setMasterFilters({ ...masterFilters, city: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Hospital Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={masterFilters.status}
                    onChange={(e) => setMasterFilters({ ...masterFilters, status: e.target.value })}
                  >
                    <option value="all">All</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
                <div className="hc-filter-field">
                  <label>Commission Filter</label>
                  <select
                    className="form-select form-select-sm"
                    value={masterFilters.commission_filter}
                    onChange={(e) =>
                      setMasterFilters({ ...masterFilters, commission_filter: e.target.value })
                    }
                  >
                    <option value="">All Rates</option>
                    <option value="default">Default (30%)</option>
                    <option value="custom">Custom (Non-30%)</option>
                  </select>
                </div>
              </div>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-2 border-top">
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm px-3">
                    <i className="fa fa-search me-1" /> Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={handleResetMasterFilters}
                  >
                    <i className="fa fa-undo me-1" /> Reset
                  </button>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-warning btn-sm px-3"
                    onClick={() =>
                      setBulkModal({
                        open: true,
                        percentage: "30.00",
                        notes: "Global commission standard set to 30%",
                        applyToAll: selectedHospitalIds.length === 0,
                      })
                    }
                  >
                    <i className="fa fa-percent me-1" />
                    Bulk Update % {selectedHospitalIds.length > 0 ? `(${selectedHospitalIds.length} Selected)` : "(All)"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm px-3"
                    onClick={handleExportMaster}
                    disabled={exportingMaster}
                  >
                    <i className={`fa ${exportingMaster ? "fa-spinner fa-spin" : "fa-file-excel-o"} me-1`} />
                    {exportingMaster ? "Exporting..." : "Export Master Excel"}
                  </button>
                </div>
              </div>
            </form>

            <div className="hc-table-card">
              <div className="table-responsive">
                <table className="table table-hover hc-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={
                            masterRows.length > 0 &&
                            masterRows.every((h) => selectedHospitalIds.includes(h.hospital_id))
                          }
                          onChange={toggleSelectAllOnPage}
                        />
                      </th>
                      <th>Hospital</th>
                      <th>Contact</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">OMCA Comm %</th>
                      <th className="text-center">Treatments / Payments</th>
                      <th className="text-end">Total Billing</th>
                      <th className="text-end">Collected</th>
                      <th className="text-end">OMCA Commission</th>
                      <th className="text-end">Hospital Share</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterLoading ? (
                      <tr>
                        <td colSpan="11" className="text-center py-5">
                          <CircularProgress size={32} />
                          <div className="text-muted small mt-2">Loading hospitals...</div>
                        </td>
                      </tr>
                    ) : masterRows.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="text-center py-5 text-muted">
                          No hospitals found.
                        </td>
                      </tr>
                    ) : (
                      masterRows.map((h) => (
                        <tr key={h.hospital_id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedHospitalIds.includes(h.hospital_id)}
                              onChange={() => toggleSelectHospital(h.hospital_id)}
                            />
                          </td>
                          <td>
                            <div className="fw-bold text-dark">{h.hospital_name}</div>
                            <small className="text-muted">
                              {h.hospital_code || `ID: ${h.hospital_id}`} {h.city ? `• ${h.city}` : ""}
                            </small>
                          </td>
                          <td>
                            <div>{h.contact || "—"}</div>
                            <small className="text-muted">{h.email || "—"}</small>
                          </td>
                          <td className="text-center">
                            <span
                              className={`hc-status-badge ${
                                h.status === 1 ? "hc-status-completed" : "hc-status-pending"
                              }`}
                            >
                              {h.status_label || (h.status === 1 ? "Active" : "Inactive")}
                            </span>
                          </td>
                          <td className="text-center">
                            <span
                              className={`badge ${
                                h.is_custom_commission ? "bg-warning text-dark" : "bg-primary"
                              }`}
                              style={{ fontSize: "12px" }}
                            >
                              {Number(h.omca_commission_percentage ?? 30).toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-center">
                            {h.metrics?.treatments_count ?? 0} / {h.metrics?.payments_count ?? 0}
                          </td>
                          <td className="text-end">₹{formatMoney(h.metrics?.total_billing_amount)}</td>
                          <td className="text-end text-primary fw-semibold">
                            ₹{formatMoney(h.metrics?.total_collected_amount)}
                          </td>
                          <td className="text-end fw-bold" style={{ color: "#7c3aed" }}>
                            ₹{formatMoney(h.metrics?.total_omca_commission)}
                          </td>
                          <td className="text-end text-success fw-semibold">
                            ₹{formatMoney(h.metrics?.total_hospital_share)}
                          </td>
                          <td className="text-center">
                            <div className="d-inline-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm py-1 px-2"
                                onClick={() =>
                                  setEditHospitalModal({
                                    open: true,
                                    hospital: h,
                                    percentage: String(h.omca_commission_percentage ?? 30),
                                    notes: "",
                                  })
                                }
                              >
                                <i className="fa fa-edit me-1" /> Edit %
                              </button>
                              {h.is_custom_commission && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm py-1 px-2"
                                  title="Reset back to default 30%"
                                  onClick={() => handleResetHospitalRate(h)}
                                >
                                  Reset 30%
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="hc-pagination-wrap">
                <span className="small text-muted">
                  Page {masterPagination.currentPage || masterPage} of {masterPagination.totalPages || 1} (
                  {masterPagination.totalRecords || 0} hospitals)
                </span>
                <Stack spacing={2}>
                  <Pagination
                    count={masterPagination.totalPages || 1}
                    page={masterPage}
                    onChange={(e, val) => setMasterPage(val)}
                    color="primary"
                    size="small"
                  />
                </Stack>
              </div>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 3: PAYMENT RECORDS (AUDIT TRAIL)                         */}
        {/* ============================================================ */}
        {activeTab === "records" && (
          <>
            <div className="hc-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 300px))" }}>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Payment Records</span>
                <span className="hc-kpi-value">{recordsSummary.total_records || 0}</span>
              </div>
              <div className="hc-kpi-card">
                <span className="hc-kpi-label">Total Amount Received</span>
                <span className="hc-kpi-value text-success">
                  ₹{formatMoney(recordsSummary.total_amount_received)}
                </span>
              </div>
            </div>

            <form className="hc-filter-card" onSubmit={handleApplyRecordsFilters}>
              <div className="hc-filter-grid">
                <div className="hc-filter-field">
                  <label>Search</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Reference, notes, hospital..."
                    value={recordsFilters.search}
                    onChange={(e) => setRecordsFilters({ ...recordsFilters, search: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Hospital ID</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. 14"
                    value={recordsFilters.hospital_id}
                    onChange={(e) => setRecordsFilters({ ...recordsFilters, hospital_id: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Patient ID</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. OMCA-1042"
                    value={recordsFilters.patient_id}
                    onChange={(e) => setRecordsFilters({ ...recordsFilters, patient_id: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>Treatment ID</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. TRT-00452"
                    value={recordsFilters.treatment_id}
                    onChange={(e) => setRecordsFilters({ ...recordsFilters, treatment_id: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={recordsFilters.from_date}
                    onChange={(e) => setRecordsFilters({ ...recordsFilters, from_date: e.target.value })}
                  />
                </div>
                <div className="hc-filter-field">
                  <label>To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={recordsFilters.to_date}
                    onChange={(e) => setRecordsFilters({ ...recordsFilters, to_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3 pt-2 border-top">
                <button type="submit" className="btn btn-primary btn-sm px-3">
                  <i className="fa fa-search me-1" /> Apply
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={handleResetRecordsFilters}
                >
                  <i className="fa fa-undo me-1" /> Reset
                </button>
              </div>
            </form>

            <div className="hc-table-card">
              <div className="table-responsive">
                <table className="table table-hover hc-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Hospital</th>
                      <th>Patient ID</th>
                      <th>Treatment</th>
                      <th className="text-end">Amount Received</th>
                      <th>Payment Date</th>
                      <th>Method</th>
                      <th>Reference No</th>
                      <th>Received By</th>
                      <th>Notes</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordsLoading ? (
                      <tr>
                        <td colSpan="11" className="text-center py-5">
                          <CircularProgress size={32} />
                          <div className="text-muted small mt-2">Loading payment records...</div>
                        </td>
                      </tr>
                    ) : recordRows.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="text-center py-5 text-muted">
                          No commission payment records found.
                        </td>
                      </tr>
                    ) : (
                      recordRows.map((rec) => (
                        <tr key={rec.id}>
                          <td className="font-monospace">#{rec.id}</td>
                          <td>
                            <div className="fw-semibold">{rec.hospital_name || `Hospital #${rec.hospital_id}`}</div>
                            {rec.hospital_city && <small className="text-muted">{rec.hospital_city}</small>}
                          </td>
                          <td className="font-monospace">{rec.patient_id}</td>
                          <td>
                            <div>{rec.treatment_name || "—"}</div>
                            <small className="text-muted font-monospace">{rec.treatment_id}</small>
                          </td>
                          <td className="text-end text-success fw-bold">₹{formatMoney(rec.amount_received)}</td>
                          <td>{formatDateDisplay(rec.payment_date)}</td>
                          <td>{rec.payment_method || "—"}</td>
                          <td className="font-monospace">{rec.reference_no || "—"}</td>
                          <td>{rec.received_by || "—"}</td>
                          <td>{rec.notes || "—"}</td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm py-1 px-2"
                              disabled={deletingRecordId === rec.id}
                              onClick={() => handleDeletePaymentRecord(rec.id, false)}
                              title="Delete / Reverse Payment"
                            >
                              <i className={`fa ${deletingRecordId === rec.id ? "fa-spinner fa-spin" : "fa-trash"}`} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="hc-pagination-wrap">
                <span className="small text-muted">
                  Page {recordsPagination.currentPage || recordsPage} of {recordsPagination.totalPages || 1} (
                  {recordsPagination.totalRecords || 0} records)
                </span>
                <Stack spacing={2}>
                  <Pagination
                    count={recordsPagination.totalPages || 1}
                    page={recordsPage}
                    onChange={(e, val) => setRecordsPage(val)}
                    color="primary"
                    size="small"
                  />
                </Stack>
              </div>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* MODAL: ADD COMMISSION PAYMENT RECEIVED                       */}
        {/* ============================================================ */}
        <Dialog
          open={addPaymentModal.open}
          onClose={() => !submittingPayment && setAddPaymentModal({ open: false, row: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle className="d-flex justify-content-between align-items-center border-bottom">
            <span className="fw-bold">
              <i className="fa fa-money text-success me-2" />
              Record Commission Payment Received
            </span>
            <IconButton
              size="small"
              onClick={() => !submittingPayment && setAddPaymentModal({ open: false, row: null })}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <form onSubmit={handleAddPaymentSubmit}>
            <DialogContent dividers>
              {addPaymentModal.row && (
                <div className="alert alert-light border mb-3 small">
                  <div>
                    <strong>Hospital:</strong> {addPaymentModal.row.hospital_name} (#{addPaymentModal.row.hospital_id})
                  </div>
                  <div>
                    <strong>Patient:</strong> {addPaymentModal.row.patient_name} ({addPaymentModal.row.patient_id})
                  </div>
                  <div>
                    <strong>Treatment:</strong> {addPaymentModal.row.treatment_name} ({addPaymentModal.row.treatment_id})
                  </div>
                  <div className="mt-1">
                    <strong>OMCA Commission:</strong> ₹{formatMoney(addPaymentModal.row.omca_commission)} &nbsp;|&nbsp;
                    <strong className="text-success">Paid:</strong> ₹{formatMoney(addPaymentModal.row.paid_commission)} &nbsp;|&nbsp;
                    <strong className="text-danger">Due:</strong> ₹{formatMoney(addPaymentModal.row.due_commission)}
                  </div>
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Amount Received (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    value={paymentForm.amount_received}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount_received: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Payment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Payment Method</label>
                  <select
                    className="form-select"
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="NEFT / RTGS">NEFT / RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Reference No / UTR</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. UTR-9876543210"
                    value={paymentForm.reference_no}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label fw-semibold small">Received By</label>
                  <input
                    type="text"
                    className="form-control"
                    value={paymentForm.received_by}
                    onChange={(e) => setPaymentForm({ ...paymentForm, received_by: e.target.value })}
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label fw-semibold small">Notes</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Commission payment received via NEFT..."
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </DialogContent>
            <DialogActions className="p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={submittingPayment}
                onClick={() => setAddPaymentModal({ open: false, row: null })}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-success btn-sm px-3" disabled={submittingPayment}>
                {submittingPayment ? "Saving..." : "Save Payment"}
              </button>
            </DialogActions>
          </form>
        </Dialog>

        {/* ============================================================ */}
        {/* MODAL: CASE PAYMENT HISTORY                                  */}
        {/* ============================================================ */}
        <Dialog
          open={historyModal.open}
          onClose={() => setHistoryModal({ open: false, row: null })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle className="d-flex justify-content-between align-items-center border-bottom">
            <span className="fw-bold">
              <i className="fa fa-history text-primary me-2" />
              Commission Payment History
            </span>
            <IconButton size="small" onClick={() => setHistoryModal({ open: false, row: null })}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {historyModal.row && (
              <>
                <div className="alert alert-light border small mb-3">
                  <strong>{historyModal.row.patient_name}</strong> ({historyModal.row.patient_id}) •{" "}
                  <strong>{historyModal.row.hospital_name}</strong> • {historyModal.row.treatment_name}
                </div>
                {(historyModal.row.payment_records || []).length === 0 ? (
                  <div className="text-center py-4 text-muted">No payments recorded yet for this case.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th className="text-end">Amount</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th>Received By</th>
                          <th>Notes</th>
                          <th className="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(historyModal.row.payment_records || []).map((pr) => (
                          <tr key={pr.id}>
                            <td>{formatDateDisplay(pr.payment_date)}</td>
                            <td className="text-end text-success fw-bold">₹{formatMoney(pr.amount_received)}</td>
                            <td>{pr.payment_method || "—"}</td>
                            <td className="font-monospace">{pr.reference_no || "—"}</td>
                            <td>{pr.received_by || "—"}</td>
                            <td>{pr.notes || "—"}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm py-0 px-2"
                                disabled={deletingRecordId === pr.id}
                                onClick={() => handleDeletePaymentRecord(pr.id, true)}
                              >
                                <i className="fa fa-trash" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions className="p-2 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setHistoryModal({ open: false, row: null })}
            >
              Close
            </button>
          </DialogActions>
        </Dialog>

        {/* ============================================================ */}
        {/* MODAL: EDIT SINGLE HOSPITAL COMMISSION %                     */}
        {/* ============================================================ */}
        <Dialog
          open={editHospitalModal.open}
          onClose={() =>
            !savingHospitalRate &&
            setEditHospitalModal({ open: false, hospital: null, percentage: "30.00", notes: "" })
          }
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle className="d-flex justify-content-between align-items-center border-bottom">
            <span className="fw-bold">Update Hospital Commission %</span>
            <IconButton
              size="small"
              onClick={() =>
                !savingHospitalRate &&
                setEditHospitalModal({ open: false, hospital: null, percentage: "30.00", notes: "" })
              }
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <form onSubmit={handleSaveSingleHospitalRate}>
            <DialogContent dividers>
              {editHospitalModal.hospital && (
                <div className="mb-3 fw-semibold text-dark">
                  {editHospitalModal.hospital.hospital_name}
                </div>
              )}
              <div className="mb-3">
                <label className="form-label fw-semibold small">OMCA Commission Percentage (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-control"
                  value={editHospitalModal.percentage}
                  onChange={(e) =>
                    setEditHospitalModal({ ...editHospitalModal, percentage: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="form-label fw-semibold small">Notes</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="e.g. Special contracted rate for 2026"
                  value={editHospitalModal.notes}
                  onChange={(e) => setEditHospitalModal({ ...editHospitalModal, notes: e.target.value })}
                />
              </div>
            </DialogContent>
            <DialogActions className="p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={savingHospitalRate}
                onClick={() =>
                  setEditHospitalModal({ open: false, hospital: null, percentage: "30.00", notes: "" })
                }
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm px-3" disabled={savingHospitalRate}>
                {savingHospitalRate ? "Updating..." : "Update %"}
              </button>
            </DialogActions>
          </form>
        </Dialog>

        {/* ============================================================ */}
        {/* MODAL: BULK UPDATE HOSPITAL COMMISSION %                     */}
        {/* ============================================================ */}
        <Dialog
          open={bulkModal.open}
          onClose={() => !savingBulkRate && setBulkModal((prev) => ({ ...prev, open: false }))}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle className="d-flex justify-content-between align-items-center border-bottom">
            <span className="fw-bold">Bulk Update Hospital Commission %</span>
            <IconButton
              size="small"
              onClick={() => !savingBulkRate && setBulkModal((prev) => ({ ...prev, open: false }))}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <form onSubmit={handleBulkSave}>
            <DialogContent dividers>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Apply To</label>
                <select
                  className="form-select"
                  value={bulkModal.applyToAll ? "all" : "selected"}
                  onChange={(e) =>
                    setBulkModal({ ...bulkModal, applyToAll: e.target.value === "all" })
                  }
                >
                  <option value="all">All Hospitals</option>
                  <option value="selected" disabled={selectedHospitalIds.length === 0}>
                    Selected Hospitals ({selectedHospitalIds.length})
                  </option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Default Commission Percentage (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-control"
                  value={bulkModal.percentage}
                  onChange={(e) => setBulkModal({ ...bulkModal, percentage: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label fw-semibold small">Notes</label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={bulkModal.notes}
                  onChange={(e) => setBulkModal({ ...bulkModal, notes: e.target.value })}
                />
              </div>
            </DialogContent>
            <DialogActions className="p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={savingBulkRate}
                onClick={() => setBulkModal((prev) => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-warning btn-sm px-3" disabled={savingBulkRate}>
                {savingBulkRate ? "Updating..." : "Apply Bulk Update"}
              </button>
            </DialogActions>
          </form>
        </Dialog>
      </div>
    </div>
  );
}
