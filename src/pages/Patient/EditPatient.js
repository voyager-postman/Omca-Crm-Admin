import { Formik, Field, ErrorMessage, Form } from "formik";
import * as Yup from "yup";
import { useDispatch, useSelector } from "react-redux";
import { EditPatientType } from "../../reducer/PatientsSlice";
import Swal from "sweetalert2";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { GetAllPatients } from "../../reducer/PatientsSlice";
import { GetAllCountries, GetAllCountries2 } from "../../reducer/Countries";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import {
  AdminBaseUrl,
  AdminBaseUrl1,
  baseurl,
  image,
  resolveCrmImageUrl,
} from "../../Basurl/Baseurl";
import axios from "axios";
import { Autocomplete, TextField } from "@mui/material";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import CountryCodeSelect from "../Enquiry/CountryCodeSelect";
import { fetchReferrals } from "../../services/referralApi";
import { fetchPhysiotherapyStaff } from "../../services/physiotherapyApi";
import { markRecordRead, pickPatientRecordId } from "../../services/unreadApi";
import ReferralCreateModal from "../Enquiry/ReferralCreateModal";
import CameraFileUpload from "../../components/Common/CameraFileUpload";
import {
  fetchCoordinators,
  isPatientAssignedToCoordinatorUser,
} from "../../services/coordinatorApi";
import {
  contactNumberYup,
  optionalContactNumberYup,
  handleContactNumberChange,
} from "../../utils/phoneValidation";
import {
  isReferralUser,
  isCoordinatorUser,
  getCurrentCoordinatorUser,
  isAdminUser,
  canViewAndEditSensitivePatientDetails,
} from "../../utils/authStorage";

const formatDialCode = (codeVal) => {
  if (!codeVal) return "";
  const str = String(codeVal).trim();
  if (str.startsWith("+")) return str;
  return `+${str.replace(/[^0-9]/g, "")}`;
};

const cleanPhoneNumber = (phoneVal, dialCodeVal) => {
  if (!phoneVal) return "";
  let p = String(phoneVal).trim();
  const rawCode = String(dialCodeVal || "").trim().replace(/[^0-9]/g, "");
  if (rawCode) {
    const rawP = p.replace(/[^0-9]/g, "");
    if (rawP.startsWith(rawCode) && rawP.length > rawCode.length) {
      p = rawP.slice(rawCode.length);
    }
  }
  return p.replace(/^\+/, "").trim();
};

