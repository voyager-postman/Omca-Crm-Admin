import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Dialog, CircularProgress, Autocomplete, TextField } from "@mui/material";
import { baseurl, AdminBaseUrl } from "../../Basurl/Baseurl";
import PatientSearchSelect from "../../components/PatientSearchSelect";

const LOCATION_TYPES = [
  "Airport",
  "Hotel",
  "Guest House",
  "Hospital",
  "Residence",
  "Other",
];

const STATUSES = [
  "New",
  "Pending",
  "In Process",
  "Picked Up",
  "On the Way",
  "Dropped",
  "Completed",
  "Cancelled",
];

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const customAutocompleteSx = {
  width: "100%",
  "& .MuiOutlinedInput-root": {
    minHeight: "38px",
    padding: "2px 8px !important",
    borderRadius: "8px",
    fontSize: "13px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    transition: "all 0.2s ease",
    "&:hover": {
      borderColor: "#94a3b8",
    },
    "&.Mui-focused": {
      borderColor: "#22c7b8",
      boxShadow: "0 0 0 3px rgba(34, 199, 184, 0.15)",
    },
    "& fieldset": {
      border: "none",
    },
  },
  "& .MuiInputBase-input": {
    padding: "4px 4px !important",
    fontSize: "13px",
    color: "#1e293b",
  },
  "& .MuiAutocomplete-endAdornment": {
    top: "calc(50% - 14px)",
  },
  "& .MuiAutocomplete-popupIndicator": {
    color: "#64748b",
    padding: "2px",
  },
  "& .MuiAutocomplete-clearIndicator": {
    color: "#94a3b8",
    padding: "2px",
  },
};

