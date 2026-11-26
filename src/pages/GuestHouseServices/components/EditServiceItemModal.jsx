import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import { updateGHSingleService } from "../../../services/guestHouseServicesApi";

const ITEM_STATUSES = ["In Progress", "Completed", "Cancelled", "Pending"];

export default function EditServiceItemModal({
  open,
  onClose,
  record,
  serviceItem,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    price: "",
    quantity: 1,
    discount_percentage: 0,
    status: "In Progress",
    notes: "",
  });

  useEffect(() => {
    if (serviceItem) {
      setFormData({
        price: serviceItem.unit_price ?? serviceItem.price ?? "",
        quantity: serviceItem.quantity ?? 1,
        discount_percentage: serviceItem.discount_percentage ?? 0,
        status: serviceItem.status || "In Progress",
        notes: serviceItem.notes || serviceItem.description || "",
      });
    }
  }, [serviceItem]);

  if (!open || !record || !serviceItem) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const lineBase = (Number(formData.price) || 0) * (Number(formData.quantity) || 1);
  const lineDiscount = ((Number(formData.discount_percentage) || 0) * lineBase) / 100;
  const lineTotal = Math.max(0, lineBase - lineDiscount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const identifier = record.booking_id || record.id || record._id || record.guestHouseServiceId;
    const serviceId = serviceItem.id || serviceItem._id || serviceItem.serviceId;

    try {
      await updateGHSingleService(identifier, serviceId, {
        unit_price: Number(formData.price),
        quantity: Number(formData.quantity),
        discount_percentage: Number(formData.discount_percentage) || 0,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
      });

      Swal.fire({
        title: "Service Updated!",
        text: `Service "${serviceItem.service_name || serviceItem.serviceName}" has been updated.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating service item:", err);
      Swal.fire("Error", typeof err === "string" ? err : err?.message || "Failed to update service", "error");
    } finally {
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
            Edit Service: {serviceItem.service_name || serviceItem.serviceName}
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
        <form id="gh-edit-service-item-form" onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Unit Price (₹)
              </label>
              <input
                type="number"
                name="price"
                className="form-control form-control-sm"
                min="0"
                step="any"
                value={formData.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Quantity
              </label>
              <input
                type="number"
                name="quantity"
                className="form-control form-control-sm"
                min="1"
                value={formData.quantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Line Discount (%)
              </label>
              <input
                type="number"
                name="discount_percentage"
                className="form-control form-control-sm"
                min="0"
                max="100"
                step="any"
                value={formData.discount_percentage}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Service Delivery Status
              </label>
              <select
                name="status"
                className="form-select form-select-sm"
                value={formData.status}
                onChange={handleChange}
              >
                {ITEM_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-dark">
                Instructions / Notes
              </label>
              <textarea
                name="notes"
                rows="2"
                className="form-control form-control-sm"
                value={formData.notes}
                onChange={handleChange}
              />
            </div>

            <div className="col-12">
              <div className="p-2 rounded bg-light border d-flex justify-content-between align-items-center">
                <span className="small text-muted">Recalculated Line Total:</span>
                <strong className="fs-6 text-success">₹{lineTotal.toLocaleString()}</strong>
              </div>
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
          form="gh-edit-service-item-form"
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
              <i className="fa fa-check me-1" /> Update Service
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
