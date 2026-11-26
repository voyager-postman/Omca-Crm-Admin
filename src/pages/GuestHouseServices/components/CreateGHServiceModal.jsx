import React, { useState, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import PatientSearchSelect, { searchCrmPatients } from "../../../components/PatientSearchSelect";
import { fetchGuestHouses, fetchGuestHouseById } from "../../../services/guestHouseApi";
import {
  createGuestHouseStayBooking,
  addGHPayment,
  GH_PAYMENT_METHODS,
} from "../../../services/guestHouseServicesApi";

export default function CreateGHServiceModal({
  open,
  onClose,
  prefilledPatient = null,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // 1. Patient Selection
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [treatmentId, setTreatmentId] = useState("");

  // 2. Guest House Stay Details
  const [guestHousesCatalog, setGuestHousesCatalog] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [stayFormData, setStayFormData] = useState({
    guestHouse_id: "",
    guestHouseName: "",
    guestHouseRoom_id: "",
    roomNumber: "",
    checkin: new Date().toISOString().slice(0, 10),
    checkout: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    rooms: 1,
    adults: 1,
    children: "",
    room_payment_amount: "",
    payment_mode: "Cash",
    remarks: "",
  });

  // 3. Advance Payment State
  const [hasAdvancePayment, setHasAdvancePayment] = useState(false);
  const [advancePaymentData, setAdvancePaymentData] = useState({
    paid_amount: "",
    paymentMethod: "Cash",
    paymentDate: new Date().toISOString().slice(0, 10),
    transactionRef: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadGuestHouses();

      if (prefilledPatient) {
        // Resolve patient's real name (ignore fallback placeholder "Patient")
        const rawName =
          (prefilledPatient.name && prefilledPatient.name.trim().toLowerCase() !== "patient"
            ? prefilledPatient.name
            : "") ||
          prefilledPatient.patient_name ||
          prefilledPatient.patient_fullname ||
          prefilledPatient.fullname ||
          prefilledPatient.raw?.patient_name ||
          prefilledPatient.raw?.name ||
          prefilledPatient.raw?.fullname ||
          "";

        const pObj = {
          ...prefilledPatient,
          name: rawName || prefilledPatient.name || "",
          patient_name: rawName || prefilledPatient.patient_name || "",
        };

        setSelectedPatient(pObj);
        setTreatmentId(
          prefilledPatient.treatment_id ||
            prefilledPatient.treatmentId ||
            prefilledPatient.raw?.treatment_id ||
            prefilledPatient.raw?.treatmentId ||
            (Array.isArray(prefilledPatient.raw?.treatments) &&
              prefilledPatient.raw.treatments[0]?.treatment_id) ||
            ""
        );

        // If name is still missing or literally "Patient", auto-resolve using searchCrmPatients
        if (!rawName || rawName.trim().toLowerCase() === "patient") {
          const idToSearch =
            prefilledPatient.patientNumber ||
            prefilledPatient.patientId ||
            prefilledPatient.displayId ||
            prefilledPatient.user_id ||
            prefilledPatient._id;
          if (idToSearch) {
            searchCrmPatients(String(idToSearch), { limit: 5 })
              .then((results) => {
                const match =
                  results.find(
                    (r) =>
                      String(r.patientNumber || r.patientId || r.displayId || "").toLowerCase() ===
                        String(idToSearch).toLowerCase() ||
                      String(r.user_id || r.id || r._id || "") === String(idToSearch)
                  ) || results[0];
                if (match && match.name && match.name.trim().toLowerCase() !== "patient") {
                  setSelectedPatient((prev) => ({
                    ...(prev || {}),
                    ...match,
                    name: match.name,
                    patient_name: match.name,
                    phone: prev?.phone || match.phone || "",
                    email: prev?.email || match.email || "",
                  }));
                }
              })
              .catch((err) => {
                console.warn("Could not auto-resolve prefilled patient:", err);
              });
          }
        }
      } else {
        setSelectedPatient(null);
        setTreatmentId("");
      }

      setStayFormData({
        guestHouse_id: "",
        guestHouseName: "",
        guestHouseRoom_id: "",
        roomNumber: "",
        checkin: new Date().toISOString().slice(0, 10),
        checkout: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        rooms: 1,
        adults: 1,
        children: "",
        room_payment_amount: "",
        payment_mode: "Cash",
        remarks: "",
      });

      setHasAdvancePayment(false);
      setAdvancePaymentData({
        paid_amount: "",
        paymentMethod: "Cash",
        paymentDate: new Date().toISOString().slice(0, 10),
        transactionRef: "",
        notes: "",
      });
    }
  }, [open, prefilledPatient]);

  const loadGuestHouses = async () => {
    try {
      const res = await fetchGuestHouses();
      const list = Array.isArray(res) ? res : res?.data || res?.details || [];
      setGuestHousesCatalog(list);
    } catch (e) {
      console.warn("Could not load guest houses:", e);
    }
  };

  // Fetch rooms whenever selected guest house changes
  useEffect(() => {
    if (!stayFormData.guestHouse_id) {
      setAvailableRooms([]);
      return;
    }

    const matchedGH = guestHousesCatalog.find(
      (gh) => String(gh.id) === String(stayFormData.guestHouse_id)
    );

    if (matchedGH && matchedGH.id) {
      fetchGuestHouseById(matchedGH.id)
        .then((res) => {
          const rooms = res?.data?.rooms || res?.rooms || [];
          setAvailableRooms(Array.isArray(rooms) ? rooms : []);
        })
        .catch((err) => {
          console.warn("Could not fetch rooms:", err);
          setAvailableRooms([]);
        });
    }
  }, [stayFormData.guestHouse_id, guestHousesCatalog]);

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    if (p?.treatment_id || p?.treatmentId) {
      setTreatmentId(p.treatment_id || p.treatmentId);
    }
  };

  // Calculate room stay charge based on room price, nights and room count
  const calculateRoomCharge = (roomId, checkin, checkout, roomsCount) => {
    if (!roomId) return "";
    const matched = availableRooms.find((r) => String(r.id) === String(roomId));
    const roomPrice = Number(matched?.price || matched?.room_price || 0);
    if (!roomPrice || roomPrice <= 0) return "";

    let nights = 1;
    if (checkin && checkout) {
      const d1 = new Date(checkin);
      const d2 = new Date(checkout);
      const diff = Math.round((d2 - d1) / 86400000);
      if (diff > 0) nights = diff;
    }
    const count = Number(roomsCount) > 0 ? Number(roomsCount) : 1;
    return String(Math.round(roomPrice * nights * count));
  };

  const handleStayFormChange = (e) => {
    const { name, value } = e.target;
    setStayFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Recalculate room stay charge when checkin, checkout, or rooms count changes
      if (name === "checkin" || name === "checkout" || name === "rooms") {
        if (next.guestHouseRoom_id) {
          const autoCharge = calculateRoomCharge(
            next.guestHouseRoom_id,
            next.checkin,
            next.checkout,
            next.rooms
          );
          if (autoCharge) {
            next.room_payment_amount = autoCharge;
          }
        }
      }
      return next;
    });
  };

  const handleGuestHouseSelect = (e) => {
    const ghId = e.target.value;
    const matched = guestHousesCatalog.find((gh) => String(gh.id) === String(ghId));
    setStayFormData((prev) => ({
      ...prev,
      guestHouse_id: ghId,
      guestHouseName: matched ? matched.name || matched.title : "",
      guestHouseRoom_id: "",
      roomNumber: "",
      room_payment_amount: "",
    }));
  };

  const handleRoomSelect = (e) => {
    const roomId = e.target.value;
    const matched = availableRooms.find((r) => String(r.id) === String(roomId));
    const estCharge = calculateRoomCharge(
      roomId,
      stayFormData.checkin,
      stayFormData.checkout,
      stayFormData.rooms
    );

    setStayFormData((prev) => ({
      ...prev,
      guestHouseRoom_id: roomId,
      roomNumber: matched ? matched.title || matched.room_number || "" : "",
      room_payment_amount: estCharge,
    }));
  };

  // Financial calculations
  const roomCharge = Number(stayFormData.room_payment_amount) || 0;
  const advanceAmount = hasAdvancePayment ? Number(advancePaymentData.paid_amount) || 0 : 0;
  const netDue = Math.max(0, roomCharge - advanceAmount);

  let nightsCount = 1;
  if (stayFormData.checkin && stayFormData.checkout) {
    const d1 = new Date(stayFormData.checkin);
    const d2 = new Date(stayFormData.checkout);
    const diff = Math.round((d2 - d1) / 86400000);
    if (diff > 0) nightsCount = diff;
  }
  const selectedRoomObj = availableRooms.find(
    (r) => String(r.id) === String(stayFormData.guestHouseRoom_id)
  );
  const selectedRoomPrice = Number(selectedRoomObj?.price || selectedRoomObj?.room_price || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadingRef.current) return;

    if (!selectedPatient) {
      Swal.fire("Validation Error", "Please select a patient from the search field.", "warning");
      return;
    }

    if (!stayFormData.guestHouse_id && !stayFormData.guestHouseName) {
      Swal.fire("Validation Error", "Please select a guest house property.", "warning");
      return;
    }

    if (hasAdvancePayment && advanceAmount <= 0) {
      Swal.fire("Validation Error", "Please enter a valid advance payment amount.", "warning");
      return;
    }

    if (hasAdvancePayment && roomCharge > 0 && advanceAmount > roomCharge) {
      Swal.fire(
        "Validation Error",
        `Advance payment (₹${advanceAmount.toLocaleString()}) cannot exceed total room charge (₹${roomCharge.toLocaleString()}).`,
        "warning"
      );
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      const patientUserId =
        selectedPatient.user_id ||
        selectedPatient.userId ||
        selectedPatient.patientNumber ||
        selectedPatient.patientId ||
        selectedPatient.displayId ||
        selectedPatient.id ||
        selectedPatient._id ||
        "";

      // Prepare optional initial payment for stay/save
      const initialPaymentObj =
        hasAdvancePayment && advanceAmount > 0
          ? {
              paid_amount: advanceAmount,
              payment_method: advancePaymentData.paymentMethod || stayFormData.payment_mode || "Cash",
              payment_date: advancePaymentData.paymentDate || new Date().toISOString().slice(0, 10),
              apply_towards: "stay",
              transaction_reference: advancePaymentData.transactionRef?.trim() || undefined,
              notes: advancePaymentData.notes?.trim() || undefined,
            }
          : undefined;

      // Determine initial payment status
      const paymentStatus =
        hasAdvancePayment && advanceAmount >= roomCharge && roomCharge > 0
          ? "Paid"
          : hasAdvancePayment && advanceAmount > 0
          ? "Partial"
          : "Pending";

      // Step 1: Create Guest House Stay in CRM (via POST /api/crm/stay/save)
      const stayRes = await createGuestHouseStayBooking({
        user_id: Number(patientUserId) || patientUserId,
        guestHouse_id: Number(stayFormData.guestHouse_id) || stayFormData.guestHouse_id,
        guestHouseRoom_id: Number(stayFormData.guestHouseRoom_id) || stayFormData.guestHouseRoom_id,
        name: selectedPatient.name || selectedPatient.patient_name,
        phone: selectedPatient.phone || selectedPatient.mobile,
        email: selectedPatient.email,
        passport_number: selectedPatient.passport_number,
        checkin: stayFormData.checkin,
        checkout: stayFormData.checkout,
        rooms: Number(stayFormData.rooms) || 1,
        adults: stayFormData.adults !== "" ? Number(stayFormData.adults) : 1,
        children: stayFormData.children !== "" ? Number(stayFormData.children) : 0,
        payment_mode: stayFormData.payment_mode || advancePaymentData.paymentMethod || "Cash",
        room_amount: roomCharge,
        payment_status: paymentStatus,
        terms_condtion: 1,
        remarks: stayFormData.remarks,
        initial_payment: initialPaymentObj,
      });

      const newBookingId =
        stayRes?.data?.record?.booking_id ||
        stayRes?.record?.booking_id ||
        stayRes?.data?.booking_id ||
        stayRes?.booking_id ||
        (stayRes?.data?.id ? `GH-${stayRes.data.id}` : "");

      if (!newBookingId) {
        throw new Error("Guest house booking was created, but no booking ID was returned.");
      }

      // Step 2: Record Advance Payment in ledger if specified
      if (hasAdvancePayment && advanceAmount > 0) {
        try {
          const paymentPayload = new FormData();
          paymentPayload.append("paid_amount", String(advanceAmount));
          paymentPayload.append("payment_method", advancePaymentData.paymentMethod || "Cash");
          paymentPayload.append("paymentMethod", advancePaymentData.paymentMethod || "Cash");
          paymentPayload.append("payment_date", advancePaymentData.paymentDate || new Date().toISOString().slice(0, 10));
          paymentPayload.append("payment_Date", advancePaymentData.paymentDate || new Date().toISOString().slice(0, 10));
          paymentPayload.append("payment_target", "room");
          paymentPayload.append("apply_towards", "room");
          if (advancePaymentData.transactionRef) {
            paymentPayload.append("transaction_reference", advancePaymentData.transactionRef);
          }
          const formattedNotes = advancePaymentData.notes
            ? `[Advance Payment] ${advancePaymentData.notes}`
            : `[Advance Payment] Advance payment for room stay`;
          paymentPayload.append("notes", formattedNotes);

          await addGHPayment(newBookingId, paymentPayload);
        } catch (payErr) {
          console.warn("Advance payment recording note:", payErr?.message);
        }
      }

      Swal.fire({
        title: "Guest House Booking Created!",
        text:
          hasAdvancePayment && advanceAmount > 0
            ? `Successfully created booking ${newBookingId} with advance payment of ₹${advanceAmount.toLocaleString()} recorded.`
            : `Successfully created guest house booking ${newBookingId}.`,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error creating guest house booking:", err);
      Swal.fire("Error", typeof err === "string" ? err : err?.message || "Failed to create guest house booking", "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="gh-modal-dialog gh-modal-md"
      scroll="paper"
      disableAutoFocus
      disableRestoreFocus
      PaperProps={{
        style: {
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "calc(100vh - 40px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        },
      }}
    >
      {/* Header */}
      <div
        className="gh-modal-header"
        style={{
          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fa fa-building fs-5" />
          </div>
          <div>
            <h5 className="mb-0 fw-bold" style={{ fontSize: "17px", color: "#fff" }}>
              New Guest House Booking
            </h5>
            <small style={{ color: "rgba(255,255,255,0.88)" }}>
              Book guest house stay and room for a patient
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
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

      <DialogContent
        style={{
          padding: "20px 24px",
          backgroundColor: "#f8fafc",
          flex: "1 1 auto",
          overflowY: "auto",
        }}
      >
        <form id="gh-new-service-booking-form" onSubmit={handleSubmit}>
          {/* 1. Patient Information */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "14px" }}>
              <i className="fa fa-user text-primary me-2" />
              1. Patient Information
            </h6>
            <div className="row g-2 align-items-center">
              <div className="col-md-7">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Select Patient <span className="text-danger">*</span>
                </label>
                <PatientSearchSelect
                  value={selectedPatient}
                  onChange={handleSelectPatient}
                  placeholder="Search patient by name, ID, phone..."
                  loadInitialOnFocus
                />
              </div>

              <div className="col-md-5">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Treatment / Case ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRT-0042"
                  className="form-control form-control-sm"
                  value={treatmentId}
                  onChange={(e) => setTreatmentId(e.target.value)}
                />
              </div>
            </div>

            {selectedPatient && (
              <div className="mt-2 p-2 rounded bg-light border text-dark small">
                <strong>Selected:</strong> {selectedPatient.name} • Phone: {selectedPatient.phone || "N/A"} • Email: {selectedPatient.email || "N/A"}
              </div>
            )}
          </div>

          {/* 2. Guest House & Stay Details */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold text-dark mb-0" style={{ fontSize: "14px" }}>
                <i className="fa fa-bed text-primary me-2" />
                2. Guest House & Stay Details
              </h6>
              <span className="badge bg-light text-muted border">
                {guestHousesCatalog.length} properties
              </span>
            </div>

            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Guest House Name <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm"
                  value={stayFormData.guestHouse_id}
                  onChange={handleGuestHouseSelect}
                  required
                >
                  <option value="">Select or type guest house name</option>
                  {guestHousesCatalog.map((gh) => (
                    <option key={gh.id} value={gh.id}>
                      {gh.name || gh.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Room / Room Type
                </label>
                {availableRooms.length > 0 ? (
                  <select
                    className="form-select form-select-sm"
                    value={stayFormData.guestHouseRoom_id}
                    onChange={handleRoomSelect}
                  >
                    <option value="">Select room</option>
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title || r.room_number} {r.price ? `(₹${r.price}/night)` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="roomNumber"
                    placeholder="e.g. 204, Suite 3"
                    className="form-control form-control-sm"
                    value={stayFormData.roomNumber}
                    onChange={handleStayFormChange}
                  />
                )}
              </div>

              <div className="col-md-2 col-6">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Check-in From <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  name="checkin"
                  className="form-control form-control-sm"
                  value={stayFormData.checkin}
                  onChange={handleStayFormChange}
                  required
                />
              </div>

              <div className="col-md-2 col-6">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Check-out To <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  name="checkout"
                  className="form-control form-control-sm"
                  value={stayFormData.checkout}
                  onChange={handleStayFormChange}
                  required
                />
              </div>

              <div className="col-md-2 col-6">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Rooms Count
                </label>
                <input
                  type="number"
                  name="rooms"
                  min="1"
                  className="form-control form-control-sm"
                  value={stayFormData.rooms}
                  onChange={handleStayFormChange}
                />
              </div>

              <div className="col-md-2 col-6">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Adults / Kids
                </label>
                <div className="input-group input-group-sm">
                  <input
                    type="number"
                    name="adults"
                    min="1"
                    title="Adults"
                    placeholder="Adults"
                    className="form-control"
                    value={stayFormData.adults}
                    onChange={handleStayFormChange}
                  />
                  <input
                    type="number"
                    name="children"
                    min="0"
                    title="Children"
                    placeholder="Kids"
                    className="form-control"
                    value={stayFormData.children}
                    onChange={handleStayFormChange}
                  />
                </div>
              </div>

              <div className="col-md-4 col-6">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label small fw-semibold text-dark mb-0">
                    Room Stay Charge (₹)
                  </label>
                  {selectedRoomPrice > 0 && (
                    <span className="text-muted" style={{ fontSize: "11px" }}>
                      ({nightsCount} {nightsCount === 1 ? "night" : "nights"} × ₹{selectedRoomPrice.toLocaleString()}{Number(stayFormData.rooms) > 1 ? ` × ${stayFormData.rooms} rooms` : ""})
                    </span>
                  )}
                </div>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white">₹</span>
                  <input
                    type="number"
                    name="room_payment_amount"
                    min="0"
                    step="any"
                    placeholder="e.g. 5000"
                    className="form-control fw-bold"
                    value={stayFormData.room_payment_amount}
                    onChange={handleStayFormChange}
                  />
                </div>
              </div>

              <div className="col-md-4 col-6">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Stay Payment Mode
                </label>
                <select
                  name="payment_mode"
                  className="form-select form-select-sm"
                  value={stayFormData.payment_mode}
                  onChange={handleStayFormChange}
                >
                  {GH_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Advance Payment Details */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <h6 className="fw-bold text-dark mb-0" style={{ fontSize: "14px" }}>
                  <i className="fa fa-receipt text-success me-2" />
                  3. Advance Payment
                </h6>
                <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: "11px" }}>
                  Option to record advance payment made
                </span>
              </div>

              <div className="form-check form-switch mb-0 d-flex align-items-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="recordAdvancePaymentToggle"
                  checked={hasAdvancePayment}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasAdvancePayment(checked);
                    if (checked && roomCharge > 0 && !advancePaymentData.paid_amount) {
                      setAdvancePaymentData((prev) => ({
                        ...prev,
                        paid_amount: String(Math.round(roomCharge / 2)),
                      }));
                    }
                  }}
                  style={{ cursor: "pointer", width: "38px", height: "20px" }}
                />
                <label
                  className="form-check-label small fw-semibold text-dark mb-0"
                  htmlFor="recordAdvancePaymentToggle"
                  style={{ cursor: "pointer" }}
                >
                  {hasAdvancePayment ? "Advance Payment Enabled" : "Add Advance Payment"}
                </label>
              </div>
            </div>

            {hasAdvancePayment ? (
              <div className="pt-2 border-top mt-2">
                {roomCharge > 0 && (
                  <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                    <span className="small text-muted" style={{ fontSize: "11.5px" }}>
                      Quick Amount:
                    </span>
                    <button
                      type="button"
                      className={`gh-installment-btn gh-installment-btn-success ${
                        Number(advancePaymentData.paid_amount) > 0 &&
                        Math.abs(Number(advancePaymentData.paid_amount) - Math.round(roomCharge / 2)) < 0.01
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setAdvancePaymentData((prev) => ({
                          ...prev,
                          paid_amount: String(Math.round(roomCharge / 2)),
                        }))
                      }
                    >
                      {Number(advancePaymentData.paid_amount) > 0 &&
                        Math.abs(Number(advancePaymentData.paid_amount) - Math.round(roomCharge / 2)) < 0.01 && (
                          <i className="fa fa-check me-1" style={{ fontSize: "10px" }} />
                        )}
                      50% Half Stay (₹{Math.round(roomCharge / 2).toLocaleString()})
                    </button>
                    <button
                      type="button"
                      className={`gh-installment-btn gh-installment-btn-primary ${
                        Number(advancePaymentData.paid_amount) > 0 &&
                        Math.abs(Number(advancePaymentData.paid_amount) - Number(roomCharge)) < 0.01
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setAdvancePaymentData((prev) => ({
                          ...prev,
                          paid_amount: String(roomCharge),
                        }))
                      }
                    >
                      {Number(advancePaymentData.paid_amount) > 0 &&
                        Math.abs(Number(advancePaymentData.paid_amount) - Number(roomCharge)) < 0.01 && (
                          <i className="fa fa-check me-1" style={{ fontSize: "10px" }} />
                        )}
                      100% Full Payment (₹{roomCharge.toLocaleString()})
                    </button>
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-md-3 col-6">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Advance Paid (₹) <span className="text-danger">*</span>
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white">₹</span>
                      <input
                        type="number"
                        className="form-control form-control-sm fw-bold text-success"
                        min="0"
                        step="any"
                        placeholder="e.g. 2000"
                        value={advancePaymentData.paid_amount}
                        onChange={(e) =>
                          setAdvancePaymentData((prev) => ({ ...prev, paid_amount: e.target.value }))
                        }
                        required={hasAdvancePayment}
                      />
                    </div>
                  </div>

                  <div className="col-md-3 col-6">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Payment Mode / Method
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={advancePaymentData.paymentMethod}
                      onChange={(e) =>
                        setAdvancePaymentData((prev) => ({ ...prev, paymentMethod: e.target.value }))
                      }
                    >
                      {GH_PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-3 col-6">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={advancePaymentData.paymentDate}
                      onChange={(e) =>
                        setAdvancePaymentData((prev) => ({ ...prev, paymentDate: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-md-3 col-6">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Transaction / Ref No.
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. UPI / Receipt #"
                      value={advancePaymentData.transactionRef}
                      onChange={(e) =>
                        setAdvancePaymentData((prev) => ({ ...prev, transactionRef: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-12 mt-2">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Payment Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Advance paid at check-in counter"
                      value={advancePaymentData.notes}
                      onChange={(e) =>
                        setAdvancePaymentData((prev) => ({ ...prev, notes: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Calculation summary banner */}
                <div
                  className="mt-3 p-2 rounded d-flex justify-content-between align-items-center flex-wrap gap-2"
                  style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}
                >
                  <div className="small">
                    <span className="text-muted">Stay Charge:</span>{" "}
                    <strong>₹{roomCharge.toLocaleString()}</strong>
                    <span className="mx-2 text-muted">•</span>
                    <span className="text-muted">Advance Paid:</span>{" "}
                    <strong className="text-success">₹{(Number(advancePaymentData.paid_amount) || 0).toLocaleString()}</strong>
                  </div>
                  <div className="small">
                    <span className="text-muted">Balance Due:</span>{" "}
                    <strong className={netDue > 0 ? "text-danger" : "text-success"}>
                      ₹{netDue.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="mt-2 p-2 rounded small text-muted d-flex align-items-center justify-content-between"
                style={{ backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1" }}
              >
                <span>
                  <i className="fa fa-info-circle me-1 text-primary" />
                  No advance payment recorded. The stay charge of{" "}
                  <strong>₹{roomCharge.toLocaleString()}</strong> will remain pending.
                </span>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm py-0 px-2"
                  style={{ fontSize: "11px" }}
                  onClick={() => setHasAdvancePayment(true)}
                >
                  <i className="fa fa-plus me-1" /> Add Advance
                </button>
              </div>
            )}
          </div>

          {/* 4. Stay / Booking Remarks */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "14px" }}>
              <i className="fa fa-comment-alt text-primary me-2" />
              4. Stay / Booking Remarks
            </h6>
            <textarea
              name="remarks"
              rows="2"
              className="form-control form-control-sm"
              placeholder="e.g. Ground floor preference, patient requires assistance..."
              value={stayFormData.remarks}
              onChange={handleStayFormChange}
            />
          </div>
        </form>
      </DialogContent>

      {/* Footer */}
      <div
        className="gh-modal-footer"
        style={{
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-4 flex-wrap">
          <div>
            <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: "10px" }}>
              Room Stay Charge
            </small>
            <strong className="fs-6 text-dark">₹{roomCharge.toLocaleString()}</strong>
          </div>

          <div>
            <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: "10px" }}>
              Advance Paid
            </small>
            <strong className="fs-6 text-success">₹{advanceAmount.toLocaleString()}</strong>
          </div>

          <div>
            <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: "10px" }}>
              Net Balance Due
            </small>
            <strong className={`fs-6 ${netDue > 0 ? "text-danger" : "text-success"}`}>
              ₹{netDue.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={onClose}>
            Cancel
          </button>

          <button
            type="submit"
            form="gh-new-service-booking-form"
            className="btn btn-primary btn-sm px-4 fw-bold shadow-sm"
            disabled={loading}
            style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
          >
            {loading ? (
              <>
                <i className="fa fa-spinner fa-spin me-1" /> Creating...
              </>
            ) : (
              "Save Booking"
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
