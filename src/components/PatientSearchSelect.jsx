import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 400;

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const extractPatients = (payload) => {
  const list =
    payload?.details ||
    payload?.data?.details ||
    payload?.patients ||
    payload?.data?.patients ||
    (Array.isArray(payload?.data) ? payload.data : null) ||
    (Array.isArray(payload) ? payload : null) ||
    [];
  return Array.isArray(list) ? list : [];
};

export const getPatientFullPhone = (p) => {
  if (!p) return "";
  const code = String(p.phoneCode || p.dial_code || "").trim();
  const phone = String(
    p.phone ||
      p.contact_number ||
      p.emergency_contact_no ||
      p.emergency_contact ||
      p.mobile ||
      "",
  ).trim();
  if (code && phone && !phone.startsWith(code)) return `${code} ${phone}`;
  return phone;
};

export const formatDiseaseName = (val) => {
  if (!val && val !== 0) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    return val
      .map(formatDiseaseName)
      .filter(Boolean)
      .join(", ");
  }
  if (typeof val === "object") {
    return String(
      val.disease_name ||
        val.treatment_name ||
        val.treatment ||
        val.name ||
        val.title ||
        val.label ||
        val.disease ||
        ""
    ).trim();
  }
  return "";
};

export const normalizeCrmPatient = (p) => ({
  ...p,
  name: p.patient_name || p.name || p.patientName || "",
  displayId: p.patientNumber || p.patientId || p.patient_id || "",
  phone: getPatientFullPhone(p),
  country: p.country || p.nationality || "",
});

