import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import axios from "axios";
import TableSortLabel from "@mui/material/TableSortLabel";
import { baseurl } from "../Basurl/Baseurl";
import { Pagination, Stack } from "@mui/material";
export default function History() {
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [rows, setRows] = useState([]);
  const [orderBy, setOrderBy] = useState("");
  const [orderDirection, setOrderDirection] = useState("asc");
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const fetchHistory = (pageNum = page) => {
    axios
      .get(`${baseurl}getOldEnquiryHistory`, {
        params: {
          page: pageNum + 1,
          limit: 10,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        if (response.data.success) {
          const list = response.data.data || [];
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
        }
      })
      .catch((error) => {
        console.error("Error fetching history:", error);
      });
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  // ✅ Sorting Function
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

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="topmainhd">
              <h6>Manage History</h6>
            </div>
          </div>
          <div className="col-md-12">
            <div className="main_content">
              <div className="table-responsive">
                <TableContainer component={Paper}>
                  <Table stickyHeader className="table-no-card">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sr.No.</TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "enquiryId"}
                            direction={
                              orderBy === "enquiryId"
                                ? orderDirection
                                : "asc"
                            }
                            onClick={() => handleSort("enquiryId")}
                          >
                            Enquiry ID
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Enquiry Status</TableCell>
                        <TableCell>Emergency Contact</TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "email"}
                            direction={
                              orderBy === "email"
                                ? orderDirection
                                : "asc"
                            }
                            onClick={() => handleSort("email")}
                          >
                            Email
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Disease Name</TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "country"}
                            direction={
                              orderBy === "country"
                                ? orderDirection
                                : "asc"
                            }
                            onClick={() => handleSort("country")}
                          >
                            Country
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === "createdAt"}
                            direction={
                              orderBy === "createdAt"
                                ? orderDirection
                                : "asc"
                            }
                            onClick={() => handleSort("createdAt")}
                          >
                            Date / Time
                          </TableSortLabel>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.length > 0 ? (
                        rows.map((info, i) => (
                            <TableRow key={info.enquiryId}>
                              <TableCell>
                                {page * rowsPerPage + i + 1}
                              </TableCell>
                              <TableCell>{info.enquiryId}</TableCell>
                              <TableCell>{info.enq_status}</TableCell>
                              <TableCell>{info.emergency_contact_no}</TableCell>
                              <TableCell>{info.email}</TableCell>
                              <TableCell>{info.disease_name}</TableCell>
                              <TableCell>{info.country}</TableCell>
                              <TableCell>
                                {new Date(info.createdAt).toLocaleString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  }
                                )}
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
                  <div className="d-flex justify-content-between align-items-center mt-2 px-3">
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {totalRecords > 0 && (
                        <span>
                          Showing <strong>{page * rowsPerPage + 1}</strong> to{" "}
                          <strong>{Math.min(page * rowsPerPage + (rows || []).length, totalRecords)}</strong> of{" "}
                          <strong>{totalRecords}</strong> history records
                        </span>
                      )}
                    </div>
                    <Stack spacing={2} alignItems="end">
                      <Pagination
                        count={totalPages}
                        page={page + 1}
                        onChange={(event, value) => {
                          setPage(value - 1);
                          fetchHistory(value - 1);
                        }}
                        shape="rounded"
                      />
                    </Stack>
                  </div>
                </TableContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}