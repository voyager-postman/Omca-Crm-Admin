import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useState, useEffect, useCallback } from "react";
import Paper from "@mui/material/Paper";
import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import {
  Pagination,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Swal from "sweetalert2";
import { usePDF } from "react-to-pdf";
import ClearIcon from "@mui/icons-material/Clear";

export default function Earning() {
  const [page, setPage] = useState(0);
  const rowsPerPage = 10; // Default 10 per page
  const [rows, setRows] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pdfRowLimit, setPdfRowLimit] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toPDF, targetRef } = usePDF({ filename: "page.pdf" });

  const fetchJobTitles = useCallback(
    (pageNum = page) => {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      axios
        .get(`${baseurl}totalEarnings`, {
          params: {
            page: pageNum + 1,
            limit: 10,
          },
          headers,
        })
        .then((response) => {
          if (response.data.success) {
            const list = response.data.earnings || [];
            setRows(list);
            const total =
              response.data.totalRecords ||
              response.data.total ||
              response.data.pagination?.total ||
              list.length;
            setTotalRecords(total);
            const pages =
              response.data.totalPages ||
              response.data.pagination?.totalPages ||
              Math.ceil(total / 10);
            setTotalPages(Math.max(1, pages));
          } else {
            console.error("Failed to fetch earnings:", response.data.message);
          }
        })
        .catch((error) => {
          console.error("Error fetching earnings:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [page]
  );

  useEffect(() => {
    fetchJobTitles(page);
  }, [page, fetchJobTitles]);

  const downloadPdf = async () => {
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
      inputValue: 10,
      showCancelButton: true,
      confirmButtonText: "Generate PDF",
    }).then((result) => {
      if (result.isConfirmed) {
        const userInput = parseInt(result.value, 10);
        if (isNaN(userInput) || userInput < 1 || userInput > maxRows) {
          Swal.fire(
            "Invalid entry",
            `Please enter a number between 1 and ${maxRows}`,
            "error"
          );
          return;
        }
        setPdfRowLimit(userInput);
        setTimeout(() => {
          toPDF();
          setPdfRowLimit(null);
        }, 300);
      }
    });
  };

  const filteredRows = searchTerm
    ? rows.filter(
        (row) =>
          row.patientId
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          row.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.total_Amount
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          row.remaining_balance
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          row.amount_paid
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          row.country
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          row.Disease_agreement?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      )
    : rows;

  const displayRows = pdfRowLimit ? filteredRows.slice(0, pdfRowLimit) : filteredRows;
  const startRecord = totalRecords === 0 ? 0 : page * 10 + 1;
  const endRecord = Math.min(page * 10 + displayRows.length, totalRecords);

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3">
            <div className="col-md-12">
              <div className="country-top">
                <div className="topmainhd mb-0">
                  <h6>Manage Payments</h6>
                </div>
                <div className="search-btn-main">
                  <div className="d-flex align-items-center gap-2">
                    <TextField
                      className="field-count"
                      label="Search"
                      size="small"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end" className="input-set">
                            <IconButton onClick={() => setSearchTerm("")} edge="end">
                              <ClearIcon />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </div>
                  <button onClick={downloadPdf} className="add-button">
                    <i className="fa fa-file-pdf-o me-2"></i>PDF
                  </button>
                </div>
              </div>
            </div>
            <div className="col-md-12">
              <div className="main_content">
                <div className="table-responsive">
                  <TableContainer
                    component={Paper}
                    style={{ overflowX: "auto" }}
                    ref={targetRef}
                  >
                    <Table
                      stickyHeader
                      aria-label="sticky table"
                      className="table-no-card"
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell>Sr.No.</TableCell>
                          <TableCell>Patient ID</TableCell>
                          <TableCell>Patient Name</TableCell>
                          <TableCell>Country</TableCell>
                          <TableCell>Total Amount</TableCell>
                          <TableCell>Remaining Balance</TableCell>
                          <TableCell>Amount Paid</TableCell>
                          <TableCell>Disease Agreement</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                              <div className="d-flex justify-content-center align-items-center gap-2">
                                <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                                <span className="text-muted">Loading payments...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : displayRows.length > 0 ? (
                          displayRows.map((info, i) => (
                            <TableRow
                              role="checkbox"
                              tabIndex={-1}
                              key={info.enquiryId || info._id || i}
                            >
                              <TableCell>
                                {pdfRowLimit ? i + 1 : page * 10 + i + 1}
                              </TableCell>
                              <TableCell>{info.patientId}</TableCell>
                              <TableCell>{info.patient_name}</TableCell>
                              <TableCell>{info?.country}</TableCell>
                              <TableCell>${info.total_Amount}</TableCell>
                              <TableCell>${info.remaining_balance}</TableCell>
                              <TableCell>${info.amount_paid}</TableCell>
                              <TableCell>{info.Disease_agreement}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                              <span className="text-muted">No Payment Records Found</span>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {!pdfRowLimit && (
                      <div className="d-flex justify-content-between align-items-center p-3">
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {totalRecords > 0 && (
                            <span>
                              Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{" "}
                              <strong>{totalRecords}</strong> records
                            </span>
                          )}
                        </div>
                        <Stack spacing={2} alignItems="end">
                          <Pagination
                            count={totalPages}
                            page={page + 1}
                            onChange={(event, value) => {
                              setPage(value - 1);
                              fetchJobTitles(value - 1);
                            }}
                            shape="rounded"
                            className="page-item"
                          />
                        </Stack>
                      </div>
                    )}
                  </TableContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
