import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  Autocomplete,
} from "@mui/material";
import Swal from "sweetalert2";
import axios from "axios";
import { AdminBaseUrl } from "../../Basurl/Baseurl";
import { AddEnquirys } from "../../reducer/EnquirySlice";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import { GetAllCountries2 } from "../../reducer/Countries";
import { updateCampaignContact, updateChatbotContact } from "../../services/leadsApi";

const DIAL_CODES = [
  { code: "+237", label: "+237 (Cameroon)" },
  { code: "+230", label: "+230 (Mauritius)" },
  { code: "+91", label: "+91 (India)" },
  { code: "+971", label: "+971 (UAE)" },
  { code: "+1", label: "+1 (USA/Canada)" },
  { code: "+44", label: "+44 (UK)" },
  { code: "+90", label: "+90 (Turkey)" },
  { code: "+66", label: "+66 (Thailand)" },
  { code: "+65", label: "+65 (Singapore)" },
  { code: "+60", label: "+60 (Malaysia)" },
  { code: "+20", label: "+20 (Egypt)" },
  { code: "+966", label: "+966 (Saudi Arabia)" },
  { code: "+968", label: "+968 (Oman)" },
  { code: "+965", label: "+965 (Kuwait)" },
  { code: "+974", label: "+974 (Qatar)" },
  { code: "+880", label: "+880 (Bangladesh)" },
  { code: "+977", label: "+977 (Nepal)" },
  { code: "+94", label: "+94 (Sri Lanka)" },
  { code: "+254", label: "+254 (Kenya)" },
  { code: "+234", label: "+234 (Nigeria)" },
  { code: "+255", label: "+255 (Tanzania)" },
  { code: "+256", label: "+256 (Uganda)" },
  { code: "+233", label: "+233 (Ghana)" },
  { code: "+251", label: "+251 (Ethiopia)" },
  { code: "+27", label: "+27 (South Africa)" },
  { code: "+998", label: "+998 (Uzbekistan)" },
  { code: "+7", label: "+7 (Kazakhstan/Russia)" },
  { code: "+964", label: "+964 (Iraq)" },
  { code: "+49", label: "+49 (Germany)" },
];

const FALLBACK_COUNTRIES = [
  { name: "Mauritius", dial_code: "+230", code: "MU" },
  { name: "Cameroon", dial_code: "+237", code: "CM" },
  { name: "India", dial_code: "+91", code: "IN" },
  { name: "United Arab Emirates", dial_code: "+971", code: "AE" },
  { name: "United States", dial_code: "+1", code: "US" },
  { name: "United Kingdom", dial_code: "+44", code: "GB" },
  { name: "Turkey", dial_code: "+90", code: "TR" },
  { name: "Saudi Arabia", dial_code: "+966", code: "SA" },
  { name: "Oman", dial_code: "+968", code: "OM" },
  { name: "Kenya", dial_code: "+254", code: "KE" },
  { name: "Nigeria", dial_code: "+234", code: "NG" },
  { name: "Tanzania", dial_code: "+255", code: "TZ" },
  { name: "Uganda", dial_code: "+256", code: "UG" },
  { name: "South Africa", dial_code: "+27", code: "ZA" },
  { name: "Uzbekistan", dial_code: "+998", code: "UZ" },
  { name: "Bangladesh", dial_code: "+880", code: "BD" },
  { name: "Nepal", dial_code: "+977", code: "NP" },
  { name: "Sri Lanka", dial_code: "+94", code: "LK" },
  { name: "Egypt", dial_code: "+20", code: "EG" },
  { name: "Kuwait", dial_code: "+965", code: "KW" },
  { name: "Qatar", dial_code: "+974", code: "QA" },
  { name: "Ghana", dial_code: "+233", code: "GH" },
  { name: "Ethiopia", dial_code: "+251", code: "ET" },
];

