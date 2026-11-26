import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import {
  updateGHStayInfo,
  GH_STATUSES,
} from "../../../services/guestHouseServicesApi";

export default function EditStayInfoModal({
  open,
  onClose,
  record,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    guestHouseName: "",
    roomNumber: "",
    stayDateRangeFrom: "",
    stayDateRangeTo: "",
    status: "Pending",
    notes: "",
  });

  useEffect(() => {
    if (open && record) {
      const fromDate =
        record.checkin ||
        record.stayDateRangeFrom ||
        (record.stayDateRange?.from ? record.stayDateRange.from.slice(0, 10) : "") ||
        "";
      const toDate =
        record.checkout ||
        record.stayDateRangeTo ||
        (record.stayDateRange?.to ? record.stayDateRange.to.slice(0, 10) : "") ||
        "";

      setFormData({
        guestHouseName: record.guest_house_name || record.guestHouseName || "",
        roomNumber:
          record.guest_house_room_type ||
          record.roomNumber ||
          record.room_type ||
          "",
        stayDateRangeFrom: fromDate ? fromDate.slice(0, 10) : "",
        stayDateRangeTo: toDate ? toDate.slice(0, 10) : "",
        status: record.status || "Pending",
        notes: record.notes || record.remarks || "",
      });
    }
  }, [open, record]);

  if (!open || !record) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.guestHouseName.trim()) {
      Swal.fire("Validation Error", "Guest House name is required.", "warning");
      return;
    }

    const identifier =
      record.booking_id ||
      record.id ||
      record._id ||
      record.guestHouseServiceId;

    if (!identifier) {
      Swal.fire("Error", "Could not identify booking to update.", "error");
      return;
    }

    setLoading(true);
    try {
      await updateGHStayInfo(identifier, {
        guest_house_name: formData.guestHouseName.trim(),
        guestHouseName: formData.guestHouseName.trim(),
        guest_house_room_type: formData.roomNumber.trim(),
        roomNumber: formData.roomNumber.trim(),
        checkin: formData.stayDateRangeFrom,
        checkout: formData.stayDateRangeTo,
        stayDateRangeFrom: formData.stayDateRangeFrom,
        stayDateRangeTo: formData.stayDateRangeTo,
        status: formData.status,
        notes: formData.notes,
        remarks: formData.notes,
      });

      Swal.fire({
        title: "Stay Info Updated!",
        text: "Guest house record details updated successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating stay info:", err);
      Swal.fire("Error", typeof err === "string" ? err : "Failed to update stay info", "error");
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
          <i className="fa fa-bed fs-5" />
          <div>
            <h5 className="mb-0 fw-bold" style={{ fontSize: "16px" }}>
              Edit Stay & Booking Info
            </h5>
            <small style={{ color: "rgba(255,255,255,0.85)" }}>
              {record.booking_id || record.guestHouseServiceId || `Booking #${record.id}`} • {record.name || record.patient_name || "Patient"}
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            color: "#fff",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <i className="fa fa-times" />
        </button>
      </div>

      <DialogContent style={{ padding: "20px", flex: "1 1 auto", overflowY: "auto" }}>
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label small fw-bold text-dark">
                Guest House Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                name="guestHouseName"
                value={formData.guestHouseName}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-dark">Room Number</label>
              <input
                type="text"
                name="roomNumber"
                placeholder="e.g. 204, Suite 1"
                value={formData.roomNumber}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Stay From</label>
              <input
                type="date"
                name="stayDateRangeFrom"
                value={formData.stayDateRangeFrom}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Stay To</label>
              <input
                type="date"
                name="stayDateRangeTo"
                value={formData.stayDateRangeTo}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Booking Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="form-select"
              >
                {GH_STATUSES.filter((st) => st !== "ALL").map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-bold text-dark">General Stay Notes / Special Requests</label>
              <textarea
                rows="2"
                name="notes"
                placeholder="e.g. Patient checked out early, vegetarian meal plan"
                value={formData.notes}
                onChange={handleChange}
                className="form-control"
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button
              type="button"
              className="btn btn-light btn-sm px-3"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm px-4 fw-bold"
              disabled={loading}
              style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
            >
              {loading ? <i className="fa fa-spinner fa-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
