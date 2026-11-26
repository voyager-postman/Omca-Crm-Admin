import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorMessage, Field, Form, Formik } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { GetAllCountries2 } from "../../reducer/Countries";
import CountryCodeSelect from "./CountryCodeSelect";
import { Autocomplete, TextField } from "@mui/material";
import { NativeSubmitButton } from "../../components/Common/SubmitButton";
import {
  handleContactNumberChange,
  optionalContactNumberYup,
} from "../../utils/phoneValidation";
import { fetchAmbulanceRequest, saveAmbulanceRequest, unwrapAmbulanceRow } from "../../services/ambulanceApi";
import {
  crmSaveErrorMessage as ambulanceApiErrorMessage,
  isCrmSaveSuccess,
} from "../../services/crmRequestSaveApi";
import { CountryNameDropdown } from "../../components/LocationSelects";
import PatientUserSelect, {
  applyPatientProfile,
} from "../../components/PatientUserSelect";
import { imageUrl } from "../../Basurl/Baseurl";
import { isOnOrAfterToday, todayDateInput } from "../../utils/dateInput";
import { markRecordRead } from "../../services/unreadApi";

const YES_NO_OPTIONS = ["Yes", "No"];
const URGENCY_OPTIONS = ["High", "Medium", "Low", "Emergency", "Non-Emergency"];
const LOCATION_TYPE_OPTIONS = ["Home", "Hospital", "Office", "Airport"];
const CONDITION_OPTIONS = ["Critical", "Stable", "Unconscious", "Injured"];
const AMBULANCE_TYPE_OPTIONS = [
  "Basic",
  "Advanced",
  "Basic Life Support (BLS)",
  "Advanced Life Support (ALS)",
  "ICU / Ventilator ambulance",
];
const SPECIAL_NEEDS_OPTIONS = [
  "No",
  "Oxygen",
  "Stretcher",
  "Wheelchair",
  "Cardiac Monitor",
];
const PAYMENT_OPTIONS = ["Cash", "Card", "Insurance"];

const API_FIELDS = [
  "user_id",
  "treating_in_country",
  "consciousness_status",
  "breathing_difficulty",
  "level_of_urgency",
  "bleeding_or_trauma_details",
  "pickup_address",
  "pickup_location_type",
  "pickup_date",
  "pickup_time",
  "location_pin",
  "destination_address",
  "hospital_name",
  "department_or_ward",
  "reason_for_ambulance_request",
  "patient_condition",
  "ambulance_type",
  "special_needs",
  "name_of_caller_or_attendant",
  "relationship_to_patient",
  "alternate_contact_number",
  "payment_method",
  "insurance_details",
  "reference_number",
  "special_instructions",
  "language_preference",
  "doctor_reference",
];

const emptyValues = {
  user_id: "",
  name: "",
  email: "",
  country_code: "",
  phone: "",
  passport_number: "",
  treating_in_country: "",
  consciousness_status: "",
  breathing_difficulty: "",
  level_of_urgency: "",
  bleeding_or_trauma_details: "",
  pickup_address: "",
  pickup_location_type: "",
  pickup_date: "",
  pickup_time: "",
  location_pin: "",
  destination_address: "",
  hospital_name: "",
  department_or_ward: "",
  reason_for_ambulance_request: "",
  patient_condition: "",
  ambulance_type: "",
  special_needs: "",
  name_of_caller_or_attendant: "",
  relationship_to_patient: "",
  alternate_contact_number: "",
  payment_method: "",
  insurance_details: "",
  reference_number: "",
  special_instructions: "",
  language_preference: "",
  doctor_reference: "",
  reports: [],
  terms_condtion: false,
};

const mapYesNo = (value) => {
  const raw = String(value ?? "").toLowerCase();
  if (
    value === 1 ||
    value === "1" ||
    raw === "yes" ||
    raw === "conscious" ||
    raw === "semi-conscious" ||
    raw === "semi conscious"
  ) {
    return "Yes";
  }
  if (
    value === 0 ||
    value === "0" ||
    value === 2 ||
    value === "2" ||
    raw === "no" ||
    raw === "unconscious"
  ) {
    return "No";
  }
  return value ? String(value) : "";
};

