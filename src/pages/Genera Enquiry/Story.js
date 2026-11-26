import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { testForms, markTestFormRequestRead } from "../../reducer/FormsEnquiry";
import { UnreadDot } from "../../components/NewTag";
import VisibilityIcon from "@mui/icons-material/Visibility";
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
  Modal,
  Box,
  Dialog,
  DialogContent,
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import TableSortLabel from "@mui/material/TableSortLabel";
import ClearIcon from "@mui/icons-material/Clear";
import axios from "axios";
import { AdminBaseUrl } from "../../Basurl/Baseurl";
import Swal from "sweetalert2";

export default function Story({ dateRange }) {
  const isReferral = (localStorage.getItem("Role") || "").toUpperCase() === "REFERRAL";
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fullWidth = true;
  const maxWidth = "md"; // xs | sm | md | lg | xl
  const {
    testForms: formData,
    loading,
    error,
  } = useSelector((state) => state.testForms);

  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  // Popup states
  const [open, setOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("");
    useEffect(() => {
    if (!formData?.data) {
      dispatch(testForms());
    }
  }, [dispatch, formData?.data]);

  const medicalVisaData = formData?.data?.stay || [];

  const handleFilter = (e) => {
    setFilterValue(e.target.value);
    setPage(0);
  };

  const handleClearFilter = () => {
    setFilterValue("");
    setPage(0);
  };
  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };
  // const sortedData = [...filteredData].sort((a, b) => {
  //   if (!orderBy) return 0;

  //   let valA = a[orderBy] || "";
  //   let valB = b[orderBy] || "";

  //   // Date handling
  //   if (orderBy === "date") {
  //     return order === "asc"
  //       ? new Date(valA) - new Date(valB)
  //       : new Date(valB) - new Date(valA);
  //   }

  //   // Number handling
  //   if (!isNaN(valA) && !isNaN(valB)) {
  //     return order === "asc" ? valA - valB : valB - valA;
  //   }

  //   // String handling
  //   valA = valA.toString().toLowerCase();
  //   valB = valB.toString().toLowerCase();

  //   if (valA < valB) return order === "asc" ? -1 : 1;
  //   if (valA > valB) return order === "asc" ? 1 : -1;

  //   return 0;
  // });
  // const filteredData = medicalVisaData.filter((item) => {
  //   const search = filterValue.toLowerCase();

  //   return (
  //     item.name?.toLowerCase().includes(search) ||
  //     item.email?.toLowerCase().includes(search) ||
  //     item.phone?.toLowerCase().includes(search) ||
  //    new Date(item.select_date).toLocaleDateString("en-GB")?.toLowerCase().includes(search)
  //   );
  // });

  // const paginatedData = sortedData.slice(
  //   page * rowsPerPage,
  //   page * rowsPerPage + rowsPerPage
  // );

  // Open popup
  const handleView = (record) => {
    setSelectedRecord(record);
    setOpen(true);
  };
  /* ========= Reusable Info Item ========= */
  const InfoItem = ({ label, value }) => (
    <div className="">
      <h6>{label}</h6>
      <p>{value || "-"}</p>
    </div>
  );
  const handleClose = () => setOpen(false);

  // const handleChangtype =(e)=>{
  //   console.log(e)
  // }
  const handleChangtype = async (e, b) => {
    if (isReferral) return;
    console.log(e, b);

    const data = {
      id: b?.id,
      model: "Story",
      status: e?.value || e?.target?.value,
    };

    try {
      const response = await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        data,
      );
      
      dispatch(testForms());
      if (response?.data?.success) {
        Swal.fire("Success", "Status Updated Successfully", "success");
      }
    } catch (error) {
      console.log(error);

      Swal.fire("Error", "Something went wrong", "error");
    }
  };
  // ✅ 1. Filter FIRST
  const filteredData = medicalVisaData.filter((item) => {
    // Exclude cancelled status (moved to Cancelled tab)
    const statusLower = String(item.status || "").toLowerCase().trim();
    if (statusLower === "cancel" || statusLower === "cancelled") return false;

    // Apply Date Range
    if (dateRange?.startDate) {
      const rawDate = item.created_at || item.createdAt || item.select_date;
      const itemTs = new Date(rawDate).getTime();
      const startTs = new Date(`${dateRange.startDate}T00:00:00`).getTime();
      if (!isNaN(itemTs) && !isNaN(startTs) && itemTs < startTs) return false;
    }
    if (dateRange?.endDate) {
      const rawDate = item.created_at || item.createdAt || item.select_date;
      const itemTs = new Date(rawDate).getTime();
      const endTs = new Date(`${dateRange.endDate}T23:59:59.999`).getTime();
      if (!isNaN(itemTs) && !isNaN(endTs) && itemTs > endTs) return false;
    }

    const search = filterValue.toLowerCase();

    return (
      item.name?.toLowerCase().includes(search) ||
      item.email?.toLowerCase().includes(search) ||
      item.phone?.toLowerCase().includes(search) ||
      new Date(item.select_date)
        .toLocaleDateString("en-GB")
        ?.toLowerCase()
        .includes(search)
    );
  });

  const toDateOnly = (value) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return 0;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  const toTimeValue = (value) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return 0;
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };

  // ✅ 2. THEN Sort
  const sortedData = [...filteredData].sort((a, b) => {
    if (!orderBy) return 0;

    if (orderBy === "date") {
      const dateA = toDateOnly(a.created_at);
      const dateB = toDateOnly(b.created_at);
      return order === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (orderBy === "time") {
      const timeA = toTimeValue(a.created_at);
      const timeB = toTimeValue(b.created_at);
      return order === "asc" ? timeA - timeB : timeB - timeA;
    }

    if (orderBy === "checkin") {
      const dateA = toDateOnly(a.checkin);
      const dateB = toDateOnly(b.checkin);
      return order === "asc" ? dateA - dateB : dateB - dateA;
    }

    let valA = a[orderBy] || "";
    let valB = b[orderBy] || "";

    // Number handling
    if (!isNaN(valA) && !isNaN(valB)) {
      return order === "asc" ? valA - valB : valB - valA;
    }

    // String handling
    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();

    if (valA < valB) return order === "asc" ? -1 : 1;
    if (valA > valB) return order === "asc" ? 1 : -1;

    return 0;
  });

  // ✅ 3. THEN Pagination
  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );
  return (
    <>
      {loading && <p>Loading...</p>}
      {error && (
        <p style={{ color: "red" }}>
          {typeof error === "string" ? error : error?.message || "Something went wrong"}
        </p>
      )}
      <div className="country-top">
        <div className="topmainhd mb-0">
          <h6>Guest House/Stay</h6>
        </div>
        <div className="search-btn-main">
          <TextField
            label="Search"
            size="small"
            value={filterValue}
            onChange={handleFilter}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {filterValue && (
                    <IconButton onClick={handleClearFilter}>
                      <ClearIcon />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
          />
          <Link
            to="/Admin/add-general-enquiry/story"
            className="add-button"
            onClick={() => localStorage.setItem("generalEnquiryTab", "story")}
          >
            <i className="fa fa-plus me-2"></i>Create
          </Link>
        </div>
      </div>
      <div className="table-responsive">
        <TableContainer component={Paper} style={{ overflowX: "auto" }}>
          <Table
            stickyHeader
            aria-label="sticky table"
            className="table-no-card"
          >
            <TableHead>
              <TableRow>
                <TableCell>Sr No.</TableCell>
                <TableCell
                  sortDirection={orderBy === "booking_id" ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === "booking_id"}
                    direction={orderBy === "booking_id" ? order : "asc"}
                    onClick={() => handleSort("booking_id")}
                  >
                    Booking Id
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === "name" ? order : false}>
                  <TableSortLabel
                    active={orderBy === "name"}
                    direction={orderBy === "name" ? order : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sortDirection={orderBy === "guesthouse" ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === "guesthouse"}
                    direction={orderBy === "guesthouse" ? order : "asc"}
                    onClick={() => handleSort("guesthouse")}
                  >
                    Guest House
                  </TableSortLabel>
                </TableCell>
                 <TableCell sortDirection={orderBy === "date" ? order : false}>
                  <TableSortLabel
                    active={orderBy === "date"}
                    direction={orderBy === "date" ? order : "asc"}
                    onClick={() => handleSort("date")}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === "time" ? order : false}>
                  <TableSortLabel
                    active={orderBy === "time"}
                    direction={orderBy === "time" ? order : "asc"}
                    onClick={() => handleSort("time")}
                  >
                    Time
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === "checkin" ? order : false}>
                  <TableSortLabel
                    active={orderBy === "checkin"}
                    direction={orderBy === "checkin" ? order : "asc"}
                    onClick={() => handleSort("checkin")}
                  >
                    Check In
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === "status" ? order : false}>
                  <TableSortLabel
                    active={orderBy === "status"}
                    direction={orderBy === "status" ? order : "asc"}
                    onClick={() => handleSort("status")}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, i) => (
                  <TableRow
                    key={i}
                    className={item.isUnread === true ? "unread-row" : undefined}
                  >
                    <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                    <TableCell
                      style={{ cursor: "pointer" }}
                      onClick={() => handleView(item)}
                      title="Click to view details"
                    >
                      <span
                        style={{ color: "#0284c7", fontWeight: 500 }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {item.booking_id}
                      </span>
                      <UnreadDot unread={item.isUnread === true} />
                    </TableCell>
                    <TableCell
                      style={{ cursor: "pointer" }}
                      onClick={() => handleView(item)}
                      title="Click to view details"
                    >
                      <span
                        style={{ color: "#0284c7", fontWeight: 500 }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {item.name}
                      </span>
                    </TableCell>
                    <TableCell>{item.guesthouse}</TableCell>
                     <TableCell>
                                          {new Date(item.created_at).toLocaleDateString("en-GB")}
                                        </TableCell> 
                                    <TableCell>
  {new Date(item.created_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}
</TableCell>
                    <TableCell>
                      {new Date(item.checkin).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <FormControl
                        sx={{ m: 1, minWidth: 120 }}
                        size="small"
                        className="cont-main"
                      >
                        <Select
                          value={item.status}
                          onChange={(e) => {
                            if (isReferral) return;
                            handleChangtype(e, item);
                          }}
                          disabled={isReferral}
                          displayEmpty
                          inputProps={{
                            "aria-label": "Without label",
                          }}
                          className="status-direct"
                          sx={
                            isReferral
                              ? {
                                  "&.Mui-disabled": {
                                    cursor: "not-allowed",
                                    backgroundColor: "#f9f9f9",
                                  },
                                  "& .MuiSelect-select.Mui-disabled": {
                                    WebkitTextFillColor: "var(--bs-text-color, #333)",
                                    fontWeight: 600,
                                    cursor: "not-allowed",
                                  },
                                }
                              : {}
                          }
                        >
                          <MenuItem value="Pending">Pending</MenuItem>
                          <MenuItem value="In-Process">In-Process</MenuItem>
                          <MenuItem value="Completed">Completed</MenuItem>
                          <MenuItem value="Cancel">Cancel</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell
                      onClickCapture={() =>
                        dispatch(markTestFormRequestRead("stay", item))
                      }
                    >
                      <div className="action-icon">
                        <VisibilityIcon
                          className="eye-icon"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleView(item)}
                        />
                        <i
                          className="fa-solid fa-pen-to-square"
                          title="Edit"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            localStorage.setItem("generalEnquiryTab", "story");
                            navigate("/Admin/edit-general-enquiry/story", {
                              state: { id: item.id, user_id: item.user_id, record: item },
                            });
                          }}
                        ></i>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No Data Found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <Stack spacing={2} alignItems="end" marginTop={2}>
            <Pagination
              count={Math.ceil(filteredData.length / rowsPerPage)}
              page={page + 1}
              onChange={(event, value) => setPage(value - 1)}
              shape="rounded"
            />
          </Stack>
        </TableContainer>
      </div>
      {/* Popup Modal */}
      <Dialog
        fullWidth={fullWidth}
        maxWidth={maxWidth}
        open={open}
        onClose={handleClose}
      >
        <div className="main-card-header">
          <div className="top-fixed-hd">
            <div className="note-hd">
              <h6>Guest House/Stay</h6>
            </div>
            <div className="cross-icon" onClick={handleClose}>
              <i className="fa-solid fa-xmark"></i>
            </div>
          </div>
        </div>
        <DialogContent className="main-box view-table-detail">
          {/* {selectedRecord && (
              <div className="table-responsive dataset">
                <table className="table table-bordered mb-0">
                  <tbody>
                    {Object.entries(selectedRecord)
                      .filter(([key]) =>
                        [
                          "email",
                          "name",
                          "email",
                          "phone",
                          "city",
                          "select_date",
                          "number_of_people",
                        ].includes(key)
                      )
                      .map(([key, value]) => (
                        <tr key={key}>
                          <th>
                            {key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (char) => char.toUpperCase())}
                          </th>
                          <td>{String(value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )} */}
          {selectedRecord && (
            <Box>
              <div className="row">
                {/* personal */}
                <div className="col-md-12 mb-3">
                  {/* <div className="all-hd mb-3">
                      <h6>Personal Information</h6>
                    </div> */}
                  <div className="card">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4">
                          <InfoItem
                            label="Booking ID"
                            value={selectedRecord.booking_id}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem label="Name" value={selectedRecord.name} />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Email"
                            value={selectedRecord.email}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Phone Number"
                            value={selectedRecord.phone}
                          />
                        </div>
                        {/* <div className="col-md-4">
                          <InfoItem
                            label="Length of Stay"
                            value={selectedRecord.length_of_story}
                          />
                        </div> */}
                        <div className="col-md-4">
                          <InfoItem
                            label="Check In"
                            value={new Date(
                              selectedRecord.checkin,
                            ).toLocaleDateString("en-GB")}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Check Out"
                            value={new Date(
                              selectedRecord.checkout,
                            ).toLocaleDateString("en-GB")}
                          />
                        </div>
                        {/* <div className="col-md-4">
                          <InfoItem label="City" value={selectedRecord.city} />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Number of People"
                            value={selectedRecord.number_of_people}
                          />
                        </div> */}
                        <div className="col-md-4">
                          <InfoItem
                            label="Passport Number"
                            value={`${selectedRecord.passport_number} `}
                          />
                        </div>

                        <div className="col-md-4">
                          <InfoItem
                            label="Guest House"
                            value={selectedRecord.guesthouse}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Room Type"
                            value={selectedRecord.guesthouse_room_type}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Rooms"
                            value={selectedRecord.rooms}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Adults"
                            value={selectedRecord.adults}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Children"
                            value={selectedRecord.children}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label=" Status"
                            value={selectedRecord.status}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-12 mb-3">
                  <div className="all-hd mb-3">
                    <h6>Payment Details</h6>
                  </div>
                  <div className="card">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4">
                          <InfoItem
                            label="Payment Amount"
                            value={selectedRecord.payment_amount}
                          />
                        </div>
                        <div className="col-md-4">
                          <InfoItem
                            label="Payment Status"
                            value={selectedRecord.payment_status}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