export const searchCrmPatients = async (query, { limit = 10 } = {}) => {
  const token = getToken();
  const res = await axios.get(`${baseurl}all_patients`, {
    params: { page: 1, limit, search: query },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return extractPatients(res.data).map(normalizeCrmPatient);
};

const patientKey = (p) =>
  String(p?._id || p?.id || p?.patientId || p?.patient_id || p?.displayId || "");

const patientLabel = (p) =>
  p ? p.name || p.patient_name || p.patientName || "" : "";

const patientDisplayId = (p) =>
  p ? p.displayId || p.patientNumber || p.patientId || p.patient_id || "" : "";

export default function PatientSearchSelect({
  value,
  onChange,
  searchFn = searchCrmPatients,
  placeholder = "Search by Name, Patient ID, Phone...",
  disabled = false,
  showSelectedId = true,
  minChars = MIN_CHARS,
  loadInitialOnFocus = false,
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const loadInitialList = async () => {
    setLoading(true);
    const seq = ++seqRef.current;
    try {
      const list = await searchFn("");
      if (seq !== seqRef.current) return;
      setOptions(Array.isArray(list) ? list : []);
    } catch (err) {
      if (seq !== seqRef.current) return;
      console.warn("Could not load initial patient list:", err);
      setOptions([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  };

  const runSearch = (text) => {
    const q = text.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < minChars) {
      seqRef.current += 1;
      if (loadInitialOnFocus && q.length === 0) {
        loadInitialList();
      } else {
        setOptions([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      try {
        const list = await searchFn(q);
        if (seq !== seqRef.current) return;
        setOptions(Array.isArray(list) ? list : []);
      } catch (err) {
        if (seq !== seqRef.current) return;
        console.error("Patient search error:", err);
        setOptions([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleSelect = (p) => {
    onChange?.(p);
    setTerm("");
    setOpen(false);
  };

  const selectedLabel = value
    ? `${patientLabel(value)}${
        showSelectedId && patientDisplayId(value)
          ? ` (${patientDisplayId(value)})`
          : ""
      }`
    : "";

  const q = term.trim();
  let emptyText = "";
  if (loading) emptyText = "Searching...";
  else if (q.length < minChars && options.length === 0)
    emptyText = `Type at least ${minChars} characters to search`;
  else if (options.length === 0) emptyText = `No patient found matching "${term}"`;

  const selectedKey = patientKey(value);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          height: "42px",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          background: disabled ? "#f8fafc" : "#ffffff",
          border: `1px solid ${open ? "#0284c7" : "#cbd5e1"}`,
          borderRadius: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: open ? "0 0 0 3px rgba(2, 132, 199, 0.15)" : "none",
        }}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <i
          className="fa fa-search"
          style={{ color: "#94a3b8", fontSize: "13px", marginRight: "8px" }}
        />
        <input
          ref={inputRef}
          type="text"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "13.5px",
            color: "#0f172a",
            padding: 0,
            cursor: disabled ? "not-allowed" : "text",
          }}
          placeholder={placeholder}
          value={open ? term : selectedLabel}
          onFocus={() => {
            setOpen(true);
            setTerm("");
            if (loadInitialOnFocus) {
              loadInitialList();
            } else {
              setOptions([]);
            }
          }}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
            runSearch(e.target.value);
          }}
          autoComplete="off"
          disabled={disabled}
        />
        {loading && (
          <span
            className="spinner-border spinner-border-sm text-primary"
            role="status"
            style={{ width: "14px", height: "14px", marginLeft: "6px" }}
          />
        )}
        {(term || (value && !open)) && !disabled && (
          <button
            type="button"
            style={{
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              fontSize: "18px",
              lineHeight: 1,
              padding: "0 6px",
              cursor: "pointer",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (term) {
                setTerm("");
                setOptions([]);
                inputRef.current?.focus();
              } else {
                onChange?.(null);
              }
            }}
            tabIndex={-1}
            title="Clear"
          >
            ×
          </button>
        )}
        <i
          className={`fa fa-chevron-${open ? "up" : "down"}`}
          style={{ color: "#64748b", fontSize: "11px", marginLeft: "8px" }}
        />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow:
              "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
            zIndex: 1050,
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {emptyText ? (
            <div
              style={{
                padding: "12px 16px",
                fontSize: "13px",
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              {emptyText}
            </div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {options.map((p, idx) => {
                const key = patientKey(p) || `p-${idx}`;
                const isSelected = !!(selectedKey && key === selectedKey);
                const phone = p.phone && p.phone !== "-" ? p.phone : "";
                const displayId = patientDisplayId(p);
                return (
                  <div
                    key={key}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(p);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                      backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span
                          className="fw-semibold"
                          style={{
                            fontSize: "13.5px",
                            color: "#1e293b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {patientLabel(p) || "N/A"}
                        </span>
                        {displayId && (
                          <span
                            style={{
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              fontSize: "11px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            {displayId}
                          </span>
                        )}
                        {p.assignedPhysiotherapist?.name && (
                          <span
                            style={{
                              backgroundColor: "#ecfdf5",
                              color: "#065f46",
                              border: "1px solid #a7f3d0",
                              fontSize: "11px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <i className="fa-solid fa-user-doctor" style={{ fontSize: "10px" }} />
                            {p.assignedPhysiotherapist.name}
                          </span>
                        )}
                        {Boolean(formatDiseaseName(p.displayDisease || p.disease || p.patient_disease)) && (
                          <span
                            style={{
                              backgroundColor: "#fef3c7",
                              color: "#92400e",
                              border: "1px solid #fde68a",
                              fontSize: "10.5px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {formatDiseaseName(p.displayDisease || p.disease || p.patient_disease)}
                          </span>
                        )}
                        {p.source && !p.assignedPhysiotherapist && (
                          <span
                            style={{
                              backgroundColor: "#f8fafc",
                              color: "#64748b",
                              border: "1px solid #e2e8f0",
                              fontSize: "10px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            {p.source}
                          </span>
                        )}
                      </div>
                      {(phone || p.country) && (
                        <div
                          className="d-flex align-items-center gap-3 mt-1"
                          style={{ fontSize: "11.5px", color: "#64748b" }}
                        >
                          {phone && (
                            <span>
                              <i className="fa fa-phone me-1" style={{ fontSize: "10px" }} />
                              {phone}
                            </span>
                          )}
                          {p.country && (
                            <span>
                              <i className="fa fa-globe me-1" style={{ fontSize: "10px" }} />
                              {p.country}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {isSelected && <i className="fa fa-check text-primary ms-2" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
