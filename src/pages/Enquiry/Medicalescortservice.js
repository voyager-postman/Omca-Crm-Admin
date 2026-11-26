import React from "react";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { AdminBaseUrl, baseu11, baseurl, image, imageUrl } from "../../Basurl/Baseurl";
import { markRecordRead } from "../../services/unreadApi";
import avtar from "../../img/avtarImg.jpg";
import { Box, Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import Swal from "sweetalert2";
import CameraFileUpload from "../../components/Common/CameraFileUpload";
// 🔹 file type check
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
        _id: row._id || row.id,
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

// 🔹 reusable preview component
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

export default function Medicalescortservice() {
  const location = useLocation();
  const [row, setRows] = useState("");
  const [openCommentModal, setOpenCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentImages, setCommentImages] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);
  console.log(location.state);
  useEffect(() => {
    const enquiryId = location.state?.enquiryId;
    if (enquiryId) markRecordRead("enquiries", enquiryId);
  }, [location.state?.enquiryId]);
  const fetchJobTitles = async () => {
    const payload = {
      id: location.state.id,
      type: "PatientQuery",
    };
    try {
      const response = await axios.post(
        `https://omcacrm.com/omca/api/crm/other_enquiry_details`,
        payload,
      );
      if (response.data.success) {
        let data = response.data.data;
        const enquiryId = location.state?.enquiryId || data?.enquiryId;
        if (enquiryId) {
          try {
            const enqRes = await axios.get(`${baseurl}get_Enq/${enquiryId}`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json",
              },
            });
            if (enqRes.data?.success && enqRes.data?.detail) {
              data = {
                ...data,
                enquiryId: data.enquiryId || enqRes.data.detail.enquiryId,
                doctorReview:
                  enqRes.data.detail.doctorReview ?? data.doctorReview,
                doctor_review:
                  enqRes.data.detail.doctorReview ?? data.doctor_review,
              };
            }
          } catch (enqError) {
            console.error("Error fetching enquiry doctor review:", enqError);
          }
        }
        setRows(data);
      } else {
        console.error("Failed to fetch job titles:", response.data.message);
      }
    } catch (error) {
      console.error("Error fetching job titles:", error);
    }
  };
  useEffect(() => {
    fetchJobTitles();
  }, []);
  const handleclick = () => {
    window.history.back();
  };

  const addcomment = (reviewId) => {
    setSelectedReviewId(reviewId);
    setCommentText("");
    setCommentImages([]);
    setOpenCommentModal(true);
  };

  const closeCommentModal = () => {
    setOpenCommentModal(false);
    setCommentText("");
    setCommentImages([]);
    setSelectedReviewId(null);
  };

  const handleImageChange = (e) => {
    setCommentImages(Array.from(e.target.files || []));
  };

  const userType = localStorage.getItem("Role");

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      return Swal.fire("Error", "Comment is required", "warning");
    }
    const reviewId =
      selectedReviewId ||
      row?.doctor_review?.id ||
      row?.doctorReview?.id ||
      row?.doctorReview?._id ||
      row?.doctor_review?._id;
    if (!reviewId) {
      return Swal.fire("Error!", "Review ID is required", "error");
    }
    try {
      setCommentLoading(true);
      const formData = new FormData();
      formData.append("review_id", reviewId);
      formData.append("comment", commentText);
      formData.append("user_type", userType);
      commentImages.forEach((file) => {
        formData.append("images[]", file);
      });
      const res = await axios.post(
        `${AdminBaseUrl}review/comment/add`,
        formData,
      );
      if (res?.data?.success) {
        Swal.fire("Success", "Comment added", "success");
        closeCommentModal();
        fetchJobTitles();
      }
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Something went wrong",
        "error",
      );
    } finally {
      setCommentLoading(false);
    }
  };
  const doctorReviews = getDoctorReviews(row);
  const renderReviewComments = (comments) => {
    if (!comments || comments.length === 0) {
      return <p className="text-muted mb-0">No comments available</p>;
    }
    return comments.map((comment, index) => (
      <div className="col-md-12" key={comment._id || index}>
        <div className="card customstylecard">
          <div className="card-body">
            <div className="note-view">
              <h6>{comment.user_type || "User"} Note</h6>
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
                      {comment.images && comment.images.length > 0 && (
                        <div className="">
                          {comment.images.map((img, imgIndex) => (
                            <button
                              key={imgIndex}
                              type="button"
                              className="viewbtn me-2"
                              onClick={() =>
                                window.open(getFileUrl(img), "_blank")
                              }
                            >
                              View {imgIndex + 1}
                            </button>
                          ))}
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
    ));
  };
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row gx-3 gy-3">
            <div className="col-md-12">
              <div className="topmainhd">
                <h6>
                  <i class="fa-solid fa-arrow-left-long me-2"
                    onClick={handleclick}></i>
                  View Treatment Estimate
                </h6>
              </div>
            </div>
            <div className="col-md-12 gy-0">
              <div className="main_content">
                <div className="row gx-3 gy-3">
                  <div className="col-md-4">
                    <div className="">
                      <h6>Enquiry Id</h6>
                      <p>{row?.enquiryId}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Treatment</h6>
                      <p>{row?.treatment}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Country</h6>
                      <p>{row.country}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Name</h6>
                      <p>{row.name}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Email</h6>
                      <p>{row.email}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Phone Number</h6>
                      <p>{row.phoneCode}{row.phone}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>WhatsApp Number</h6>
                      <p>{row.phoneCode}{row?.whatsapp}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Description</h6>
                      <p>{row.message}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Passport Number</h6>
                      <p>{row.passport_number}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="">
                      <h6>Treating In Country</h6>
                      <p>{row.treating_in_country}</p>
                    </div>
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
                            <div className="col-md-12">
                              <div className="docre-hd">
                                <div className="comnthis">
                                  <h6 className="mb-0">Comments</h6>
                                </div>
                                <button
                                  className="add-button"
                                  type="button"
                                  onClick={() =>
                                    addcomment(review._id || review.id)
                                  }
                                >
                                  Add Comment
                                </button>
                              </div>
                              <div className="row gy-3">
                                {renderReviewComments(review.comments)}
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
            <div className="col-md-12">
              <div className="main_content">
                <div className="row gx-3 gy-3">
                  <div className="col-md-12">
                    <div className="comnthis">
                      <h6>Reports</h6>
                    </div>
                  </div>
                  <div className="col-md-4">
                    {Array.isArray(row?.reports) && row.reports.length > 0 ? (
                      row.reports.map((rep, index) =>
                        rep?.report ? (
                          <button
                            key={index}
                            type="button"
                            className="viewbtn"
                            onClick={() => window.open(rep.report, "_blank")}
                          >
                            View
                          </button>
                        ) : null
                      )
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              </div>
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
            <Box component="form">
              <div className="row gx-3">
                <div className="col-md-12">
                  <div className="field-set">
                    <label>Comment<span className="text-danger">*</span></label>
                    <textarea
                      className="form-control"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-12">
                  <div className="field-set">
                    <CameraFileUpload
                      label={
                        <>
                          Upload Images<span className="text-danger">*</span>
                        </>
                      }
                      files={commentImages || []}
                      onChange={handleImageChange}
                      multiple={true}
                      accept="image/*,.pdf,application/pdf"
                      helperText="Take pictures or select images from device"
                    />
                  </div>
                </div>
              </div>
              <DialogActions className="submit-main">
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
      </div>
    </>
  );
}
