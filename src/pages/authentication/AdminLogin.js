import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { loginUser, logout } from "../../reducer/LoginSlice";
import { clearUser } from "../../reducer/userSlice";
import { setAuth, notifyAuthChanged, clearAuth, isSocialMediaRole } from "../../utils/authStorage";
import { Formik, Field, ErrorMessage, Form } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import logoDark from "../../img/logo-dark.png";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // Import styles
import { getBrowserGeoLocation, getPublicIP, cacheIPAddress } from "../../utils/geoLocation";
import { loginReferral } from "../../services/referralApi";
import { loginInsurance } from "../../services/insuranceApi";
import { fetchAndApplyUserDetails } from "../../services/userDetailsService";

const getLoginErrorMessage = (err) => {
  const data = err?.response?.data || err;
  if (Array.isArray(data?.details) && data.details.length) {
    return data.details.filter(Boolean).join("\n");
  }
  return data?.message || err?.message || "Login failed";
};

export function AdminLogin(props) {
  const dispatch = useDispatch();
  const { loading, error, user } = useSelector((state) => state.auth);
  const [hide, setHide] = useState(false);
  const toggle = () => {
    setHide((prev) => !prev);
  };

  const isReferralPath =
    typeof window !== "undefined" &&
    (window.location.pathname.includes("referral") ||
      props.initialTab === "referral");
  const isInsurancePath =
    typeof window !== "undefined" &&
    (window.location.pathname.includes("insurance") ||
      props.initialTab === "insurance");
  const [activeTab, setActiveTab] = useState(
    isInsurancePath ? "insurance" : isReferralPath ? "referral" : "staff"
  );

  // Referral partner login state
  const [referralIdentifier, setReferralIdentifier] = useState("");
  const [referralPassword, setReferralPassword] = useState("");
  const [referralLoading, setReferralLoading] = useState(false);
  const [hideReferral, setHideReferral] = useState(false);
  const toggleReferral = () => setHideReferral((prev) => !prev);

  // Insurance partner login state
  const [insuranceIdentifier, setInsuranceIdentifier] = useState("");
  const [insurancePassword, setInsurancePassword] = useState("");
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [hideInsurance, setHideInsurance] = useState(false);
  const toggleInsurance = () => setHideInsurance((prev) => !prev);
  const passwordRules =
    /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  const basicSchema = Yup.object().shape({
    email: Yup.string()
      .matches(passwordRules, "Please enter a valid email")
      .required("Required"),
    password: Yup.string()
      .required("Required")
      .oneOf([Yup.ref("password"), null])
      .max(20, "Passwords should not exceed 20 characters."),
  });
  const enquiryPermissions = [
    "/General_Enquiries",
    "/Medical_Visa",
    "/Guest_House_Stay",
    "/Forex_Service",
    "/Flight_Service",
    "/Pickup_and_Drop",
    "/Home_Care",
    "/Test_Form",
    "/Contact_Us",
  ];
  const getRedirectPath = (firstPermission) => {
    if (enquiryPermissions.includes(firstPermission)) {
      return "/Admin/General_Enquiries";
    }
    if (firstPermission === "/Dashboard") return "/Dashboard";
    if (
      firstPermission === "/Enquiries" ||
      firstPermission === "/Air_Medical_Escort" ||
      firstPermission === "/Ambulance_Service" ||
      firstPermission === "/Treatment_Estimate" ||
      firstPermission === "/SOS_Emergency" ||
      firstPermission === "/sos/list" ||
      firstPermission === "/Campaign_Contacts" ||
      firstPermission === "/Chatbot_Leads"
    ) {
      return "/Admin/inquiry";
    }
    if (firstPermission === "/Manage_Patients") return "/Admin/patients";
    if (firstPermission === "/Manage_Appointments") return "/Admin/appointments";
    if (firstPermission === "/Manage_Services") return "/Admin/Services";
    if (firstPermission === "/Manage_Staffs") return "/Admin/Staff";
    if (firstPermission === "/Manage_Permissions") return "/Admin/New-Permission";
    if (firstPermission === "/Reports") return "/Admin/Reports";
    if (firstPermission === "/Manage_Countries") return "/Admin/Countries";
    if (firstPermission === "/Payments") return "/Admin/Earnings";
    if (firstPermission === "/Payment_Data") return "/Admin/payment-data";
    if (
      firstPermission === "/Activity_Log" ||
      firstPermission === "/Activity_Logs"
    ) {
      return "/Admin/activity-logs";
    }
    if (firstPermission === "/Manage_Roles") return "/Admin/roles";
    if (firstPermission === "/Orders" || firstPermission === "/orders") return "/Admin/orders";
    return "/Admin/no-permission";
  };

  useEffect(() => {
    let cancelled = false;
    if (user) {
      const handleLoginSuccess = async () => {
        Swal.fire({
          title: "Login successful",
          text: `Welcome, ${user.details?.role || "Admin"}!`,
          icon: "success",
        });

        setAuth(user);
        localStorage.removeItem("referral_id");
        localStorage.removeItem("insurance_id");

        // Ask once for browser notifications used by SOS web alerts
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => { });
          }
        }

        // Fetch user details & sidebar permissions from get_details/:userId
        const userId = user.details?._id;
        const token = user.token;
        const { permissions: resolvedPermissions, details } =
          await fetchAndApplyUserDetails(userId, token, user.details?.role);

        if (cancelled) return;

        notifyAuthChanged();

        const userRole = (details?.role || user?.details?.role || "").toLowerCase();
        const isDriver =
          userRole.includes("driver") ||
          userRole.includes("pickup") ||
          userRole.includes("transport");
        const isSocialMedia = isSocialMediaRole(userRole);

        let redirectPath;
        if (isDriver) {
          redirectPath = "/Admin/General_Enquiries?tab=pickup";
        } else if (resolvedPermissions && resolvedPermissions.includes("/Dashboard")) {
          redirectPath = "/Dashboard";
        } else if (resolvedPermissions && resolvedPermissions.length > 0) {
          redirectPath = getRedirectPath(resolvedPermissions[0]);
        } else if (isSocialMedia) {
          redirectPath = "/Admin/inquiry";
        } else if (userRole === "admin") {
          redirectPath = "/Dashboard";
        } else {
          redirectPath = "/Admin/no-permission";
        }

        window.location.href = redirectPath;
      };

      handleLoginSuccess();
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleReferralLogin = async (e) => {
    e.preventDefault();
    if (!referralIdentifier.trim()) {
      toast.error("Please enter your email");
      return;
    }
    if (!referralPassword.trim()) {
      toast.error("Please enter your password");
      return;
    }

    setReferralLoading(true);
    try {
      const idVal = referralIdentifier.trim();
      const payload = {
        password: referralPassword.trim(),
      };
      if (idVal.includes("@")) {
        payload.email = idVal;
      } else if (/^(\+?\d[\d\s-]{6,15})$/.test(idVal)) {
        // Numeric phone input - normalize by stripping spaces/hyphens and leading +91 if 12 digits
        let cleanPhone = idVal.replace(/[\s-]/g, "");
        if (cleanPhone.startsWith("+91") && cleanPhone.length > 10) {
          cleanPhone = cleanPhone.slice(3);
        } else if (cleanPhone.startsWith("91") && cleanPhone.length === 12) {
          cleanPhone = cleanPhone.slice(2);
        }
        payload.phone = cleanPhone;
      } else {
        payload.referral_id = idVal;
      }

      const res = await loginReferral(payload);
      if (res && res.success && res.token) {
        dispatch(logout());
        dispatch(clearUser());
        clearAuth();

        const details = res.details || res.data || res.user || res.referral || {};
        const safeId = details.id ?? details._id ?? details.referral_id ?? details.referralId;
        const validId = safeId != null && String(safeId).trim() !== "" && String(safeId) !== "undefined" && String(safeId) !== "null"
          ? String(safeId)
          : "";
        const refId = (details.referral_id || details.referralId || validId || "").trim();
        const cleanRefId = refId && refId !== "undefined" && refId !== "null" ? refId : "";
        const userPayload = {
          token: res.token,
          loginTime: new Date().toISOString(),
          token_expire_time: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          permissions: [
            "/Dashboard",
            "/Enquiries",
            "/Admin/Inquiry",
            "/General_Enquiries",
            "/Admin/General_Enquiries",
            "/Manage_Patients",
            "/Admin/patients",
            "/Referral",
            "/referrals",
            "/Admin/referrals",
            "/Admin/add-Enquiry",
          ],
          details: {
            _id: validId || cleanRefId || "referral_user",
            id: validId || cleanRefId || "referral_user",
            referral_id: cleanRefId,
            name: details.name || "Referral Partner",
            email:
              details.email ||
              `${cleanRefId || details.phone || "partner"}@referral.omca`,
            role: "REFERRAL",
            phone: details.phone,
            phone_code: details.phone_code,
            status: details.status,
          },
        };

        setAuth(userPayload);
        if (validId) {
          localStorage.setItem("referral_mysql_id", validId);
        }
        if (cleanRefId) {
          localStorage.setItem("referral_id", cleanRefId);
        } else {
          localStorage.removeItem("referral_id");
        }
        localStorage.setItem("name", details.name || "Referral Partner");
        notifyAuthChanged();

        Swal.fire({
          title: "Referral Login Successful",
          text: `Welcome, ${details.name || "Referral Partner"}!`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        setTimeout(() => {
          window.location.href = "/Dashboard";
        }, 600);
      } else {
        toast.error(getLoginErrorMessage(res) || "Invalid credentials");
      }
    } catch (err) {
      console.error("Referral login error:", err);
      toast.error(getLoginErrorMessage(err) || "Invalid phone number, referral ID, or password");
    } finally {
      setReferralLoading(false);
    }
  };

  const handleInsuranceLogin = async (e) => {
    e.preventDefault();
    if (!insuranceIdentifier.trim()) {
      toast.error("Please enter your email or Insurance ID");
      return;
    }
    if (!insurancePassword.trim()) {
      toast.error("Please enter your password");
      return;
    }

    setInsuranceLoading(true);
    try {
      const idVal = insuranceIdentifier.trim();
      const payload = {
        password: insurancePassword.trim(),
      };
      if (idVal.includes("@")) {
        payload.email = idVal;
      } else if (/^(\+?\d[\d\s-]{6,15})$/.test(idVal)) {
        let cleanPhone = idVal.replace(/[\s-]/g, "");
        if (cleanPhone.startsWith("+91") && cleanPhone.length > 10) {
          cleanPhone = cleanPhone.slice(3);
        } else if (cleanPhone.startsWith("91") && cleanPhone.length === 12) {
          cleanPhone = cleanPhone.slice(2);
        }
        payload.phone = cleanPhone;
      } else {
        payload.insurance_id = idVal;
      }

      const res = await loginInsurance(payload);
      if (res && res.success && res.token) {
        dispatch(logout());
        dispatch(clearUser());
        clearAuth();

        const details = res.details || res.data || res.user || res.insurance || {};
        const safeId = details.id ?? details._id ?? details.insurance_id ?? details.insuranceId;
        const validId = safeId != null && String(safeId).trim() !== "" && String(safeId) !== "undefined" && String(safeId) !== "null"
          ? String(safeId)
          : "";
        const insId = (details.insurance_id || details.insuranceId || validId || "").trim();
        const cleanInsId = insId && insId !== "undefined" && insId !== "null" ? insId : "";
        const userPayload = {
          token: res.token,
          loginTime: new Date().toISOString(),
          token_expire_time: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          permissions: [
            "/Dashboard",
            "/Enquiries",
            "/Admin/Inquiry",
            "/General_Enquiries",
            "/Admin/General_Enquiries",
            "/Manage_Patients",
            "/Admin/patients",
            "/Insurance",
            "/insurances",
            "/Admin/insurances",
            "/Admin/add-Enquiry",
          ],
          details: {
            _id: validId || cleanInsId || "insurance_user",
            id: validId || cleanInsId || "insurance_user",
            insurance_id: cleanInsId,
            name: details.name || "Insurance Partner",
            email:
              details.email ||
              `${cleanInsId || details.phone || "partner"}@insurance.omca`,
            role: "INSURANCE",
            phone: details.phone,
            phone_code: details.phone_code,
            status: details.status,
          },
        };

        setAuth(userPayload);
        if (validId) {
          localStorage.setItem("insurance_mysql_id", validId);
        }
        if (cleanInsId) {
          localStorage.setItem("insurance_id", cleanInsId);
        } else {
          localStorage.removeItem("insurance_id");
        }
        localStorage.setItem("name", details.name || "Insurance Partner");
        notifyAuthChanged();

        Swal.fire({
          title: "Insurance Login Successful",
          text: `Welcome, ${details.name || "Insurance Partner"}!`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        setTimeout(() => {
          window.location.href = "/Dashboard";
        }, 600);
      } else {
        toast.error(getLoginErrorMessage(res) || "Invalid credentials");
      }
    } catch (err) {
      console.error("Insurance login error:", err);
      toast.error(getLoginErrorMessage(err) || "Invalid email, insurance ID, or password");
    } finally {
      setInsuranceLoading(false);
    }
  };

  return (
    <div
      className="main-wrapper account-wrapper"
      style={{ minHeight: "100vh" }}
    >
      <div className="account-page">
        <div className="account-center">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-10">
                <div className="account-box">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="account-logo">
                        <a>
                          <img src={logoDark} alt="" />
                        </a>
                      </div>
                    </div>
                    <div className="col-md-6">
                      {/* Tab Switcher */}
                      <div
                        className="d-flex mb-3 border rounded overflow-hidden"
                        style={{ background: "#f8f9fa" }}
                      >
                        <button
                          type="button"
                          className={`btn flex-fill py-2 fw-bold ${activeTab === "staff"
                              ? "btn-primary text-white"
                              : "btn-light text-muted"
                            }`}
                          style={{ borderRadius: 0, fontSize: 13 }}
                          onClick={() => setActiveTab("staff")}
                        >
                          <i className="fa fa-sign-in me-1" /> Login
                        </button>
                        <button
                          type="button"
                          className={`btn flex-fill py-2 fw-bold ${activeTab === "referral"
                              ? "btn-primary text-white"
                              : "btn-light text-muted"
                            }`}
                          style={{ borderRadius: 0, fontSize: 13 }}
                          onClick={() => setActiveTab("referral")}
                        >
                          <i className="fa fa-handshake-o me-1" /> Referral
                        </button>
                        <button
                          type="button"
                          className={`btn flex-fill py-2 fw-bold ${activeTab === "insurance"
                              ? "btn-primary text-white"
                              : "btn-light text-muted"
                            }`}
                          style={{ borderRadius: 0, fontSize: 13 }}
                          onClick={() => setActiveTab("insurance")}
                        >
                          <i className="fa-solid fa-shield-alt fa-shield me-1" /> Insurance
                        </button>
                      </div>

                      {activeTab === "staff" ? (
                        <Formik
                          initialValues={{ email: "", password: "" }}
                          validationSchema={basicSchema}
                          onSubmit={async (values, { setSubmitting }) => {
                            dispatch(logout());
                            dispatch(clearUser());
                            clearAuth();
                            try {
                              // Get browser location (prompts user for permission)
                              const [location, ipAddress] = await Promise.all([
                                getBrowserGeoLocation(),
                                getPublicIP(),
                              ]);
                              // Cache IP so it's sent on every subsequent API request
                              if (ipAddress) cacheIPAddress(ipAddress);
                              await dispatch(
                                loginUser({
                                  ...values,
                                  ...(location
                                    ? {
                                      latitude: location.latitude,
                                      longitude: location.longitude,
                                    }
                                    : {}),
                                  ...(ipAddress ? { ip_address: ipAddress } : {}),
                                }),
                              ).unwrap();
                            } catch (err) {
                              toast.error(getLoginErrorMessage(err));
                            }
                            setSubmitting(false);
                          }}
                        >
                          {({ isSubmitting }) => (
                            <Form className="form-signin">
                              <h3>Login</h3>
                              <div className="form-group">
                                <label>Username or Email</label>
                                <div className="custom-form-control">
                                  <Field
                                    className="input input-alt"
                                    placeholder="Enter your email"
                                    type="text"
                                    name="email"
                                  />
                                  <span className="input-border input-border-alt"></span>
                                  <ErrorMessage
                                    name="email"
                                    component="div"
                                    style={{ color: "red" }}
                                  />
                                </div>
                              </div>
                              <div
                                className="form-group"
                                style={{ position: "relative" }}
                              >
                                <label>Password</label>
                                <div className="custom-form-control">
                                  <Field
                                    type={!hide ? "password" : "text"}
                                    {...props}
                                    className="input input-alt"
                                    placeholder="Enter your password"
                                    name="password"
                                  />
                                  <span className="input-border input-border-alt"></span>
                                  <ErrorMessage
                                    name="password"
                                    component="div"
                                    style={{ color: "red" }}
                                  />
                                </div>
                                <span
                                  className="icon"
                                  onClick={toggle}
                                  style={{
                                    position: "absolute",
                                    top: "70%",
                                    right: "12px",
                                    transform: "translateY(-50%)",
                                    cursor: "pointer",
                                    color: "#555",
                                  }}
                                >
                                  {hide ? (
                                    <VisibilityIcon />
                                  ) : (
                                    <VisibilityOffIcon />
                                  )}
                                </span>
                              </div>
                              <div className="form-group text-right">
                                <NavLink to="Forgot">
                                  Forgot your password?
                                </NavLink>
                              </div>
                              <div className="form-group text-center">
                                <button
                                  type="submit"
                                  className="btn btn-primary account-btn"
                                  disabled={isSubmitting || loading}
                                >
                                  {loading ? "Logging in..." : "Login"}
                                </button>
                              </div>
                            </Form>
                          )}
                        </Formik>
                      ) : activeTab === "referral" ? (
                        <form className="form-signin" onSubmit={handleReferralLogin}>
                          <h3>Referral Partner Login</h3>
                          <div className="form-group">
                            <label>Email or Referral ID</label>
                            <div className="custom-form-control">
                              <input
                                className="input input-alt"
                                placeholder="Enter your email or referral ID"
                                type="text"
                                required
                                value={referralIdentifier}
                                onChange={(e) => setReferralIdentifier(e.target.value)}
                              />
                              <span className="input-border input-border-alt"></span>
                            </div>
                          </div>
                          <div
                            className="form-group"
                            style={{ position: "relative" }}
                          >
                            <label>Password</label>
                            <div className="custom-form-control">
                              <input
                                type={!hideReferral ? "password" : "text"}
                                className="input input-alt"
                                placeholder="Enter your password"
                                required
                                value={referralPassword}
                                onChange={(e) => setReferralPassword(e.target.value)}
                              />
                              <span className="input-border input-border-alt"></span>
                            </div>
                            <span
                              className="icon"
                              onClick={toggleReferral}
                              style={{
                                position: "absolute",
                                top: "70%",
                                right: "12px",
                                transform: "translateY(-50%)",
                                cursor: "pointer",
                                color: "#555",
                              }}
                            >
                              {hideReferral ? (
                                <VisibilityIcon />
                              ) : (
                                <VisibilityOffIcon />
                              )}
                            </span>
                          </div>
                          <div className="form-group text-center mt-4">
                            <button
                              type="submit"
                              className="btn btn-primary account-btn"
                              disabled={referralLoading}
                            >
                              {referralLoading
                                ? "Logging in..."
                                : "Login"}
                            </button>
                          </div>
                          <div className="text-center mt-2">
                            <small className="text-muted">
                              Need an account? Contact the OMCA team to register as a partner.
                            </small>
                          </div>
                        </form>
                      ) : (
                        <form className="form-signin" onSubmit={handleInsuranceLogin}>
                          <h3>Insurance Partner Login</h3>
                          <div className="form-group">
                            <label>Email or Insurance ID</label>
                            <div className="custom-form-control">
                              <input
                                className="input input-alt"
                                placeholder="Enter your email or insurance ID"
                                type="text"
                                required
                                value={insuranceIdentifier}
                                onChange={(e) => setInsuranceIdentifier(e.target.value)}
                              />
                              <span className="input-border input-border-alt"></span>
                            </div>
                          </div>
                          <div
                            className="form-group"
                            style={{ position: "relative" }}
                          >
                            <label>Password</label>
                            <div className="custom-form-control">
                              <input
                                type={!hideInsurance ? "password" : "text"}
                                className="input input-alt"
                                placeholder="Enter your password"
                                required
                                value={insurancePassword}
                                onChange={(e) => setInsurancePassword(e.target.value)}
                              />
                              <span className="input-border input-border-alt"></span>
                            </div>
                            <span
                              className="icon"
                              onClick={toggleInsurance}
                              style={{
                                position: "absolute",
                                top: "70%",
                                right: "12px",
                                transform: "translateY(-50%)",
                                cursor: "pointer",
                                color: "#555",
                              }}
                            >
                              {hideInsurance ? (
                                <VisibilityIcon />
                              ) : (
                                <VisibilityOffIcon />
                              )}
                            </span>
                          </div>
                          <div className="form-group text-center mt-4">
                            <button
                              type="submit"
                              className="btn btn-primary account-btn"
                              style={{ backgroundColor: "#0891b2", borderColor: "#0891b2" }}
                              disabled={insuranceLoading}
                            >
                              {insuranceLoading
                                ? "Logging in..."
                                : "Login"}
                            </button>
                          </div>
                          <div className="text-center mt-2">
                            <small className="text-muted">
                              Need an account? Contact the OMCA team to register as an insurance partner.
                            </small>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
