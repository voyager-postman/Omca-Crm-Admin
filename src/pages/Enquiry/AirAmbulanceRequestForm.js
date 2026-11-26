import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorMessage, Field, Form, Formik } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { Autocomplete, TextField } from "@mui/material";
import { GetAllCountries2 } from "../../reducer/Countries";
import CountryCodeSelect from "./CountryCodeSelect";
import { NativeSubmitButton } from "../../components/Common/SubmitButton";
import {
  handleContactNumberChange,
  optionalContactNumberYup,
} from "../../utils/phoneValidation";
import {
  fetchAirAmbulanceRequest,
  saveAirAmbulanceRequest,
} from "../../services/airAmbulanceApi";
import { crmSaveErrorMessage, isCrmSaveSuccess } from "../../services/crmRequestSaveApi";
import PatientUserSelect, {
  applyPatientProfile,
} from "../../components/PatientUserSelect";
import { CountryNameDropdown } from "../../components/LocationSelects";
import { imageUrl } from "../../Basurl/Baseurl";
import { isOnOrAfterToday, todayDateInput } from "../../utils/dateInput";
import { markRecordRead } from "../../services/unreadApi";

const YES_NO_OPTIONS = [
  { label: "Yes", value: "1" },
  { label: "No", value: "2" },
];
const URGENCY_OPTIONS = ["Emergency", "Non-Emergency"];
const LOCATION_TYPE_OPTIONS = ["Home", "Hospital", "Office"];
const CONDITION_OPTIONS = ["Critical", "Stable", "Unconscious", "Injured"];
const AMBULANCE_TYPE_OPTIONS = [
  "Basic Life Support (BLS)",
  "Advanced Life Support (ALS)",
  "ICU / Ventilator ambulance",
];
const SPECIAL_NEEDS_OPTIONS = [
  "Oxygen",
  "Stretcher",
  "Wheelchair",
  "Cardiac Monitor",
];
const PAYMENT_OPTIONS = ["Cash", "Card", "Insurance"];
const SERVICE_OPTIONS = [
  "Air Ambulance",
  "Medical Escort",
  "Commercial Stretcher",
];

const emptyValues = {
  user_id: "",
  name: "",
  email: "",
  country_code: "",
  phone: "",
  passport_number: "",
  treating_in_country: "",
  from: "",
  to: "",
  select_date: "",
  arrival_time: "",
  travellers_count: "",
  services: "",
  location_pin: "",
  consciousness_status: "",
  breathing_difficulty: "",
  level_of_urgency: "",
  bleeding_or_trauma_details: "",
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
  reports: [],
  terms_condtion: false,
};

const toYesNo = (value) => {
  if (value === 1 || value === "1" || String(value).toLowerCase() === "yes") {
    return "1";
  }
  if (value === 2 || value === "2" || String(value).toLowerCase() === "no") {
    return "2";
  }
  return value ? String(value) : "";
};

const toDateInput = (value) => {
  if (!value) return "";
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
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
};

const formatServiceValue = (value) => {
  if (!value) return "";
  const asText = String(value).replaceAll("_", " ");
  const match = SERVICE_OPTIONS.find(
    (item) => item.toLowerCase() === asText.toLowerCase(),
  );
  return match || asText;
};

