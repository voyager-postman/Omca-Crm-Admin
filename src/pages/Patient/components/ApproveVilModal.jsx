import React, { useState, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import axios from "axios";
import Swal from "sweetalert2";
import { baseurl } from "../../../Basurl/Baseurl";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

export default function ApproveVilModal({
  open,
  onClose,
  onSuccess,
  treatmentPlan,
  hospitalItem,
}) {
  const [notes, setNotes] = useState("Approved");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNotes("Approved");
      setSelectedFiles([]);
      setFilePreviews([]);
      setSubmitting(false);
    }
  }, [open]);

  // Clean up object URLs on unmount or file change
  useEffect(() => {
    return () => {
      filePreviews.forEach((item) => {
        if (item.url && item.url.startsWith("blob:")) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [filePreviews]);

  if (!open || isReferralUser() || isInsuranceUser()) return null;

  const hospitalId =
    hospitalItem?.id ||
    hospitalItem?._id ||
    hospitalItem?.hospitalId ||
    hospitalItem?.hospital?._id ||
    hospitalItem?.hospital ||
    "";
  const treatmentPlanId =
    treatmentPlan?._id ||
    treatmentPlan?.id ||
    treatmentPlan?.treatmentPlanId ||
    "";

  const handleFilesChosen = (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const incoming = Array.from(filesList);

    const newPreviews = incoming.map((file) => {
      const isImg = file.type?.startsWith("image/");
      return {
        file,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        isImage: isImg,
        url: isImg ? URL.createObjectURL(file) : "",
      };
    });

    setSelectedFiles((prev) => [...prev, ...incoming]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index) => {
    setFilePreviews((prev) => {
      const target = prev[index];
      if (target?.url && target.url.startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, i) => i !== index);
    });
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReferralUser() || isInsuranceUser()) return;

    if (!treatmentPlanId || !hospitalId) {
      Swal.fire(
        "Missing Information",
        "Treatment Plan ID and Hospital ID are required to approve VIL.",
        "error"
      );
      return;
    }

    setSubmitting(true);
    const finalNotes = (notes || "").trim() || "Approved";
    const token = localStorage.getItem("token");

    try {
      let response;
      if (selectedFiles.length > 0) {
        // multipart/form-data for image approval
        const formData = new FormData();
        formData.append("status", "Approved");
        formData.append("notes", finalNotes);
        formData.append("treatmentPlanId", treatmentPlanId);
        formData.append("hospitalId", hospitalId);

        selectedFiles.forEach((file) => {
          formData.append("images", file);
        });

        // Try PUT /api/updateVILStatus/:treatmentPlanId/:hospitalId first, fallback to POST
        try {
          response = await axios.put(
            `${baseurl}updateVILStatus/${encodeURIComponent(treatmentPlanId)}/${encodeURIComponent(hospitalId)}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } catch (err) {
          if (err.response?.status === 404 || err.response?.status === 405) {
            response = await axios.post(
              `${baseurl}updateVILStatus/${encodeURIComponent(treatmentPlanId)}/${encodeURIComponent(hospitalId)}`,
              formData,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "multipart/form-data",
                },
              }
            );
          } else {
            throw err;
          }
        }
      } else {
        // JSON payload for approve with no images
        const jsonPayload = {
          status: "Approved",
          notes: finalNotes,
          treatmentPlanId,
          hospitalId,
        };

        try {
          response = await axios.put(
            `${baseurl}updateVILStatus/${encodeURIComponent(treatmentPlanId)}/${encodeURIComponent(hospitalId)}`,
            jsonPayload,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
        } catch (err) {
          if (err.response?.status === 404 || err.response?.status === 405) {
            response = await axios.post(
              `${baseurl}updateVILStatus/${encodeURIComponent(treatmentPlanId)}/${encodeURIComponent(hospitalId)}`,
              jsonPayload,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );
          } else {
            throw err;
          }
        }
      }

      if (response?.data?.success) {
        await Swal.fire({
          icon: "success",
          title: "VIL Approved!",
          text:
            response.data.message ||
            `Visa Invitation Letter approved successfully.${selectedFiles.length > 0 ? ` (${selectedFiles.length} image(s) uploaded)` : ""}`,
          timer: 2000,
          showConfirmButton: false,
        });
        onSuccess?.(response.data);
        onClose();
      } else {
        Swal.fire(
          "Error",
          response?.data?.message || "Status update failed",
          "error"
        );
      }
    } catch (error) {
      console.error("VIL approval error:", error);
      Swal.fire(
        "Approval Failed",
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to approve Visa Invitation Letter",
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
      PaperProps={{
        style: {
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#16a34a",
          color: "#ffffff",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fa-solid fa-stamp fs-6 text-white"></i>
          </div>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "16px" }}>
              Approve Visa Invitation Letter (VIL)
            </h5>
            <small style={{ color: "rgba(255,255,255,0.9)", fontSize: "12px" }}>
              Hospital: <b>{hospitalItem?.name || "Hospital"}</b>
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            background: "rgba(255,255,255,0.2)",
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
          }}
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
          {/* Hospital Info Box */}
          <div
            className="p-2 mb-3 rounded"
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              fontSize: "13px",
            }}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted">Target Hospital: </span>
                <strong className="text-dark">{hospitalItem?.name || "-"}</strong>
              </div>
              <span
                className="badge"
                style={{
                  backgroundColor: "#dcfce7",
                  color: "#15803d",
                  fontSize: "11px",
                  padding: "4px 8px",
                }}
              >
                Approval Stage
              </span>
            </div>
          </div>

          {/* Approval Notes */}
          <div className="mb-3">
            <label className="form-label fw-bold text-dark small mb-1">
              Approval Notes <span className="text-muted fw-normal">(Optional)</span>
            </label>
            <textarea
              className="form-control form-control-sm"
              rows="3"
              placeholder="e.g. Approved, documentation verified, visa stamp ready..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: "13px" }}
            ></textarea>
            <small className="text-muted" style={{ fontSize: "11px" }}>
              If left blank, "Approved" will be saved as the approval note.
            </small>
          </div>

          {/* Optional Approval Images Section */}
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <label className="form-label fw-bold text-dark small mb-0">
                Attach Approval Images <span className="text-muted fw-normal">(Optional Extra)</span>
              </label>
              {filePreviews.length > 0 && (
                <span className="badge bg-primary" style={{ fontSize: "11px" }}>
                  {filePreviews.length} image{filePreviews.length > 1 ? "s" : ""} selected
                </span>
              )}
            </div>

            {/* Drop / Pick Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #86efac",
                borderRadius: "10px",
                padding: "16px 12px",
                textAlign: "center",
                backgroundColor: "#f9fefb",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9fefb")}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFilesChosen(e.target.files)}
              />
              <i className="fa-solid fa-cloud-arrow-up fs-4 text-success mb-2 d-block"></i>
              <div className="fw-semibold text-dark" style={{ fontSize: "13px" }}>
                Click to browse or drop approval images here
              </div>
              <small className="text-muted" style={{ fontSize: "11px" }}>
                JPG, PNG, WEBP, or PDF • Multiple files allowed
              </small>
            </div>

            {/* Selected File Previews Grid */}
            {filePreviews.length > 0 && (
              <div className="mt-3">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {filePreviews.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "relative",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "6px",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      {item.isImage && item.url ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "75px",
                            objectFit: "cover",
                            borderRadius: "6px",
                            marginBottom: "4px",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "75px",
                            borderRadius: "6px",
                            backgroundColor: "#f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <i className="fa-solid fa-file-pdf fs-3 text-danger"></i>
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#1e293b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        {item.size}
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        style={{
                          position: "absolute",
                          top: "-6px",
                          right: "-6px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: "#ef4444",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                        }}
                        title="Remove file"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <small className="text-muted" style={{ fontSize: "11.5px" }}>
            {selectedFiles.length > 0
              ? `Approving with ${selectedFiles.length} file(s)`
              : "Approving with notes only (no images)"}
          </small>
          <div className="d-flex align-items-center gap-2">
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
                backgroundColor: "#16a34a",
                borderColor: "#16a34a",
                fontSize: "13px",
              }}
            >
              {submitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Approving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check me-1"></i> Confirm VIL Approval
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

