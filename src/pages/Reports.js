import React, { useEffect, useMemo, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { Pagination, Stack } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import DatePicker from "react-multi-date-picker";
import { usePDF } from "react-to-pdf";
import { GetAllTreatment } from "../reducer/TreatmentSlice";
import { GetAllCountries2 } from "../reducer/Countries";
import { GetAllHositalData } from "../reducer/HospitalSlice";
import PatientSearchSelect from "../components/PatientSearchSelect";
import {
  fetchFilteredPatients,
  resolveDownloadUrl,
} from "../services/reportsApi";
import { getPatientStatusLabel } from "../utils/patientStatus";
import { canStaffExport } from "../utils/staffActions";

const autocompleteSx = {
  "& .MuiInputBase-root": { height: 40 },
  "& .MuiInputBase-input": { padding: "6px 12px" },
};

const getHospitalId = (h) => h?.hospitalId ?? h?.id ?? h?._id ?? "";
const getHospitalName = (h) => h?.hospitalName ?? h?.name ?? "";
const getTreatmentName = (t) => t?.name ?? t?.course_name ?? "";
const normalizeLatestStatus = (raw) => {
  if (raw == null || raw === "") return "—";
  const value = String(raw).trim();
  const lower = value.toLowerCase().replace(/_/g, " ");

  if (lower.includes("enquiry") || lower === "inquiry") return "Enquiry";
  if (lower.includes("doctor") && lower.includes("review")) {
    return "Doctor's Review";
  }
  if (lower.includes("treatment plan") || lower.includes("plan status")) {
    return "Treatment Plan";
  }
  if (lower.includes("under treatment") || lower === "in treatment") {
    return "Under Treatment";
  }
  if (lower.includes("treatment completed") || lower === "completed") {
    return "Treatment Completed";
  }

  const patientLabel = getPatientStatusLabel(value);
  return patientLabel || value;
};

const getLatestStatus = (info = {}) => {
  const raw =
    info.latestStatus ??
    info.latest_status ??
    info.currentStage ??
    info.current_stage ??
    info.stageLabel ??
    info.stage ??
    info.patient_status ??
    info.p_status ??
    info.status ??
    "";
  return normalizeLatestStatus(raw);
};

const getDiseaseName = (info = {}) => {
  const disease = info.patient_disease;
  if (Array.isArray(disease) && disease.length > 0) {
    return disease[0]?.disease_name || disease[0]?.name || "—";
  }
  return info.disease_name || info.patientDisease || "—";
};

const getContactNo = (info = {}) =>
  info.emergency_contact ||
  info.emergency_contact_no ||
  info.phone ||
  info.contact_no ||
  "—";

export default function Reports() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { toPDF, targetRef } = usePDF({ filename: "reports.pdf" });

  const { Countries } = useSelector((state) => state.Countries);
  const { Treatment } = useSelector((state) => state.Treatment);
  const { hospital } = useSelector((state) => state.hospital);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFilterParams, setLastFilterParams] = useState(null);
  const [pdfRowLimit, setPdfRowLimit] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [hasSearched, setHasSearched] = useState(false);

  const [filters, setFilters] = useState({
    country: null,
    treatingIn: null,
    treatment: null,
    hospital: null,
    patient: null,
  });

  const startDate = dateRange?.[0]?.format?.("YYYY-MM-DD") || "";
  const endDate = dateRange?.[1]?.format?.("YYYY-MM-DD") || "";

  const countryOptions = useMemo(
    () => (Array.isArray(Countries) ? Countries : []),
    [Countries],
  );
  const treatmentOptions = useMemo(
    () => (Array.isArray(Treatment) ? Treatment : []),
    [Treatment],
  );
  const hospitalOptions = useMemo(
    () => (Array.isArray(hospital) ? hospital : []),
    [hospital],
  );
  useEffect(() => {
    dispatch(GetAllCountries2());
    dispatch(GetAllTreatment());
    dispatch(GetAllHositalData());
  }, [dispatch]);

  const buildCurrentFilters = () => ({
    startDate,
    endDate,
    treatment_course_name: getTreatmentName(filters.treatment).trim(),
    country: filters.country?.name?.trim() || "",
    treatingIn: filters.treatingIn?.name?.trim() || "",
    patientId: filters.patient?.patientId || "",
    hospital_id: getHospitalId(filters.hospital),
  });

  const getReportData = async (showEmptyWarning = true, overrideFilters) => {
    try {
      setLoading(true);
      setHasSearched(true);
      const result = await fetchFilteredPatients(
        overrideFilters ?? buildCurrentFilters(),
      );
      setRows(result.data);
      setLastFilterParams(result.params);
      setPage(0);

      if (showEmptyWarning && result.data.length === 0) {
        Swal.fire("Info", "No patients found for the selected filters", "info");
      }
    } catch (error) {
      setRows([]);
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong";
      Swal.fire("Error", errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      country: null,
      treatingIn: null,
      treatment: null,
      hospital: null,
      patient: null,
    });
    setDateRange([null, null]);
    setLastFilterParams(null);
    setRows([]);
    setHasSearched(false);
    setPage(0);
  };

  const handleFilterSubmit = () => {
    if (!hasActiveFilters) {
      Swal.fire({
        title: "No Filter Selected",
        text: "Please select at least one filter (Country, Treatment, Hospital, Patient, or Date Range) to generate the report.",
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Load All Data Anyway",
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) {
          getReportData(true, {});
        }
      });
      return;
    }
    getReportData(true);
  };

  const downloadFilteredReport = async () => {
    if (!lastFilterParams) {
      Swal.fire("Warning", "Please generate report first", "warning");
      return;
    }
    try {
      const result = await fetchFilteredPatients(lastFilterParams);
      const url = resolveDownloadUrl(result.download_link);
      if (!url) {
        Swal.fire("Info", "No file available to download", "info");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "filtered-report.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Download failed",
        "error",
      );
    }
  };

  const downloadPdf = () => {
    if (rows.length === 0) {
      Swal.fire("Warning", "Please generate report data first before exporting PDF", "warning");
      return;
    }
    const maxRows = rows.length || 1;
    Swal.fire({
      title: "Enter number of rows for PDF",
      input: "number",
      inputLabel: `Choose between 1 and ${maxRows}`,
      inputAttributes: {
        min: "1",
        max: maxRows.toString(),
        step: "1",
      },
      inputValue: Math.min(rowsPerPage, maxRows),
      showCancelButton: true,
      confirmButtonText: "Generate PDF",
    }).then((result) => {
      if (!result.isConfirmed) return;
      const userInput = parseInt(result.value, 10);
      if (isNaN(userInput) || userInput < 1 || userInput > maxRows) {
        Swal.fire(
          "Invalid entry",
          `Please enter a number between 1 and ${maxRows}`,
          "error",
        );
        return;
      }
      setPdfRowLimit(userInput);
      setTimeout(() => {
        toPDF();
        setPdfRowLimit(null);
      }, 300);
    });
  };

  const openPatientDetail = (info) => {
    if (!info?.patientId) return;
    navigate("/Admin/Patient-Detail", {
      state: {
        patientId: info.patientId,
        enqId: info.enquiryId,
        testid: info.id,
        user_id: info.user_id,
        createdAt: info.createdAt || info.created_at,
      },
    });
  };

  const displayRows = pdfRowLimit
    ? rows.slice(0, pdfRowLimit)
    : rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const hasActiveFilters =
    Boolean(filters.country) ||
    Boolean(filters.treatingIn) ||
    Boolean(filters.treatment) ||
    Boolean(filters.hospital) ||
    Boolean(filters.patient) ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="country-top">
              <div className="topmainhd mb-0">
                <h6>Manage Reports</h6>
              </div>
              {canStaffExport() ? (
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="add-button"
                    onClick={downloadFilteredReport}
                    disabled={!lastFilterParams || rows.length === 0}
                  >
                    <i className="fa fa-file me-2"></i>Export
                  </button>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="add-button"
                    disabled={rows.length === 0}
                  >
                    <i className="fa fa-file-pdf-o me-2"></i>PDF
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="col-md-12">
            <div className="main_content">
              <div className="row gx-3 align-items-end">
                <div className="col-6 col-md-3">
                  <div className="field-set">
                    <label>Country</label>
                    <Autocomplete
                      options={countryOptions}
                      value={filters.country}
                      getOptionLabel={(option) => option?.name || ""}
                      isOptionEqualToValue={(option, value) =>
                        option?.name === value?.name
                      }
                      onChange={(_, newValue) =>
                        setFilters((prev) => ({ ...prev, country: newValue }))
                      }
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search Country"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="field-set">
                    <label>Treating In Country</label>
                    <Autocomplete
                      options={countryOptions}
                      value={filters.treatingIn}
                      getOptionLabel={(option) => option?.name || ""}
                      isOptionEqualToValue={(option, value) =>
                        option?.name === value?.name
                      }
                      onChange={(_, newValue) =>
                        setFilters((prev) => ({
                          ...prev,
                          treatingIn: newValue,
                        }))
                      }
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search Treating In"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="field-set">
                    <label>Treatment Name</label>
                    <Autocomplete
                      options={treatmentOptions}
                      value={filters.treatment}
                      getOptionLabel={getTreatmentName}
                      isOptionEqualToValue={(option, value) =>
                        (option?.id ?? option?.course_id) ===
                        (value?.id ?? value?.course_id)
                      }
                      onChange={(_, newValue) =>
                        setFilters((prev) => ({
                          ...prev,
                          treatment: newValue,
                        }))
                      }
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search Treatment"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="field-set">
                    <label>Hospital</label>
                    <Autocomplete
                      options={hospitalOptions}
                      value={filters.hospital}
                      getOptionLabel={getHospitalName}
                      isOptionEqualToValue={(option, value) =>
                        String(getHospitalId(option)) ===
                        String(getHospitalId(value))
                      }
                      onChange={(_, newValue) =>
                        setFilters((prev) => ({
                          ...prev,
                          hospital: newValue,
                        }))
                      }
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search Hospital"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="field-set">
                    <label>Patient</label>
                    <PatientSearchSelect
                      value={filters.patient}
                      onChange={(newValue) =>
                        setFilters((prev) => ({ ...prev, patient: newValue }))
                      }
                      placeholder="Search Patient"
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="field-set field-count">
                    <label>Select Date</label>
                    <DatePicker
                      value={dateRange}
                      format="MM/DD/YYYY"
                      placeholder="Start Date To End Date"
                      onChange={setDateRange}
                      range
                      numberOfMonths={2}
                    />
                  </div>
                </div>

                <div className="col-12 col-md-3">
                  <div className="field-set">
                    <label className="d-none d-md-block" style={{ visibility: "hidden" }}>
                      Actions
                    </label>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="add-button"
                        style={{
                          height: "40px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 20px",
                          margin: 0,
                          lineHeight: "normal",
                          boxSizing: "border-box",
                        }}
                        onClick={handleFilterSubmit}
                        disabled={loading}
                      >
                        {loading ? "Loading..." : "Filter"}
                      </button>
                      <button
                        type="button"
                        className="add-button"
                        style={{
                          height: "40px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 20px",
                          margin: 0,
                          lineHeight: "normal",
                          boxSizing: "border-box",
                        }}
                        onClick={handleClearFilters}
                        disabled={loading}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-12 gy-3">
            <div className="main_content">
              <div className="row">
                <div className="col-md-12">
                  <div className="table-responsive">
                    <TableContainer
                      component={Paper}
                      ref={targetRef}
                      style={{ overflowX: "auto" }}
                    >
                      <Table
                        stickyHeader
                        aria-label="sticky table"
                        className="table-no-card"
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell>Sr.No.</TableCell>
                            <TableCell>Patient Id</TableCell>
                            <TableCell>Patient Name</TableCell>
                            <TableCell>Contact No</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Country</TableCell>
                            <TableCell>Patient Disease</TableCell>
                            <TableCell>Latest Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {displayRows.length > 0 ? (
                            displayRows.map((info, i) => (
                              <TableRow
                                role="checkbox"
                                tabIndex={-1}
                                key={info.patientId || info._id || i}
                              >
                                <TableCell>
                                  {pdfRowLimit
                                    ? i + 1
                                    : page * rowsPerPage + i + 1}
                                </TableCell>
                                <TableCell>
                                  {info.patientId || info.patientNumber || "—"}
                                </TableCell>
                                <TableCell
                                  style={{
                                    cursor: info.patientId
                                      ? "pointer"
                                      : "default",
                                    color: info.patientId
                                      ? "#0d6efd"
                                      : "inherit",
                                    textDecoration: info.patientId
                                      ? "underline"
                                      : "none",
                                  }}
                                  onClick={() => openPatientDetail(info)}
                                  title="View patient details"
                                >
                                  {info.patient_name || "—"}
                                </TableCell>
                                <TableCell>{getContactNo(info)}</TableCell>
                                <TableCell>{info.email || "—"}</TableCell>
                                <TableCell>
                                  {info.createdAt
                                    ? new Date(
                                        info.createdAt,
                                      ).toLocaleDateString("en-GB")
                                    : "—"}
                                </TableCell>
                                <TableCell>{info.country || "—"}</TableCell>
                                <TableCell>{getDiseaseName(info)}</TableCell>
                                <TableCell>
                                  {getLatestStatus(info)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={9} align="center" style={{ padding: "36px 16px" }}>
                                {loading ? (
                                  <div className="d-flex align-items-center justify-content-center gap-2">
                                    <span className="spinner-border spinner-border-sm text-primary" role="status" />
                                    <span>Loading report data...</span>
                                  </div>
                                ) : !hasSearched ? (
                                  <div className="text-muted">
                                    <i className="fa fa-filter me-2" style={{ fontSize: "18px" }} />
                                    <span>Please select filters above and click <strong>Filter</strong> to generate the report.</span>
                                  </div>
                                ) : (
                                  <div className="text-muted">
                                    <i className="fa fa-info-circle me-2" />
                                    <span>No records found for the selected filters.</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {!pdfRowLimit && rows.length > 0 ? (
                        <Stack spacing={2} alignItems="end" marginTop={2}>
                          <Pagination
                            count={Math.ceil(rows.length / rowsPerPage) || 1}
                            page={page + 1}
                            onChange={(_, value) => setPage(value - 1)}
                            shape="rounded"
                            className="page-item"
                          />
                        </Stack>
                      ) : null}
                    </TableContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