export default function CreateEnquiryModal({
  open,
  onClose,
  leadData,
  sourceType = "campaign", // "campaign" | "chatbot" | "app_user"
  mode = "create", // "create" | "edit"
  onSuccess,
  onSaveLead,
}) {
  const dispatch = useDispatch();

  const { Treatment: treatmentList = [] } = useSelector(
    (state) => state.Treatment || {}
  );
  const { Countries: countriesList = [] } = useSelector(
    (state) => state.Countries || {}
  );

  // Form fields
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState("+237");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [treatingIn, setTreatingIn] = useState(["India"]);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [treatment, setTreatment] = useState("");
  const [email, setEmail] = useState("");
  const [passportNum, setPassportNum] = useState("");
  const [status, setStatus] = useState("Pending");
  const [statusNotes, setStatusNotes] = useState("");
  const [reports, setReports] = useState([]);
  const reportFileInputRef = useRef(null);
  const reportCameraInputRef = useRef(null);

  const isCampaign =
    sourceType === "campaign" ||
    leadData?.source === "campaign" ||
    leadData?.type === "campaign" ||
    leadData?.lead_type === "campaign";

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (reports.length + selectedFiles.length > 20) {
      Swal.fire({
        icon: "warning",
        title: "Too Many Files",
        text: "You can upload a maximum of 20 reports/documents.",
        confirmButtonColor: "#0284c7",
      });
      return;
    }

    setReports((prev) => {
      const existing = [...prev];
      selectedFiles.forEach((newFile) => {
        const isDuplicate = existing.some(
          (f) =>
            f.name === newFile.name &&
            f.size === newFile.size &&
            f.lastModified === newFile.lastModified
        );
        if (!isDuplicate && existing.length < 20) {
          existing.push(newFile);
        }
      });
      return existing;
    });

    e.target.value = "";
  };

  const removeReportAtIndex = (indexToRemove) => {
    setReports((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!treatmentList || treatmentList.length === 0) {
      dispatch(GetAllTreatment());
    }
    if (!countriesList || countriesList.length === 0) {
      dispatch(GetAllCountries2());
    }
  }, [dispatch, treatmentList, countriesList]);

  // Master countries list with fallback
  const allCountries = useMemo(() => {
    if (Array.isArray(countriesList) && countriesList.length > 0) {
      return countriesList;
    }
    return FALLBACK_COUNTRIES;
  }, [countriesList]);

  const treatmentStringOptions = useMemo(() => {
    const list = Array.isArray(treatmentList) ? treatmentList : [];
    const options = list
      .map((item) => (typeof item === "string" ? item : item?.name || ""))
      .filter(Boolean);
    if (treatment && !options.includes(treatment)) {
      return [treatment, ...options];
    }
    return options;
  }, [treatmentList, treatment]);

  // Ensure current dialCode is always present in select options
  const allDialCodes = useMemo(() => {
    const list = [...DIAL_CODES];
    if (dialCode && !list.some((d) => d.code === dialCode)) {
      list.unshift({ code: dialCode, label: `${dialCode}` });
    }
    return list;
  }, [dialCode]);

  // Parse phone and dial code from input string
  const extractPhoneAndCode = (rawPhone, rawCode) => {
    let code = rawCode || "";
    let number = String(rawPhone || "").trim();

    if (number.startsWith("+")) {
      const matched = DIAL_CODES.find((d) => number.startsWith(d.code));
      if (matched) {
        code = matched.code;
        number = number.slice(matched.code.length).trim();
      } else {
        const spaceIdx = number.indexOf(" ");
        if (spaceIdx > 0) {
          code = number.slice(0, spaceIdx);
          number = number.slice(spaceIdx + 1).trim();
        }
      }
    }

    if (!code) code = "+237";
    number = number.replace(/^[0\s-]+/, "");

    return { code, number };
  };

  // Populate form fields when modal opens or leadData changes
  useEffect(() => {
    if (!open) {
      setReports([]);
      return;
    }
    setReports([]);
    if (!leadData) return;

    const leadName =
      leadData.name ||
      leadData.patient_name ||
      leadData.full_name ||
      [leadData.first_name, leadData.last_name].filter(Boolean).join(" ") ||
      "";

    const rawPhone =
      leadData.phoneNumber ||
      leadData.phone ||
      leadData.emergency_contact_no ||
      "";
    const rawCode =
      leadData.countryCode ||
      leadData.phoneCode ||
      leadData.phone_code ||
      leadData.dial_code ||
      "";

    const { code, number } = extractPhoneAndCode(rawPhone, rawCode);

    setName(leadName);
    setDialCode(code || "+237");
    setPhone(number);
    setEmail(leadData.email || leadData.email_address || "");

    const initialTreatment =
      leadData.treatment_ad_name ||
      leadData.treatmentAdName ||
      leadData.treatment ||
      leadData.treatment_name ||
      leadData.disease_name ||
      leadData.adName ||
      leadData.campaignName ||
      leadData?.raw?.treatment_ad_name ||
      leadData?.raw?.traits?.treatment_ad_name ||
      leadData?.traits?.treatment_ad_name ||
      "";
    setTreatment(initialTreatment);

    // 1. Resolve Country
    let initialCountry =
      leadData.country ||
      leadData.patient_country ||
      leadData.country_name ||
      leadData.countryName ||
      "";

    if (!initialCountry && code) {
      const matchedByDial = allCountries.find(
        (c) =>
          c.dial_code === code ||
          c.dial_code === `+${String(code).replace("+", "")}`
      );
      if (matchedByDial) {
        initialCountry = matchedByDial.name;
      }
    }
    setCountry(initialCountry);

    // 2. Resolve Treating In Country (Default to "India" or leadData)
    let initialTreatingIn = ["India"];
    if (leadData.treatingIn) {
      initialTreatingIn = Array.isArray(leadData.treatingIn)
        ? leadData.treatingIn
        : [leadData.treatingIn];
    } else if (leadData.treating_in_country) {
      initialTreatingIn = [leadData.treating_in_country];
    }
    setTreatingIn(initialTreatingIn);

    // 3. Resolve Age
    const rawAge =
      leadData.age ||
      leadData.patient_age ||
      leadData.raw?.age ||
      leadData?.raw?.traits?.age ||
      "";
    setAge(rawAge ? String(rawAge) : "");

    // 4. Resolve Gender
    const rawGender = String(
      leadData.gender ||
        leadData.patient_gender ||
        leadData.raw?.gender ||
        leadData?.raw?.traits?.gender ||
        ""
    ).trim();

    let normGender = "";
    if (/^m/i.test(rawGender)) normGender = "Male";
    else if (/^f/i.test(rawGender)) normGender = "Female";
    else if (rawGender) normGender = "Others";
    setGender(normGender);

    // 5. Resolve Passport
    setPassportNum(leadData.passport_num || leadData.passport || "");

    // 6. Resolve Status & Notes
    setStatus(leadData.status || leadData.lead_status || leadData.contact_status || "Pending");
    setStatusNotes(leadData.status_notes || leadData.statusNotes || leadData.notes || leadData.reason || "");

    setErrors({});
  }, [open, leadData, allCountries]);

  // Quick Add Treatment (matching AddEnquiry.js behavior)
  const handleCreateTreatment = async () => {
    const { value: treatmentName } = await Swal.fire({
      title: "Add Treatment",
      input: "text",
      inputLabel: "Treatment Name",
      inputPlaceholder: "Enter treatment name",
      showCancelButton: true,
      confirmButtonText: "Add",
      customClass: {
        container: "swal-on-top",
        popup: "swal-on-top",
      },
      didOpen: () => {
        setTimeout(() => {
          const input = Swal.getInput();
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      },
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "Treatment name is required";
        }
      },
    });

    if (treatmentName && treatmentName.trim()) {
      const payload = { name: treatmentName.trim() };
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.post(
          `${AdminBaseUrl}treatment/add`,
          payload,
          { headers }
        );
        const data = response?.data;
        if (
          data?.success === "true" ||
          data?.success === true ||
          response?.status === 200
        ) {
          await dispatch(GetAllTreatment());
          setTreatment(treatmentName.trim());
          Swal.fire({
            title: "Success",
            text: data?.message || "Treatment created successfully",
            icon: "success",
            customClass: {
              container: "swal-on-top",
              popup: "swal-on-top",
            },
          });
        } else {
          Swal.fire({
            title: "Error",
            text: data?.message || "Failed to create treatment",
            icon: "error",
            customClass: {
              container: "swal-on-top",
              popup: "swal-on-top",
            },
          });
        }
      } catch (error) {
        console.error("Error adding treatment:", error);
        Swal.fire({
          title: "Error",
          text:
            error?.response?.data?.message ||
            error?.message ||
            "Failed to create treatment",
          icon: "error",
          customClass: {
            container: "swal-on-top",
            popup: "swal-on-top",
          },
        });
      }
    }
  };

  // Validation according to AddEnquiry compulsory fields:
  // Required: Name, Phone, Country, Age, Gender, Treating In Country
  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = "Patient / Lead Name is required";
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (!country.trim()) newErrors.country = "Country is required";

    if (!String(age).trim()) {
      newErrors.age = "Age is required";
    } else if (isNaN(age) || Number(age) < 0 || Number(age) > 125) {
      newErrors.age = "Please enter a valid age (0–125)";
    }

    if (!gender) newErrors.gender = "Gender is required";

    if (!treatingIn || treatingIn.length === 0) {
      newErrors.treatingIn = "Treating In Country is required";
    }

    if (reports && reports.length > 20) {
      newErrors.reports = "You can upload a maximum of 20 reports/documents";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submission handler
  const handleSubmit = async (forceCreate = false) => {
    if (!forceCreate && !validate()) return;

    if (reports && reports.length > 20) {
      Swal.fire({
        icon: "warning",
        title: "Too Many Files",
        text: "You can upload up to 20 documents/reports.",
        confirmButtonColor: "#0284c7",
      });
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");

    // EDIT MODE: Update contact details locally & via API
    if (mode === "edit") {
      setSubmitting(true);
      try {
        const contactId = leadData?.id || leadData?.user_id || leadData?.enquiryId;
        const updatedContact = {
          id: contactId,
          contact_id: contactId,
          interakt_id:
            leadData?.interakt_id ||
            leadData?.raw?.interakt_id ||
            leadData?.raw_data?.id,
          name: name.trim(),
          dialCode,
          country_code: dialCode,
          countryCode: dialCode,
          phoneCode: dialCode,
          phone: cleanPhone,
          phone_number: cleanPhone,
          phoneNumber: cleanPhone,
          full_phone: cleanPhone
            ? `${dialCode.replace("+", "")}${cleanPhone}`
            : leadData?.fullPhone || leadData?.full_phone,
          fullPhone: cleanPhone
            ? `${dialCode.replace("+", "")}${cleanPhone}`
            : leadData?.fullPhone || leadData?.full_phone,
          email: email.trim(),
          treatment: treatment.trim(),
          treatment_ad_name: treatment.trim(),
          treatment_name: treatment.trim(),
          disease_name: treatment.trim(),
          adName: treatment.trim() || leadData?.adName,
          country: country.trim(),
          age: age ? String(age).trim() : "",
          gender,
          treatingIn,
          passport_num: passportNum.trim(),
          status,
          status_notes: statusNotes,
          notes: statusNotes,
          reason: statusNotes,
          rawLead: leadData,
        };

        if (sourceType === "campaign") {
          const apiRes = await updateCampaignContact(updatedContact);
          if (apiRes?.data && typeof apiRes.data === "object") {
            Object.assign(updatedContact, {
              ...apiRes.data,
              treatment: apiRes.data.treatment_ad_name || updatedContact.treatment,
              adName: apiRes.data.treatment_ad_name || updatedContact.adName,
            });
          }
        } else if (sourceType === "chatbot") {
          const apiRes = await updateChatbotContact(updatedContact);
          if (apiRes?.data && typeof apiRes.data === "object") {
            Object.assign(updatedContact, {
              ...apiRes.data,
              treatment: apiRes.data.treatment_ad_name || apiRes.data.treatment || updatedContact.treatment,
              adName: apiRes.data.treatment_ad_name || apiRes.data.treatment || updatedContact.adName,
            });
          }
        }

        if (onSaveLead) {
          onSaveLead(updatedContact);
        }

        Swal.fire({
          icon: "success",
          title: "Updated Successfully",
          text: `Contact details for ${name.trim()} updated successfully.`,
          timer: 2000,
          showConfirmButton: false,
        });

        if (onClose) onClose();
      } catch (err) {
        Swal.fire(
          "Error",
          err?.response?.data?.message || err?.message || "Failed to update contact",
          "error"
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // CREATE ENQUIRY MODE
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("createNewPatient", "true");
      formData.append("platform", "1");

      // Critical fields expected by AddEnquirys API (matches AddEnquiry.js):
      formData.append("name", name.trim());
      formData.append("patient_name", name.trim());

      formData.append("emergency_contact_no", cleanPhone);
      formData.append("dial_code", dialCode);
      formData.append("phoneCode", dialCode);
      formData.append("patient_emergency_dial_code", dialCode);
      formData.append("emergency_dial_code", dialCode);

      formData.append("country", country.trim());

      formData.append("age", String(age).trim());
      formData.append("patient_age", String(age).trim());

      formData.append("gender", gender);

      // Treating In Country
      const finalTreatingIn =
        Array.isArray(treatingIn) && treatingIn.length > 0
          ? treatingIn
          : country.trim()
          ? [country.trim()]
          : ["India"];
      formData.append("treatingIn", JSON.stringify(finalTreatingIn));

      // Optional fields
      if (email.trim()) {
        formData.append("email", email.trim());
        formData.append("patient_email", email.trim());
      }

      if (treatment.trim()) {
        formData.append("treatment_name", treatment.trim());
        formData.append("disease_name", treatment.trim());
        formData.append("treatment", treatment.trim());
      }

      if (passportNum.trim()) {
        formData.append("passport_num", passportNum.trim());
      }

      // Reports / Documents (Campaign Contacts)
      if (reports && reports.length > 0) {
        reports.forEach((file) => {
          formData.append("documents", file);
          formData.append("images", file);
        });
      }

      // Source tracking
      const sourceLabel =
        sourceType === "app_user"
          ? "App User"
          : sourceType === "campaign"
          ? "Campaign Contact"
          : "Chatbot Lead";
      formData.append("enquiry_source", sourceLabel);

      if (leadData?.id || leadData?.user_id) {
        formData.append("lead_id", leadData.id || leadData.user_id);
      }

      if (forceCreate) {
        formData.append("forceCreate", "true");
      }

      const result = await dispatch(AddEnquirys(formData)).unwrap();

      if (result?.isDuplicatePhone && !forceCreate) {
        setSubmitting(false);
        const confirmDup = await Swal.fire({
          title: "Duplicate Phone Number Detected",
          text:
            result.message ||
            "An enquiry or patient with this phone number already exists. Do you want to proceed and create anyway?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, Create Anyway",
          cancelButtonText: "No, Cancel",
          confirmButtonColor: "#0284c7",
          cancelButtonColor: "#ef4444",
        });

        if (confirmDup.isConfirmed) {
          return await handleSubmit(true);
        }
        return;
      }

      setSubmitting(false);
      Swal.fire({
        icon: "success",
        title: "Enquiry Created",
        text: result?.message || `Enquiry for ${name.trim()} created successfully.`,
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess(result, leadData);
      }
      if (onClose) onClose();
    } catch (error) {
      setSubmitting(false);
      const errMsg =
        error?.message ||
        error?.error ||
        "Could not create enquiry. Please check the details and try again.";
      Swal.fire({
        icon: "error",
        title: "Failed to Create Enquiry",
        text: errMsg,
        confirmButtonColor: "#0284c7",
      });
    }
  };

  const isEditMode = mode === "edit";

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      disableAutoFocus
      PaperProps={{
        sx: {
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          m: { xs: 1, sm: 2 },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          m: 0,
          p: "14px 24px",
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
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
              borderRadius: "10px",
              background: isEditMode
                ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isEditMode
                ? "0 4px 10px rgba(2, 132, 199, 0.3)"
                : "0 4px 10px rgba(22, 163, 74, 0.3)",
              fontSize: "16px",
            }}
          >
            <i className={`fa ${isEditMode ? "fa-pencil" : "fa-user-plus"}`} />
          </div>
          <div>
            <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "16px" }}>
              {isEditMode ? "Edit Lead / Contact Details" : "Create Enquiry from Lead"}
            </h5>
            <small className="text-muted" style={{ fontSize: "12px" }}>
              {isEditMode
                ? "Update contact information for this lead."
                : "Compulsory fields from Add Enquiry required to create new enquiry."}
            </small>
          </div>
        </div>

        <IconButton
          size="small"
          onClick={onClose}
          disabled={submitting}
          sx={{
            color: "#64748b",
            "&:hover": { backgroundColor: "#fee2e2", color: "#dc2626" },
          }}
        >
          <i className="fa fa-times" style={{ fontSize: "16px" }} />
        </IconButton>
      </DialogTitle>

      {/* Content Form - Includes compulsory fields from AddEnquiry.js */}
      <DialogContent
        dividers
        sx={{
          p: "20px 24px",
          backgroundColor: "#ffffff",
          overflowY: "auto !important",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        <div className="row g-3">
          {/* 1. Patient / Lead Name (Compulsory) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Patient / Lead Name <span className="text-danger">*</span>
            </label>
            <TextField
              size="small"
              fullWidth
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Junaid Ali"
              error={Boolean(errors.name)}
              helperText={errors.name}
            />
          </div>

          {/* 2. Phone Number with Country Code (Compulsory) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Phone Number <span className="text-danger">*</span>
            </label>
            <div className="d-flex gap-2">
              <div style={{ width: "160px", flexShrink: 0 }}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={dialCode}
                  onChange={(e) => {
                    const newCode = e.target.value;
                    setDialCode(newCode);
                    // Also auto-sync country if not already chosen
                    const matchedCountry = allCountries.find(
                      (c) => c.dial_code === newCode
                    );
                    if (matchedCountry && !country) {
                      setCountry(matchedCountry.name);
                    }
                  }}
                >
                  {allDialCodes.map((d) => (
                    <MenuItem key={d.code} value={d.code}>
                      {d.label}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
              <TextField
                size="small"
                fullWidth
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="e.g. 57892248"
                error={Boolean(errors.phone)}
                helperText={errors.phone}
              />
            </div>
          </div>

          {/* 3. Country (Compulsory - from AddEnquiry) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Country <span className="text-danger">*</span>
            </label>
            <Autocomplete
              size="small"
              options={allCountries}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.name || ""
              }
              isOptionEqualToValue={(option, value) => {
                const optName = typeof option === "string" ? option : option?.name;
                const valName = typeof value === "string" ? value : value?.name;
                return optName?.toLowerCase() === valName?.toLowerCase();
              }}
              value={
                allCountries.find(
                  (c) => c.name?.toLowerCase() === country?.toLowerCase()
                ) || (country ? { name: country } : null)
              }
              onChange={(e, newValue) => {
                const selectedName =
                  typeof newValue === "string" ? newValue : newValue?.name || "";
                setCountry(selectedName);
                if (newValue?.dial_code) {
                  setDialCode(newValue.dial_code);
                }
                if (errors.country) {
                  setErrors((prev) => ({ ...prev, country: undefined }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select Patient Country"
                  error={Boolean(errors.country)}
                  helperText={errors.country}
                />
              )}
            />
          </div>

          {/* 4. Treating In Country (Compulsory - from AddEnquiry) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Treating In Country <span className="text-danger">*</span>
            </label>
            <Autocomplete
              multiple
              size="small"
              options={allCountries}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.name || ""
              }
              isOptionEqualToValue={(option, value) => {
                const optName = typeof option === "string" ? option : option?.name;
                const valName = typeof value === "string" ? value : value?.name;
                return optName?.toLowerCase() === valName?.toLowerCase();
              }}
              value={treatingIn.map((tName) => {
                const found = allCountries.find(
                  (c) => c.name?.toLowerCase() === tName?.toLowerCase()
                );
                return found || { name: tName };
              })}
              onChange={(e, newValue) => {
                const names = (newValue || [])
                  .map((item) =>
                    typeof item === "string" ? item : item?.name || ""
                  )
                  .filter(Boolean);
                setTreatingIn(names);
                if (errors.treatingIn) {
                  setErrors((prev) => ({ ...prev, treatingIn: undefined }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={
                    treatingIn.length === 0 ? "Select Destination Country" : ""
                  }
                  error={Boolean(errors.treatingIn)}
                  helperText={errors.treatingIn}
                />
              )}
            />
          </div>

          {/* 5. Age (Compulsory - from AddEnquiry) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Age <span className="text-danger">*</span>
            </label>
            <TextField
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, max: 125 }}
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }));
              }}
              placeholder="e.g. 35"
              error={Boolean(errors.age)}
              helperText={errors.age}
            />
          </div>

          {/* 6. Gender (Compulsory - from AddEnquiry) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Gender <span className="text-danger">*</span>
            </label>
            <TextField
              select
              size="small"
              fullWidth
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (errors.gender)
                  setErrors((prev) => ({ ...prev, gender: undefined }));
              }}
              error={Boolean(errors.gender)}
              helperText={errors.gender}
            >
              <MenuItem value="">Select Gender</MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Others">Others</MenuItem>
            </TextField>
          </div>

          {/* 7. Treatment Name (Optional) */}
          <div className="col-md-6">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label
                className="form-label fw-semibold text-dark mb-0"
                style={{ fontSize: "13px" }}
              >
                Treatment Name{" "}
                <span className="text-muted fw-normal">(Optional)</span>
              </label>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleCreateTreatment}
              >
                + Add
              </button>
            </div>
            <Autocomplete
              freeSolo
              size="small"
              options={treatmentStringOptions}
              value={treatment}
              onChange={(e, newValue) => {
                setTreatment(newValue || "");
              }}
              onInputChange={(e, newValue) => setTreatment(newValue || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="e.g. Cardiology / Dental"
                />
              )}
            />
          </div>

          {/* 8. Email Address (Optional) */}
          <div className="col-md-6">
            <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
              Email Address <span className="text-muted fw-normal">(Optional)</span>
            </label>
            <TextField
              size="small"
              fullWidth
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. patient@example.com"
            />
          </div>

          {/* 9. Status & Status Notes (when isEditMode) */}
          {isEditMode && (
            <>
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Status
                </label>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {[
                    "Pending",
                    "Follow-up",
                    "Close",
                    "Connected",
                    "Not Connected",
                    "Donation",
                  ].map((st) => (
                    <MenuItem key={st} value={st}>
                      {st}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Status Notes / Remarks
                </label>
                <TextField
                  size="small"
                  fullWidth
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. Follow up next Tuesday regarding reports"
                />
              </div>
            </>
          )}

          {/* Reports (Campaign Contacts Only) */}
          {isCampaign && !isEditMode && (
            <div className="col-md-12">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label
                  className="form-label fw-semibold text-dark mb-0"
                  style={{ fontSize: "13px" }}
                >
                  Reports <span className="text-muted fw-normal">(Optional)</span>
                </label>
                {reports.length > 0 && (
                  <span
                    className="badge bg-success-subtle text-success border border-success-subtle"
                    style={{ fontSize: "11px", fontWeight: 600, padding: "2px 7px" }}
                  >
                    {reports.length} file{reports.length > 1 ? "s" : ""} selected
                  </span>
                )}
              </div>

              <div className="d-flex gap-1 align-items-center">
                <input
                  ref={reportFileInputRef}
                  type="file"
                  id="campaign-reports-file-input"
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => reportFileInputRef.current?.click()}
                  className="form-control d-flex align-items-center justify-content-between text-start mb-0"
                  style={{
                    height: "40px",
                    cursor: "pointer",
                    backgroundColor: "#ffffff",
                    borderColor: errors.reports ? "#ef4444" : "#cbd5e1",
                    color: reports.length > 0 ? "#0f172a" : "#94a3b8",
                    fontSize: "13px",
                    borderRadius: "4px",
                    boxShadow: "none",
                    flex: "1 1 auto",
                    minWidth: 0,
                  }}
                >
                  <span className="text-truncate">
                    {reports.length === 0
                      ? "Choose documents / reports (Multiple files allowed: PDF, JPG, PNG)..."
                      : `${reports.length} report${reports.length > 1 ? "s" : ""} selected`}
                  </span>
                  <i
                    className="fa-solid fa-cloud-arrow-up text-primary ms-2 flex-shrink-0"
                    style={{ fontSize: "15px" }}
                  />
                </button>

                <input
                  ref={reportCameraInputRef}
                  type="file"
                  id="campaign-reports-camera-input"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => reportCameraInputRef.current?.click()}
                  className="btn btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    height: "40px",
                    width: "42px",
                    borderColor: "#cbd5e1",
                    color: "#475569",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff",
                  }}
                  title="Take photo with camera"
                >
                  <i className="fa-solid fa-camera" style={{ fontSize: "14px" }} />
                </button>
              </div>

              {errors.reports && (
                <div className="text-danger mt-1" style={{ fontSize: "12px" }}>
                  {errors.reports}
                </div>
              )}

              {/* Selected Files Chips */}
              {reports.length > 0 && (
                <div
                  className="d-flex flex-wrap gap-1 mt-2"
                  style={{ maxHeight: "85px", overflowY: "auto" }}
                >
                  {reports.map((file, idx) => (
                    <span
                      key={idx}
                      className="badge d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: "#f1f5f9",
                        color: "#334155",
                        border: "1px solid #e2e8f0",
                        fontWeight: 500,
                        fontSize: "12px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        maxWidth: "100%",
                      }}
                      title={file.name}
                    >
                      <i
                        className={
                          file.type?.includes("pdf") || file.name?.toLowerCase().endsWith(".pdf")
                            ? "fa-solid fa-file-pdf text-danger"
                            : "fa-solid fa-file-image text-primary"
                        }
                        style={{ fontSize: "12px" }}
                      />
                      <span
                        className="text-truncate"
                        style={{ maxWidth: "200px", display: "inline-block" }}
                      >
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeReportAtIndex(idx);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 0,
                          marginLeft: "3px",
                          display: "inline-flex",
                          alignItems: "center",
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        title="Remove file"
                      >
                        <i className="fa-solid fa-xmark" style={{ fontSize: "12px" }} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Footer Actions */}
      <DialogActions
        sx={{
          p: "14px 24px",
          backgroundColor: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={submitting}
          sx={{
            borderColor: "#cbd5e1",
            color: "#475569",
            fontWeight: 500,
            fontSize: "13px",
            textTransform: "none",
            borderRadius: "8px",
            padding: "7px 18px",
            "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f1f5f9" },
          }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          sx={{
            background: isEditMode
              ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
              : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "13px",
            textTransform: "none",
            borderRadius: "8px",
            padding: "7px 22px",
            boxShadow: isEditMode
              ? "0 4px 12px rgba(2, 132, 199, 0.35)"
              : "0 4px 12px rgba(22, 163, 74, 0.35)",
            "&:hover": {
              background: isEditMode
                ? "linear-gradient(135deg, #0369a1 0%, #075985 100%)"
                : "linear-gradient(135deg, #15803d 0%, #166534 100%)",
            },
          }}
        >
          {submitting ? (
            <>
              <CircularProgress size={16} sx={{ color: "#ffffff", mr: 1 }} />
              {isEditMode
                ? "Saving Changes..."
                : reports.length > 0
                ? `Uploading ${reports.length} Report(s) & Creating...`
                : "Creating Enquiry..."}
            </>
          ) : isEditMode ? (
            <>
              <i className="fa fa-check me-2" />
              Save Changes
            </>
          ) : (
            <>
              <i className="fa fa-user-plus me-2" />
              Create Enquiry
            </>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
