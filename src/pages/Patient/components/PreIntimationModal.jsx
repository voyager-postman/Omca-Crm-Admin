  import React, { useState, useEffect, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import axios from "axios";
import Swal from "sweetalert2";
import { baseurl, AdminBaseUrl } from "../../../Basurl/Baseurl";
import CameraFileUpload from "../../../components/Common/CameraFileUpload";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

export default function PreIntimationModal({
  open,
  onClose,
  onSuccess,
  treatmentPlan,
  hospitalItem,
  patient,
  existingAttendants = [],
  hospitalsList = [],
  treatmentsList = [],
}) {
  // Hospital state
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalCity, setHospitalCity] = useState("");
  const [hospitalEmail, setHospitalEmail] = useState("");

  // Treatment state
  const [treatmentCourse, setTreatmentCourse] = useState("");

  // Other form fields
  const [patientName, setPatientName] = useState("");
  const [patientPassport, setPatientPassport] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [patientPassportFile, setPatientPassportFile] = useState(null);
  const [medicalFiles, setMedicalFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected existing attendants
  const [selectedExistingAttendantIds, setSelectedExistingAttendantIds] = useState([]);
  // Custom added attendants
  const [customAttendants, setCustomAttendants] = useState([]);

  // Internal fallback lists if not provided via props
  const [internalHospitals, setInternalHospitals] = useState([]);
  const [internalTreatments, setInternalTreatments] = useState([]);

  // Load hospitals if not passed
  useEffect(() => {
    if (open && (!hospitalsList || hospitalsList.length === 0)) {
      axios
        .post(`${AdminBaseUrl}hospital_list`)
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            setInternalHospitals(res.data.data);
          }
        })
        .catch((err) => {
          console.error("Error fetching hospital list for pre-intimation:", err);
        });
    }
  }, [open, hospitalsList]);

  // Load treatments if not passed
  useEffect(() => {
    if (open && (!treatmentsList || treatmentsList.length === 0)) {
      axios
        .post(`${AdminBaseUrl}treatment_list`)
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            setInternalTreatments(res.data.data);
          }
        })
        .catch((err) => {
          console.error("Error fetching treatment list for pre-intimation:", err);
        });
    }
  }, [open, treatmentsList]);

  const allHospitals = useMemo(() => {
    const list = hospitalsList && hospitalsList.length > 0 ? hospitalsList : internalHospitals;
    return list.filter((h) => h && h._id !== "all" && h.id !== "all");
  }, [hospitalsList, internalHospitals]);

  const allTreatments = useMemo(() => {
    const list = treatmentsList && treatmentsList.length > 0 ? treatmentsList : internalTreatments;
    return list.filter((t) => t && t._id !== "all" && t.id !== "all");
  }, [treatmentsList, internalTreatments]);

  // Populate data when dialog opens
  useEffect(() => {
    if (open) {
      const resolvedName =
        patient?.patient_name ||
        patient?.fullname ||
        patient?.name ||
        patient?.patientName ||
        "";
      setPatientName(resolvedName);

      setPatientPassport(
        patient?.passport_num ||
        patient?.passport_number ||
        patient?.passport ||
        ""
      );

      // Treatment course initial
      const initialTreatment =
        treatmentPlan?.treatment?.name ||
        treatmentPlan?.treatmentCourse ||
        "";
      setTreatmentCourse(initialTreatment);

      // Hospital initial
      if (hospitalItem) {
        setSelectedHospital(hospitalItem);
        setHospitalCity(
          hospitalItem?.city ||
          hospitalItem?.hospital?.city ||
          patient?.town ||
          patient?.city ||
          ""
        );
        setHospitalEmail(
          hospitalItem?.email ||
          hospitalItem?.hospital_email ||
          hospitalItem?.hospital?.email ||
          ""
        );
      } else {
        setSelectedHospital(null);
        setHospitalCity(patient?.town || patient?.city || "");
        setHospitalEmail("");
      }

      setDoctorName("");
      setAppointmentDate("");
      setPatientPassportFile(null);
      setMedicalFiles([]);
      setNotes("");
      setSelectedExistingAttendantIds([]);
      setCustomAttendants([]);
    }
  }, [open, treatmentPlan, hospitalItem, patient]);

  // When a hospital is selected from the dropdown
  const handleHospitalChange = (event, newHospital) => {
    setSelectedHospital(newHospital);
    if (newHospital) {
      const city =
        newHospital.city ||
        newHospital.hospital_city ||
        newHospital.hospital?.city ||
        hospitalCity;
      if (city) setHospitalCity(city);

      const email =
        newHospital.email ||
        newHospital.hospital_email ||
        newHospital.hospital?.email ||
        "";
      if (email) setHospitalEmail(email);
    }
  };

  if (!open) return null;

  const toggleExistingAttendant = (attId) => {
    setSelectedExistingAttendantIds((prev) =>
      prev.includes(attId) ? prev.filter((id) => id !== attId) : [...prev, attId]
    );
  };

  const handleAddCustomAttendant = () => {
    setCustomAttendants((prev) => [
      ...prev,
      { fullname: "", relation: "", passport_num: "", passportFile: null },
    ]);
  };

  const handleRemoveCustomAttendant = (index) => {
    setCustomAttendants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCustomAttendantChange = (index, field, value) => {
    setCustomAttendants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCustomAttendantFileChange = (index, file) => {
    setCustomAttendants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], passportFile: file };
      return updated;
    });
  };

  // Helper to format attendant passport display
  const formatAttendantPassportText = (att) => {
    const rawPassport =
      att.passport_num ||
      att.attendant_passport_num ||
      att.passportNumber ||
      att.attendant_passport ||
      "";
    if (/\.(jpg|jpeg|png|gif|webp|pdf|jfif)$/i.test(rawPassport)) {
      return "Passport File Attached";
    }
    return rawPassport ? `Passport: ${rawPassport}` : "No Passport Added";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReferralUser() || isInsuranceUser()) return;

    const hospitalId =
      selectedHospital?.id ||
      selectedHospital?._id ||
      selectedHospital?.hospitalId ||
      selectedHospital?.hospital?._id ||
      hospitalItem?.id ||
      hospitalItem?._id ||
      hospitalItem?.hospitalId ||
      "";

    if (!hospitalId) {
      Swal.fire("Required Field", "Please select a Hospital from the dropdown", "warning");
      return;
    }

    if (!treatmentCourse.trim()) {
      Swal.fire("Required Field", "Please select or enter Treatment Course", "warning");
      return;
    }

    if (!appointmentDate) {
      Swal.fire("Required Field", "Please select tentative Appointment Date", "warning");
      return;
    }

    if (!hospitalCity.trim()) {
      Swal.fire("Required Field", "Please enter Hospital City", "warning");
      return;
    }

    if (!patientPassport.trim()) {
      Swal.fire("Required Field", "Please enter Patient Passport Number", "warning");
      return;
    }

    // Build attendants array
    const compiledAttendants = [];

    // Add selected existing attendants
    existingAttendants.forEach((att) => {
      const attId = att?._id || att?.id;
      if (selectedExistingAttendantIds.includes(attId)) {
        compiledAttendants.push({
          name: att.attendant_fullname || att.fullname || att.name || "",
          relation: att.attendant_relation || att.relation || "",
          passportNumber:
            att.passport_num ||
            att.attendant_passport_num ||
            att.passportNumber ||
            att.attendant_passport ||
            "",
          existingPassportDoc: att.attendant_passport || att.passport_doc || "",
        });
      }
    });

    // Add custom attendants
    customAttendants.forEach((att) => {
      if (att.fullname && att.fullname.trim()) {
        compiledAttendants.push({
          name: att.fullname.trim(),
          relation: (att.relation || "").trim(),
          passportNumber: (att.passport_num || "").trim(),
        });
      }
    });

    // Resolve treatmentPlanId or patientId for the endpoint parameter
    const resolvedTreatmentPlanId =
      treatmentPlan?._id ||
      treatmentPlan?.id ||
      treatmentPlan?.treatment_plan_id ||
      patient?._id ||
      patient?.patientId ||
      patient?.enquiryId ||
      "standalone";

    const resolvedHospitalName =
      selectedHospital?.name ||
      selectedHospital?.hospital_Name ||
      selectedHospital?.hospitalName ||
      hospitalItem?.name ||
      "";

    // Parse and validate multiple emails if provided
    let cleanHospitalEmail = "";
    if (hospitalEmail && hospitalEmail.trim()) {
      const emailList = hospitalEmail
        .split(/[;,]/)
        .map((em) => em.trim())
        .filter(Boolean);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const em of emailList) {
        if (!emailRegex.test(em)) {
          Swal.fire(
            "Invalid Email Address",
            `"${em}" is not a valid email address. Please enter valid email addresses separated by commas.`,
            "warning"
          );
          return;
        }
      }
      cleanHospitalEmail = emailList.join(", ");
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("hospitalId", hospitalId);
      if (resolvedHospitalName) formData.append("hospitalName", resolvedHospitalName);
      if (cleanHospitalEmail) {
        formData.append("hospitalEmail", cleanHospitalEmail);
        formData.append("hospitalEmails", cleanHospitalEmail);
      }
      formData.append("hospitalCity", hospitalCity.trim());
      formData.append("treatmentCourse", treatmentCourse.trim());
      formData.append("appointmentDate", appointmentDate);
      formData.append("doctorName", doctorName.trim());
      formData.append("patientName", patientName.trim());
      formData.append("patientPassport", patientPassport.trim());
      formData.append("company", "OVERSEAS MEDICAL CARE ASSISTANCE LTD");
      formData.append("notes", notes.trim());
      formData.append("attendants", JSON.stringify(compiledAttendants));

      // Attach patient passport file once if uploaded
      if (patientPassportFile) {
        formData.append("patientPassportFile", patientPassportFile);
      }

      // Attach custom attendant passport files once per attendant
      customAttendants.forEach((att) => {
        if (att.passportFile) {
          formData.append("attendantPassports", att.passportFile);
        }
      });

      // Attach additional medical documents if uploaded
      if (medicalFiles && medicalFiles.length > 0) {
        Array.from(medicalFiles).forEach((file) => {
          formData.append("files", file);
        });
      }

      // Primary recommended endpoint: /api/sendPreIntimationLetter/:treatmentPlanId/:hospitalId
      // Alternative fallback: /api/sendPreIntimationLetter
      let targetUrl = `${baseurl}sendPreIntimationLetter/${resolvedTreatmentPlanId}/${hospitalId}`;

      let response;
      try {
        response = await axios.post(targetUrl, formData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "multipart/form-data",
          },
        });
      } catch (primaryError) {
        console.warn("Primary endpoint attempt failed, attempting fallback body endpoint:", primaryError);
        // If 404 or route mismatch, try alternative endpoint: /api/sendPreIntimationLetter
        if (primaryError?.response?.status === 404) {
          targetUrl = `${baseurl}sendPreIntimationLetter`;
          response = await axios.post(targetUrl, formData, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "multipart/form-data",
            },
          });
        } else {
          throw primaryError;
        }
      }

      if (response?.data?.success) {
        await Swal.fire({
          icon: "success",
          title: "Pre-Intimation Sent!",
          text:
            response?.data?.message ||
            `Pre-Intimation letter successfully dispatched to ${resolvedHospitalName || "the hospital"}.`,
        });

        const dispatchedRecord = {
          hospitalId,
          hospitalName: resolvedHospitalName,
          hospitalCity: hospitalCity.trim(),
          hospitalEmail: cleanHospitalEmail || hospitalEmail.trim(),
          treatmentCourse: treatmentCourse.trim(),
          appointmentDate,
          doctorName: doctorName.trim(),
          patientName: patientName.trim(),
          patientPassport: patientPassport.trim(),
          notes: notes.trim(),
          attendants: compiledAttendants,
          sentAt: new Date().toISOString(),
          status: "Sent",
          isSent: true,
          source: treatmentPlan ? "treatmentPlan" : "direct",
        };

        onSuccess?.(dispatchedRecord);
        onClose();
      } else {
        Swal.fire("Error", response?.data?.message || "Failed to send Pre-Intimation letter", "error");
      }
    } catch (error) {
      console.error("Pre-Intimation send error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || error?.message || "Failed to send Pre-Intimation letter",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || isReferralUser() || isInsuranceUser()) return null;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      className="pre-intimation-dialog"
      PaperProps={{
        style: {
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "90vh",
        },
      }}
    >
      {/* Sticky Top Header */}
      <div
        style={{
          backgroundColor: "#0284c7",
          color: "#ffffff",
          padding: "13px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-paper-plane fs-5 text-white"></i>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "15.5px" }}>
              Send Pre-Intimation Letter
            </h5>
            <small style={{ color: "#bae6fd", fontSize: "11.5px" }}>
              Dispatch tentative arrival & medical intimation directly to hospital
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "13px",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Form wrapping body and sticky footer */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Scrollable Body */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            padding: "16px 22px",
            background: "#ffffff",
          }}
        >
          {/* Email Subject Preview Card */}
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "16px",
            }}
          >
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
              <span className="fw-bold text-primary small d-flex align-items-center gap-1">
                <i className="fa-solid fa-envelope me-1"></i> Email Dispatch Template
              </span>
              <span className="badge bg-primary px-2 py-1" style={{ fontSize: "11px", letterSpacing: "0.3px" }}>
                OVERSEAS MEDICAL CARE ASSISTANCE LTD
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#0369a1" }}>
              <b>Subject:</b>{" "}
              <code style={{ color: "#dc2626", fontWeight: "700", fontSize: "12px" }}>
                MOST URGENT : PRE INTIMATION : {patientName ? patientName.toUpperCase() : "PATIENT"}
              </code>
            </div>
          </div>

          {/* Section: Hospital Selection (Dropdown) */}
          <div className="mb-3">
            <h6
              className="fw-bold text-dark mb-2 pb-1 border-bottom d-flex align-items-center gap-2"
              style={{ fontSize: "13px" }}
            >
              <i className="fa-solid fa-hospital text-primary"></i> Hospital Information
            </h6>
            <div className="row g-3">
              {/* Hospital Dropdown */}
              <div className="col-md-12">
                <label className="form-label fw-bold text-muted small mb-1">
                  Select Hospital <span className="text-danger">*</span>
                </label>
                <Autocomplete
                  options={allHospitals}
                  value={
                    selectedHospital
                      ? allHospitals.find(
                          (h) =>
                            (h.id && h.id === (selectedHospital.id || selectedHospital._id)) ||
                            (h._id && h._id === (selectedHospital._id || selectedHospital.id)) ||
                            h.name === selectedHospital.name
                        ) || selectedHospital
                      : null
                  }
                  getOptionLabel={(option) => {
                    if (!option) return "";
                    if (typeof option === "string") return option;
                    return option.city
                      ? `${option.name} (${option.city})`
                      : option.name || "";
                  }}
                  isOptionEqualToValue={(option, val) =>
                    (option.id && (option.id === val.id || option.id === val._id)) ||
                    (option._id && (option._id === val._id || option._id === val.id)) ||
                    option.name === val.name
                  }
                  onChange={handleHospitalChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Search and select hospital from dropdown..."
                      required={!selectedHospital}
                    />
                  )}
                  ListboxProps={{
                    style: { maxHeight: 220, fontSize: "13px" },
                  }}
                />
              </div>

              {/* Hospital City */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small mb-1">
                  Hospital City <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={hospitalCity}
                  onChange={(e) => setHospitalCity(e.target.value)}
                  placeholder="e.g. New Delhi, Mumbai, Chennai"
                  required
                />
              </div>

              {/* Hospital Email (Optional / Manual override) - Supports multiple comma-separated emails */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small mb-1">
                  Hospital Email (Optional Override)
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={hospitalEmail}
                  onChange={(e) => setHospitalEmail(e.target.value)}
                  placeholder="e.g. ips@hospital.com, coordinator@hospital.com"
                />
                <small className="text-muted d-block mt-1" style={{ fontSize: "11px" }}>
                  Separate multiple emails with commas (e.g. email1@hospital.com, email2@hospital.com)
                </small>
              </div>
            </div>
          </div>

          {/* Section: Treatment & Appointment */}
          <div className="mb-3">
            <h6
              className="fw-bold text-dark mb-2 pb-1 border-bottom d-flex align-items-center gap-2"
              style={{ fontSize: "13px" }}
            >
              <i className="fa-solid fa-stethoscope text-primary"></i> Treatment & Appointment Details
            </h6>
            <div className="row g-3">
              {/* Treatment Course Dropdown / Free-text */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small mb-1">
                  Treatment Course <span className="text-danger">*</span>
                </label>
                <Autocomplete
                  freeSolo
                  options={allTreatments.map((t) => t.name || t.treatment_name || t)}
                  value={treatmentCourse}
                  onChange={(event, newValue) => {
                    setTreatmentCourse(newValue || "");
                  }}
                  onInputChange={(event, newInputValue) => {
                    setTreatmentCourse(newInputValue || "");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Select or type treatment course..."
                      required
                    />
                  )}
                  ListboxProps={{
                    style: { maxHeight: 220, fontSize: "13px" },
                  }}
                />
              </div>

              {/* Tentative Appointment Date */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small mb-1">
                  Tentative Appointment / Arrival Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                />
              </div>

              {/* Doctor / Department Name */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small mb-1">
                  Doctor / Department Name
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma / Cardiology"
                />
              </div>

              {/* Medical Documents / Files Upload */}
              <div className="col-md-6">
                <CameraFileUpload
                  label="Medical Documents / Reports (Optional)"
                  files={medicalFiles ? Array.from(medicalFiles) : []}
                  setFiles={(files) => setMedicalFiles(files)}
                  multiple={true}
                  accept=".pdf,image/*"
                  helperText="Take photos of medical documents or upload PDF/images"
                />
              </div>
            </div>
          </div>

          {/* Section: Patient Details */}
          <div className="mb-3">
            <h6
              className="fw-bold text-dark mb-2 pb-1 border-bottom d-flex align-items-center gap-2"
              style={{ fontSize: "13px" }}
            >
              <i className="fa-solid fa-user text-primary"></i> Patient Details
            </h6>
            <div className="row g-3">
              {/* Patient Name */}
              <div className="col-md-4">
                <label className="form-label fw-bold text-muted small mb-1">
                  Patient Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter patient full name"
                  required
                />
              </div>

              {/* Patient Passport */}
              <div className="col-md-4">
                <label className="form-label fw-bold text-muted small mb-1">
                  Patient Passport Number <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={patientPassport}
                  onChange={(e) => setPatientPassport(e.target.value)}
                  placeholder="Enter patient passport number"
                  required
                />
              </div>

              {/* Patient Passport Copy Attachment */}
              <div className="col-md-4">
                <CameraFileUpload
                  label="Passport Copy Attachment"
                  files={patientPassportFile}
                  setFiles={setPatientPassportFile}
                  multiple={false}
                  accept=".pdf,image/*"
                  helperText="Take photo of passport or upload PDF/image"
                />
              </div>
            </div>
          </div>

          {/* Section: Accompanying Attendants */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style={{ fontSize: "13px" }}>
                <i className="fa-solid fa-users text-primary"></i> Accompanying Attendants & Passports
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold"
                style={{ fontSize: "12px", borderRadius: "5px" }}
                onClick={handleAddCustomAttendant}
              >
                <i className="fa fa-plus me-1"></i> Add Attendant
              </button>
            </div>

            {/* Existing Registered Attendants */}
            {existingAttendants.length > 0 && (
              <div className="mb-3 p-2 bg-light rounded border">
                <small className="text-muted d-block mb-2 fw-bold" style={{ fontSize: "11px" }}>
                  Select registered patient attendants to accompany:
                </small>
                <div className="d-flex flex-wrap gap-2">
                  {existingAttendants.map((att) => {
                    const attId = att._id || att.id;
                    const isChecked = selectedExistingAttendantIds.includes(attId);
                    const name = att.attendant_fullname || att.fullname || att.name || "Attendant";
                    const relation = att.attendant_relation || att.relation || "";
                    const passportInfo = formatAttendantPassportText(att);

                    return (
                      <div
                        key={attId}
                        onClick={() => toggleExistingAttendant(attId)}
                        style={{
                          cursor: "pointer",
                          padding: "7px 14px",
                          borderRadius: "6px",
                          border: isChecked ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                          backgroundColor: isChecked ? "#f0f9ff" : "#ffffff",
                          fontSize: "12.5px",
                          userSelect: "none",
                          transition: "all 0.15s ease",
                        }}
                        className="d-flex align-items-center gap-2 shadow-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ cursor: "pointer", width: "15px", height: "15px" }}
                        />
                        <span>
                          <b>{name}</b> {relation && <span className="text-muted">({relation})</span>}
                          {" • "}
                          <span className="text-secondary small">{passportInfo}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Added Attendants */}
            {customAttendants.length > 0 && (
              <div className="p-2 bg-light rounded border">
                <small className="text-muted d-block mb-2 fw-bold" style={{ fontSize: "11px" }}>
                  Additional Attendants to Accompany:
                </small>
                {customAttendants.map((att, idx) => (
                  <div
                    key={idx}
                    className="row g-2 align-items-center mb-2 p-2 bg-white rounded border shadow-sm"
                  >
                    <div className="col-md-3">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Attendant Name"
                        value={att.fullname}
                        onChange={(e) =>
                          handleCustomAttendantChange(idx, "fullname", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Relation"
                        value={att.relation}
                        onChange={(e) =>
                          handleCustomAttendantChange(idx, "relation", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Passport Number"
                        value={att.passport_num}
                        onChange={(e) =>
                          handleCustomAttendantChange(idx, "passport_num", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="file"
                        className="form-control form-control-sm"
                        accept=".pdf,image/*"
                        onChange={(e) =>
                          handleCustomAttendantFileChange(idx, e.target.files[0] || null)
                        }
                      />
                    </div>
                    <div className="col-md-1 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger p-1"
                        style={{ width: "28px", height: "28px" }}
                        onClick={() => handleRemoveCustomAttendant(idx)}
                        title="Remove Attendant"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Notes */}
          <div className="mb-2">
            <label className="form-label fw-bold text-muted small mb-1">
              Additional Notes / Instructions for Hospital
            </label>
            <textarea
              className="form-control form-control-sm"
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any special instructions or remarks for the hospital..."
            ></textarea>
          </div>
        </div>

        {/* Sticky Fixed Bottom Footer */}
        <div
          style={{
            padding: "11px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-sm btn-secondary px-3 py-1 fw-semibold"
            onClick={onClose}
            disabled={submitting}
            style={{ fontSize: "13px" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-sm btn-primary px-4 py-2 fw-bold shadow-sm"
            disabled={submitting}
            style={{
              backgroundColor: "#0284c7",
              borderColor: "#0284c7",
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
                Sending Pre-Intimation...
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane me-2"></i> Send Pre-Intimation Email
              </>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
