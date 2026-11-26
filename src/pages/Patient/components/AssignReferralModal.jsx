import React, { useState, useEffect, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Swal from "sweetalert2";
import {
  fetchReferrals,
  assignPatientToReferral,
  unassignPatientFromReferral,
} from "../../../services/referralApi";
import { isAdminUser, canViewAndEditSensitivePatientDetails } from "../../../utils/authStorage";

export default function AssignReferralModal({
  open,
  onClose,
  patient,
  onSuccess,
}) {
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const role = (localStorage.getItem("Role") || "").trim().toLowerCase();
  const isAdmin = canViewAndEditSensitivePatientDetails(role);

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

  const currentReferralName =
    patient?.Referral_Name ||
    patient?.referral_name ||
    patient?.referral ||
    "";
  const currentReferralId =
    patient?.referral_id ||
    patient?.referralId ||
    "";

  const hasAssignedReferral = Boolean(
    (currentReferralName && currentReferralName.trim() !== "") ||
    (currentReferralId && currentReferralId.trim() !== "")
  );

  useEffect(() => {
    if (open) {
      if (!isAdmin) {
        Swal.fire({
          icon: "error",
          title: "Access Restricted",
          text: "Only authorized roles (Admin, Manager, Sub-admin) can assign or unassign a referral from patient.",
          confirmButtonColor: "#0ba6df",
        });
        onClose();
        return;
      }

      loadReferralsList();
      setNotes("");
      setSelectedReferral(null);
    }
  }, [open, isAdmin, onClose]);

  const loadReferralsList = async () => {
    setLoadingReferrals(true);
    try {
      const res = await fetchReferrals({ limit: 300, status: 1 });
      const list = res?.referrals || res?.data || (Array.isArray(res) ? res : []);
      setReferrals(Array.isArray(list) ? list : []);

      // If patient already has a referral, attempt preselection
      if (currentReferralId || currentReferralName) {
        const found = list.find(
          (r) =>
            (currentReferralId && (r.referral_id === currentReferralId || String(r.id) === String(currentReferralId))) ||
            (currentReferralName && r.name?.toLowerCase() === currentReferralName.toLowerCase())
        );
        if (found) {
          setSelectedReferral(found);
        } else if (currentReferralName) {
          setSelectedReferral({
            name: currentReferralName,
            referral_id: currentReferralId,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load referrals:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to Load Referrals",
        text: err?.response?.data?.message || err?.message || "Could not retrieve referral partners list.",
      });
    } finally {
      setLoadingReferrals(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedReferral) {
      Swal.fire({
        icon: "warning",
        title: "Select Referral Partner",
        text: "Please select a referral partner to assign.",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    const refId = selectedReferral.referral_id || selectedReferral.id || "";
    const refName = selectedReferral.name || "";

    setSubmitting(true);
    try {
      const res = await assignPatientToReferral(patientId, {
        referral_id: refId,
        Referral_Name: refName,
        notes: notes.trim(),
      });

      Swal.fire({
        icon: "success",
        title: "Referral Assigned!",
        text: res?.message || `Successfully assigned ${refName} as referral partner.`,
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess({
          ...patient,
          referral_id: refId,
          Referral_Name: refName,
        });
      }
      onClose();
    } catch (err) {
      console.error("Assign referral error:", err);
      Swal.fire({
        icon: "error",
        title: "Assignment Failed",
        text: err?.response?.data?.message || err?.message || "Failed to assign referral partner.",
        confirmButtonColor: "#0ba6df",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "Unassign Referral?",
      text: `Are you sure you want to unassign referral partner "${currentReferralName || currentReferralId}" from ${patientName}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, Unassign",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
    });

    if (!confirmResult.isConfirmed) return;

    setUnassigning(true);
    try {
      const res = await unassignPatientFromReferral(patientId, {
        reason: notes.trim() || "Unassigned by Admin",
      });

      Swal.fire({
        icon: "success",
        title: "Referral Unassigned",
        text: res?.message || "Referral partner successfully unassigned from patient.",
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess({
          ...patient,
          referral_id: "",
          Referral_Name: "",
        });
      }
      onClose();
    } catch (err) {
      console.error("Unassign referral error:", err);
      Swal.fire({
        icon: "error",
        title: "Unassign Failed",
        text: err?.response?.data?.message || err?.message || "Failed to unassign referral partner.",
        confirmButtonColor: "#0ba6df",
      });
    } finally {
      setUnassigning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting || unassigning ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "14px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#0f172a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          py: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <i className="fa-solid fa-handshake" style={{ color: "#0ba6df" }}></i>
          <span>{hasAssignedReferral ? "Manage Referral Partner" : "Assign Referral Partner"}</span>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: "#f0fdf4",
            color: "#16a34a",
            border: "1px solid #bbf7d0",
            fontSize: "11px",
            padding: "4px 8px",
          }}
        >
          Admin Only
        </span>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Patient Summary Card */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "#f1f5f9",
            marginBottom: "20px",
            fontSize: "13.5px",
          }}
        >
          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
            Patient: <span style={{ color: "#0ba6df" }}>{patientName}</span>
            {patientId && <span style={{ color: "#64748b", fontWeight: 400, marginLeft: "6px" }}>({patientId})</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            <span style={{ color: "#475569" }}>Current Referral:</span>
            {hasAssignedReferral ? (
              <span
                className="badge"
                style={{
                  backgroundColor: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  fontSize: "12px",
                  padding: "4px 8px",
                }}
              >
                <i className="fa-solid fa-user-check me-1"></i>
                {currentReferralName || "Partner"} {currentReferralId ? `(${currentReferralId})` : ""}
              </span>
            ) : (
              <span className="badge bg-light text-muted border">None (Unassigned)</span>
            )}
          </div>
        </div>

        {/* Referral Partner Dropdown */}
        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "6px", fontSize: "13px" }}>
            Select Referral Partner <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <Autocomplete
            options={referrals}
            loading={loadingReferrals}
            getOptionLabel={(option) => {
              if (typeof option === "string") return option;
              if (!option) return "";
              const idStr = option.referral_id ? ` (${option.referral_id})` : "";
              return `${option.name || ""}${idStr}`;
            }}
            value={selectedReferral}
            onChange={(e, val) => setSelectedReferral(val)}
            isOptionEqualToValue={(opt, val) =>
              opt.id === val?.id ||
              opt.referral_id === val?.referral_id ||
              opt.name === val?.name
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Search by name or referral ID..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingReferrals ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </div>

        {/* Notes / Reason */}
        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "6px", fontSize: "13px" }}>
            Discussion Note / Reason (Optional)
          </label>
          <TextField
            multiline
            rows={3}
            fullWidth
            size="small"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add note recorded into patient discussion history..."
          />
        </div>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div>
          {hasAssignedReferral && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleUnassign}
              disabled={unassigning || submitting}
              startIcon={unassigning ? <CircularProgress size={16} color="inherit" /> : <i className="fa-solid fa-user-slash"></i>}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {unassigning ? "Unassigning..." : "Unassign Referral"}
            </Button>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={submitting || unassigning}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={submitting || unassigning || !selectedReferral}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <i className="fa-solid fa-check"></i>}
            sx={{
              backgroundColor: "#0ba6df",
              "&:hover": { backgroundColor: "#088cb9" },
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {submitting ? "Saving..." : hasAssignedReferral ? "Update Referral" : "Assign Referral"}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
}