const formatDateForInput = (dateVal) => {
  if (!dateVal) return "";
  const dStr = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  const dmMatch = dStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmMatch) {
    const [, day, month, year] = dmMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  try {
    const parsed = new Date(dStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch (e) { }
  return "";
};

export default function EditPatient() {
  const navigate = useNavigate();
  const noOnlySpaces = (fieldName) =>
    Yup.string()
      .transform((value) => value?.trim())
      .test(
        "not-only-spaces",
        `${fieldName} cannot be empty or only spaces`,
        (value) => value && value.trim().length > 0,
      );
  const location = useLocation();
  const { Treatment } = useSelector((state) => state.Treatment);
  const dispatch = useDispatch();
  const formikRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const { patient, loading, error } = useSelector((state) => state.patient);
  const [ispatient, setIspatient] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [previewDocs, setPreviewDocs] = useState([]);
  const { Countries } = useSelector((state) => state.Countries);
  const userRole = (localStorage.getItem("Role") || "").toUpperCase();
  const isReferralUserRole = isReferralUser() || userRole === "REFERRAL";
  const myReferralId = isReferralUserRole ? (localStorage.getItem("referral_id") || "") : "";
  const myName = localStorage.getItem("name") || "Referral Partner";
  const [referralsList, setReferralsList] = useState([]);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [coordinatorsList, setCoordinatorsList] = useState([]);
  const [physioList, setPhysioList] = useState([]);

  useEffect(() => {
    if (isReferralUserRole) {
      Swal.fire({
        title: "Access Restricted",
        text: "Referrers cannot edit patient details.",
        icon: "warning",
      });
      navigate("/Admin/patients", { replace: true });
    }
  }, [isReferralUserRole, navigate]);

  const isCoord = isCoordinatorUser();
  const currentCoord = getCurrentCoordinatorUser();

  useEffect(() => {
    if (!isCoord) return;
    if (!ispatient || typeof ispatient !== "object") return;
    const hasIdentifier =
      ispatient._id ||
      ispatient.patientId ||
      ispatient.patientNumber ||
      ispatient.id;
    if (!hasIdentifier) return;

    if (!isPatientAssignedToCoordinatorUser(ispatient, currentCoord)) {
      Swal.fire({
        icon: "warning",
        title: "Access Restricted",
        text: "You can only edit patients assigned to you.",
        confirmButtonColor: "#0ba6df",
      });
      navigate("/Admin/patients", { replace: true });
    }
  }, [isCoord, ispatient, navigate]);

  useEffect(() => {
    if (isReferralUserRole) return;
    fetchCoordinators()
      .then((data) => setCoordinatorsList(data || []))
      .catch((err) => console.warn("Could not load coordinators:", err));
  }, [isReferralUserRole]);

  useEffect(() => {
    fetchPhysiotherapyStaff()
      .then((res) => {
        const list = res?.data || res?.physioStaff || [];
        setPhysioList(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.warn("Failed to load physiotherapists in EditPatient:", err));
  }, []);

  const passedPatientData = useMemo(() => {
    if (location.state?.patientData) return location.state.patientData;
    try {
      const saved = sessionStorage.getItem("edit_patient_data");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }, [location.state?.patientData]);

  const effectivePatientId =
    location.state?.patientId ||
    passedPatientData?.patientId ||
    passedPatientData?.id ||
    passedPatientData?.patientNumber ||
    sessionStorage.getItem("edit_patient_id");

  useEffect(() => {
    if (location.state?.patientId) {
      sessionStorage.setItem("edit_patient_id", location.state.patientId);
    }
    if (location.state?.patientData) {
      sessionStorage.setItem(
        "edit_patient_data",
        JSON.stringify(location.state.patientData),
      );
    }
  }, [location.state?.patientId, location.state?.patientData]);

  useEffect(() => {
    const recordId = pickPatientRecordId(
      location.state?.patientData?.patientNumber,
      passedPatientData?.patientNumber,
      location.state?.patientId,
      effectivePatientId,
    );
    if (recordId) markRecordRead("patients", recordId);
  }, [
    location.state?.patientId,
    location.state?.patientData,
    passedPatientData,
    effectivePatientId,
  ]);

  useEffect(() => {
    if (passedPatientData && !ispatient) {
      setIspatient(passedPatientData);
    }
  }, [passedPatientData]);

  useEffect(() => {
    dispatch(GetAllCountries2());
  }, [dispatch]);

  useEffect(() => {
    const loadReferrals = async () => {
      try {
        const res = await fetchReferrals({ limit: 200, status: 1 });
        if (res && res.success && Array.isArray(res.referrals)) {
          setReferralsList(res.referrals);
        }
      } catch (err) {
        console.warn("Failed to load referrals list in EditPatient:", err);
      }
    };
    loadReferrals();
  }, []);

  useEffect(() => {
    dispatch(GetAllTreatment());
  }, [dispatch]);

  useEffect(() => {
    dispatch(GetAllPatients());
  }, [dispatch]);

  const loadPatientData = async (targetId) => {
    if (!targetId) return;

    if (Array.isArray(patient) && patient.length > 0) {
      const selectedUser = patient.find(
        (item) =>
          String(item.patientId) === String(targetId) ||
          String(item.id) === String(targetId) ||
          String(item.patientNumber) === String(targetId) ||
          String(item._id) === String(targetId),
      );
      if (selectedUser) {
        setIspatient((prev) => ({ ...(prev || {}), ...selectedUser }));
        setIsFetching(false);
        return;
      }
    }

    if (!ispatient && !passedPatientData) {
      setIsFetching(true);
    }
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${baseurl}get_patient/${targetId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = res.data?.detail || res.data?.data || res.data;
      if (data && (data.patientId || data.patientNumber || data.id || data._id)) {
        setIspatient((prev) => ({ ...(prev || {}), ...data }));
      }
    } catch (err) {
      console.warn("Direct get_patient failed, checking store:", err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (effectivePatientId) {
      loadPatientData(effectivePatientId);
    }
  }, [effectivePatientId, patient]);

  const role = localStorage.getItem("Role");
  const canEditSensitive = canViewAndEditSensitivePatientDetails(role);
  const isAdmin = canEditSensitive;

  const basicSchema = Yup.object().shape({
    patient_name: noOnlySpaces("Patient Name").required(
      "Patient name is required",
    ),

    town: Yup.string().trim().notRequired(),

    address: Yup.string().trim().notRequired(),

    age: Yup.number()
      .typeError("Age must be a number")
      .required("Age is required")
      .integer("Age must be a whole number")
      .moreThan(0, "Age must be greater than 0")
      .max(120, "Age cannot exceed 120"),

    gender: Yup.string().required("Gender is required"),

    patientNumber: Yup.string().required("Patient ID is required"),
    created_at: Yup.string().required("Date is required"),
    // patientDisease: Yup.string().required("Disease is required"),
    passport_num: isAdmin
      ? Yup.string()
        .trim()
        .uppercase()
        .matches(
          /^[A-Z0-9]{6,15}$/,
          "Passport number must be 6–15 characters (letters & digits only)",
        )
        .required("Passport number is required")
      : Yup.string().nullable(),
    email: isAdmin
      ? Yup.string()
        .trim()
        .transform((value) => (value === "" ? undefined : value))
        .email("Invalid email address")
        .notRequired()
      : Yup.string().nullable(),
    emergency_contact_no: isAdmin
      ? contactNumberYup({
        required: true,
        label: "Phone / WhatsApp number",
      })
      : Yup.string().nullable(),
    patient_emergency_contact_no: optionalContactNumberYup({
      label: "Emergency contact number",
    }),
    patient_relation_no: optionalContactNumberYup({
      label: "Patient relation number",
    }),
    country: Yup.string().required("Country is required"),
  });

  if (!ispatient) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="topmainhd">
            <h6>
              <i
                className="fa-solid fa-arrow-left-long me-2"
                style={{ cursor: "pointer" }}
                onClick={() => navigate("/Admin/patients")}
              ></i>
              Edit Patients
            </h6>
          </div>
          <div className="card p-5 text-center mt-3 shadow-sm border-0">
            {isFetching || loading ? (
              <div className="py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h5 className="mt-3 text-secondary">Loading patient details...</h5>
              </div>
            ) : (
              <div className="py-4">
                <i className="fa fa-user-times fa-3x text-muted mb-3" />
                <h5 className="text-secondary">No Patient Selected or Patient Not Found</h5>
                <p className="text-muted">
                  Please select a patient from the Manage Patients list to edit their details.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-2 px-4"
                  style={{ backgroundColor: "#0ba6df", borderColor: "#0ba6df" }}
                  onClick={() => navigate("/Admin/patients")}
                >
                  <i className="fa fa-arrow-left me-2" /> Back to Manage Patients
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleDeleteDoc = async (docName) => {
    try {
      await axios.delete(
        `${baseurl}delete_id_proof/${ispatient.patientNumber}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
        {
          data: { file: docName }, // 👈 important (backend usually needs file name)
        },
      );

      Swal.fire("Deleted!", "Document removed successfully", "success");

      // update UI instantly
      const updatedDocs = ispatient?.patient_kyc?.[0]?.id_proof?.filter(
        (doc) => doc !== docName,
      );

      setIspatient((prev) => ({
        ...prev,
        patient_kyc: [
          {
            ...prev.patient_kyc[0],
            id_proof: updatedDocs,
          },
        ],
      }));
    } catch (err) {
      console.error(err);
      Swal.fire("Error!", "Failed to delete document", "error");
    }
  };
  return (
    <>
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
                  Edit Patients
                </h6>
              </div>
            </div>
            <div className="col-md-12">
              <div className="main_content">
                {(() => {
                  const patientDialCode = formatDialCode(
                    ispatient?.dial_code ||
                    ispatient?.phoneCode ||
                    ispatient?.phone_code ||
                    ispatient?.countryCode ||
                    Countries?.find((c) => c.name === ispatient?.country)?.dial_code ||
                    "",
                  );

                  const rawPhone =
                    ispatient?.emergency_contact_no ||
                    ispatient?.emergency_contact ||
                    ispatient?.phone ||
                    ispatient?.mobile ||
                    ispatient?.mobileNumber ||
                    "";

                  const cleanPhone = cleanPhoneNumber(rawPhone, patientDialCode);

                  const rawEmergencyPhone =
                    ispatient?.patient_emergency_contact_no ||
                    ispatient?.emergency_contact_no ||
                    ispatient?.emergency_contact ||
                    "";

                  const cleanEmergencyPhone = cleanPhoneNumber(
                    rawEmergencyPhone,
                    patientDialCode,
                  );

                  return (
                    <Formik
                      innerRef={formikRef}
                      enableReinitialize
                      initialValues={{
                        patient_name: ispatient?.patient_name || ispatient?.name || "",
                        age: ispatient?.age ?? "",
                        gender: ispatient?.gender || "",
                        email: ispatient?.email || "",
                        treatingIn:
                          ispatient?.treatingIn ||
                          ispatient?.treating_in ||
                          ispatient?.country ||
                          "",
                        patient_emergency_contact_no: cleanEmergencyPhone,
                        passport_num:
                          ispatient?.passport_num ||
                          ispatient?.passport_number ||
                          ispatient?.nic ||
                          ispatient?.passport ||
                          "",
                        town: ispatient?.town || ispatient?.city || "",
                        dial_code: patientDialCode,
                        address: ispatient?.address || ispatient?.street || "",
                        patientDisease:
                          ispatient?.patient_disease?.[0]?.disease_name ||
                          ispatient?.patientDisease ||
                          ispatient?.disease_name ||
                          "",
                        disease_id:
                          ispatient?.patient_disease?.[0]?.id ||
                          ispatient?.disease_id ||
                          "",
                        created_at: formatDateForInput(
                          ispatient?.createdAt ||
                          ispatient?.created_at ||
                          ispatient?.date ||
                          ispatient?.registrationDate,
                        ),
                        emergency_contact_no: cleanPhone,
                        country: ispatient?.country || "",
                        coordinatorId:
                          ispatient?.assignedCoordinator?.userId ||
                          ispatient?.assignedCoordinator?._id ||
                          ispatient?.coordinatorId ||
                          "",
                        physiotherapistId:
                          ispatient?.assignedPhysiotherapist?.userId ||
                          ispatient?.assignedPhysiotherapist?._id ||
                          ispatient?.physiotherapistId ||
                          "",
                        patientNumber:
                          ispatient?.patientNumber ||
                          ispatient?.patientId ||
                          ispatient?.patient_id ||
                          "",
                        Referral_Name:
                          ispatient?.Referral_Name || ispatient?.referral_name || "",
                        referral_id:
                          ispatient?.referral_id || ispatient?.referralId || "",
                        unassignReferral: false,
                        unassignPhysiotherapist: false,
                        has_relation: !!(
                          ispatient?.patient_relation_name || ispatient?.patient_relation
                        ),
                        patient_relation_name:
                          ispatient?.patient_relation_name || "",
                        id_proof: [],
                        patient_relation: ispatient?.patient_relation || "",
                        patient_relation_no:
                          ispatient?.patient_relation_no || "",
                        user_id: ispatient?.user_id || ispatient?.userId || "",
                        notificationEnabled: ispatient?.notificationEnabled ?? true,
                      }}
                      validationSchema={basicSchema}
                      onSubmit={async (values, { setSubmitting }) => {
                        try {
                          const targetPatientId =
                            ispatient?.patientId ||
                            ispatient?.id ||
                            ispatient?.patientNumber ||
                            effectivePatientId;

                          if (!targetPatientId) {
                            Swal.fire("Error!", "Patient ID missing", "error");
                            return;
                          }
                          const formData = new FormData();
                          Object.keys(values).forEach((key) => {
                            if (
                              key !== "patient_Profile" &&
                              key !== "id_proof" &&
                              key !== "unassignReferral" &&
                              key !== "unassignPhysiotherapist"
                            ) {
                              formData.append(key, values[key] ?? "");
                            }
                          });

                          const initialReferralId =
                            ispatient?.referral_id || ispatient?.referralId || "";
                          const initialReferralName =
                            ispatient?.Referral_Name || ispatient?.referral_name || "";
                          const initialPhysioId =
                            ispatient?.assignedPhysiotherapist?.userId ||
                            ispatient?.assignedPhysiotherapist?._id ||
                            ispatient?.physiotherapistId ||
                            "";

                          if (!isAdmin) {
                            // Non-admins cannot modify or unassign referral; keep original values
                            formData.set("referral_id", initialReferralId);
                            formData.set("Referral_Name", initialReferralName);
                            formData.delete("unassignReferral");
                            formData.delete("unassign_referral");
                          } else {
                            // Admin referral change / unassign
                            const isReferralUnassigned =
                              values.unassignReferral === true ||
                              values.referral_id === "unassign" ||
                              (!values.referral_id && !values.Referral_Name && (initialReferralId || initialReferralName));

                            if (isReferralUnassigned) {
                              formData.set("unassignReferral", "true");
                              formData.set("unassign_referral", "true");
                              formData.set("referral_id", "unassign");
                              formData.set("Referral_Name", "");
                            } else {
                              formData.set("referral_id", values.referral_id || "");
                              formData.set("Referral_Name", values.Referral_Name || "");
                              formData.set("unassignReferral", "false");
                              formData.set("unassign_referral", "false");
                            }
                          }

                          // Physiotherapist change / unassign
                          const isPhysioUnassigned =
                            values.unassignPhysiotherapist === true ||
                            values.physiotherapistId === "unassign" ||
                            (!values.physiotherapistId && initialPhysioId);

                          if (isPhysioUnassigned) {
                            formData.set("unassignPhysiotherapist", "true");
                            formData.set("unassign_physiotherapist", "true");
                            formData.set("physiotherapistId", "unassign");
                          } else if (values.physiotherapistId && values.physiotherapistId !== "unassign") {
                            formData.set("physiotherapistId", values.physiotherapistId);
                            formData.set("unassignPhysiotherapist", "false");
                            formData.set("unassign_physiotherapist", "false");
                          }

                          if (values.patient_Profile instanceof File) {
                            formData.append(
                              "patient_Profile",
                              values.patient_Profile,
                            );
                          }
                          if (values.id_proof && values.id_proof.length > 0) {
                            values.id_proof.forEach((file) => {
                              formData.append("id_proof", file);
                            });
                          }
                          await dispatch(
                            EditPatientType({
                              id: targetPatientId,
                              data: formData,
                            }),
                          ).unwrap();

                          if (
                            values.user_id &&
                            (values.passport_num || "").trim()
                          ) {
                            try {
                              formData.append("from", "crm");
                              const response = await axios.post(
                                `${AdminBaseUrl1}user_update_profile`,
                                formData,
                              );
                              console.log(response);
                            } catch (syncErr) {
                              console.warn(
                                "user_update_profile sync skipped/failed:",
                                syncErr?.response?.data || syncErr?.message,
                              );
                            }
                          }
                          Swal.fire(
                            "Success!",
                            "Patient updated successfully",
                            "success",
                          );
                          navigate("/Admin/patients");
                        } catch (err) {
                          console.error(err);

                          const errorMessage =
                            (typeof err === "string" ? err : null) ||
                            err?.response?.data?.message || // axios backend message
                            err?.response?.data?.error || // alternative backend error
                            err?.message || // normal JS error
                            err?.error ||
                            "Update failed";

                          Swal.fire({
                            icon: "error",
                            title: "Error!",
                            text: errorMessage,
                          });
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      {({
                        isSubmitting,
                        values,
                        setFieldValue,
                        errors,
                        touched,
                      }) => (
                        <Form>
                          <div className="row">
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  NIC/passport <span className="text-danger">*</span>
                                </label>
                                {isAdmin ? (
                                  <>
                                    <Field
                                      className="form-control"
                                      type="text"
                                      name="passport_num"
                                      minLength={6}
                                      maxLength={15}
                                    />
                                    <ErrorMessage
                                      name="passport_num"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </>
                                ) : (
                                  <input
                                    className="form-control"
                                    type="text"
                                    value="******"
                                    disabled
                                    readOnly
                                  />
                                )}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
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
                                      <>
                                        <Autocomplete
                                          options={Countries || []}
                                          value={selectedCountry}
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
                                        <ErrorMessage
                                          name="country"
                                          component="div"
                                          className="text-danger"
                                        />
                                      </>
                                    );
                                  }}
                                </Field>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Phone / WhatsApp Number
                                  <span className="text-danger">*</span>
                                </label>
                                {isAdmin ? (
                                  <>
                                    <div
                                      className="country-code"
                                      style={{ position: "relative" }}
                                    >
                                      <CountryCodeSelect
                                        value={values.dial_code}
                                        onChange={(code) => {
                                          setFieldValue("dial_code", code);
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
                                          )
                                        }
                                      />
                                    </div>
                                    <ErrorMessage
                                      name="emergency_contact_no"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </>
                                ) : (
                                  <div className="country-code">
                                    <CountryCodeSelect
                                      value={
                                        values.dial_code ||
                                        ispatient?.dial_code ||
                                        ispatient?.phoneCode ||
                                        ""
                                      }
                                      disabled
                                      countries={Countries}
                                      placeholder="+Code"
                                    />
                                    <input
                                      className="form-control code-in"
                                      value="******"
                                      disabled
                                      readOnly
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Patient Name<span className="text-danger">*</span>
                                </label>
                                <Field
                                  className="form-control"
                                  type="text"
                                  name="patient_name"
                                />
                                <ErrorMessage
                                  name="patient_name"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set gender-select">
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
                                    />
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
                              <div className="field-set">
                                <label>
                                  Age<span className="text-danger">*</span>
                                </label>
                                <Field
                                  className="form-control"
                                  type="number"
                                  name="age"
                                />
                                <ErrorMessage
                                  name="age"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Email
                                </label>
                                {isAdmin ? (
                                  <>
                                    <Field
                                      className="form-control"
                                      type="email"
                                      name="email"
                                    />
                                    <ErrorMessage
                                      name="email"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </>
                                ) : (
                                  <input
                                    className="form-control"
                                    type="text"
                                    value="******"
                                    disabled
                                    readOnly
                                  />
                                )}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Town
                                </label>
                                <Field
                                  className="form-control"
                                  type="text"
                                  name="town"
                                />
                                <ErrorMessage
                                  name="town"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Address
                                </label>
                                <Field
                                  className="form-control"
                                  type="text"
                                  name="address"
                                />
                                <ErrorMessage
                                  name="address"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Emergency Contact Number
                                </label>
                                {isAdmin ? (
                                  <>
                                    <div
                                      className="country-code"
                                      style={{ position: "relative" }}
                                    >
                                      <CountryCodeSelect
                                        value={values.dial_code}
                                        disabled
                                        countries={Countries}
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
                                  </>
                                ) : (
                                  <div className="country-code">
                                    <CountryCodeSelect
                                      value={
                                        values.dial_code ||
                                        ispatient?.dial_code ||
                                        ispatient?.phoneCode ||
                                        ""
                                      }
                                      disabled
                                      countries={Countries}
                                      placeholder="+Code"
                                    />
                                    <input
                                      className="form-control code-in"
                                      value="******"
                                      disabled
                                      readOnly
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Patient Id
                                </label>
                                <Field
                                  className="form-control"
                                  type="text"
                                  name="patientNumber"
                                />
                                <ErrorMessage
                                  name="patientNumber"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <CameraFileUpload
                                  label="Patient ID Proof"
                                  files={values.id_proof || []}
                                  setFiles={(files) => {
                                    setFieldValue("id_proof", files);
                                    if (files && files.length > 0) {
                                      setPreviewDocs(
                                        files.map((file) => URL.createObjectURL(file))
                                      );
                                    } else {
                                      setPreviewDocs([]);
                                    }
                                  }}
                                  multiple={true}
                                  accept="image/*,.pdf"
                                  helperText="Take photos of ID or upload PDF/images"
                                />

                                <div className="engpatimg">
                                  {/* New Uploaded Files */}
                                  {previewDocs.length > 0 &&
                                    previewDocs.map((doc, index) => (
                                      <div className="file-preview" key={index}>
                                        <span
                                          className="delete-icon"
                                          onClick={() => {
                                            const updated = previewDocs.filter(
                                              (_, i) => i !== index,
                                            );
                                            setPreviewDocs(updated);
                                            setFieldValue("id_proof", updated);
                                          }}
                                        >
                                          <i className="fa-solid fa-xmark"></i>
                                        </span>
                                        <button
                                          type="button"
                                          className="viewbtn"
                                          onClick={() => window.open(doc, "_blank")}
                                        >
                                          View
                                        </button>
                                      </div>
                                    ))}

                                  {/* Existing Docs from API */}

                                  {previewDocs.length === 0 &&
                                    ispatient?.patient_kyc?.[0]?.id_proof?.map(
                                      (doc, index) => (
                                        <div className="file-preview" key={index}>
                                          <span
                                            className="delete-icon"
                                            onClick={() => handleDeleteDoc(doc)}
                                          >
                                            <i className="fa-solid fa-xmark"></i>
                                          </span>
                                          <button
                                            type="button"
                                            className="viewbtn"
                                            onClick={() =>
                                              window.open(
                                                `${image}/${doc}`,
                                                "_blank",
                                              )
                                            }
                                          >
                                            View
                                          </button>
                                        </div>
                                      ),
                                    )}
                                </div>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <CameraFileUpload
                                  label="Patient Profile"
                                  files={values.patient_Profile ? [values.patient_Profile] : []}
                                  setFiles={(files) => {
                                    const file = Array.isArray(files) ? files[0] : files;
                                    if (file) {
                                      setPreviewImage(URL.createObjectURL(file));
                                      setFieldValue("patient_Profile", file);
                                    } else {
                                      setFieldValue("patient_Profile", null);
                                    }
                                  }}
                                  multiple={false}
                                  accept="image/*"
                                  cameraText="Take Photo"
                                  buttonText="Upload Photo"
                                  helperText="Take patient picture or upload image"
                                />
                                <div className="engpatimg">
                                  {previewImage ? (
                                    <button
                                      type="button"
                                      className="viewbtn"
                                      onClick={() =>
                                        window.open(previewImage, "_blank")
                                      }
                                    >
                                      View
                                    </button>
                                  ) : (ispatient?.patient_Profile || ispatient?.patient_profile || ispatient?.profile_pic || ispatient?.profileImage || ispatient?.image) ? (
                                    <button
                                      type="button"
                                      className="viewbtn"
                                      onClick={() =>
                                        window.open(
                                          resolveCrmImageUrl(
                                            ispatient?.patient_Profile ||
                                            ispatient?.patient_profile ||
                                            ispatient?.profile_pic ||
                                            ispatient?.profileImage ||
                                            ispatient?.image
                                          ),
                                          "_blank",
                                        )
                                      }
                                    >
                                      View
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                {isReferralUser ? (
                                  <>
                                    <label className="mb-1">Referral Partner</label>
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
                                ) : !isAdmin ? (
                                  <>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <label className="mb-0">Referral Partner</label>
                                      <span
                                        className="badge text-muted"
                                        style={{ backgroundColor: "#f1f5f9", fontSize: "10.5px" }}
                                        title="Only Admin, Manager, and Sub-admin can change or unassign referral for a patient"
                                      >
                                        <i className="fa-solid fa-lock me-1"></i>Restricted
                                      </span>
                                    </div>
                                    <div
                                      className="p-2 border rounded bg-light d-flex align-items-center justify-content-between"
                                      style={{ minHeight: "38px" }}
                                    >
                                      <div>
                                        {values.Referral_Name ? (
                                          <span className="fw-semibold text-dark">
                                            {values.Referral_Name}
                                            {values.referral_id ? (
                                              <span className="badge bg-secondary ms-2">{values.referral_id}</span>
                                            ) : null}
                                          </span>
                                        ) : (
                                          <span className="text-muted fst-italic">None (Unassigned)</span>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <div className="d-flex align-items-center gap-2">
                                        <label className="mb-0">Referral Name</label>
                                        {Boolean(values.unassignReferral || values.referral_id === "unassign") && (
                                          <span
                                            className="badge"
                                            style={{
                                              backgroundColor: "#fef2f2",
                                              color: "#dc2626",
                                              border: "1px solid #fecaca",
                                              fontSize: "10px",
                                            }}
                                          >
                                            Unassigned
                                          </span>
                                        )}
                                      </div>
                                      <div className="d-flex align-items-center gap-2">
                                        {Boolean(
                                          (values.Referral_Name || values.referral_id) &&
                                          !values.unassignReferral &&
                                          values.referral_id !== "unassign"
                                        ) && (
                                            <button
                                              type="button"
                                              className="btn btn-link p-0 text-danger text-decoration-none"
                                              style={{ fontSize: "11px", fontWeight: 600 }}
                                              onClick={() => {
                                                setFieldValue("Referral_Name", "");
                                                setFieldValue("referral_id", "unassign");
                                                setFieldValue("unassignReferral", true);
                                              }}
                                              title="Unassign current referral partner"
                                            >
                                              <i className="fa-solid fa-user-xmark me-1"></i>Unassign
                                            </button>
                                          )}
                                        <button
                                          type="button"
                                          className="add-button approvebtn"
                                          onClick={() => setShowReferralModal(true)}
                                        >
                                          + Add
                                        </button>
                                      </div>
                                    </div>
                                    <Field name="Referral_Name">
                                      {({ form }) => {
                                        const isMarkedUnassigned =
                                          form.values.unassignReferral ||
                                          form.values.referral_id === "unassign";

                                        const selectedOption = isMarkedUnassigned
                                          ? null
                                          : referralsList.find(
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
                                              form.setFieldValue("unassignReferral", false);
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
                                                form.setFieldValue("referral_id", "unassign");
                                                form.setFieldValue("unassignReferral", true);
                                              }
                                            }}
                                            onInputChange={(e, newInputValue, reason) => {
                                              if (reason === "input") {
                                                form.setFieldValue("unassignReferral", false);
                                                form.setFieldValue("Referral_Name", newInputValue);
                                              }
                                            }}
                                            renderInput={(params) => (
                                              <TextField
                                                {...params}
                                                size="small"
                                                placeholder={
                                                  isMarkedUnassigned
                                                    ? "Unassigned (Select to assign...)"
                                                    : "Select or enter referrer..."
                                                }
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
                                    {values.unassignReferral && (
                                      <small className="text-danger d-block mt-1" style={{ fontSize: "11px" }}>
                                        <i className="fa-solid fa-circle-exclamation me-1"></i>
                                        Referral partner will be unassigned on save
                                      </small>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Treatment Name
                                </label>
                                <Autocomplete
                                  options={Treatment || []}
                                  getOptionLabel={(option) => option.name || ""}
                                  value={
                                    Treatment?.find(
                                      (item) => item.name === values.patientDisease,
                                    ) || null
                                  }
                                  onChange={(e, value) => {
                                    setFieldValue(
                                      "patientDisease",
                                      value?.name || "",
                                    );
                                    setFieldValue("disease_id", value?.id || "");
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      placeholder="Select Treatment"
                                      error={Boolean(
                                        touched.patientDisease &&
                                        errors.patientDisease,
                                      )}
                                      helperText={
                                        touched.patientDisease &&
                                        errors.patientDisease
                                      }
                                    />
                                  )}
                                  sx={{
                                    "& .MuiOutlinedInput-root": {
                                      padding: "0px",
                                    },
                                  }}
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Treating In<span className="text-danger">*</span>
                                </label>
                                <Field name="treatingIn">
                                  {({ field, form }) => (
                                    <>
                                      <FormControl fullWidth size="small">
                                        <Select
                                          value={field.value}
                                          onChange={(e) =>
                                            form.setFieldValue(
                                              "treatingIn",
                                              e.target.value,
                                            )
                                          }
                                          input={
                                            <OutlinedInput placeholder="Select Country" />
                                          }
                                          className="select-country form-control"
                                          displayEmpty
                                          sx={{ height: 40 }}
                                          MenuProps={{
                                            PaperProps: {
                                              style: {
                                                maxHeight: 260, // Limit dropdown height
                                              },
                                            },
                                          }}
                                        >
                                          <MenuItem value="">
                                            <em>Select Country</em>
                                          </MenuItem>
                                          {Countries.map((con, index) => (
                                            <MenuItem key={index} value={con.name}>
                                              {con.name}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                      <ErrorMessage
                                        name="treatingIn"
                                        component="div"
                                        style={{ color: "red" }}
                                      />
                                    </>
                                  )}
                                </Field>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>Assigned Coordinator</label>
                                <Field name="coordinatorId">
                                  {({ field, form }) => (
                                    <FormControl fullWidth size="small">
                                      <Select
                                        disabled={!isAdminUser()}
                                        value={field.value || ""}
                                        onChange={(e) =>
                                          form.setFieldValue(
                                            "coordinatorId",
                                            e.target.value,
                                          )
                                        }
                                        input={<OutlinedInput />}
                                        className="select-country form-control"
                                        displayEmpty
                                        sx={{ height: 40 }}
                                      >
                                        <MenuItem value="">
                                          <em>None (Unassigned)</em>
                                        </MenuItem>
                                        {coordinatorsList.map((c) => {
                                          const cId = String(c._id || c.id || c.userId);
                                          return (
                                            <MenuItem key={cId} value={cId}>
                                              {c.name}{" "}
                                              {Array.isArray(c.accessCountries) &&
                                                c.accessCountries.length > 0
                                                ? `(${c.accessCountries.join(", ")})`
                                                : ""}
                                            </MenuItem>
                                          );
                                        })}
                                      </Select>
                                    </FormControl>
                                  )}
                                </Field>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <label className="mb-0">Assigned Physiotherapist</label>
                                  {Boolean(
                                    values.physiotherapistId &&
                                    values.physiotherapistId !== "unassign" &&
                                    !values.unassignPhysiotherapist
                                  ) && (
                                      <button
                                        type="button"
                                        className="btn btn-link p-0 text-danger text-decoration-none"
                                        style={{ fontSize: "11px", fontWeight: 600 }}
                                        onClick={() => {
                                          setFieldValue("physiotherapistId", "unassign");
                                          setFieldValue("unassignPhysiotherapist", true);
                                        }}
                                        title="Unassign current physiotherapist"
                                      >
                                        <i className="fa-solid fa-user-xmark me-1"></i>Unassign
                                      </button>
                                    )}
                                </div>
                                <Field name="physiotherapistId">
                                  {({ field, form }) => (
                                    <FormControl fullWidth size="small">
                                      <Select
                                        value={field.value === "unassign" ? "" : (field.value || "")}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (!val) {
                                            form.setFieldValue("physiotherapistId", "unassign");
                                            form.setFieldValue("unassignPhysiotherapist", true);
                                          } else {
                                            form.setFieldValue("physiotherapistId", val);
                                            form.setFieldValue("unassignPhysiotherapist", false);
                                          }
                                        }}
                                        input={<OutlinedInput />}
                                        className="select-country form-control"
                                        displayEmpty
                                        sx={{ height: 40 }}
                                      >
                                        <MenuItem value="">
                                          <em>None (Unassigned)</em>
                                        </MenuItem>
                                        {physioList.map((p) => {
                                          const pId = String(p.userId || p._id || p.id);
                                          return (
                                            <MenuItem key={pId} value={pId}>
                                              {p.name || p.fullName || "Physiotherapist"}
                                              {p.role && p.role !== "Physiotherapist" ? ` (${p.role})` : ""}
                                            </MenuItem>
                                          );
                                        })}
                                      </Select>
                                    </FormControl>
                                  )}
                                </Field>
                                {values.unassignPhysiotherapist && (
                                  <small className="text-danger d-block mt-1" style={{ fontSize: "11px" }}>
                                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                                    Physiotherapist will be unassigned on save
                                  </small>
                                )}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>
                                  Date<span className="text-danger">*</span>
                                </label>
                                <Field
                                  className="form-control"
                                  type="date"
                                  name="created_at"
                                />
                                <ErrorMessage
                                  name="created_at"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="field-set">
                                <label>Notification</label>
                                <div className="form-check mt-2">
                                  <Field
                                    type="checkbox"
                                    name="notificationEnabled"
                                    className="form-check-input"
                                  />

                                  <label className="form-check-label ms-2">
                                    Notification Enabled
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="">
                                <button
                                  type="submit"
                                  className="submit-btn"
                                  disabled={isSubmitting}
                                >
                                  Submit
                                </button>
                              </div>
                            </div>
                          </div>
                        </Form>
                      )}
                    </Formik>
                  );
                })()}
                {/* Referral Create Modal */}
                <ReferralCreateModal
                  open={showReferralModal}
                  onClose={() => setShowReferralModal(false)}
                  onSuccess={(newReferral) => {
                    if (newReferral) {
                      setReferralsList((prev) => [newReferral, ...prev]);
                      if (formikRef.current) {
                        formikRef.current.setFieldValue(
                          "Referral_Name",
                          newReferral.name || ""
                        );
                        formikRef.current.setFieldValue(
                          "referral_id",
                          newReferral.referral_id || newReferral.id || ""
                        );
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
