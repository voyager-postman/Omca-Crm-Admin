import React, { useState, useEffect } from "react";

export const LOCATION_TYPES = [
  "Airport",
  "Hotel",
  "Guest House",
  "Hospital",
  "Residence",
  "Other",
];

export const PICK_DROP_STATUSES = [
  "New",
  "Pending",
  "In Process",
  "Picked Up",
  "On the Way",
  "Dropped",
  "Completed",
  "Cancelled",
];

export const PRESET_MANAGERS = [
  {
    name: "Ravi Kumar",
    phone: "9217993173, 7453 034 087",
    label: "Ravi Kumar - 9217993173, 7453 034 087",
  },
  {
    name: "Shivam Kumar",
    phone: "88905 06958",
    label: "Shivam Kumar - 88905 06958",
  },
  {
    name: "Other",
    phone: "",
    label: "Other (Enter custom driver & vehicle details)",
  },
];

export const TRANSPORT_TIME_PRESETS = [
  "06:00 AM",
  "06:30 AM",
  "07:00 AM",
  "07:30 AM",
  "08:00 AM",
  "08:15 AM",
  "08:30 AM",
  "08:45 AM",
  "09:00 AM",
  "09:15 AM",
  "09:30 AM",
  "09:45 AM",
  "10:00 AM",
  "10:15 AM",
  "10:30 AM",
  "10:45 AM",
  "11:00 AM",
  "11:15 AM",
  "11:30 AM",
  "11:45 AM",
  "12:00 PM",
  "12:15 PM",
  "12:30 PM",
  "12:45 PM",
  "01:00 PM",
  "01:15 PM",
  "01:30 PM",
  "01:45 PM",
  "02:00 PM",
  "02:15 PM",
  "02:30 PM",
  "02:45 PM",
  "03:00 PM",
  "03:15 PM",
  "03:30 PM",
  "03:45 PM",
  "04:00 PM",
  "04:15 PM",
  "04:30 PM",
  "04:45 PM",
  "05:00 PM",
  "05:15 PM",
  "05:30 PM",
  "05:45 PM",
  "06:00 PM",
  "06:30 PM",
  "07:00 PM",
  "07:30 PM",
  "08:00 PM",
  "08:30 PM",
  "09:00 PM",
  "09:30 PM",
  "10:00 PM",
  "10:30 PM",
  "11:00 PM",
  "11:30 PM",
];

export const to12HourFormat = (val) => {
  if (!val) return "";
  const trimmed = String(val).trim();
  if (/AM|PM/i.test(trimmed)) return trimmed;
  const compactMatch = trimmed.match(/^(\d{1,2})(\d{2})$/);
  if (compactMatch) {
    let h = parseInt(compactMatch[1], 10);
    const m = compactMatch[2];
    if (h >= 0 && h <= 24 && parseInt(m, 10) < 60) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
    }
  }
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
  }
  return trimmed;
};

