import React, { useState, useEffect, useMemo, useCallback } from "react";
import Swal from "sweetalert2";
import {
  fetchGHPatientServices,
  fetchGHServicesList,
  deleteGHRecord,
  GH_STATUSES,
} from "../../../services/guestHouseServicesApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";
import { searchCrmPatients } from "../../../components/PatientSearchSelect";
import CreateGHServiceModal from "../../GuestHouseServices/components/CreateGHServiceModal";
import AddServicesModal from "../../GuestHouseServices/components/AddServicesModal";
import AddPaymentModal from "../../GuestHouseServices/components/AddPaymentModal";
import EditStayInfoModal from "../../GuestHouseServices/components/EditStayInfoModal";
import GHDetailsModal from "../../GuestHouseServices/components/GHDetailsModal";
import "../../GuestHouseServices/GuestHouseServices.css";

const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
};

const calculateNights = (fromStr, toStr) => {
  if (!fromStr || !toStr) return null;
  try {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const diffTime = to.getTime() - from.getTime();
    if (diffTime <= 0) return 1;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
};

const getStatusBadge = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "completed") {
    return (
      <span className="badge bg-success text-white fw-bold px-2 py-1">
        <i className="fa fa-check-circle me-1" /> Completed
      </span>
    );
  }
  if (s === "closed") {
    return (
      <span className="badge bg-secondary text-white fw-bold px-2 py-1">
        Closed
      </span>
    );
  }
  if (s === "in-process" || s === "active") {
    return (
      <span className="badge bg-primary text-white fw-bold px-2 py-1">
        <i className="fa fa-clock me-1" /> In-Process
      </span>
    );
  }
  return (
    <span className="badge bg-warning text-dark fw-bold px-2 py-1">
      {status || "Pending"}
    </span>
  );
};