export const CreatePickDropAppointmentModal = ({
  open,
  onClose,
  pickupManagers = [],
  onSuccess,
}) => {
  const [saving, setSaving] = useState(false);
  const [selectedManager, setSelectedManager] = useState("Ravi Kumar");
  const [isCustomDriver, setIsCustomDriver] = useState(false);

  // Dropdown states
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [manualPatientMode, setManualPatientMode] = useState(false);
  const [hospitalsList, setHospitalsList] = useState([]);
  const [masterTreatments, setMasterTreatments] = useState([]);
  const [patientTreatments, setPatientTreatments] = useState([]);
  const [loadingPatientTreatments, setLoadingPatientTreatments] = useState(false);

  const [form, setForm] = useState({
    patientId: "",
    patientName: "",
    treatment_id: "",
    treatment_name: "",
    hospitalId: "",
    hospital_id: "",
    hospitalName: "",
    hospital_Name: "",
    appointment_Date: new Date().toISOString().split("T")[0],
    appointment_Time: "10:30 AM to 12:30 PM",
    mode: "offline",
    note: "",
    pickup_time: "",
    pickup_location: "",
    pickup_location_type: "",
    drop_location: "",
    drop_location_type: "",
    hasDriver: true,
    pickup_manager_name: "Ravi Kumar",
    pickup_manager_phone: "9217993173, 7453 034 087",
    vehicle_no: "",
    pickDropStatus: "New",
  });

  // Fetch Hospitals & Master Treatments on modal open
  useEffect(() => {
    if (open) {
      axios
        .post(`${AdminBaseUrl}hospital_list`, {}, { headers: getHeaders() })
        .then((res) => {
          if (res.data?.success !== false && Array.isArray(res.data?.data)) {
            setHospitalsList(res.data.data);
          }
        })
        .catch((err) => {
          console.error("Error fetching hospital list:", err);
        });

      axios
        .post(`${AdminBaseUrl}treatment_list`, {}, { headers: getHeaders() })
        .then((res) => {
          if (res.data?.success !== false && Array.isArray(res.data?.data)) {
            setMasterTreatments(res.data.data);
          }
        })
        .catch((err) => {
          console.error("Error fetching treatment list:", err);
        });
    }
  }, [open]);

  // Handle Patient Selection from Search Dropdown
  const handlePatientSelect = async (patient) => {
    setSelectedPatient(patient);
    if (!patient) {
      setForm((prev) => ({
        ...prev,
        patientId: "",
        patientName: "",
        treatment_id: "",
        treatment_name: "",
      }));
      setPatientTreatments([]);
      return;
    }

    const pId =
      patient.displayId ||
      patient.patientNumber ||
      patient.patientId ||
      patient.patient_id ||
      patient._id ||
      "";
    const pName =
      patient.name ||
      patient.patient_name ||
      patient.patientName ||
      "";

    setForm((prev) => ({
      ...prev,
      patientId: pId,
      patientName: pName,
    }));

    const rawId = patient.patientId || patient.patient_id || patient._id || pId;
    if (rawId) {
      fetchPatientTreatments(rawId);
    }
  };

  const fetchPatientTreatments = async (pId) => {
    if (!pId) {
      setPatientTreatments([]);
      return;
    }
    setLoadingPatientTreatments(true);
    try {
      const res = await axios.get(`${baseurl}get_patient/${pId}`, {
        headers: getHeaders(),
      });
      const treatments =
        res?.data?.detail?.treatments ||
        res?.data?.detail?.treatment ||
        res?.data?.treatments ||
        res?.data?.data?.treatments ||
        [];
      const list = Array.isArray(treatments) ? treatments : [];
      setPatientTreatments(list);

      // Auto-select if patient has exactly 1 treatment and none selected yet
      if (list.length === 1) {
        const t = list[0];
        const tId = String(t.treatment_id || t.id || t._id || "");
        const tName = t.treatment_name || t.disease_name || t.name || tId;
        setForm((prev) => ({
          ...prev,
          treatment_id: tId,
          treatment_name: tName,
        }));
      }
    } catch (err) {
      console.warn("Could not fetch patient treatments:", err);
      setPatientTreatments([]);
    } finally {
      setLoadingPatientTreatments(false);
    }
  };

  // Hospital options
  const hospitalOptions = useMemo(() => {
    return (hospitalsList || []).map((h) => ({
      id: h.id ?? h._id ?? "",
      name: h.name ?? h.hospital_Name ?? "",
      email: h.email ?? "",
      city: h.city ?? "",
    }));
  }, [hospitalsList]);

  // Treatment options (Patient assigned treatments first, then master treatments)
  const treatmentOptions = useMemo(() => {
    const list = [];
    if (patientTreatments && patientTreatments.length > 0) {
      patientTreatments.forEach((pt) => {
        const id = String(pt.treatment_id || pt.id || pt._id || "");
        const name = pt.treatment_name || pt.disease_name || pt.name || id;
        list.push({
          id,
          name,
          category: "Patient's Assigned Treatments",
        });
      });
    }
    if (masterTreatments && masterTreatments.length > 0) {
      masterTreatments.forEach((mt) => {
        const id = String(mt.id || mt._id || "");
        const name = mt.name || mt.treatment_name || id;
        const exists = list.some(
          (existing) =>
            String(existing.id) === id ||
            existing.name.toLowerCase() === name.toLowerCase()
        );
        if (!exists) {
          list.push({
            id,
            name,
            category: "All System Treatments",
          });
        }
      });
    }
    return list;
  }, [patientTreatments, masterTreatments]);

  // Handle Hospital Selection
  const handleHospitalChange = (val) => {
    if (!val) {
      setForm((prev) => ({
        ...prev,
        hospitalId: "",
        hospital_id: "",
        hospitalName: "",
        hospital_Name: "",
      }));
      return;
    }

    let hId = "";
    let hName = "";

    if (typeof val === "string") {
      hId = val;
      hName = val;
    } else {
      hId = String(val.id || val._id || "");
      hName = val.name || val.hospital_Name || "";
    }

    setForm((prev) => {
      // Auto-populate drop location if blank or default
      const shouldUpdateDrop =
        !prev.drop_location ||
        prev.drop_location === "Fortis Memorial Research Institute, Gurugram";
      return {
        ...prev,
        hospitalId: hId,
        hospital_id: hId,
        hospitalName: hName,
        hospital_Name: hName,
        drop_location: shouldUpdateDrop ? hName : prev.drop_location,
        drop_location_type: shouldUpdateDrop ? "Hospital" : prev.drop_location_type,
      };
    });
  };

  const handleManagerChange = (managerName) => {
    setSelectedManager(managerName);
    if (managerName === "NONE" || managerName === "None") {
      setForm((prev) => ({
        ...prev,
        hasDriver: false,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
        vehicle_no: "",
      }));
      setIsCustomDriver(false);
    } else if (managerName === "Ravi Kumar") {
      setForm((prev) => ({
        ...prev,
        hasDriver: true,
        pickup_manager_name: "Ravi Kumar",
        pickup_manager_phone: "9217993173, 7453 034 087",
        driver_name: "Ravi Kumar",
        driver_contact: "9217993173, 7453 034 087",
      }));
      setIsCustomDriver(false);
    } else if (managerName === "Shivam Kumar") {
      setForm((prev) => ({
        ...prev,
        hasDriver: true,
        pickup_manager_name: "Shivam Kumar",
        pickup_manager_phone: "88905 06958",
        driver_name: "Shivam Kumar",
        driver_contact: "88905 06958",
      }));
      setIsCustomDriver(false);
    } else {
      // "Other" selected -> allow staff to enter custom driver details
      setForm((prev) => ({
        ...prev,
        hasDriver: true,
        pickup_manager_name: "",
        pickup_manager_phone: "",
        driver_name: "",
        driver_contact: "",
        vehicle_no: "",
      }));
      setIsCustomDriver(true);
    }
  };

  const handleToggleHasDriver = (checked) => {
    setForm((prev) => ({
      ...prev,
      hasDriver: checked,
      ...(checked
        ? {
            pickup_manager_name: prev.pickup_manager_name || "Ravi Kumar",
            pickup_manager_phone: prev.pickup_manager_phone || "9217993173, 7453 034 087",
            driver_name: prev.driver_name || "Ravi Kumar",
            driver_contact: prev.driver_contact || "9217993173, 7453 034 087",
          }
        : {
            pickup_manager_name: "",
            pickup_manager_phone: "",
            driver_name: "",
            driver_contact: "",
            vehicle_no: "",
          }),
    }));
    if (checked) {
      if (selectedManager === "NONE" || selectedManager === "None") {
        setSelectedManager("Ravi Kumar");
        setIsCustomDriver(false);
      }
    } else {
      setSelectedManager("NONE");
      setIsCustomDriver(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.patientId.trim()) {
      Swal.fire("Validation Error", "Patient ID is required. Please select or enter a patient.", "warning");
      return;
    }
    if (!form.appointment_Date) {
      Swal.fire("Validation Error", "Appointment date is required", "warning");
      return;
    }
    if (!form.pickup_location?.trim()) {
      Swal.fire("Validation Error", "Please enter Pickup Location", "warning");
      return;
    }
    if (!form.drop_location?.trim()) {
      Swal.fire("Validation Error", "Please enter Drop Location", "warning");
      return;
    }

    const isDriverAssigned = Boolean(
      form.mode !== "online" &&
      form.hasDriver !== false &&
      selectedManager !== "NONE" &&
      selectedManager !== "None"
    );

    const payload = {
      ...form,
      patientId: form.patientId.trim(),
      patient_id: form.patientId.trim(),
      patientName: form.patientName || "",
      patient_name: form.patientName || "",
      treatment_id: form.treatment_id || "",
      treatment_name: form.treatment_name || "",
      treatmentName: form.treatment_name || "",
      hospital_id: form.hospitalId || form.hospital_id || "",
      hospitalId: form.hospitalId || form.hospital_id || "",
      hospitalName: form.hospitalName || "",
      hospital_Name: form.hospitalName || "",
      hasPickDrop: true,
      needPickDrop: true,
      hasDriver: isDriverAssigned,
      needDriver: isDriverAssigned,
      driverAssigned: isDriverAssigned,
      ...(isDriverAssigned
        ? {
            pickup_manager_name: form.pickup_manager_name || selectedManager || "Ravi Kumar",
            driver_name: form.driver_name || form.pickup_manager_name || selectedManager || "Ravi Kumar",
            driver_contact: form.driver_contact || form.pickup_manager_phone || "",
            vehicle_no: form.vehicle_no || "",
          }
        : {
            pickup_manager_name: null,
            driver_name: null,
            driver_contact: null,
            vehicle_no: null,
          }),
    };

    setSaving(true);
    try {
      const userId = localStorage.getItem("_id") || "";
      let response;
      try {
        response = await axios.post(`${baseurl}create_appointment`, payload, {
          headers: getHeaders(),
        });
      } catch (postErr) {
        if (userId) {
          response = await axios.post(
            `${baseurl}create_appointment/${userId}`,
            payload,
            { headers: getHeaders() }
          );
        } else {
          throw postErr;
        }
      }

      if (response?.data?.success === false) {
        throw new Error(response?.data?.message || "Failed to create appointment");
      }

      Swal.fire({
        icon: "success",
        title: "Appointment Scheduled!",
        text: response?.data?.message || "Pick & Drop appointment scheduled successfully!",
        timer: 2500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message ||
          err?.message ||
          "Could not schedule appointment. Please check required fields.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      scroll="paper"
      className="create-pickdrop-dialog pickdrop-modal-dialog"
      onClose={() => !saving && onClose()}
      sx={{
        "& .MuiDialog-container": {
          height: "100vh !important",
          maxHeight: "100vh !important",
          padding: "12px !important",
          alignItems: "center !important",
          justifyContent: "center !important",
          overflow: "hidden !important",
        },
        "& .MuiDialog-paper, & .MuiPaper-root": {
          margin: "0 !important",
          width: "100% !important",
          height: "min(90vh, 840px) !important",
          maxHeight: "calc(100vh - 24px) !important",
          display: "flex !important",
          flexDirection: "column !important",
          borderRadius: "16px !important",
          overflow: "hidden !important",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35) !important",
          backgroundColor: "#ffffff !important",
        },
      }}
    >
      {/* 1. FIXED MODAL HEADER (Never scrolls away) */}
      <div className="pickdrop-modal-header" style={{ flex: "0 0 auto" }}>
        <div className="header-left">
          <div className="header-icon-box">
            <i className="fa-solid fa-car-side"></i>
          </div>
          <div>
            <h5 className="modal-title">Schedule Pick & Drop Appointment</h5>
            <p className="modal-subtitle">
              Book patient transit duty, assign pickup manager & specify locations
            </p>
          </div>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          disabled={saving}
          onClick={onClose}
          title="Close modal"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* 2. SCROLLABLE FORM BODY (Scrolls all fields smoothly) */}
      <div
        className="pickdrop-modal-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <form id="createPickDropForm" onSubmit={handleSubmit}>
          {/* SECTION 1: Patient & Appointment Details */}
          <div className="form-section-card">
            <div className="section-header">
              <h6 className="section-title">
                <span className="section-step-badge">1</span>
                Patient & Appointment Details
              </h6>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Basic Booking Information
              </span>
            </div>
            <div className="section-body">
              <div className="row g-3">
                {/* 1. Patient Dropdown / Search */}
                <div className="col-md-4">
                  <div className="form-field-wrapper">
                    <label className="form-field-label d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <span>Patient</span>
                        <span className="req-star">* required</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none"
                        style={{ fontSize: "11px", color: "#0f766e", fontWeight: 600 }}
                        onClick={() => setManualPatientMode((m) => !m)}
                      >
                        {manualPatientMode ? (
                          <>
                            <i className="fa-solid fa-magnifying-glass me-1"></i>Search Patient
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-keyboard me-1"></i>Manual ID
                          </>
                        )}
                      </button>
                    </label>

                    {!manualPatientMode ? (
                      <PatientSearchSelect
                        value={selectedPatient}
                        onChange={handlePatientSelect}
                        placeholder="Search patient by Name, ID, or Phone..."
                      />
                    ) : (
                      <input
                        className="custom-input"
                        placeholder="e.g. OMCA26090973"
                        value={form.patientId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((prev) => ({ ...prev, patientId: val }));
                          if (val.trim()) {
                            fetchPatientTreatments(val.trim());
                          }
                        }}
                        required
                      />
                    )}

                    {selectedPatient && !manualPatientMode && (
                      <div
                        style={{
                          fontSize: "11.5px",
                          marginTop: "5px",
                          padding: "3px 8px",
                          background: "#f0fdf4",
                          color: "#166534",
                          borderRadius: "6px",
                          border: "1px solid #bbf7d0",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <i className="fa-solid fa-circle-check text-success"></i>
                        <span>
                          <strong>{selectedPatient.name}</strong> • ID:{" "}
                          <code>{selectedPatient.displayId || form.patientId}</code>
                          {selectedPatient.phone ? ` • ${selectedPatient.phone}` : ""}
                        </span>
                      </div>
                    )}
                    {loadingPatientTreatments && (
                      <div style={{ fontSize: "11px", color: "#0f766e", marginTop: "4px" }}>
                        <CircularProgress size={10} sx={{ color: "#0f766e", marginRight: "4px" }} />
                        Loading patient treatments...
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Treatment Dropdown (Patient's treatments + Master treatments) */}
                <div className="col-md-4">
                  <div className="form-field-wrapper">
                    <label className="form-field-label d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <span>Treatment</span>
                        <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>Optional</span>
                      </div>
                      {patientTreatments.length > 0 && (
                        <span className="badge bg-light text-success border border-success" style={{ fontSize: "10px" }}>
                          {patientTreatments.length} patient treatment{patientTreatments.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </label>
                    <Autocomplete
                      freeSolo
                      options={treatmentOptions}
                      groupBy={(option) => option.category || "Treatments"}
                      getOptionLabel={(option) => {
                        if (typeof option === "string") return option;
                        return option?.name
                          ? `${option.name}${option.id ? ` (${option.id})` : ""}`
                          : "";
                      }}
                      isOptionEqualToValue={(option, val) => {
                        if (!val) return false;
                        if (typeof val === "string") return option.name === val || option.id === val;
                        return option.id === val.id || option.name === val.name;
                      }}
                      value={
                        treatmentOptions.find(
                          (t) =>
                            String(t.id) === String(form.treatment_id) ||
                            (form.treatment_name &&
                              t.name.toLowerCase() === form.treatment_name.toLowerCase())
                        ) ||
                        (form.treatment_id
                          ? {
                              id: form.treatment_id,
                              name: form.treatment_name || form.treatment_id,
                            }
                          : null)
                      }
                      onChange={(_, newValue) => {
                        if (!newValue) {
                          setForm((prev) => ({
                            ...prev,
                            treatment_id: "",
                            treatment_name: "",
                          }));
                        } else if (typeof newValue === "string") {
                          setForm((prev) => ({
                            ...prev,
                            treatment_id: newValue,
                            treatment_name: newValue,
                          }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            treatment_id: newValue.id,
                            treatment_name: newValue.name,
                          }));
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search treatment or Tx-..."
                          sx={customAutocompleteSx}
                        />
                      )}
                      ListboxProps={{ style: { maxHeight: 260 } }}
                    />
                  </div>
                </div>

                {/* 3. Hospital Dropdown (All Hospitals from Master list) */}
                <div className="col-md-4">
                  <div className="form-field-wrapper">
                    <label className="form-field-label mb-1">
                      <span>Hospital ID / Name</span>
                    </label>
                    <Autocomplete
                      freeSolo
                      options={hospitalOptions}
                      getOptionLabel={(option) => {
                        if (typeof option === "string") return option;
                        return option?.name
                          ? `${option.name}${option.id ? ` (ID: ${option.id})` : ""}${option.city ? ` - ${option.city}` : ""}`
                          : "";
                      }}
                      isOptionEqualToValue={(option, val) => {
                        if (!val) return false;
                        if (typeof val === "string") return option.name === val || String(option.id) === val;
                        return String(option.id) === String(val.id) || option.name === val.name;
                      }}
                      value={
                        hospitalOptions.find(
                          (h) =>
                            String(h.id) === String(form.hospitalId) ||
                            (form.hospitalName &&
                              h.name.toLowerCase() === form.hospitalName.toLowerCase())
                        ) ||
                        (form.hospitalId
                          ? {
                              id: form.hospitalId,
                              name: form.hospitalName || form.hospitalId,
                            }
                          : null)
                      }
                      onChange={(_, newValue) => handleHospitalChange(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search hospital name or ID..."
                          sx={customAutocompleteSx}
                        />
                      )}
                      ListboxProps={{ style: { maxHeight: 260 } }}
                    />
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Appointment Date</span>
                      <span className="req-star">*</span>
                    </label>
                    <input
                      type="date"
                      className="custom-input"
                      value={form.appointment_Date}
                      onChange={(e) =>
                        setForm({ ...form, appointment_Date: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Appointment Time</span>
                    </label>
                    <input
                      className="custom-input"
                      list="appointment_time_presets"
                      placeholder="10:30 AM to 12:30 PM"
                      value={form.appointment_Time}
                      onChange={(e) =>
                        setForm({ ...form, appointment_Time: e.target.value })
                      }
                    />
                    <datalist id="appointment_time_presets">
                      <option value="09:00 AM to 11:00 AM" />
                      <option value="10:30 AM to 12:30 PM" />
                      <option value="11:00 AM to 01:00 PM" />
                      <option value="01:30 PM to 03:30 PM" />
                      <option value="02:00 PM to 04:00 PM" />
                      <option value="04:00 PM to 06:00 PM" />
                    </datalist>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Consultation Mode</span>
                    </label>
                    <select
                      className="custom-input"
                      value={form.mode}
                      onChange={(e) =>
                        setForm({ ...form, mode: e.target.value })
                      }
                    >
                      <option value="offline">Offline (In-Person / Transit)</option>
                      <option value="online">Online Consultation</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Pick & Drop Route & Timing */}
          <div className="form-section-card">
            <div className="section-header">
              <h6 className="section-title">
                <span className="section-step-badge">2</span>
                Pick & Drop Locations & Timing
              </h6>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Route, Timings & Destination
              </span>
            </div>
            <div className="section-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>
                        <i className="fa-solid fa-location-dot text-primary me-1"></i>
                        Pickup Location
                      </span>
                      <span className="req-star">*</span>
                    </label>
                    <input
                      className="custom-input"
                      list="pickup_location_presets"
                      value={form.pickup_location}
                      onChange={(e) =>
                        setForm({ ...form, pickup_location: e.target.value })
                      }
                    />
                    <datalist id="pickup_location_presets">
                      <option value="Terminal 3, IGI Airport, New Delhi" />
                      <option value="Terminal 2, IGI Airport, New Delhi" />
                      <option value="Terminal 1, IGI Airport, New Delhi" />
                      <option value="New Delhi Railway Station (NDLS)" />
                      <option value="Hazrat Nizamuddin Railway Station (NZM)" />
                      <option value="Old Delhi Railway Station (DLI)" />
                      <option value="Patient Hotel / Accommodation" />
                    </datalist>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Pickup Location Type</span>
                    </label>
                    <select
                      className="custom-input"
                      value={form.pickup_location_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pickup_location_type: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Location Type</option>
                      {LOCATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>
                        <i className="fa-solid fa-clock text-teal me-1"></i>
                        Pickup Time
                      </span>
                    </label>
                    <input
                      className="custom-input"
                      list="pickup_time_presets"
                      value={form.pickup_time}
                      onChange={(e) =>
                        setForm({ ...form, pickup_time: e.target.value })
                      }
                    />
                    <datalist id="pickup_time_presets">
                      <option value="08:00 AM" />
                      <option value="08:30 AM" />
                      <option value="09:00 AM" />
                      <option value="09:30 AM" />
                      <option value="10:00 AM" />
                      <option value="10:30 AM" />
                      <option value="11:00 AM" />
                      <option value="11:30 AM" />
                      <option value="12:00 PM" />
                      <option value="01:00 PM" />
                      <option value="02:00 PM" />
                      <option value="03:30 PM" />
                      <option value="05:00 PM" />
                    </datalist>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>
                        <i className="fa-solid fa-flag-checkered text-success me-1"></i>
                        Drop Location
                      </span>
                      <span className="req-star">*</span>
                    </label>
                    <input
                      className="custom-input"
                      list="drop_location_presets"
                      value={form.drop_location}
                      onChange={(e) =>
                        setForm({ ...form, drop_location: e.target.value })
                      }
                    />
                    <datalist id="drop_location_presets">
                      {hospitalOptions.slice(0, 30).map((h) => (
                        <option key={`dl-hosp-${h.id}`} value={h.name} />
                      ))}
                      <option value="Terminal 3, IGI Airport, New Delhi" />
                      <option value="Terminal 2, IGI Airport, New Delhi" />
                      <option value="Terminal 1, IGI Airport, New Delhi" />
                    </datalist>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Drop Location Type</span>
                    </label>
                    <select
                      className="custom-input"
                      value={form.drop_location_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          drop_location_type: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Location Type</option>
                      {LOCATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Initial Duty Status</span>
                    </label>
                    <select
                      className="custom-input"
                      value={form.pickDropStatus}
                      onChange={(e) =>
                        setForm({ ...form, pickDropStatus: e.target.value })
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Driver & Pickup Manager Assignment */}
          <div className="form-section-card">
            <div className="section-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h6 className="section-title mb-0">
                  <span className="section-step-badge">3</span>
                  Driver & Vehicle Assignment
                </h6>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Auto-fill Preset Manager or Custom Driver
                </span>
              </div>

              {/* Toggle Switch */}
              <label
                htmlFor="pickDropModalHasDriverToggle"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  background:
                    form.hasDriver !== false && selectedManager !== "NONE"
                      ? "#ecfdf5"
                      : "#f8fafc",
                  border: `1.5px solid ${
                    form.hasDriver !== false && selectedManager !== "NONE"
                      ? "#10b981"
                      : "#cbd5e1"
                  }`,
                  borderRadius: "24px",
                  padding: "5px 14px",
                  margin: 0,
                  userSelect: "none",
                  transition: "all 0.2s ease",
                  boxShadow:
                    form.hasDriver !== false && selectedManager !== "NONE"
                      ? "0 1px 3px rgba(16, 185, 129, 0.15)"
                      : "none",
                }}
              >
                <span
                  style={{
                    position: "relative",
                    display: "inline-block",
                    width: "38px",
                    height: "22px",
                    backgroundColor:
                      form.hasDriver !== false && selectedManager !== "NONE"
                        ? "#059669"
                        : "#cbd5e1",
                    borderRadius: "22px",
                    transition: "background-color 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    id="pickDropModalHasDriverToggle"
                    checked={Boolean(
                      form.hasDriver !== false && selectedManager !== "NONE"
                    )}
                    onChange={(e) => handleToggleHasDriver(e.target.checked)}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      margin: 0,
                      cursor: "pointer",
                      zIndex: 2,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      left:
                        form.hasDriver !== false && selectedManager !== "NONE"
                          ? "18px"
                          : "2px",
                      width: "18px",
                      height: "18px",
                      backgroundColor: "#ffffff",
                      borderRadius: "50%",
                      transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color:
                      form.hasDriver !== false && selectedManager !== "NONE"
                        ? "#065f46"
                        : "#64748b",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.2px",
                  }}
                >
                  {form.hasDriver !== false && selectedManager !== "NONE"
                    ? "Assign Driver / Vehicle"
                    : "No Driver Needed"}
                </span>
              </label>
            </div>

            <div className="section-body">
              {form.hasDriver === false || selectedManager === "NONE" ? (
                <div
                  className="p-3 mb-2 rounded"
                  style={{
                    background: "#f8fafc",
                    border: "1px dashed #94a3b8",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <i className="fa-solid fa-ban text-secondary" style={{ fontSize: 20 }}></i>
                  <div>
                    <strong style={{ fontSize: 13, color: "#334155" }}>
                      No Driver / Vehicle Assigned
                    </strong>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Patient will arrange own transit. Zero driver duty or WhatsApp alerts will be dispatched.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Pickup Manager Selector */}
                  <div className="row g-3 mb-2">
                    <div className="col-md-7">
                      <div className="form-field-wrapper">
                        <label className="form-field-label">
                          <span>
                            <i className="fa-solid fa-user-tie text-primary me-1"></i>
                            Select Pickup Manager (Preset Dropdown)
                          </span>
                        </label>
                        <select
                          className="custom-input"
                          style={{ fontWeight: 600 }}
                          value={selectedManager}
                          onChange={(e) => handleManagerChange(e.target.value)}
                        >
                          <option value="NONE">None (No Driver Needed)</option>
                          {pickupManagers.length > 0 ? (
                            pickupManagers.map((m) => (
                              <option key={m.id || m.name} value={m.name}>
                                {m.displayLabel || m.name}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Ravi Kumar">
                                Ravi Kumar - 9217993173, 7453 034 087
                              </option>
                              <option value="Shivam Kumar">
                                Shivam Kumar - 88905 06958
                              </option>
                              <option value="Other">
                                Other (Enter custom driver & vehicle)
                              </option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                <div className="col-md-5">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>
                        <i className="fa-solid fa-id-card-clip text-secondary me-1"></i>
                        Vehicle No
                      </span>
                    </label>
                    <input
                      className="custom-input"
                      placeholder="e.g. DL 01 AB 1234"
                      value={form.vehicle_no}
                      onChange={(e) =>
                        setForm({ ...form, vehicle_no: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              {!isCustomDriver ? (
                <div className="autofill-alert-box">
                  <i className="fa-solid fa-circle-check text-success" style={{ fontSize: 16 }}></i>
                  <div>
                    <strong>Preset Manager Assigned:</strong> {form.pickup_manager_name}{" "}
                    ({form.pickup_manager_phone}). Driver details are locked to the verified contact.
                  </div>
                </div>
              ) : (
                <div className="customdriver-alert-box">
                  <i className="fa-solid fa-triangle-exclamation text-warning" style={{ fontSize: 16 }}></i>
                  <div>
                    <strong>Custom Driver Mode:</strong> You can enter custom driver name, phone number, and vehicle details below.
                  </div>
                </div>
              )}

              {/* Driver Details Row */}
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Driver / Manager Name</span>
                      {!isCustomDriver && (
                        <span style={{ fontSize: 10, color: "#059669" }}>
                          <i className="fa-solid fa-lock me-1"></i>Preset
                        </span>
                      )}
                    </label>
                    <input
                      className="custom-input"
                      placeholder="e.g. Ramesh Kumar"
                      value={form.pickup_manager_name}
                      disabled={!isCustomDriver}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pickup_manager_name: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-field-wrapper">
                    <label className="form-field-label">
                      <span>Driver Phone / Contact</span>
                      {!isCustomDriver && (
                        <span style={{ fontSize: 10, color: "#059669" }}>
                          <i className="fa-solid fa-lock me-1"></i>Verified
                        </span>
                      )}
                    </label>
                    <input
                      className="custom-input"
                      placeholder="+91 98765 43210"
                      value={form.pickup_manager_phone}
                      disabled={!isCustomDriver}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pickup_manager_phone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="row g-3 mt-1">
            <div className="col-12">
              <div className="form-field-wrapper mb-0">
                <label className="form-field-label">
                  <span>Notes & Special Assistance Requirements</span>
                </label>
                <textarea
                  className="custom-input"
                  rows={2}
                  placeholder="e.g. Patient needs wheelchair assistance, flight landing at T3 gate 4"
                  value={form.note}
                  onChange={(e) =>
                    setForm({ ...form, note: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
      </div>

      {/* 3. FIXED MODAL FOOTER (Always visible at the bottom) */}
      <div className="pickdrop-modal-footer" style={{ flex: "0 0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: "#64748b",
              background: "#f1f5f9",
              padding: "4px 10px",
              borderRadius: "20px",
              fontWeight: 500,
            }}
          >
            <i className="fa-solid fa-circle-info text-primary me-1"></i>
            {form.patientName
              ? `${form.patientName} (${form.patientId})`
              : form.patientId
              ? `Patient: ${form.patientId}`
              : "Select Patient"}{" "}
            {form.hospitalName ? `• ${form.hospitalName}` : ""} •{" "}
            {form.pickDropStatus} Duty
          </span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-light"
            disabled={saving}
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1",
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 18px",
              borderRadius: "8px",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-button"
            disabled={saving}
            onClick={handleSubmit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, #0f766e 0%, #22c7b8 100%)",
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 20px",
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 2px 6px rgba(15, 118, 110, 0.25)",
            }}
          >
            {saving ? (
              <>
                <CircularProgress size={16} color="inherit" /> Scheduling...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check"></i> Schedule Pickup Now
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default CreatePickDropAppointmentModal;
