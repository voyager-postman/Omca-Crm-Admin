import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { baseurl } from "../../Basurl/Baseurl";
import { markRecordRead } from "../../services/unreadApi";
import { formatSosDisplayValue, normalizeSosItem } from "../../utils/sosHelpers";
import {
  acceptSosCase,
  closeSosCase,
  fetchSosDashboard,
  normalizeSosDashboardData,
  postSosAction,
} from "../../services/sosApi";

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const asTextList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.name || item?.condition || item?.label || "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,|;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const getContactMobile = (contact = {}) =>
  contact.mobile ||
  contact.phone ||
  [contact.phone_code, contact.phone_number || contact.number]
    .filter(Boolean)
    .join(" ") ||
  "";

export default function SosDetail() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const recordId =
      location.state?.data?.enquiryId ||
      location.state?.enquiryId ||
      location.state?.id;
    if (recordId) markRecordRead("enquiries", recordId);
  }, [location.state]);

  const buildDetailFromPayload = (raw = {}, fallback = {}) => {
    const normalized = normalizeSosDashboardData(raw, fallback);
    return {
      ...normalized,
      alertTitle: raw.alertTitle || normalized.alertTitle || "SOS CASE",
      sosId: raw.sosId || normalized.sosId || "",
      emergencyCaseId:
        raw.emergencyCaseId || normalized.emergencyCaseId || "",
      status: raw.status || normalized.status || "—",
      isActive: raw.isActive ?? null,
      patient: {
        name:
          raw.patient?.name ||
          normalized.patient?.name ||
          fallback.name ||
          "—",
        mobile:
          raw.patient?.mobile ||
          raw.patient?.phone ||
          normalized.patient?.mobile ||
          fallback.mobileNumber ||
          "",
        user_id:
          raw.patient?.user_id ||
          raw.user_id ||
          fallback.user_id ||
          "",
      },
      location: {
        label: raw.location?.label || normalized.location?.label || "—",
        latitude:
          raw.location?.latitude ??
          normalized.location?.lat ??
          null,
        longitude:
          raw.location?.longitude ??
          normalized.location?.lng ??
          null,
        mapsUrl:
          raw.location?.mapsUrl ||
          normalized.location?.mapsUrl ||
          "",
      },
      nearestAmbulanceDistanceKm:
        raw.nearestAmbulanceDistanceKm ??
        normalized.location?.distanceKm ??
        null,
      medicalHistory: asTextList(
        raw.medicalHistory || normalized.medicalHistory,
      ),
      emergencyContacts: Array.isArray(raw.emergencyContacts)
        ? raw.emergencyContacts
        : Array.isArray(normalized.emergencyContacts)
          ? normalized.emergencyContacts
          : [],
      bloodGroup: raw.bloodGroup || raw.blood_group || "",
      currentMedications:
        raw.currentMedications ||
        raw.current_medications ||
        (Array.isArray(normalized.medication)
          ? normalized.medication.join(", ")
          : normalized.medication) ||
        "",
      actions: Array.isArray(raw.actions) ? raw.actions : normalized.actions || [],
      assignedOperator:
        raw.assignedOperator || normalized.operator || "",
      escalations: Array.isArray(raw.escalations) ? raw.escalations : [],
      activatedAt: raw.activatedAt || raw.createdAt || null,
      acceptedAt: raw.acceptedAt || null,
      closedAt: raw.closedAt || null,
      steps: Array.isArray(raw.steps) ? raw.steps : [],
      raw,
    };
  };

  const fetchSosDetail = async () => {
    const sosId = location.state?.id;
    const fallback = normalizeSosItem(location.state?.data || {});
    setLoading(true);
    try {
      if (sosId) {
        try {
          const dashboard = await fetchSosDashboard(sosId);
          if (dashboard) {
            setDetail(buildDetailFromPayload(dashboard, fallback));
            return;
          }
        } catch (dashErr) {
          if (dashErr?.response?.status === 403) {
            await Swal.fire(
              "Access Denied",
              dashErr?.response?.data?.message ||
                "This SOS case is assigned to another operator.",
              "warning",
            );
            setDetail(null);
            window.history.back();
            return;
          }
          /* fall through to list lookup for non-403 errors */
        }

        const response = await axios.get(`${baseurl}sos/list`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const list = response.data?.data || [];
        const found = list.find(
          (item) =>
            item.sosId === sosId ||
            item.id === sosId ||
            item.sos_id === sosId ||
            item.emergencyCaseId === sosId,
        );
        if (found) {
          setDetail(buildDetailFromPayload(found, fallback));
          return;
        }
      }

      if (fallback?.sosId || fallback?.name) {
        setDetail(buildDetailFromPayload(fallback.raw || fallback, fallback));
      } else {
        setDetail(null);
      }
    } catch (error) {
      console.log(error);
      if (error?.response?.status === 403) {
        await Swal.fire(
          "Access Denied",
          error?.response?.data?.message ||
            "This SOS case is assigned to another operator.",
          "warning",
        );
        setDetail(null);
        window.history.back();
        return;
      }
      if (fallback?.sosId || fallback?.name) {
        setDetail(buildDetailFromPayload(fallback.raw || fallback, fallback));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSosDetail();
  }, []);

  const handleBack = () => {
    window.history.back();
  };

  const runAction = async (action) => {
    if (!detail?.sosId || !action || action.disabled) return;

    const confirmed = await Swal.fire({
      title: action.label || action.type,
      text: `Do you want to continue with "${action.label || action.type}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "Cancel",
    });
    if (!confirmed.isConfirmed) return;

    setActionLoading(action.type);
    try {
      const type = action.type;
      if (type === "Accept") {
        await acceptSosCase(detail.sosId);
      } else if (type === "Close") {
        await closeSosCase(detail.sosId);
      } else if (type === "OpenMaps") {
        const mapsUrl = detail.location?.mapsUrl;
        if (mapsUrl) window.open(mapsUrl, "_blank");
        await postSosAction(detail.sosId, "OpenMaps");
      } else if (type === "Call") {
        const phone = String(detail.patient?.mobile || "").replace(/\s/g, "");
        if (phone) window.location.href = `tel:${phone}`;
        await postSosAction(detail.sosId, "Call");
      } else if (type === "WhatsApp") {
        const phone = String(detail.patient?.mobile || "")
          .replace(/\s/g, "")
          .replace(/\+/g, "");
        if (phone) window.open(`https://wa.me/${phone}`, "_blank");
        await postSosAction(detail.sosId, "WhatsApp");
      } else {
        await postSosAction(detail.sosId, type);
      }

      Swal.fire(
        "Success",
        action.resultMessage || `${action.label || action.type} completed`,
        "success",
      );
      await fetchSosDetail();
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          `Failed to ${action.label || action.type}`,
        "error",
      );
    } finally {
      setActionLoading("");
    }
  };

  const Field = ({ label, children }) => (
    <div className="col-md-4">
      <h6>{label}</h6>
      <p>{children ?? "—"}</p>
    </div>
  );

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

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="main_content">
            <p className="text-center py-4 mb-0">Loading SOS details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="main_content">
            <p className="text-center py-4 mb-0">SOS details not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3 gy-3">
          <div className="col-md-12">
            <div className="topmainhd">
              <h6>
                <i
                  className="fa-solid fa-arrow-left-long me-2"
                  onClick={handleBack}
                  style={{ cursor: "pointer" }}
                ></i>
                {formatSosDisplayValue(detail.alertTitle)} Details
              </h6>
            </div>
          </div>

          <Section title="Case Overview">
            <Field label="Alert Title">
              {formatSosDisplayValue(detail.alertTitle)}
            </Field>
            <Field label="SOS ID">{formatSosDisplayValue(detail.sosId)}</Field>
            <Field label="Emergency Case ID">
              {formatSosDisplayValue(detail.emergencyCaseId)}
            </Field>
            <Field label="Status">{formatSosDisplayValue(detail.status)}</Field>
            <Field label="Active">
              {detail.isActive === null || detail.isActive === undefined
                ? "—"
                : detail.isActive
                  ? "Yes"
                  : "No"}
            </Field>
            <Field label="Assigned Operator">
              {formatSosDisplayValue(detail.assignedOperator)}
            </Field>
            <Field label="Activated At">
              {formatDateTime(detail.activatedAt)}
            </Field>
            <Field label="Accepted At">
              {formatDateTime(detail.acceptedAt)}
            </Field>
            <Field label="Closed At">{formatDateTime(detail.closedAt)}</Field>
          </Section>

          <Section title="Patient Details">
            <Field label="Patient Name">
              {formatSosDisplayValue(detail.patient?.name)}
            </Field>
            <Field label="Mobile">
              {formatSosDisplayValue(detail.patient?.mobile)}
            </Field>
            {/* <Field label="User ID">
              {formatSosDisplayValue(detail.patient?.user_id)}
            </Field> */}
          </Section>

          <Section title="Location">
            <Field label="Label">
              {formatSosDisplayValue(detail.location?.label)}
            </Field>
            {/* <Field label="Latitude">
              {formatSosDisplayValue(detail.location?.latitude)}
            </Field>
            <Field label="Longitude">
              {formatSosDisplayValue(detail.location?.longitude)}
            </Field> */}
            <Field label="Nearest Ambulance Distance (Km)">
              {formatSosDisplayValue(detail.nearestAmbulanceDistanceKm)}
            </Field>
            <div className="col-md-8">
              <h6>Google Maps</h6>
              <p>
                {detail.location?.mapsUrl ? (
                  <a
                    href={detail.location.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {detail.location.mapsUrl}
                  </a>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </Section>

          <Section title="Medical Information">
            <Field label="Blood Group">
              {formatSosDisplayValue(detail.bloodGroup)}
            </Field>
            <Field label="Current Medications">
              {formatSosDisplayValue(detail.currentMedications)}
            </Field>
            <div className="col-md-12">
              <h6>Medical History</h6>
              {detail.medicalHistory?.length ? (
                <ul className="mb-0 ps-3">
                  {detail.medicalHistory.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>—</p>
              )}
            </div>
          </Section>

          <Section title="Emergency Contacts">
            <div className="col-md-12">
              {detail.emergencyContacts?.length ? (
                <div className="table-responsive">
                  <table className="table table-bordered mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Relation</th>
                        <th>Mobile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.emergencyContacts.map((contact, index) => (
                        <tr key={`${contact.name || "contact"}-${index}`}>
                          <td>{formatSosDisplayValue(contact.name)}</td>
                          <td>
                            {formatSosDisplayValue(
                              contact.relation || contact.relationship,
                            )}
                          </td>
                          <td>
                            {formatSosDisplayValue(getContactMobile(contact))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>—</p>
              )}
            </div>
          </Section>

          <Section title="Case Progress">
            <div className="col-md-12">
              {detail.steps?.length ? (
                <div className="table-responsive">
                  <table className="table table-bordered mb-0">
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Completed</th>
                        <th>Current</th>
                        <th>Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.steps.map((step, index) => (
                        <tr key={`${step.label || "step"}-${index}`}>
                          <td>{formatSosDisplayValue(step.label)}</td>
                          <td>{step.completed ? "Yes" : "No"}</td>
                          <td>{step.current ? "Yes" : "No"}</td>
                          <td>{step.pending ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>—</p>
              )}
            </div>
          </Section>

          <Section title="Escalations">
            <div className="col-md-12">
              {detail.escalations?.length ? (
                <div className="table-responsive">
                  <table className="table table-bordered mb-0">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>Seconds</th>
                        <th>Notified At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.escalations.map((item, index) => (
                        <tr key={item._id || `${item.level}-${index}`}>
                          <td>{formatSosDisplayValue(item.level)}</td>
                          <td>{formatSosDisplayValue(item.seconds)}</td>
                          <td>{formatDateTime(item.notifiedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>—</p>
              )}
            </div>
          </Section>

          {/* <Section title="Actions">
            <div className="col-md-12 d-flex flex-wrap gap-2">
              {detail.actions?.length ? (
                detail.actions.map((action) => (
                  <button
                    key={action.type || action.label}
                    type="button"
                    className="add-button"
                    disabled={!!action.disabled || actionLoading === action.type}
                    onClick={() => runAction(action)}
                    title={
                      action.disabled
                        ? "Action disabled"
                        : action.label || action.type
                    }
                  >
                    {actionLoading === action.type
                      ? "Please wait..."
                      : action.label || action.type}
                  </button>
                ))
              ) : (
                <p>—</p>
              )}
            </div>
          </Section> */}
        </div>
      </div>
    </div>
  );
}
