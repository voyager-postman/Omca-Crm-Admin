
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { Formik, Field, ErrorMessage, Form } from "formik";
import * as Yup from "yup";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { baseurl } from "../../Basurl/Baseurl";
import { GetAllTreatment } from "../../reducer/TreatmentSlice";
import {
  calculateDiscountPercentage,
  calculateFinalAmount,
} from "../../utils/discountHelpers";
import { isReferralUser } from "../../utils/authStorage";
import {
  saveTreatmentCommissionData,
  getTreatmentCommissionData,
} from "../../utils/treatmentCommissionHelpers";
export default function EditPatientTreatment() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [initialData, setInitialData] = useState(null);
  const [Service, setService] = useState([]);
  const { Treatment } = useSelector(
    (state) => state.Treatment
  );
  // ================= VALIDATION =================
  const basicSchema = Yup.object().shape({
    patientId: Yup.string().required(
      "Patient ID is required"
    ),
    treatment_course_id: Yup.string().required(
      "Treatment course is required"
    ),
    services: Yup.array().min(
      1,
      "Select at least one service"
    ),
    total_charge: Yup.number()
      .transform((value, originalValue) =>
        originalValue === ""
          ? undefined
          : Number(originalValue)
      )
      .typeError(
        "Total Charge must be a number"
      )
      .required("Total Charge is required"),
    discount_percentage: Yup.number()
      .transform((value, originalValue) =>
        originalValue === "" ? undefined : value
      )
      .min(0, "Discount cannot be less than 0")
      .max(100, "Discount cannot be greater than 100")
      .nullable(),
    final_amount: Yup.number()
      .transform((value, originalValue) =>
        originalValue === "" ? undefined : value
      )
      .min(0, "Final amount cannot be less than 0")
      .max(
        Yup.ref("total_charge"),
        "Final amount cannot be greater than total charge"
      )
      .nullable(),
    commission_percentage: Yup.number()
      .transform((value, originalValue) =>
        originalValue === "" ? undefined : value
      )
      .min(0, "Commission cannot be less than 0")
      .max(100, "Commission cannot be greater than 100")
      .nullable(),
    insurance_percentage: Yup.number()
      .transform((value, originalValue) =>
        originalValue === "" ? undefined : value
      )
      .min(0, "Insurance percentage cannot be less than 0")
      .max(100, "Insurance percentage cannot be greater than 100")
      .nullable(),
  });
  // ================= FETCH TREATMENTS =================
  useEffect(() => {
    dispatch(GetAllTreatment());
  }, [dispatch]);
  // ================= FETCH SERVICES =================
  const GetActiveService = async () => {
    try {
      const response = await axios.get(
        `${baseurl}get_activeServices`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              "token"
            )}`,
            "Content-Type":
              "application/json",
          },
        }
      );
      if (response.status === 200) {
        setService(response.data.services);
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    if (isReferralUser()) {
      Swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "Referrals cannot add or edit treatments.",
      });
      navigate("/Admin/patients");
      return;
    }
    GetActiveService();
  }, [navigate]);
  // ================= FETCH SINGLE TREATMENT =================
  const getData = async () => {
    try {
      const response = await axios.get(
        `${baseurl}get_treatment_by_id/${location?.state?.data?.treatment_id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              "token"
            )}`,
          },
        }
      );
      if (response.data.success) {
        const data = response.data.data;
        const currentTreatmentId = location?.state?.data?.treatment_id || data.treatment_course_id;
        const storedRates = getTreatmentCommissionData({
          treatmentId: currentTreatmentId,
          patientId: data.patientId,
          treatmentObj: data,
        });

        setInitialData({
          patientId: data.patientId || "",
          hospital_ID: data.hospital_ID || "",
          treatment_course_id:
            data.treatment_course_id || "",
          treatment_course_name:
            data.treatment_course_name || "",
          total_charge:
            data.total_charge === 0 || data.total_charge
              ? data.total_charge
              : data.treatment_course_fee === 0 ||
                  data.treatment_course_fee
                ? data.treatment_course_fee
                : "",
          discount_percentage:
            data.discount_percentage === 0 || data.discount_percentage
              ? data.discount_percentage
              : "",
          final_amount:
            data.final_amount === 0 || data.final_amount
              ? data.final_amount
              : "",
          commission_percentage:
            data.commission_percentage !== undefined && data.commission_percentage !== null && data.commission_percentage !== ""
              ? data.commission_percentage
              : (storedRates.commission_percentage !== undefined && storedRates.commission_percentage !== null && storedRates.commission_percentage !== ""
                ? storedRates.commission_percentage
                : 10),
          insurance_percentage:
            data.insurance_percentage !== undefined && data.insurance_percentage !== null && data.insurance_percentage !== ""
              ? data.insurance_percentage
              : (storedRates.insurance_percentage || ""),
          services:
            data.services?.map(
              (item) => item.serviceId
            ) || [],
          amount_paid:
            data.payment_details?.[0]?.paid_amount === 0 ||
            data.payment_details?.[0]?.paid_amount
              ? data.payment_details[0].paid_amount
              : "",
          paymentMethod:
            data.payment_details?.[0]
              ?.paymentMethod || "",
          Currency: "USD",
        });
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    if (location?.state?.data) {
      sessionStorage.setItem("edit_patient_treatment_data", JSON.stringify(location.state.data));
      getData();
    } else {
      const saved = sessionStorage.getItem("edit_patient_treatment_data");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          getData(parsed);
        } catch (e) {
          console.warn("Could not parse saved treatment data", e);
        }
      }
    }
  }, [location?.state?.data]);

  // ================= BACK =================
  const handleback = () => {
    navigate(-1);
  };

  if (isReferralUser()) return null;

  // ================= LOADING =================
  if (!initialData) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="card p-5 text-center mt-3 shadow-sm border-0">
            <div className="py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h5 className="mt-3 text-secondary">Loading treatment details...</h5>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row">
          <div className="col-md-12">
            <h4 className="page-title">
              <span
                style={{ cursor: "pointer" }}
                onClick={handleback}
              >
                <i className="fi fi-sr-angle-double-small-left"></i>
              </span>
              Edit Treatment
            </h4>
          </div>
        </div>
        <div className="main_content">
          <Formik
            initialValues={initialData}
            validationSchema={basicSchema}
            enableReinitialize
            onSubmit={async (
              values,
              { setSubmitting }
            ) => {
              try {
                const payload = {
                  treatment_id:
                    location?.state?.data
                      ?.treatment_id,
                  patientId:
                    values.patientId,
                  hospital_ID: values.hospital_ID || "",
                  treatment_course_id:
                    values.treatment_course_id,
                  treatment_course_name:
                    values.treatment_course_name,
                  total_charge:
                    Number(values.total_charge),
                  ...(values.discount_percentage !== ""
                    ? {
                        discount_percentage: Number(
                          values.discount_percentage
                        ),
                      }
                    : {}),
                  ...(values.final_amount !== ""
                    ? { final_amount: Number(values.final_amount) }
                    : {}),
                  commission_percentage:
                    values.commission_percentage !== "" &&
                    values.commission_percentage !== null &&
                    values.commission_percentage !== undefined
                      ? Number(values.commission_percentage)
                      : 10,
                  referral_commission_percentage:
                    values.commission_percentage !== "" &&
                    values.commission_percentage !== null &&
                    values.commission_percentage !== undefined
                      ? Number(values.commission_percentage)
                      : 10,
                  ...(values.insurance_percentage !== ""
                    ? {
                        insurance_percentage: Number(values.insurance_percentage),
                      }
                    : {}),
                  services: values.services,
                  // amount_paid:
                  //   Number(values.amount_paid),
                  paymentMethod:
                    values.paymentMethod,
                  Currency:
                    values.Currency,
                };
                const response =
                  await axios.put(
                    `${baseurl}edit_treatment/${location?.state?.data?.treatment_id}`,
                    payload,
                    {
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem(
                          "token"
                        )}`,
                        "Content-Type":
                          "application/json",
                      },
                    }
                  );
                if (response.data.success) {
                  saveTreatmentCommissionData({
                    treatmentId: location?.state?.data?.treatment_id,
                    patientId: values.patientId,
                    commissionPercentage:
                      values.commission_percentage !== "" &&
                      values.commission_percentage !== null &&
                      values.commission_percentage !== undefined
                        ? Number(values.commission_percentage)
                        : 10,
                    insurancePercentage: values.insurance_percentage,
                    totalCharge: values.total_charge,
                    finalAmount: values.final_amount || values.total_charge,
                    treatmentName: values.treatment_course_name,
                  });

                  Swal.fire({
                    icon: "success",
                    title:
                      "Treatment Updated Successfully",
                    timer: 1500,
                    showConfirmButton: false,
                  });
                  setTimeout(() => {
                    navigate(-1);
                  }, 1500);
                } else {
                  Swal.fire(
                    "Error",
                    response.data.message,
                    "error"
                  );
                }
              } catch (error) {
                console.log(error);
                Swal.fire(
                  "Error",
                  error?.response?.data
                    ?.message ||
                    "Something went wrong",
                  "error"
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({
              values,
              isSubmitting,
              setFieldValue,
            }) => (
              <Form>
                <div className="row">
                  {/* PATIENT ID */}
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>
                        Patient ID
                        <span className="text-danger">
                          *
                        </span>
                      </label>
                      <Field
                        className="form-control"
                        type="text"
                        disabled
                        name="patientId"
                      />
                    </div>
                  </div>
                  {/* TREATMENT */}
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>
                        Treatment Course
                        <span className="text-danger">
                          *
                        </span>
                      </label>
                      <Autocomplete
                        disablePortal
                        disabled
                        options={Treatment || []}
                        getOptionLabel={(
                          option
                        ) => option.name || ""}
                        value={
                          Treatment.find(
                            (t) =>
                              String(t.id) ===
                              String(
                                values.treatment_course_id
                              )
                          ) || null
                        }
                        isOptionEqualToValue={(
                          option,
                          value
                        ) =>
                          String(option.id) ===
                          String(value.id)
                        }
                        onChange={(
                          e,
                          value
                        ) => {
                          setFieldValue(
                            "treatment_course_id",
                            value
                              ? value.id
                              : ""
                          );
                          setFieldValue(
                            "treatment_course_name",
                            value
                              ? value.name
                              : ""
                          );
                        }}
                        renderInput={(
                          params
                        ) => (
                          <TextField
                            {...params}
                            placeholder="Select Treatment"
                          />
                        )}
                      />
                      <ErrorMessage
                        name="treatment_course_id"
                        component="div"
                        style={{
                          color: "red",
                        }}
                      />
                    </div>
                  </div>
                  {/* HOSPITAL ID */}
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>Hospital ID</label>
                      <Field
                        className="form-control"
                        type="text"
                        name="hospital_ID"
                        placeholder="Enter Hospital ID"
                      />
                    </div>
                  </div>
                  {/* TOTAL CHARGE */}
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>
                        Total Charge
                        <span className="text-danger">
                          *
                        </span>
                      </label>
                      <div className="fixpricee">
                        <p className="code-dial">
                          USD($)
                        </p>
                        <Field
                          className="form-control"
                          type="number"
                          name="total_charge"
                          min="0"
                          step="any"
                          onChange={(event) => {
                            const value = event.target.value;
                            setFieldValue("total_charge", value);
                            if (values.discount_percentage !== "") {
                              setFieldValue(
                                "final_amount",
                                calculateFinalAmount(
                                  value,
                                  values.discount_percentage
                                )
                              );
                            } else if (values.final_amount !== "") {
                              setFieldValue(
                                "discount_percentage",
                                calculateDiscountPercentage(
                                  value,
                                  values.final_amount
                                )
                              );
                            }
                          }}
                        />
                      </div>
                      <ErrorMessage
                        name="total_charge"
                        component="div"
                        style={{
                          color: "red",
                        }}
                      />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>Discount (%)</label>
                      <Field
                        className="form-control"
                        type="number"
                        name="discount_percentage"
                        min="0"
                        max="100"
                        step="any"
                        onChange={(event) => {
                          const value = event.target.value;
                          setFieldValue("discount_percentage", value);
                          if (value !== "") {
                            setFieldValue(
                              "final_amount",
                              calculateFinalAmount(
                                values.total_charge,
                                value
                              )
                            );
                          }
                        }}
                      />
                      <ErrorMessage
                        name="discount_percentage"
                        component="div"
                        style={{ color: "red" }}
                      />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>Final Amount</label>
                      <div className="fixpricee">
                        <p className="code-dial">USD($)</p>
                        <Field
                          className="form-control"
                          type="number"
                          name="final_amount"
                          min="0"
                          step="any"
                          onChange={(event) => {
                            const value = event.target.value;
                            setFieldValue("final_amount", value);
                            if (value !== "") {
                              setFieldValue(
                                "discount_percentage",
                                calculateDiscountPercentage(
                                  values.total_charge,
                                  value
                                )
                              );
                            }
                          }}
                        />
                      </div>
                      <ErrorMessage
                        name="final_amount"
                        component="div"
                        style={{ color: "red" }}
                      />
                    </div>
                  </div>
                  {/* AMOUNT PAID */}
                 
                  {/* SERVICES */}
                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>
                        Services
                        <span className="text-danger">
                          *
                        </span>
                      </label>
                      <Autocomplete
                        multiple
                        options={Service || []}
                        getOptionLabel={(
                          option
                        ) =>
                          option.serviceName ||
                          ""
                        }
                        value={Service.filter(
                          (service) =>
                            values.services
                              ?.map(String)
                              .includes(
                                String(
                                  service.serviceId
                                )
                              )
                        )}
                        isOptionEqualToValue={(
                          option,
                          value
                        ) =>
                          String(
                            option.serviceId
                          ) ===
                          String(
                            value.serviceId
                          )
                        }
                        onChange={(
                          event,
                          value
                        ) => {
                          const selectedIds =
                            value.map(
                              (item) =>
                                item.serviceId
                            );

                          setFieldValue(
                            "services",
                            selectedIds
                          );
                        }}
                        renderInput={(
                          params
                        ) => (
                          <TextField
                            {...params}
                            label="Select Services"
                          />
                        )}
                      />
                      <ErrorMessage
                        name="services"
                        component="div"
                        style={{
                          color: "red",
                        }}
                      />
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>
                        Referral Commission (%) <span className="text-muted">(On Paid Bill)</span>
                      </label>
                      <div className="fixpricee">
                        <p className="code-dial">%</p>
                        <Field
                          className="form-control"
                          type="number"
                          name="commission_percentage"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="e.g. 10"
                        />
                      </div>
                      <ErrorMessage
                        name="commission_percentage"
                        component="div"
                        style={{ color: "red" }}
                      />
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="field-set">
                      <label>
                        Insurance (%) <span className="text-muted">(Claim On Paid Bill)</span>
                      </label>
                      <div className="fixpricee">
                        <p className="code-dial">%</p>
                        <Field
                          className="form-control"
                          type="number"
                          name="insurance_percentage"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="e.g. 15"
                        />
                      </div>
                      <ErrorMessage
                        name="insurance_percentage"
                        component="div"
                        style={{ color: "red" }}
                      />
                    </div>
                  </div>
                </div>
                {/* BUTTON */}
                <div className="mt-3">
                  <button
                    className="submit-btn"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : "Submit"}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}