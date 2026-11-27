import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import {
  updateGuestHouseStayBooking,
  GH_STATUSES,
} from "../../../services/guestHouseServicesApi";
import { fetchGuestHouses, fetchGuestHouseById } from "../../../services/guestHouseApi";

export default function EditStayInfoModal({
  open,
  onClose,
  record,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [guestHouses, setGuestHouses] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [formData, setFormData] = useState({
    guestHouse_id: "",
    guestHouseRoom_id: "",
    guestHouseName: "",
    roomNumber: "",
    stayDateRangeFrom: "",
    stayDateRangeTo: "",
    rooms: 1,
    adults: 1,
    children: 0,
    payment_status: "Pending",
    status: "Pending",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchGuestHouses()
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setGuestHouses(list);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && formData.guestHouse_id) {
      fetchGuestHouseById(formData.guestHouse_id)
        .then((res) => {
          const gh = res?.data || res;
          setRoomsList(Array.isArray(gh?.rooms) ? gh.rooms : []);
        })
        .catch(() => setRoomsList([]));
    } else {
      setRoomsList([]);
    }
  }, [open, formData.guestHouse_id]);

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
        guestHouse_id: record.guestHouse_id || record.guest_house_id || "",
        guestHouseRoom_id: record.guestHouseRoom_id || record.guest_house_room_id || "",
        guestHouseName: record.guest_house_name || record.guestHouseName || "",
        roomNumber:
          record.guest_house_room_type ||
          record.roomNumber ||
          record.room_type ||
          "",
        stayDateRangeFrom: fromDate ? fromDate.slice(0, 10) : "",
        stayDateRangeTo: toDate ? toDate.slice(0, 10) : "",
        rooms: record.rooms ?? 1,
        adults: record.adults ?? 1,
        children: record.children ?? 0,
        payment_status: record.payment_status || "Pending",
        status: record.status || "Pending",
        notes: record.notes || record.remarks || "",
      });
    }
  }, [open, record]);

  if (!open || !record) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "guestHouse_id" ? { guestHouseRoom_id: "" } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const identifier = record.id || record.booking_id || record._id || record.guestHouseServiceId;

    if (!identifier) {
      Swal.fire("Error", "Could not identify booking to update.", "error");
      return;
    }

    setLoading(true);
    try {
      await updateGuestHouseStayBooking(identifier, {
        guestHouse_id: formData.guestHouse_id,
        guestHouseRoom_id: formData.guestHouseRoom_id,
        checkin: formData.stayDateRangeFrom,
        checkout: formData.stayDateRangeTo,
        rooms: formData.rooms,
        adults: formData.adults,
        children: formData.children,
        payment_status: formData.payment_status,
        status: formData.status,
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
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Guest House</label>
              {guestHouses.length > 0 ? (
                <select
                  name="guestHouse_id"
                  value={formData.guestHouse_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">{formData.guestHouseName || "Select Guest House"}</option>
                  {guestHouses.map((gh) => (
                    <option key={gh.id || gh._id} value={gh.id || gh._id}>
                      {gh.name || gh.title}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="guestHouseName"
                  value={formData.guestHouseName}
                  onChange={handleChange}
                  className="form-control"
                />
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Room / Room Type</label>
              {roomsList.length > 0 ? (
                <select
                  name="guestHouseRoom_id"
                  value={formData.guestHouseRoom_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">{formData.roomNumber || "Select Room"}</option>
                  {roomsList.map((rm) => (
                    <option key={rm.id || rm._id} value={rm.id || rm._id}>
                      {rm.room_type || rm.name || `Room #${rm.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="roomNumber"
                  placeholder="e.g. 204, Suite 1"
                  value={formData.roomNumber}
                  onChange={handleChange}
                  className="form-control"
                />
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Check-in</label>
              <input
                type="date"
                name="stayDateRangeFrom"
                value={formData.stayDateRangeFrom}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Check-out</label>
              <input
                type="date"
                name="stayDateRangeTo"
                value={formData.stayDateRangeTo}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-dark">Rooms</label>
              <input
                type="number"
                min="1"
                name="rooms"
                value={formData.rooms}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-dark">Adults</label>
              <input
                type="number"
                min="1"
                name="adults"
                value={formData.adults}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-dark">Children</label>
              <input
                type="number"
                min="0"
                name="children"
                value={formData.children}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Payment Status</label>
              <select
                name="payment_status"
                value={formData.payment_status}
                onChange={handleChange}
                className="form-select"
              >
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">Booking Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="form-select"
              >
                {Array.from(
                  new Set([
                    ...GH_STATUSES.filter((st) => st !== "ALL"),
                    "Confirmed",
                    "Checked-In",
                    "Checked-Out",
                    "Cancelled",
                  ])
                ).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-bold text-dark">Remarks / Notes</label>
              <textarea
                rows="2"
                name="notes"
                placeholder="e.g. Updated booking details via CRM"
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
