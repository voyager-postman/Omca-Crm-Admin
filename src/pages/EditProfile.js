import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import { image } from '../Basurl/Baseurl'
import user from '../img/user.jpg'
import { GetUserData } from '../reducer/userSlice'
import { Formik, Field, ErrorMessage, Form } from "formik";
import * as Yup from "yup";
import { EdituserData } from '../reducer/userSlice'
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { hospitalContactYup, handleContactNumberChange } from "../utils/phoneValidation";
import { isReferralUser, isInsuranceUser } from "../utils/authStorage";
export default function EditProfile() {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(null);
  const dispatch = useDispatch()
  const { getuser, loading, error } = useSelector((state) => state.getuser)
  console.log(getuser)
  useEffect(() => {
    dispatch(GetUserData());
  }, [dispatch]);
  useEffect(() => {
    console.log(error, getuser);
  }, [error, getuser]);

  const nameParts = (getuser?.name || "").trim().split(/\s+/);
  const initialFirstName =
    getuser?.first_name ||
    getuser?.firstName ||
    (nameParts.length > 0 && nameParts[0] ? nameParts[0] : "");
  const initialLastName =
    getuser?.last_name ||
    getuser?.lastName ||
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

  const isRef =
    isReferralUser() ||
    getuser?.role?.toUpperCase() === "REFERRAL" ||
    getuser?.role?.toUpperCase() === "REFERRER" ||
    Boolean(getuser?.referral_id) ||
    Boolean(getuser?.isReferral);

  const isIns =
    isInsuranceUser() ||
    getuser?.role?.toUpperCase() === "INSURANCE" ||
    Boolean(getuser?.insurance_id) ||
    Boolean(getuser?.isInsurance);

  const basicSchema = Yup.object().shape({
    firstName: Yup.string()
      .trim()
      .required('First name is required')
      .min(2, 'First name must be at least 2 characters')
      .max(25, 'First name cannot exceed 25 characters'),
    lastName: Yup.string()
      .trim()
      .nullable()
      .notRequired()
      .max(25, 'Last name cannot exceed 25 characters'),
    name: Yup.string()
      .trim()
      .nullable()
      .notRequired()
      .max(50, 'Name cannot exceed 50 characters'),
    email: Yup.string()
      .email('Invalid email format')
      .required('Email is required'),
    phone_no: hospitalContactYup(true),
    gender: isRef
      ? Yup.string().nullable().notRequired()
      : Yup.string()
          .oneOf(['Male', 'Female', 'Others'], 'Invalid gender selection')
          .required('Gender is required'),
    profileImage: Yup.mixed().nullable().notRequired(),
    password: Yup.string()
      .transform((value) => (!value || String(value).trim() === '' ? undefined : value))
      .min(6, 'Password must be at least 6 characters')
      .nullable()
      .notRequired(),
    confirmPassword: Yup.string()
      .transform((value) => (!value || String(value).trim() === '' ? undefined : value))
      .nullable()
      .notRequired()
      .when('password', {
        is: (val) => Boolean(val && String(val).trim().length > 0),
        then: (schema) =>
          schema
            .required('Please confirm your new password')
            .oneOf([Yup.ref('password')], 'Passwords do not match'),
        otherwise: (schema) =>
          schema.test(
            'no-confirm-without-password',
            'Please enter a new password first',
            (val) => !val
          ),
      }),
  });
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3">
            <div className="col-md-12">
              <div className="topmainhd">
                <h6>
                  <i
                    className="fa-solid fa-arrow-left-long me-2"
                    onClick={() => window.history.back()}
                  ></i>
                  Edit Profile
                </h6>
              </div>
            </div>
            <div className="col-md-12">
              <div className="main_content">
                <Formik
                  enableReinitialize
                  initialValues={{
                    firstName: initialFirstName,
                    lastName: initialLastName,
                    name: getuser?.name || "",
                    email: getuser?.email || "",
                    phone_no: getuser?.phone_no || getuser?.phone || "",
                    gender: getuser?.gender || "",
                    profileImage: getuser?.profileImage || null,
                    password: "",
                    confirmPassword: "",
                  }}
                  validationSchema={basicSchema}
                  onSubmit={async (values, { setSubmitting }) => {
                    try {
                      const fullName = `${(values.firstName || "").trim()} ${(values.lastName || "").trim()}`.trim();
                      const payload = {
                        id: getuser?._id || getuser?.id,
                        referral_id: getuser?.referral_id,
                        insurance_id: getuser?.insurance_id,
                        isReferral: isRef,
                        isInsurance: isIns,
                        role: getuser?.role || (isRef ? "REFERRAL" : isIns ? "INSURANCE" : undefined),
                        name: fullName,
                        first_name: (values.firstName || "").trim(),
                        last_name: (values.lastName || "").trim(),
                        firstName: (values.firstName || "").trim(),
                        lastName: (values.lastName || "").trim(),
                        email: (values.email || "").trim(),
                        phone_no: values.phone_no,
                        phone: values.phone_no,
                        phone_code: getuser?.phone_code || "+91",
                        gender: values.gender,
                      };
                      if (values.profileImage instanceof File) {
                        payload.profileImage = values.profileImage;
                      }
                      if (values.password && values.password.trim()) {
                        payload.password = values.password.trim();
                        if (values.confirmPassword && values.confirmPassword.trim()) {
                          payload.confirmPassword = values.confirmPassword.trim();
                        }
                      }

                      await dispatch(
                        EdituserData(payload)
                      ).unwrap();

                      localStorage.setItem("name", fullName);
                      await dispatch(GetUserData());

                      Swal.fire("Success!", "Profile updated successfully.", "success");
                      navigate('/Admin/profile')
                    } catch (err) {
                      Swal.fire("Error!", err?.message || err?.msg || "An error occurred", "error");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {({ isSubmitting, setFieldValue, values, errors, touched, setTouched, validateForm }) => (
                    <Form>
                      <div className="row">
                        <div className='col-md-12'>
                          <div
                            className="profile-img-wrap"
                            style={{
                              width: "110px",
                              height: "110px",
                              position: "relative",
                              margin: "0 0 20px 0",
                            }}
                          >
                            <div
                              style={{
                                width: "110px",
                                height: "110px",
                                borderRadius: "50%",
                                overflow: "hidden",
                                border: "3px solid #e2e8f0",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                backgroundColor: "#f8f9fa",
                              }}
                            >
                              <img
                                className="avatar"
                                src={
                                  selectedImage
                                    ? URL.createObjectURL(selectedImage)
                                    : getuser?.profileImage
                                    ? `${image}${getuser.profileImage}`
                                    : user
                                }
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = user;
                                }}
                                alt="Profile"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: "50%",
                                  aspectRatio: "1 / 1",
                                  display: "block",
                                }}
                              />
                            </div>

                            <div className="fileupload btn">
                              <span className="btn-text"><i className="fa fa-camera" aria-hidden="true"></i></span>
                              <input
                                type="file"
                                className="upload"
                                accept="image/*"
                                onChange={(event) => {
                                  if (event.target.files && event.target.files[0]) {
                                    setFieldValue("profileImage", event.target.files[0]);
                                    setSelectedImage(event.target.files[0]);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="field-set">
                            <label className="focus-label">First Name<span className="text-danger">*</span></label>
                            <Field
                              type="text"
                              className="form-control floating"
                              name="firstName"
                              maxLength={25}
                              placeholder="Enter first name"
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldValue("firstName", val);
                                const lName = values.lastName || "";
                                setFieldValue("name", `${val.trim()} ${lName.trim()}`.trim());
                              }}
                            />
                          </div>
                          <ErrorMessage name="firstName" component="div" style={{ color: "red" }} />
                        </div>
                        <div className="col-md-6">
                          <div className="field-set">
                            <label className="focus-label">Last Name</label>
                            <Field
                              type="text"
                              className="form-control floating"
                              name="lastName"
                              maxLength={25}
                              placeholder="Enter last name"
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldValue("lastName", val);
                                const fName = values.firstName || "";
                                setFieldValue("name", `${fName.trim()} ${val.trim()}`.trim());
                              }}
                            />
                          </div>
                          <ErrorMessage name="lastName" component="div" style={{ color: "red" }} />
                        </div>
                        <div className="col-md-6">
                          <div className="field-set">
                            <label className="focus-label">Email<span className="text-danger">*</span></label>
                            <Field type="email" className="form-control floating" name="email" />
                            <ErrorMessage name="email" component="div" style={{ color: "red" }} />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="field-set">
                            <label className="focus-label">Phone No<span className="text-danger">*</span></label>
                            <Field
                              type="text"
                              className="form-control floating"
                              name="phone_no"
                              onChange={(e) =>
                                handleContactNumberChange(
                                  e,
                                  setFieldValue,
                                  "phone_no",
                                )
                              }
                            />
                            <ErrorMessage name="phone_no" component="div" style={{ color: "red" }} />
                          </div>
                        </div>
                        {!isRef && !isIns && (
                          <div className="col-md-6">
                            <div className="field-set">
                              <label className="focus-label">Gender<span className="text-danger">*</span></label>
                              <Field as="select" className="form-control floating" name="gender">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Others">Others</option>
                              </Field>
                              <ErrorMessage name="gender" component="div" style={{ color: "red" }} />
                            </div>
                          </div>
                        )}
                        {isRef && getuser?.referral_id && (
                          <div className="col-md-6">
                            <div className="field-set">
                              <label className="focus-label">Referral ID</label>
                              <input
                                type="text"
                                className="form-control floating"
                                value={getuser.referral_id}
                                disabled
                                readOnly
                                style={{ backgroundColor: "#f8fafc", cursor: "not-allowed" }}
                              />
                            </div>
                          </div>
                        )}
                        {isIns && getuser?.insurance_id && (
                          <div className="col-md-6">
                            <div className="field-set">
                              <label className="focus-label">Insurance ID</label>
                              <input
                                type="text"
                                className="form-control floating"
                                value={getuser.insurance_id}
                                disabled
                                readOnly
                                style={{ backgroundColor: "#f8fafc", cursor: "not-allowed" }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="col-md-6">
                          <div className="field-set">
                            <label className="focus-label">New Password</label>
                            <Field
                              type="password"
                              className="form-control floating"
                              name="password"
                              placeholder="Leave blank to keep current password"
                              autoComplete="new-password"
                            />
                            <ErrorMessage name="password" component="div" style={{ color: "red" }} />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="field-set">
                            <label className="focus-label">Confirm Password</label>
                            <Field
                              type="password"
                              className="form-control floating"
                              name="confirmPassword"
                              placeholder="Re-enter new password"
                              autoComplete="new-password"
                            />
                            <ErrorMessage name="confirmPassword" component="div" style={{ color: "red" }} />
                          </div>
                        </div>
                        <div className="">
                          <button
                            className="submit-btn"
                            type="submit"
                            disabled={isSubmitting}
                            onClick={async () => {
                              const currentErrors = await validateForm();
                              if (currentErrors && Object.keys(currentErrors).length > 0) {
                                const errorKeys = Object.keys(currentErrors);
                                const touchMap = {};
                                errorKeys.forEach((key) => {
                                  touchMap[key] = true;
                                });
                                setTouched(touchMap);
                                const firstKey = errorKeys[0];
                                const firstError = currentErrors[firstKey];
                                Swal.fire({
                                  icon: "warning",
                                  title: "Validation Error",
                                  text: typeof firstError === "string" ? firstError : "Please check the form for errors.",
                                });
                              }
                            }}
                          >
                            {isSubmitting ? "Submitting..." : "Submit"}
                          </button>
                        </div>
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
  )
}