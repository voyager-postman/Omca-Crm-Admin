import React, { useEffect, useState, useMemo } from "react";
import { Formik, Field, ErrorMessage, Form } from "formik";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { Checkbox, ListItemText } from "@mui/material";
import axios from "axios";
import { image, baseurl } from "../../Basurl/Baseurl";
import { GetAllStaffUser } from "../../reducer/StaffSlice";
import { GetAllCountries2 } from "../../reducer/Countries";
import { FormControl, MenuItem, OutlinedInput, Select } from "@mui/material";
import {
  staffPhoneYup,
  handleContactNumberChange,
} from "../../utils/phoneValidation";
import ActionPermissionSelect from "../../components/Staff/ActionPermissionSelect";
import {
  actionsArrayToObject,
  staffRecordToActionsArray,
} from "../../utils/staffActions";
import { markRecordRead } from "../../services/unreadApi";

const parseArrayField = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return val ? [val] : [];
    }
  }
  return [];
};

export default function EditStaff() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { staff } = useSelector((state) => state.staff);
  const { Countries } = useSelector((state) => state.Countries);
  const [roles123, setRoles123] = useState([]);

  const passedStaffData = useMemo(() => {
    if (location.state?.staffData) return location.state.staffData;
    try {
      const saved = sessionStorage.getItem("edit_staff_data");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }, [location.state?.staffData]);

  const staffID =
    location.state?.staffID ||
    passedStaffData?._id ||
    passedStaffData?.id ||
    passedStaffData?.userId ||
    passedStaffData?.user_id ||
    sessionStorage.getItem("edit_staff_id");

  const [editStaff, setEditStaff] = useState(() => passedStaffData || null);
  const [isLoading, setIsLoading] = useState(!passedStaffData);
  const [fetchError, setFetchError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const statusOptions = [
    "None",
    "Foundation",
    "Private",
    "Insurance",
    "Insurance + Private",
    "Referral",
  ];

  useEffect(() => {
    getRolesuser();
  }, []);

  const getRolesuser = async () => {
    try {
      const response = await axios.get(`${baseurl}getAllRoles`);
      if (response.data.data) {
        setRoles123(response.data.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    dispatch(GetAllStaffUser());
    dispatch(GetAllCountries2());
  }, [dispatch]);

  useEffect(() => {
    if (staffID) {
      sessionStorage.setItem("edit_staff_id", String(staffID));
      markRecordRead("staff", staffID);
    }
    if (location.state?.staffData) {
      sessionStorage.setItem(
        "edit_staff_data",
        JSON.stringify(location.state.staffData),
      );
    }
  }, [staffID, location.state?.staffData]);

  useEffect(() => {
    if (passedStaffData && !editStaff) {
      setEditStaff(passedStaffData);
      setIsLoading(false);
      return;
    }

    if (editStaff) {
      setIsLoading(false);
      return;
    }

    if (staffID && Array.isArray(staff) && staff.length > 0) {
      const selected = staff.find(
        (item) =>
          String(item._id || item.id || item.userId || item.user_id) ===
          String(staffID),
      );
      if (selected) {
        setEditStaff(selected);
        setIsLoading(false);
        sessionStorage.setItem("edit_staff_data", JSON.stringify(selected));
        return;
      }
    }

    if (staffID) {
      let isMounted = true;
      setIsLoading(true);
      setFetchError(null);

      axios
        .get(`${baseurl}get_details/${staffID}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })
        .then((response) => {
          if (!isMounted) return;
          const data = response?.data;
          const details =
            data?.Details || data?.details || data?.data || data?.user;
          if (
            details &&
            (details._id || details.id || details.email || details.name)
          ) {
            setEditStaff(details);
            sessionStorage.setItem("edit_staff_data", JSON.stringify(details));
          } else {
            return axios
              .get(`${baseurl}get_all_user_staffs?page=1&limit=200`, {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              })
              .then((allRes) => {
                if (!isMounted) return;
                const allList =
                  allRes?.data?.Details || allRes?.data?.details || [];
                const found = allList.find(
                  (item) =>
                    String(
                      item._id || item.id || item.userId || item.user_id,
                    ) === String(staffID),
                );
                if (found) {
                  setEditStaff(found);
                  sessionStorage.setItem(
                    "edit_staff_data",
                    JSON.stringify(found),
                  );
                } else {
                  setFetchError("Staff member record not found.");
                }
              });
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error("Error fetching staff details:", err);
          axios
            .get(`${baseurl}get_all_user_staffs?page=1&limit=200`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            })
            .then((allRes) => {
              if (!isMounted) return;
              const allList =
                allRes?.data?.Details || allRes?.data?.details || [];
              const found = allList.find(
                (item) =>
                  String(
                    item._id || item.id || item.userId || item.user_id,
                  ) === String(staffID),
              );
              if (found) {
                setEditStaff(found);
                sessionStorage.setItem(
                  "edit_staff_data",
                  JSON.stringify(found),
                );
              } else {
                setFetchError(
                  err?.response?.data?.message ||
                    "Failed to load staff member details.",
                );
              }
            })
            .catch(() => {
              if (!isMounted) return;
              setFetchError(
                err?.response?.data?.message ||
                  "Failed to load staff member details.",
              );
            });
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setIsLoading(false);
      setFetchError("No staff member selected to edit.");
    }
  }, [staffID, staff, passedStaffData, editStaff]);

  if (isLoading || !editStaff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3">
            <div className="col-md-12">
              <div className="topmainhd">
                <h6>
                  <i
                    className="fa-solid fa-arrow-left-long me-2"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/Admin/staff")}
                  ></i>
                  Edit Staff
                </h6>
              </div>
            </div>
            <div className="col-md-12">
              <div className="main_content">
                {fetchError ? (
                  <div
                    className="text-center py-5 bg-white shadow-sm"
                    style={{
                      minHeight: "320px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <i
                      className="fa fa-exclamation-triangle text-warning mb-3"
                      style={{ fontSize: "2.5rem" }}
                    />
                    <h6 className="text-danger fw-semibold">
                      Failed to load staff details
                    </h6>
                    <p className="text-muted small mb-3">{fetchError}</p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm px-3"
                      onClick={() => navigate("/Admin/staff")}
                    >
                      <i className="fa fa-arrow-left me-1" /> Back to Staff List
                    </button>
                  </div>
                ) : (
                  <div
                    className="text-center py-5 d-flex flex-column align-items-center justify-content-center bg-white shadow-sm"
                    style={{
                      minHeight: "440px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      className="spinner-border text-primary mb-3"
                      role="status"
                      style={{
                        width: "3.2rem",
                        height: "3.2rem",
                        borderWidth: "0.25rem",
                      }}
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5
                      className="fw-semibold text-dark mb-1"
                      style={{ fontSize: "17px" }}
                    >
                      Loading Staff Details...
                    </h5>
                    <p
                      className="text-muted small mb-0"
                      style={{ maxWidth: "420px" }}
                    >
                      Please wait while staff profile information and
                      permissions are being retrieved.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const validationSchema = Yup.object().shape({
    name: Yup.string().required("Name is required"),
    role: Yup.string().required("Role is required"),
    phone_no: staffPhoneYup(true),
    gender: Yup.string()
      .oneOf(["Male", "Female", "Other"])
      .required("Gender is required"),
    profileImage: Yup.mixed().notRequired(),
    country: Yup.string().required("Country is required"),
    dial_code: Yup.string().required("Dial code is required"),
    password: Yup.string()
      .transform((value) => (value === "" ? undefined : value))
      .min(6, "Password must be at least 6 characters")
      .notRequired(),
    confirmPassword: Yup.string().when("password", {
      is: (password) => Boolean(password),
      then: (schema) =>
        schema
          .required("Confirm password is required")
          .oneOf([Yup.ref("password")], "Passwords must match"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      formData.append("phone_no", values.phone_no);
      formData.append("role", values.role);
      formData.append("gender", values.gender);
      formData.append("country", values.country);
      formData.append("dial_code", values.dial_code);
      formData.append(
        "roleStatuses",
        JSON.stringify(values.roleStatuses.filter(Boolean)),
      );
      formData.append(
        "accessCountries",
        JSON.stringify(values.accessCountries),
      );
      const actionObj = actionsArrayToObject(values.actions);
      formData.append("action", JSON.stringify(actionObj));
      formData.append("canEdit", String(actionObj.edit));
      formData.append("canDelete", String(actionObj.delete));
      formData.append("canExport", String(actionObj.export));
      if (values.profileImage instanceof File) {
        formData.append("profileImage", values.profileImage);
      }
      if (values.password) {
        formData.append("password", values.password);
        if (values.confirmPassword) {
          formData.append("confirmPassword", values.confirmPassword);
        }
      }
      const staffTargetId =
        editStaff._id ||
        editStaff.id ||
        editStaff.userId ||
        editStaff.user_id ||
        staffID;
      await axios.put(`${baseurl}update_details/${staffTargetId}`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });
      sessionStorage.removeItem("edit_staff_data");
      sessionStorage.removeItem("edit_staff_id");
      Swal.fire("Success!", "Staff updated successfully", "success");
      navigate("/Admin/staff");
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Something went wrong",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
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
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate("/Admin/staff")}
                ></i>
                Edit Staff
              </h6>
            </div>
          </div>
          <div className="col-md-12">
            <div className="main_content">
              <Formik
                enableReinitialize
                initialValues={{
                  email: editStaff.email || "",
                  role: editStaff.role || "",
                  gender: editStaff.gender || "",
                  phone_no: editStaff.phone_no || "",
                  name: editStaff.name || "",
                  country: editStaff.country || "",
                  dial_code: editStaff.dial_code || editStaff.phoneCode || "",
                  profileImage: editStaff.profileImage || null,
                  roleStatuses: parseArrayField(editStaff.roleStatuses),
                  accessCountries: parseArrayField(editStaff.accessCountries),
                  actions: staffRecordToActionsArray(editStaff),
                  password: "",
                  confirmPassword: "",
                }}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
              >
                {({ setFieldValue, values, isSubmitting }) => (
                  <Form>
                    <div className="row gx-3 gy-3">
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Name<span className="text-danger">*</span>
                          </label>
                          <Field className="form-control" name="name" />
                          <ErrorMessage
                            name="name"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Email<span className="text-danger">*</span>
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
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>New Password</label>
                          <Field
                            className="form-control"
                            type="password"
                            name="password"
                            placeholder="Leave blank to keep current password"
                            autoComplete="new-password"
                          />
                          <ErrorMessage
                            name="password"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>Confirm Password</label>
                          <Field
                            className="form-control"
                            type="password"
                            name="confirmPassword"
                            placeholder="Re-enter new password"
                            autoComplete="new-password"
                          />
                          <ErrorMessage
                            name="confirmPassword"
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
                            {({ field, form }) => (
                              <>
                                <FormControl fullWidth size="small">
                                  <Select
                                    value={field.value}
                                    onChange={(e) => {
                                      const selectedCountry = Countries.find(
                                        (item) => item.name === e.target.value,
                                      );
                                      form.setFieldValue(
                                        "country",
                                        selectedCountry.name,
                                      );
                                      form.setFieldValue(
                                        "dial_code",
                                        selectedCountry.dial_code,
                                      );
                                    }}
                                    input={
                                      <OutlinedInput placeholder="Select Country" />
                                    }
                                    displayEmpty
                                    sx={{ height: 40 }}
                                    MenuProps={{
                                      PaperProps: { style: { maxHeight: 200 } },
                                    }}
                                  >
                                    <MenuItem value="">
                                      <em>Select Country</em>
                                    </MenuItem>
                                    {Countries?.map((con) => (
                                      <MenuItem key={con._id} value={con.name}>
                                        {con.name}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <ErrorMessage
                                  name="country"
                                  component="div"
                                  className="text-danger"
                                />
                              </>
                            )}
                          </Field>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Phone No<span className="text-danger">*</span>
                          </label>
                          <div className="country-code">
                            <input
                              type="text"
                              className="form-control code-dial"
                              value={values.dial_code}
                              disabled
                            />
                            <input
                              type="text"
                              className="form-control code-in"
                              name="phone_no"
                              value={values.phone_no}
                              onChange={(e) =>
                                handleContactNumberChange(
                                  e,
                                  setFieldValue,
                                  "phone_no",
                                )
                              }
                              placeholder="Enter phone number"
                            />
                          </div>
                          <ErrorMessage
                            name="phone_no"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Access Countries<span className="text-danger">*</span>
                          </label>
                          <FormControl fullWidth size="small">
                            <Select
                              multiple
                              name="accessCountries"
                              value={values.accessCountries}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value.includes("All")) {
                                  if (
                                    values.accessCountries.length ===
                                    Countries.length
                                  ) {
                                    setFieldValue("accessCountries", []);
                                  } else {
                                    setFieldValue(
                                      "accessCountries",
                                      Countries.map((c) => c.name),
                                    );
                                  }
                                } else {
                                  setFieldValue("accessCountries", value);
                                }
                              }}
                              renderValue={(selected) => selected.join(", ")}
                              sx={{ height: 38 }}
                              MenuProps={{
                                PaperProps: { style: { maxHeight: 300 } },
                              }}
                            >
                              <MenuItem value="All">
                                <Checkbox
                                  checked={
                                    values.accessCountries.length ===
                                    Countries.length
                                  }
                                  indeterminate={
                                    values.accessCountries.length > 0 &&
                                    values.accessCountries.length <
                                    Countries.length
                                  }
                                />
                                <ListItemText primary="Select All" />
                              </MenuItem>
                              {Countries?.map((con) => (
                                <MenuItem key={con._id} value={con.name}>
                                  <Checkbox
                                    checked={values.accessCountries.includes(
                                      con.name,
                                    )}
                                  />
                                  <ListItemText primary={con.name} />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <ErrorMessage
                            name="accessCountries"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Role<span className="text-danger">*</span>
                          </label>
                          <Field
                            as="select"
                            name="role"
                            className="form-control"
                          >
                            <option value="">Select Role</option>
                            {roles123?.map((item, index) => {
                              return (
                                <option value={item.role}>{item.role}</option>
                              );
                            })}
                          </Field>
                          <ErrorMessage
                            name="role"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field gender-select">
                          <label>
                            Gender<span className="text-danger">*</span>
                          </label>
                          <br></br>
                          <div className="form-check-inline">
                            <Field type="radio" name="gender" value="Male" />{" "}
                            Male
                          </div>
                          <div className="form-check-inline">
                            <Field type="radio" name="gender" value="Female" />{" "}
                            Female
                          </div>
                          <div className="form-check-inline">
                            <Field type="radio" name="gender" value="Other" />{" "}
                            Others
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
                            Profile Image<span className="text-danger">*</span>
                          </label>
                          <div className="profile-upload">
                            <div className="upload-img">
                              {selectedImage ? (
                                <img
                                  src={URL.createObjectURL(selectedImage)}
                                  alt="preview"
                                />
                              ) : editStaff?.profileImage ? (
                                <img
                                  src={`${image}${editStaff.profileImage}`}
                                  alt="current"
                                />
                              ) : (
                                <img src="assets/img/user.jpg" alt="default" />
                              )}
                            </div>
                            <div className="upload-input">
                              <input
                                type="file"
                                className="form-control"
                                onChange={(e) => {
                                  setFieldValue(
                                    "profileImage",
                                    e.target.files[0],
                                  );
                                  setSelectedImage(e.target.files[0]);
                                }}
                              />
                            </div>
                          </div>
                          <ErrorMessage
                            name="profileImage"
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="set-field">
                          <label>
                            Give Permission<span className="text-danger">*</span>
                          </label>
                          <FormControl fullWidth>
                            <Select
                              multiple
                              value={values.roleStatuses}
                              name="roleStatuses"
                              onChange={(event) => {
                                let value = event.target.value;
                                value = value.filter((v) => v !== "");
                                if (value.includes("All")) {
                                  if (
                                    values.roleStatuses.length ===
                                    statusOptions.length
                                  ) {
                                    setFieldValue("roleStatuses", []);
                                  } else {
                                    setFieldValue(
                                      "roleStatuses",
                                      statusOptions,
                                    );
                                  }
                                } else {
                                  setFieldValue("roleStatuses", value);
                                }
                              }}
                              renderValue={(selected) => selected.join(", ")}
                              sx={{ height: 38 }}
                              MenuProps={{
                                PaperProps: {
                                  style: { maxHeight: 337 },
                                },
                                disableAutoFocusItem: true,
                              }}
                            >
                              <MenuItem
                                className="custmselect staffpermiss"
                                value="All"
                              >
                                <Checkbox
                                  checked={
                                    values.roleStatuses.length ===
                                    statusOptions.length
                                  }
                                  indeterminate={
                                    values.roleStatuses.length > 0 &&
                                    values.roleStatuses.length <
                                    statusOptions.length
                                  }
                                />
                                <ListItemText
                                  className="custmselect"
                                  primary="Select All"
                                />
                              </MenuItem>
                              {statusOptions.map((roleStatuses) => (
                                <MenuItem
                                  className="custmselect staffpermiss"
                                  key={roleStatuses}
                                  value={roleStatuses}
                                >
                                  <Checkbox
                                    checked={
                                      values.roleStatuses.indexOf(
                                        roleStatuses,
                                      ) > -1
                                    }
                                  />
                                  <ListItemText
                                    className="custmselect"
                                    primary={roleStatuses}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </div>
                      </div>
                      <ActionPermissionSelect
                        value={values.actions}
                        onChange={(next) => setFieldValue("actions", next)}
                      />
                      <div className="col-md-12">
                        <button type="submit" className="submit-btn" disabled={isSubmitting}>
                          {isSubmitting ? "Updating..." : "Submit"}
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
  );
}
