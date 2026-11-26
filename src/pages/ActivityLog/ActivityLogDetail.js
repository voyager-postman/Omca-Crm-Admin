import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { baseurl } from "../../Basurl/Baseurl";
import Loader from "../../components/Loader";
import {
  extractActivityLogDetail,
  formatActivityLogDate,
  getActivityLogAction,
  getActivityLogDate,
  getActivityLogDescription,
  getActivityLogEmail,
  getActivityLogIp,
  getActivityLogLocation,
  getActivityLogMapUrl,
  getActivityLogModule,
  getActivityLogRole,
  getActivityLogStatus,
  getActivityLogUser,
} from "./activityLogHelpers";

const formatLabel = (key) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length ? JSON.stringify(value, null, 2) : "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  if (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    value.includes("T")
  ) {
    return formatActivityLogDate(value);
  }
  return String(value);
};

const getSummaryItems = (log) => [
  { label: "User", value: getActivityLogUser(log) },
  { label: "Role", value: getActivityLogRole(log) },
  { label: "Email", value: getActivityLogEmail(log) },
  { label: "Action", value: getActivityLogAction(log) },
  { label: "Module", value: getActivityLogModule(log) },
  { label: "Description", value: getActivityLogDescription(log) },
  { label: "Status", value: getActivityLogStatus(log) },
  {
    label: "Date/Time",
    value: formatActivityLogDate(getActivityLogDate(log)),
  },
  { label: "IP Address", value: getActivityLogIp(log) },
  { label: "Location (Lat/Long)", value: getActivityLogLocation(log) },
];

export default function ActivityLogDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const activityId = location.state?.activityId;
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchActivityLogDetail = async () => {
      if (!activityId) {
        toast.error("Activity log ID is missing");
        navigate("/Admin/activity-logs");
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(
          `${baseurl}get_activity_log/${activityId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
          },
        );
        const detail = extractActivityLogDetail(response.data);
        if (!detail) {
          throw new Error("Activity log not found");
        }
        setLog(detail);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to fetch activity log detail",
        );
        navigate("/Admin/activity-logs");
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLogDetail();
  }, [activityId, navigate]);

  return (
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
                Activity Log Detail
              </h6>
            </div>
          </div>
          <div className="col-md-12">
            <div className="main_content">
              {loading ? (
                <Loader />
              ) : log ? (
                <>
                  <div className="row gx-3 gy-3 mb-3">
                    {getSummaryItems(log).map((item) => {
                      const isLocation = item.label === "Location (Lat/Long)";
                      const mapUrl = isLocation ? getActivityLogMapUrl(log) : null;

                      return (
                        <div className="col-md-4" key={item.label}>
                          <div className="doctorcontent">
                            <h6>{item.label}</h6>
                            {isLocation && mapUrl ? (
                              <p>
                                <a
                                  href={mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    color: "#1e40af",
                                    fontWeight: 600,
                                    textDecoration: "none",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.textDecoration =
                                      "underline")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.textDecoration =
                                      "none")
                                  }
                                  title="Open in Google Maps"
                                >
                                  <i className="fa fa-map-marker text-danger" />
                                  <span>{item.value}</span>
                                  <i
                                    className="fa fa-external-link"
                                    style={{ fontSize: "11px", opacity: 0.6 }}
                                  />
                                </a>
                              </p>
                            ) : (
                              <p>{item.value}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="card doctor-card">
                    <div className="card-header">
                      <h6>Full Details</h6>
                    </div>
                    <div className="card-body">
                      <div className="row gx-3 gy-3">
                        {Object.entries(log).map(([key, value]) => (
                          <div className="col-md-4" key={key}>
                            <div className="doctorcontent">
                              <h6>{formatLabel(key)}</h6>
                              <p style={{ whiteSpace: "pre-wrap" }}>
                                {formatValue(value)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center mb-0">No activity log found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