const mapRecordToValues = (row = {}) => ({
  user_id: row.user_id || row.userId || "",
  name: row.name || row.first_name || "",
  email: row.email || "",
  country_code: row.country_code || row.phoneCode || row.dial_code || "",
  phone: row.phone || "",
  passport_number: row.passport_number || row.passport_num || "",
  treating_in_country: row.treating_in_country || "",
  from: row.from || "",
  to: row.to || "",
  select_date: toDateInput(row.select_date),
  arrival_time: toTimeInput(row.arrival_time),
  travellers_count: row.travellers_count || "",
  services: formatServiceValue(row.services),
  location_pin: row.location_pin || "",
  consciousness_status: toYesNo(row.consciousness_status),
  breathing_difficulty: toYesNo(row.breathing_difficulty),
  level_of_urgency: row.level_of_urgency || "",
  bleeding_or_trauma_details: row.bleeding_or_trauma_details || "",
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

const FormField = ({ label, name, required, children }) => (
  <div className="col-md-4">
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

export default function AirAmbulanceRequestForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { Countries } = useSelector((state) => state.Countries);
  const recordId = location.state?.id;
  const isEdit = Boolean(recordId);
  const [initialValues, setInitialValues] = useState(emptyValues);
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
        const res = await fetchAirAmbulanceRequest(recordId);
        const row = res?.data || res?.detail || {};
        if (!cancelled) {
          setInitialValues(mapRecordToValues(row));
          setExistingReports(Array.isArray(row.reports) ? row.reports : []);
        }
      } catch (error) {
        if (!cancelled) {
          Swal.fire(
            "Error",
            error?.response?.data?.message || "Failed to load air medical escort",
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
        email: Yup.string().email("Enter a valid email").nullable(),
        country_code: Yup.string().nullable(),
        phone: optionalContactNumberYup({ label: "Phone number" }),
        passport_number: Yup.string()
          .trim()
          .required("Passport number is required")
          .matches(
            /^[A-Za-z0-9]{6,15}$/,
            "Passport number must be 6–15 characters (letters & digits only)",
          ),
        treating_in_country: Yup.string().required("Treating in country is required"),
        from: Yup.string().trim().required("From is required"),
        to: Yup.string().trim().required("To is required"),
        select_date: Yup.string()
          .required("Travel date is required")
          .test(
            "not-past",
            "Previous dates are not allowed",
            (value) => isOnOrAfterToday(value),
          ),
        arrival_time: Yup.string().required("Arrival time is required"),
        travellers_count: Yup.number()
          .typeError("Enter a valid number")
          .required("Number of travellers is required"),
        services: Yup.string().required("Service is required"),
        location_pin: Yup.string().trim().required("GPS / location pin is required"),
        consciousness_status: Yup.string().required("Consciousness status is required"),
        breathing_difficulty: Yup.string().required("Breathing difficulty is required"),
        level_of_urgency: Yup.string().required("Level of urgency is required"),
        bleeding_or_trauma_details: Yup.string()
          .trim()
          .required("Bleeding or trauma details are required"),
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
    localStorage.setItem("tabenquiry", "2");
    navigate("/Admin/inquiry");
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    const formData = new FormData();
    if (isEdit) {
      formData.append("id", recordId);
    }
    formData.append("user_id", values.user_id);

    Object.entries(values).forEach(([key, value]) => {
      if (key === "reports" || key === "terms_condtion" || key === "user_id") return;
      if (value === undefined || value === null || value === "") return;
      formData.append(key, value);
    });

    if (values.country_code) {
      formData.append("phone_code", values.country_code);
    }
    formData.append("terms_condtion", values.terms_condtion ? "1" : "0");

    (values.reports || []).forEach((file) => {
      if (file) formData.append("reports[]", file);
    });

    try {
      const res = await saveAirAmbulanceRequest(formData);
      if (!isCrmSaveSuccess(res)) {
        Swal.fire(
          "Error",
          crmSaveErrorMessage({ response: { data: res } }, "Unable to save air medical escort"),
          "error",
        );
        return;
      }
      await Swal.fire(
        "Success",
        res?.message ||
          (isEdit ? "Air medical escort updated" : "Air medical escort created"),
        "success",
      );
      goBack();
    } catch (error) {
      Swal.fire(
        "Error",
        crmSaveErrorMessage(error, "Unable to save air medical escort"),
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
                {isEdit ? "Edit Air Medical Escort" : "Create Air Medical Escort"}
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
              {({ values, setFieldValue, errors, touched, isSubmitting }) => (
                <Form>
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
                      <FormField label="Name" name="name" required>
                        <Field className="form-control" name="name" placeholder="Enter name" />
                      </FormField>
                      <FormField label="Email" name="email">
                        <Field
                          className="form-control"
                          name="email"
                          type="email"
                          placeholder="Enter email"
                        />
                      </FormField>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Phone Number
                            <span className="text-danger">*</span>
                          </label>
                          <div className="country-code" style={{ position: "relative" }}>
                            <CountryCodeSelect
                              value={values.country_code}
                              onChange={(code) => setFieldValue("country_code", code)}
                              countries={Countries}
                              error={Boolean(errors.country_code && touched.country_code)}
                            />
                            <Field
                              className="form-control code-in"
                              name="phone"
                              placeholder="Enter phone number"
                              onChange={(e) =>
                                handleContactNumberChange(e, setFieldValue, "phone")
                              }
                            />
                          </div>
                          <ErrorMessage
                            name="country_code"
                            component="div"
                            className="text-danger"
                          />
                          <ErrorMessage
                            name="phone"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <FormField label="Passport Number" name="passport_number" required>
                        <Field
                          className="form-control"
                          name="passport_number"
                          maxLength={15}
                          placeholder="Enter passport number"
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

                    <Section title="Travel Details">
                      <FormField label="From" name="from" required>
                        <Field className="form-control" name="from" placeholder="Enter here" />
                      </FormField>
                      <FormField label="To" name="to" required>
                        <Field className="form-control" name="to" placeholder="Enter here" />
                      </FormField>
                      <FormField label="Travel Date" name="select_date" required>
                        <Field
                          className="form-control"
                          type="date"
                          name="select_date"
                          min={todayDateInput()}
                        />
                      </FormField>
                      <FormField label="Arrival Time" name="arrival_time" required>
                        <Field className="form-control" type="time" name="arrival_time" />
                      </FormField>
                      <FormField label="Number of Traveller" name="travellers_count" required>
                        <Field
                          className="form-control"
                          type="number"
                          name="travellers_count"
                          min="1"
                          placeholder="Enter here"
                        />
                      </FormField>
                      <FormField label="Services" name="services" required>
                        <Field as="select" className="form-control" name="services">
                          <option value="">Select</option>
                          {SERVICE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                          {values.services &&
                            !SERVICE_OPTIONS.includes(values.services) && (
                              <option value={values.services}>{values.services}</option>
                            )}
                        </Field>
                      </FormField>
                      <FormField label="GPS/Location Pin" name="location_pin" required>
                        <Field
                          className="form-control"
                          name="location_pin"
                          placeholder="Enter here"
                        />
                      </FormField>
                    </Section>

                    <Section title="Emergency Assessment">
                      <FormField label="Consciousness status" name="consciousness_status" required>
                        <div>
                          {YES_NO_OPTIONS.map((option) => (
                            <label key={option.value} className="me-3">
                              <Field
                                type="radio"
                                name="consciousness_status"
                                value={option.value}
                                className="me-1"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </FormField>
                      <FormField label="Breathing difficulty" name="breathing_difficulty" required>
                        <div>
                          {YES_NO_OPTIONS.map((option) => (
                            <label key={option.value} className="me-3">
                              <Field
                                type="radio"
                                name="breathing_difficulty"
                                value={option.value}
                                className="me-1"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </FormField>
                      <FormField label="Level of urgency" name="level_of_urgency" required>
                        <Field as="select" className="form-control" name="level_of_urgency">
                          <option value="">Select</option>
                          {URGENCY_OPTIONS.map((item) => (
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

                    <Section title="Destination Details">
                      <FormField label="Destination Address" name="destination_address" required>
                        <Field as="select" className="form-control" name="destination_address">
                          <option value="">Select</option>
                          {LOCATION_TYPE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                          {values.destination_address &&
                            !LOCATION_TYPE_OPTIONS.includes(values.destination_address) && (
                              <option value={values.destination_address}>
                                {values.destination_address}
                              </option>
                            )}
                        </Field>
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
                          {CONDITION_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField label="Ambulance Type" name="ambulance_type" required>
                        <Field as="select" className="form-control" name="ambulance_type">
                          <option value="">Select</option>
                          {AMBULANCE_TYPE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Field>
                      </FormField>
                      <FormField label="Special needs" name="special_needs" required>
                        <Field as="select" className="form-control" name="special_needs">
                          <option value="">Select</option>
                          {SPECIAL_NEEDS_OPTIONS.map((item) => (
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
                      <FormField label="Alternate contact number" name="alternate_contact_number">
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
                          {PAYMENT_OPTIONS.map((item) => (
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
