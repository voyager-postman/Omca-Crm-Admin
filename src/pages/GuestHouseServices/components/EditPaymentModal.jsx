import React, { useState, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import {
  updateGHPayment,
  GH_PAYMENT_METHODS,
} from "../../../services/guestHouseServicesApi";

export default function EditPaymentModal({
  open,
  onClose,
  record,
  paymentItem,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [formData, setFormData] = useState({
    paid_amount: "",
    payment_method: "Cash",
    status: "Approved",
    notes: "",
    rejection_notes: "",
  });

  useEffect(() => {
    if (paymentItem) {
      setFormData({
        paid_amount: paymentItem.paid_amount ?? "",
        payment_method: paymentItem.payment_method || paymentItem.paymentMethod || "Cash",
        status: paymentItem.status || "Approved",
        notes: paymentItem.notes || "",
        rejection_notes: paymentItem.rejection_notes || "",
      });
    }
  }, [paymentItem]);

  if (!open || !record || !paymentItem) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadingRef.current) return;
    const amt = Number(formData.paid_amount);
    if (!amt || amt <= 0) {
      Swal.fire("Validation Error", "Please provide a valid amount.", "warning");
      return;
    }

    if (formData.status === "Rejected" && !formData.rejection_notes.trim()) {
      Swal.fire("Required", "Please provide the reason for payment rejection.", "warning");
      return;
    }

    const identifier = record.booking_id || record.id || record._id || record.guestHouseServiceId;
    const paymentId = paymentItem.id || paymentItem._id;

    loadingRef.current = true;
    setLoading(true);
    try {
      await updateGHPayment(identifier, paymentId, {
        paid_amount: amt,
        payment_method: formData.payment_method,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
        rejection_notes:
          formData.status === "Rejected" ? formData.rejection_notes.trim() : undefined,
      });

      Swal.fire({
        title: "Payment Updated!",
        text: `Payment receipt entry has been updated.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating payment:", err);
      Swal.fire("Error", typeof err === "string" ? err : err?.message || "Failed to update payment", "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      className="gh-modal-dialog"
      scroll="paper"
      disableAutoFocus
      disableRestoreFocus
      PaperProps={{
        style: {
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "calc(100vh - 48px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        },
      }}
    >
      <div
        className="gh-modal-header"
        style={{
          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="fa fa-pencil fs-5" />
          <h5 className="mb-0 fw-bold" style={{ fontSize: "16px" }}>
            Edit / Approve Payment Receipt #{paymentItem.id || ""}
          </h5>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          <i className="fa fa-times" />
        </button>
      </div>

      <DialogContent style={{ padding: "20px", backgroundColor: "#f8fafc" }}>
        <form id="gh-edit-payment-form" onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Amount Paid (₹) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                name="paid_amount"
                className="form-control form-control-sm"
                min="0"
                step="any"
                value={formData.paid_amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Payment Method
              </label>
              <select
                name="payment_method"
                className="form-select form-select-sm"
                value={formData.payment_method}
                onChange={handleChange}
              >
                {GH_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-dark">
                Verification / Approval Status
              </label>
              <select
                name="status"
                className="form-select form-select-sm"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Approved">Approved (Count towards Paid)</option>
                <option value="Pending">Pending Verification</option>
                <option value="Rejected">Rejected (Exclude from Paid)</option>
              </select>
            </div>

            {formData.status === "Rejected" && (
              <div className="col-12">
                <label className="form-label small fw-semibold text-danger">
                  Rejection Reason / Notes <span className="text-danger">*</span>
                </label>
                <textarea
                  name="rejection_notes"
                  rows="2"
                  className="form-control form-control-sm border-danger"
                  placeholder="e.g. UTR reference number was invalid or payment not received..."
                  value={formData.rejection_notes}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="col-12">
              <label className="form-label small fw-semibold text-dark">
                Remarks / Notes
              </label>
              <textarea
                name="notes"
                rows="2"
                className="form-control form-control-sm"
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          </div>
        </form>
      </DialogContent>

      <div
        className="gh-modal-footer"
        style={{
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={onClose}>
          Cancel
        </button>

        <button
          type="submit"
          form="gh-edit-payment-form"
          className="btn btn-primary btn-sm px-4 fw-bold shadow-sm"
          disabled={loading}
          style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
        >
          {loading ? (
            <>
              <i className="fa fa-spinner fa-spin me-1" /> Updating...
            </>
          ) : (
            <>
              <i className="fa fa-check me-1" /> Update Payment
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
