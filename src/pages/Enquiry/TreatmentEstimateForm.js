import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorMessage, Field, Form, Formik } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { Autocomplete, TextField } from "@mui/material";
import { GetAllCountries2 } from "../../reducer/Countries";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import CountryCodeSelect from "./CountryCodeSelect";
import { NativeSubmitButton } from "../../components/Common/SubmitButton";
import {
  handleContactNumberChange,
  optionalContactNumberYup,
} from "../../utils/phoneValidation";
import {
  fetchTreatmentEstimate,
  saveTreatmentEstimate,
} from "../../services/treatmentEstimateApi";
import { crmSaveErrorMessage, isCrmSaveSuccess } from "../../services/crmRequestSaveApi";
import { CountryNameDropdown } from "../../components/LocationSelects";
import PatientUserSelect, {
  applyPatientProfile,
} from "../../components/PatientUserSelect";
import { imageUrl } from "../../Basurl/Baseurl";
import { markRecordRead } from "../../services/unreadApi";
import CameraFileUpload from "../../components/Common/CameraFileUpload";

const emptyValues = {
  user_id: "",
  passport_number: "",
  treatment: "",
  treatment_id: "",
  country: "",
  name: "",
  email: "",
  country_code: "",
  phone: "",
  whatsapp: "",
  message: "",
  treating_in_country: "",
  country_id: "",
  reports: [],
};

const mapRecordToValues = (row = {}) => ({
  user_id: row.user_id || row.userId || "",
  passport_number: row.passport_number || row.passport_num || "",
  treatment: row.treatment || row.disease_name || "",
  treatment_id: row.treatment_id || row.disease_id || "",
  country: row.country || "",
  name: row.name || "",
  email: row.email || "",
  country_code: row.country_code || row.phoneCode || row.dial_code || "",
  phone: row.phone || "",
  whatsapp: row.whatsapp || "",
  message: row.message || row.description || "",
  treating_in_country: row.treating_in_country || "",
  country_id: row.country_id || "",
  reports: [],
});

const getReportUrl = (file) => {
  if (!file) return "";
  if (typeof file === "string") {
    return file.startsWith("http") ? file : `${imageUrl}${file}`;
  }
  const path = file.report || file.url || file.path || file.image || "";
  if (!path) return "";
  return String(path).startsWith("http") ? path : `${imageUrl}${path}`;
};

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

