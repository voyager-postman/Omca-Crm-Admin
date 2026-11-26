import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Swal from "sweetalert2";
import CameraFileUpload from "./CameraFileUpload";
import { imageUrl } from "../../Basurl/Baseurl";
import {
  fetchEnquiryReports,
  getDocumentDisplayName,
  getDocumentPath,
  uploadEnquiryReports,
} from "../../services/enquiryReportsApi";

const REPORT_ACCEPT =
  "image/jpeg,image/png,image/jpg,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp";

export function UploadEnquiryReportsIcon({ onClick, disabled }) {
  return (
    <i
      className="fa-solid fa-file-arrow-up"
      title="Upload Reports"
      style={disabled ? { cursor: "not-allowed", opacity: 0.5 } : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onClick?.(e);
      }}
    />
  );
}

export default function UploadEnquiryReportsModal({
  open,
  onClose,
  enquiryId,
  recordId,
  model = "enquiry",
  enquiryLabel = "",
}) {
  const [files, setFiles] = useState([]);
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setExisting([]);
      setSubmitting(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (!enquiryId) return;
      setLoading(true);
      try {
        const docs = await fetchEnquiryReports(enquiryId);
        if (!cancelled) setExisting(docs);
      } catch (err) {
        console.warn("Could not load existing enquiry reports:", err);
        if (!cancelled) setExisting([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, enquiryId]);

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!files.length) {
      Swal.fire("Warning", "Please select at least one PDF or image", "warning");
      return;
    }
    if (files.length > 20) {
      Swal.fire("Too many files!", "You can upload up to 20 reports", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await uploadEnquiryReports({
        enquiryId,
        recordId,
        model,
        files,
        existingDocuments: existing,
      });
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Reports uploaded successfully",
        showConfirmButton: false,
        timer: 2000,
      });
      onClose?.();
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message || err?.message || "Failed to upload reports",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
      <div className="main-card-header">
        <div className="note-hd">
          <h6>
            Upload Reports
            {enquiryLabel ? ` – ${enquiryLabel}` : ""}
          </h6>
        </div>
        <div className="cross-icon" onClick={handleClose}>
          <i className="fa-solid fa-xmark"></i>
        </div>
      </div>
      <DialogContent className="main-box">
        <Box component="form" className="contact-form" onSubmit={handleSubmit}>
          <div className="field-set">
            <label>
              Medical Reports (PDF / Images)
              <span className="text-danger">*</span>
            </label>
            <CameraFileUpload
              files={files}
              setFiles={setFiles}
              multiple
              accept={REPORT_ACCEPT}
              maxFiles={20}
              helperText="Upload PDFs or images (up to 20 files)"
              buttonText="Choose Reports"
            />
          </div>
          <div className="field-set mt-3">
            <label>Existing Reports</label>
            {loading ? (
              <p className="text-muted mb-0">Loading reports...</p>
            ) : existing.length === 0 ? (
              <p className="text-muted mb-0">No reports uploaded yet.</p>
            ) : (
              <div className="engpatimg enquiry-doc-list">
                {existing.map((file, index) => {
                  const path = getDocumentPath(file);
                  const url = /^https?:\/\//i.test(path)
                    ? path
                    : `${imageUrl}${path}`;
                  const docName = getDocumentDisplayName(file, index);
                  return (
                    <a
                      key={`${path}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="viewbtn viewbtn-filename me-2"
                      title={docName}
                    >
                      {docName}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          <DialogActions className="submit-main">
            <Button type="button" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Uploading..." : "Upload"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
