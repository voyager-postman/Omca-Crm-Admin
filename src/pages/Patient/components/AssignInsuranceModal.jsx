import React, { useState, useEffect } from "react";
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
  fetchInsurances,
  assignPatientToInsurance,
  unassignPatientFromInsurance,
  getStoredInsuranceForPatient,
  storeInsuranceAssignment,
  removeStoredInsuranceAssignment,
} from "../../../services/insuranceApi";
import { canViewAndEditSensitivePatientDetails } from "../../../utils/authStorage";

export default function AssignInsuranceModal({
  open,
  onClose,
  patient,
  onSuccess,
}) {
  const [loadingInsurances, setLoadingInsurances] = useState(false);
  const [insurances, setInsurances] = useState([]);
  const [selectedInsurance, setSelectedInsurance] = useState(null);
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

  const storedIns = getStoredInsuranceForPatient(patientId);

  const currentInsuranceName =
    patient?.Insurance_Name ||
    patient?.insurance_name ||
    patient?.insurance?.name ||
    patient?.insurance ||
    storedIns?.insurance_name ||
    storedIns?.Insurance_Name ||
    "";
  const currentInsuranceId =
    patient?.insurance_id ||
    patient?.insuranceId ||
    storedIns?.insurance_id ||
    "";

  const hasAssignedInsurance = Boolean(
    (currentInsuranceName && currentInsuranceName.trim() !== "") ||
    (currentInsuranceId && currentInsuranceId.trim() !== "")
  );

  useEffect(() => {
    if (open) {
      if (!isAdmin) {
        Swal.fire({
          icon: "error",
          title: "Access Restricted",
          text: "Only authorized roles (Admin, Manager, Sub-admin) can assign or unassign insurance from patient.",
          confirmButtonColor: "#0891b2",
        });
        onClose();
        return;
      }

      loadInsurancesList();
      setNotes("");
      setSelectedInsurance(null);
    }
  }, [open, isAdmin, onClose]);

  const loadInsurancesList = async () => {
    setLoadingInsurances(true);
    try {
      const res = await fetchInsurances({ limit: 300, status: 1 });
      const list = res?.insurances || res?.data || (Array.isArray(res) ? res : []);
      setInsurances(Array.isArray(list) ? list : []);

      // If patient already has an insurance partner, attempt preselection
      if (currentInsuranceId || currentInsuranceName) {
        const found = list.find(
          (r) =>
            (currentInsuranceId && (r.insurance_id === currentInsuranceId || String(r.id) === String(currentInsuranceId))) ||
            (currentInsuranceName && r.name?.toLowerCase() === currentInsuranceName.toLowerCase())
        );
        if (found) {
          setSelectedInsurance(found);
        } else if (currentInsuranceName) {
          setSelectedInsurance({
            name: currentInsuranceName,
            insurance_id: currentInsuranceId,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load insurances:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to Load Insurance Partners",
        text: err?.response?.data?.message || err?.message || "Could not retrieve insurance partners list.",
      });
    } finally {
      setLoadingInsurances(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedInsurance) {
      Swal.fire({
        icon: "warning",
        title: "Select Insurance Partner",
        text: "Please select an insurance partner to assign.",
        confirmButtonColor: "#0891b2",
      });
      return;
    }

    const insId = selectedInsurance.insurance_id || selectedInsurance.id || "";
    const insName = selectedInsurance.name || "";

    setSubmitting(true);
    try {
      const res = await assignPatientToInsurance(patientId, {
        insurance_id: insId,
        Insurance_Name: insName,
        notes: notes.trim(),
      });

      Swal.fire({
        icon: "success",
        title: "Insurance Assigned!",
        text: res?.message || `Successfully assigned ${insName} as insurance partner.`,
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess({
          ...patient,
          insurance_id: insId,
          Insurance_Name: insName,
          insurance_name: insName,
        });
      }
      onClose();
    } catch (err) {
      console.error("Assign insurance error:", err);
      Swal.fire({
        icon: "error",
        title: "Assignment Failed",
        text: err?.response?.data?.message || err?.message || "Failed to assign insurance partner.",
        confirmButtonColor: "#0891b2",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "Unassign Insurance?",
      text: `Are you sure you want to unassign insurance partner "${currentInsuranceName || currentInsuranceId}" from ${patientName}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, Unassign",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
    });

    if (!confirmResult.isConfirmed) return;

    setUnassigning(true);
    try {
      const res = await unassignPatientFromInsurance(patientId, {
        reason: notes.trim() || "Unassigned by Admin",
      });

      Swal.fire({
        icon: "success",
        title: "Insurance Unassigned",
        text: res?.message || "Insurance partner successfully unassigned from patient.",
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess({
          ...patient,
          insurance_id: "",
          Insurance_Name: "",
          insurance_name: "",
        });
      }
      onClose();
    } catch (err) {
      console.error("Unassign insurance error:", err);
      Swal.fire({
        icon: "error",
        title: "Unassign Failed",
        text: err?.response?.data?.message || err?.message || "Failed to unassign insurance partner.",
        confirmButtonColor: "#0891b2",
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
        style: {
          borderRadius: 14,
          padding: "4px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
        },
      }}
    >
      <DialogTitle
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#0f172a",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "#ecfeff",
            color: "#0891b2",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
          }}
        >
          <i className="fa-solid fa-shield-alt fa-shield" />
        </span>
        <div>
          <div>{hasAssignedInsurance ? "Manage Insurance Partner" : "Assign Insurance Partner"}</div>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>
            Patient: <strong>{patientName}</strong> {patientId && `(${patientId})`}
          </div>
        </div>
      </DialogTitle>

      <DialogContent style={{ paddingTop: "18px" }}>
        {/* Current status banner */}
        {hasAssignedInsurance && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor: "#ecfeff",
              border: "1px solid #a5f3fc",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#0e7490", textTransform: "uppercase" }}>
                Currently Assigned Insurance Partner
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#155e75", marginTop: "2px" }}>
                {currentInsuranceName || "Unknown Partner"}
                {currentInsuranceId && (
                  <span
                    style={{
                      fontSize: "11px",
                      marginLeft: "6px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "#cffafe",
                      color: "#0e7490",
                      fontFamily: "monospace",
                    }}
                  >
                    {currentInsuranceId}
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleUnassign}
              disabled={unassigning || submitting}
              style={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: "12px",
                borderColor: "#fecaca",
                backgroundColor: "#fff",
              }}
            >
              {unassigning ? "Unassigning..." : "Unassign"}
            </Button>
          </div>
        )}

        {/* Autocomplete Insurance Picker */}
        <div style={{ marginTop: "10px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "6px",
            }}
          >
            Select Insurance Partner <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <Autocomplete
            options={insurances}
            loading={loadingInsurances}
            value={selectedInsurance}
            onChange={(e, val) => setSelectedInsurance(val)}
            getOptionLabel={(opt) => {
              if (typeof opt === "string") return opt;
              if (!opt) return "";
              const idPart = opt.insurance_id ? ` (${opt.insurance_id})` : opt.id ? ` (#${opt.id})` : "";
              const phonePart = opt.phone ? ` • ${opt.phone}` : "";
              return `${opt.name || "Insurance Partner"}${idPart}${phonePart}`;
            }}
            isOptionEqualToValue={(option, value) => {
              if (!option || !value) return false;
              if (option.insurance_id && value.insurance_id) {
                return option.insurance_id === value.insurance_id;
              }
              if (option.id && value.id) {
                return String(option.id) === String(value.id);
              }
              return option.name === value.name;
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search insurance partner by name, ID, or phone..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingInsurances ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </div>

        {/* Notes input */}
        <div style={{ marginTop: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "6px",
            }}
          >
            Assignment Notes / Policy Number (Optional)
          </label>
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            placeholder="Policy/claim details or reason for assignment..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </DialogContent>

      <DialogActions
        style={{
          padding: "14px 24px",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          {hasAssignedInsurance && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleUnassign}
              disabled={unassigning || submitting}
              startIcon={
                unassigning ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <i className="fa-solid fa-shield-alt fa-shield"></i>
                )
              }
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {unassigning ? "Unassigning..." : "Unassign Insurance"}
            </Button>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            onClick={onClose}
            disabled={submitting || unassigning}
            variant="text"
            style={{ textTransform: "none", color: "#64748b", fontWeight: 600 }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleAssign}
            disabled={submitting || unassigning || !selectedInsurance}
            variant="contained"
            style={{
              textTransform: "none",
              backgroundColor: "#0891b2",
              color: "#ffffff",
              fontWeight: 700,
              padding: "6px 20px",
              boxShadow: "0 2px 6px rgba(8, 145, 178, 0.3)",
            }}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CircularProgress size={16} color="inherit" />
                Saving...
              </span>
            ) : hasAssignedInsurance ? (
              "Update Insurance"
            ) : (
              "Assign Insurance"
            )}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
}