export const AppointmentTransportFields = ({
  data = {},
  onChange,
  disabled = false,
  showModeSelector = true,
  defaultNeedTransport = false,
}) => {
  const mode = data.mode || "offline";
  const isOnline = mode === "online";

  // Determine if transport should be active
  const hasTransportData = Boolean(
    data.hasPickDrop !== undefined
      ? data.hasPickDrop
      : data.pickup_location ||
        data.drop_location ||
        data.pickup_time ||
        data.drop_time ||
        data.vehicle_no ||
        (data.pickup_manager_name && data.pickup_manager_name !== "Ravi Kumar")
  );

  const [needTransport, setNeedTransport] = useState(
    data.hasPickDrop !== undefined
      ? Boolean(data.hasPickDrop)
      : data.needTransport !== undefined
      ? Boolean(data.needTransport)
      : hasTransportData || defaultNeedTransport
  );

  // Sync needTransport if parent updates it
  useEffect(() => {
    if (data.hasPickDrop !== undefined) {
      setNeedTransport(Boolean(data.hasPickDrop));
    } else if (data.needTransport !== undefined) {
      setNeedTransport(Boolean(data.needTransport));
    } else if (hasTransportData) {
      setNeedTransport(true);
    }
  }, [data.hasPickDrop, data.needTransport, hasTransportData]);

  // Determine current manager
  const currentManagerName = data.pickup_manager_name || "Ravi Kumar";
  const isPresetManager =
    currentManagerName === "Ravi Kumar" || currentManagerName === "Shivam Kumar";

  const [selectedManager, setSelectedManager] = useState(
    isPresetManager ? currentManagerName : "Other"
  );

  useEffect(() => {
    if (data.pickup_manager_name === "Ravi Kumar" || data.pickup_manager_name === "Shivam Kumar") {
      setSelectedManager(data.pickup_manager_name);
    } else if (data.pickup_manager_name) {
      setSelectedManager("Other");
    }
  }, [data.pickup_manager_name]);

  const emitUpdates = (updates) => {
    if (typeof onChange === "function") {
      onChange(updates);
    }
  };

  const handleModeChange = (newMode) => {
    emitUpdates({
      mode: newMode,
      ...(newMode === "online" ? { needTransport: false, hasPickDrop: false, hasDriver: false } : {}),
    });
  };

  const handleToggleTransport = (e) => {
    const nextVal = e.target.checked;
    setNeedTransport(nextVal);
    if (nextVal) {
      emitUpdates({
        needTransport: true,
        hasPickDrop: true,
        pickup_location_type: data.pickup_location_type || "",
        drop_location_type: data.drop_location_type || "",
        pickup_manager_name: data.pickup_manager_name || "Ravi Kumar",
        pickup_manager_phone: data.pickup_manager_phone || "9217993173, 7453 034 087",
        driver_name: data.driver_name || data.pickup_manager_name || "Ravi Kumar",
        driver_contact: data.driver_contact || data.pickup_manager_phone || "9217993173, 7453 034 087",
        pickDropStatus: data.pickDropStatus || "New",
      });
    } else {
      emitUpdates({
        needTransport: false,
        hasPickDrop: false,
        hasDriver: false,
        needDriver: false,
        driverAssigned: false,
        pickup_manager_name: null,
        driver_name: null,
        driver_contact: null,
        vehicle_no: null,
      });
    }
  };

  const handleManagerSelect = (mgrName) => {
    setSelectedManager(mgrName);
    if (mgrName === "NONE" || mgrName === "None") {
      emitUpdates({
        hasDriver: false,
        needDriver: false,
        driverAssigned: false,
        pickup_manager_name: null,
        pickup_manager_phone: null,
        driver_name: null,
        driver_contact: null,
        vehicle_no: null,
      });
    } else if (mgrName === "Ravi Kumar") {
      emitUpdates({
        hasDriver: true,
        needDriver: true,
        driverAssigned: true,
        pickup_manager_name: "Ravi Kumar",
        pickup_manager_phone: "9217993173, 7453 034 087",
        driver_name: "Ravi Kumar",
        driver_contact: "9217993173, 7453 034 087",
      });
    } else if (mgrName === "Shivam Kumar") {
      emitUpdates({
        hasDriver: true,
        needDriver: true,
        driverAssigned: true,
        pickup_manager_name: "Shivam Kumar",
        pickup_manager_phone: "88905 06958",
        driver_name: "Shivam Kumar",
        driver_contact: "88905 06958",
      });
    } else {
      // Other
      emitUpdates({
        hasDriver: true,
        needDriver: true,
        driverAssigned: true,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
      });
    }
  };

  return (
    <div className="appointment-transport-container" style={{ width: "100%" }}>
      {/* 1. Mode Selector */}
      {showModeSelector && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
          }}
        >
          <label
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              display: "block",
              marginBottom: "8px",
            }}
          >
            <i className="fa-solid fa-laptop-medical text-primary me-2"></i>
            Appointment Mode
          </label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleModeChange("offline")}
              style={{
                flex: "1 1 180px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: mode === "offline" ? "2px solid #0f766e" : "1px solid #cbd5e1",
                background: mode === "offline" ? "#f0fdfa" : "#ffffff",
                color: mode === "offline" ? "#0f766e" : "#475569",
                fontWeight: mode === "offline" ? 600 : 500,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <i className="fa-solid fa-hospital-user"></i>
              Offline (Hospital / In-Person)
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => handleModeChange("online")}
              style={{
                flex: "1 1 180px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: mode === "online" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                background: mode === "online" ? "#f0f9ff" : "#ffffff",
                color: mode === "online" ? "#0284c7" : "#475569",
                fontWeight: mode === "online" ? 600 : 500,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <i className="fa-solid fa-video"></i>
              Online (Teleconsultation)
            </button>
          </div>

          {isOnline && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "12px",
                color: "#0369a1",
                background: "#e0f2fe",
                padding: "6px 12px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <i className="fa-solid fa-circle-info"></i>
              Online appointment selected. Airport/Hospital transport is disabled for virtual consultations.
            </div>
          )}
        </div>
      )}

      {/* 2. Transport Section (for Offline Appointments) */}
      {!isOnline && (
        <div
          style={{
            background: "#ffffff",
            border: needTransport ? "1.5px solid #22c7b8" : "1px solid #e2e8f0",
            borderRadius: "10px",
            overflow: "hidden",
            marginBottom: "16px",
            boxShadow: needTransport ? "0 2px 10px rgba(34, 199, 184, 0.12)" : "none",
            transition: "all 0.25s ease",
          }}
        >
          {/* Header Bar with Toggle */}
          <div
            style={{
              padding: "12px 16px",
              background: needTransport
                ? "linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)"
                : "#f8fafc",
              borderBottom: needTransport ? "1px solid #ccfbf1" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: needTransport ? "#0f766e" : "#94a3b8",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                }}
              >
                <i className="fa-solid fa-van-shuttle"></i>
              </div>
              <div>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", display: "block" }}>
                  Pick & Drop / Transport Service
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Airport, hotel pickup, hospital drop, driver assignment & tracking
                </span>
              </div>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: disabled ? "not-allowed" : "pointer",
                margin: 0,
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={needTransport}
                disabled={disabled}
                onChange={handleToggleTransport}
                style={{
                  width: "18px",
                  height: "18px",
                  accentColor: "#0f766e",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: needTransport ? "#0f766e" : "#64748b",
                }}
              >
                {needTransport ? "Enable Pick & Drop" : "Enable Pick & Drop (Off)"}
              </span>
            </label>
          </div>

          {/* Form Body if Transport is Enabled */}
          {needTransport && (
            <div style={{ padding: "16px" }}>
              {/* Row 1: Pickup Information */}
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#0f766e",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <i className="fa-solid fa-plane-arrival"></i>
                Pickup Details
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      Pickup Address / Location
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={data.pickup_location || ""}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ pickup_location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      Location Type
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={data.pickup_location_type || ""}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ pickup_location_type: e.target.value })}
                    >
                      <option value="">Select Location Type</option>
                      {LOCATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      <i className="fa-solid fa-clock text-teal me-1"></i>
                      Pickup Time
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. 08:00 AM"
                      list="transport_pickup_time_presets"
                      value={data.pickup_time || ""}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ pickup_time: e.target.value })}
                      onBlur={(e) => {
                        const formatted = to12HourFormat(e.target.value);
                        if (formatted !== e.target.value) {
                          emitUpdates({ pickup_time: formatted });
                        }
                      }}
                    />
                    <datalist id="transport_pickup_time_presets">
                      {TRANSPORT_TIME_PRESETS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Row 2: Drop Information */}
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#0f766e",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <i className="fa-solid fa-flag-checkered text-success"></i>
                Drop Details
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-5">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      <i className="fa-solid fa-flag-checkered text-success me-1"></i>
                      Drop Address / Destination
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Artemis Hospital / Hotel"
                      value={data.drop_location || ""}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ drop_location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-md-2">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      Drop Location Type
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={data.drop_location_type || ""}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ drop_location_type: e.target.value })}
                    >
                      <option value="">Select Type</option>
                      {LOCATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-md-2">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      <i className="fa-solid fa-clock text-teal me-1"></i>
                      Drop Time
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. 11:30 AM"
                      list="transport_drop_time_presets"
                      value={data.drop_time || ""}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ drop_time: e.target.value })}
                      onBlur={(e) => {
                        const formatted = to12HourFormat(e.target.value);
                        if (formatted !== e.target.value) {
                          emitUpdates({ drop_time: formatted });
                        }
                      }}
                    />
                    <datalist id="transport_drop_time_presets">
                      {TRANSPORT_TIME_PRESETS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="field-set">
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      Initial Duty Status
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={data.pickDropStatus || "New"}
                      disabled={disabled}
                      onChange={(e) => emitUpdates({ pickDropStatus: e.target.value })}
                    >
                      {PICK_DROP_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 3: Driver & Vehicle Assignment */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#0f766e",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <i className="fa-solid fa-id-badge text-secondary"></i>
                  Driver & Vehicle Assignment
                </div>

                <label
                  htmlFor="transportHasDriverToggle"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    background:
                      data.hasDriver !== false && selectedManager !== "NONE"
                        ? "#ecfdf5"
                        : "#f8fafc",
                    border: `1.5px solid ${
                      data.hasDriver !== false && selectedManager !== "NONE"
                        ? "#10b981"
                        : "#cbd5e1"
                    }`,
                    borderRadius: "20px",
                    padding: "4px 12px",
                    margin: 0,
                    userSelect: "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "36px",
                      height: "20px",
                      backgroundColor:
                        data.hasDriver !== false && selectedManager !== "NONE"
                          ? "#059669"
                          : "#cbd5e1",
                      borderRadius: "20px",
                      transition: "background-color 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      id="transportHasDriverToggle"
                      checked={data.hasDriver !== false && selectedManager !== "NONE"}
                      disabled={disabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!checked) {
                          setSelectedManager("NONE");
                          emitUpdates({
                            hasDriver: false,
                            needDriver: false,
                            driverAssigned: false,
                            pickup_manager_name: null,
                            pickup_manager_phone: null,
                            driver_name: null,
                            driver_contact: null,
                            vehicle_no: null,
                          });
                        } else {
                          setSelectedManager("Ravi Kumar");
                          emitUpdates({
                            hasDriver: true,
                            needDriver: true,
                            driverAssigned: true,
                            pickup_manager_name: "Ravi Kumar",
                            pickup_manager_phone: "9217993173, 7453 034 087",
                            driver_name: "Ravi Kumar",
                            driver_contact: "9217993173, 7453 034 087",
                          });
                        }
                      }}
                      style={{
                        position: "absolute",
                        opacity: 0,
                        width: "100%",
                        height: "100%",
                        margin: 0,
                        cursor: disabled ? "not-allowed" : "pointer",
                        zIndex: 2,
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: "2px",
                        left:
                          data.hasDriver !== false && selectedManager !== "NONE"
                            ? "18px"
                            : "2px",
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "50%",
                        transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color:
                        data.hasDriver !== false && selectedManager !== "NONE"
                          ? "#065f46"
                          : "#64748b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {data.hasDriver !== false && selectedManager !== "NONE"
                      ? "Assign Driver"
                      : "No Driver"}
                  </span>
                </label>
              </div>

              {data.hasDriver === false || selectedManager === "NONE" ? (
                <div
                  className="p-2 mb-2 rounded"
                  style={{
                    background: "#f8fafc",
                    border: "1px dashed #94a3b8",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <i className="fa-solid fa-ban text-secondary" style={{ fontSize: 16 }}></i>
                  <div>
                    <strong style={{ fontSize: 12, color: "#334155" }}>
                      No Driver / Vehicle Assigned
                    </strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      Patient will arrange own transit. Zero driver duty or WhatsApp alerts will be dispatched.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row g-2 mb-2">
                    <div className="col-md-7">
                      <div className="field-set">
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                          Pickup Manager / Driver Preset
                        </label>
                        <select
                          className="form-select form-select-sm"
                          style={{ fontWeight: 600 }}
                          value={selectedManager}
                          disabled={disabled}
                          onChange={(e) => handleManagerSelect(e.target.value)}
                        >
                          <option value="NONE">None (No Driver Needed)</option>
                          {PRESET_MANAGERS.map((mgr) => (
                            <option key={mgr.name} value={mgr.name}>
                              {mgr.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="col-md-5">
                      <div className="field-set">
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                          Vehicle Number
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. DL 01 AB 1234"
                          value={data.vehicle_no || ""}
                          disabled={disabled}
                          onChange={(e) => emitUpdates({ vehicle_no: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Driver inputs if "Other" is selected */}
                  {selectedManager === "Other" && (
                    <div
                      className="row g-2 p-2 mt-1"
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #cbd5e1",
                        borderRadius: "8px",
                      }}
                    >
                      <div className="col-md-6">
                        <div className="field-set">
                          <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                            Driver / Manager Name
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Ramesh Kumar"
                            value={data.driver_name || data.pickup_manager_name || ""}
                            disabled={disabled}
                            onChange={(e) =>
                              emitUpdates({
                                driver_name: e.target.value,
                                pickup_manager_name: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="field-set">
                          <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                            Driver Contact Number
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="+91 98765 43210"
                            value={data.driver_contact || data.pickup_manager_phone || ""}
                            disabled={disabled}
                            onChange={(e) =>
                              emitUpdates({
                                driver_contact: e.target.value,
                                pickup_manager_phone: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentTransportFields;
