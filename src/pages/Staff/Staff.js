import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useState, useEffect } from "react";
import {
  GetAllStaffUser,
  ActiveStaffUser,
  DeleteStaff,
} from "../../reducer/StaffSlice";
import { baseurl, image } from "../../Basurl/Baseurl";
import { clearUnreadById, UnreadDot } from "../../components/NewTag";
import { markRecordRead } from "../../services/unreadApi";
import Swal from "sweetalert2";
import axios from "axios";
import { usePDF } from "react-to-pdf";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Pagination from "@mui/material/Pagination";
import TextField from "@mui/material/TextField";
import TableSortLabel from "@mui/material/TableSortLabel";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import { toast } from "react-toastify";
import { canStaffDelete, canStaffEdit, canStaffExport } from "../../utils/staffActions";
import { getUserId } from "../../utils/authStorage";
export default function Staff() {
  const role = localStorage.getItem("Role");
  const currentUserId = getUserId();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { toPDF, targetRef } = usePDF({ filename: "staff.pdf" });
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [orderBy, setOrderBy] = useState("");
  const [orderDirection, setOrderDirection] = useState("asc");
  const rowsPerPage = 10;
  const [pdfRowLimit, setPdfRowLimit] = useState(null);
  const { staff, loading, error, totalPages, totalRecords } = useSelector((state) => state.staff);
  const [initialLoading, setInitialLoading] = useState(true);
  /* ---------------- FETCH DATA (DEBOUNCED SERVER SEARCH & PAGINATION) ---------------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(
        GetAllStaffUser({
          page: page + 1,
          limit: rowsPerPage,
          search: search.trim(),
        })
      ).finally(() => setInitialLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [search, page, dispatch]);

  useEffect(() => {
    if (staff) setRows(staff);
  }, [staff]);
  /* ---------------- HANDLERS ---------------- */
  const markStaffAction = (id) => {
    if (!id) return;
    markRecordRead("staff", id);
    setRows((prev) => clearUnreadById(prev, id, ["_id", "staffId", "id"]));
  };
  const handleEdit = (staffInfo) => {
    const id = staffInfo?._id || staffInfo?.id || staffInfo;
    markStaffAction(id);
    if (staffInfo && typeof staffInfo === "object") {
      sessionStorage.setItem("edit_staff_id", String(id));
      sessionStorage.setItem("edit_staff_data", JSON.stringify(staffInfo));
      navigate("/Admin/edit-staff", {
        state: { staffID: String(id), staffData: staffInfo },
      });
    } else {
      sessionStorage.setItem("edit_staff_id", String(id));
      navigate("/Admin/edit-staff", { state: { staffID: String(id) } });
    }
  };
  const handleChat = (staffUser) => {
    markStaffAction(staffUser?._id || staffUser?.staffId || staffUser?.id);
    const staffUserId = staffUser?.user_id || staffUser?.userId || staffUser?._id;
    if (!staffUserId) {
      toast.error("Staff user id not found");
      return;
    }
    if (String(staffUserId) === String(currentUserId)) {
      toast.error("You cannot chat with yourself");
      return;
    }
    navigate("/Admin/messages", {
      state: {
        patientUserId: String(staffUserId),
        patientName: staffUser?.name || "Staff",
      },
    });
  };
  const handleStatusToggle = async (id, status) => {
    markStaffAction(id);
    try {
      await dispatch(ActiveStaffUser({ id })).unwrap();
      dispatch(GetAllStaffUser({ page: page + 1, limit: rowsPerPage, search: search.trim() }));
      Swal.fire(
        "Success",
        status ? "Deactivated" : "Activated",
        "success"
      );
    } catch (err) {
      Swal.fire("Error", "Status update failed", "error");
    }
  };
  const dataActiveInactive = async (id, currentState) => {
    markStaffAction(id);
    try {
      const newState = currentState === 1 ? 0 : 1; // Invert status
      const result = await dispatch(ActiveStaffUser({ id: id })).unwrap();
      dispatch(GetAllStaffUser({ page: page + 1, limit: rowsPerPage, search: search.trim() }));
      Swal.fire(
        "Status!",
        newState === 1 ? "Activate." : "DeActivate.",
        "success"
      );
    } catch (err) {
      console.error("Error object:", err);
      const errorMessage =
        typeof err === "string"
          ? err
          : typeof err?.message === "string"
            ? err.message
            : typeof err?.message?.message === "string"
              ? err.message.message
              : JSON.stringify(err);
      Swal.fire({
        title: "Error!",
        text: errorMessage,
        icon: "error",
      });
    }
  };
  const handleDelete = (id) => {
    markStaffAction(id);
    Swal.fire({
      title: "Are you sure?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        dispatch(DeleteStaff({ id }))
          .unwrap()
          .then(() => dispatch(GetAllStaffUser({ page: page + 1, limit: rowsPerPage, search: search.trim() })))
          .then(() =>
            Swal.fire("Deleted!", "Staff deleted successfully", "success")
          )
          .catch(() =>
            Swal.fire("Error!", "Delete operation failed", "error")
          );
      }
    });
  };
  const handleExportExcel = async () => {
    const response = await axios.get(`${baseurl}export_staffs`, {
      responseType: "blob",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Staff_List.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleSort = (field) => {
    const isAsc = orderBy === field && orderDirection === "asc";
    const direction = isAsc ? "desc" : "asc";

    setOrderBy(field);
    setOrderDirection(direction);

    const sortedData = [...rows].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      // ✅ Date sorting
      if (field === "createdAt") {
        return direction === "asc"
          ? new Date(valA) - new Date(valB)
          : new Date(valB) - new Date(valA);
      }

      // ✅ Boolean sorting (status)
      if (field === "status") {
        return direction === "asc"
          ? Number(valA) - Number(valB)
          : Number(valB) - Number(valA);
      }

      // ✅ String sorting
      if (typeof valA === "string") {
        return direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });

    setRows(sortedData);
  };
  const handleGeneratePDF = () => {
    Swal.fire({
      title: "Enter number of rows",
      input: "number",
      inputAttributes: {
        min: 1,
        max: totalRecords || rows.length || 1,
      },
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        setPdfRowLimit(Number(result.value));
        setTimeout(() => {
          toPDF();
          setPdfRowLimit(null);
        }, 300);
      }
    });
  };

  const isDataLoading = loading || (initialLoading && rows.length === 0);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="country-top">
              <div className="topmainhd mb-0">
                <h6>Manage Staff</h6>
              </div>
              <div className="search-btn-main">
                <TextField
                  className="field-count"
                  label="Search Staff"
                  id="outlined-size-small"
                  size="small"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Name, email, role, phone, country..."
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    endAdornment: search ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearch("");
                            setPage(0);
                          }}
                          edge="end"
                          title="Clear search"
                        >
                          <i className="fa fa-times" style={{ fontSize: "13px" }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <Link to="/Admin/add-staff" className="add-button">
                  <i className="fa fa-plus me-2"></i>New Staff
                </Link>
                {canStaffExport() && (
                  <button onClick={handleExportExcel} className="add-button">
                    <i className="fa fa-file me-2"></i>Export
                  </button>
                )}
                {role === "Admin" && (
                  <button onClick={handleGeneratePDF} className="add-button">
                    <i className="fa fa-file-pdf-o me-2"></i>Pdf
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-12">
            <div className="main_content">
              {isDataLoading ? (
                <div
                  className="text-center py-5 d-flex flex-column align-items-center justify-content-center bg-white shadow-sm"
                  style={{ minHeight: "440px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
                >
                  <div
                    className="spinner-border text-primary mb-3"
                    role="status"
                    style={{ width: "3.2rem", height: "3.2rem", borderWidth: "0.25rem" }}
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <h5 className="fw-semibold text-dark mb-1" style={{ fontSize: "17px" }}>
                    Loading Staff Data...
                  </h5>
                  <p className="text-muted small mb-0" style={{ maxWidth: "420px" }}>
                    Please wait a moment while staff members and access permissions are being loaded.
                  </p>
                </div>
              ) : error ? (
                <div
                  className="text-center py-5 bg-white shadow-sm"
                  style={{ minHeight: "320px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
                >
                  <i className="fa fa-exclamation-triangle text-warning mb-3" style={{ fontSize: "2.5rem" }} />
                  <h6 className="text-danger fw-semibold">Failed to load staff list</h6>
                  <p className="text-muted small mb-3">
                    {typeof error === "string" ? error : error?.message || "An unexpected error occurred."}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3"
                    onClick={() => dispatch(GetAllStaffUser({ page: page + 1, limit: rowsPerPage, search: search.trim() }))}
                  >
                    <i className="fa fa-refresh me-1" /> Try Again
                  </button>
                </div>
              ) : (
                <TableContainer ref={targetRef} className="table-responsive">
                <Table className="table-no-card">
                  <TableHead>
                    <TableRow>
                      <TableCell>Sr.No.</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === "name"}
                          direction={orderDirection}
                          onClick={() => handleSort("name")}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === "role"}
                          direction={orderDirection}
                          onClick={() => handleSort("role")}
                        >
                          Role
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === "email"}
                          direction={orderDirection}
                          onClick={() => handleSort("email")}
                        >
                          Email
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === "createdAt"}
                          direction={orderDirection}
                          onClick={() => handleSort("createdAt")}
                        >
                          Date/Time
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === "status"}
                          direction={orderDirection}
                          onClick={() => handleSort("status")}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>

                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4, color: "#64748b" }}>
                          {search ? `No staff members found matching "${search}"` : "No staff members available"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (pdfRowLimit ? rows.slice(0, pdfRowLimit) : rows).map((info, i) => {
                      const staffUserId = info.user_id || info.userId || info._id;
                      const isSelf = String(staffUserId) === String(currentUserId);
                      return (
                      <TableRow
                        key={info._id}
                        className={info.isUnread ? "unread-row" : undefined}
                      >
                        <TableCell>
                          {pdfRowLimit ? i + 1 : page * rowsPerPage + i + 1}
                        </TableCell>
                        <TableCell>
                          <img
                            src={`${image}${info.profileImage}`}
                            className="hos-img"
                            alt=""
                          />
                        </TableCell>
                        <TableCell>
                          {info.name}
                          <UnreadDot unread={info.isUnread === true} />
                        </TableCell>
                        <TableCell>{info.role}</TableCell>
                        <TableCell>{info.email}</TableCell>
                        <TableCell>{new Date(info.createdAt).toLocaleDateString("en-GB")}/{new Date(info.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}</TableCell>
                        <TableCell>
                          {
                            <label className="active-switch">
                              <input
                                className="active-switch-input "
                                type="checkbox"
                                checked={Boolean(info.status)}
                                onChange={() => {
                                  dataActiveInactive(
                                    info._id,
                                    info.status
                                  );
                                }}
                              />
                              <span
                                className="active-switch-label "
                                data-on="Active"
                                data-off="Inactive"
                              ></span>
                              <span className="active-switch-handle"></span>
                            </label>
                          }
                        </TableCell>
                        <TableCell className="action-icon">
                          <i
                            className="fa-solid fa-comment"
                            title="Chat with staff"
                            style={{
                              cursor: isSelf ? "not-allowed" : "pointer",
                              opacity: isSelf ? 0.4 : 1,
                              marginRight: 8,
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleChat(info);
                            }}
                          ></i>
                          {canStaffEdit() && (
                            <i
                              className="fa-solid fa-pen-to-square"
                              onClick={() => handleEdit(info)}
                            ></i>
                          )}
                          {canStaffDelete() && (
                            <i
                              className="fa fa-trash ms-1"
                              onClick={() => handleDelete(info._id)}
                            ></i>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    }))}
                  </TableBody>
                </Table>
                {!pdfRowLimit && (
                  <div className="d-flex justify-content-between align-items-center mt-2 px-3">
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {(totalRecords || 0) > 0 ? (
                        <span>
                          Showing <strong>{page * rowsPerPage + 1}</strong> to{" "}
                          <strong>{Math.min(page * rowsPerPage + (rows || []).length, totalRecords)}</strong> of{" "}
                          <strong>{totalRecords}</strong> records
                        </span>
                      ) : (
                        <span>No staff records found</span>
                      )}
                    </div>
                    <Pagination
                      count={Math.max(1, totalPages || 1)}
                      page={page + 1}
                      onChange={(e, value) => {
                        setPage(value - 1);
                      }}
                      shape="rounded"
                    />
                  </div>
                )}
              </TableContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



