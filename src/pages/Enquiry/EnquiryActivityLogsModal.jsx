import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  Stack,
  Tooltip,
} from "@mui/material";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { baseurl } from "../../Basurl/Baseurl";
import Loader from "../../components/Loader";
import {
  buildEnquiryActivityLogsExcelHtml,
  downloadActivityLogsFile,
  extractActivityLogPagination,
  extractActivityLogs,
  formatActivityLogDate,
  getActivityLogAction,
  getActivityLogDate,
  getActivityLogDescription,
  getActivityLogEmail,
  getActivityLogIp,
  getActivityLogModule,
  getActivityLogRole,
  getActivityLogStatus,
  getActivityLogUser,
} from "../ActivityLog/activityLogHelpers";

const truncateText = (text, maxLength = 40) => {
  if (!text) return "-";
  const value = String(text);
  return value.length > maxLength
    ? `${value.substring(0, maxLength)}...`
    : value;
};

const getActionBadgeClass = (action) => {
  const act = String(action || "").toUpperCase().trim();
  switch (act) {
    case "CREATE":
      return "badge-action badge-action-create";
    case "UPDATE":
      return "badge-action badge-action-update";
    case "DELETE":
      return "badge-action badge-action-delete";
    case "STATUS_CHANGE":
      return "badge-action badge-action-status_change";
    case "ASSIGN":
      return "badge-action badge-action-assign";
    case "LOGIN":
      return "badge-action badge-action-login";
    case "UPLOAD":
      return "badge-action badge-action-upload";
    default:
      return "badge-action badge-action-default";
  }
};

