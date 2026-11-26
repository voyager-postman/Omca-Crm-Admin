import React, { useState, useEffect, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Swal from "sweetalert2";
import {
  fetchPhysiotherapyStaff,
  assignPatientToPhysiotherapist,
  unassignPatientFromPhysiotherapist,
  formatDiseaseName,
} from "../../../services/physiotherapyApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

const isPartner = () => isReferralUser() || isInsuranceUser();

export default function AssignPhysiotherapistModal({
  open,
  onClose,
  patient,
  existingAssignment,
  onSuccess,
}) {
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [physioStaff, setPhysioStaff] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [staffTab, setStaffTab] = useState("physio"); // "physio" | "all"
  const [selectedTherapistId, setSelectedTherapistId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const patientId =
    patient?.patientId ||
    patient?.patientNumber ||
    patient?._id ||
    patient?.id ||
    "";
  const patientName =
    patient?.patient_name ||
    patient?.name ||
    "Patient";
  const patientCountry =
    patient?.country ||
    patient?.treatingIn ||
    "";
  const patientDisease = formatDiseaseName(
    patient?.disease ||
      patient?.patient_disease ||
      patient?.disease_name ||
      existingAssignment?.clinicalDiagnosis ||
      ""
  );

  const currentAssigned = useMemo(() => {
    return (
      existingAssignment?.assignedPhysiotherapist ||
      patient?.assignedPhysiotherapist ||
      (existingAssignment?.userId || existingAssignment?.name
        ? existingAssignment
        : null)
    );
  }, [existingAssignment, patient]);

  useEffect(() => {
    if (open) {
      if (isPartner()) {
        onClose();
        return;
      }
      loadStaffList();
      const currentId =
        currentAssigned?.userId ||
        currentAssigned?._id ||
        currentAssigned?.id ||
        "";
      setSelectedTherapistId(currentId ? String(currentId) : "");
      setSearchQuery("");
      setStaffTab("physio");
    }
  }, [open, currentAssigned, onClose]);

  const loadStaffList = async () => {
    setLoadingStaff(true);
    try {
      const res = await fetchPhysiotherapyStaff();
      const pStaff = res?.physioStaff || res?.data || [];
      const aStaff = res?.allStaff || [];
      setPhysioStaff(pStaff);
      setAllStaff(aStaff);

      if (pStaff.length === 0 && aStaff.length > 0) {
        setStaffTab("all");
      }
    } catch (err) {
      console.error("Failed to load physiotherapists:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to Load Physiotherapists",
        text:
          typeof err === "string"
            ? err
            : err?.response?.data?.message ||
              err?.message ||
              "Could not retrieve physiotherapists list.",
      });
    } finally {
      setLoadingStaff(false);
    }
  };

  const currentList = useMemo(() => {
    return staffTab === "physio" ? physioStaff : allStaff;
  }, [staffTab, physioStaff, allStaff]);

  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter((s) => {
      const name = String(s.name || "").toLowerCase();
      const email = String(s.email || "").toLowerCase();
      const role = String(s.role || "").toLowerCase();
      const phone = String(s.phone || s.phone_no || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        phone.includes(q)
      );
    });
  }, [currentList, searchQuery]);

  const handleAssign = async () => {
    if (isPartner()) return;
    if (!selectedTherapistId) {
      Swal.fire({
        icon: "warning",
        title: "Select a Physiotherapist",
        text: "Please select a physiotherapist to assign.",
      });
      return;
    }

    const allSource = allStaff.length > 0 ? allStaff : physioStaff;
    const selectedTherapist = allSource.find(
      (s) =>
        String(s.userId || s._id || s.id || s.staffId) ===
        String(selectedTherapistId)
    );
    const therapistName = selectedTherapist?.name || "the physiotherapist";

    const confirm = await Swal.fire({
      title:
        currentAssigned?.userId || currentAssigned?.name
          ? "Reassign Physiotherapist?"
          : "Assign Physiotherapist?",
      text: `Assign ${therapistName} to patient ${patientName} (${patientId})?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0284c7",
      confirmButtonText: "Yes, Assign",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await assignPatientToPhysiotherapist({
        patient,
        therapist: selectedTherapist,
        clinicalDiagnosis: patientDisease || "Physiotherapy Rehabilitation",
      });

      Swal.fire({
        icon: "success",
        title: "Assigned Successfully",
        text: `${patientName} has been assigned to ${therapistName} for Physiotherapy.`,
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess(res?.therapist || selectedTherapist, patientId);
      }
      onClose();
    } catch (err) {
      console.error("Assign error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to assign physiotherapist";
      Swal.fire({
        icon: "error",
        title: "Assignment Failed",
        text: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (isPartner()) return;
    const confirm = await Swal.fire({
      title: "Unassign Physiotherapist?",
      text: `Are you sure you want to remove the physiotherapist assignment from ${patientName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Unassign",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    setUnassigning(true);
    try {
      await unassignPatientFromPhysiotherapist({
        patient,
        patientId: patient?.patientNumber || patient?.patientId || patient?._id,
        patientObjectId: patient?._id,
        notes: "Physiotherapist unassigned",
      });

      Swal.fire({
        icon: "success",
        title: "Physiotherapist Removed",
        text: "Physiotherapist has been unassigned successfully.",
        timer: 1800,
        showConfirmButton: false,
      });

      setSelectedTherapistId("");
      if (onSuccess) {
        onSuccess(null, patientId);
      }
      onClose();
    } catch (err) {
      console.error("Unassign error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to unassign physiotherapist";
      Swal.fire({
        icon: "error",
        title: "Unassign Failed",
        text: msg,
      });
    } finally {
      setUnassigning(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !submitting && !unassigning && onClose()}
      fullWidth
      maxWidth="md"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 48px)",
          height: { xs: "94vh", sm: "88vh", md: "84vh" },
          overflow: "hidden",
          margin: { xs: "8px", sm: "16px" },
        },
      }}
    >
      {/* HEADER */}
      <DialogTitle
        style={{
          background: "linear-gradient(135deg, #0ba6df 0%, #0284c7 100%)",
          color: "#ffffff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i
              className="fa-solid fa-person-walking"
              style={{ fontSize: "18px" }}
            ></i>
          </div>
          <div>
            <h5
              style={{
                margin: 0,
                fontWeight: "600",
                fontSize: "17px",
                color: "#fff",
              }}
            >
              Physiotherapist Assignment & Care
            </h5>
            <small
              style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: "12px" }}
            >
              Assign a dedicated physiotherapist to manage this patient
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting || unassigning}
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            fontSize: "20px",
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px",
          }}
        >
          &times;
        </button>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          padding: "14px 20px",
          backgroundColor: "#f8fafc",
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { background: "#f1f5f9" },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#cbd5e1", borderRadius: "6px" },
          "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#94a3b8" },
        }}
      >
        {/* PATIENT SUMMARY CARD */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            marginBottom: "18px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  style={{
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                  }}
                >
                  {patientId || "N/A"}
                </span>
                <h6
                  style={{
                    margin: 0,
                    fontWeight: "700",
                    color: "#0f172a",
                    fontSize: "16px",
                  }}
                >
                  {patientName}
                </h6>
              </div>
              <div
                className="d-flex align-items-center gap-3 text-muted flex-wrap"
                style={{ fontSize: "13px" }}
              >
                {patientCountry && (
                  <span>
                    <i className="fa-solid fa-globe me-1 text-primary"></i>
                    <strong>Country:</strong> {patientCountry}
                  </span>
                )}
                {patientDisease && (
                  <span>
                    <i className="fa-solid fa-stethoscope me-1 text-info"></i>
                    <strong>Diagnosis:</strong> {patientDisease}
                  </span>
                )}
                {patient?.patient_status && (
                  <span>
                    <i className="fa-solid fa-signal me-1 text-secondary"></i>
                    <strong>Status:</strong> {patient.patient_status}
                  </span>
                )}
              </div>
            </div>

            {/* CURRENT ASSIGNMENT STATUS */}
            <div>
              {currentAssigned?.userId || currentAssigned?.name ? (
                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#166534",
                      fontWeight: "600",
                    }}
                  >
                    CURRENTLY ASSIGNED TO:
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#14532d",
                      fontWeight: "700",
                    }}
                  >
                    <i className="fa-solid fa-user-check me-1 text-success"></i>
                    {currentAssigned.name || "Physiotherapist"}
                  </div>
                  {currentAssigned.role && (
                    <div style={{ fontSize: "11px", color: "#4b5563" }}>
                      {currentAssigned.role}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#b45309",
                      fontWeight: "600",
                    }}
                  >
                    ASSIGNMENT STATUS:
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#92400e",
                      fontWeight: "600",
                    }}
                  >
                    <i className="fa-solid fa-triangle-exclamation me-1 text-warning"></i>
                    Unassigned
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTER BAR */}
        <div className="mb-3 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div style={{ flex: 1, minWidth: "260px" }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search physiotherapist by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <i className="fa-solid fa-magnifying-glass text-muted"></i>
                  </InputAdornment>
                ),
                style: {
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                },
              }}
            />
          </div>

          {/* Filter Tabs */}
          <div className="d-flex align-items-center gap-1 bg-white p-1 rounded-2 border">
            <button
              type="button"
              className="btn btn-sm"
              style={{
                fontSize: "12px",
                fontWeight: staffTab === "physio" ? 600 : 500,
                backgroundColor:
                  staffTab === "physio" ? "#0284c7" : "transparent",
                color: staffTab === "physio" ? "#ffffff" : "#475569",
                borderRadius: "6px",
                padding: "5px 12px",
                border: "none",
                transition: "all 0.2s ease",
              }}
              onClick={() => setStaffTab("physio")}
            >
              Physiotherapists ({physioStaff.length})
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                fontSize: "12px",
                fontWeight: staffTab === "all" ? 600 : 500,
                backgroundColor:
                  staffTab === "all" ? "#0284c7" : "transparent",
                color: staffTab === "all" ? "#ffffff" : "#475569",
                borderRadius: "6px",
                padding: "5px 12px",
                border: "none",
                transition: "all 0.2s ease",
              }}
              onClick={() => setStaffTab("all")}
            >
              All Staff ({allStaff.length})
            </button>
          </div>

          {currentAssigned?.userId || currentAssigned?.name ? (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleUnassign}
              disabled={unassigning || submitting}
              style={{
                textTransform: "none",
                fontWeight: "600",
                fontSize: "12.5px",
                whiteSpace: "nowrap",
                padding: "7px 14px",
                borderRadius: "8px",
              }}
            >
              {unassigning ? (
                <>
                  <CircularProgress size={14} style={{ marginRight: "6px" }} />
                  Unassigning...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-user-minus me-1"></i>
                  Unassign
                </>
              )}
            </Button>
          ) : null}
        </div>

        {/* PHYSIOTHERAPISTS LIST */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            maxHeight: "260px",
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {loadingStaff ? (
            <div className="text-center py-5">
              <CircularProgress size={32} style={{ color: "#0ba6df" }} />
              <p className="mt-2 text-muted" style={{ fontSize: "13px" }}>
                Loading physiotherapists list...
              </p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa-solid fa-user-slash fa-2x mb-2 text-secondary"></i>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
                {searchQuery
                  ? "No physiotherapists match your search."
                  : "No physiotherapists found."}
              </p>
              {staffTab === "physio" && allStaff.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary mt-2"
                  onClick={() => setStaffTab("all")}
                  style={{ fontSize: "12px" }}
                >
                  View All Staff Members ({allStaff.length})
                </button>
              )}
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {filteredStaff.map((staff) => {
                const sId = String(
                  staff.userId || staff._id || staff.id || staff.staffId
                );
                const isSelected = String(selectedTherapistId) === sId;
                const isCurrentlyAssigned =
                  String(
                    currentAssigned?.userId ||
                      currentAssigned?._id ||
                      currentAssigned?.id ||
                      ""
                  ) === sId ||
                  String(currentAssigned?.name || "").trim().toLowerCase() ===
                    String(staff.name || "").trim().toLowerCase();

                return (
                  <div
                    key={sId || staff.name}
                    onClick={() => setSelectedTherapistId(sId)}
                    style={{
                      border: isSelected
                        ? "2px solid #0ba6df"
                        : "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#f0f9ff" : "#ffffff",
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <input
                        type="radio"
                        name="physioStaffSelection"
                        checked={isSelected}
                        onChange={() => setSelectedTherapistId(sId)}
                        style={{
                          accentColor: "#0ba6df",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          backgroundColor: isSelected ? "#0ba6df" : "#e0f2fe",
                          color: isSelected ? "#ffffff" : "#0369a1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "700",
                          fontSize: "14px",
                          flexShrink: 0,
                        }}
                      >
                        {staff.name ? staff.name.charAt(0).toUpperCase() : "P"}
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <strong
                            style={{ fontSize: "14px", color: "#0f172a" }}
                          >
                            {staff.name}
                          </strong>
                          <span
                            style={{
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              fontSize: "10.5px",
                              fontWeight: "600",
                              padding: "1px 7px",
                              borderRadius: "4px",
                            }}
                          >
                            {staff.role || "Physiotherapist"}
                          </span>
                          {isCurrentlyAssigned && (
                            <span
                              style={{
                                backgroundColor: "#dcfce7",
                                color: "#15803d",
                                fontSize: "10.5px",
                                fontWeight: "600",
                                padding: "1px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              Current
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            marginTop: "2px",
                          }}
                        >
                          <span className="me-3">
                            <i className="fa-regular fa-envelope me-1"></i>
                            {staff.email || "No email"}
                          </span>
                          {(staff.phone || staff.phone_no) && (
                            <span>
                              <i className="fa-solid fa-phone me-1"></i>
                              {staff.phone || staff.phone_no}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-end">
                      {isSelected && (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "#0ba6df",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          <i className="fa-solid fa-check me-1"></i>
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>

      {/* FOOTER ACTIONS */}
      <DialogActions
        style={{
          padding: "14px 24px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <Button
          onClick={onClose}
          disabled={submitting || unassigning}
          style={{
            borderRadius: "6px",
            padding: "6px 18px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#64748b",
            border: "1px solid #cbd5e1",
            textTransform: "none",
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={submitting || unassigning || !selectedTherapistId}
          style={{
            backgroundColor: !selectedTherapistId ? "#94a3b8" : "#0284c7",
            borderRadius: "6px",
            padding: "6px 22px",
            fontSize: "13px",
            fontWeight: "700",
            textTransform: "none",
            color: "#ffffff",
            boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
          }}
        >
          {submitting ? (
            <>
              <CircularProgress
                size={16}
                style={{ color: "#ffffff", marginRight: "8px" }}
              />
              Assigning...
            </>
          ) : (
            <>
              <i className="fa-solid fa-check-circle me-1.5"></i>
              {currentAssigned?.userId || currentAssigned?.name
                ? "Update Physiotherapist"
                : "Assign Physiotherapist"}
            </>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
