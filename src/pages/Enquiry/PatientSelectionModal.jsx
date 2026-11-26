import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Radio,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonIcon from "@mui/icons-material/Person";

/**
 * PatientSelectionModal
 * Displays when one or more matching patient records are found for an entered phone number.
 * Allows user to either link the new enquiry to an existing patient or create it as a brand-new patient.
 */
export default function PatientSelectionModal({
  open,
  patients = [],
  onClose,
  onConfirm,
  onSelectExisting,
  onCreateNew,
  isSubmitting = false,
}) {
  const [selectedOption, setSelectedOption] = useState("");

  // Reset or clear selection when modal opens with new patients
  useEffect(() => {
    if (open) {
      setSelectedOption("");
    }
  }, [open]);

  const handleCardClick = (value) => {
    setSelectedOption(value);
  };

  const handleConfirm = () => {
    if (!selectedOption) return;

    if (selectedOption === "new") {
      if (onConfirm) {
        onConfirm({ isNew: true, patientId: null, patient: null });
      } else if (onCreateNew) {
        onCreateNew();
        onClose();
      }
    } else {
      const selectedPatient = patients.find(
        (p) => (p.patientId || p.patientNumber || p._id || p.id) === selectedOption
      );
      if (onConfirm) {
        onConfirm({ isNew: false, patientId: selectedOption, patient: selectedPatient });
      } else if (onSelectExisting) {
        onSelectExisting(selectedOption);
        onClose();
      }
    }
  };

  const handleCancel = () => {
    setSelectedOption("");
    if (onClose) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          overflow: "hidden",
        },
      }}
    >
      {/* Modal Header */}
      <DialogTitle
        sx={{
          backgroundColor: "#fff8e1",
          borderBottom: "1px solid #ffe082",
          py: 2,
          px: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <WarningAmberIcon sx={{ color: "#f57c00", fontSize: 28 }} />
          <div>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#b78103",
                lineHeight: 1.2,
              }}
            >
              Patient Record(s) Found with this Phone Number
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "#6c757d", fontSize: "0.85rem", mt: 0.5 }}
            >
              Select which patient this enquiry belongs to:
            </Typography>
          </div>
        </Box>
      </DialogTitle>

      {/* Modal Content */}
      <DialogContent sx={{ p: 2.5, backgroundColor: "#fbfcfd" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5 }}>
          {/* List existing matching patients */}
          {patients && patients.length > 0 ? (
            patients.map((patient, index) => {
              const patientKey =
                patient.patientId || patient.patientNumber || patient._id || patient.id || index;
              const isSelected = selectedOption === patientKey;
              const name = patient.name || patient.patient_name || "Unknown Patient";
              const age = patient.age ? `${patient.age} yrs` : "";
              const gender = patient.gender || "";
              const details = [age, gender].filter(Boolean).join(", ");
              const location = [patient.town, patient.country].filter(Boolean).join(", ");

              return (
                <Box
                  key={patientKey}
                  onClick={() => handleCardClick(patientKey)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    p: 1.8,
                    borderRadius: "8px",
                    border: isSelected ? "2px solid #008080" : "1px solid #dee2e6",
                    backgroundColor: isSelected ? "#f0fdfa" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      borderColor: isSelected ? "#008080" : "#adb5bd",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    },
                  }}
                >
                  <Radio
                    checked={isSelected}
                    onChange={() => handleCardClick(patientKey)}
                    value={patientKey}
                    sx={{
                      p: 0,
                      mt: 0.3,
                      color: "#008080",
                      "&.Mui-checked": {
                        color: "#008080",
                      },
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonIcon sx={{ fontSize: 18, color: "#008080" }} />
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: "#212529",
                          lineHeight: 1.3,
                        }}
                      >
                        {name} {details && <span style={{ fontWeight: 400, color: "#495057" }}>({details})</span>}
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{
                        color: "#6c757d",
                        fontSize: "0.82rem",
                        mt: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      <strong style={{ color: "#333" }}>ID:</strong>{" "}
                      <span style={{ color: "#008080", fontWeight: 600 }}>{patientKey}</span>
                      {location && ` | Location: ${location}`}
                      {patient.passport_num && ` | Passport: ${patient.passport_num}`}
                    </Typography>
                  </Box>
                </Box>
              );
            })
          ) : (
            <Typography variant="body2" sx={{ color: "#6c757d", textAlign: "center", py: 2 }}>
              No matching patient records found.
            </Typography>
          )}

          {/* Option: Create New Patient */}
          <Box
            onClick={() => handleCardClick("new")}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              p: 1.8,
              borderRadius: "8px",
              border: selectedOption === "new" ? "2px solid #2e7d32" : "1px dashed #2e7d32",
              backgroundColor: selectedOption === "new" ? "#f1f8e9" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: "#2e7d32",
                boxShadow: "0 2px 8px rgba(46,125,50,0.1)",
              },
            }}
          >
            <Radio
              checked={selectedOption === "new"}
              onChange={() => handleCardClick("new")}
              value="new"
              sx={{
                p: 0,
                mt: 0.3,
                color: "#2e7d32",
                "&.Mui-checked": {
                  color: "#2e7d32",
                },
              }}
            />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PersonAddIcon sx={{ fontSize: 18, color: "#2e7d32" }} />
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    color: "#1b5e20",
                    lineHeight: 1.3,
                  }}
                >
                  ➕ Create as a New Patient / Family Member
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: "#558b2f",
                  fontSize: "0.82rem",
                  mt: 0.4,
                  lineHeight: 1.3,
                }}
              >
                (Will not link or overwrite existing patient records)
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      {/* Modal Actions */}
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid #e9ecef",
          backgroundColor: "#fff",
        }}
      >
        <Button
          onClick={handleCancel}
          variant="outlined"
          disabled={isSubmitting}
          sx={{
            textTransform: "none",
            color: "#6c757d",
            borderColor: "#ced4da",
            fontWeight: 600,
            "&:hover": {
              borderColor: "#adb5bd",
              backgroundColor: "#f8f9fa",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedOption || isSubmitting}
          sx={{
            textTransform: "none",
            backgroundColor: "#008080",
            fontWeight: 600,
            px: 3,
            "&:hover": {
              backgroundColor: "#006666",
            },
          }}
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />
              Submitting...
            </>
          ) : (
            "Confirm & Submit"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
