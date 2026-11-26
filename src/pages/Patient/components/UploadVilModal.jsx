import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import axios from "axios";
import Swal from "sweetalert2";
import { baseurl } from "../../../Basurl/Baseurl";
import CameraFileUpload from "../../../components/Common/CameraFileUpload";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

export default function UploadVilModal({
  open,
  onClose,
  onSuccess,
  treatmentPlan,
  hospitalItem,
  isResubmit = false,
}) {
  const [vilFile, setVilFile] = useState(null);
  const [docName, setDocName] = useState("Visa Invitation Letter (VIL)");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setVilFile(null);
      setDocName(
        isResubmit
          ? "Resubmitted Visa Invitation Letter (VIL)"
          : "Visa Invitation Letter (VIL)"
      );
      setNotes("");
    }
  }, [open, isResubmit]);

  if (!open || isReferralUser() || isInsuranceUser()) return null;

  const hospitalId =
    hospitalItem?.id ||
    hospitalItem?._id ||
    hospitalItem?.hospitalId ||
    hospitalItem?.hospital?._id ||
    hospitalItem?.hospital ||
    "";
  const treatmentPlanId = treatmentPlan?._id || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReferralUser() || isInsuranceUser()) return;

    if (!vilFile) {
      Swal.fire("File Required", "Please select a VIL document to upload", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("vilDocument", vilFile);
      formData.append("documentName", docName.trim() || "Visa Invitation Letter (VIL)");
      formData.append("notes", notes.trim());
      formData.append("uploadType", isResubmit ? "Resubmit" : "Initial");

      const response = await axios.put(
        `${baseurl}uploadHospitalVIL/${treatmentPlanId}/${hospitalId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response?.data?.success) {
        await Swal.fire({
          icon: "success",
          title: isResubmit ? "VIL Resubmitted!" : "VIL Document Uploaded!",
          text:
            response?.data?.message ||
            (isResubmit
              ? "Revised Visa Invitation Letter has been resubmitted and is now Pending Review."
              : "Visa Invitation Letter has been successfully uploaded and is now Pending Review."),
        });
        onSuccess?.();
        onClose();
      } else {
        Swal.fire("Error", response?.data?.message || "Failed to upload VIL document", "error");
      }
    } catch (error) {
      console.error("VIL upload error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || error?.message || "Failed to upload VIL document",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      className="vil-upload-dialog"
      PaperProps={{
        style: {
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* Sticky Top Header */}
      <div
        style={{
          backgroundColor: isResubmit ? "#d97706" : "#0d9488",
          color: "#ffffff",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-file-arrow-up fs-5"></i>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "16px" }}>
              {isResubmit ? "Resubmit" : "Upload"} Visa Invitation Letter (VIL)
            </h5>
            <small style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px" }}>
              Hospital: <b>{hospitalItem?.name || "Hospital"}</b>
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "14px",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            background: "#ffffff",
          }}
        >
          <div className="mb-3">
            <label className="form-label fw-bold text-muted small mb-1">Hospital</label>
            <input
              type="text"
              className="form-control form-control-sm bg-light"
              value={hospitalItem?.name || "-"}
              readOnly
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold text-muted small mb-1">
              Document Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <CameraFileUpload
              label="Select VIL File (PDF / Images)"
              required={true}
              files={vilFile}
              setFiles={setVilFile}
              multiple={false}
              accept=".pdf,image/*"
              helperText="Take photo of VIL letter or upload PDF/images"
            />
          </div>

          <div className="mb-2">
            <label className="form-label fw-bold text-muted small mb-1">Upload Notes</label>
            <textarea
              className="form-control form-control-sm"
              rows="3"
              placeholder="Optional notes regarding this VIL document..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-sm btn-secondary px-3 py-2 fw-semibold"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-sm btn-success px-4 py-2 fw-bold shadow-sm"
            disabled={submitting}
            style={{
              backgroundColor: isResubmit ? "#d97706" : "#0d9488",
              borderColor: isResubmit ? "#d97706" : "#0d9488",
            }}
          >
            {submitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Uploading...
              </>
            ) : (
              <>
                <i className="fa-solid fa-cloud-arrow-up me-1"></i>{" "}
                {isResubmit ? "Resubmit VIL" : "Upload VIL"}
              </>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
