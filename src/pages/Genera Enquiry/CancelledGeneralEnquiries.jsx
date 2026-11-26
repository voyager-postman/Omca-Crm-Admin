import React, { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { testForms } from "../../reducer/FormsEnquiry";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TableSortLabel from "@mui/material/TableSortLabel";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Pagination,
  Stack,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogContent,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import axios from "axios";
import { AdminBaseUrl } from "../../Basurl/Baseurl";
import Swal from "sweetalert2";

const CATEGORY_CONFIG = {
  medical_visa: {
    label: "Medical Visa",
    model: "Medical",
    badgeBg: "#e0f2fe",
    badgeColor: "#0369a1",
  },
  stay: {
    label: "Guest House/Stay",
    model: "Story",
    badgeBg: "#dcfce7",
    badgeColor: "#15803d",
  },
  flight: {
    label: "Flight Service",
    model: "Flight",
    badgeBg: "#f3e8ff",
    badgeColor: "#7e22ce",
  },
  pickup: {
    label: "Pickup & Drop",
    model: "Pickup",
    badgeBg: "#fef3c7",
    badgeColor: "#b45309",
  },
  home_care: {
    label: "Home Care",
    model: "HomeCareRequest",
    badgeBg: "#ccfbf1",
    badgeColor: "#0f766e",
  },
  test_form: {
    label: "Medical Tests & Scans",
    model: "LabTest",
    badgeBg: "#e0e7ff",
    badgeColor: "#4338ca",
  },
  contact_us: {
    label: "Contact Us",
    model: "PatientContactEnquiry",
    badgeBg: "#ffe4e6",
    badgeColor: "#be123c",
  },
};

const isCancelledStatus = (status) => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === "cancel" || s === "cancelled";
};

