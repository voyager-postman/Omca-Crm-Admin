import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import {
  addGHMoreServices,
  createGHServiceRecord,
  fetchGHServiceCatalog,
  fetchGHServicesList,
  GH_SERVICE_DURATIONS,
} from "../../../services/guestHouseServicesApi";

export default function AddServicesModal({ open, onClose, record = null, onSuccess }) {
  const [loading, setLoading] = useState(false);

  // Active bookings list for selection
  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingIdInput, setBookingIdInput] = useState("");

  // Master catalog presets
  const [catalogList, setCatalogList] = useState([]);

  // 2. Services & Amenities rows
  const [services, setServices] = useState([
    {
      serviceName: "",
      serviceCode: "",
      price: "",
      quantity: 1,
      duration: "One-Time",
      discount_percentage: 0,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      notes: "",
    },
  ]);

  // 3. Food & Dining / Meal Services rows
  const [foodServices, setFoodServices] = useState([
    {
      serviceName: "",
      serviceCode: "SVC-FOOD",
      price: "",
      quantity: 1,
      duration: "Day",
      discount_percentage: 0,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      notes: "",
    },
  ]);

  // Overall discount
  const [overallDiscount, setOverallDiscount] = useState(0);

  useEffect(() => {
    if (open) {
      loadCatalog();
      loadActiveBookings();

      if (record) {
        setSelectedBooking(record);
        setBookingIdInput(record.booking_id || (record.id ? `GH-${record.id}` : record.guestHouseServiceId || ""));
      } else {
        setSelectedBooking(null);
        setBookingIdInput("");
      }

      setServices([
        {
          serviceName: "",
          serviceCode: "",
          price: "",
          quantity: 1,
          duration: "One-Time",
          discount_percentage: 0,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          notes: "",
        },
      ]);
      setFoodServices([
        {
          serviceName: "",
          serviceCode: "SVC-FOOD",
          price: "",
          quantity: 1,
          duration: "Day",
          discount_percentage: 0,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          notes: "",
        },
      ]);
      setOverallDiscount(0);
    }
  }, [open, record]);

  const loadActiveBookings = async () => {
    try {
      const res = await fetchGHServicesList({ limit: 10 });
      setActiveBookings(res?.data || []);
    } catch (e) {
      console.warn("Could not load bookings for selector:", e);
    }
  };

  const loadCatalog = async () => {
    try {
      const data = await fetchGHServiceCatalog();
      if (Array.isArray(data) && data.length > 0) {
        setCatalogList(data);
      }
    } catch (e) {
      console.warn("Could not load catalog in AddServicesModal:", e);
    }
  };

  // Fallback default catalog presets if catalog is empty
  const displayCatalog =
    catalogList.length > 0
      ? catalogList
      : [
          { service_name: "Airport Transfer (Pickup/Drop)", service_code: "SVC-AIR", default_price: 1500, duration: "One-Time" },
          { service_name: "Attendant / Caregiver", service_code: "SVC-ATT", default_price: 1200, duration: "Day" },
          { service_name: "Breakfast (Daily)", service_code: "SVC-BRK", default_price: 250, duration: "Day" },
          { service_name: "Dinner", service_code: "SVC-DIN", default_price: 350, duration: "Day" },
          { service_name: "Doctor Room Visit", service_code: "SVC-DOC", default_price: 1000, duration: "One-Time" },
          { service_name: "Laundry Service", service_code: "SVC-LAU", default_price: 200, duration: "One-Time" },
          { service_name: "Lunch (Dietary)", service_code: "SVC-LUN", default_price: 350, duration: "Day" },
          { service_name: "Wheelchair Assistance", service_code: "SVC-WCH", default_price: 300, duration: "Day" },
        ];

  // Quick Preset pills
  const amenityPills = [
    { name: "Laundry Service", code: "SVC-LAU", price: 200, duration: "One-Time" },
    { name: "Special Nursing Care", code: "SVC-NUR", price: 1200, duration: "Day" },
    { name: "Airport Drop / Pickup", code: "SVC-AIR", price: 1500, duration: "One-Time" },
    { name: "Wheelchair Assistance", code: "SVC-WCH", price: 300, duration: "Day" },
  ];

  const foodPills = [
    { name: "Breakfast", code: "SVC-BRK", price: 250, duration: "Day" },
    { name: "Lunch", code: "SVC-LUN", price: 350, duration: "Day" },
    { name: "Dinner", code: "SVC-DIN", price: 350, duration: "Day" },
    { name: "Evening Snacks", code: "SVC-SNK", price: 150, duration: "Day" },
  ];

  if (!open) return null;

  const handleBookingSelect = (e) => {
    const val = e.target.value;
    const found = activeBookings.find(
      (b) => String(b.booking_id) === val || String(b.id) === val
    );
    setSelectedBooking(found || null);
    setBookingIdInput(found ? found.booking_id || found.id : val);
  };

  const handleBookingIdChange = (e) => {
    const val = e.target.value;
    setBookingIdInput(val);
    const found = activeBookings.find(
      (b) =>
        String(b.booking_id).toLowerCase() === val.trim().toLowerCase() ||
        String(b.id) === val.trim()
    );
    setSelectedBooking(found || null);
  };

  // --- Amenity Service Handlers ---
  const handleServiceChange = (index, field, value) => {
    setServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleApplyPreset = (catItem) => {
    const last = services[services.length - 1];
    const newObj = {
      serviceName: catItem.service_name || catItem.name,
      serviceCode: catItem.service_code || catItem.code || "",
      price: Number(catItem.default_price || catItem.price || 0),
      quantity: 1,
      duration: catItem.duration || "One-Time",
      discount_percentage: 0,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      notes: catItem.description || "",
    };

    if (services.length === 1 && !last.serviceName && !last.price) {
      setServices([newObj]);
    } else {
      setServices((prev) => [...prev, newObj]);
    }
  };

  const addRow = () => {
    setServices((prev) => [
      ...prev,
      {
        serviceName: "",
        serviceCode: "",
        price: "",
        quantity: 1,
        duration: "One-Time",
        discount_percentage: 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        notes: "",
      },
    ]);
  };

  const removeRow = (index) => {
    if (services.length === 1) {
      setServices([
        {
          serviceName: "",
          serviceCode: "",
          price: "",
          quantity: 1,
          duration: "One-Time",
          discount_percentage: 0,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          notes: "",
        },
      ]);
      return;
    }
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Food & Meal Service Handlers ---
  const handleFoodChange = (index, field, value) => {
    setFoodServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleApplyFoodPreset = (pill) => {
    const last = foodServices[foodServices.length - 1];
    const newObj = {
      serviceName: pill.name,
      serviceCode: pill.code || "SVC-FOOD",
      price: Number(pill.price || 0),
      quantity: 1,
      duration: pill.duration || "Day",
      discount_percentage: 0,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      notes: "",
    };

    if (foodServices.length === 1 && !last.serviceName && !last.price) {
      setFoodServices([newObj]);
    } else {
      setFoodServices((prev) => [...prev, newObj]);
    }
  };

  const addFoodRow = () => {
    setFoodServices((prev) => [
      ...prev,
      {
        serviceName: "",
        serviceCode: "SVC-FOOD",
        price: "",
        quantity: 1,
        duration: "Day",
        discount_percentage: 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        notes: "",
      },
    ]);
  };

  const removeFoodRow = (index) => {
    if (foodServices.length === 1) {
      setFoodServices([
        {
          serviceName: "",
          serviceCode: "SVC-FOOD",
          price: "",
          quantity: 1,
          duration: "Day",
          discount_percentage: 0,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          notes: "",
        },
      ]);
      return;
    }
    setFoodServices((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Toggle & Active State Handlers for Presets & Pills ---
  const isCatalogPresetActive = (cat) => {
    const catName = (cat.service_name || cat.name || "").trim().toLowerCase();
    const catCode = (cat.service_code || cat.code || "").trim().toLowerCase();

    const inAmenities = services.some((s) => {
      const sName = (s.serviceName || "").trim().toLowerCase();
      const sCode = (s.serviceCode || "").trim().toLowerCase();
      return (catName && sName === catName) || (catCode && sCode === catCode);
    });

    if (inAmenities) return true;

    const inFood = foodServices.some((f) => {
      const fName = (f.serviceName || "").trim().toLowerCase();
      const fCode = (f.serviceCode || "").trim().toLowerCase();
      return (catName && fName === catName) || (catCode && fCode === catCode);
    });

    return inFood;
  };

  const handleToggleCatalogPreset = (cat) => {
    const catName = (cat.service_name || cat.name || "").trim().toLowerCase();
    const catCode = (cat.service_code || cat.code || "").trim().toLowerCase();

    // If already in amenities, remove it
    const aIdx = services.findIndex((s) => {
      const sName = (s.serviceName || "").trim().toLowerCase();
      const sCode = (s.serviceCode || "").trim().toLowerCase();
      return (catName && sName === catName) || (catCode && sCode === catCode);
    });
    if (aIdx !== -1) {
      removeRow(aIdx);
      return;
    }

    // If already in food, remove it
    const fIdx = foodServices.findIndex((f) => {
      const fName = (f.serviceName || "").trim().toLowerCase();
      const fCode = (f.serviceCode || "").trim().toLowerCase();
      return (catName && fName === catName) || (catCode && fCode === catCode);
    });
    if (fIdx !== -1) {
      removeFoodRow(fIdx);
      return;
    }

    // Otherwise add it
    const isFoodItem =
      (cat.service_code && cat.service_code.toUpperCase().includes("FOOD")) ||
      (cat.service_code && cat.service_code.toUpperCase().includes("BRK")) ||
      (cat.service_code && cat.service_code.toUpperCase().includes("LUN")) ||
      (cat.service_code && cat.service_code.toUpperCase().includes("DIN")) ||
      (cat.service_name && /breakfast|lunch|dinner|meal|snack|dining|food/i.test(cat.service_name));

    if (isFoodItem) {
      handleApplyFoodPreset({
        name: cat.service_name || cat.name,
        code: cat.service_code || cat.code || "SVC-FOOD",
        price: cat.default_price || cat.price || 0,
        duration: cat.duration || "Day",
      });
    } else {
      handleApplyPreset(cat);
    }
  };

  const isAmenityPillActive = (pill) => {
    const pillName = (pill.name || "").trim().toLowerCase();
    const pillCode = (pill.code || "").trim().toLowerCase();
    return services.some((s) => {
      const sName = (s.serviceName || "").trim().toLowerCase();
      const sCode = (s.serviceCode || "").trim().toLowerCase();
      return (pillName && sName === pillName) || (pillCode && sCode === pillCode);
    });
  };

  const handleToggleAmenityPill = (pill) => {
    const pillName = (pill.name || "").trim().toLowerCase();
    const pillCode = (pill.code || "").trim().toLowerCase();
    const idx = services.findIndex((s) => {
      const sName = (s.serviceName || "").trim().toLowerCase();
      const sCode = (s.serviceCode || "").trim().toLowerCase();
      return (pillName && sName === pillName) || (pillCode && sCode === pillCode);
    });
    if (idx !== -1) {
      removeRow(idx);
    } else {
      handleApplyPreset({
        service_name: pill.name,
        service_code: pill.code,
        default_price: pill.price,
        duration: pill.duration,
      });
    }
  };

  const isFoodPillActive = (pill) => {
    const pillName = (pill.name || "").trim().toLowerCase();
    const pillCode = (pill.code || "").trim().toLowerCase();
    return foodServices.some((f) => {
      const fName = (f.serviceName || "").trim().toLowerCase();
      const fCode = (f.serviceCode || "").trim().toLowerCase();
      return (pillName && fName === pillName) || (pillCode && fCode === pillCode);
    });
  };

  const handleToggleFoodPill = (pill) => {
    const pillName = (pill.name || "").trim().toLowerCase();
    const pillCode = (pill.code || "").trim().toLowerCase();
    const idx = foodServices.findIndex((f) => {
      const fName = (f.serviceName || "").trim().toLowerCase();
      const fCode = (f.serviceCode || "").trim().toLowerCase();
      return (pillName && fName === pillName) || (pillCode && fCode === pillCode);
    });
    if (idx !== -1) {
      removeFoodRow(idx);
    } else {
      handleApplyFoodPreset(pill);
    }
  };

  // Financial calculations
  const calculateListTotal = (list) => {
    return list.reduce((sum, item) => {
      if (!item.serviceName?.trim() && !item.price) return sum;
      const p = Number(item.price) || 0;
      const q = Number(item.quantity) || 1;
      const d = Number(item.discount_percentage) || 0;
      const base = p * q;
      return sum + (d ? base - (base * d) / 100 : base);
    }, 0);
  };

  const amenitiesSubtotal = calculateListTotal(services);
  const foodSubtotal = calculateListTotal(foodServices);
  const grossTotal = amenitiesSubtotal + foodSubtotal;

  const discountVal = Number(overallDiscount) || 0;
  const finalCost = discountVal
    ? Math.max(0, grossTotal - (grossTotal * discountVal) / 100)
    : grossTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const targetBookingId = (
      bookingIdInput ||
      selectedBooking?.booking_id ||
      selectedBooking?.id ||
      record?.booking_id ||
      record?.id ||
      ""
    ).trim();

    if (!targetBookingId) {
      Swal.fire("Validation Error", "Please choose an active stay booking or enter the Booking ID.", "warning");
      return;
    }

    const validAmenities = services.filter((s) => s.serviceName.trim() && Number(s.price) >= 0);
    const validFood = foodServices.filter((s) => s.serviceName.trim() && Number(s.price) >= 0);
    const allAddOns = [...validAmenities, ...validFood];

    if (allAddOns.length === 0) {
      Swal.fire("Validation Error", "Please provide at least one valid service or meal with a name and price.", "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        booking_id: targetBookingId,
        discount_percentage: discountVal,
        services: allAddOns.map((s) => ({
          service_name: s.serviceName.trim(),
          serviceName: s.serviceName.trim(),
          service_code: s.serviceCode?.trim() || undefined,
          serviceCode: s.serviceCode?.trim() || undefined,
          category: s.serviceCode?.startsWith("SVC-FOOD") ? "food" : "amenity",
          unit_price: Number(s.price),
          price: Number(s.price),
          quantity: Number(s.quantity) || 1,
          duration: s.duration,
          discount_percentage: Number(s.discount_percentage) || 0,
          startDate: s.startDate || undefined,
          endDate: s.endDate || undefined,
          dietary_requirements: s.notes?.trim() || undefined,
          notes: s.notes?.trim() || undefined,
        })),
      };

      // Call add-service or create endpoint
      try {
        await addGHMoreServices(targetBookingId, payload);
      } catch (addErr) {
        // Fallback to create endpoint if booking had no services record yet
        await createGHServiceRecord(payload);
      }

      Swal.fire({
        title: "Services Attached!",
        text: `Successfully linked ${allAddOns.length} service(s) to booking ${targetBookingId}.`,
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error attaching services:", err);
      Swal.fire("Error", typeof err === "string" ? err : err?.message || "Failed to attach services", "error");
    } finally {
      setLoading(false);
    }
  };

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
          height: "min(880px, calc(100vh - 40px))",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        },
      }}
    >
      {/* Header (Screenshot 2) */}
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
            <i className="fa fa-concierge-bell fs-5" />
          </div>
          <div>
            <h5 className="mb-0 fw-bold" style={{ fontSize: "17px", color: "#fff" }}>
              Add Services & Billing to Guest House Stay
            </h5>
            <small style={{ color: "rgba(255,255,255,0.88)" }}>
              Link add-on amenities, meals, transport, and payments to a patient's stay
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
        <form id="gh-add-services-link-form" onSubmit={handleSubmit}>
          {/* 1. Select Guest House Stay Booking (Screenshot 2) */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "14px" }}>
              <i className="fa fa-bed text-primary me-2" />
              1. Select Guest House Stay Booking
            </h6>
            <p className="text-muted small mb-2">
              Services and payments link directly to the patient's room stay in the system.
            </p>

            <div className="row g-2 align-items-center">
              <div className="col-md-7">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Choose Active Booking:
                </label>
                <select
                  className="form-select form-select-sm"
                  value={selectedBooking?.booking_id || selectedBooking?.id || ""}
                  onChange={handleBookingSelect}
                >
                  <option value="">-- Choose from Recent Bookings --</option>
                  {activeBookings.map((b) => (
                    <option key={b.id || b.booking_id} value={b.booking_id || b.id}>
                      {b.booking_id || `GH-${b.id}`} • {b.name} ({b.guest_house_name || "Guest House"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-5">
                <label className="form-label small fw-semibold text-dark mb-1">
                  Or Enter Booking ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. GH-2026-000001 or 1"
                  value={bookingIdInput}
                  onChange={handleBookingIdChange}
                  className="form-control form-control-sm"
                />
              </div>
            </div>

            {selectedBooking && (
              <div className="mt-2 p-2 rounded bg-light border text-dark small">
                <strong>Patient:</strong> {selectedBooking.name} (ID: {selectedBooking.user_id}) •{" "}
                <strong>Stay:</strong> {selectedBooking.guest_house_name} ({selectedBooking.checkin} → {selectedBooking.checkout})
              </div>
            )}
          </div>

          {/* Quick Catalog Presets (Screenshot 2) */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-bold text-dark">
                <i className="fa fa-tags text-primary me-1" /> Quick Catalog Presets
              </span>
              <small className="text-muted">Click to add service item</small>
            </div>

            <div className="d-flex flex-wrap gap-2">
              {displayCatalog.map((cat) => {
                const active = isCatalogPresetActive(cat);
                return (
                  <button
                    key={cat.id || cat.service_code || cat.service_name}
                    type="button"
                    className={`gh-catalog-preset-btn ${active ? "active" : ""}`}
                    onClick={() => handleToggleCatalogPreset(cat)}
                    title={active ? `Active: Click to remove ${cat.service_name}` : `Click to add ${cat.service_name}`}
                  >
                    {active ? (
                      <i className="fa fa-check me-1" style={{ fontSize: "11px" }} />
                    ) : null}
                    <span>{cat.service_name}</span>
                    <strong>
                      ₹{Number(cat.default_price || cat.price || 0).toLocaleString()}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Services & Amenities Requested */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="d-flex align-items-center gap-2">
                <h6 className="fw-bold text-dark mb-0" style={{ fontSize: "14px" }}>
                  <i className="fa fa-concierge-bell text-primary me-2" />
                  2. Services & Amenities Requested ({services.length})
                </h6>
                <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: "11px" }}>
                  Optional - add general services
                </span>
              </div>

              {/* Quick Pills for Amenities */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="d-flex flex-wrap gap-1">
                  {amenityPills.map((pill) => {
                    const active = isAmenityPillActive(pill);
                    return (
                      <button
                        key={pill.name}
                        type="button"
                        className={`gh-pill-btn-amenity ${active ? "active" : ""}`}
                        onClick={() => handleToggleAmenityPill(pill)}
                        title={active ? `Active: Click to remove ${pill.name}` : `Click to add ${pill.name}`}
                      >
                        <i className={`fa ${active ? "fa-check" : "fa-plus"} me-1`} style={{ fontSize: "10px" }} />
                        {pill.name}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                  onClick={addRow}
                >
                  <i className="fa fa-plus" /> Add Service Row
                </button>
              </div>
            </div>

            <div className="d-flex flex-column gap-3 mt-2">
              {services.map((item, idx) => {
                const rowBase = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                const rowDisc = ((Number(item.discount_percentage) || 0) * rowBase) / 100;
                const rowFinal = Math.max(0, rowBase - rowDisc);

                return (
                  <div key={idx} className="p-3 border rounded bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="badge bg-secondary text-white" style={{ fontSize: "10.5px" }}>
                        Amenity Service #{idx + 1}
                      </span>
                      {(services.length > 1 || item.serviceName || item.price) && (
                        <button
                          type="button"
                          className="gh-btn-remove-row"
                          onClick={() => removeRow(idx)}
                          title="Remove this service"
                        >
                          <i className="fa fa-trash-alt" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Top inputs line */}
                    <div className="row g-2 align-items-center">
                      <div className="col-md-3">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Service Name:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Laundry, Nursing, Transport..."
                          value={item.serviceName}
                          onChange={(e) => handleServiceChange(idx, "serviceName", e.target.value)}
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Code:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="SVC-..."
                          value={item.serviceCode}
                          onChange={(e) => handleServiceChange(idx, "serviceCode", e.target.value)}
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Unit Price (₹):
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="0"
                          step="any"
                          placeholder="Price"
                          value={item.price}
                          onChange={(e) => handleServiceChange(idx, "price", e.target.value)}
                        />
                      </div>

                      <div className="col-md-1">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Qty:
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleServiceChange(idx, "quantity", e.target.value)}
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Duration:
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={item.duration}
                          onChange={(e) => handleServiceChange(idx, "duration", e.target.value)}
                        >
                          {GH_SERVICE_DURATIONS.map((dur) => (
                            <option key={dur} value={dur}>
                              {dur}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-1">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Disc %:
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="0"
                          max="100"
                          step="any"
                          value={item.discount_percentage}
                          onChange={(e) => handleServiceChange(idx, "discount_percentage", e.target.value)}
                        />
                      </div>

                      <div className="col-md-1 text-end">
                        <label className="form-label text-muted mb-0 d-block" style={{ fontSize: "11px" }}>
                          Row Total:
                        </label>
                        <strong className="text-success small d-block">
                          ₹{rowFinal.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    {/* Bottom inputs line: Date from, Date to, Specific notes/instructions */}
                    <div className="row g-2 mt-1">
                      <div className="col-md-3">
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={item.startDate}
                          onChange={(e) => handleServiceChange(idx, "startDate", e.target.value)}
                          title="Start Date"
                        />
                      </div>
                      <div className="col-md-3">
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={item.endDate}
                          onChange={(e) => handleServiceChange(idx, "endDate", e.target.value)}
                          title="End Date"
                        />
                      </div>
                      <div className="col-md-6">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Specific notes/instructions..."
                          value={item.notes}
                          onChange={(e) => handleServiceChange(idx, "notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Food & Dining / Meal Services Requested */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="d-flex align-items-center gap-2">
                <h6 className="fw-bold text-dark mb-0" style={{ fontSize: "14px" }}>
                  <i className="fa fa-utensils text-warning me-2" />
                  3. Food & Dining / Meal Services Requested ({foodServices.length})
                </h6>
                <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: "11px" }}>
                  Optional - add meals & dietary plans
                </span>
              </div>

              {/* Quick Pills for Meals */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="d-flex flex-wrap gap-1">
                  {foodPills.map((pill) => {
                    const active = isFoodPillActive(pill);
                    return (
                      <button
                        key={pill.name}
                        type="button"
                        className={`gh-pill-btn-food ${active ? "active" : ""}`}
                        onClick={() => handleToggleFoodPill(pill)}
                        title={active ? `Active: Click to remove ${pill.name}` : `Click to add ${pill.name}`}
                      >
                        <i className={`fa ${active ? "fa-check" : "fa-plus"} me-1`} style={{ fontSize: "10px" }} />
                        {pill.name}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm text-dark d-flex align-items-center gap-1"
                  onClick={addFoodRow}
                >
                  <i className="fa fa-plus" /> Add Meal Item
                </button>
              </div>
            </div>

            <div className="d-flex flex-column gap-3 mt-2">
              {foodServices.map((item, idx) => {
                const rowBase = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                const rowDisc = ((Number(item.discount_percentage) || 0) * rowBase) / 100;
                const rowFinal = Math.max(0, rowBase - rowDisc);

                return (
                  <div key={idx} className="p-3 border rounded bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="badge bg-warning text-dark" style={{ fontSize: "10.5px" }}>
                        Meal #{idx + 1}
                      </span>
                      {(foodServices.length > 1 || item.serviceName || item.price) && (
                        <button
                          type="button"
                          className="gh-btn-remove-row"
                          onClick={() => removeFoodRow(idx)}
                          title="Remove this meal item"
                        >
                          <i className="fa fa-trash-alt" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="row g-2 align-items-center">
                      <div className="col-md-3">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Meal Plan / Item:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Breakfast, Lunch, Dinner..."
                          value={item.serviceName}
                          onChange={(e) => handleFoodChange(idx, "serviceName", e.target.value)}
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Code:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="SVC-FOOD"
                          value={item.serviceCode}
                          onChange={(e) => handleFoodChange(idx, "serviceCode", e.target.value)}
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Price (₹):
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="0"
                          step="any"
                          placeholder="Price"
                          value={item.price}
                          onChange={(e) => handleFoodChange(idx, "price", e.target.value)}
                        />
                      </div>

                      <div className="col-md-1">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Persons:
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleFoodChange(idx, "quantity", e.target.value)}
                        />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Frequency:
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={item.duration}
                          onChange={(e) => handleFoodChange(idx, "duration", e.target.value)}
                        >
                          {GH_SERVICE_DURATIONS.map((dur) => (
                            <option key={dur} value={dur}>
                              {dur}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-1">
                        <label className="form-label text-muted mb-0" style={{ fontSize: "11px" }}>
                          Disc %:
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="0"
                          max="100"
                          step="any"
                          value={item.discount_percentage}
                          onChange={(e) => handleFoodChange(idx, "discount_percentage", e.target.value)}
                        />
                      </div>

                      <div className="col-md-1 text-end">
                        <label className="form-label text-muted mb-0 d-block" style={{ fontSize: "11px" }}>
                          Total:
                        </label>
                        <strong className="text-success small d-block">
                          ₹{rowFinal.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="row g-2 mt-1">
                      <div className="col-md-3">
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={item.startDate}
                          onChange={(e) => handleFoodChange(idx, "startDate", e.target.value)}
                          title="Start Date"
                        />
                      </div>
                      <div className="col-md-3">
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={item.endDate}
                          onChange={(e) => handleFoodChange(idx, "endDate", e.target.value)}
                          title="End Date"
                        />
                      </div>
                      <div className="col-md-6">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Dietary requirements (e.g. Vegetarian, diabetic, no salt)..."
                          value={item.notes}
                          onChange={(e) => handleFoodChange(idx, "notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Services Discount (%) and Final Services Cost Breakdown */}
          <div className="card border-0 shadow-sm p-3 mb-3 bg-white" style={{ borderRadius: "10px" }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div className="small text-muted">
                  Amenities: <strong className="text-dark">₹{amenitiesSubtotal.toLocaleString()}</strong>
                </div>
                <div className="small text-muted">
                  Food & Meals: <strong className="text-dark">₹{foodSubtotal.toLocaleString()}</strong>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label className="form-label small fw-semibold text-dark mb-0">
                    Overall Discount (%):
                  </label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "80px" }}
                    min="0"
                    max="100"
                    step="any"
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <span className="small text-muted me-2">Final Services Cost:</span>
                <strong className="fs-5 text-primary">₹{finalCost.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Footer (Screenshot 2: Cancel, Save & Attach Services) */}
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
        <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={onClose}>
          Cancel
        </button>

        <button
          type="submit"
          form="gh-add-services-link-form"
          className="btn btn-primary btn-sm px-4 fw-bold shadow-sm"
          disabled={loading}
          style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
        >
          {loading ? (
            <>
              <i className="fa fa-spinner fa-spin me-1" /> Attaching...
            </>
          ) : (
            <>
              <i className="fa fa-check me-1" /> Save & Attach Services
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
