import React from "react";
import {
  formatFileSize,
  formatMessageDate,
  getPriorityBadgeProps,
} from "../../services/directorMessagesApi";
import "./DirectorMessages.css";

export default function DirectorMessageModal({
  isOpen,
  message,
  onClose,
  onDismiss,
}) {
  if (!isOpen || !message) return null;

  const priority = String(message.priority || "NORMAL").toUpperCase();
  const badgeProps = getPriorityBadgeProps(priority);
  const senderName = message.sender?.name || "Director";
  const senderRole = message.sender?.role || "Management";
  const initials = senderName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : [];

  const handleDismissAndClose = () => {
    if (onDismiss && message._id) {
      onDismiss(message._id);
    }
    if (onClose) {
      onClose();
    }
  };

  const getFileIcon = (type = "", name = "") => {
    const t = String(type).toLowerCase();
    const n = String(name).toLowerCase();
    if (t.includes("pdf") || n.endsWith(".pdf")) return "fa-file-pdf-o text-danger";
    if (
      t.includes("image") ||
      n.endsWith(".jpg") ||
      n.endsWith(".jpeg") ||
      n.endsWith(".png") ||
      n.endsWith(".webp")
    )
      return "fa-file-image-o text-primary";
    if (t.includes("word") || n.endsWith(".doc") || n.endsWith(".docx"))
      return "fa-file-word-o text-info";
    if (t.includes("excel") || t.includes("sheet") || n.endsWith(".xls") || n.endsWith(".xlsx"))
      return "fa-file-excel-o text-success";
    if (t.includes("zip") || t.includes("rar") || n.endsWith(".zip"))
      return "fa-file-archive-o text-warning";
    return "fa-file-text-o text-secondary";
  };

  const headerClass =
    priority === "SOS"
      ? "dm-modal-header"
      : priority === "HIGH"
      ? "dm-modal-header dm-modal-header-high"
      : "dm-modal-header dm-modal-header-normal";

  return (
    <div className="dm-modal-backdrop" onClick={onClose}>
      <div
        className="dm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dm-modal-title"
      >
        {/* Header */}
        <div className={headerClass}>
          <div className="dm-modal-header-title-box">
            <span className={badgeProps.className}>
              <i className={`fa ${badgeProps.icon}`}></i> {badgeProps.label}
            </span>
            <h5 id="dm-modal-title">{message.title || "Director Announcement"}</h5>
          </div>
          <button
            type="button"
            className="dm-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="dm-modal-body">
          {/* Metadata Row */}
          <div className="dm-modal-meta-row">
            <div className="dm-modal-sender-info">
              <div className="dm-sender-avatar">{initials}</div>
              <div className="dm-sender-details">
                <span className="dm-sender-name">{senderName}</span>
                <span className="dm-sender-role">{senderRole}</span>
              </div>
            </div>
            <div className="dm-modal-time">
              <i className="fa fa-clock-o"></i>{" "}
              {formatMessageDate(message.createdAt)}
            </div>
          </div>

          {/* Target Audience Badge */}
          {message.targetType === "ROLES" && Array.isArray(message.targetRoles) && message.targetRoles.length > 0 && (
            <div className="mb-3 p-2 bg-light border rounded d-flex flex-wrap align-items-center gap-1">
              <span className="small text-muted fw-semibold me-1">
                <i className="fa fa-users text-danger me-1"></i> Target Roles:
              </span>
              {message.targetRoles.map((r, i) => (
                <span key={i} className="badge bg-white text-dark border" style={{ fontSize: "11px" }}>
                  {r}
                </span>
              ))}
            </div>
          )}

          {/* Message Content */}
          <div className="dm-modal-message-box">
            {message.message || "No content provided."}
          </div>

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="dm-modal-attachments-section">
              <h6 className="dm-attachments-heading">
                <i className="fa fa-paperclip"></i> Attached Documents (
                {attachments.length})
              </h6>
              <div className="dm-attachments-grid">
                {attachments.map((att, idx) => {
                  const fileName = att.originalName || att.fileName || `Attachment-${idx + 1}`;
                  const iconClass = getFileIcon(att.fileType, fileName);
                  return (
                    <a
                      key={att._id || idx}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dm-attachment-card"
                      download={fileName}
                    >
                      <div className="dm-attachment-left">
                        <i className={`fa ${iconClass} dm-attachment-icon`}></i>
                        <div className="dm-attachment-meta">
                          <span className="dm-attachment-name" title={fileName}>
                            {fileName}
                          </span>
                          <span className="dm-attachment-size">
                            {formatFileSize(att.fileSize)}
                          </span>
                        </div>
                      </div>
                      <span className="dm-download-btn">
                        <i className="fa fa-download"></i> Download
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dm-modal-footer">
          <button
            type="button"
            className="dm-btn-ghost-close"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="dm-btn-primary-close"
            onClick={handleDismissAndClose}
          >
            <i className="fa fa-check-circle"></i> Mark as Read & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
