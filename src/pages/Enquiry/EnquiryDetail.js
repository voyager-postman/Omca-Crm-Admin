import React from "react";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { baseu11, baseurl, image, imageUrl, resolveCrmImageUrl } from "../../Basurl/Baseurl";
import avtar from "../../img/avtarImg.jpg";
import AssignEnquiryStaffModal from "./components/AssignEnquiryStaffModal";
import {
  getAssignedCoordinators,
  getAssignedStaffList,
  unassignEnquiryStaff,
} from "../../services/coordinatorApi";
import { saveEnquiryDiscussionNotes as persistEnquiryDiscussionNotes } from "../../services/dashboardApi";
import { getDocumentDisplayName } from "../../services/enquiryReportsApi";

const getRoleBadgeStyle = (role = "") => {
  const r = String(role).toLowerCase();
  if (r.includes("coordinator")) {
    return { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" };
  }
  if (r.includes("doctor") || r.includes("surgeon") || r.includes("physician")) {
    return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
  }
  if (r.includes("nurse")) {
    return { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" };
  }
  if (r.includes("physio")) {
    return { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" };
  }
  return { bg: "#f1f5f9", text: "#334155", border: "#e2e8f0" };
};
const getFileType = (file) => {
  const ext = file.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "image";
  return "other";
};
const normalizeReviewComments = (comments = []) =>
  comments.map((comment) => ({
    ...comment,
    Notes: comment.Notes ?? comment.comment ?? comment.notes ?? "",
    createdAt: comment.createdAt || comment.created_at,
    Date: comment.Date || comment.created_at || comment.date,
  }));

const normalizeReviewItem = (item) => ({
  ...item,
  _id: item._id || item.id,
  createdAt: item.createdAt || item.created_at,
  Recommendations: item.Recommendations ?? item.recommendations,
  comments: normalizeReviewComments(item.comments),
});

const getDoctorReviews = (row) => {
  if (!row || typeof row !== "object") return [];

  const review = row.doctorReview ?? row.doctor_review;
  if (Array.isArray(review)) {
    return review.filter(Boolean).map(normalizeReviewItem);
  }
  if (review && typeof review === "object") {
    return [normalizeReviewItem(review)];
  }

  if (
    row.review_notes ||
    row.Recommendations ||
    row.recommendations ||
    row.images?.length
  ) {
    return [
      normalizeReviewItem({
        enquiryId: row.enquiryId,
        title: row.title || row.review_title || "",
        review_notes: row.review_notes,
        Recommendations: row.Recommendations ?? row.recommendations,
        images: row.images || row.review_images || [],
        comments: row.comments || [],
        created_at: row.created_at,
        createdAt: row.createdAt,
      }),
    ];
  }

  return [];
};
const getFileUrl = (file) => {
  if (!file) return "";
  return typeof file === "string" && file.startsWith("http")
    ? file
    : `${imageUrl}${file}`;
};

const getEnquiryDocuments = (data) => {
  if (!data || typeof data !== "object") return [];
  const candidates = [
    data.documents,
    data.medical_reports,
    data.medicalReports,
    data.medical_documents,
    data.reports,
  ];
  for (const value of candidates) {
    if (Array.isArray(value) && value.length > 0) {
      return value.filter(Boolean);
    }
  }
  return [];
};

const getDocumentPath = (file) => {
  if (!file) return "";
  if (typeof file === "string") return file;
  return file.path || file.url || file.filename || file.name || "";
};
const formatReviewDate = (item) => {
  const dateValue =
    item?.createdAt ||
    item?.created_at ||
    item?.Date ||
    item?.date ||
    item?.updatedAt ||
    item?.updated_at;
  if (!dateValue) return "-";
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleDateString("en-GB");
};
const FilePreview = ({ file }) => {
  const fileUrl = `${imageUrl}${file}`;
  const type = getFileType(file);
  if (type === "image") {
    return (
      <img
        src={fileUrl}
        alt="Document"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = avtar;
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="btn btn-outline-primary btn-sm"
      onClick={() => window.open(fileUrl, "_blank")}
    >
      View
    </button>
  );
};
const formatDateForInput = (dateVal) => {
  if (!dateVal) return new Date().toISOString().split("T")[0];
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
};

const formatNoteDisplayDate = (dateVal) => {
  if (!dateVal) return "-";
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime())
    ? String(dateVal)
    : d.toLocaleDateString("en-GB");
};

export default function EnquiryDetail() {
  const location = useLocation();
  const enquiryId = location.state?.enquiryId || sessionStorage.getItem("lastEnquiryId");

  const [row, setRows] = useState("");
  const [openCommentModal, setOpenCommentModal] = useState(false);
  const [assignStaffModalOpen, setAssignStaffModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentImages, setCommentImages] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);

  // Discussion Notes State
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [noteForm, setNoteForm] = useState({ note: "", date: "" });
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const coordinators = getAssignedCoordinators(row);
  const staffList = getAssignedStaffList(row);
  const otherStaff = staffList.filter(
    (s) => String(s.role || "").toLowerCase() !== "coordinator"
  );

  const handleUnassignStaffMember = async (staffMember) => {
    const sId = staffMember.userId || staffMember._id || staffMember.id;
    const sName = staffMember.name || "Staff Member";
    const sRole = staffMember.role || "Staff";

    const { value: reason, isConfirmed } = await Swal.fire({
      title: `Unassign ${sName}?`,
      text: `Remove ${sName} (${sRole}) from this enquiry?`,
      input: "text",
      inputPlaceholder: "Reason for unassignment (optional)",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Unassign",
      cancelButtonText: "Cancel",
    });

    if (!isConfirmed) return;

    try {
      await unassignEnquiryStaff(row || enquiryId, {
        staffId: sId,
        role: sRole,
        reason: (reason || "").trim() || "Unassigned via CRM",
      });

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `${sName} unassigned successfully!`,
        showConfirmButton: false,
        timer: 2000,
      });

      fetchJobTitles();
    } catch (err) {
      console.error("Unassign error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || err?.message || "Failed to unassign staff",
        "error"
      );
    }
  };

  const fetchJobTitles = () => {
    if (!enquiryId) return;
    axios
      .get(`${baseurl}get_Enq/${enquiryId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        if (response.data.success) {
          console.log(response.data.detail);
          const detail = response.data.detail || {};
          setRows({
            ...detail,
            documents: getEnquiryDocuments(detail),
          });
        } else {
          console.error("Failed to fetch job titles:", response.data.message);
        }
      })
      .catch((error) => {
        console.error("Error fetching job titles:", error);
      });
  };

  useEffect(() => {
    if (location.state?.enquiryId) {
      sessionStorage.setItem("lastEnquiryId", location.state.enquiryId);
    }
  }, [location.state?.enquiryId]);

  useEffect(() => {
    fetchJobTitles();
  }, [enquiryId]);

  const notesList = Array.isArray(row?.discussionNotes)
    ? row.discussionNotes
    : Array.isArray(row?.discussion_notes)
    ? row.discussion_notes
    : [];

  const saveEnquiryDiscussionNotes = async (updatedNotes) => {
    const targetId = row?.enquiryId || enquiryId;
    if (!targetId) throw new Error("Enquiry ID is missing");
    return persistEnquiryDiscussionNotes(
      { ...row, enquiryId: targetId },
      updatedNotes,
    );
  };

  const handleOpenAddNote = () => {
    setEditingNoteIndex(null);
    setNoteForm({
      note: "",
      date: new Date().toISOString().split("T")[0],
    });
    setNoteModalOpen(true);
  };

  const handleOpenEditNote = (item, index) => {
    setEditingNoteIndex(index);
    setNoteForm({
      note: item?.note || item?.notes || "",
      date: formatDateForInput(item?.date),
    });
    setNoteModalOpen(true);
  };

  const handleCloseNoteModal = () => {
    if (noteSubmitting) return;
    setNoteModalOpen(false);
    setEditingNoteIndex(null);
    setNoteForm({ note: "", date: "" });
  };

  const handleSaveNote = async () => {
    if (!noteForm.note.trim()) {
      return Swal.fire("Warning", "Note content cannot be empty", "warning");
    }
    if (!noteForm.date) {
      return Swal.fire("Warning", "Please select a date", "warning");
    }

    const targetId = row?.enquiryId || enquiryId;
    if (!targetId) {
      return Swal.fire("Error", "Enquiry ID not found", "error");
    }

    setNoteSubmitting(true);
    try {
      if (editingNoteIndex !== null) {
        const currentList = Array.isArray(row?.discussionNotes)
          ? [...row.discussionNotes]
          : Array.isArray(row?.discussion_notes)
          ? [...row.discussion_notes]
          : [];

        const updated = currentList.map((item, idx) => {
          if (idx === editingNoteIndex) {
            return {
              ...item,
              note: noteForm.note.trim(),
              date: noteForm.date,
            };
          }
          return item;
        });

        await saveEnquiryDiscussionNotes(updated);

        setRows((prev) => ({
          ...prev,
          discussionNotes: updated,
          discussion_notes: updated,
        }));

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Discussion note updated successfully!",
          showConfirmButton: false,
          timer: 2000,
        });
        handleCloseNoteModal();
        fetchJobTitles();
      } else {
        let added = false;
        try {
          const addRes = await axios.post(
            `${baseurl}add_notes/${targetId}`,
            {
              note: noteForm.note.trim(),
              date: noteForm.date,
            },
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (addRes?.data?.success || addRes?.status === 200) {
            added = true;
          }
        } catch (err) {
          console.warn(
            "add_notes endpoint failed, trying update_enq fallback:",
            err
          );
        }

        if (!added) {
          const currentList = Array.isArray(row?.discussionNotes)
            ? [...row.discussionNotes]
            : Array.isArray(row?.discussion_notes)
            ? [...row.discussion_notes]
            : [];
          const newNoteObj = {
            note: noteForm.note.trim(),
            date: noteForm.date,
          };
          const updated = [...currentList, newNoteObj];
          await saveEnquiryDiscussionNotes(updated);
          setRows((prev) => ({
            ...prev,
            discussionNotes: updated,
            discussion_notes: updated,
          }));
        }

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Discussion note added successfully!",
          showConfirmButton: false,
          timer: 2000,
        });
        handleCloseNoteModal();
        fetchJobTitles();
      }
    } catch (error) {
      console.error("Save note error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          error?.message ||
          "Failed to save note",
        "error"
      );
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (indexToDelete) => {
    const result = await Swal.fire({
      title: "Delete this note?",
      text: `Are you sure you want to delete Note #${indexToDelete + 1}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const currentList = Array.isArray(row?.discussionNotes)
      ? [...row.discussionNotes]
      : Array.isArray(row?.discussion_notes)
      ? [...row.discussion_notes]
      : [];

    const updated = currentList.filter((_, idx) => idx !== indexToDelete);

    try {
      await saveEnquiryDiscussionNotes(updated);

      setRows((prev) => ({
        ...prev,
        discussionNotes: updated,
        discussion_notes: updated,
      }));

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Discussion note deleted successfully!",
        showConfirmButton: false,
        timer: 2000,
      });

      fetchJobTitles();
    } catch (error) {
      console.error("Delete note error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete note",
        "error"
      );
    }
  };
  const handleclick = () => {
    window.history.back();
  };
  const openCommentModalForReview = (reviewId) => {
    setSelectedReviewId(reviewId);
    setOpenCommentModal(true);
  };
  const closeCommentModal = () => {
    setOpenCommentModal(false);
    setCommentText("");
    setCommentImages([]);
    setSelectedReviewId(null);
  };
  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      return Swal.fire("Error!", "Review notes are required", "error");
    }
    if (!selectedReviewId) {
      return Swal.fire("Error!", "Review ID is required", "error");
    }
    try {
      setCommentLoading(true);
      const formData = new FormData();
      formData.append("enquiryId", row.enquiryId);
      formData.append("review_notes", commentText);
      formData.append("user_type", "Doctor");
      formData.append("reviewId", selectedReviewId);
      if (commentImages.length > 0) {
        commentImages.forEach((file) => {
          formData.append("images", file);
        });
      }
      const response = await axios.post(`${baseurl}addDoctorReview`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (response?.data?.success) {
        Swal.fire(
          "Success!",
          response?.data?.message || "Comment added successfully",
          "success",
        );
        closeCommentModal();
        fetchJobTitles();
      } else {
        Swal.fire(
          "Error!",
          response?.data?.message || "Failed to add comment",
          "error",
        );
      }
    } catch (error) {
      Swal.fire(
        "Error!",
        error?.response?.data?.message || "Failed to add comment",
        "error",
      );
    } finally {
      setCommentLoading(false);
    }
  };
  const doctorReviews = getDoctorReviews(row);
  // const renderReviewComments = (comments, reviewIndex) => {
  //   if (!comments || comments.length === 0) {
  //     return <p className="text-muted mb-0">No comments available</p>;
  //   }
  //   return comments.map((comment, index) => (
  //     <div className="col-md-12" key={comment._id || index}>
  //       <div className="card customstylecard">
  //         <div className="card-body">
  //           <div className="note-view">
  //             <h6>{comment.user_type} Note</h6>
  //           </div>
  //           <div className="experience-box">
  //             <ul className="experience-list">
  //               <li className="mb-0">
  //                 <div className="experience-user">
  //                   <div className="before-circle"></div>
  //                 </div>
  //                 <div className="experience-content">
  //                   <div className="timeline-content">
  //                     <a href="#/" className="name">
  //                       {comment.Notes}
  //                     </a>
  //                     {comment.images && comment.images.length > 0 && (
  //                       <div className="">
  //                         {comment.images.map((img, imgIndex) => (
  //                           <button
  //                             key={imgIndex}
  //                             type="button"
  //                             className="viewbtn me-2"
  //                             onClick={() =>
  //                               window.open(getFileUrl(img), "_blank")
  //                             }
  //                           >
  //                             View {imgIndex + 1}
  //                           </button>
  //                         ))}
  //                       </div>
  //                     )}
  //                     <div>Date - {formatReviewDate(comment)}</div>
  //                   </div>
  //                 </div>
  //               </li>
  //             </ul>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   ));
  // };
  const renderReviewComments = (comments, reviewIndex) => {
    if (!comments || comments.length === 0) {
      return <p className="text-muted mb-0">No comments available</p>;
    }
    return (
      <div className="col-md-12">
        <div className="accordion" id={`commentsAccordion${reviewIndex}`}>
          <div className="accordion-item border-0">
            <h2
              className="accordion-header"
              id={`commentsHeading${reviewIndex}`}
            >
              <button
                className="accordion-button customstylecard collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#commentsCollapse${reviewIndex}`}
                aria-expanded="false"
                aria-controls={`commentsCollapse${reviewIndex}`}
              >
                <span>Comments</span>
              </button>
            </h2>

            <div
              id={`commentsCollapse${reviewIndex}`}
              className="accordion-collapse collapse"
              aria-labelledby={`commentsHeading${reviewIndex}`}
              data-bs-parent={`#commentsAccordion${reviewIndex}`}
            >
              <div className="accordion-body p-0 pt-3">
                <div className="row gy-3">
                  {comments.map((comment, index) => (
                    <div className="col-md-12" key={comment._id || index}>
                      <div className="card customstylecard">
                        <div className="card-body">
                          <div className="note-view">
                            <h6>{comment.user_type} Note</h6>
                          </div>

                          <div className="experience-box">
                            <ul className="experience-list">
                              <li className="mb-0">
                                <div className="experience-user">
                                  <div className="before-circle"></div>
                                </div>

                                <div className="experience-content">
                                  <div className="timeline-content">
                                    <a href="#/" className="name">
                                      {comment.Notes}
                                    </a>

                                    {comment.images &&
                                      comment.images.length > 0 && (
                                        <div>
                                          {comment.images.map(
                                            (img, imgIndex) => (
                                              <button
                                                key={imgIndex}
                                                type="button"
                                                className="viewbtn me-2"
                                                onClick={() =>
                                                  window.open(
                                                    getFileUrl(img),
                                                    "_blank",
                                                  )
                                                }
                                              >
                                                View {imgIndex + 1}
                                              </button>
                                            ),
                                          )}
                                        </div>
                                      )}

                                    <div>
                                      Date - {formatReviewDate(comment)}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3 gy-3">
            <div className="col-md-12">
              <div className="topmainhd">
                <h6>
                  <i
                    class="fa-solid fa-arrow-left-long me-2"
                    onClick={handleclick}
                  ></i>
                  View Enquiry
                </h6>
              </div>
            </div>
            <div className="col-md-12 gy-0">
              <div className="main_content">
                <div className="row gx-3 gy-3">
                  <div className="col-md-4">
                    <div className="">
                      <h6>Enquiry Id</h6>
                      <p>{row.enquiryId}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>NIC / Passport</h6>
                      <p>{row.passport_num}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Phone No. / WhatsApp</h6>
                      <p>
                        {row.phoneCode}
                        {row.emergency_contact_no}
                      </p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Emergency Contact Number</h6>
                      {row.patient_emergency_contact_no ? (
                        <p>
                          {row.phoneCode}
                          {row.patient_emergency_contact_no}
                        </p>
                      ) : (
                        ""
                      )}
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Patient Name</h6>
                      <p>{row.name}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Gender</h6>
                      <p>{row.gender}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Age</h6>
                      <p>{row.age}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Enq status</h6>
                      <p>{row.enq_status}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Email</h6>
                      <p>{row.email}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Country</h6>
                      <p>{row.country}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Town</h6>
                      <p>{row.town}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Address</h6>
                      <p>{row.address}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Medical Reports & Documents</h6>
                      <div className="engpatimg enquiry-doc-list mt-0">
                        {getEnquiryDocuments(row).length > 0 ? (
                          getEnquiryDocuments(row).map((file, index) => {
                            const docName = getDocumentDisplayName(file, index);
                            return (
                            <div key={index} className="file-preview">
                              <a
                                href={getFileUrl(getDocumentPath(file))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="viewbtn viewbtn-filename"
                                title={docName}
                              >
                                {docName}
                              </a>
                            </div>
                            );
                          })
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Patient ID proof</h6>
                      <div className="engpatimg mt-0">
                        {Array.isArray(row?.patient_id_proof) &&
                          row.patient_id_proof.length > 0 &&
                          row.patient_id_proof.map((file, index) => (
                            <div key={index} className="file-preview">
                              <a
                                href={`${image}${file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="viewbtn"
                              >
                                View
                              </a>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Patient Profile</h6>
                      <div className="engpatimg mt-0">
                        {row.patient_Profile && (
                          <div className="viewbtn">
                            <a href={`${imageUrl}${row.patient_Profile}`}>
                              View
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Referral Name</h6>
                      <p>{row.Referral_Name}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Treatment Name</h6>
                      <p>{row.disease_name}</p>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div className="">
                      <h6>Treating In Country</h6>
                      <p>
                        {Array.isArray(row.treatingIn)
                          ? row.treatingIn.join(", ")
                          : row.treatingIn ||
                            row.treating_in_country ||
                            "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Staff & Coordinator Team Card */}
            <div className="col-md-12">
              <div className="main_content" style={{ padding: "18px 22px" }}>
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: "#e0f2fe",
                        color: "#0284c7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                      }}
                    >
                      <i className="fa-solid fa-user-gear"></i>
                    </div>
                    <div>
                      <h6 className="mb-0 fw-bold" style={{ fontSize: "15px" }}>
                        Assigned Staff & Coordinator Team
                      </h6>
                      <small className="text-muted" style={{ fontSize: "12px" }}>
                        Staff assigned to this Enquiry will automatically transfer to the patient record upon confirmation.
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary px-3 py-1.5 shadow-sm fw-semibold"
                    style={{
                      backgroundColor: "#0ba6df",
                      borderColor: "#0ba6df",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                    }}
                    onClick={() => setAssignStaffModalOpen(true)}
                  >
                    <i className="fa-solid fa-user-plus me-1.5"></i>
                    {coordinators.length > 0 || otherStaff.length > 0
                      ? "Manage Staff & Coordinator"
                      : "Assign Staff / Coordinator"}
                  </button>
                </div>

                <div className="row gx-3 gy-3">
                  {/* Coordinators Card */}
                  <div className="col-md-6 col-lg-4">
                    <div
                      style={{
                        border: "1px solid #bae6fd",
                        borderRadius: "10px",
                        padding: "14px 16px",
                        backgroundColor: "#f0f9ff",
                        height: "100%",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "#0284c7",
                            color: "#fff",
                            fontSize: "11px",
                            padding: "4px 8px",
                            borderRadius: "5px",
                          }}
                        >
                          <i className="fa-solid fa-user-tie me-1"></i>{" "}
                          {coordinators.length > 1
                            ? `Coordinators (${coordinators.length})`
                            : "Coordinator"}
                        </span>
                      </div>
                      {coordinators.length > 0 ? (
                        <div className="d-flex flex-column gap-3">
                          {coordinators.map((member) => (
                            <div key={member.userId || member.name}>
                              <div className="d-flex align-items-start justify-content-between gap-2">
                                <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: "14.5px" }}>
                                  {member.name}
                                </h6>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
                                  style={{ fontSize: "11px", fontWeight: 600 }}
                                  onClick={() => handleUnassignStaffMember(member)}
                                  title="Unassign coordinator"
                                >
                                  <i className="fa-solid fa-user-xmark me-1"></i> Unassign
                                </button>
                              </div>
                              {member.email && (
                                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "2px" }}>
                                  <i className="fa-regular fa-envelope me-1"></i> {member.email}
                                </div>
                              )}
                              {member.phone && (
                                <div style={{ fontSize: "12px", color: "#64748b" }}>
                                  <i className="fa-solid fa-phone me-1"></i> {member.phone}
                                </div>
                              )}
                              {member.assignedAt && (
                                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                                  Assigned: {new Date(member.assignedAt).toLocaleDateString("en-GB")}
                                  {member.assignedBy?.name ? ` by ${member.assignedBy.name}` : ""}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted fst-italic py-3" style={{ fontSize: "12.5px" }}>
                          No Coordinator assigned yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Other Care Team Members */}
                  <div className="col-md-6 col-lg-8">
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "14px 16px",
                        backgroundColor: "#f8fafc",
                        minHeight: "100%",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-bold text-dark small" style={{ fontSize: "13px" }}>
                          Care Team Members ({otherStaff.length})
                        </span>
                        {otherStaff.length > 0 && (
                          <small className="text-muted" style={{ fontSize: "11px" }}>
                            Doctors, Nurses, Physiotherapists & Staff
                          </small>
                        )}
                      </div>

                      {otherStaff.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                            gap: "10px",
                            maxHeight: "220px",
                            overflowY: "auto",
                          }}
                        >
                          {otherStaff.map((staff, sIdx) => {
                            const badgeStyle = getRoleBadgeStyle(staff.role);
                            return (
                              <div
                                key={sIdx}
                                style={{
                                  backgroundColor: "#fff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "8px",
                                  padding: "8px 12px",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                }}
                              >
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                  <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>
                                    {staff.name}
                                  </strong>
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: badgeStyle.bg,
                                      color: badgeStyle.text,
                                      border: `1px solid ${badgeStyle.border}`,
                                      fontSize: "10px",
                                      padding: "2px 6px",
                                    }}
                                  >
                                    {staff.role || "Staff"}
                                  </span>
                                </div>
                                {staff.phone && (
                                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                                    📞 {staff.phone}
                                  </div>
                                )}
                                {staff.email && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#64748b",
                                      textOverflow: "ellipsis",
                                      overflow: "hidden",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={staff.email}
                                  >
                                    ✉️ {staff.email}
                                  </div>
                                )}
                                {staff.notes && (
                                  <div style={{ fontSize: "10.5px", color: "#0369a1", marginTop: "2px" }}>
                                    📝 {staff.notes}
                                  </div>
                                )}
                                <div className="text-end mt-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
                                    style={{ fontSize: "10.5px", fontWeight: 600 }}
                                    onClick={() => handleUnassignStaffMember(staff)}
                                  >
                                    Unassign
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-muted fst-italic py-3 text-center" style={{ fontSize: "12.5px" }}>
                          No care team staff assigned yet. Click <b>"Assign Staff / Coordinator"</b> to assign nurses, doctors, or other staff.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-12">
              <div className="main_content">
                <div className="row gx-3">
                  <div className="col-md-12">
                    <div className="comnthis d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <h6 className="mb-0">Discussion Notes</h6>
                        {notesList.length > 0 && (
                          <span
                            className="badge bg-primary text-white"
                            style={{ fontSize: "11px", borderRadius: "10px" }}
                          >
                            {notesList.length}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                        style={{
                          fontSize: "12px",
                          padding: "5px 12px",
                          borderRadius: "6px",
                          fontWeight: 500,
                        }}
                        onClick={handleOpenAddNote}
                      >
                        <i className="fa-solid fa-plus"></i> Add Note
                      </button>
                    </div>

                    {notesList.length === 0 ? (
                      <div
                        className="text-center py-4 px-3"
                        style={{
                          background: "#f8fafc",
                          border: "1px dashed #cbd5e1",
                          borderRadius: "8px",
                        }}
                      >
                        <i
                          className="fa-regular fa-note-sticky text-muted mb-2 d-block"
                          style={{ fontSize: "28px" }}
                        ></i>
                        <p
                          className="text-muted mb-2"
                          style={{ fontSize: "13px" }}
                        >
                          No discussion notes recorded for this enquiry yet.
                        </p>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={handleOpenAddNote}
                        >
                          <i className="fa-solid fa-plus me-1"></i> Add First Note
                        </button>
                      </div>
                    ) : (
                      <div className="experience-box">
                        <ul className="experience-list">
                          {notesList.map((info, index) => {
                            const noteText = info?.note || info?.notes || "";
                            const noteDateStr = formatNoteDisplayDate(
                              info?.date
                            );
                            return (
                              <li
                                key={info?._id || info?.id || index}
                                className="mb-3"
                              >
                                <div className="experience-user">
                                  <div className="before-circle"></div>
                                </div>
                                <div className="experience-content">
                                  <div
                                    className="p-3"
                                    style={{
                                      background: "#ffffff",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "8px",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                    }}
                                  >
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                      <div className="d-flex align-items-center gap-2">
                                        <span
                                          className="badge"
                                          style={{
                                            background: "#0ea5e9",
                                            color: "#ffffff",
                                            fontSize: "11px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          Note #{index + 1}
                                        </span>
                                        <span
                                          className="text-muted d-inline-flex align-items-center gap-1"
                                          style={{ fontSize: "12px" }}
                                        >
                                          <i className="fa-regular fa-calendar-days text-primary"></i>
                                          {noteDateStr}
                                        </span>
                                      </div>
                                      <div className="d-flex align-items-center gap-1">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-primary"
                                          title="Edit Note"
                                          style={{
                                            padding: "2px 8px",
                                            fontSize: "11.5px",
                                            borderRadius: "4px",
                                          }}
                                          onClick={() =>
                                            handleOpenEditNote(info, index)
                                          }
                                        >
                                          <i className="fa-solid fa-pen-to-square me-1"></i>{" "}
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger"
                                          title="Delete Note"
                                          style={{
                                            padding: "2px 8px",
                                            fontSize: "11.5px",
                                            borderRadius: "4px",
                                          }}
                                          onClick={() =>
                                            handleDeleteNote(index)
                                          }
                                        >
                                          <i className="fa-solid fa-trash-can me-1"></i>{" "}
                                          Delete
                                        </button>
                                      </div>
                                    </div>

                                    <div
                                      style={{
                                        color: "#334155",
                                        fontSize: "13px",
                                        lineHeight: 1.55,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                      }}
                                    >
                                      {noteText}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {doctorReviews.length > 0 && (
              <div className="col-md-12">
                <div className="main_content">
                  <div className="row gx-3">
                    <div className="col-md-12">
                      <div className="comnthis">
                        <h6>Doctor Review</h6>
                      </div>
                      {doctorReviews.map((review, reviewIndex) => (
                        <div
                          className="forborder mb-3"
                          key={review._id || reviewIndex}
                        >
                          <div className="row gx-3 gy-3">
                            <div className="col-md-2">
                              <div className="">
                                <h6>Date</h6>
                                <p>{formatReviewDate(review)}</p>
                              </div>
                            </div>
                            <div className="col-md-2">
                              <div className="">
                                <h6>Subject</h6>
                                <p>{review?.title || review?.Title || "-"}</p>
                              </div>
                            </div>
                            <div className="col-md-2">
                              <div className="">
                                <h6>Notes</h6>
                                <p>{review?.review_notes || "-"}</p>
                              </div>
                            </div>
                            <div className="col-md-3">
                              <div className="">
                                <h6>Recommendation</h6>
                                <p>
                                  {review?.Recommendations ||
                                    review?.recommendations ||
                                    "-"}
                                </p>
                              </div>
                            </div>
                            <div className="col-md-3">
                              <div className="">
                                <h6>Documentation</h6>
                                {review?.images?.length > 0 ? (
                                  review.images.map((img, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      className="viewbtn me-2"
                                      onClick={() =>
                                        window.open(getFileUrl(img), "_blank")
                                      }
                                    >
                                      View {index + 1}
                                    </button>
                                  ))
                                ) : (
                                  <span>-</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="row gx-3 gy-3 mt-2">
                            <div className="col-md-12 gy-0">
                              <div className="mb-3">
                                <button
                                  className="add-button approvebtn"
                                  type="button"
                                  onClick={() =>
                                    openCommentModalForReview(
                                      review._id || review.id,
                                    )
                                  }
                                >
                                  Add Comment
                                </button>
                              </div>
                              <div className="row gy-3">
                                {renderReviewComments(
                                  review.comments,
                                  reviewIndex,
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {row.patient_relation ? (
              <div className="col-md-12">
                <div className="main_content">
                  <div className="comnthis">
                    {row.patient_relation ? <h6>Attendant Details</h6> : ""}
                  </div>
                  <div className="row gx-3 gy-3">
                    <div className="col-md-4">
                      <div className="">
                        <h6>Attendant Full Name</h6>
                        <p>{row.patient_relation_name}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="">
                        <h6>Relationship with Patient</h6>
                        <p>{row.patient_relation}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="">
                        <h6>Attendant Contact Number</h6>
                        <p>
                          {row.phoneCode}
                          {row.patient_relation_no}
                        </p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="">
                        <h6>Attendant ID Proof</h6>
                        <div className="engpatimg">
                          {Array.isArray(row.patient_relation_id) &&
                          row.patient_relation_id.length > 0 ? (
                            row.patient_relation_id.map((file, index) => (
                              <div key={index} className="doc-box viewbtn">
                                <a href={`${image}${file}`}>View</a>
                              </div>
                            ))
                          ) : (
                            <img src={avtar} alt="No Document" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="">
                        <h6>Attendant Address</h6>
                        <p>{row.patient_relation_address}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={openCommentModal}
        onClose={closeCommentModal}
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6>Add Comment</h6>
          </div>
          <div className="cross-icon" onClick={closeCommentModal}>
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="main-box">
          <Box noValidate component="form" className="contact-form">
            <div className="row gx-3 gy-3">
              <div className="col-md-12">
                <div className="set-field">
                  <label>
                    Add Comment <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter review notes..."
                  />
                </div>
              </div>
              <div className="col-md-12">
                <div className="set-field">
                  <label>Upload Images</label>
                  <input
                    type="file"
                    className="form-control"
                    multiple
                    accept="image/*"
                    onChange={(e) =>
                      setCommentImages(Array.from(e.target.files))
                    }
                  />
                  {commentImages.length > 0 && (
                    <small className="text-muted mt-1 d-block">
                      {commentImages.length} file(s) selected
                    </small>
                  )}
                </div>
              </div>
            </div>
            <DialogActions className="submit-main mt-3">
              <Button
                variant="contained"
                onClick={handleSubmitComment}
                disabled={commentLoading}
              >
                {commentLoading ? "Submitting..." : "Submit"}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <AssignEnquiryStaffModal
        open={assignStaffModalOpen}
        onClose={() => setAssignStaffModalOpen(false)}
        enquiry={row}
        onSuccess={() => {
          fetchJobTitles();
        }}
      />

      {/* Discussion Note Edit / Add Modal */}
      <Dialog
        fullWidth
        maxWidth="sm"
        open={noteModalOpen}
        onClose={handleCloseNoteModal}
      >
        <div className="main-card-header">
          <div className="note-hd">
            <h6>
              {editingNoteIndex !== null
                ? `Edit Discussion Note (Note #${editingNoteIndex + 1})`
                : "Add Discussion Note"}
            </h6>
          </div>
          <div className="cross-icon" onClick={handleCloseNoteModal}>
            <i className="fa-solid fa-xmark"></i>
          </div>
        </div>
        <DialogContent className="main-box">
          <Box
            component="form"
            className="contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveNote();
            }}
          >
            <div className="row gx-3 gy-3">
              <div className="col-md-12">
                <div className="set-field">
                  <label>
                    Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={noteForm.date}
                    onChange={(e) =>
                      setNoteForm({ ...noteForm, date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="col-md-12">
                <div className="set-field">
                  <label>
                    Note Content <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={noteForm.note}
                    onChange={(e) =>
                      setNoteForm({ ...noteForm, note: e.target.value })
                    }
                    placeholder="Enter discussion notes or follow-up details..."
                    required
                  />
                </div>
              </div>
            </div>
            <DialogActions className="submit-main mt-3">
              <Button
                type="button"
                variant="outlined"
                color="inherit"
                onClick={handleCloseNoteModal}
                disabled={noteSubmitting}
                className="me-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={noteSubmitting}
              >
                {noteSubmitting
                  ? "Saving..."
                  : editingNoteIndex !== null
                  ? "Update Note"
                  : "Save Note"}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