export default function EnquiryActivityLogsModal({
  open,
  onClose,
  enquiryId,
  enquiryName = "",
  allowExport = true,
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [fetchedName, setFetchedName] = useState("");

  const effectiveName = fetchedName || enquiryName || "";
  const PAGE_SIZE = 10;

  const fetchLogs = async (pageNum = 1) => {
    if (!enquiryId) return;
    setLoading(true);

    try {
      let response;
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      };

      try {
        response = await axios.get(
          `${baseurl}get_enquiry_activity_logs/${enquiryId}`,
          {
            headers,
            params: { page: pageNum, limit: PAGE_SIZE },
          },
        );
      } catch (err) {
        // Fallback to get_patient_activity_logs if get_enquiry_activity_logs is not routed or 404
        if (err.response?.status === 404) {
          response = await axios.get(
            `${baseurl}get_patient_activity_logs/${enquiryId}`,
            {
              headers,
              params: { page: pageNum, limit: PAGE_SIZE },
            },
          );
        } else {
          throw err;
        }
      }

      const extractedLogs = extractActivityLogs(response.data);
      const pagination = extractActivityLogPagination(response.data, PAGE_SIZE);

      setLogs(extractedLogs);
      setPage(pageNum);
      setTotalPages(pagination.totalPages || 1);
      setTotalRecords(pagination.totalRecords || extractedLogs.length);

      if (response.data?.name) {
        setFetchedName(response.data.name);
      }
    } catch (err) {
      setLogs([]);
      setTotalPages(1);
      setTotalRecords(0);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch enquiry activity logs",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && enquiryId) {
      setPage(1);
      setFetchedName("");
      fetchLogs(1);
    } else {
      setLogs([]);
      setPage(1);
      setTotalPages(1);
      setTotalRecords(0);
      setFetchedName("");
    }
  }, [open, enquiryId]);

  const handlePageChange = (_, newPage) => {
    fetchLogs(newPage);
  };

  const handleExportExcel = () => {
    if (!logs || logs.length === 0) {
      Swal.fire("Info", "No activity logs available to export", "info");
      return;
    }
    const excelHtml = `\uFEFF${buildEnquiryActivityLogsExcelHtml(
      logs,
      enquiryId,
      effectiveName,
    )}`;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `enquiry-activity-logs-${enquiryId || "export"}-${stamp}.xls`;
    downloadActivityLogsFile(
      excelHtml,
      filename,
      "application/vnd.ms-excel;charset=utf-8;",
    );
    toast.success("Enquiry activity logs exported to Excel successfully!");
  };

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={onClose}
      className="activity-log-dialog"
      sx={{ zIndex: 1300 }}
    >
      <div className="activity-log-header">
        <h6>
          <i className="fa-solid fa-clock-rotate-left me-2" />
          Enquiry Activity Log
        </h6>
        <div className="d-flex align-items-center gap-2">
          {allowExport && (
            <button
              type="button"
              className="export-excel-btn"
              onClick={handleExportExcel}
              disabled={loading || logs.length === 0}
              title="Export to Excel"
            >
              <i className="fa fa-file-excel-o me-1" />
              Export Excel
            </button>
          )}
          <button
            className="close-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>

      <DialogContent className="activity-log-content">
        <div className="activity-log-patient-info">
          <div>
            <span>Enquiry ID:</span> {enquiryId || "-"}
          </div>
          {effectiveName && (
            <div>
              <span>Name:</span> {effectiveName}
            </div>
          )}
          <div>
            <span>Total Records:</span> {totalRecords}
          </div>
        </div>

        {loading ? (
          <Loader />
        ) : (
          <>
            <TableContainer
              component={Paper}
              sx={{
                boxShadow: "none",
                border: "1px solid #e8e8e8",
                borderRadius: "6px",
              }}
            >
              <Table stickyHeader size="small" className="activity-log-table">
                <TableHead>
                  <TableRow>
                    <TableCell style={{ width: "55px" }}>Sr.No.</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell style={{ minWidth: "140px" }}>Date/Time</TableCell>
                    <TableCell>IP Address</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <div style={{ color: "#64748b" }}>
                          <i
                            className="fa fa-folder-open-o"
                            style={{ fontSize: "28px", display: "block", marginBottom: "6px" }}
                          />
                          No activity logs found for this enquiry
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log, idx) => {
                      const user =
                        log?.userName ||
                        log?.performedBy ||
                        getActivityLogUser(log) ||
                        "-";
                      const role =
                        log?.userRole ||
                        getActivityLogRole(log) ||
                        "-";
                      const email =
                        log?.userEmail ||
                        getActivityLogEmail(log) ||
                        "";
                      const action =
                        log?.action ||
                        getActivityLogAction(log) ||
                        "-";
                      const moduleVal =
                        log?.module ||
                        getActivityLogModule(log) ||
                        "-";
                      const description =
                        log?.description ||
                        getActivityLogDescription(log) ||
                        "-";
                      const status =
                        log?.status ||
                        getActivityLogStatus(log) ||
                        "-";
                      const dateTime =
                        log?.formattedDate ||
                        log?.dateTime ||
                        formatActivityLogDate(
                          log?.performedAt || getActivityLogDate(log),
                        ) ||
                        "-";
                      const ip =
                        log?.ipAddress ||
                        log?.ip_address ||
                        getActivityLogIp(log) ||
                        "-";

                      return (
                        <TableRow key={log?.id || log?._id || idx}>
                          <TableCell>{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                          <TableCell>
                            <div title={email || user}>
                              <div style={{ fontWeight: 600, fontSize: "12px", color: "#1e293b" }}>
                                {truncateText(user, 20)}
                              </div>
                              {role && role !== "-" && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: "10px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    backgroundColor: "#f1f5f9",
                                    color: "#475569",
                                    marginTop: "2px",
                                  }}
                                >
                                  {role}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={getActionBadgeClass(action)}>
                              {action}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                textTransform: "capitalize",
                                color: "#334155",
                              }}
                            >
                              {truncateText(moduleVal, 16)}
                            </span>
                          </TableCell>
                          <TableCell title={description}>
                            {truncateText(description, 50)}
                          </TableCell>
                          <TableCell>
                            {status && status !== "-" ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor:
                                    String(status).toLowerCase() === "success"
                                      ? "#ecfdf5"
                                      : "#f1f5f9",
                                  color:
                                    String(status).toLowerCase() === "success"
                                      ? "#047857"
                                      : "#475569",
                                }}
                              >
                                {status}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell style={{ whiteSpace: "nowrap", fontSize: "12px" }}>
                            {dateTime}
                          </TableCell>
                          <TableCell style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748b" }}>
                            {truncateText(ip, 16)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {!loading && totalPages > 1 && (
              <Stack spacing={2} sx={{ mt: 2, mb: 1 }} alignItems="center">
                <Pagination
                  className="page-nation"
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="small"
                />
              </Stack>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