export default function CancelledGeneralEnquiries({ dateRange }) {
  const isReferral = (localStorage.getItem("Role") || "").toUpperCase() === "REFERRAL";
  const dispatch = useDispatch();
  const { testForms: formData, loading, error } = useSelector(
    (state) => state.testForms || {}
  );

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("date");
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  // View modal state
  const [open, setOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (!formData?.data) {
      dispatch(testForms());
    }
  }, [dispatch, formData?.data]);

  // Aggregate all cancelled enquiries from all categories
  const allCancelledRecords = useMemo(() => {
    const rawData = formData?.data || {};
    const records = [];

    Object.entries(CATEGORY_CONFIG).forEach(([key, config]) => {
      const items = Array.isArray(rawData[key]) ? rawData[key] : [];
      items.forEach((item) => {
        if (isCancelledStatus(item?.status)) {
          const name =
            item.name ||
            `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
            item.patient_name ||
            item.applying_for ||
            "—";
          const email =
            item.email || item.email_id || item.email_address || "—";
          const phone =
            item.phone ||
            item.phone_number ||
            item.mobile ||
            item.contact_number ||
            "—";
          const rawDate =
            item.created_at ||
            item.createdAt ||
            item.date ||
            item.select_date ||
            item.travel_date;

          records.push({
            ...item,
            _id: item.id || item._id,
            _categoryKey: key,
            _categoryLabel: config.label,
            _model: config.model,
            _badgeBg: config.badgeBg,
            _badgeColor: config.badgeColor,
            _name: name,
            _email: email,
            _phone: phone,
            _rawDate: rawDate,
          });
        }
      });
    });

    return records;
  }, [formData]);

  // Date Range + Text Search Filter
  const filteredData = useMemo(() => {
    let result = allCancelledRecords;

    // Apply Date Range
    if (dateRange?.startDate) {
      const startTs = new Date(`${dateRange.startDate}T00:00:00`).getTime();
      if (!isNaN(startTs)) {
        result = result.filter((item) => {
          if (!item._rawDate) return false;
          const ts = new Date(item._rawDate).getTime();
          return !isNaN(ts) && ts >= startTs;
        });
      }
    }

    if (dateRange?.endDate) {
      const endTs = new Date(`${dateRange.endDate}T23:59:59.999`).getTime();
      if (!isNaN(endTs)) {
        result = result.filter((item) => {
          if (!item._rawDate) return false;
          const ts = new Date(item._rawDate).getTime();
          return !isNaN(ts) && ts <= endTs;
        });
      }
    }

    // Text Search
    if (filterValue.trim()) {
      const search = filterValue.trim().toLowerCase();
      result = result.filter((item) => {
        return (
          item._name?.toLowerCase().includes(search) ||
          item._email?.toLowerCase().includes(search) ||
          String(item._phone)?.toLowerCase().includes(search) ||
          item._categoryLabel?.toLowerCase().includes(search) ||
          item.country?.toLowerCase().includes(search) ||
          item.city?.toLowerCase().includes(search)
        );
      });
    }

    return result;
  }, [allCancelledRecords, dateRange, filterValue]);

  // Sorting
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (!orderBy) return 0;

      if (orderBy === "date") {
        const timeA = new Date(a._rawDate || 0).getTime();
        const timeB = new Date(b._rawDate || 0).getTime();
        return order === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (orderBy === "name") {
        const valA = (a._name || "").toLowerCase();
        const valB = (b._name || "").toLowerCase();
        return order === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (orderBy === "category") {
        const valA = (a._categoryLabel || "").toLowerCase();
        const valB = (b._categoryLabel || "").toLowerCase();
        return order === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return 0;
    });
  }, [filteredData, orderBy, order]);

  // Pagination
  const paginatedData = useMemo(() => {
    return sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };

  const handleView = (record) => {
    setSelectedRecord(record);
    setOpen(true);
  };

  const handleStatusChange = async (e, record) => {
    if (isReferral) return;
    const newStatus = e.target.value;

    const result = await Swal.fire({
      title: "Change Status?",
      text: `Move this cancelled enquiry back to "${newStatus}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, update",
    });

    if (!result.isConfirmed) return;

    try {
      const payload = {
        id: record._id,
        model: record._model,
        status: newStatus,
      };

      const response = await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        payload
      );

      dispatch(testForms());
      if (response?.data?.success) {
        Swal.fire("Success", `Status changed to ${newStatus}. Enquiry moved to active tab.`, "success");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };

  return (
    <>
      {loading && <p>Loading...</p>}
      {error && (
        <p style={{ color: "red" }}>
          {typeof error === "string" ? error : error?.message || "Something went wrong"}
        </p>
      )}

      <div className="country-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div className="topmainhd mb-0">
          <h6>Cancelled General Enquiries ({filteredData.length})</h6>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <TextField
            label="Search Cancelled Enquiries"
            size="small"
            value={filterValue}
            onChange={(e) => {
              setFilterValue(e.target.value);
              setPage(0);
            }}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {filterValue && (
                    <IconButton
                      onClick={() => {
                        setFilterValue("");
                        setPage(0);
                      }}
                    >
                      <ClearIcon />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
          />
        </div>
      </div>

      <div className="table-responsive">
        <TableContainer component={Paper} style={{ overflowX: "auto" }}>
          <Table stickyHeader aria-label="cancelled enquiries table" className="table-no-card">
            <TableHead>
              <TableRow>
                <TableCell>Sr.No.</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "name"}
                    direction={orderBy === "name" ? order : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "category"}
                    direction={orderBy === "category" ? order : "asc"}
                    onClick={() => handleSort("category")}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>
                <TableCell>Contact Info</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "date"}
                    direction={orderBy === "date" ? order : "asc"}
                    onClick={() => handleSort("date")}
                  >
                    Date / Time
                  </TableSortLabel>
                </TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <TableRow key={item._id || idx}>
                    <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell
                      style={{ cursor: "pointer" }}
                      onClick={() => handleView(item)}
                      title="Click to view details"
                    >
                      <span
                        style={{ color: "#0284c7", fontWeight: 600 }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {item._name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: item._badgeBg,
                          color: item._badgeColor,
                        }}
                      >
                        {item._categoryLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div style={{ fontSize: "12px" }}>
                        <div><strong>Phone:</strong> {item._phone}</div>
                        <div><strong>Email:</strong> {item._email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item._rawDate ? (
                        <>
                          <div>
                            {new Date(item._rawDate).toLocaleDateString("en-GB")}
                          </div>
                          <div style={{ fontSize: "11px", color: "#666" }}>
                            {new Date(item._rawDate).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={item.status || "Cancel"}
                          onChange={(e) => handleStatusChange(e, item)}
                          disabled={isReferral}
                          className="status-direct"
                          sx={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#b91c1c",
                          }}
                        >
                          <MenuItem value="Cancel">Cancel</MenuItem>
                          <MenuItem value="Pending">Pending</MenuItem>
                          <MenuItem value="In-Process">In-Process</MenuItem>
                          <MenuItem value="Completed">Completed</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell align="center">
                      <div className="action-icon">
                        <VisibilityIcon
                          className="eye-icon"
                          style={{ cursor: "pointer", color: "#0284c7" }}
                          titleAccess="View Details"
                          onClick={() => handleView(item)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" style={{ padding: "30px", color: "#6b7280" }}>
                    No Cancelled Enquiries Found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Stack spacing={2} alignItems="end" marginTop={2}>
          <Pagination
            count={Math.max(1, Math.ceil(filteredData.length / rowsPerPage))}
            page={page + 1}
            onChange={(event, value) => setPage(value - 1)}
            shape="rounded"
          />
        </Stack>
      </div>

      {/* Details Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "16px" }}>
            <h5 className="modal-title" style={{ fontWeight: 600, margin: 0 }}>
              {selectedRecord?._categoryLabel} - Details
            </h5>
            <IconButton onClick={() => setOpen(false)} size="small">
              <ClearIcon />
            </IconButton>
          </div>

          {selectedRecord && (
            <div className="row g-3">
              <div className="col-md-4">
                <h6>Category</h6>
                <p style={{ fontWeight: 600, color: selectedRecord._badgeColor }}>{selectedRecord._categoryLabel}</p>
              </div>
              <div className="col-md-4">
                <h6>Name</h6>
                <p>{selectedRecord._name}</p>
              </div>
              <div className="col-md-4">
                <h6>Status</h6>
                <p style={{ color: "#dc2626", fontWeight: 600 }}>{selectedRecord.status || "Cancel"}</p>
              </div>

              <div className="col-md-4">
                <h6>Phone</h6>
                <p>{selectedRecord._phone}</p>
              </div>
              <div className="col-md-4">
                <h6>Email</h6>
                <p>{selectedRecord._email}</p>
              </div>
              <div className="col-md-4">
                <h6>Date Submitted</h6>
                <p>
                  {selectedRecord._rawDate
                    ? new Date(selectedRecord._rawDate).toLocaleString("en-GB")
                    : "—"}
                </p>
              </div>

              {selectedRecord.country && (
                <div className="col-md-4">
                  <h6>Country</h6>
                  <p>{selectedRecord.country}</p>
                </div>
              )}
              {selectedRecord.city && (
                <div className="col-md-4">
                  <h6>City</h6>
                  <p>{selectedRecord.city}</p>
                </div>
              )}
              {selectedRecord.nationality && (
                <div className="col-md-4">
                  <h6>Nationality</h6>
                  <p>{selectedRecord.nationality}</p>
                </div>
              )}
              {selectedRecord.passport_number && (
                <div className="col-md-4">
                  <h6>Passport Number</h6>
                  <p>{selectedRecord.passport_number}</p>
                </div>
              )}
              {selectedRecord.applying_for && (
                <div className="col-md-4">
                  <h6>Applying For</h6>
                  <p>{selectedRecord.applying_for}</p>
                </div>
              )}
              {selectedRecord.services && (
                <div className="col-md-4">
                  <h6>Services</h6>
                  <p>{String(selectedRecord.services).replaceAll("_", " ")}</p>
                </div>
              )}
              {selectedRecord.from && (
                <div className="col-md-4">
                  <h6>From</h6>
                  <p>{selectedRecord.from}</p>
                </div>
              )}
              {selectedRecord.to && (
                <div className="col-md-4">
                  <h6>To</h6>
                  <p>{selectedRecord.to}</p>
                </div>
              )}
              {selectedRecord.pickup_location && (
                <div className="col-md-4">
                  <h6>Pickup Location</h6>
                  <p>{selectedRecord.pickup_location}</p>
                </div>
              )}
              {selectedRecord.drop_location && (
                <div className="col-md-4">
                  <h6>Drop Location</h6>
                  <p>{selectedRecord.drop_location}</p>
                </div>
              )}
              {selectedRecord.treatment_requirment && (
                <div className="col-md-12">
                  <h6>Treatment Requirement</h6>
                  <p>{selectedRecord.treatment_requirment}</p>
                </div>
              )}
              {selectedRecord.message && (
                <div className="col-md-12">
                  <h6>Message</h6>
                  <p>{selectedRecord.message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
