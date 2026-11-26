import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  FormControl,
  MenuItem,
  Select,
} from "@mui/material";
import axios from "axios";
import { TRAVEL_STATUS_VALUES } from "../../utils/patientStatus";
import { baseurl, image } from "../../Basurl/Baseurl";
import "./TravelStatusModal.css";

/** Airport List API */
const AIRPORTS_API = "https://omcacrm.com/omca/api/crm/airports";

/** Travel-detail fetch – GET /api/get_travel_patients?patientId=:id */
const fetchTravelDetail = async (patientId) => {
  if (!patientId) return null;
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${baseurl}get_travel_patients`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { patientId },
    });
    const body = res.data;
    console.log("[TravelStatusModal] get_travel_patients raw response:", body);

    // ── Unwrap the record ──────────────────────────────────────────────────
    // Handles: { data: [...] }  |  { data: {...} }  |  raw array  |  raw object
    let record = null;
    if (Array.isArray(body)) {
      record = body.find((r) => r?.patientId === patientId) ?? body[0] ?? null;
    } else if (Array.isArray(body?.data)) {
      record =
        body.data.find((r) => r?.patientId === patientId) ??
        body.data[0] ??
        null;
    } else if (body?.data && typeof body.data === "object") {
      record = body.data;
    } else if (body && typeof body === "object") {
      record = body;
    }

    if (!record || typeof record !== "object") {
      console.log("[TravelStatusModal] No patient record found in response");
      return null;
    }

    console.log("[TravelStatusModal] patient record:", record);

    // ── Extract travel details ─────────────────────────────────────────────
    // Some APIs wrap it under travelDetails, some return it flat
    const td = record.travelDetails;
    if (td && typeof td === "object" && !Array.isArray(td)) {
      console.log("[TravelStatusModal] travelDetails found:", td);
      return td;
    }

    // Flat record carrying travel fields directly
    const hasTravelFields =
      record.from !== undefined ||
      record.to !== undefined ||
      record.travelDate !== undefined ||
      record.travel_date !== undefined ||
      record.arrivalTime !== undefined;

    if (hasTravelFields) {
      console.log("[TravelStatusModal] flat travel fields found:", record);
      return record;
    }

    console.log("[TravelStatusModal] patient has no travel details yet");
    return null;
  } catch (err) {
    console.warn("[TravelStatusModal] fetchTravelDetail failed:", err?.message, err?.response?.data);
    return null;
  }
};

/**
 * Try to resolve a stored airport value (code, name, or full "CODE - Name")
 * against the fetched airport list and return the canonical "CODE - Name" label.
 */
const resolveAirportValue = (stored, airports) => {
  if (!stored || !airports.length) return stored || "";
  const s = String(stored).trim();
  // Exact match
  if (airports.find((a) => a.value === s)) return s;
  // Match by IATA code prefix (e.g. stored = "DEL")
  const byCode = airports.find(
    (a) => a.code && a.code.toUpperCase() === s.toUpperCase(),
  );
  if (byCode) return byCode.value;
  // Match by name substring (case-insensitive)
  const lower = s.toLowerCase();
  const byName = airports.find((a) => a.label.toLowerCase().includes(lower));
  if (byName) return byName.value;
  // Fall back to raw stored value so it still shows
  return s;
};

const fetchAirports = async () => {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get(AIRPORTS_API, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = res.data;

    // API returns { success: "true", data: { "DEL": "Indira Gandhi...", ... } }
    const raw = body?.data ?? body?.airports ?? body ?? {};

    if (typeof raw === "object" && !Array.isArray(raw)) {
      // Object map: { code: airportName }
      return Object.entries(raw).map(([code, name]) => ({
        code,
        label: `${code} - ${name}`,
        value: `${code} - ${name}`,
      }));
    }

    // Fallback: array of objects
    if (Array.isArray(raw)) {
      return raw.map((a) => {
        const code = a.code ?? a.iata ?? "";
        const name = a.name ?? a.airportName ?? a.airport_name ?? "";
        const label = code && name ? `${code} - ${name}` : name || code;
        return { code, label, value: label };
      });
    }

    return [];
  } catch {
    return [];
  }
};

const SERVICE_OPTIONS = ["Pre-Paid Forex Cards", "Foreign Currency"];

const emptyForm = {
  from: "",
  to: "",
  travelDate: "",
  arrivalTime: "",
  numberOfTravellers: "",
  services: "",
  gpsLocationPin: "",
};

const formatArrivalTime = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
};

/** Searchable airport dropdown */
function AirportSelect({ value, onChange, airports, loading, placeholder, error }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = airports.filter((a) =>
    a.label.toLowerCase().includes(search.toLowerCase()),
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (airport) => {
    onChange(airport.value);
    setSearch("");
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="airport-select-wrapper"
      style={{ position: "relative" }}
    >
      <input
        type="text"
        className={`form-control${error ? " airport-input-error" : ""}`}
        placeholder={loading ? "Loading airports…" : placeholder}
        value={open ? search : value || ""}
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        autoComplete="off"
        disabled={loading}
      />
      {value && !open && (
        <button
          type="button"
          className="airport-clear-btn"
          onClick={() => { onChange(""); setSearch(""); }}
          tabIndex={-1}
          aria-label="Clear"
        >
          ×
        </button>
      )}
      {open && (
        <div className="airport-dropdown">
          {filtered.length === 0 ? (
            <div className="airport-dropdown-empty">No airports found</div>
          ) : (
            filtered.slice(0, 60).map((a) => (
              <div
                key={a.value}
                className={`airport-dropdown-item${a.value === value ? " airport-dropdown-item--active" : ""}`}
                onMouseDown={() => handleSelect(a)}
              >
                {a.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TravelStatusModal({
  open,
  status,
  patientId = "",
  patientName = "",
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState(emptyForm);
  const [action, setAction] = useState(status || "");
  const [errors, setErrors] = useState({});
  const [airports, setAirports] = useState([]);
  const [airportsLoading, setAirportsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);

  /** Load airports once on first open */
  useEffect(() => {
    if (!open) return;
    setAirportsLoading(true);
    fetchAirports()
      .then(setAirports)
      .finally(() => setAirportsLoading(false));
  }, [open]);

  /** Pre-fill form from existing travel data whenever modal opens */
  useEffect(() => {
    if (!open) return;
    setAction(status || "");
    setErrors({});
    setDocuments([]);
    setExistingDocuments([]);

    if (!patientId) {
      setForm(emptyForm);
      return;
    }

    setDetailLoading(true);
    fetchTravelDetail(patientId)
      .then((details) => {
        console.log("[TravelStatusModal] pre-filling form with details:", details);
        if (!details) {
          setForm(emptyForm);
          return;
        }

        const existingDocs = details.documents || [];
        setExistingDocuments(existingDocs);

        const rawFrom =
          details.from || details.from_location || details.fromLocation ||
          details.departFrom || details.depart_from || "";
        const rawTo =
          details.to || details.to_location || details.toLocation ||
          details.arriveTo || details.arrive_to || "";
        const rawDate =
          details.travelDate || details.travel_date || details.date ||
          details.departureDate || details.departure_date || "";
        const rawTime =
          details.arrivalTime || details.arrival_time || details.time ||
          details.departureTime || details.departure_time || "";
        const rawTravellers =
          details.numberOfTravellers ?? details.number_of_travellers ??
          details.travellers ?? details.num_travellers ?? "";
        const rawServices =
          details.services || details.service || details.serviceType ||
          details.service_type || "";
        const rawGps =
          details.gpsLocationPin ?? details.gps_location_pin ??
          details.gpsLocation ?? details.gps_location ??
          details.locationPin ?? details.location_pin ?? "";

        const svc = String(rawServices).trim();
        const validSvc = SERVICE_OPTIONS.includes(svc) ? svc : "";

        const rawDateStr = rawDate ? String(rawDate).slice(0, 10) : "";
        const rawTimeStr = rawTime
          ? formatArrivalTime(String(rawTime)).slice(0, 5)
          : "";

        // Resolve stored from/to against airport list (airports may already be loaded)
        setAirports((currentAirports) => {
          const nextForm = {
            from: resolveAirportValue(rawFrom, currentAirports),
            to: resolveAirportValue(rawTo, currentAirports),
            travelDate: rawDateStr,
            arrivalTime: rawTimeStr,
            numberOfTravellers: String(rawTravellers),
            services: validSvc,
            gpsLocationPin: String(rawGps ?? ""),
          };
          console.log("[TravelStatusModal] setting form:", nextForm);
          setForm(nextForm);
          // Return same airports array unchanged (we only read it)
          return currentAirports;
        });
      })
      .finally(() => setDetailLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, status]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleAirportChange = (field) => (value) => {
    setForm((prev) => {
      const nextForm = { ...prev, [field]: value };
      setErrors((prevErr) => {
        const nextErr = { ...prevErr, [field]: "" };
        const fromVal = (field === "from" ? value : nextForm.from || "").trim();
        const toVal = (field === "to" ? value : nextForm.to || "").trim();
        if (fromVal && toVal && fromVal.toLowerCase() !== toVal.toLowerCase()) {
          if (nextErr.to === "From and To airports cannot be the same") {
            delete nextErr.to;
          }
        }
        return nextErr;
      });
      return nextForm;
    });
  };

  const validate = () => {
    const next = {};

    // 1. Status validation (mandatory)
    if (!action || !action.trim()) {
      next.action = "Please select a travel status";
    }

    const fromVal = form.from.trim();
    const toVal = form.to.trim();

    // 2. From & To validation (optional, but cannot be same if both are filled)
    if (fromVal && toVal && toVal.toLowerCase() === fromVal.toLowerCase()) {
      next.to = "From and To airports cannot be the same";
    }

    // 3. Number of Travellers validation (optional, must be between 1 and 50 if filled)
    if (form.numberOfTravellers) {
      const travellers = Number(form.numberOfTravellers);
      if (
        Number.isNaN(travellers) ||
        travellers < 1 ||
        travellers > 50
      ) {
        next.numberOfTravellers = "Please enter between 1 and 50 travellers";
      }
    }

    // 4. Services validation (optional, must be in options if filled)
    const svc = form.services.trim();
    if (svc && !SERVICE_OPTIONS.includes(svc)) {
      next.services = "Please select a valid service option";
    }

    // 5. GPS Location / PIN validation (optional, must be at least 3 chars if filled)
    const pinVal = form.gpsLocationPin.trim();
    if (pinVal && pinVal.length < 3) {
      next.gpsLocationPin = "Please enter a valid GPS location or PIN code (at least 3 characters)";
    }

    // 6. Documents validation
    const docErrors = {};
    documents.forEach((doc, index) => {
      if (doc.file && !doc.label.trim()) {
        docErrors[index] = "Label is required";
      }
    });
    if (Object.keys(docErrors).length > 0) {
      next.documents = docErrors;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;

    // Filter documents
    const validDocs = documents.filter((d) => d.file);
    const files = validDocs.map((d) => d.file);
    const labels = validDocs.map((d) => d.label.trim() || "Travel Document");

    const payload = {
      p_status: action,
      travelDetails: {
        from: form.from.trim(),
        to: form.to.trim(),
        travelDate: form.travelDate,
        arrivalTime: formatArrivalTime(form.arrivalTime),
        numberOfTravellers: form.numberOfTravellers ? Number(form.numberOfTravellers) : null,
        services: form.services.trim(),
        gpsLocationPin: form.gpsLocationPin.trim(),
        action,
      },
    };

    if (files.length > 0) {
      payload.travelDocuments = files;
      payload.travelDocumentLabels = labels;
    }

    onSubmit?.(payload);
  };

  const isBusy = submitting || detailLoading;

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={onClose}
      className="travel-status-dialog"
      sx={{ zIndex: 20000 }}
      PaperProps={{ className: "travel-status-paper" }}
    >
      <div className="main-card-header travel-status-header">
        <div className="note-hd">
          <h6>Travel Details</h6>
          {patientName ? (
            <span className="travel-status-patient">{patientName}</span>
          ) : null}
        </div>
        <div
          className="cross-icon"
          onClick={isBusy ? undefined : onClose}
          role="button"
          tabIndex={0}
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark"></i>
        </div>
      </div>

      <DialogContent className="travel-status-body">
        {detailLoading && (
          <div className="travel-detail-loading">
            <span>Loading existing travel data…</span>
          </div>
        )}
        <Box
          noValidate
          component="form"
          id="travel-status-form"
          onSubmit={handleSubmit}
          className="contact-form travel-status-form"
        >
          <div className="travel-status-grid">
            {/* Status */}
            <div className="field-set travel-status-full">
              <label>
                Status<span className="text-danger">*</span>
              </label>
              <FormControl fullWidth size="small" error={!!errors.action}>
                <Select
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setErrors((prev) => ({ ...prev, action: "" }));
                  }}
                  displayEmpty
                  className="travel-status-select"
                  MenuProps={{ sx: { zIndex: 22000 } }}
                >
                  {TRAVEL_STATUS_VALUES.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {errors.action ? (
                <span className="travel-status-error">{errors.action}</span>
              ) : null}
            </div>

            {/* From */}
            <div className="field-set">
              <label>From</label>
              <AirportSelect
                value={form.from}
                onChange={handleAirportChange("from")}
                airports={airports}
                loading={airportsLoading}
                placeholder="Search airport…"
                error={!!errors.from}
              />
              {errors.from ? (
                <span className="travel-status-error">{errors.from}</span>
              ) : null}
            </div>

            {/* To */}
            <div className="field-set">
              <label>To</label>
              <AirportSelect
                value={form.to}
                onChange={handleAirportChange("to")}
                airports={airports}
                loading={airportsLoading}
                placeholder="Search airport…"
                error={!!errors.to}
              />
              {errors.to ? (
                <span className="travel-status-error">{errors.to}</span>
              ) : null}
            </div>

            {/* Travel Date */}
            <div className="field-set">
              <label>Travel Date</label>
              <input
                type="date"
                className={`form-control ${errors.travelDate ? "airport-input-error" : ""}`}
                value={form.travelDate}
                onChange={handleChange("travelDate")}
              />
              {errors.travelDate ? (
                <span className="travel-status-error">{errors.travelDate}</span>
              ) : null}
            </div>

            {/* Arrival Time */}
            <div className="field-set">
              <label>Arrival Time</label>
              <input
                type="time"
                step="1"
                className={`form-control ${errors.arrivalTime ? "airport-input-error" : ""}`}
                value={form.arrivalTime}
                onChange={handleChange("arrivalTime")}
              />
              {errors.arrivalTime ? (
                <span className="travel-status-error">{errors.arrivalTime}</span>
              ) : null}
            </div>

            {/* Number of Travellers */}
            <div className="field-set">
              <label>Number of Travellers</label>
              <input
                type="number"
                min="1"
                max="50"
                className={`form-control ${errors.numberOfTravellers ? "airport-input-error" : ""}`}
                value={form.numberOfTravellers}
                onChange={handleChange("numberOfTravellers")}
              />
              {errors.numberOfTravellers ? (
                <span className="travel-status-error">
                  {errors.numberOfTravellers}
                </span>
              ) : null}
            </div>

            {/* Services — restricted to 2 options */}
            <div className="field-set">
              <label>Services</label>
              <FormControl fullWidth size="small" error={!!errors.services}>
                <Select
                  value={form.services}
                  onChange={handleChange("services")}
                  displayEmpty
                  className="travel-status-select"
                  MenuProps={{ sx: { zIndex: 22000 } }}
                >
                  <MenuItem value="">
                    <em>Select service…</em>
                  </MenuItem>
                  {SERVICE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {errors.services ? (
                <span className="travel-status-error">{errors.services}</span>
              ) : null}
            </div>

            {/* GPS Location / PIN */}
            <div className="field-set travel-status-full">
              <label>GPS Location / PIN</label>
              <input
                type="text"
                className={`form-control ${errors.gpsLocationPin ? "airport-input-error" : ""}`}
                placeholder="e.g. 201301"
                value={form.gpsLocationPin}
                onChange={handleChange("gpsLocationPin")}
              />
              {errors.gpsLocationPin ? (
                <span className="travel-status-error">
                  {errors.gpsLocationPin}
                </span>
              ) : null}
            </div>

            {/* Travel Documents */}
            <div className="field-set travel-status-full travel-documents-section" style={{ marginTop: "10px" }}>
              <label style={{ fontWeight: 600, borderBottom: "1px solid #eee", paddingBottom: "6px" }}>
                Travel Documents
              </label>

              {/* Existing documents */}
              {existingDocuments && existingDocuments.length > 0 && (
                <div className="existing-documents" style={{ marginBottom: "12px", marginTop: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#666", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Already Uploaded Documents:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {existingDocuments.map((doc, idx) => {
                      const docUrl = doc.url || doc.path || (doc.filePath ? `${image}${doc.filePath}` : "");
                      const docName = doc.label || doc.fileName || doc.name || `Document ${idx + 1}`;
                      return (
                        <div key={idx} className="existing-doc-badge" style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: "#f0faf9",
                          border: "1px solid #c5f0eb",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          color: "#1aa89b"
                        }}>
                          <i className="fa-solid fa-file me-2"></i>
                          {docUrl ? (
                            <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1aa89b", textDecoration: "underline", fontWeight: "500" }}>
                              {docName}
                            </a>
                          ) : (
                            <span>{docName}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="new-documents-list" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                {documents.map((doc, idx) => (
                  <div key={idx} className="document-upload-row" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "#fdfdfd",
                    border: "1px solid #eef1f4",
                    borderRadius: "6px",
                    padding: "8px 12px"
                  }}>
                    <div style={{ flex: 2 }}>
                      <input
                        type="file"
                        className="form-control"
                        style={{ height: "36px", padding: "4px 8px", fontSize: "12px" }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          setDocuments((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, file } : d))
                          );
                          // Auto pre-fill label with filename if label is empty
                          if (file && !doc.label) {
                            setDocuments((prev) =>
                              prev.map((d, i) => (i === idx ? { ...d, label: file.name.split('.').slice(0, -1).join('.') } : d))
                            );
                          }
                          // Clear errors
                          if (errors.documents?.[idx]) {
                            setErrors((prev) => {
                              const nextDocs = { ...prev.documents };
                              delete nextDocs[idx];
                              return { ...prev, documents: nextDocs };
                            });
                          }
                        }}
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <input
                        type="text"
                        placeholder="Document Label (e.g. Ticket)"
                        className={`form-control ${errors.documents?.[idx] ? "airport-input-error" : ""}`}
                        style={{ height: "36px", fontSize: "12px" }}
                        value={doc.label}
                        onChange={(e) => {
                          setDocuments((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, label: e.target.value } : d))
                          );
                          // Clear error
                          if (errors.documents?.[idx]) {
                            setErrors((prev) => {
                              const nextDocs = { ...prev.documents };
                              delete nextDocs[idx];
                              return { ...prev, documents: nextDocs };
                            });
                          }
                        }}
                      />
                      {errors.documents?.[idx] && (
                        <span className="travel-status-error" style={{ fontSize: "11px", marginTop: "2px" }}>
                          {errors.documents[idx]}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outlined"
                      color="error"
                      style={{ minWidth: "36px", height: "36px", padding: 0 }}
                      onClick={() => {
                        setDocuments((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Document Button */}
              {documents.length < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    setDocuments((prev) => [...prev, { file: null, label: "" }]);
                  }}
                  className="travel-add-doc-btn"
                >
                  <i className="fa-solid fa-plus"></i> Add Travel Document
                </button>
              )}
            </div>
          </div>
        </Box>
      </DialogContent>

      <div className="travel-status-actions">
        <Button
          type="button"
          className="travel-status-cancel-btn"
          onClick={onClose}
          disabled={isBusy}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="travel-status-form"
          variant="contained"
          className="travel-status-submit-btn"
          disabled={isBusy}
        >
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </Dialog>
  );
}
