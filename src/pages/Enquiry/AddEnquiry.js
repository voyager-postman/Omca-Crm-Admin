import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { Formik, Field, ErrorMessage, Form } from "formik";
import * as Yup from "yup";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { AddEnquirys } from "../../reducer/EnquirySlice";
import { GetAllCountries2 } from "../../reducer/Countries";
import { Autocomplete, TextField } from "@mui/material";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import uploadImage from "../../img/image (6).png";
import { AdminBaseUrl, baseurl } from "../../Basurl/Baseurl";
import axios from "axios";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Radio, RadioGroup, FormControlLabel } from "@mui/material";
import PatientSelectionModal from "./PatientSelectionModal";
import ReferralCreateModal from "./ReferralCreateModal";
import InsuranceCreateModal from "./InsuranceCreateModal";
import CountryCodeSelect from "./CountryCodeSelect";
import { fetchReferrals } from "../../services/referralApi";
import { fetchInsurances } from "../../services/insuranceApi";
import {
  contactNumberYup,
  optionalContactNumberYup,
  handleContactNumberChange,
} from "../../utils/phoneValidation";
const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export default function AddEnquiry() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const leadData = location?.state?.leadData || null;
  const formikRef = useRef(null);
  const userRole = (localStorage.getItem("Role") || "").toUpperCase();
  const isReferralUser = userRole === "REFERRAL";
  const myReferralId = isReferralUser ? (localStorage.getItem("referral_id") || "") : "";
  const myName = localStorage.getItem("name") || "Referral Partner";
  const [referralsList, setReferralsList] = useState([]);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const isInsuranceUserRole = userRole === "INSURANCE";
  const myInsuranceId = isInsuranceUserRole ? (localStorage.getItem("insurance_id") || "") : "";
  const myInsName = localStorage.getItem("name") || "Insurance Partner";
  const [insurancesList, setInsurancesList] = useState([]);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showAttendant, setShowAttendant] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [patientList, setPatientList] = useState([]);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [isNewPatient, setIsNewPatient] = useState(true);
  const [pendingValues, setPendingValues] = useState(null);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const { Treatment, error } = useSelector((state) => state.Treatment);
  const { loading } = useSelector((state) => state.Enquiry);
  const { Countries } = useSelector((state) => state.Countries);
  const [passportValue, setPassportValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");

  const resolvedLeadInitial = (() => {
    if (!leadData) return null;
    let dial_code = "";
    let phone = String(leadData.phoneNumber || leadData.phone || "").trim();

    if (leadData.countryCode) {
      dial_code = String(leadData.countryCode).startsWith("+")
        ? leadData.countryCode
        : `+${leadData.countryCode}`;
    }

    if (phone.startsWith("+")) {
      const spaceIdx = phone.indexOf(" ");
      if (spaceIdx > 0) {
        if (!dial_code) dial_code = phone.substring(0, spaceIdx);
        phone = phone.substring(spaceIdx + 1);
      } else {
        for (const c of Countries || []) {
          if (c.dial_code && phone.startsWith(c.dial_code)) {
            if (!dial_code) dial_code = c.dial_code;
            phone = phone.substring(c.dial_code.length);
            break;
          }
        }
      }
    }

    if (dial_code && phone.startsWith(dial_code)) {
      phone = phone.substring(dial_code.length);
    }

    phone = phone.replace(/[^\d]/g, "");

    let countryName = leadData.country || "";
    if (countryName && Countries?.length) {
      const foundCountry = Countries.find(
        (c) =>
          c.name?.toLowerCase() === countryName.toLowerCase() ||
          c.code?.toLowerCase() === countryName.toLowerCase()
      );
      if (foundCountry) {
        countryName = foundCountry.name;
        if (!dial_code) dial_code = foundCountry.dial_code || "";
      }
    }

    let treatingInArr = [];
    if (leadData.treatingIn) {
      treatingInArr = Array.isArray(leadData.treatingIn)
        ? leadData.treatingIn
        : [leadData.treatingIn];
    }

    return {
      name: leadData.name || "",
      email: leadData.email || "",
      dial_code: dial_code || "",
      emergency_contact_no: phone || "",
      patient_emergency_dial_code: dial_code || "",
      patient_relation_dial_code: dial_code || "",
      country: countryName || "",
      treatingIn: treatingInArr,
      address: leadData.message || "",
    };
  })();
  useEffect(() => {
    dispatch(GetAllCountries2());
  }, [dispatch]);

  // Load existing referral partners
  useEffect(() => {
    const loadReferrals = async () => {
      try {
        const res = await fetchReferrals({ limit: 200, status: 1 });
        if (res && res.success && Array.isArray(res.referrals)) {
          setReferralsList(res.referrals);
        }
      } catch (err) {
        console.warn("Failed to load referrals list in AddEnquiry:", err);
      }
    };
    loadReferrals();
  }, []);

  // Load existing insurance partners
  useEffect(() => {
    const loadInsurances = async () => {
      try {
        const res = await fetchInsurances({ limit: 200, status: 1 });
        if (res && res.success && Array.isArray(res.insurances)) {
          setInsurancesList(res.insurances);
        }
      } catch (err) {
        console.warn("Failed to load insurances list in AddEnquiry:", err);
      }
    };
    loadInsurances();
  }, []);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const basicSchema = Yup.object().shape({
   name: Yup.string()
  .trim()
  .min(2, "Please enter a valid name")
  .max(50)
  .required("Name is required"),
    //  disease_name: Yup.object()
    // .nullable()
    // .required("Disease name is required"),
    country: Yup.string().required("Country is required"),
    treatingIn: Yup.array()
      .of(Yup.string())
      .min(1, "Treating In is required")
      .required("Treating In is required"),
   address: Yup.string().trim().notRequired(),
    patient_relation_name: Yup.string().when("showAttendant", {
      is: true,
      then: (schema) => schema.required("Attendant name is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
    patient_relation_id: Yup.array().when("showAttendant", {
      is: true,
      then: (schema) => schema.min(1, "Attendant ID Proof is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
    patient_relation: Yup.string().when("showAttendant", {
      is: true,
      then: (schema) => schema.required("Attendant Relationship is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
    //   patient_relation_address: Yup.string().when("showAttendant", {
    //   is: true,
    //   then: (schema) => schema.required("Attendant address is required"),
    //   otherwise: (schema) => schema.notRequired(),
    // }),
    email: Yup.string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .matches(emailRegex, "Invalid email")
      .notRequired(),
    age: Yup.string().required("Age is required"),
   town: Yup.string().trim().notRequired(),
    passport_num: Yup.string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .matches(
        /^[A-Za-z0-9]{6,15}$/,
        "Passport number must be 6–15 characters (letters & digits only)",
      )
      .notRequired(),
    showAttendant: Yup.boolean(),
    dial_code: Yup.string().required("Country code is required"),
    emergency_contact_no: contactNumberYup({
      required: true,
      label: "Phone number",
    }),
    patient_relation_no: Yup.string().when("showAttendant", {
      is: true,
      then: () =>
        contactNumberYup({ required: true, label: "Attendant phone number" }),
      otherwise: (schema) => schema.notRequired(),
    }),
    patient_emergency_contact_no: optionalContactNumberYup({
      label: "Emergency contact number",
    }),
    gender: Yup.string()
      .oneOf(["Male", "Female", "Others"])
      .required("Gender is required"),
  });
  useEffect(() => {
    dispatch(GetAllTreatment());
  }, [dispatch]);
  useEffect(() => {
    const initTooltips = () => {
      if (!window.bootstrap) return;
      const tooltipTriggerList = document.querySelectorAll(
        '[data-bs-toggle="tooltip"]',
      );
      tooltipTriggerList.forEach((el) => {
        if (!el._tooltip) {
          el._tooltip = new window.bootstrap.Tooltip(el, {
            placement: el.getAttribute("data-bs-placement") || "top", // fallback
            trigger: "hover focus",
          });
        }
      });
    };
    setTimeout(initTooltips, 300);
  }, [showAttendant, Countries, Treatment]);
  const fetchPatientByPhoneOrPassport = async (params) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(
      `https://mobappssolutiondevelopment.com/omca_crm/api/searchLatestPatientByMobileOrPassport?${query}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  };
  const handleCreateTreatment = async () => {
    const { value: treatmentName } = await Swal.fire({
      title: "Add Treatment",
      input: "text",
      inputLabel: "Treatment Name",
      inputPlaceholder: "Enter treatment name",
      showCancelButton: true,
      confirmButtonText: "Add",
      inputValidator: (value) => {
        if (!value) {
          return "Treatment name is required";
        }
      },
    });
    if (treatmentName) {
      const payload = { name: treatmentName };
      try {
        const response = await axios.post(
          `${AdminBaseUrl}treatment/add`,
          payload,
        );
          console.log(response.data)
          const data = await response.data;
          console.log(response, data)
        if (response.data.success === "true") {
          dispatch(GetAllTreatment());
          Swal.fire(
            "Success",
            data.message || "Treatment created successfully",
            "success",
          );
        } else {
          Swal.fire(
            "Error",
            data.message || "Failed to create treatment",
            "error",
          );
        }
      } catch (error) {
        console.log(error);
        Swal.fire(
          "Error",
          error?.response?.data?.message ||
            error.message ||
            "Something went wrong",
          "error",
        );
      }
    }
  };

  const formikSetValuesRef = useRef(null);

  const executeFinalSubmit = async (
    values,
    { createNewPatient = true, patientId = null, forceCreate = false } = {},
  ) => {
    const formData = new FormData();

    // 👉 Key field to link to existing patient or create as new:
    if (patientId) {
      formData.append("patientId", patientId);
    } else {
      formData.append("createNewPatient", "true");
    }
    if (forceCreate) {
      formData.append("forceCreate", "true");
    }

    for (const key in values) {
      if (
        key !== "patient_id_proof" &&
        key !== "patient_Profile" &&
        key !== "patient_relation_id" &&
        key !== "treatingIn" &&
        key !== "documents"
      ) {
        formData.append(key, values[key]);
      }
    }
    if (values.dial_code) {
      formData.append("phoneCode", values.dial_code);
    }
    if (values.patient_emergency_dial_code) {
      formData.append("patient_emergency_dial_code", values.patient_emergency_dial_code);
      formData.append("emergency_dial_code", values.patient_emergency_dial_code);
    } else if (values.dial_code) {
      formData.append("patient_emergency_dial_code", values.dial_code);
      formData.append("emergency_dial_code", values.dial_code);
    }
    formData.append(
      "treatingIn",
      JSON.stringify(values.treatingIn || []),
    );
    if (values.documents?.length > 0) {
      values.documents.forEach((file) => {
        formData.append("documents", file);
        formData.append("images", file);
      });
    }
    if (values.patient_id_proof?.length > 0) {
      values.patient_id_proof.forEach((file) => {
        formData.append("patient_id_proof", file);
      });
    }
    if (values.patient_relation_id?.length > 0) {
      values.patient_relation_id.forEach((file) => {
        formData.append("patient_relation_id", file);
      });
    }
    if (values.patient_Profile) {
      formData.append("patient_Profile", values.patient_Profile);
    }

    try {
      const result = await dispatch(AddEnquirys(formData)).unwrap();

      if (result?.isDuplicatePhone) {
        const confirmDup = await Swal.fire({
          title: "Duplicate Phone Number Detected",
          text: result.message,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes",
          cancelButtonText: "No",
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
        });

        if (confirmDup.isConfirmed) {
          return await executeFinalSubmit(values, {
            createNewPatient,
            patientId,
            forceCreate: true,
          });
        } else {
          Swal.fire({
            icon: "info",
            title: "New Phone Number Required",
            text: "Please enter a different phone number to proceed with creating this enquiry.",
          });
          setTimeout(() => {
            const phoneInput = document.querySelector(
              '[name="emergency_contact_no"]',
            );
            if (phoneInput) {
              phoneInput.focus();
              phoneInput.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }, 300);
          return false;
        }
      }

      if (result?.success === false) {
        Swal.fire({
          icon: "error",
          title: "Error",
          html: result.message || "Failed to add enquiry",
        });
        return false;
      }

      Swal.fire(
        result?.message || "Enquiry created successfully",
        "",
        "success",
      );
      if (isReferralUser) {
        navigate("/Admin/referrals");
      } else {
        navigate("/Admin/Inquiry");
      }
      return true;
    } catch (err) {
      if (err?.isDuplicatePhone) {
        const confirmDup = await Swal.fire({
          title: "Duplicate Phone Number Detected",
          text: err.message,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes",
          cancelButtonText: "No",
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
        });

        if (confirmDup.isConfirmed) {
          return await executeFinalSubmit(values, {
            createNewPatient,
            patientId,
            forceCreate: true,
          });
        } else {
          Swal.fire({
            icon: "info",
            title: "New Phone Number Required",
            text: "Please enter a different phone number to proceed with creating this enquiry.",
          });
          setTimeout(() => {
            const phoneInput = document.querySelector(
              '[name="emergency_contact_no"]',
            );
            if (phoneInput) {
              phoneInput.focus();
              phoneInput.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }, 300);
          return false;
        }
      }

      let errorMessage = "Something went wrong";
      if (err?.errors) {
        errorMessage = Object.values(err.errors).join("<br>");
      } else if (err?.message) {
        errorMessage = err.message;
      }
      Swal.fire({
        icon: "error",
        title: "Error",
        html: errorMessage,
      });
      return false;
    }
  };

  const handleModalConfirm = async ({ isNew, patientId, patient }) => {
    if (pendingValues) {
      setIsModalSubmitting(true);
      const success = await executeFinalSubmit(pendingValues, {
        createNewPatient: isNew,
        patientId: isNew ? null : patientId,
      });
      setIsModalSubmitting(false);
      if (success) {
        setShowPatientModal(false);
        setPendingValues(null);
      }
    } else {
      // Triggered from autofill
      if (patient && formikSetValuesRef.current) {
        const selectedCountry = Countries?.find(
          (c) => c.name === patient.country,
        );
        formikSetValuesRef.current((prev) => ({
          ...prev,
          ...patient,
          country: selectedCountry?.name || "",
          dial_code: selectedCountry?.dial_code || "",
        }));
        setSelectedPatientId(patientId);
        setIsNewPatient(false);
      }
      setShowPatientModal(false);
    }
  };

  const handleModalClose = () => {
    if (isModalSubmitting) return;
    setShowPatientModal(false);
    setPendingValues(null);
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="topmainhd">
              <h6>
                <i
                  class="fa-solid fa-arrow-left-long me-2"
                  onClick={() => window.history.back()}
                ></i>
                New Enquiry
              </h6>
            </div>
            {leadData && (
              <div
                className="alert alert-info d-flex align-items-center justify-content-between mb-3 mt-2"
                style={{
                  borderRadius: "8px",
                  border: "1px solid #b8daff",
                  backgroundColor: "#e8f4fd",
                  padding: "10px 16px",
                }}
              >
                <div>
                  <i className="fa-solid fa-circle-info me-2 text-primary"></i>
                  <strong>Creating Enquiry from {leadData.leadSource || "Lead"}:</strong> Patient:{" "}
                  <strong>{leadData.name || "N/A"}</strong>
                  {leadData.phone ? ` | Phone: ${leadData.phone}` : ""}
                  {leadData.email ? ` | Email: ${leadData.email}` : ""}
                  {leadData.country ? ` | Country: ${leadData.country}` : ""}
                </div>
                <span className="badge bg-primary text-white">
                  {leadData.leadSource || "Lead"}
                </span>
              </div>
            )}
          </div>
          <div className="col-md-12">
            <Formik
              innerRef={formikRef}
              enableReinitialize={true}
              initialValues={{
                name: resolvedLeadInitial?.name || "",
                age: "",
                email: resolvedLeadInitial?.email || "",
                gender: "",
                emergency_contact_no: resolvedLeadInitial?.emergency_contact_no || "",
                patient_emergency_contact_no: "",
                country: resolvedLeadInitial?.country || "",
                address: resolvedLeadInitial?.address || "",
                Referral_Name: isReferralUser ? myName : "",
                referral_id: isReferralUser ? myReferralId : "",
                Insurance_Name: isInsuranceUserRole ? myInsName : "",
                insurance_id: isInsuranceUserRole ? myInsuranceId : "",
                disease_name: "",
                disease_id: "",
                patient_relation_name: "",
                patient_relation: "",
                town: "",
                passport_num: "",
                patient_relation_no: "",
                patient_relation_address: "",
                treatingIn: resolvedLeadInitial?.treatingIn || [],
                documents: [],
                patient_relation_id: [],
                patient_id_proof: null,
                platform: "1",
                patient_Profile: null,
                dial_code: resolvedLeadInitial?.dial_code || "",
                patient_emergency_dial_code: resolvedLeadInitial?.patient_emergency_dial_code || "",
                patient_relation_dial_code: resolvedLeadInitial?.patient_relation_dial_code || "",
                showAttendant: false,
              }}
              validationSchema={basicSchema}
              onSubmit={async (values, { setSubmitting }) => {
                try {
                  const token = localStorage.getItem("token");
                  const phoneNo = values.emergency_contact_no;
                  const phoneCode = values.dial_code;
                  const passportNum = values.passport_num;

                  // 📌 Phase 1: On "Create Enquiry" Click, query /checkPatientsByPhone
                  const params = new URLSearchParams();
                  if (phoneNo) params.append("emergency_contact_no", phoneNo);
                  if (phoneCode) params.append("phoneCode", phoneCode);
                  if (passportNum) params.append("passport_num", passportNum);

                  let matchingPatients = [];
                  try {
                    const checkRes = await axios.get(
                      `${baseurl}checkPatientsByPhone?${params.toString()}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      },
                    );
                    if (checkRes.data?.success && checkRes.data?.patients?.length > 0) {
                      matchingPatients = checkRes.data.patients;
                    }
                  } catch (checkErr) {
                    console.warn("checkPatientsByPhone request:", checkErr?.message);
                  }

                  // 📌 Phase 2:
                  // Case A: If count === 0, do NOT open modal. Immediately proceed with createNewPatient: true
                  if (!matchingPatients || matchingPatients.length === 0) {
                    await executeFinalSubmit(values, { createNewPatient: true });
                    setSubmitting(false);
                    return;
                  }

                  // Case B: If count > 0, open the modal with the matching patients
                  setPatientList(matchingPatients);
                  setPendingValues(values);
                  setShowPatientModal(true);
                  setSubmitting(false);
                } catch (submitErr) {
                  console.error("Submit handler error:", submitErr);
                  setSubmitting(false);
                }
              }}
            >
                {({ isSubmitting, setFieldValue, setValues, values, errors, touched }) => {
                  formikSetValuesRef.current = setValues;
                  return (<>
                <Form>
                  <div className="row gx-3 gy-3">
                    <div className="col-md-12">
                      <div className="main_content">
                        <div className="row gx-3 gy-3">
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>NIC / Passport</label>
                              <div style={{ position: "relative" }}>
                                <Field
                                  className="form-control"
                                  name="passport_num"
                                  maxLength={15}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setFieldValue("passport_num", value);
                                    setPassportValue(value);
                                  }}
                                />
                                <img
                                  src={uploadImage}
                                  alt="autofill"
                                  onClick={async () => {
                                    const value =
                                      passportValue ||
                                      document.querySelector(
                                        '[name="passport_num"]',
                                      )?.value;
                                    if (!value || value.length < 6) {
                                      Swal.fire(
                                        "Please enter at least 6 characters",
                                        "",
                                        "warning",
                                      );
                                      return;
                                    }
                                    const data =
                                      await fetchPatientByPhoneOrPassport({
                                        passport_num: value,
                                      });
                                    if (data) {
                                      // If multiple patients returned, show selection modal
                                      if (data.patients && data.patients.length > 1) {
                                        setPatientList(data.patients);
                                        setShowPatientModal(true);
                                        // Do not auto-fill yet; selection will handle it
                                      } else {
                                        const selectedCountry = Countries?.find(
                                          (c) => c.name === data.country,
                                        );
                                        setValues((prev) => ({
                                          ...prev,
                                          ...data,
                                          country: selectedCountry?.name || "",
                                          dial_code:
                                            selectedCountry?.dial_code || "",
                                          passport_num: value,
                                        }));

                                        Swal.fire(
                                          "Patient Found",
                                          "Auto-filled",
                                          "success",
                                        );
                                      }
                                    } else {
                                      Swal.fire(
                                        "Patient Not Found",
                                        "No patient found with this passport number",
                                        "info",
                                      );
                                    }
                                  }}
                                  style={{
                                    position: "absolute",
                                    right: "10px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "30px",
                                    height: "30px",
                                    cursor: "pointer",
                                    padding: "5px",
                                  }}
                                />
                              </div>
                              <ErrorMessage
                                name="passport_num"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Country<span className="text-danger">*</span>
                              </label>
                              <Field name="country">
                                {({ form }) => {
                                  const selectedCountry =
                                    Countries?.find(
                                      (c) => c.name === form.values.country,
                                    ) || null;
                                  return (
                                    <Autocomplete
                                      options={Countries || []}
                                      value={selectedCountry} // ✅ OBJECT
                                      getOptionLabel={(option) =>
                                        option?.name || ""
                                      }
                                      isOptionEqualToValue={(option, value) =>
                                        option.name === value?.name
                                      }
                                      onChange={(e, newValue) => {
                                        form.setFieldValue(
                                          "country",
                                          newValue?.name || "",
                                        );
                                      }}
                                      ListboxProps={{
                                        style: {
                                          maxHeight: 250,
                                          overflow: "auto",
                                        },
                                      }}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          placeholder="Select Country"
                                          size="small"
                                          sx={{
                                            "& .MuiInputBase-root": {
                                              height: 38,
                                            },
                                            "& .MuiInputBase-input": {
                                              padding: "6px 12px",
                                            },
                                          }}
                                        />
                                      )}
                                    />
                                  );
                                }}
                              </Field>
                              <ErrorMessage
                                name="country"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Phone No / WhatsApp
                                <span className="text-danger">*</span>
                              </label>
                              <div
                                className="country-code"
                                style={{ position: "relative" }}
                              >
                                <CountryCodeSelect
                                  value={values.dial_code}
                                  onChange={(code) => {
                                    setFieldValue("dial_code", code);
                                    setFieldValue(
                                      "patient_emergency_dial_code",
                                      code,
                                    );
                                    setFieldValue(
                                      "patient_relation_dial_code",
                                      code,
                                    );
                                  }}
                                  countries={Countries}
                                  error={Boolean(
                                    errors.dial_code && touched.dial_code,
                                  )}
                                  placeholder="+Code"
                                />
                                <Field
                                  className="form-control code-in"
                                  name="emergency_contact_no"
                                  onChange={(e) =>
                                    handleContactNumberChange(
                                      e,
                                      setFieldValue,
                                      "emergency_contact_no",
                                      setPhoneValue,
                                    )
                                  }
                                />
                                <img
                                  src={uploadImage}
                                  alt="autofill"
                                  onClick={async () => {
                                    const value =
                                      phoneValue ||
                                      document.querySelector(
                                        '[name="emergency_contact_no"]',
                                      )?.value;
                                    if (!value || value.length < 8) {
                                      Swal.fire(
                                        "Please enter at least 8 digits",
                                        "",
                                        "warning",
                                      );
                                      return;
                                    }
                                    const data =
                                      await fetchPatientByPhoneOrPassport({
                                        emergency_contact_no: value,
                                      });
                                    if (data) {
                                      const selectedCountry = Countries?.find(
                                        (c) => c.name === data.country,
                                      );
                                      setValues((prev) => ({
                                        ...prev,
                                        ...data,
                                        country: selectedCountry?.name || "",
                                        dial_code:
                                          selectedCountry?.dial_code || "",
                                        emergency_contact_no: value,
                                      }));
                                      Swal.fire(
                                        "Patient Found",
                                        "Auto-filled",
                                        "success",
                                      );
                                    } else {
                                      Swal.fire(
                                        "Patient Not Found",
                                        "No patient found with this phone number",
                                        "info",
                                      );
                                    }
                                  }}
                                  style={{
                                    position: "absolute",
                                    right: "10px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "30px",
                                    height: "30px",
                                    cursor: "pointer",
                                    padding: "5px",
                                  }}
                                />
                              </div>
                              <ErrorMessage
                                name="dial_code"
                                component="div"
                                className="text-danger"
                              />
                              <ErrorMessage
                                name="emergency_contact_no"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Email
                              </label>
                              <Field
                                className="form-control"
                                name="email"
                                type="email"
                              />
                              <ErrorMessage
                                name="email"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Patient's Name{" "}
                                <span className="text-danger">*</span>
                              </label>
                              <Field
                                className="form-control"
                                name="name"
                                type="name"
                              />
                              <ErrorMessage
                                name="name"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field gender-select">
                              <label className="gen-label">
                                Gender<span className="text-danger">*</span>
                              </label>
                              <div className="form-check-inline">
                                <label className="form-check-label">
                                  <Field
                                    type="radio"
                                    name="gender"
                                    value="Male"
                                    className="form-check-input"
                                  />{" "}
                                  Male
                                </label>
                              </div>
                              <div className="form-check-inline">
                                <label className="form-check-label">
                                  <Field
                                    type="radio"
                                    name="gender"
                                    value="Female"
                                    className="form-check-input"
                                  />{" "}
                                  Female
                                </label>
                              </div>
                              <div className="form-check-inline">
                                <label className="form-check-label">
                                  <Field
                                    type="radio"
                                    name="gender"
                                    value="Others"
                                    className="form-check-input"
                                  />{" "}
                                  Others
                                </label>
                              </div>
                              <ErrorMessage
                                name="gender"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Age<span className="text-danger">*</span>
                              </label>
                              <Field
                                className="form-control"
                                name="age"
                                type="number"
                              />
                              <ErrorMessage
                                name="age"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Address
                              </label>
                              <Field className="form-control" name="address" />
                              <ErrorMessage
                                name="address"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Town
                              </label>
                              <Field className="form-control" name="town" />
                              <ErrorMessage
                                name="town"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Emergency Contact No
                                <span className="text-danger"></span>
                              </label>
                              <div
                                className="country-code"
                                style={{ position: "relative" }}
                              >
                                <CountryCodeSelect
                                  value={values.dial_code}
                                  countries={Countries}
                                  disabled={true}
                                  placeholder="+Code"
                                />
                                <Field
                                  className="form-control code-in"
                                  name="patient_emergency_contact_no"
                                  onChange={(e) =>
                                    handleContactNumberChange(
                                      e,
                                      setFieldValue,
                                      "patient_emergency_contact_no",
                                    )
                                  }
                                />
                              </div>
                              <ErrorMessage
                                name="patient_emergency_contact_no"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Medical Reports & Documents (Multiple){" "}
                                <span
                                  className="text-danger"
                                  data-bs-placement="right"
                                  data-bs-toggle="tooltip"
                                  title="Upload medical records, reports, scans, or images (up to 20 files, max 10MB each)"
                                >
                                  (i)
                                </span>
                              </label>
                              <input
                                className="form-control"
                                type="file"
                                name="documents"
                                multiple
                                accept={allowedTypes.join(",")}
                                onChange={(e) => {
                                  const files = Array.from(e.target.files);
                                  if (files.length > 20) {
                                    Swal.fire("Too many files!", "You can upload up to 20 documents/reports", "warning");
                                    e.target.value = "";
                                    return;
                                  }
                                  setFieldValue("documents", files);
                                }}
                              />
                              {values.documents?.length > 0 && (
                                <small className="text-success mt-1 d-block">
                                  {values.documents
                                    .map((file) => file?.name)
                                    .filter(Boolean)
                                    .join(", ")}
                                </small>
                              )}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Patient I’d Proof{" "}
                                <span
                                  className="text-danger"
                                  data-bs-placement="right"
                                  data-bs-toggle="tooltip"
                                  title="Accept only (.jpeg, .jpg, .png, .jfif, .pdf pdf) Max size: 2 MB per file"
                                >
                                  (i)
                                </span>
                              </label>
                              <input
                                className="form-control"
                                type="file"
                                name="patient_id_proof"
                                multiple
                                accept={allowedTypes.join(",")}
                                onChange={(e) => {
                                  const files = Array.from(e.target.files);
                                  const validFiles = [];
                                  for (const file of files) {
                                    if (!allowedTypes.includes(file.type)) {
                                      Swal.fire(
                                        "Invalid file type!",
                                        "Only image, PDF, Word & Excel files are allowed",
                                        "warning",
                                      );
                                      e.target.value = "";
                                      return;
                                    }
                                    if (file.size > 2 * 1024 * 1024) {
                                      Swal.fire(
                                        "File too large!",
                                        "Each file must be less than 2 MB",
                                        "warning",
                                      );
                                      e.target.value = "";
                                      return;
                                    }
                                    validFiles.push(file);
                                  }
                                  setFieldValue("patient_id_proof", validFiles);
                                }}
                              />
                              <ErrorMessage
                                name="patient_id_proof"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Patient Profile{" "}
                                <span
                                  className="text-danger"
                                  data-bs-placement="right"
                                  data-bs-toggle="tooltip"
                                  title="Accept only (.jpeg, .jpg, .png, .jfif, .pdf, .docx, .xlsx )
                             Max size: 2 MB per file"
                                >
                                  (i)
                                </span>
                              </label>
                              <input
                                className="form-control"
                                type="file"
                                name="patient_Profile"
                                accept={allowedTypes.join(",")}
                                onChange={(e) => {
                                  const file = e.currentTarget.files[0];
                                  if (file) {
                                    const isAllowed =
                                      !file.type ||
                                      allowedTypes.includes(file.type) ||
                                      file.type.startsWith("image/") ||
                                      file.type === "application/pdf" ||
                                      /\.(jpe?g|png|webp|jfif|bmp|pdf|docx?|xlsx?)$/i.test(file.name);
                                    if (!isAllowed) {
                                      Swal.fire(
                                        "Invalid file type!",
                                        "Only image, PDF, Word & Excel files are allowed",
                                        "warning",
                                      );
                                      e.target.value = "";
                                      return;
                                    }
                                    if (file.size > 2 * 1024 * 1024) {
                                      Swal.fire(
                                        "File too large!",
                                        "File must be less than 2 MB",
                                        "warning",
                                      );
                                      e.target.value = "";
                                      return;
                                    }
                                    setFieldValue("patient_Profile", file);
                                  }
                                }}
                              />
                              <ErrorMessage
                                name="patient_Profile"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              {isReferralUser ? (
                                <>
                                  <label>Referral Partner</label>
                                  <div
                                    className="p-2 border rounded bg-light d-flex align-items-center justify-content-between"
                                    style={{ minHeight: "38px" }}
                                  >
                                    <div>
                                      <strong className="text-success">{myName}</strong>
                                      {myReferralId && (
                                        <span className="badge bg-secondary ms-2">
                                          {myReferralId}
                                        </span>
                                      )}
                                    </div>
                                    <span className="badge bg-success">Active Partner</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <label className="mb-0">
                                      Referral Name
                                      <span className="text-danger"></span>
                                    </label>
                                    <button
                                      type="button"
                                      className="add-button approvebtn"
                                      onClick={() => setShowReferralModal(true)}
                                    >
                                      + Add
                                    </button>
                                  </div>
                                  <Field name="Referral_Name">
                                    {({ form }) => {
                                      const selectedOption =
                                        referralsList.find(
                                          (r) =>
                                            r.name === form.values.Referral_Name ||
                                            (form.values.referral_id &&
                                              (r.referral_id === form.values.referral_id ||
                                                String(r.id) === String(form.values.referral_id)))
                                        ) ||
                                        (form.values.Referral_Name
                                          ? {
                                              name: form.values.Referral_Name,
                                              referral_id: form.values.referral_id || "",
                                            }
                                          : null);

                                      return (
                                        <Autocomplete
                                          freeSolo
                                          options={referralsList}
                                          getOptionLabel={(option) => {
                                            if (typeof option === "string") return option;
                                            if (!option) return "";
                                            const code = option.referral_id ? ` (${option.referral_id})` : "";
                                            return `${option.name || ""}${code}`;
                                          }}
                                          value={selectedOption}
                                          isOptionEqualToValue={(option, value) => {
                                            if (!value) return false;
                                            if (typeof value === "string") return option.name === value;
                                            return (
                                              option.id === value.id ||
                                              option.referral_id === value.referral_id ||
                                              option.name === value.name
                                            );
                                          }}
                                          onChange={(e, newValue) => {
                                            if (typeof newValue === "string") {
                                              form.setFieldValue("Referral_Name", newValue);
                                              form.setFieldValue("referral_id", "");
                                            } else if (newValue) {
                                              form.setFieldValue("Referral_Name", newValue.name || "");
                                              form.setFieldValue(
                                                "referral_id",
                                                newValue.referral_id || newValue.id || ""
                                              );
                                            } else {
                                              form.setFieldValue("Referral_Name", "");
                                              form.setFieldValue("referral_id", "");
                                            }
                                          }}
                                          onInputChange={(e, newInputValue, reason) => {
                                            if (reason === "input") {
                                              form.setFieldValue("Referral_Name", newInputValue);
                                            }
                                          }}
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              size="small"
                                              placeholder="Select or enter referrer..."
                                              sx={{
                                                "& .MuiInputBase-root": {
                                                  height: 38,
                                                },
                                              }}
                                            />
                                          )}
                                        />
                                      );
                                    }}
                                  </Field>
                                  <ErrorMessage
                                    name="Referral_Name"
                                    component="div"
                                    className="text-danger"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              {isInsuranceUserRole ? (
                                <>
                                  <label>Insurance Partner</label>
                                  <div
                                    className="p-2 border rounded bg-light d-flex align-items-center justify-content-between"
                                    style={{ minHeight: "38px" }}
                                  >
                                    <div>
                                      <strong className="text-info">{myInsName}</strong>
                                      {myInsuranceId && (
                                        <span className="badge bg-secondary ms-2">
                                          {myInsuranceId}
                                        </span>
                                      )}
                                    </div>
                                    <span className="badge bg-info">Active Partner</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <label className="mb-0">
                                      Insurance Partner
                                    </label>
                                    <button
                                      type="button"
                                      className="add-button approvebtn"
                                      onClick={() => setShowInsuranceModal(true)}
                                    >
                                      + Add
                                    </button>
                                  </div>
                                  <Field name="Insurance_Name">
                                    {({ form }) => {
                                      const selectedOption =
                                        insurancesList.find(
                                          (r) =>
                                            r.name === form.values.Insurance_Name ||
                                            (form.values.insurance_id &&
                                              (r.insurance_id === form.values.insurance_id ||
                                                String(r.id) === String(form.values.insurance_id)))
                                        ) ||
                                        (form.values.Insurance_Name
                                          ? {
                                              name: form.values.Insurance_Name,
                                              insurance_id: form.values.insurance_id || "",
                                            }
                                          : null);

                                      return (
                                        <Autocomplete
                                          freeSolo
                                          options={insurancesList}
                                          getOptionLabel={(option) => {
                                            if (typeof option === "string") return option;
                                            if (!option) return "";
                                            const code = option.insurance_id ? ` (${option.insurance_id})` : "";
                                            return `${option.name || ""}${code}`;
                                          }}
                                          value={selectedOption}
                                          isOptionEqualToValue={(option, value) => {
                                            if (!value) return false;
                                            if (typeof value === "string") return option.name === value;
                                            return (
                                              option.id === value.id ||
                                              option.insurance_id === value.insurance_id ||
                                              option.name === value.name
                                            );
                                          }}
                                          onChange={(e, newValue) => {
                                            if (typeof newValue === "string") {
                                              form.setFieldValue("Insurance_Name", newValue);
                                              form.setFieldValue("insurance_id", "");
                                            } else if (newValue) {
                                              form.setFieldValue("Insurance_Name", newValue.name || "");
                                              form.setFieldValue(
                                                "insurance_id",
                                                newValue.insurance_id || newValue.id || ""
                                              );
                                            } else {
                                              form.setFieldValue("Insurance_Name", "");
                                              form.setFieldValue("insurance_id", "");
                                            }
                                          }}
                                          onInputChange={(e, newInputValue, reason) => {
                                            if (reason === "input") {
                                              form.setFieldValue("Insurance_Name", newInputValue);
                                            }
                                          }}
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              size="small"
                                              placeholder="Select or enter insurance partner..."
                                              sx={{
                                                "& .MuiInputBase-root": {
                                                  height: 38,
                                                },
                                              }}
                                            />
                                          )}
                                        />
                                      );
                                    }}
                                  </Field>
                                  <ErrorMessage
                                    name="Insurance_Name"
                                    component="div"
                                    className="text-danger"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <div className="d-flex justify-content-between align-items-center">
                                <label>
                                  Treatment Name
                                  <span className="text-danger"></span>
                                </label>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={handleCreateTreatment}
                                >
                                  + Add
                                </button>
                              </div>
                              {/* <label>
                                Treatment Name
                                <span className="text-danger"></span>
                              </label> */}
                              <Field name="disease_name">
                                {({ form, meta }) => (
                                  <>
                                    <Autocomplete
                                      options={Treatment || []}
                                      getOptionLabel={(option) =>
                                        option?.name || ""
                                      }
                                      value={form.values.disease || null}
                                      isOptionEqualToValue={(option, value) =>
                                        option.id === value?.id
                                      }
                                      onChange={(e, newValue) => {
                                        form.setFieldValue("disease", newValue);
                                        form.setFieldValue(
                                          "disease_name",
                                          newValue?.name || "",
                                        );
                                        form.setFieldValue(
                                          "disease_id",
                                          newValue?.id || "",
                                        );
                                      }}
                                      ListboxProps={{
                                        style: {
                                          maxHeight: 250,
                                          overflow: "auto",
                                        },
                                      }}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          sx={{
                                            "& .MuiInputBase-root": {
                                              height: 38,
                                            },
                                            "& .MuiInputBase-input": {
                                              padding: "6px 12px",
                                            },
                                          }}
                                          placeholder="Select Treatment"
                                          error={
                                            meta.touched && Boolean(meta.error)
                                          }
                                        />
                                      )}
                                    />
                                    {meta.touched && meta.error && (
                                      <div className="text-danger">
                                        {meta.error}
                                      </div>
                                    )}
                                  </>
                                )}
                              </Field>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="set-field">
                              <label>
                                Treating In Country
                                <span className="text-danger">*</span>
                              </label>
                              <Field name="treatingIn">
                                {({ form }) => {
                                  const selectedCountries =
                                    (Countries || []).filter((c) =>
                                      (form.values.treatingIn || []).includes(
                                        c.name,
                                      ),
                                    ) || [];
                                  return (
                                    <Autocomplete
                                      multiple
                                      options={Countries || []}
                                      value={selectedCountries}
                                      getOptionLabel={(option) =>
                                        option?.name || ""
                                      }
                                      isOptionEqualToValue={(option, value) =>
                                        option.name === value?.name
                                      }
                                      onChange={(e, newValue) => {
                                        form.setFieldValue(
                                          "treatingIn",
                                          (newValue || []).map((c) => c.name),
                                        );
                                      }}
                                      ListboxProps={{
                                        style: {
                                          maxHeight: 250,
                                          overflow: "auto",
                                        },
                                      }}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          placeholder="Select Country"
                                          size="small"
                                          sx={{
                                            "& .MuiInputBase-root": {
                                              minHeight: 38,
                                            },
                                            "& .MuiInputBase-input": {
                                              padding: "6px 12px",
                                            },
                                          }}
                                        />
                                      )}
                                    />
                                  );
                                }}
                              </Field>
                              <ErrorMessage
                                name="treatingIn"
                                component="div"
                                className="text-danger"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="main_content">
                        <div className="row gx-3 gy-3">
                          <div className="col-md-12">
                            <div className="comnthis">
                              <h6>Attendant Details</h6>
                            </div>
                            <div className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id="addAttendant"
                                checked={showAttendant}
                                onChange={(e) => {
                                  setShowAttendant(e.target.checked);
                                  setFieldValue(
                                    "showAttendant",
                                    e.target.checked,
                                  );
                                }}
                              />
                              <label
                                className="form-check-label"
                                htmlFor="addAttendant"
                              >
                                Add Attendant
                              </label>
                            </div>
                          </div>
                          <div className="col-md-12">
                            {showAttendant && (
                              <>
                                <div className="row gx-3 gy-3">
                                  <div className="col-md-4">
                                    <div className="set-field">
                                      <label>
                                        Attendant Full Name
                                        <span className="text-danger">*</span>
                                      </label>
                                      <Field
                                        className="form-control"
                                        name="patient_relation_name"
                                      />
                                      <ErrorMessage
                                        name="patient_relation_name"
                                        component="div"
                                        className="text-danger"
                                      />
                                    </div>
                                  </div>
                                  <div className="col-md-4">
                                    <div className="set-field">
                                      <label>
                                        Attendant Relationship with Patient
                                        <span className="text-danger">*</span>
                                      </label>
                                      <Field
                                        className="form-control"
                                        name="patient_relation"
                                      />
                                      <ErrorMessage
                                        name="patient_relation"
                                        component="div"
                                        className="text-danger"
                                      />
                                    </div>
                                  </div>
                                  <div className="col-md-4">
                                    <div className="set-field">
                                      <label>
                                        Attendant Contact Number
                                      </label>
                                      <div
                                        className="country-code"
                                        style={{ position: "relative" }}
                                      >
                                        <CountryCodeSelect
                                          value={values.dial_code}
                                          countries={Countries}
                                          disabled={true}
                                          placeholder="+Code"
                                        />
                                        <Field
                                          className="form-control code-in"
                                          name="patient_relation_no"
                                          onChange={(e) =>
                                            handleContactNumberChange(
                                              e,
                                              setFieldValue,
                                              "patient_relation_no",
                                              setPhoneValue,
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-md-4">
                                    <div className="set-field">
                                      <label>
                                        Attendant ID Proof{" "}
                                        <span
                                          className="text-danger"
                                          data-bs-toggle="tooltip"
                                          title="Accept only (.jpeg, .jpg, .png, .jfif, .pdf)
                                          Max size: 2 MB per file"
                                          data-bs-placement="right"
                                        >
                                          * (i)
                                        </span>
                                      </label>
                                      <input
                                        className="form-control"
                                        type="file"
                                        name="patient_relation_id"
                                        multiple
                                        accept={allowedTypes.join(",")}
                                        onChange={(e) => {
                                          const files = Array.from(
                                            e.target.files,
                                          );
                                          const validFiles = [];

                                          for (const file of files) {
                                            if (
                                              !allowedTypes.includes(file.type)
                                            ) {
                                              Swal.fire(
                                                "Invalid file type!",
                                                "Only image, PDF, Word & Excel files are allowed",
                                                "warning",
                                              );
                                              e.target.value = "";
                                              return;
                                            }

                                            if (file.size > 2 * 1024 * 1024) {
                                              Swal.fire(
                                                "File too large!",
                                                "Each file must be less than 2 MB",
                                                "warning",
                                              );
                                              e.target.value = "";
                                              return;
                                            }

                                            validFiles.push(file);
                                          }

                                          setFieldValue(
                                            "patient_relation_id",
                                            validFiles,
                                          );
                                        }}
                                      />
                                      <ErrorMessage
                                        name="patient_relation_id"
                                        component="div"
                                        className="text-danger"
                                      />
                                    </div>
                                  </div>
                                  <div className="col-md-4">
                                    <div className="set-field">
                                      <label>
                                        Attendant Address
                                      </label>
                                      <Field
                                        className="form-control"
                                        name="patient_relation_address"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <button
                        className="submit-btn"
                        type="submit"
                        disabled={isSubmitting || loading}
                      >
                        {loading ? "Submitting..." : "Submit"}
                      </button>
                    </div>
                  </div>
                </Form>
                {/* Patient Selection Modal */}
                <PatientSelectionModal
                  open={showPatientModal}
                  patients={patientList}
                  onClose={handleModalClose}
                  onConfirm={handleModalConfirm}
                  isSubmitting={isModalSubmitting}
                />
                {/* Referral Create Modal */}
                <ReferralCreateModal
                  open={showReferralModal}
                  onClose={() => setShowReferralModal(false)}
                  onSuccess={(newReferral) => {
                    if (newReferral) {
                      setReferralsList((prev) => [newReferral, ...prev]);
                      if (formikRef.current) {
                        formikRef.current.setFieldValue("Referral_Name", newReferral.name || "");
                        formikRef.current.setFieldValue(
                          "referral_id",
                          newReferral.referral_id || newReferral.id || ""
                        );
                      }
                    }
                  }}
                />
                {/* Insurance Create Modal */}
                <InsuranceCreateModal
                  open={showInsuranceModal}
                  onClose={() => setShowInsuranceModal(false)}
                  onSuccess={(newInsurance) => {
                    if (newInsurance) {
                      setInsurancesList((prev) => [newInsurance, ...prev]);
                      if (formikRef.current) {
                        formikRef.current.setFieldValue("Insurance_Name", newInsurance.name || "");
                        formikRef.current.setFieldValue(
                          "insurance_id",
                          newInsurance.insurance_id || newInsurance.id || ""
                        );
                      }
                    }
                  }}
                />
                </>
              );
            }}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
}
