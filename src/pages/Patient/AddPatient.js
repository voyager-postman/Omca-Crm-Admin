import React, { useState } from "react";
import "./AddPatient.css";
import { Formik, Field, ErrorMessage, Form } from "formik";
import * as Yup from "yup";
import { useDispatch, useSelector } from "react-redux";
import { AddAllPatients } from "../../reducer/PatientsSlice";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2"; // Assuming Swal is used in your project
import {
  contactNumberYup,
  handleContactNumberChange,
} from "../../utils/phoneValidation";
import CameraFileUpload from "../../components/Common/CameraFileUpload";
import { fetchCoordinators } from "../../services/coordinatorApi";
import {
  isCoordinatorUser,
  getCurrentCoordinatorUser,
  isAdminUser,
} from "../../utils/authStorage";

export default function AddPatient() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectedImage, setSelectedImage] = useState(null);
  const [coordinators, setCoordinators] = useState([]);
  const isCoord = isCoordinatorUser();
  const currentCoord = getCurrentCoordinatorUser();
  const isAdmin = isAdminUser();

  React.useEffect(() => {
    fetchCoordinators()
      .then((data) => setCoordinators(data || []))
      .catch((err) => console.warn("Could not load coordinators:", err));
  }, []);

  const basicSchema = Yup.object().shape({
    disease_name: Yup.string().required("Patient name is required"),
    patient_name: Yup.string().required("Patient name is required"),
    age: Yup.number()
      .required("Age is required")
      .min(0, "Age cannot be less than 0")
      .max(120, "Age cannot exceed 120"), 
    gender: Yup.string().required("Gender is required"),
    email: Yup.string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .email("Invalid email address")
      .notRequired(),
    emergency_contact_no: contactNumberYup({
      required: true,
      label: "Emergency contact number",
    }),
    country: Yup.string().required("Country is required"),
    ismedicalHistory: Yup.boolean()
      .transform((value) => (value === 1 ? 1 : value === 0 ? 0 : value))
      .required("Medical history selection is required"),

    disease: Yup.string().when("ismedicalHistory", {
      is: (ismedicalHistory) => ismedicalHistory === true, // Only required when ismedicalHistory is true
      then: (schema) => schema.required("Disease name is required"),
      otherwise: (schema) => schema.nullable(),
    }),
    files: Yup.mixed().when("ismedicalHistory", {
      is: (ismedicalHistory) => ismedicalHistory === true,
      then: (schema) =>
        schema
          .required("Medical reports are required")
          .test(
            "fileType",
            "Please upload at least one file",
            (value) => value && value.length > 0
          ),
      otherwise: (schema) => schema.nullable(),
    }),
  });
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <div className="col-md-12">
              <h4 className="page-title">New Patients</h4>
            </div>
          </div>
          <div className="main_content">
            <div className="row">
              <div className="col-lg-12">
                <Formik
                    initialValues={{
                    patient_name: "",
                    age: "",
                    gender: "",
                    email: "",
                    emergency_contact_no: "",
                    country: "",
                    coordinatorId: isCoord ? (currentCoord.id || "") : "",
                    ismedicalHistory: false,
                    disease: "",
                    files: null,
                    disease_name: "",
                  }}
                  validationSchema={basicSchema}
                  onSubmit={async (values, { setSubmitting }) => {
                    try {
                      const formData = new FormData();
                      formData.append("patient_name", values.patient_name);
                      formData.append("age", values.age);
                      formData.append("gender", values.gender);
                      formData.append("email", values.email);
                      formData.append(
                        "emergency_contact_no",
                        values.emergency_contact_no
                      );
                      formData.append("country", values.country);
                      if (values.coordinatorId) {
                        formData.append("coordinatorId", values.coordinatorId);
                      }
                      formData.append(
                        "ismedicalHistory",
                        values.ismedicalHistory ? 1 : 0
                      );
                      formData.append("disease_name", values.disease_name);
                      // Append each file to files[] array
                      if (values.files) {
                        values.files.forEach((file) =>
                          formData.append("files[]", file)
                        );
                      }
                      const result = await dispatch(
                        AddAllPatients(formData)
                      ).unwrap();
                      Swal.fire("Patient added successfully!", "", "success");
                    } catch (err) {
                      Swal.fire(
                        "Error!",
                        err?.message || "An error occurred",
                        "error"
                      );
                    }
                    setSubmitting(false);
                  }}
                >
                  {({ values, setFieldValue, isSubmitting }) => (
                    <Form>
                      <div className="row">
                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Patient Name{" "}
                              <span className="text-danger">*</span>
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

                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Age <span className="text-danger">*</span>
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

                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Email
                            </label>
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
                          </div>
                        </div>

                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Country <span className="text-danger">*</span>
                            </label>
                            <Field
                              as="select"
                              className="form-control"
                              name="country"
                            >
                              <option value="">Select Country</option>
                              <option value="India">India</option>
                              <option value="USA">USA</option>
                              <option value="UK">United Kingdom</option>
                            </Field>
                            <ErrorMessage
                              name="country"
                              component="div"
                              className="text-danger"
                            />
                          </div>
                        </div>

                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Assign Coordinator <span className="text-muted">(Optional)</span>
                            </label>
                            <Field
                              as="select"
                              className="form-control"
                              name="coordinatorId"
                              disabled={isCoord}
                              title={
                                isCoord
                                  ? "Patients you create are automatically assigned to you"
                                  : undefined
                              }
                            >
                              <option value="">Select Coordinator (Optional)</option>
                              {coordinators.map((c) => {
                                const cId = c._id || c.id || c.userId;
                                const isMatch =
                                  values.country &&
                                  Array.isArray(c.accessCountries) &&
                                  c.accessCountries.some(
                                    (cnt) =>
                                      String(cnt).toLowerCase() ===
                                      values.country.toLowerCase()
                                  );
                                return (
                                  <option key={cId} value={cId}>
                                    {c.name}{" "}
                                    {Array.isArray(c.accessCountries) &&
                                    c.accessCountries.length > 0
                                      ? `(${c.accessCountries.join(", ")})`
                                      : ""}{" "}
                                    {isMatch ? "★ (Matches Country)" : ""}
                                  </option>
                                );
                              })}
                            </Field>
                          </div>
                        </div>

                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Disease name{" "}
                              <span className="text-danger">*</span>
                            </label>
                            <Field
                              className="form-control"
                              type="text"
                              name="disease_name"
                            />
                            <ErrorMessage
                              name="disease_name"
                              component="div"
                              className="text-danger"
                            />
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Emergency Contact{" "}
                              <span className="text-danger">*</span>
                            </label>
                            <Field
                              className="form-control"
                              type="text"
                              name="emergency_contact_no"
                              onChange={(e) =>
                                handleContactNumberChange(
                                  e,
                                  setFieldValue,
                                  "emergency_contact_no",
                                )
                              }
                            />
                            <ErrorMessage
                              name="emergency_contact_no"
                              component="div"
                              className="text-danger"
                            />
                          </div>
                        </div>

                        <div className="col-sm-6">
                          <div className="form-group">
                            <Field
                              type="checkbox"
                              name="ismedicalHistory"
                              id="ismedicalHistory"
                              className="form-check-input"
                            />

                            <label
                              htmlFor="ismedicalHistory"
                              className="form-check-label"
                            >
                              Do you have a medical history?
                            </label>
                          </div>
                        </div>

                        {values.ismedicalHistory && (
                          <>
                            <div className="col-sm-6">
                              <div className="form-group">
                                <label>
                                  Disease Name{" "}
                                  <span className="text-danger">*</span>
                                </label>
                                <Field
                                  className="form-control"
                                  type="text"
                                  name="disease"
                                />
                                <ErrorMessage
                                  name="disease"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>

                            <div className="col-sm-6">
                              <div className="form-group">
                                <CameraFileUpload
                                  label={
                                    <>
                                      Medical Reports{" "}
                                      <span className="text-danger">*</span>
                                    </>
                                  }
                                  files={values.files || []}
                                  setFiles={(files) =>
                                    setFieldValue(
                                      "files",
                                      files && files.length > 0 ? files : null
                                    )
                                  }
                                  multiple={true}
                                  accept=".pdf,image/*"
                                  helperText="Take photos of reports or upload PDF/images"
                                />

                                <ErrorMessage
                                  name="files"
                                  component="div"
                                  className="text-danger"
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="col-sm-6">
                          <div className="form-group">
                            <label>
                              Gender <span className="text-danger">*</span>
                            </label>
                            <div>
                              <label>
                                <Field
                                  type="radio"
                                  name="gender"
                                  value="Male"
                                />{" "}
                                Male
                              </label>
                              <label className="ml-3">
                                <Field
                                  type="radio"
                                  name="gender"
                                  value="Female"
                                />{" "}
                                Female
                              </label>
                            </div>
                            <ErrorMessage
                              name="gender"
                              component="div"
                              className="text-danger"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-center mt-4">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Submitting..." : "Create Patient"}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
