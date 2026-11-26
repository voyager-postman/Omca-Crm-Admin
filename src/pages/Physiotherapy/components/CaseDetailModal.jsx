import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import {
  fetchPhysiotherapyDetails,
  updatePhysiotherapyStatus,
  addPhysiotherapyNote,
  uploadPhysiotherapyDocuments,
  formatDiseaseName,
  PHYSIO_STATUSES,
  filterActiveSessionAttachments,
  filterActiveCaseDocuments,
  markCaseDocumentsRemoved,
  setPhysiotherapyDecidedAmount,
  addPhysiotherapyPaymentRecord,
  getPhysiotherapyPaymentDetails,
  deletePhysiotherapyPaymentRecord,
} from "../../../services/physiotherapyApi";
import { imageUrl } from "../../../Basurl/Baseurl";
import ReferralModal from "./ReferralModal";
import SessionModal from "./SessionModal";

export default function CaseDetailModal({
  open,
  onClose,
  caseId,
  onStatusUpdated,
  onOpenLogSession,
  initialTab = "sessions",
}) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || "sessions"); // sessions | notes | documents | status | payments

  // New Note state
  const [newNote, setNewNote] = useState({ noteText: "", noteType: "Progress" });
  const [addingNote, setAddingNote] = useState(false);

  // Upload Doc state
  const [newDocName, setNewDocName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Edit Case and Session Modals
  const [editCaseModalOpen, setEditCaseModalOpen] = useState(false);
  const [localSessionModalOpen, setLocalSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Status Change state
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const contentRef = React.useRef(null);

  // Fee & Payments state
  const [paymentDetails, setPaymentDetails] = useState({
    decidedAmount: 0,
    totalGiven: 0,
    remainingDue: 0,
    status: "Pending",
    records: [],
  });
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [isEditingDecidedFee, setIsEditingDecidedFee] = useState(false);
  const [decidedFeeInput, setDecidedFeeInput] = useState("");
  const [savingDecidedFee, setSavingDecidedFee] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amountGiven: "",
    dateGiven: new Date().toISOString().split("T")[0],
    details: "",
    givenBy: localStorage.getItem("name") || "Admin / Accounts",
  });
  const [addingPayment, setAddingPayment] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);

  useEffect(() => {
    if (open) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (open && caseId) {
      loadDetails();
      loadPaymentDetails(caseId);
    }
  }, [open, caseId]);

  const loadPaymentDetails = async (idToUse) => {
    const id = idToUse || caseId;
    if (!id) return;
    setLoadingPayment(true);
    try {
      const res = await getPhysiotherapyPaymentDetails(id);
      const pd = res?.paymentDetails || res?.data || res;
      if (pd && typeof pd === "object") {
        setPaymentDetails({
          decidedAmount: pd.decidedAmount ?? 0,
          totalGiven: pd.totalGiven ?? 0,
          remainingDue:
            pd.remainingDue ??
            Math.max(0, (pd.decidedAmount || 0) - (pd.totalGiven || 0)),
          status: pd.status || "Pending",
          records: Array.isArray(pd.records) ? pd.records : [],
        });
        setDecidedFeeInput(pd.decidedAmount !== undefined ? String(pd.decidedAmount) : "");
      }
    } catch (err) {
      console.warn("Could not load payment details via API, falling back to case data:", err);
      if (caseData?.paymentDetails) {
        setPaymentDetails({
          decidedAmount: caseData.paymentDetails.decidedAmount ?? 0,
          totalGiven: caseData.paymentDetails.totalGiven ?? 0,
          remainingDue: caseData.paymentDetails.remainingDue ?? 0,
          status: caseData.paymentDetails.status || "Pending",
          records: Array.isArray(caseData.paymentDetails.records) ? caseData.paymentDetails.records : [],
        });
        setDecidedFeeInput(
          caseData.paymentDetails.decidedAmount !== undefined
            ? String(caseData.paymentDetails.decidedAmount)
            : ""
        );
      }
    } finally {
      setLoadingPayment(false);
    }
  };

  const loadDetails = async () => {
    setLoading(true);
    try {
      const data = await fetchPhysiotherapyDetails(caseId);
      const detail = data?.data || data;
      setCaseData(detail);
      setNewStatus(detail?.status || "");
      if (detail?.paymentDetails) {
        setPaymentDetails({
          decidedAmount: detail.paymentDetails.decidedAmount ?? 0,
          totalGiven: detail.paymentDetails.totalGiven ?? 0,
          remainingDue: detail.paymentDetails.remainingDue ?? 0,
          status: detail.paymentDetails.status || "Pending",
          records: Array.isArray(detail.paymentDetails.records) ? detail.paymentDetails.records : [],
        });
        setDecidedFeeInput(
          detail.paymentDetails.decidedAmount !== undefined
            ? String(detail.paymentDetails.decidedAmount)
            : ""
        );
      }
    } catch (err) {
      console.error("Error loading case detail:", err);
      Swal.fire("Error", "Could not load physiotherapy case details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDecidedFee = async (e) => {
    if (e) e.preventDefault();
    const feeNum = Number(decidedFeeInput);
    if (isNaN(feeNum) || feeNum < 0) {
      return Swal.fire("Validation Error", "Please enter a valid amount", "warning");
    }

    setSavingDecidedFee(true);
    try {
      const res = await setPhysiotherapyDecidedAmount(caseId, feeNum);
      Swal.fire({
        icon: "success",
        title: "Decided Fee Saved",
        text: res?.message || "Case decided payment amount updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      setIsEditingDecidedFee(false);
      await loadPaymentDetails(caseId);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error("Save decided fee error:", err);
      Swal.fire(
        "Error",
        typeof err === "string" ? err : err?.response?.data?.message || err?.message || "Failed to update decided fee",
        "error"
      );
    } finally {
      setSavingDecidedFee(false);
    }
  };

  const handleAddPaymentRecord = async (e) => {
    if (e) e.preventDefault();
    const amt = Number(paymentForm.amountGiven);
    if (!amt || amt <= 0) {
      return Swal.fire("Validation Error", "Please enter a valid amount greater than 0", "warning");
    }
    if (!paymentForm.dateGiven) {
      return Swal.fire("Validation Error", "Please select the date payment was given", "warning");
    }

    setAddingPayment(true);
    try {
      const payload = {
        amountGiven: amt,
        dateGiven: paymentForm.dateGiven,
        details: paymentForm.details.trim(),
        givenBy: paymentForm.givenBy.trim() || localStorage.getItem("name") || "Admin",
      };
      const res = await addPhysiotherapyPaymentRecord(caseId, payload);
      Swal.fire({
        icon: "success",
        title: "Payment Recorded",
        text: res?.message || "Payment record added successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      setPaymentForm({
        amountGiven: "",
        dateGiven: new Date().toISOString().split("T")[0],
        details: "",
        givenBy: localStorage.getItem("name") || "Admin / Accounts",
      });
      await loadPaymentDetails(caseId);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error("Add payment record error:", err);
      Swal.fire(
        "Error",
        typeof err === "string" ? err : err?.response?.data?.message || err?.message || "Failed to record payment",
        "error"
      );
    } finally {
      setAddingPayment(false);
    }
  };

  const handleDeletePaymentRecord = async (recordId) => {
    const result = await Swal.fire({
      title: "Delete Payment Record?",
      text: "Are you sure you want to remove this payment entry? The balance and status will be updated accordingly.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
    });

    if (!result.isConfirmed) return;

    setDeletingRecordId(recordId);
    try {
      const res = await deletePhysiotherapyPaymentRecord(caseId, recordId);
      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: res?.message || "Payment record removed successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      await loadPaymentDetails(caseId);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error("Delete payment record error:", err);
      Swal.fire(
        "Error",
        typeof err === "string" ? err : err?.response?.data?.message || err?.message || "Failed to delete payment record",
        "error"
      );
    } finally {
      setDeletingRecordId(null);
    }
  };

  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.noteText.trim()) return;

    setAddingNote(true);
    try {
      await addPhysiotherapyNote(caseId, {
        noteText: newNote.noteText.trim(),
        noteType: newNote.noteType,
        author: "Dr. Admin / Physiotherapist",
      });
      setNewNote({ noteText: "", noteType: "Progress" });
      await loadDetails();
      Swal.fire({
        title: "Note Added",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", typeof err === "string" ? err : "Failed to add clinical note", "error");
    } finally {
      setAddingNote(false);
    }
  };

  const handleStatusChangeSubmit = async (e) => {
    e.preventDefault();
    if (!newStatus) return;

    setUpdatingStatus(true);
    try {
      await updatePhysiotherapyStatus(caseId, newStatus, statusNotes.trim());
      Swal.fire("Status Updated", `Case status changed to ${newStatus}`, "success");
      await loadDetails();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      Swal.fire("Error", typeof err === "string" ? err : "Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDocUploadSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      return Swal.fire("File Required", "Please choose a file to upload", "warning");
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("documentName", newDocName.trim() || "Physiotherapy Document");
      selectedFiles.forEach((file) => {
        formData.append("documents", file);
      });

      await uploadPhysiotherapyDocuments(caseId, formData);
      Swal.fire("Success", "Documents uploaded successfully", "success");
      setNewDocName("");
      setSelectedFiles([]);
      await loadDetails();
    } catch (err) {
      Swal.fire("Error", typeof err === "string" ? err : "Failed to upload document", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  const isImageFile = (docOrPath) => {
    if (!docOrPath) return false;
    const raw =
      typeof docOrPath === "string"
        ? docOrPath
        : docOrPath?.fileName ||
          docOrPath?.filename ||
          docOrPath?.file ||
          docOrPath?.filePath ||
          docOrPath?.url ||
          docOrPath?.name ||
          "";
    return /\.(jpe?g|png|webp|gif|bmp|svg|jfif|avif)$/i.test(String(raw).split("?")[0]);
  };

  const isPdfFile = (docOrPath) => {
    if (!docOrPath) return false;
    const raw =
      typeof docOrPath === "string"
        ? docOrPath
        : docOrPath?.fileName ||
          docOrPath?.filename ||
          docOrPath?.file ||
          docOrPath?.filePath ||
          docOrPath?.url ||
          docOrPath?.name ||
          "";
    return /\.pdf$/i.test(String(raw).split("?")[0]);
  };

  const getFileUrl = (docOrPath) => {
    if (!docOrPath) return "";

    const rawPath =
      typeof docOrPath === "string"
        ? docOrPath
        : (docOrPath?.file ||
          docOrPath?.filePath ||
          docOrPath?.filepath ||
          docOrPath?.fileUrl ||
          docOrPath?.file_url ||
          docOrPath?.path ||
          docOrPath?.url ||
          docOrPath?.document ||
          docOrPath?.documentUrl ||
          docOrPath?.fileName ||
          docOrPath?.filename ||
          docOrPath?.attachment ||
          docOrPath?.location ||
          (typeof docOrPath?.name === "string" && /\.(pdf|jpg|jpeg|png|webp|gif|docx?|xlsx?)$/i.test(docOrPath.name) ? docOrPath.name : "") ||
          "");

    if (!rawPath || typeof rawPath !== "string") return "";
    const trimmed = rawPath.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined" || trimmed === "#") return "";

    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:")
    ) {
      return trimmed;
    }

    const cleanPath = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
    const base = (imageUrl || "").endsWith("/") ? imageUrl : `${imageUrl || ""}/`;
    if (cleanPath.startsWith("uploads/") || cleanPath.startsWith("public/")) {
      return `${base}${cleanPath}`;
    }
    return `${base}uploads/${cleanPath}`;
  };

  const handleOpenDoc = (e, doc) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const url = getFileUrl(doc);
    if (url) {
      if (isImageFile(doc) || isImageFile(url)) {
        const title = doc?.documentName || doc?.fileName || doc?.name || "Image Preview";
        const clean = (typeof doc === "string" ? doc : (doc?.fileName || doc?.file || doc?.filePath || "")).replace(/^\/+/, "");
        const fallbackUrl = (imageUrl || "").endsWith("/") ? `${imageUrl}${clean}` : `${imageUrl}/${clean}`;
        setLightboxImg({ url, title, fallbackUrl });
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      Swal.fire({
        icon: "warning",
        title: "File Not Available",
        text: "The document file URL could not be found or is invalid.",
      });
    }
  };

  const completed = caseData?.completedSessions || 0;
  const prescribed = caseData?.prescribedSessions || 1;
  const progressPercent = Math.min(100, Math.round((completed / prescribed) * 100));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      className="physio-detail-dialog"
      scroll="paper"
      disableAutoFocus
      disableRestoreFocus
      PaperProps={{
        style: {
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "92vh",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        },
      }}
    >
      {/* Sticky Branded Navy Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#ffffff",
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            <i className="fa-solid fa-heart-pulse" />
          </div>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "17px", letterSpacing: "-0.01em" }}>
              {caseData?.patientName || "Patient"} - Physiotherapy Case Record
            </h5>
            <small style={{ color: "rgba(255,255,255,0.75)", fontSize: "12.5px" }}>
              Patient ID: <strong>{caseData?.patientId}</strong> | Category:{" "}
              <strong>{caseData?.category}</strong> | Priority:{" "}
              <span className="badge bg-secondary text-white ms-1">{caseData?.priority}</span>
            </small>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-primary d-flex align-items-center gap-1 shadow-sm fw-bold"
            style={{ borderRadius: "8px", fontSize: "13px", padding: "6px 14px", backgroundColor: "#0284c7", borderColor: "#0284c7" }}
            onClick={() => setEditCaseModalOpen(true)}
          >
            <i className="fa fa-pencil" /> Edit Case
          </button>
          <button
            type="button"
            className="btn btn-success d-flex align-items-center gap-1 shadow-sm fw-bold"
            style={{ borderRadius: "8px", fontSize: "13px", padding: "6px 14px" }}
            onClick={() => {
              if (onOpenLogSession && caseData) {
                onOpenLogSession(caseData);
              } else {
                setEditingSession(null);
                setLocalSessionModalOpen(true);
              }
            }}
          >
            <i className="fa fa-plus-circle" /> Log Session
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
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
      </div>

      {/* Scrollable Modal Body */}
      <DialogContent
        ref={contentRef}
        style={{
          overflowY: "auto",
          padding: "20px 24px",
          backgroundColor: "#f8fafc",
        }}
      >
        {loading && !caseData ? (
          <div className="text-center py-5">
            <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2" />
            <p className="text-muted">Loading case details...</p>
          </div>
        ) : !caseData ? (
          <div className="text-center py-5 text-muted">Case not found</div>
        ) : (
          <div>
            {/* Top Case Summary Card */}
            <div
              className="card mb-3 border-0 shadow-sm"
              style={{ borderRadius: "12px", background: "#ffffff" }}
            >
              <div className="card-body p-3">
                <div className="row g-3 align-items-center">
                  <div className="col-md-7">
                    <h6 className="fw-bold text-primary mb-1" style={{ fontSize: "15px" }}>
                      {formatDiseaseName(caseData.clinicalDiagnosis) || "Physiotherapy Rehab"}
                    </h6>
                    <p className="text-muted small mb-2">
                      {caseData.referralReason || "No specific referral complaint provided."}
                    </p>
                    <div className="d-flex flex-wrap gap-3 small text-muted">
                      <span>
                        <i className="fa fa-map-marker text-danger me-1" />
                        Area: <strong>{caseData.affectedBodyPart || "General"}</strong>
                      </span>
                      <span>
                        <i className="fa fa-user-md text-info me-1" />
                        Therapist: <strong>{caseData.assignedPhysiotherapist?.name || "Unassigned"}</strong>
                      </span>
                      <span>
                        <i className="fa fa-repeat text-success me-1" />
                        Frequency: <strong>{caseData.sessionFrequency || "As needed"}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="col-md-5 border-start ps-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small fw-semibold text-dark">
                        Rehabilitation Progress:
                      </span>
                      <span className="badge bg-primary fw-bold">
                        {completed} / {prescribed} Sessions ({progressPercent}%)
                      </span>
                    </div>
                    <div className="progress mb-2" style={{ height: "8px" }}>
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="d-flex justify-content-between small text-muted">
                      <span>Status: <strong className="text-dark">{caseData.status}</strong></span>
                      <span>Baseline Pain: <strong>{caseData.initialAssessment?.baselinePainScore ?? "N/A"}/10</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mb-3 gap-2">
              <li className="nav-item">
                <button
                  className={`btn btn-sm ${activeTab === "sessions" ? "btn-primary shadow-sm" : "btn-light border"}`}
                  style={{ borderRadius: "8px", fontWeight: "600", padding: "6px 14px" }}
                  onClick={() => setActiveTab("sessions")}
                >
                  <i className="fa fa-list-check me-1" /> Sessions ({caseData.sessions?.length || 0})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`btn btn-sm ${activeTab === "notes" ? "btn-primary shadow-sm" : "btn-light border"}`}
                  style={{ borderRadius: "8px", fontWeight: "600", padding: "6px 14px" }}
                  onClick={() => setActiveTab("notes")}
                >
                  <i className="fa fa-notes-medical me-1" /> Clinical Notes ({caseData.clinicalNotes?.length || 0})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`btn btn-sm ${activeTab === "documents" ? "btn-primary shadow-sm" : "btn-light border"}`}
                  style={{ borderRadius: "8px", fontWeight: "600", padding: "6px 14px" }}
                  onClick={() => setActiveTab("documents")}
                >
                  <i className="fa fa-folder-open me-1" /> Documents ({caseData.documents?.length || 0})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`btn btn-sm ${activeTab === "status" ? "btn-primary shadow-sm" : "btn-light border"}`}
                  style={{ borderRadius: "8px", fontWeight: "600", padding: "6px 14px" }}
                  onClick={() => setActiveTab("status")}
                >
                  <i className="fa fa-sliders me-1" /> Case Status & Objectives
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`btn btn-sm ${activeTab === "payments" ? "btn-primary shadow-sm" : "btn-light border"}`}
                  style={{ borderRadius: "8px", fontWeight: "600", padding: "6px 14px" }}
                  onClick={() => {
                    setActiveTab("payments");
                    loadPaymentDetails(caseId);
                  }}
                >
                  <i className="fa fa-credit-card me-1" /> Fee & Payments
                  {paymentDetails.status && (
                    <span
                      className={`badge ms-1.5 ${
                        paymentDetails.status === "Completed"
                          ? "bg-success text-white"
                          : paymentDetails.status === "Partial"
                          ? "bg-warning text-dark"
                          : "bg-secondary text-white"
                      }`}
                      style={{ fontSize: "10.5px" }}
                    >
                      {paymentDetails.status}
                    </span>
                  )}
                </button>
              </li>
            </ul>

            {/* Tab 1: Sessions List */}
            {activeTab === "sessions" && (
              <div>
                {!caseData.sessions || caseData.sessions.length === 0 ? (
                  <div className="card border-0 shadow-sm text-center py-5" style={{ borderRadius: "12px" }}>
                    <i className="fa fa-calendar-times-o fa-3x text-muted mb-2" />
                    <h6 className="text-dark fw-bold">No sessions logged yet</h6>
                    <p className="text-muted small">
                      Start tracking physiotherapy by recording the patient's first session.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="btn btn-sm btn-success px-3"
                        onClick={() => onOpenLogSession && onOpenLogSession(caseData)}
                      >
                        <i className="fa fa-plus me-1" /> Record Session #1
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {caseData.sessions.map((sess, idx) => {
                      const activeAttachments = filterActiveSessionAttachments(
                        sess.attachments,
                        sess,
                        caseData?._id
                      );
                      return (
                        <div
                          key={sess._id || idx}
                          className="card border-0 shadow-sm"
                          style={{ borderRadius: "12px" }}
                        >
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary px-2 py-1">
                                  Session #{sess.sessionNumber || idx + 1}
                                </span>
                                <span className="fw-bold text-dark">
                                  {sess.sessionDate ? new Date(sess.sessionDate).toLocaleDateString() : "No Date"}
                                </span>
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-light text-dark border">
                                  Pain: {sess.painLevelBefore ?? "-"} → {sess.painLevelAfter ?? "-"} / 10
                                </span>
                                <span
                                  className={`badge ${sess.status === "Completed"
                                      ? "bg-success"
                                      : sess.status === "Missed"
                                        ? "bg-danger"
                                        : "bg-warning text-dark"
                                    }`}
                                >
                                  {sess.status}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm py-0 px-2 d-flex align-items-center gap-1 ms-1"
                                  style={{ fontSize: "11.5px", borderRadius: "6px" }}
                                  onClick={() => {
                                    setEditingSession({
                                      ...sess,
                                      attachments: activeAttachments,
                                    });
                                    setLocalSessionModalOpen(true);
                                  }}
                                  title="Edit Session Details"
                                >
                                  <i className="fa fa-pencil" /> Edit
                                </button>
                              </div>
                            </div>

                          {sess.modalitiesUsed && sess.modalitiesUsed.length > 0 && (
                            <div className="mb-2 d-flex flex-wrap gap-1">
                              {sess.modalitiesUsed.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="badge bg-light text-primary border"
                                  style={{ fontSize: "11px" }}
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}

                          {((sess.exercises && sess.exercises.length > 0) || (sess.exercisesPerformed && sess.exercisesPerformed.length > 0)) && (
                            <div className="small text-muted mb-2">
                              <strong>Exercises:</strong>{" "}
                              {(sess.exercises && sess.exercises.length > 0 ? sess.exercises : sess.exercisesPerformed || [])
                                .map((e) => {
                                  if (typeof e === "string") return e;
                                  const name = e.exerciseName || e.name || "Exercise";
                                  const reps = e.repetitions || e.reps || 10;
                                  const hold = e.hold || (e.holdTimeSeconds ? `${e.holdTimeSeconds}s` : "");
                                  const repeatStr = e.repeat || e.frequency ? `, repeat: ${e.repeat || e.frequency}` : "";
                                  const note = e.notes ? ` — ${e.notes}` : "";
                                  return `${name} (${e.sets || 3}x${reps}${hold ? ` hold ${hold}` : ""}${repeatStr})${note}`;
                                })
                                .join(", ")}
                            </div>
                          )}

                          {sess.exerciseNotes && (
                            <div className="small text-muted mb-2">
                              <strong>Exercise notes:</strong> {sess.exerciseNotes}
                            </div>
                          )}

                          {sess.progressRemarks && (
                            <div className="p-2 rounded bg-light small text-dark">
                              <strong>Remarks:</strong> {sess.progressRemarks}
                            </div>
                          )}

                          {activeAttachments && activeAttachments.length > 0 && (
                            <div className="mt-2.5 pt-2 border-top">
                              <div
                                className="text-muted fw-bold small mb-2 d-flex align-items-center gap-1.5"
                                style={{ fontSize: "11px", letterSpacing: "0.2px" }}
                              >
                                <span
                                  className="d-inline-flex align-items-center justify-content-center"
                                  style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "5px",
                                    backgroundColor: "#e0f2fe",
                                    color: "#0284c7",
                                    fontSize: "10px",
                                  }}
                                >
                                  <i className="fa-solid fa-paperclip" />
                                </span>
                                <span>Session Attachments ({activeAttachments.length}):</span>
                              </div>
                              <div className="d-flex flex-wrap gap-2 align-items-center">
                                {activeAttachments.map((att, aIdx) => {
                                  const fileUrl = getFileUrl(att);
                                  const fileName = att.documentName || att.fileName || att.name || `Attachment ${aIdx + 1}`;
                                  const isImg = isImageFile(att) || isImageFile(fileUrl);
                                  const isPdf = isPdfFile(att) || isPdfFile(fileUrl);
                                  const clean = (typeof att === "string" ? att : (att.fileName || att.file || att.filePath || "")).replace(/^\/+/, "");
                                  const fallbackUrl = (imageUrl || "").endsWith("/") ? `${imageUrl}${clean}` : `${imageUrl}/${clean}`;

                                  if (isImg && fileUrl) {
                                    return (
                                      <div
                                        key={aIdx}
                                        className="border rounded p-1.5 bg-white shadow-sm d-flex align-items-center gap-2"
                                        style={{
                                          cursor: "pointer",
                                          borderRadius: "9px",
                                          transition: "all 0.15s ease",
                                          borderColor: "#e2e8f0",
                                        }}
                                        onClick={() => setLightboxImg({ url: fileUrl, title: fileName, fallbackUrl })}
                                        title="Click to view photo in full size"
                                      >
                                        <img
                                          src={fileUrl}
                                          alt={fileName}
                                          style={{
                                            width: "42px",
                                            height: "42px",
                                            objectFit: "cover",
                                            borderRadius: "7px",
                                            backgroundColor: "#f8fafc",
                                            display: "block",
                                            border: "1px solid #e2e8f0",
                                          }}
                                          onError={(e) => {
                                            if (!e.target.dataset.tried) {
                                              e.target.dataset.tried = "true";
                                              e.target.src = fallbackUrl;
                                            }
                                          }}
                                        />
                                        <div style={{ maxWidth: "140px", fontSize: "11.5px", lineHeight: "1.25" }}>
                                          <span className="d-block text-truncate fw-semibold text-dark">{fileName}</span>
                                          <span className="text-success fw-bold d-inline-flex align-items-center gap-1 mt-0.5" style={{ fontSize: "10px" }}>
                                            <i className="fa-solid fa-expand" /> View Photo
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (isPdf) {
                                    return (
                                      <a
                                        key={aIdx}
                                        href={fileUrl || "#"}
                                        onClick={(e) => handleOpenDoc(e, att)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="border rounded p-1.5 bg-white shadow-sm d-flex align-items-center gap-2 text-decoration-none"
                                        style={{
                                          borderRadius: "9px",
                                          borderColor: "#e2e8f0",
                                          transition: "all 0.15s ease",
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: "42px",
                                            height: "42px",
                                            borderRadius: "7px",
                                            backgroundColor: "#fee2e2",
                                            color: "#dc2626",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            border: "1px solid #fecaca",
                                          }}
                                        >
                                          <i className="fa-solid fa-file-pdf" style={{ fontSize: "16px" }} />
                                          <span style={{ fontSize: "8px", fontWeight: "800", marginTop: "1px" }}>PDF</span>
                                        </div>
                                        <div style={{ maxWidth: "140px", fontSize: "11.5px", lineHeight: "1.25" }}>
                                          <span className="d-block text-truncate fw-semibold text-dark">{fileName}</span>
                                          <span className="text-primary fw-bold d-inline-flex align-items-center gap-1 mt-0.5" style={{ fontSize: "10px" }}>
                                            <i className="fa-solid fa-arrow-up-right-from-square" /> Open PDF
                                          </span>
                                        </div>
                                      </a>
                                    );
                                  }

                                  return (
                                    <a
                                      key={aIdx}
                                      href={fileUrl || "#"}
                                      onClick={(e) => handleOpenDoc(e, att)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="border rounded p-1.5 bg-white shadow-sm d-flex align-items-center gap-2 text-decoration-none"
                                      style={{
                                        borderRadius: "9px",
                                        borderColor: "#e2e8f0",
                                        transition: "all 0.15s ease",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: "42px",
                                          height: "42px",
                                          borderRadius: "7px",
                                          backgroundColor: "#e0f2fe",
                                          color: "#0284c7",
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          border: "1px solid #bae6fd",
                                        }}
                                      >
                                        <i className="fa-solid fa-file-lines" style={{ fontSize: "16px" }} />
                                        <span style={{ fontSize: "8px", fontWeight: "800", marginTop: "1px" }}>DOC</span>
                                      </div>
                                      <div style={{ maxWidth: "140px", fontSize: "11.5px", lineHeight: "1.25" }}>
                                        <span className="d-block text-truncate fw-semibold text-dark">{fileName}</span>
                                        <span className="text-primary fw-bold d-inline-flex align-items-center gap-1 mt-0.5" style={{ fontSize: "10px" }}>
                                          <i className="fa-solid fa-arrow-up-right-from-square" /> Open File
                                        </span>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Clinical Notes */}
            {activeTab === "notes" && (
              <div>
                <form onSubmit={handleAddNoteSubmit} className="card border-0 shadow-sm p-3 mb-3" style={{ borderRadius: "12px" }}>
                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "14px" }}>Add Clinical Note</h6>
                  <div className="row g-2 align-items-end">
                    <div className="col-md-3">
                      <select
                        className="form-select form-select-sm"
                        value={newNote.noteType}
                        onChange={(e) => setNewNote({ ...newNote, noteType: e.target.value })}
                      >
                        <option value="Initial Evaluation">Initial Evaluation</option>
                        <option value="Progress">Progress Note</option>
                        <option value="Reassessment">Reassessment</option>
                        <option value="Discharge Summary">Discharge Summary</option>
                      </select>
                    </div>
                    <div className="col-md-7">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Type clinical observation, doctor's directive, or therapist note..."
                        value={newNote.noteText}
                        onChange={(e) => setNewNote({ ...newNote, noteText: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <button
                        type="submit"
                        className="btn btn-sm btn-primary w-100"
                        disabled={addingNote}
                      >
                        {addingNote ? <i className="fa fa-spinner fa-spin" /> : "Post Note"}
                      </button>
                    </div>
                  </div>
                </form>

                {!caseData.clinicalNotes || caseData.clinicalNotes.length === 0 ? (
                  <div className="card border-0 shadow-sm text-center py-4 text-muted" style={{ borderRadius: "12px" }}>
                    No clinical notes recorded yet.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {caseData.clinicalNotes.map((note, idx) => (
                      <div key={note._id || idx} className="card border-0 shadow-sm p-3" style={{ borderRadius: "12px" }}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="badge bg-info text-white">{note.noteType || "Progress"}</span>
                          <small className="text-muted">
                            {(note.date || note.createdAt) ? new Date(note.date || note.createdAt).toLocaleString() : ""}
                          </small>
                        </div>
                        <p className="mb-1 text-dark" style={{ fontSize: "13.5px" }}>{note.note || note.noteText || ""}</p>
                        <small className="text-muted">
                          Author:{" "}
                          {typeof note.author === "object"
                            ? note.author?.name || note.author?.email || "Clinical Staff"
                            : note.author ||
                            (typeof note.addedBy === "object"
                              ? note.addedBy?.name || note.addedBy?.email
                              : note.addedBy) ||
                            "Clinical Staff"}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Documents */}
            {activeTab === "documents" && (
              <div>
                <form onSubmit={handleDocUploadSubmit} className="card border-0 shadow-sm p-3 mb-3" style={{ borderRadius: "12px" }}>
                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "14px" }}>Upload Case Document</h6>
                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Document Name (e.g. Discharge Summary, MRI Report)"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="file"
                        multiple
                        className="form-control form-control-sm"
                        onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                      />
                    </div>
                    <div className="col-md-2">
                      <button
                        type="submit"
                        className="btn btn-sm btn-primary w-100"
                        disabled={uploadingDoc}
                      >
                        {uploadingDoc ? <i className="fa fa-spinner fa-spin" /> : "Upload"}
                      </button>
                    </div>
                  </div>
                </form>

                {(() => {
                  const activeDocuments = filterActiveCaseDocuments(caseData.documents || [], caseId);
                  if (!activeDocuments || activeDocuments.length === 0) {
                    return (
                      <div className="card border-0 shadow-sm text-center py-4 text-muted" style={{ borderRadius: "12px" }}>
                        No documents uploaded for this case.
                      </div>
                    );
                  }

                  return (
                    <div className="row g-3">
                      {activeDocuments.map((doc, idx) => {
                        const fileUrl = getFileUrl(doc);
                      const fileName =
                        doc.documentName ||
                        doc.fileName ||
                        (typeof doc.file === "string" ? doc.file.split("/").pop()?.replace(/^\d+-/, "") : "") ||
                        `Doc ${idx + 1}`;
                      const isImg = isImageFile(doc) || isImageFile(fileUrl);
                      const clean = (typeof doc === "string" ? doc : (doc?.fileName || doc?.file || doc?.filePath || "")).replace(/^\/+/, "");
                      const fallbackUrl = (imageUrl || "").endsWith("/") ? `${imageUrl}${clean}` : `${imageUrl}/${clean}`;

                      return (
                        <div key={doc._id || idx} className="col-md-4">
                          <div className="card border-0 shadow-sm p-3 h-100 d-flex flex-column" style={{ borderRadius: "12px" }}>
                            {isImg && fileUrl ? (
                              <div
                                className="mb-2 text-center rounded overflow-hidden position-relative bg-light border"
                                style={{ height: "130px", cursor: "pointer" }}
                                onClick={() => setLightboxImg({ url: fileUrl, title: fileName, fallbackUrl })}
                                title="Click to view full image"
                              >
                                <img
                                  src={fileUrl}
                                  alt={fileName}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  onError={(e) => {
                                    if (!e.target.dataset.tried) {
                                      e.target.dataset.tried = "true";
                                      e.target.src = fallbackUrl;
                                    }
                                  }}
                                />
                                <div
                                  className="position-absolute bottom-0 start-0 end-0 py-1 text-white text-center fw-bold"
                                  style={{ background: "rgba(0,0,0,0.6)", fontSize: "11px" }}
                                >
                                  <i className="fa-solid fa-expand me-1" /> Click to Expand
                                </div>
                              </div>
                            ) : (
                              <div className="d-flex align-items-center gap-2 mb-2">
                                <i className="fa fa-file-text-o fa-2x text-primary" />
                                <div style={{ overflow: "hidden" }}>
                                  <strong className="text-dark d-block text-truncate" style={{ fontSize: "13px" }}>
                                    {fileName}
                                  </strong>
                                  <small className="text-muted">
                                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}
                                  </small>
                                </div>
                              </div>
                            )}

                            {isImg && (
                              <div className="mb-2">
                                <strong className="text-dark d-block text-truncate" style={{ fontSize: "13px" }}>
                                  {fileName}
                                </strong>
                                <small className="text-muted">
                                  {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}
                                </small>
                              </div>
                            )}

                            <div className="mt-auto pt-2 d-flex align-items-center gap-1.5">
                              {isImg ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1"
                                  style={{ borderRadius: "6px" }}
                                  onClick={() => setLightboxImg({ url: fileUrl, title: fileName, fallbackUrl })}
                                >
                                  <i className="fa-solid fa-eye me-1" /> View Image
                                </button>
                              ) : (
                                <a
                                  href={fileUrl || "#"}
                                  onClick={(e) => handleOpenDoc(e, doc)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1 text-decoration-none"
                                  style={{ borderRadius: "6px" }}
                                >
                                  <i className="fa fa-download me-1" /> View / Download
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center"
                                style={{ borderRadius: "6px", width: "32px", height: "31px", flexShrink: 0 }}
                                title="Remove document"
                                onClick={() => {
                                  Swal.fire({
                                    title: "Remove Document?",
                                    text: `Are you sure you want to remove "${fileName}"?`,
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonColor: "#ef4444",
                                    confirmButtonText: "Yes, Remove",
                                  }).then((res) => {
                                    if (res.isConfirmed) {
                                      markCaseDocumentsRemoved(caseId, [doc]);
                                      loadDetails();
                                      Swal.fire({
                                        title: "Removed!",
                                        text: "Document removed from case record.",
                                        icon: "success",
                                        timer: 1500,
                                        showConfirmButton: false,
                                      });
                                    }
                                  });
                                }}
                              >
                                <i className="fa-solid fa-trash-can" style={{ fontSize: "11px" }} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}
              </div>
            )}

            {/* Tab 4: Status & Objectives */}
            {activeTab === "status" && (
              <div>
                <form onSubmit={handleStatusChangeSubmit} className="card border-0 shadow-sm p-3 mb-3" style={{ borderRadius: "12px" }}>
                  <h6 className="fw-bold text-dark mb-3" style={{ fontSize: "14px" }}>Update Case Workflow Status</h6>
                  <div className="row g-3 align-items-end">
                    <div className="col-md-4">
                      <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>Status</label>
                      <select
                        className="form-select"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        style={{ fontSize: "13.5px" }}
                      >
                        {PHYSIO_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>Status Notes / Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Patient discharged, goals achieved, therapy paused"
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        style={{ fontSize: "13.5px" }}
                      />
                    </div>
                    <div className="col-md-2">
                      <button
                        type="submit"
                        className="btn btn-primary w-100"
                        disabled={updatingStatus}
                        style={{ borderRadius: "8px", fontSize: "13.5px" }}
                      >
                        {updatingStatus ? <i className="fa fa-spinner fa-spin" /> : "Save Status"}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
                  <div className="card-header bg-white fw-bold text-dark border-bottom" style={{ fontSize: "14px" }}>
                    Plan & Clinical Objectives
                  </div>
                  <div className="card-body p-3" style={{ fontSize: "13.5px" }}>
                    <p className="mb-2">
                      <strong>Treatment Goals:</strong> {caseData.treatmentGoals || "Not specified"}
                    </p>
                    <p className="mb-2">
                      <strong>Special Precautions:</strong> {caseData.specialInstructions || "None"}
                    </p>
                    <p className="mb-2">
                      <strong>Initial ROM / Mobility Notes:</strong>{" "}
                      {caseData.initialAssessment?.rangeOfMotionNotes || "No initial notes"}
                    </p>
                    <div className="mb-0">
                      <strong>Therapy / Modalities:</strong>
                      {Array.isArray(caseData.modalitiesUsed) && caseData.modalitiesUsed.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {caseData.modalitiesUsed.map((m, mIdx) => (
                            <span
                              key={mIdx}
                              className="badge bg-light text-primary border"
                              style={{ fontSize: "11px" }}
                            >
                              {typeof m === "string" ? m : m?.name || String(m)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted"> None selected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Case Fee & Payments */}
            {activeTab === "payments" && (
              <div>
                {/* Payment Overview Metric Cards */}
                <div className="row g-3 mb-3">
                  {/* Decided Case Fee */}
                  <div className="col-sm-6 col-lg-3">
                    <div
                      className="card border-0 shadow-sm h-100"
                      style={{
                        borderRadius: "12px",
                        backgroundColor: "#f0f9ff",
                        borderLeft: "4px solid #0284c7",
                      }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted small fw-semibold">Decided Case Fee</span>
                          <i className="fa fa-calculator text-primary fs-5" />
                        </div>
                        <div className="fs-4 fw-bold text-dark">
                          Rs. {Number(paymentDetails.decidedAmount || 0).toLocaleString()}
                        </div>
                        <div className="mt-2">
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-primary py-1 px-2 fw-semibold"
                            style={{ fontSize: "11.5px", borderRadius: "6px" }}
                            onClick={() => setIsEditingDecidedFee(!isEditingDecidedFee)}
                          >
                            <i className="fa fa-pencil me-1" />
                            {paymentDetails.decidedAmount ? "Edit Fee" : "Set Decided Fee"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Given to Therapist */}
                  <div className="col-sm-6 col-lg-3">
                    <div
                      className="card border-0 shadow-sm h-100"
                      style={{
                        borderRadius: "12px",
                        backgroundColor: "#f0fdf4",
                        borderLeft: "4px solid #10b981",
                      }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted small fw-semibold">Total Given</span>
                          <i className="fa fa-check-circle text-success fs-5" />
                        </div>
                        <div className="fs-4 fw-bold text-success">
                          Rs. {Number(paymentDetails.totalGiven || 0).toLocaleString()}
                        </div>
                        <small className="text-muted d-block mt-1">
                          {paymentDetails.records?.length || 0} transaction{paymentDetails.records?.length === 1 ? "" : "s"} logged
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Remaining Due */}
                  <div className="col-sm-6 col-lg-3">
                    <div
                      className="card border-0 shadow-sm h-100"
                      style={{
                        borderRadius: "12px",
                        backgroundColor: (paymentDetails.remainingDue || 0) > 0 ? "#fffbeb" : "#f0fdf4",
                        borderLeft: `4px solid ${(paymentDetails.remainingDue || 0) > 0 ? "#f59e0b" : "#10b981"}`,
                      }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted small fw-semibold">Remaining Due</span>
                          <i className="fa fa-hourglass-half text-warning fs-5" />
                        </div>
                        <div
                          className={`fs-4 fw-bold ${
                            (paymentDetails.remainingDue || 0) > 0 ? "text-warning" : "text-success"
                          }`}
                        >
                          Rs. {Number(paymentDetails.remainingDue || 0).toLocaleString()}
                        </div>
                        <small className="text-muted d-block mt-1">
                          {(paymentDetails.remainingDue || 0) <= 0 && paymentDetails.decidedAmount > 0
                            ? "All dues settled"
                            : "Pending to be paid"}
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="col-sm-6 col-lg-3">
                    <div
                      className="card border-0 shadow-sm h-100"
                      style={{
                        borderRadius: "12px",
                        backgroundColor: "#ffffff",
                        borderLeft: "4px solid #64748b",
                      }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted small fw-semibold">Payment Status</span>
                          <i className="fa fa-credit-card text-secondary fs-5" />
                        </div>
                        <div className="mt-1">
                          <span
                            className={`badge px-3 py-2 fw-bold ${
                              paymentDetails.status === "Completed"
                                ? "bg-success"
                                : paymentDetails.status === "Partial"
                                ? "bg-warning text-dark"
                                : "bg-danger"
                            }`}
                            style={{ fontSize: "13px", borderRadius: "8px" }}
                          >
                            {paymentDetails.status || "Pending"}
                          </span>
                        </div>
                        {paymentDetails.decidedAmount > 0 && (
                          <div className="mt-2">
                            <div className="progress" style={{ height: "6px" }}>
                              <div
                                className="progress-bar bg-success"
                                role="progressbar"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      ((paymentDetails.totalGiven || 0) / (paymentDetails.decidedAmount || 1)) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="text-muted text-end small mt-0.5" style={{ fontSize: "10.5px" }}>
                              {Math.min(
                                100,
                                Math.round(
                                  ((paymentDetails.totalGiven || 0) / (paymentDetails.decidedAmount || 1)) * 100
                                )
                              )}
                              % paid
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline Card to Set / Edit Decided Fee */}
                {(isEditingDecidedFee || (!paymentDetails.decidedAmount && paymentDetails.decidedAmount !== 0)) && (
                  <div
                    className="card mb-3 border-0 shadow-sm"
                    style={{ borderRadius: "12px", backgroundColor: "#f8fafc", border: "1px dashed #0284c7" }}
                  >
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="fw-bold text-primary mb-0" style={{ fontSize: "14px" }}>
                          <i className="fa fa-coins me-1" /> Set Decided Fee for this Case
                        </h6>
                        {paymentDetails.decidedAmount > 0 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-muted p-0"
                            onClick={() => setIsEditingDecidedFee(false)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <form onSubmit={handleSaveDecidedFee} className="row g-2 align-items-center">
                        <div className="col-sm-8 col-md-5">
                          <div className="input-group input-group-sm">
                            <span className="input-group-text fw-semibold bg-white">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="form-control"
                              placeholder="Enter total agreed fee (e.g. 5000)"
                              value={decidedFeeInput}
                              onChange={(e) => setDecidedFeeInput(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <div className="col-auto">
                          <button
                            type="submit"
                            className="btn btn-sm btn-primary fw-semibold"
                            style={{ borderRadius: "6px" }}
                            disabled={savingDecidedFee}
                          >
                            {savingDecidedFee ? (
                              <>
                                <i className="fa fa-spinner fa-spin me-1" /> Saving...
                              </>
                            ) : (
                              <>
                                <i className="fa fa-check me-1" /> Save Decided Fee
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Record Money Given to Therapist Form */}
                <div className="card mb-3 border-0 shadow-sm" style={{ borderRadius: "12px" }}>
                  <div
                    className="card-header bg-white border-bottom fw-bold text-dark d-flex justify-content-between align-items-center"
                    style={{ fontSize: "14px", padding: "12px 16px" }}
                  >
                    <span>
                      <i className="fa fa-money-bill-transfer text-success me-2" />
                      Record Money Given to Physiotherapist
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      style={{ fontSize: "11px" }}
                      onClick={() => loadPaymentDetails(caseId)}
                      title="Refresh payments"
                    >
                      <i className={`fa fa-refresh ${loadingPayment ? "fa-spin" : ""}`} /> Refresh
                    </button>
                  </div>
                  <div className="card-body p-3">
                    <form onSubmit={handleAddPaymentRecord}>
                      <div className="row g-3">
                        <div className="col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Amount Given (Rs) <span className="text-danger">*</span>
                          </label>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light">Rs.</span>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              className="form-control"
                              placeholder="e.g. 2000"
                              required
                              value={paymentForm.amountGiven}
                              onChange={(e) =>
                                setPaymentForm({ ...paymentForm, amountGiven: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Date Given <span className="text-danger">*</span>
                          </label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            required
                            value={paymentForm.dateGiven}
                            onChange={(e) =>
                              setPaymentForm({ ...paymentForm, dateGiven: e.target.value })
                            }
                          />
                        </div>

                        <div className="col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Given By (Admin / Staff)
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Accounts / Admin"
                            value={paymentForm.givenBy}
                            onChange={(e) =>
                              setPaymentForm({ ...paymentForm, givenBy: e.target.value })
                            }
                          />
                        </div>

                        <div className="col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Payment Details / Method
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Cash, GPay, Bank transfer"
                            value={paymentForm.details}
                            onChange={(e) =>
                              setPaymentForm({ ...paymentForm, details: e.target.value })
                            }
                          />
                        </div>

                        <div className="col-12 text-end">
                          <button
                            type="submit"
                            className="btn btn-sm btn-success fw-semibold px-4"
                            style={{ borderRadius: "8px" }}
                            disabled={addingPayment}
                          >
                            {addingPayment ? (
                              <>
                                <i className="fa fa-spinner fa-spin me-1" /> Recording...
                              </>
                            ) : (
                              <>
                                <i className="fa fa-plus-circle me-1" /> Record Payment
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Payment History Table */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
                  <div
                    className="card-header bg-white border-bottom fw-bold text-dark d-flex justify-content-between align-items-center"
                    style={{ fontSize: "14px", padding: "12px 16px" }}
                  >
                    <span>
                      <i className="fa fa-history text-primary me-2" />
                      Payment History ({paymentDetails.records?.length || 0} Records)
                    </span>
                  </div>
                  <div className="card-body p-0">
                    {!paymentDetails.records || paymentDetails.records.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                        <i className="fa fa-receipt fa-3x mb-2 text-secondary" style={{ opacity: 0.5 }} />
                        <h6 className="fw-semibold text-dark">No payment records logged yet</h6>
                        <p className="small text-muted mb-0">
                          Use the form above to record payments given to the physiotherapist for this case.
                        </p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: "50px" }}>#</th>
                              <th>Date Given</th>
                              <th>Amount Given</th>
                              <th>Given By</th>
                              <th>Details / Notes</th>
                              <th>Logged At</th>
                              <th style={{ width: "90px" }} className="text-center">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentDetails.records.map((rec, rIdx) => {
                              const recordId = rec._id || rec.id || rIdx;
                              const isDeleting = deletingRecordId === recordId;
                              return (
                                <tr key={recordId}>
                                  <td className="text-muted">{rIdx + 1}</td>
                                  <td className="fw-semibold text-dark">
                                    <i className="fa fa-calendar-check-o text-muted me-1" />
                                    {rec.dateGiven
                                      ? new Date(rec.dateGiven).toLocaleDateString()
                                      : "—"}
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        backgroundColor: "#dcfce7",
                                        color: "#15803d",
                                        border: "1px solid #bbf7d0",
                                        borderRadius: "6px",
                                        padding: "3px 8px",
                                        fontSize: "13px",
                                        fontWeight: 700,
                                        display: "inline-block",
                                      }}
                                    >
                                      Rs. {Number(rec.amountGiven || 0).toLocaleString()}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="text-dark">
                                      <i className="fa fa-user-circle text-muted me-1" />
                                      {rec.givenBy || "Admin"}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="text-muted">
                                      {rec.details || "—"}
                                    </span>
                                  </td>
                                  <td className="small text-muted">
                                    {rec.createdAt
                                      ? new Date(rec.createdAt).toLocaleDateString()
                                      : "—"}
                                  </td>
                                  <td className="text-center">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger py-1 px-2"
                                      style={{ borderRadius: "6px", fontSize: "12px" }}
                                      title="Delete payment record"
                                      disabled={isDeleting}
                                      onClick={() => handleDeletePaymentRecord(rec._id || rec.id)}
                                    >
                                      {isDeleting ? (
                                        <i className="fa fa-spinner fa-spin" />
                                      ) : (
                                        <i className="fa fa-trash-o" />
                                      )}
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
              </div>
            )}
          </div>
        )}
      </DialogContent>

      {/* Sticky Action Footer */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "14px 24px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="btn btn-light px-4 border fw-semibold"
          style={{ borderRadius: "8px", fontSize: "13.5px" }}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Edit Case Modal */}
      <ReferralModal
        open={editCaseModalOpen}
        onClose={() => setEditCaseModalOpen(false)}
        editCase={caseData}
        onSuccess={() => {
          loadDetails();
          if (onStatusUpdated) onStatusUpdated();
        }}
      />

      {/* Log / Edit Session Modal */}
      <SessionModal
        open={localSessionModalOpen}
        onClose={() => {
          setLocalSessionModalOpen(false);
          setEditingSession(null);
        }}
        physioCase={caseData}
        editingSession={editingSession}
        onSuccess={() => {
          loadDetails();
          if (onStatusUpdated) onStatusUpdated();
        }}
      />

      {/* Photo Lightbox Modal */}
      {lightboxImg && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setLightboxImg(null)}
        >
          <div
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              style={{
                position: "absolute",
                top: "-16px",
                right: "-16px",
                background: "#ef4444",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                zIndex: 1,
              }}
              title="Close image"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <img
              src={lightboxImg.url}
              alt={lightboxImg.title || "Full Preview"}
              style={{
                maxWidth: "100%",
                maxHeight: "82vh",
                borderRadius: "10px",
                display: "block",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                margin: "0 auto",
                backgroundColor: "#000",
              }}
              onError={(e) => {
                if (!e.target.dataset.tried && lightboxImg.fallbackUrl) {
                  e.target.dataset.tried = "true";
                  e.target.src = lightboxImg.fallbackUrl;
                }
              }}
            />
            {lightboxImg.title && (
              <div className="text-white text-center mt-2 fw-semibold" style={{ fontSize: "14px" }}>
                {lightboxImg.title}
              </div>
            )}
            <div className="mt-2 d-flex justify-content-center gap-2">
              <a
                href={lightboxImg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-light px-3"
                style={{ borderRadius: "20px", fontSize: "12px" }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square me-1" /> Open in New Tab
              </a>
              <a
                href={lightboxImg.url}
                download
                className="btn btn-sm btn-primary px-3"
                style={{ borderRadius: "20px", fontSize: "12px" }}
              >
                <i className="fa-solid fa-download me-1" /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
