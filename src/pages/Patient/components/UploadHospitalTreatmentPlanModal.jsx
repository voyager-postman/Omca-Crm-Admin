import React, { useState, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import axios from "axios";
import Swal from "sweetalert2";
import { baseurl } from "../../../Basurl/Baseurl";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

/**
 * UploadHospitalTreatmentPlanModal
 * Enables CRM Admin/Staff to upload a Treatment Plan on behalf of a Hospital.
 * Matches Hospital Portal modal fields:
 * - Treatment (prefilled, disabled)
 * - Notes * (required)
 * - Document Name (default "Treatment Plan")
 * - Documents * (multiple file upload with preview)
 *
 * Endpoint: PUT /api/uploadHospitalTreatmentPlan/:treatmentPlanId/:hospitalId?version=v2
 * Resubmit: PUT /api/hospitalResubmitTreatmentPlan/:treatmentPlanId/:hospitalId?version=v2
 */
export default function UploadHospitalTreatmentPlanModal({
  open,
  onClose,
  onSuccess,
  treatmentPlan,
  hospitalItem,
  isResubmit = false,
}) {
  const [notes, setNotes] = useState("");
  const [docName, setDocName] = useState("Treatment Plan");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNotes("");
      setDocName(isResubmit ? "Revised Treatment Plan" : "Treatment Plan");
      setFiles([]);
    }
  }, [open, isResubmit]);

  if (!open || isReferralUser() || isInsuranceUser()) return null;

  const planId =
    treatmentPlan?._id ||
    treatmentPlan?.id ||
    treatmentPlan?.treatmentPlanId ||
    "";

  const hospitalId =
    hospitalItem?.id ||
    hospitalItem?._id ||
    hospitalItem?.hospitalId ||
    hospitalItem?.hospital_id ||
    hospitalItem?.hospital?._id ||
    hospitalItem?.hospital ||
    "";

  const hospitalName =
    hospitalItem?.name ||
    hospitalItem?.hospitalName ||
    hospitalItem?.hospital_name ||
    hospitalItem?.hospital?.name ||
    "Hospital";

  const treatmentName =
    treatmentPlan?.treatment?.name ||
    treatmentPlan?.treatment_name ||
    treatmentPlan?.name ||
    "";

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isReferralUser() || isInsuranceUser()) return;

    if (!planId || !hospitalId) {
      Swal.fire("Error", "Treatment plan or hospital reference is missing", "error");
      return;
    }

    if (!notes.trim()) {
      Swal.fire("Notes Required", "Please enter notes for this treatment plan", "warning");
      return;
    }

    if (!files || files.length === 0) {
      Swal.fire("Documents Required", "Please select at least one document to upload", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("documentName", docName.trim() || "Treatment Plan");
      formData.append("notes", notes.trim());
      formData.append("uploadType", isResubmit ? "Resubmit" : "Initial");
      files.forEach((file) => {
        formData.append("documents", file);
      });

      const endpoint = isResubmit
        ? `${baseurl}hospitalResubmitTreatmentPlan/${planId}/${hospitalId}?version=v2`
        : `${baseurl}uploadHospitalTreatmentPlan/${planId}/${hospitalId}?version=v2`;

      const response = await axios.put(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response?.data?.success) {
        await Swal.fire({
          icon: "success",
          title: isResubmit ? "Treatment Plan Resubmitted!" : "Treatment Plan Uploaded!",
          text:
            response?.data?.message ||
            `Treatment plan successfully uploaded on behalf of ${hospitalName}.`,
        });
        onSuccess?.();
        onClose();
      } else {
        Swal.fire(
          "Error",
          response?.data?.message || "Failed to upload treatment plan",
          "error"
        );
      }
    } catch (error) {
      console.error("Upload treatment plan error:", error);
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to upload treatment plan";
      Swal.fire("Error", errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={() => !submitting && onClose()}
      PaperProps={{
        sx: {
          borderRadius: "10px",
          overflow: "hidden",
        },
      }}
    >
      <div className="main-card-header" style={{ padding: "14px 20px" }}>
        <div className="note-hd">
          <h6 style={{ margin: 0, fontWeight: 700, fontSize: "16px" }}>
            {isResubmit ? "Re-upload Treatment Plan" : "Upload Treatment Plan"}
          </h6>
          <small className="text-muted" style={{ fontSize: "12px" }}>
            Uploading on behalf of: <strong style={{ color: "#0284c7" }}>{hospitalName}</strong>
          </small>
        </div>
        <div
          className="cross-icon"
          onClick={() => !submitting && onClose()}
          style={{ cursor: submitting ? "not-allowed" : "pointer" }}
        >
          <i className="fa-solid fa-xmark"></i>
        </div>
      </div>

      <DialogContent className="main-box view-table-detail" style={{ padding: "20px" }}>
        <Box noValidate component="form" className="contact-form" onSubmit={handleSubmit}>
          <div className="row g-3">
            {/* 1. Treatment (Disabled) */}
            <div className="col-md-12">
              <div className="field-set">
                <label className="fw-semibold mb-1" style={{ fontSize: "13px" }}>
                  Treatment
                </label>
                <TextField
                  fullWidth
                  size="small"
                  value={treatmentName || "—"}
                  disabled
                  sx={{
                    "& .MuiInputBase-input.Mui-disabled": {
                      WebkitTextFillColor: "#1e293b",
                      backgroundColor: "#f8fafc",
                      fontWeight: 600,
                    },
                  }}
                />
              </div>
            </div>

            {/* 2. Notes * (Required) */}
            <div className="col-md-12">
              <div className="field-set">
                <label className="fw-semibold mb-1" style={{ fontSize: "13px" }}>
                  Notes <span className="text-danger">*</span>
                </label>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes for this treatment plan"
                  required
                />
              </div>
            </div>

            {/* 3. Document Name */}
            <div className="col-md-12">
              <div className="field-set">
                <label className="fw-semibold mb-1" style={{ fontSize: "13px" }}>
                  Document Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Treatment Plan"
                />
              </div>
            </div>

            {/* 4. Documents * (Required) */}
            <div className="col-md-12">
              <div className="field-set">
                <label className="fw-semibold mb-1" style={{ fontSize: "13px" }}>
                  Documents <span className="text-danger">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*,.doc,.docx"
                  className="form-control"
                  onChange={handleFileChange}
                />
                <small className="text-muted d-block mt-1" style={{ fontSize: "11.5px" }}>
                  Upload estimation letter, treatment protocol, or medical reports (PDF, Images, DOC)
                </small>

                {/* Selected files preview */}
                {files.length > 0 && (
                  <div className="d-flex flex-wrap gap-1 mt-2" style={{ maxHeight: "100px", overflowY: "auto" }}>
                    {files.map((file, idx) => (
                      <span
                        key={idx}
                        className="badge d-inline-flex align-items-center gap-1"
                        style={{
                          backgroundColor: "#eff6ff",
                          color: "#1e40af",
                          border: "1px solid #bfdbfe",
                          fontWeight: 500,
                          fontSize: "12px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        <i
                          className={
                            file.type?.includes("pdf") || file.name?.toLowerCase().endsWith(".pdf")
                              ? "fa-solid fa-file-pdf text-danger"
                              : "fa-solid fa-file-lines text-primary"
                          }
                        />
                        <span className="text-truncate" style={{ maxWidth: "220px" }}>
                          {file.name}
                        </span>
                        <i
                          className="fa-solid fa-xmark"
                          style={{ cursor: "pointer", marginLeft: 4, color: "#ef4444" }}
                          onClick={() => handleRemoveFile(idx)}
                          title="Remove"
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogActions className="submit-main" style={{ padding: "16px 0 0", marginTop: "16px" }}>
            <Button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{ color: "#64748b" }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              style={{
                background: "linear-gradient(135deg, #00b4db 0%, #0083b0 100%)",
                color: "#ffffff",
                fontWeight: 600,
                boxShadow: "0 2px 6px rgba(0, 180, 219, 0.35)",
              }}
            >
              {submitting ? "Uploading..." : "Upload"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