export default function PatientGuestHouseTab({ patient, patientId, userId }) {
  const isReferral = isReferralUser() || isInsuranceUser();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fetchedPatient, setFetchedPatient] = useState(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [editStayOpen, setEditStayOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  // Resolved MySQL user ID (e.g. 2109, NEVER OMCA26091030)
  const effectiveUserId = useMemo(() => {
    const raw =
      userId ||
      patient?.user_id ||
      patient?.userId ||
      (patient?.id && !String(patient.id).toUpperCase().startsWith("OMCA") ? patient.id : "") ||
      (patient?._id && !String(patient._id).toUpperCase().startsWith("OMCA") ? patient._id : "") ||
      (patientId && !String(patientId).toUpperCase().startsWith("OMCA") ? patientId : "") ||
      sessionStorage.getItem("patient_detail_userId") ||
      fetchedPatient?.user_id ||
      "";
    return String(raw || "").trim();
  }, [userId, patient, patientId, fetchedPatient]);

  // Resolved patient code / identifier (e.g. "OMCA26091030")
  const effectivePatientCode = useMemo(() => {
    return String(
      patientId ||
        patient?.patientNumber ||
        patient?.patientId ||
        patient?.patient_id ||
        (patient?.id && String(patient.id).toUpperCase().startsWith("OMCA") ? patient.id : "") ||
        fetchedPatient?.patientNumber ||
        fetchedPatient?.patientId ||
        fetchedPatient?.displayId ||
        ""
    ).trim();
  }, [patientId, patient, fetchedPatient]);

  // Combined fallback patient ID
  const effectivePatientId = useMemo(() => {
    return effectiveUserId || effectivePatientCode || "";
  }, [effectiveUserId, effectivePatientCode]);

  // Auto-resolve patient details if name is missing from passed patient prop
  useEffect(() => {
    const currentName =
      patient?.patient_name ||
      patient?.name ||
      patient?.patientName ||
      patient?.patient_fullname ||
      patient?.fullname;
    if (currentName && String(currentName).trim().toLowerCase() !== "patient") {
      return;
    }

    const idToSearch = effectivePatientCode || effectiveUserId || patientId || userId;
    if (!idToSearch) return;

    let cancelled = false;
    searchCrmPatients(String(idToSearch), { limit: 5 })
      .then((results) => {
        if (cancelled) return;
        const match =
          results.find(
            (r) =>
              String(r.patientNumber || r.patientId || r.displayId || "").toLowerCase() ===
                String(idToSearch).toLowerCase() ||
              String(r.user_id || r.id || r._id || "") === String(idToSearch)
          ) || results[0];
        if (match && match.name && match.name.trim().toLowerCase() !== "patient") {
          setFetchedPatient(match);
        }
      })
      .catch((err) => {
        console.warn("Could not auto-fetch patient details for guest house tab:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [patient, effectivePatientCode, effectiveUserId, patientId, userId]);

  const patientName = useMemo(() => {
    const raw =
      patient?.patient_name ||
      patient?.name ||
      patient?.patientName ||
      patient?.patient_fullname ||
      patient?.fullname ||
      patient?.enq_userName ||
      fetchedPatient?.name ||
      fetchedPatient?.patient_name ||
      "";
    if (raw && raw.trim() && raw.trim().toLowerCase() !== "patient") {
      return raw.trim();
    }
    return raw?.trim() || "";
  }, [patient, fetchedPatient]);

  const prefilledPatientObj = useMemo(() => {
    const rawPhone =
      patient?.contact_no ||
      patient?.emergency_contact_no ||
      patient?.phone ||
      patient?.mobile ||
      patient?.contact_number ||
      fetchedPatient?.phone ||
      "";
    const phoneCode = patient?.phoneCode || patient?.dial_code || "";
    const fullPhone =
      phoneCode && rawPhone && !String(rawPhone).trim().startsWith(phoneCode)
        ? `${phoneCode} ${rawPhone}`.trim()
        : String(rawPhone || "").trim();

    const trtId =
      patient?.treatment_id ||
      patient?.treatmentId ||
      (Array.isArray(patient?.treatments) && patient.treatments[0]?.treatment_id) ||
      fetchedPatient?.treatment_id ||
      "";

    return {
      _id: effectiveUserId || patient?._id || fetchedPatient?._id || effectivePatientCode,
      user_id: effectiveUserId ? (Number(effectiveUserId) || effectiveUserId) : fetchedPatient?.user_id,
      patientId: effectivePatientCode || patient?.patientId || fetchedPatient?.patientId || effectiveUserId,
      patientNumber: patient?.patientNumber || effectivePatientCode || fetchedPatient?.patientNumber || effectiveUserId,
      displayId: effectivePatientCode || patient?.patientNumber || fetchedPatient?.displayId || effectiveUserId,
      name: patientName,
      patient_name: patientName,
      phone: fullPhone,
      country: patient?.country || patient?.nationality || fetchedPatient?.country || "",
      treatment_id: trtId,
      email: patient?.email || patient?.enq_email || fetchedPatient?.email || "",
      passport_number:
        patient?.passport_number ||
        patient?.passportNo ||
        patient?.passport ||
        fetchedPatient?.passport_number ||
        "",
      raw: patient || fetchedPatient,
    };
  }, [patient, fetchedPatient, effectiveUserId, effectivePatientCode, patientName]);

  // Load records for this patient
  const loadPatientBookings = useCallback(async () => {
    setLoading(true);
    try {
      let matched = [];

      // 1. Try patient endpoint (prefer MySQL numeric user_id)
      const targetUserId =
        effectiveUserId ||
        (effectivePatientCode && !effectivePatientCode.toUpperCase().startsWith("OMCA") ? effectivePatientCode : "");
      const directId = targetUserId || effectivePatientCode;

      if (directId) {
        try {
          const directRes = await fetchGHPatientServices(directId);
          const list = Array.isArray(directRes)
            ? directRes
            : Array.isArray(directRes?.data)
            ? directRes.data
            : [];
          if (list.length > 0) {
            matched = list;
          }
        } catch (e) {
          console.warn("Direct patient fetch had an issue, falling back to full list:", e);
        }
      }

      // 2. Also check list endpoint: pass user_id from MySQL ID (e.g. 2109, not OMCA26091030)
      if (matched.length === 0) {
        const listParams = { limit: 10 };
        if (targetUserId) {
          listParams.user_id = targetUserId;
        }

        const listRes = await fetchGHServicesList(listParams);
        const all = Array.isArray(listRes?.data) ? listRes.data : [];

        const uIdLower = targetUserId.toLowerCase();
        const pCodeLower = effectivePatientCode.toLowerCase();
        const pNameLower = patientName.toLowerCase();

        matched = all.filter((r) => {
          const rUserId = String(r.user_id || "").toLowerCase();
          const rPatientId = String(r.patientId || r.patient_id || "").toLowerCase();
          const rPatientName = String(r.name || r.patient_name || "").toLowerCase();

          return (
            (uIdLower && rUserId === uIdLower) ||
            (pCodeLower && (rUserId === pCodeLower || rPatientId === pCodeLower)) ||
            (pNameLower && rPatientName.includes(pNameLower))
          );
        });
      }

      setRecords(matched);
    } catch (err) {
      console.error("Error loading patient guest house bookings:", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, effectivePatientCode, patientName]);

  useEffect(() => {
    loadPatientBookings();
  }, [loadPatientBookings]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalRecords = records.length;
    const activeRecords = records.filter(
      (r) => String(r.status).toLowerCase() === "in-process" || String(r.status).toLowerCase() === "active"
    ).length;
    const completedRecords = records.filter(
      (r) => String(r.status).toLowerCase() === "completed"
    ).length;
    const totalBilling = records.reduce(
      (sum, r) => sum + (Number(r.services_final_amount !== undefined ? r.services_final_amount : (r.final_amount || r.totalAmount || 0))),
      0
    );
    const totalPaid = records.reduce(
      (sum, r) => sum + (Number(r.services_paid_amount !== undefined ? r.services_paid_amount : (r.paidAmount || 0))),
      0
    );
    const totalDue = records.reduce(
      (sum, r) => sum + (Number(r.services_due_amount !== undefined ? r.services_due_amount : (r.dueAmount || 0))),
      0
    );
    const totalServicesCount = records.reduce(
      (sum, r) => sum + (r.services_count !== undefined ? r.services_count : (r.services?.length || 0)),
      0
    );

    return {
      totalRecords,
      activeRecords,
      completedRecords,
      totalBilling,
      totalPaid,
      totalDue,
      totalServicesCount,
    };
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (statusFilter !== "ALL" && String(r.status).toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Keyword search
      if (searchTerm.trim()) {
        const s = searchTerm.trim().toLowerCase();
        const idMatch = String(r.booking_id || r.guestHouseServiceId || r.id || r._id || "").toLowerCase().includes(s);
        const ghMatch = String(r.guest_house_name || r.guestHouseName || "").toLowerCase().includes(s);
        const roomMatch = String(r.guest_house_room_type || r.roomNumber || "").toLowerCase().includes(s);
        const notesMatch = String(r.notes || "").toLowerCase().includes(s);
        const svcMatch = r.services?.some((item) =>
          String(item.service_name || item.serviceName || "").toLowerCase().includes(s)
        );
        return idMatch || ghMatch || roomMatch || notesMatch || svcMatch;
      }

      return true;
    });
  }, [records, statusFilter, searchTerm]);

  // Handlers for modal actions
  const handleOpenDetails = (rec) => {
    setSelectedRecord(rec);
    setSelectedRecordId(rec?.booking_id || rec?.id || rec?._id || rec?.guestHouseServiceId);
    setDetailsModalOpen(true);
  };

  const handleOpenAddServices = (rec) => {
    if (isReferral) return;
    setSelectedRecord(rec);
    setAddServicesOpen(true);
  };

  const handleOpenAddPayment = (rec) => {
    if (isReferral) return;
    setSelectedRecord(rec);
    setAddPaymentOpen(true);
  };

  const handleOpenEditStay = (rec) => {
    if (isReferral) return;
    setSelectedRecord(rec);
    setEditStayOpen(true);
  };

  const handleDeleteBooking = async (rec) => {
    if (isReferral) return;
    const id = rec?.booking_id || rec?.id || rec?._id || rec?.guestHouseServiceId;
    const result = await Swal.fire({
      title: "Clear All Services?",
      text: `Are you sure you want to remove all add-on services and payments for ${rec?.booking_id || `Booking #${rec?.id}`}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Clear Services",
    });

    if (result.isConfirmed) {
      try {
        await deleteGHRecord(id);
        Swal.fire("Cleared", "Add-on services and payments cleared.", "success");
        loadPatientBookings();
      } catch (err) {
        Swal.fire("Error", "Failed to clear services.", "error");
      }
    }
  };

  return (
    <div className="patient-gh-tab-wrap" style={{ padding: "8px 0" }}>
      {/* Top Banner & Header */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 bg-white rounded border mb-3 shadow-sm">
        <div className="d-flex align-items-center gap-3">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(11, 166, 223, 0.12)",
              color: "#0ba6df",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            <i className="fa-solid fa-hotel" />
          </div>
          <div>
            <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "16px" }}>
              Guest House Bookings & Added Services
            </h5>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="badge bg-primary-light text-primary" style={{ fontSize: "11px" }}>
                Patient: {patientName} (ID: {effectivePatientId || "N/A"})
              </span>
              {patient?.treatment_id && (
                <span className="badge bg-light text-muted border" style={{ fontSize: "11px" }}>
                  Treatment: {patient.treatment_id}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={loadPatientBookings}
            disabled={loading}
            title="Refresh bookings"
            style={{ borderRadius: "8px" }}
          >
            <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`} />
          </button>
          {!isReferral && (
          <button
            type="button"
            className="btn btn-sm btn-primary fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setCreateModalOpen(true)}
            style={{
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "13px",
              backgroundColor: "#0284c7",
              borderColor: "#0284c7",
            }}
          >
            <i className="fa fa-plus me-1" />
            New Booking
          </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="row g-2 mb-3">
        <div className="col-lg-2 col-md-4 col-6">
          <div className="gh-stat-card-custom p-2">
            <div className="gh-stat-icon-wrapper gh-stat-icon-blue" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
              <i className="fa fa-bed" />
            </div>
            <div>
              <div className="gh-stat-value" style={{ fontSize: "17px" }}>{stats.totalRecords}</div>
              <div className="gh-stat-label" style={{ fontSize: "11.5px" }}>Total Stays</div>
            </div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-6">
          <div className="gh-stat-card-custom p-2">
            <div className="gh-stat-icon-wrapper gh-stat-icon-emerald" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
              <i className="fa fa-check" />
            </div>
            <div>
              <div className="gh-stat-value" style={{ fontSize: "17px" }}>{stats.activeRecords}</div>
              <div className="gh-stat-label" style={{ fontSize: "11.5px" }}>Active Stays</div>
            </div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-6">
          <div className="gh-stat-card-custom p-2">
            <div className="gh-stat-icon-wrapper gh-stat-icon-purple" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
              <i className="fa fa-concierge-bell" />
            </div>
            <div>
              <div className="gh-stat-value" style={{ fontSize: "17px" }}>{stats.totalServicesCount}</div>
              <div className="gh-stat-label" style={{ fontSize: "11.5px" }}>Services Added</div>
            </div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-6">
          <div className="gh-stat-card-custom p-2">
            <div className="gh-stat-icon-wrapper gh-stat-icon-indigo" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
              <i className="fa fa-file-invoice-dollar" />
            </div>
            <div>
              <div className="gh-stat-value" style={{ fontSize: "17px" }}>{formatCurrency(stats.totalBilling)}</div>
              <div className="gh-stat-label" style={{ fontSize: "11.5px" }}>Services Billed</div>
            </div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-6">
          <div className="gh-stat-card-custom p-2">
            <div className="gh-stat-icon-wrapper gh-stat-icon-emerald" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
              <i className="fa fa-money" />
            </div>
            <div>
              <div className="gh-stat-value" style={{ fontSize: "17px" }}>{formatCurrency(stats.totalPaid)}</div>
              <div className="gh-stat-label" style={{ fontSize: "11.5px" }}>Services Paid</div>
            </div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-6">
          <div className="gh-stat-card-custom p-2">
            <div className="gh-stat-icon-wrapper gh-stat-icon-rose" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
              <i className="fa fa-exclamation-circle" />
            </div>
            <div>
              <div className="gh-stat-value text-danger" style={{ fontSize: "17px" }}>
                {formatCurrency(stats.totalDue)}
              </div>
              <div className="gh-stat-label" style={{ fontSize: "11.5px" }}>Services Due</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-2 mb-3 bg-white border shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-md-6 col-12">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="fa fa-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by Booking ID, Guest House, Room, or Service name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSearchTerm("")}
                >
                  <i className="fa fa-times" />
                </button>
              )}
            </div>
          </div>

          <div className="col-md-3 col-6">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {GH_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === "ALL" ? "All Statuses" : st}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3 col-6 text-end">
            <span className="text-muted small">
              Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong> stays
            </span>
          </div>
        </div>
      </div>

      {/* Bookings & Services Table */}
      <div className="card border rounded shadow-sm bg-white overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
            <thead className="table-light">
              <tr style={{ color: "#475569", fontWeight: "600" }}>
                <th style={{ width: "50px" }} className="text-center">#</th>
                <th>Booking ID</th>
                <th>Guest House & Room</th>
                <th>Stay Period</th>
                <th>Add-On Services</th>
                <th>Services Billed & Due</th>
                <th>Status</th>
                <th style={{ width: "160px" }} className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="mt-2 text-muted small">Loading patient guest house bookings...</div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div style={{ color: "#94a3b8" }}>
                      <i className="fa-solid fa-hotel fs-1 d-block mb-2 text-muted" />
                      <h6 className="fw-bold text-dark mb-1">No Guest House Bookings Found</h6>
                      <p className="small text-muted mb-3">
                        {records.length === 0
                          ? "This patient does not have any guest house stays or services booked yet."
                          : "No bookings match your search / filter criteria."}
                      </p>
                      {!isReferral && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary fw-bold"
                        onClick={() => setCreateModalOpen(true)}
                        style={{ borderRadius: "6px" }}
                      >
                        <i className="fa fa-plus me-1" /> New Booking
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const servicesList = Array.isArray(rec.services) ? rec.services : [];
                  const sCount = rec.services_count !== undefined ? rec.services_count : servicesList.length;
                  const fromDate = rec.checkin || rec.stayDateRangeFrom || rec.stayDateRange?.from;
                  const toDate = rec.checkout || rec.stayDateRangeTo || rec.stayDateRange?.to;
                  const nights = calculateNights(fromDate, toDate);
                  const roomCost = Number(
                    rec.room_amount !== undefined
                      ? rec.room_amount
                      : rec.room_payment_amount !== undefined
                      ? rec.room_payment_amount
                      : rec.payment_amount || 0
                  );
                  const roomPaid = Number(rec.room_paid_amount || 0);
                  const roomDue = Number(
                    rec.room_due_amount !== undefined
                      ? rec.room_due_amount
                      : Math.max(0, roomCost - roomPaid)
                  );

                  const svcCost = Number(
                    rec.services_final_amount !== undefined
                      ? rec.services_final_amount
                      : rec.final_services_cost !== undefined
                      ? rec.final_services_cost
                      : rec.services_total_amount !== undefined
                      ? rec.services_total_amount
                      : rec.final_amount || rec.totalAmount || 0
                  );
                  const svcPaid = Number(rec.services_paid_amount || 0);
                  const svcDue = Number(
                    rec.services_due_amount !== undefined
                      ? rec.services_due_amount
                      : Math.max(0, svcCost - svcPaid)
                  );

                  const total = Number(
                    rec.total_billed_amount !== undefined
                      ? rec.total_billed_amount
                      : roomCost + svcCost
                  );
                  const paid = Number(
                    rec.total_paid_amount !== undefined
                      ? rec.total_paid_amount
                      : roomPaid + svcPaid
                  );
                  const due = Number(
                    rec.total_due_amount !== undefined
                      ? rec.total_due_amount
                      : Math.max(0, total - paid)
                  );
                  const bCode = rec.booking_id || (rec.id ? `GH-${rec.id}` : rec.guestHouseServiceId);

                  return (
                    <tr key={rec.id || rec.booking_id || rec._id || idx}>
                      <td className="text-center text-muted fw-bold">{idx + 1}</td>

                      {/* Booking ID */}
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "5px 8px",
                            cursor: "pointer",
                          }}
                          onClick={() => handleOpenDetails(rec)}
                          title="Click to view full details"
                        >
                          <i className="fa fa-hashtag me-1 opacity-75" />
                          {bCode}
                        </span>
                        {rec.created_at && (
                          <div className="text-muted" style={{ fontSize: "11px", marginTop: "2px" }}>
                            Booked: {formatDate(rec.created_at)}
                          </div>
                        )}
                      </td>

                      {/* Guest House & Room */}
                      <td>
                        <div className="fw-bold text-dark d-flex align-items-center gap-1">
                          <i className="fa-solid fa-building text-primary opacity-75" style={{ fontSize: "11px" }} />
                          {rec.guest_house_name || rec.guestHouseName || "Guest House"}
                        </div>
                        <div className="small text-muted mt-1 d-flex align-items-center gap-2">
                          <span className="badge bg-light text-dark border" style={{ fontSize: "11px" }}>
                            {rec.guest_house_room_type || rec.roomNumber ? `Room: ${rec.guest_house_room_type || rec.roomNumber}` : "Room Assigned"}
                          </span>
                        </div>
                      </td>

                      {/* Stay Period */}
                      <td>
                        <div className="d-flex align-items-center gap-1" style={{ fontSize: "12.5px" }}>
                          <i className="fa fa-calendar-check-o text-muted me-1" />
                          <span>{formatDate(fromDate)}</span>
                          <span className="text-muted">→</span>
                          <span>{formatDate(toDate)}</span>
                        </div>
                        {nights && (
                          <span
                            className="badge bg-light text-secondary border mt-1"
                            style={{ fontSize: "10.5px" }}
                          >
                            <i className="fa fa-moon-o me-1" />
                            {nights} Night{nights > 1 ? "s" : ""} Stay
                          </span>
                        )}
                      </td>

                      {/* Services Added */}
                      <td>
                        <div className="d-flex align-items-center gap-1 flex-wrap mb-1">
                          {sCount > 0 ? (
                            <span
                              className="badge bg-primary text-white fw-bold"
                              style={{ fontSize: "11.5px" }}
                            >
                              <i className="fa fa-concierge-bell me-1" />
                              {sCount} Service{sCount !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="badge bg-light text-muted border" style={{ fontSize: "11px" }}>
                              No Add-ons
                            </span>
                          )}
                        </div>
                        {servicesList.length > 0 && (
                          <div className="d-flex flex-wrap gap-1" style={{ maxWidth: "260px" }}>
                            {servicesList.slice(0, 3).map((svc, sIdx) => (
                              <span
                                key={svc.id || svc._id || sIdx}
                                className="badge bg-light text-dark border text-truncate"
                                style={{ fontSize: "10.5px", maxWidth: "160px" }}
                                title={`${svc.service_name || svc.serviceName} - ${formatCurrency(svc.final_price || svc.unit_price || svc.price)}`}
                              >
                                {svc.service_name || svc.serviceName}
                                {svc.quantity > 1 ? ` (${svc.quantity}x)` : ""}
                              </span>
                            ))}
                            {servicesList.length > 3 && (
                              <span
                                className="badge bg-light text-primary border"
                                style={{ fontSize: "10.5px", cursor: "pointer" }}
                                onClick={() => handleOpenDetails(rec)}
                              >
                                +{servicesList.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Billing & Dues */}
                      <td>
                        <div className="fw-bold text-dark" style={{ fontSize: "13.5px" }}>
                          {formatCurrency(total)}
                        </div>
                        <div
                          className="text-muted"
                          style={{ fontSize: "10.5px" }}
                          title={`Room Due: ${formatCurrency(roomDue)} • Services Due: ${formatCurrency(svcDue)}`}
                        >
                          Room: {formatCurrency(roomCost)} • Svc: {formatCurrency(svcCost)}
                        </div>
                        <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: "11px" }}>
                          <span className="text-success fw-bold">
                            Paid: {formatCurrency(paid)}
                          </span>
                          <span className={`fw-bold ${due > 0 ? "text-danger" : "text-muted"}`}>
                            Due: {formatCurrency(due)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <div>{getStatusBadge(rec.status)}</div>
                        {rec.overall_payment_status && (
                          <div className="mt-1">
                            <span
                              className={`badge ${
                                String(rec.overall_payment_status).toLowerCase() === "paid"
                                  ? "bg-success"
                                  : String(rec.overall_payment_status).toLowerCase() === "partial"
                                  ? "bg-info text-white"
                                  : "bg-warning text-dark"
                              }`}
                              style={{ fontSize: "10px" }}
                            >
                              {rec.overall_payment_status}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-center">
                        <div className="d-inline-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleOpenDetails(rec)}
                            title="View Details"
                            style={{ padding: "4px 8px" }}
                          >
                            <i className="fa fa-eye" />
                          </button>

                          {!isReferral && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleOpenAddPayment(rec)}
                                title="Add Payment"
                                style={{ padding: "4px 8px" }}
                              >
                                <i className="fa fa-credit-card" />
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleOpenAddServices(rec)}
                                title="Add Services"
                                style={{ padding: "4px 8px" }}
                              >
                                <i className="fa fa-plus" />
                              </button>

                              {sCount > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeleteBooking(rec)}
                                  title="Clear Add-on Services"
                                  style={{ padding: "4px 8px" }}
                                >
                                  <i className="fa fa-trash" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <CreateGHServiceModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        prefilledPatient={prefilledPatientObj}
        onSuccess={loadPatientBookings}
      />

      <GHDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        recordId={selectedRecordId}
        onRecordUpdated={loadPatientBookings}
      />

      <AddServicesModal
        open={addServicesOpen}
        onClose={() => setAddServicesOpen(false)}
        record={selectedRecord}
        onSuccess={loadPatientBookings}
      />

      <AddPaymentModal
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        record={selectedRecord}
        onSuccess={loadPatientBookings}
      />

      <EditStayInfoModal
        open={editStayOpen}
        onClose={() => setEditStayOpen(false)}
        record={selectedRecord}
        onSuccess={loadPatientBookings}
      />
    </div>
  );
}
