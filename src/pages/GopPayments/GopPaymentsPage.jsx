import React, { useState, useEffect, useCallback } from "react";
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
import { resolveCrmImageUrl } from "../../Basurl/Baseurl";
import { gopService } from "../../services/gopService";

const formatAmount = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const INITIAL_FILTERS = {
  search: "",
  status: "all",
  filterType: "",
  startDate: "",
  endDate: "",
  sortBy: "payment_Date",
  sortOrder: "desc",
};

export default function GopPaymentsPage() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalRecords: 0,
  });
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);

  // Action Modal States
  const [activeItem, setActiveItem] = useState(null);
  const [modalType, setModalType] = useState(null); // 'approve' | 'settle' | 'reject'
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Details Modal
  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    data: null,
  });

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await gopService.getAllGopPayments({
        page: pagination.page,
        limit: pagination.limit,
        ...appliedFilters,
      });
      if (res?.success) {
        setData(Array.isArray(res.data) ? res.data : []);
        setSummary(res.summary || {});
        setPagination((prev) => ({
          ...prev,
          totalPages: res.pagination?.totalPages || 1,
          totalRecords: res.pagination?.totalRecords || 0,
        }));
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Failed to load GOP payments",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, appliedFilters]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    setAppliedFilters({ ...filters });
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const openActionModal = (item, type) => {
    setActiveItem(item);
    setModalType(type);
    setNotes("");
    setFiles([]);
  };

  const handleOpenDetails = async (item) => {
    const treatmentId = item?.treatment_id;
    const paymentId = item?.payment?.payment_id || item?.payment_id;
    setDetailModal({ open: true, loading: true, data: item });
    if (!treatmentId || !paymentId) {
      setDetailModal({ open: true, loading: false, data: item });
      return;
    }
    try {
      const res = await gopService.getGopPaymentDetails(treatmentId, paymentId);
      if (res?.success && res.data) {
        setDetailModal({ open: true, loading: false, data: res.data });
      } else {
        setDetailModal({ open: true, loading: false, data: item });
      }
    } catch (_) {
      setDetailModal({ open: true, loading: false, data: item });
    }
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!activeItem) return;
    try {
      setSubmitting(true);
      const treatmentId = activeItem.treatment_id;
      const paymentId = activeItem.payment?.payment_id || activeItem.payment_id;

      if (modalType === "approve") {
        await gopService.approveGopPayment(treatmentId, paymentId, {
          approvalNotes: notes,
          files,
        });
        Swal.fire(
          "Approved",
          "GOP Approved (Approval Indicator set. Dues will remain until settled).",
          "success"
        );
      } else if (modalType === "settle") {
        await gopService.settleGopPayment(treatmentId, paymentId, {
          deductionNotes: notes,
          files,
        });
        Swal.fire(
          "Settled",
          "GOP Settled & Deducted from Total Dues successfully!",
          "success"
        );
      } else if (modalType === "reject") {
        await gopService.rejectGopPayment(treatmentId, paymentId, notes);
        Swal.fire("Rejected", "GOP Payment Rejected.", "info");
      }

      setModalType(null);
      setActiveItem(null);
      setNotes("");
      setFiles([]);
      fetchPayments();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Operation failed",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status, isDeducted) => {
    if (status === "Pending") {
      return <span className="badge bg-warning text-dark">Pending Approval</span>;
    }
    if (status === "Approved" && !isDeducted) {
      return (
        <span
          className="badge bg-info text-dark"
          title="Approval indicator only - not deducted from dues"
        >
          Approved (Indicator Only)
        </span>
      );
    }
    if (status === "Settled" || isDeducted) {
      return <span className="badge bg-success">Settled & Deducted</span>;
    }
    if (status === "Rejected") {
      return <span className="badge bg-danger">Rejected</span>;
    }
    return <span className="badge bg-secondary">{status || "—"}</span>;
  };

  const renderDocLinks = (docs = [], labelPrefix = "Doc", iconOnly = false) => {
    if (!Array.isArray(docs) || docs.length === 0) return null;
    return docs.map((doc, idx) => {
      const url = resolveCrmImageUrl(doc?.url || doc);
      if (!url) return null;
      const fileName = doc?.filename || `${labelPrefix} ${idx + 1}`;
      const isPdf = /\.pdf(\?|$)/i.test(String(url));
      if (iconOnly) {
        return (
          <a
            key={`${labelPrefix}-${idx}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn btn-sm py-0 px-1.5 border ${
              isPdf ? "btn-outline-danger" : "btn-outline-primary"
            }`}
            title={`${labelPrefix}: ${fileName}`}
            style={{ fontSize: "12px", lineHeight: "1.4" }}
          >
            <i className={`fa ${isPdf ? "fa-file-pdf-o" : "fa-file-image-o"}`} />
          </a>
        );
      }
      return (
        <a
          key={`${labelPrefix}-${idx}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="badge bg-light text-primary border text-decoration-none me-1 mb-1"
        >
          <i className={`fa ${isPdf ? "fa-file-pdf-o text-danger" : "fa-paperclip"} me-1`} />
          {fileName}
        </a>
      );
    });
  };

  return (
    <div className="page-wrapper">
      <div className="content" style={{ padding: "20px 24px 36px" }}>
        {/* Header */}
        <div
          className="bg-white border rounded-3 p-3 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2 shadow-sm"
        >
          <div>
            <h4 className="mb-1 fw-bold text-dark">
              <i className="fa fa-file-text text-primary me-2" />
              GOP (Guarantee of Payment) Management
            </h4>
            <p className="mb-0 text-muted small">
              Two-step GOP workflow: Step 1 Approve (Indicator Only) → Step 2 Settle (Deducts from Patient Dues).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={fetchPayments}
            disabled={loading}
          >
            <i className={`fa fa-refresh ${loading ? "fa-spin" : ""} me-1`} />
            Refresh
          </button>
        </div>

        {/* 1. TOP SUMMARY CARDS */}
        <div className="row g-3 mb-3">
          <div className="col-6 col-md">
            <div className="bg-white border rounded-3 p-3 shadow-sm h-100">
              <div className="text-muted small fw-semibold">Total GOP</div>
              <div className="fs-5 fw-bold text-dark">
                {summary.totalCount || 0}{" "}
                <span className="small text-muted fw-normal">
                  (₹{formatAmount(summary.totalAmount || 0)})
                </span>
              </div>
            </div>
          </div>
          <div className="col-6 col-md">
            <div className="bg-white border rounded-3 p-3 shadow-sm h-100">
              <div className="text-warning small fw-semibold">Pending</div>
              <div className="fs-5 fw-bold text-dark">
                {summary.pendingCount || 0}{" "}
                <span className="small text-muted fw-normal">
                  (₹{formatAmount(summary.pendingAmount || 0)})
                </span>
              </div>
            </div>
          </div>
          <div className="col-6 col-md">
            <div className="bg-white border rounded-3 p-3 shadow-sm h-100">
              <div className="text-info small fw-semibold">Approved (Indicator)</div>
              <div className="fs-5 fw-bold text-dark">
                {summary.approvedCount || 0}{" "}
                <span className="small text-muted fw-normal">
                  (₹{formatAmount(summary.approvedAmount || 0)})
                </span>
              </div>
            </div>
          </div>
          <div className="col-6 col-md">
            <div className="bg-white border rounded-3 p-3 shadow-sm h-100">
              <div className="text-success small fw-semibold">Settled (Deducted)</div>
              <div className="fs-5 fw-bold text-dark">
                {summary.settledCount || 0}{" "}
                <span className="small text-muted fw-normal">
                  (₹{formatAmount(summary.settledAmount || 0)})
                </span>
              </div>
            </div>
          </div>
          <div className="col-6 col-md">
            <div className="bg-white border rounded-3 p-3 shadow-sm h-100">
              <div className="text-danger small fw-semibold">Rejected</div>
              <div className="fs-5 fw-bold text-dark">
                {summary.rejectedCount || 0}{" "}
                <span className="small text-muted fw-normal">
                  (₹{formatAmount(summary.rejectedAmount || 0)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. FILTERS */}
        <form
          onSubmit={handleApplyFilters}
          className="bg-white border rounded-3 p-3 mb-3 shadow-sm"
        >
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Patient, Treatment ID, Notes..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved (Indicator)</option>
                <option value="Settled">Settled (Deducted)</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">Preset</label>
              <select
                className="form-select form-select-sm"
                value={filters.filterType}
                onChange={(e) => setFilters({ ...filters, filterType: e.target.value })}
              >
                <option value="">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">From Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">To Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="col-md-1 d-flex gap-1">
              <button type="submit" className="btn btn-primary btn-sm flex-fill" title="Apply">
                <i className="fa fa-search" />
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm flex-fill"
                onClick={handleResetFilters}
                title="Reset"
              >
                <i className="fa fa-undo" />
              </button>
            </div>
          </div>
        </form>

        {/* 3. TABLE */}
        <div className="bg-white border rounded-3 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "12.5px" }}>
              <thead className="table-light">
                <tr>
                  <th>Patient</th>
                  <th>Treatment</th>
                  <th className="text-end text-nowrap">GOP Amt</th>
                  <th className="text-nowrap">Date</th>
                  <th>Status</th>
                  <th className="text-end text-nowrap">Due Amt</th>
                  <th className="text-center">Docs</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <CircularProgress size={32} />
                      <div className="text-muted small mt-2">Loading GOP payments...</div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      No GOP payment records found.
                    </td>
                  </tr>
                ) : (
                  data.map((item) => {
                    const p = item.payment || {};
                    const pid = p.payment_id || item.payment_id;
                    return (
                      <tr key={`${item.treatment_id}-${pid}`}>
                        <td>
                          <div className="fw-bold text-dark">
                            {item.patient?.patient_name || "—"}
                          </div>
                          <small className="text-muted font-monospace">
                            {item.patient?.patientId || "—"}
                            {item.patient?.country ? ` • ${item.patient.country}` : ""}
                          </small>
                        </td>
                        <td>
                          <div className="fw-semibold">{item.treatment_course_name || "—"}</div>
                          <small className="text-muted font-monospace">{item.treatment_id}</small>
                        </td>
                        <td className="text-end fw-bold text-nowrap">₹{formatAmount(p.paid_amount)}</td>
                        <td className="text-nowrap">{formatDate(p.payment_Date)}</td>
                        <td>{getStatusBadge(p.status, p.isDeducted)}</td>
                        <td
                          className={`text-end fw-bold text-nowrap ${
                            Number(item.treatment_due_payment) > 0 ? "text-danger" : "text-success"
                          }`}
                        >
                          ₹{formatAmount(item.treatment_due_payment)}
                        </td>
                        <td className="text-center">
                          <div className="d-inline-flex flex-wrap gap-1 justify-content-center">
                            {renderDocLinks(p.attachFile_urls, "GOP", true)}
                            {renderDocLinks(p.approvalDocs_urls, "Approval", true)}
                            {renderDocLinks(p.deductionDocs_urls, "Settle", true)}
                            {!(p.attachFile_urls?.length || p.approvalDocs_urls?.length || p.deductionDocs_urls?.length) && (
                              <span className="text-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="d-inline-flex flex-nowrap gap-1 justify-content-center">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm py-0 px-2"
                              onClick={() => handleOpenDetails(item)}
                              title="View GOP Details"
                            >
                              <i className="fa fa-eye" />
                            </button>

                            {p.status === "Pending" && (
                              <button
                                type="button"
                                className="btn btn-info btn-sm py-0 px-2 text-dark fw-semibold text-nowrap"
                                onClick={() => openActionModal(item, "approve")}
                                title="Step 1: Approve (Indicator Only)"
                              >
                                Approve
                              </button>
                            )}

                            {p.status !== "Settled" && p.status !== "Rejected" && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm py-0 px-2 text-nowrap"
                                onClick={() => openActionModal(item, "settle")}
                                title="Step 2: Settle & Deduct Dues"
                              >
                                Settle
                              </button>
                            )}

                            {p.status !== "Rejected" && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm py-0 px-2 text-nowrap"
                                onClick={() => openActionModal(item, "reject")}
                                title="Reject GOP Payment"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-top bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span className="small text-muted">
              Page {pagination.page} of {pagination.totalPages || 1} ({pagination.totalRecords || 0} records)
            </span>
            <Stack spacing={2}>
              <Pagination
                count={pagination.totalPages || 1}
                page={pagination.page}
                onChange={(e, val) => setPagination((prev) => ({ ...prev, page: val }))}
                color="primary"
                size="small"
              />
            </Stack>
          </div>
        </div>

        {/* 4. ACTION MODAL */}
        <Dialog
          open={Boolean(modalType)}
          onClose={() => !submitting && setModalType(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle className="d-flex justify-content-between align-items-center border-bottom">
            <span className="fw-bold fs-6">
              {modalType === "approve" && "Step 1: Approve GOP (Indicator Only)"}
              {modalType === "settle" && "Step 2: Settle GOP & Deduct From Dues"}
              {modalType === "reject" && "Reject GOP Payment"}
            </span>
            <IconButton size="small" onClick={() => !submitting && setModalType(null)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <form onSubmit={handleActionSubmit}>
            <DialogContent dividers>
              <p className="small text-muted mb-3">
                {modalType === "approve" &&
                  "Approval indicates guarantee verification. Patient's dues will NOT be reduced at this step."}
                {modalType === "settle" &&
                  "Settling confirms payment receipt. Patient's dues will be officially reduced by the GOP amount."}
                {modalType === "reject" &&
                  "Rejecting this GOP payment will restore dues if previously settled."}
              </p>

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Notes / Remarks {modalType === "reject" ? "*" : ""}
                </label>
                <textarea
                  rows={3}
                  className="form-control"
                  required={modalType === "reject"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>

              {modalType !== "reject" && (
                <div>
                  <label className="form-label fw-semibold small">
                    Attach Proof / Letter (Optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    className="form-control form-control-sm"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                </div>
              )}
            </DialogContent>
            <DialogActions className="p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalType(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn btn-sm px-3 ${
                  modalType === "reject"
                    ? "btn-danger"
                    : modalType === "settle"
                    ? "btn-success"
                    : "btn-primary"
                }`}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Confirm"}
              </button>
            </DialogActions>
          </form>
        </Dialog>

        {/* 5. DETAILS MODAL */}
        <Dialog
          open={detailModal.open}
          onClose={() => setDetailModal({ open: false, loading: false, data: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle className="d-flex justify-content-between align-items-center border-bottom">
            <span className="fw-bold fs-6">GOP Payment Details</span>
            <IconButton
              size="small"
              onClick={() => setDetailModal({ open: false, loading: false, data: null })}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {detailModal.loading ? (
              <div className="text-center py-4">
                <CircularProgress size={28} />
              </div>
            ) : detailModal.data ? (
              <div className="small">
                <div className="mb-2">
                  <strong>Patient:</strong> {detailModal.data.patient?.patient_name || "—"} (
                  {detailModal.data.patient?.patientId || "—"})
                </div>
                <div className="mb-2">
                  <strong>Treatment:</strong> {detailModal.data.treatment_course_name || "—"} (
                  {detailModal.data.treatment_id})
                </div>
                <div className="mb-2">
                  <strong>Total Charge:</strong> ₹
                  {formatAmount(detailModal.data.treatment_total_charge)} &nbsp;|&nbsp;
                  <strong>Due Payment:</strong> ₹
                  {formatAmount(detailModal.data.treatment_due_payment)}
                </div>
                <div className="mb-2">
                  <strong>GOP Amount:</strong> ₹
                  {formatAmount(detailModal.data.payment?.paid_amount)} &nbsp;|&nbsp;
                  <strong>Status:</strong>{" "}
                  {getStatusBadge(
                    detailModal.data.payment?.status,
                    detailModal.data.payment?.isDeducted
                  )}
                </div>
                {detailModal.data.payment?.notes && (
                  <div className="mb-2">
                    <strong>Notes:</strong> {detailModal.data.payment.notes}
                  </div>
                )}
                {detailModal.data.payment?.approvalNotes && (
                  <div className="mb-2">
                    <strong>Approval Notes:</strong> {detailModal.data.payment.approvalNotes}
                  </div>
                )}
                {detailModal.data.payment?.deductionNotes && (
                  <div className="mb-2">
                    <strong>Settlement Notes:</strong> {detailModal.data.payment.deductionNotes}
                  </div>
                )}
                {detailModal.data.payment?.rejectionNotes && (
                  <div className="mb-2 text-danger">
                    <strong>Rejection Notes:</strong> {detailModal.data.payment.rejectionNotes}
                  </div>
                )}
                <div className="mt-3">
                  <strong>Documents:</strong>
                  <div className="d-flex flex-wrap mt-1">
                    {renderDocLinks(detailModal.data.payment?.attachFile_urls, "GOP")}
                    {renderDocLinks(detailModal.data.payment?.approvalDocs_urls, "Approval")}
                    {renderDocLinks(detailModal.data.payment?.deductionDocs_urls, "Settle")}
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
          <DialogActions className="p-2 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDetailModal({ open: false, loading: false, data: null })}
            >
              Close
            </button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
}