const toYesNoFlag = (value) => (String(value).toLowerCase() === "yes" ? "1" : "0");

const toDateInput = (value) => {
  if (!value) return "";
  const dmy = String(value).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (value) => {
  if (!value) return "";
  const ampmMatch = String(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const meridian = ampmMatch[3].toUpperCase();
    if (meridian === "PM" && hour < 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${ampmMatch[2]}`;
  }
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
};

const formatPickupDate = (value) => {
  if (!value) return "";
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  return value;
};

const formatPickupTime = (value) => {
  if (!value) return "";
  if (/AM|PM/i.test(value)) return value;
  const [hourStr, minuteStr = "00"] = String(value).split(":");
  let hour = Number(hourStr);
  if (Number.isNaN(hour)) return value;
  const meridian = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${minuteStr} ${meridian}`;
};

const mapRecordToValues = (row = {}) => ({
  user_id: row.user_id || "",
  name: row.name || "",
  email: row.email || "",
  country_code: row.country_code || row.phoneCode || row.dial_code || "",
  phone: row.phone || "",
  passport_number: row.passport_number || row.passport_num || "",
  treating_in_country: row.treating_in_country || "",
  consciousness_status: mapYesNo(row.consciousness_status),
  breathing_difficulty: mapYesNo(row.breathing_difficulty),
  level_of_urgency: row.level_of_urgency || "",
  bleeding_or_trauma_details: row.bleeding_or_trauma_details || "",
  pickup_address: row.pickup_address || "",
  pickup_location_type: row.pickup_location_type || "",
  pickup_date: toDateInput(row.pickup_date),
  pickup_time: toTimeInput(row.pickup_time),
  location_pin: row.location_pin || "",
  destination_address: row.destination_address || "",
  hospital_name: row.hospital_name || "",
  department_or_ward: row.department_or_ward || "",
  reason_for_ambulance_request: row.reason_for_ambulance_request || "",
  patient_condition: row.patient_condition || "",
  ambulance_type: row.ambulance_type || "",
  special_needs: Array.isArray(row.special_needs)
    ? row.special_needs[0] || ""
    : row.special_needs || "",
  name_of_caller_or_attendant: row.name_of_caller_or_attendant || "",
  relationship_to_patient: row.relationship_to_patient || "",
  alternate_contact_number: row.alternate_contact_number || "",
  payment_method: row.payment_method || "",
  insurance_details: row.insurance_details || "",
  reference_number: row.reference_number || "",
  special_instructions: row.special_instructions || "",
  language_preference: row.language_preference || "",
  doctor_reference: row.doctor_reference || "",
  reports: [],
  terms_condtion: true,
});

const getReportUrl = (file) => {
  if (!file) return "";
  if (typeof file === "string") {
    return file.startsWith("http") ? file : `${imageUrl}${file}`;
  }
  const path = file.report || file.url || file.path || "";
  if (!path) return "";
  return String(path).startsWith("http") ? path : `${imageUrl}${path}`;
};

const Section = ({ title, children }) => (
  <div className="col-md-12">
    <div className="main_content">
      <div className="row gx-3 gy-3">
        <div className="col-md-12">
          <div className="comnthis">
            <h6>{title}</h6>
          </div>
        </div>
        {children}
      </div>
    </div>
  </div>
);

const FormField = ({ label, name, required, children, colClass = "col-md-4" }) => (
  <div className={colClass}>
    <div className="set-field">
      <label>
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </label>
      {children}
      <ErrorMessage name={name} component="div" className="text-danger" />
    </div>
  </div>
);

const flattenErrors = (errors) => {
  const messages = [];
  Object.values(errors || {}).forEach((value) => {
    if (!value) return;
    if (typeof value === "string") messages.push(value);
    else if (typeof value === "object") messages.push(...flattenErrors(value));
  });
  return messages;
};

const withCurrentOption = (options, value) =>
  value && !options.includes(value) ? [...options, value] : options;

export default function AmbulanceRequestForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { Countries } = useSelector((state) => state.Countries);
  const recordId = location.state?.id;
  const isEdit = Boolean(recordId);
  const [initialValues, setInitialValues] = useState({
    ...emptyValues,
    user_id: location.state?.user_id || "",
  });
  const [existingReports, setExistingReports] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(isEdit);

  useEffect(() => {
    dispatch(GetAllCountries2());
  }, [dispatch]);

  useEffect(() => {
    if (!isEdit) return;
    const enquiryId = location.state?.enquiryId || location.state?.id;
    if (enquiryId) markRecordRead("enquiries", enquiryId);
  }, [isEdit, location.state?.enquiryId, location.state?.id]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    const load = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetchAmbulanceRequest(recordId);
        const row = unwrapAmbulanceRow(res);
        if (!cancelled) {
          setInitialValues({
            ...mapRecordToValues(row),
            user_id: row.user_id || location.state?.user_id || "",
          });
          setExistingReports(Array.isArray(row.reports) ? row.reports : []);
        }
      } catch (error) {
        if (!cancelled) {
          Swal.fire(
            "Error",
            ambulanceApiErrorMessage(error, "Failed to load ambulance request"),
            "error",
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isEdit, recordId]);

  const validationSchema = useMemo(
    () =>
      Yup.object().shape({
        user_id: Yup.string().trim().required("Please select a patient"),
        name: Yup.string().trim().nullable(),
        email: Yup.string()
          .transform((value) => (value ? value : null))
          .email("Enter a valid email")
          .nullable(),
        country_code: Yup.string().nullable(),
        phone: optionalContactNumberYup({ label: "Phone number" }),
        passport_number: Yup.string().trim().nullable(),
        treating_in_country: Yup.string().required("Treating in country is required"),
        consciousness_status: Yup.string().required("Consciousness status is required"),
        breathing_difficulty: Yup.string().required("Breathing difficulty is required"),
        level_of_urgency: Yup.string().required("Level of urgency is required"),
        bleeding_or_trauma_details: Yup.string()
          .trim()
          .required("Bleeding or trauma details are required"),
        pickup_address: Yup.string().trim().required("Pickup address is required"),
        pickup_location_type: Yup.string().required("Pickup location type is required"),
        pickup_date: Yup.string()
          .required("Pickup date is required")
          .test(
            "not-past",
            "Previous dates are not allowed",
            (value) => isOnOrAfterToday(value),
          ),
        pickup_time: Yup.string().required("Pickup time is required"),
        location_pin: Yup.string().trim().required("GPS / location pin is required"),
        destination_address: Yup.string().required("Destination address is required"),
        reason_for_ambulance_request: Yup.string()
          .trim()
          .required("Reason for ambulance request is required"),
        patient_condition: Yup.string().required("Patient condition is required"),
        ambulance_type: Yup.string().required("Ambulance type is required"),
        special_needs: Yup.string().required("Special needs is required"),
        name_of_caller_or_attendant: Yup.string()
          .trim()
          .required("Name of caller or attendant is required"),
        relationship_to_patient: Yup.string()
          .trim()
          .required("Relationship to patient is required"),
        alternate_contact_number: optionalContactNumberYup({
          label: "Alternate contact number",
        }),
        reports: isEdit
          ? Yup.array()
          : Yup.array().min(1, "Please upload at least one report"),
        terms_condtion: isEdit
          ? Yup.boolean()
          : Yup.boolean().oneOf(
              [true],
              "Please agree to the Terms and Conditions",
            ),
      }),
    [isEdit],
  );

  const goBack = () => {
    localStorage.setItem("tabenquiry", "1");
    navigate("/Admin/inquiry");
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    const formData = new FormData();
    if (isEdit) {
      formData.append("id", recordId);
    }

    API_FIELDS.forEach((key) => {
      if (key === "pickup_date") {
        formData.append(key, values.pickup_date || "");
        return;
      }
      if (key === "pickup_time") {
        formData.append(key, values.pickup_time || "");
        return;
      }
      if (key === "user_id") {
        formData.append("user_id", values.user_id);
        return;
      }
      if (key === "consciousness_status" || key === "breathing_difficulty") {
        formData.append(key, toYesNoFlag(values[key]));
        return;
      }
      const value = values[key];
      formData.append(key, value === undefined || value === null ? "" : value);
    });

    formData.append("terms_condtion", values.terms_condtion ? "1" : "0");

    (values.reports || []).forEach((file) => {
      if (file) formData.append("reports[]", file);
    });

    try {
      const res = await saveAmbulanceRequest(formData);
      if (!isCrmSaveSuccess(res)) {
        Swal.fire(
          "Error",
          ambulanceApiErrorMessage({ response: { data: res } }, "Unable to save ambulance request"),
          "error",
        );
        return;
      }
      await Swal.fire(
        "Success",
        isEdit ? "Ambulance request updated" : "Ambulance request created",
        "success",
      );
      goBack();
    } catch (error) {
      Swal.fire(
        "Error",
        ambulanceApiErrorMessage(error, "Unable to save ambulance request"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDetail) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="topmainhd">
              <h6>
                <i
                  className="fa-solid fa-arrow-left-long me-2"
                  onClick={goBack}
                  style={{ cursor: "pointer" }}
                ></i>
                {isEdit ? "Edit Ambulance Service" : "Create Ambulance Service"}
              </h6>
            </div>
          </div>
          <div className="col-md-12">
            <Formik
              enableReinitialize
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({
                values,
                setFieldValue,
                errors,
                touched,
                isSubmitting,
                validateForm,
                setTouched,
                submitForm,
              }) => (
                <Form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const formErrors = await validateForm();
                    if (Object.keys(formErrors).length) {
                      const touchedFields = Object.keys(values).reduce(
                        (acc, key) => {
                          acc[key] = true;
                          return acc;
                        },
                        {},
                      );
                      setTouched(touchedFields, true);
                      Swal.fire(
                        "Please check the form",
                        flattenErrors(formErrors)[0] || "Fill required fields",
                        "warning",
                      );
                      setTimeout(() => {
                        document
                          .querySelector(".text-danger")
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 80);
                      return;
                    }
                    await submitForm();
                  }}
                >
                  <div className="row gx-3 gy-3">
                    <Section title="User Details">
                      <div className="col-md-4">
                        <PatientUserSelect
                          value={values.user_id}
                          disabled={isEdit}
                          required
                          error={Boolean(errors.user_id && touched.user_id)}
                          helperText={
                            errors.user_id && touched.user_id ? errors.user_id : ""
                          }
                          onChange={(userId, patient) => {
                            setFieldValue("user_id", userId);
                            if (!isEdit && patient) {
                              applyPatientProfile(patient, setFieldValue, [
                                "treating_in_country",
                              ]);
                            }
                          }}
                        />
                      </div>
                      <FormField label="Name" name="name">
                        <Field
                          className="form-control"
                          name="name"
                          placeholder="—"
                          readOnly
                          disabled
                        />
                      </FormField>
                      <FormField label="Email" name="email">
                        <Field
                          className="form-control"
                          name="email"
                          type="email"
                          placeholder="—"
                          readOnly
                          disabled
                        />
                      </FormField>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>Phone Number</label>
                          <div className="country-code" style={{ position: "relative" }}>
                            <CountryCodeSelect
                              value={values.country_code}
                              onChange={() => {}}
                              countries={Countries}
                              disabled
                            />
                            <Field
                              className="form-control code-in"
                              name="phone"
                              placeholder="—"
                              readOnly
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                      <FormField label="Passport Number" name="passport_number">
                        <Field
                          className="form-control"
                          name="passport_number"
                          placeholder="—"
                          readOnly
                          disabled
                        />
                      </FormField>
                      <CountryNameDropdown
                        label="Treating In Country"
                        name="treating_in_country"
                        required
                        value={values.treating_in_country}
                        error={Boolean(
                          errors.treating_in_country && touched.treating_in_country,
                        )}
                        onChange={(name) =>
                          setFieldValue("treating_in_country", name)
                        }
                      />
                    </Section>

                    <Section title="Emergency Assessment">
                      <FormField
                        label="Consciousness status"
                        name="consciousness_status"
                        required
                      >
                        <div>
                          {YES_NO_OPTIONS.map((option) => (
                            <label key={option} className="me-3">
                              <Field
                                type="radio"
                                name="consciousness_status"
                                value={option}
                                className="me-1"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </FormField>
                      <FormField
                        label="Breathing difficulty"
                        name="breathing_difficulty"
                        required
                      >
                        <div>
                          {YES_NO_OPTIONS.map((option) => (
                            <label key={option} className="me-3">
                              <Field
                                type="radio"
                                name="breathing_difficulty"
                                value={option}
                                className="me-1"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </FormField>
                      <FormField label="Level of urgency" name="level_of_urgency" required>
                        <Field as="select" className="form-control" name="level_of_urgency">
                          <option value="">Select</option>
                          {withCurrentOption(URGENCY_OPTIONS, values.level_of_urgency).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField
                        label="Bleeding or trauma details"
                        name="bleeding_or_trauma_details"
                        required
                      >
                        <Field
                          className="form-control"
                          name="bleeding_or_trauma_details"
                          placeholder="Enter details"
                        />
                      </FormField>
                    </Section>

                    <Section title="Pickup Details">
                      <FormField label="Pickup Address" name="pickup_address" required>
                        <Field
                          className="form-control"
                          name="pickup_address"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField
                        label="Pickup Location Type"
                        name="pickup_location_type"
                        required
                      >
                        <Field
                          as="select"
                          className="form-control"
                          name="pickup_location_type"
                        >
                          <option value="">Select</option>
                          {withCurrentOption(LOCATION_TYPE_OPTIONS, values.pickup_location_type).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField label="Pickup Date" name="pickup_date" required>
                        <Field
                          className="form-control"
                          type="date"
                          name="pickup_date"
                          min={todayDateInput()}
                        />
                      </FormField>
                      <FormField label="Pickup Time" name="pickup_time" required>
                        <Field className="form-control" type="time" name="pickup_time" />
                      </FormField>
                      <FormField label="GPS/Location Pin" name="location_pin" required>
                        <Field
                          className="form-control"
                          name="location_pin"
                          placeholder="Enter here"
                        />
                      </FormField>
                    </Section>

                    <Section title="Destination Details">
                      <FormField
                        label="Destination Address"
                        name="destination_address"
                        required
                      >
                        <Field
                          className="form-control"
                          name="destination_address"
                          placeholder="Enter destination address"
                        />
                      </FormField>
                      <FormField label="Hospital Name" name="hospital_name">
                        <Field
                          className="form-control"
                          name="hospital_name"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField label="Department or ward" name="department_or_ward">
                        <Field
                          className="form-control"
                          name="department_or_ward"
                          placeholder="Enter here"
                        />
                      </FormField>
                    </Section>

                    <Section title="Medical Information">
                      <FormField
                        label="Reason for ambulance request / chief complaint"
                        name="reason_for_ambulance_request"
                        required
                      >
                        <Field
                          className="form-control"
                          name="reason_for_ambulance_request"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField label="Patient Condition" name="patient_condition" required>
                        <Field as="select" className="form-control" name="patient_condition">
                          <option value="">Select</option>
                          {withCurrentOption(CONDITION_OPTIONS, values.patient_condition).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField label="Ambulance Type" name="ambulance_type" required>
                        <Field as="select" className="form-control" name="ambulance_type">
                          <option value="">Select</option>
                          {withCurrentOption(AMBULANCE_TYPE_OPTIONS, values.ambulance_type).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField label="Special needs" name="special_needs" required>
                        <Field as="select" className="form-control" name="special_needs">
                          <option value="">Select</option>
                          {withCurrentOption(SPECIAL_NEEDS_OPTIONS, values.special_needs).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                    </Section>

                    <Section title="Attendant / Contact Person">
                      <FormField
                        label="Name of caller or attendant"
                        name="name_of_caller_or_attendant"
                        required
                      >
                        <Field
                          className="form-control"
                          name="name_of_caller_or_attendant"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField
                        label="Relationship to patient"
                        name="relationship_to_patient"
                        required
                      >
                        <Field
                          className="form-control"
                          name="relationship_to_patient"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField
                        label="Alternate contact number"
                        name="alternate_contact_number"
                      >
                        <Field
                          className="form-control"
                          name="alternate_contact_number"
                          placeholder="Enter here"
                          onChange={(e) =>
                            handleContactNumberChange(
                              e,
                              setFieldValue,
                              "alternate_contact_number",
                            )
                          }
                        />
                      </FormField>
                    </Section>

                    <Section title="Payment & Authorization">
                      <FormField label="Payment method" name="payment_method">
                        <Field as="select" className="form-control" name="payment_method">
                          <option value="">Select</option>
                          {withCurrentOption(PAYMENT_OPTIONS, values.payment_method).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField label="Insurance Details" name="insurance_details">
                        <Field
                          className="form-control"
                          name="insurance_details"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField label="Approval/reference number" name="reference_number">
                        <Field
                          className="form-control"
                          name="reference_number"
                          placeholder="Enter here"
                        />
                      </FormField>
                    </Section>

                    <Section title="Additional Notes">
                      <FormField label="Special instructions" name="special_instructions">
                        <Field
                          as="textarea"
                          className="form-control"
                          name="special_instructions"
                          placeholder="Narrow roads, Security access, Stairs"
                          rows={2}
                        />
                      </FormField>
                      <FormField label="Language preference" name="language_preference">
                        <Field
                          className="form-control"
                          name="language_preference"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField label="Doctor reference" name="doctor_reference">
                        <Field
                          className="form-control"
                          name="doctor_reference"
                          placeholder="Enter here"
                        />
                      </FormField>
                    </Section>

                    <Section title="Reports">
                      <div className="col-md-6">
                        <div className="set-field">
                          <label>
                            Upload Reports
                            {!isEdit ? <span className="text-danger">*</span> : null}
                          </label>
                          <input
                            className="form-control"
                            type="file"
                            multiple
                            onChange={(e) =>
                              setFieldValue("reports", Array.from(e.target.files || []))
                            }
                          />
                          <ErrorMessage
                            name="reports"
                            component="div"
                            className="text-danger"
                          />
                          {isEdit && existingReports.length > 0 && (
                            <div className="mt-2">
                              {existingReports.map((rep, index) => {
                                const url = getReportUrl(rep);
                                if (!url) return null;
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    className="viewbtn me-2"
                                    onClick={() => window.open(url, "_blank")}
                                  >
                                    View {index + 1}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isEdit && (
                        <div className="col-md-12">
                          <label className="d-flex align-items-center gap-2">
                            <Field type="checkbox" name="terms_condtion" />
                            I agree with the Terms and Conditions
                            <span className="text-danger">*</span>
                          </label>
                          <ErrorMessage
                            name="terms_condtion"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      )}
                    </Section>

                    <div className="col-md-12">
                      <NativeSubmitButton
                        type="submit"
                        className="submit-btn"
                        disabled={isSubmitting}
                      >
                        {isEdit ? "Update" : "Submit"}
                      </NativeSubmitButton>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
}