export default function TreatmentEstimateForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { Countries } = useSelector((state) => state.Countries);
  const { Treatment } = useSelector((state) => state.Treatment);
  const recordId = location.state?.id;
  const isEdit = Boolean(recordId);
  const [initialValues, setInitialValues] = useState(emptyValues);
  const [existingReports, setExistingReports] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(isEdit);

  useEffect(() => {
    dispatch(GetAllCountries2());
    dispatch(GetAllTreatment());
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
        const res = await fetchTreatmentEstimate(recordId);
        const row = res?.data || res?.detail || {};
        if (!cancelled) {
          setInitialValues(mapRecordToValues(row));
          const files = Array.isArray(row.reports)
            ? row.reports
            : row.image
              ? [row.image]
              : [];
          setExistingReports(files);
        }
      } catch (error) {
        if (!cancelled) {
          Swal.fire(
            "Error",
            error?.response?.data?.message || "Failed to load treatment estimate",
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
        passport_number: Yup.string()
          .trim()
          .required("NIC/Passport number is required")
          .matches(
            /^[A-Za-z0-9]{6,15}$/,
            "Passport number must be 6–15 characters (letters & digits only)",
          ),
        treatment: Yup.string().required("Treatment is required"),
        country: Yup.string().required("Country is required"),
        name: Yup.string().trim().nullable(),
        email: Yup.string().email("Enter a valid email").nullable(),
        country_code: Yup.string().nullable(),
        phone: optionalContactNumberYup({ label: "Phone number" }),
        whatsapp: optionalContactNumberYup({ label: "WhatsApp number" }),
        message: Yup.string().trim().nullable(),
        treating_in_country: Yup.string().required("Treating in country is required"),
      }),
    [],
  );

  const goBack = () => {
    localStorage.setItem("tabenquiry", "3");
    navigate("/Admin/inquiry");
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    const formData = new FormData();
    if (isEdit) {
      formData.append("id", recordId);
    }
    formData.append("user_id", values.user_id);
    if (values.country_id) {
      formData.append("country_id", values.country_id);
    }
    formData.append("treating_in_country", values.treating_in_country || "");
    if (values.treatment_id) {
      formData.append("treatment_id", values.treatment_id);
    } else if (values.treatment) {
      formData.append("treatment_manual", values.treatment);
    }

    Object.entries(values).forEach(([key, value]) => {
      if (
        [
          "reports",
          "user_id",
          "country",
          "treatment",
          "treatment_id",
          "treating_in_country",
        ].includes(key)
      ) {
        return;
      }
      if (value === undefined || value === null || value === "") return;
      formData.append(key, value);
    });

    if (values.country_code) {
      formData.append("phone_code", values.country_code);
    }

    (values.reports || []).forEach((file) => {
      if (file) formData.append("reports[]", file);
    });

    try {
      const res = await saveTreatmentEstimate(formData);
      if (!isCrmSaveSuccess(res)) {
        Swal.fire(
          "Error",
          crmSaveErrorMessage({ response: { data: res } }, "Unable to save treatment estimate"),
          "error",
        );
        return;
      }
      await Swal.fire(
        "Success",
        res?.message ||
          (isEdit ? "Treatment estimate updated" : "Treatment estimate created"),
        "success",
      );
      goBack();
    } catch (error) {
      Swal.fire(
        "Error",
        crmSaveErrorMessage(error, "Unable to save treatment estimate"),
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

  const autocompleteInputSx = {
    "& .MuiInputBase-root": { height: 38 },
    "& .MuiInputBase-input": { padding: "6px 12px" },
  };

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
                {isEdit ? "Edit Treatment Estimate" : "Create Treatment Estimate"}
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
              {({ values, setFieldValue, errors, touched, isSubmitting }) => {
                const selectedTreatment =
                  (Treatment || []).find(
                    (item) =>
                      String(item.id) === String(values.treatment_id) ||
                      item.name === values.treatment,
                  ) || null;

                return (
                  <Form>
                    <div className="row gx-3 gy-3">
                      <div className="col-md-12">
                        <div className="main_content">
                          <div className="row gx-3 gy-3">
                            <div className="col-md-4">
                              <PatientUserSelect
                                value={values.user_id}
                                disabled={isEdit}
                                required
                                error={Boolean(errors.user_id && touched.user_id)}
                                helperText={
                                  errors.user_id && touched.user_id
                                    ? errors.user_id
                                    : ""
                                }
                                onChange={(userId, patient) => {
                                  setFieldValue("user_id", userId);
                                  if (!isEdit && patient) {
                                    applyPatientProfile(patient, setFieldValue, [
                                      "treating_in_country",
                                      "country",
                                    ]);
                                  }
                                }}
                              />
                            </div>
                            <FormField label="NIC/Passport" name="passport_number" required>
                              <Field
                                className="form-control"
                                name="passport_number"
                                maxLength={15}
                                placeholder="Enter NIC/Passport"
                              />
                            </FormField>
                            <div className="col-md-4">
                              <div className="set-field">
                                <label>
                                  Treatment
                                  <span className="text-danger">*</span>
                                </label>
                                <Autocomplete
                                  options={Treatment || []}
                                  getOptionLabel={(option) => option?.name || ""}
                                  value={selectedTreatment}
                                  isOptionEqualToValue={(option, value) =>
                                    option.id === value?.id
                                  }
                                  onChange={(_, selected) => {
                                    setFieldValue("treatment", selected?.name || "");
                                    setFieldValue("treatment_id", selected?.id || "");
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      size="small"
                                      placeholder="Select Treatment"
                                      error={Boolean(
                                        errors.treatment && touched.treatment,
                                      )}
                                      sx={autocompleteInputSx}
                                    />
                                  )}
                                />
                                <ErrorMessage
                                  name="treatment"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <CountryNameDropdown
                              label="Country"
                              name="country"
                              required
                              value={values.country}
                              error={Boolean(errors.country && touched.country)}
                              onChange={(name, item) => {
                                setFieldValue("country", name);
                                setFieldValue("country_id", item?.id || "");
                              }}
                            />
                            <FormField label="Name" name="name" required>
                              <Field
                                className="form-control"
                                name="name"
                                placeholder="Enter name"
                              />
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
                                <div
                                  className="country-code"
                                  style={{ position: "relative" }}
                                >
                                  <CountryCodeSelect
                                    value={values.country_code}
                                    onChange={(code) =>
                                      setFieldValue("country_code", code)
                                    }
                                    countries={Countries}
                                    error={Boolean(
                                      errors.country_code && touched.country_code,
                                    )}
                                  />
                                  <Field
                                    className="form-control code-in"
                                    name="phone"
                                    placeholder="Enter phone number"
                                    onChange={(e) =>
                                      handleContactNumberChange(
                                        e,
                                        setFieldValue,
                                        "phone",
                                      )
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
                            <FormField label="WhatsApp Number" name="whatsapp">
                              <Field
                                className="form-control"
                                name="whatsapp"
                                placeholder="Enter WhatsApp number"
                                onChange={(e) =>
                                  handleContactNumberChange(
                                    e,
                                    setFieldValue,
                                    "whatsapp",
                                  )
                                }
                              />
                            </FormField>
                            <div className="col-md-8">
                              <div className="set-field">
                                <label>
                                  Description
                                  <span className="text-danger">*</span>
                                </label>
                                <Field
                                  as="textarea"
                                  className="form-control"
                                  name="message"
                                  rows={3}
                                  placeholder="Text here"
                                />
                                <ErrorMessage
                                  name="message"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                            <CountryNameDropdown
                              label="Treating In Country"
                              name="treating_in_country"
                              required
                              value={values.treating_in_country}
                              error={Boolean(
                                errors.treating_in_country &&
                                  touched.treating_in_country,
                              )}
                              onChange={(name) =>
                                setFieldValue("treating_in_country", name)
                              }
                            />
                            <div className="col-md-4">
                              <div className="set-field">
                                <CameraFileUpload
                                  label="Upload Report / Take Picture"
                                  files={values.reports || []}
                                  setFiles={(files) =>
                                    setFieldValue("reports", files)
                                  }
                                  multiple={true}
                                  accept=".pdf,image/*"
                                  helperText="Take photos of reports or upload files"
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
                          </div>
                        </div>
                      </div>
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
                );
              }}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
}
