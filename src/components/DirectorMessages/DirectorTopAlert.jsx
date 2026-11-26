import React, { useCallback, useEffect, useState } from "react";
import {
  dismissDirectorMessage,
  fetchActiveDirectorMessages,
} from "../../services/directorMessagesApi";
import { onDirectorMessage } from "../../services/sosSocket";
import { playDirectorAlertChime } from "../../services/sosAlarm";
import DirectorMessageModal from "./DirectorMessageModal";
import Swal from "sweetalert2";
import "./DirectorMessages.css";

export default function DirectorTopAlert() {
  const userRole = (localStorage.getItem("Role") || "").toUpperCase();
  const isReferralUser = userRole === "REFERRAL";

  const [activeMessages, setActiveMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState(null);

  // Load active un-dismissed messages from backend
  const loadActiveMessages = useCallback(async () => {
    if (isReferralUser) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await fetchActiveDirectorMessages();
      if (Array.isArray(data)) {
        setActiveMessages(data);
        setCurrentIndex(0);
        // If there's an active message with isPopup === true, pop it up
        const popupMsg = data.find((m) => m?.isPopup && !m?.isDismissed);
        if (popupMsg) {
          setModalMessage(popupMsg);
          setIsModalOpen(true);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch active director messages:", err);
    }
  }, []);

  useEffect(() => {
    loadActiveMessages();
  }, [loadActiveMessages]);

  // Real-time Socket.IO handler
  useEffect(() => {
    if (isReferralUser) return undefined;
    const unsubscribe = onDirectorMessage((newMsg) => {
      if (!newMsg) return;
      console.log("New director message received in top alert:", newMsg);

      // Play alert chime if priority is SOS
      if (String(newMsg.priority || "").toUpperCase() === "SOS") {
        playDirectorAlertChime();
      }

      setActiveMessages((prev) => {
        // Prevent duplicate
        const exists = prev.some((m) => String(m._id) === String(newMsg._id));
        if (exists) return prev;
        return [newMsg, ...prev];
      });

      // Show popup if requested
      if (newMsg.isPopup !== false) {
        setModalMessage(newMsg);
        setIsModalOpen(true);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Dismiss message
  const handleDismiss = async (id) => {
    if (!id) return;
    try {
      await dismissDirectorMessage(id);
      setActiveMessages((prev) => {
        const next = prev.filter((m) => String(m._id) !== String(id));
        if (currentIndex >= next.length && next.length > 0) {
          setCurrentIndex(next.length - 1);
        }
        return next;
      });

      // Notify other components (e.g. DirectorMessages page)
      window.dispatchEvent(
        new CustomEvent("omca:director-message-dismissed", { detail: { id } })
      );

      const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
      Toast.fire({
        icon: "success",
        title: "Director message dismissed",
      });
    } catch (err) {
      console.error("Failed to dismiss director message:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err?.response?.data?.message || "Failed to dismiss message",
      });
    }
  };

  if (!activeMessages.length) {
    return (
      <DirectorMessageModal
        isOpen={isModalOpen}
        message={modalMessage}
        onClose={() => setIsModalOpen(false)}
        onDismiss={handleDismiss}
      />
    );
  }

  const currentMsg = activeMessages[currentIndex] || activeMessages[0];
  if (isReferralUser || !currentMsg) return null;

  const priority = String(currentMsg.priority || "NORMAL").toUpperCase();
  const bannerClass =
    priority === "SOS"
      ? "dm-top-banner"
      : priority === "HIGH"
      ? "dm-top-banner dm-top-banner-high"
      : "dm-top-banner dm-top-banner-normal";

  const indicatorClass =
    priority === "SOS"
      ? "dm-sos-indicator"
      : priority === "HIGH"
      ? "dm-sos-indicator dm-sos-indicator-high"
      : "dm-sos-indicator dm-sos-indicator-normal";

  const indicatorText =
    priority === "SOS"
      ? "SOS DIRECTOR ALERT"
      : priority === "HIGH"
      ? "HIGH PRIORITY"
      : "DIRECTOR NOTICE";

  const attachmentsCount = Array.isArray(currentMsg.attachments)
    ? currentMsg.attachments.length
    : 0;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeMessages.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeMessages.length) % activeMessages.length);
  };

  const handleOpenDetails = () => {
    setModalMessage(currentMsg);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className={bannerClass} role="alert" aria-live="assertive">
        <div className="dm-top-banner-container">
          <div className="dm-banner-left">
            <span className={indicatorClass}>
              <i className="fa fa-bell"></i> {indicatorText}
            </span>
            <div className="dm-banner-content">
              <div className="dm-banner-heading">
                <span className="dm-banner-title">
                  {currentMsg.title || "Message from Director"}
                </span>
                {currentMsg.sender?.name && (
                  <span className="dm-banner-sender">
                    By: {currentMsg.sender.name} ({currentMsg.sender.role || "Admin"})
                  </span>
                )}
                {attachmentsCount > 0 && (
                  <span className="dm-banner-attachments-chip">
                    <i className="fa fa-paperclip"></i> {attachmentsCount} {attachmentsCount === 1 ? "file" : "files"}
                  </span>
                )}
              </div>
              <p className="dm-banner-message">{currentMsg.message}</p>
            </div>
          </div>

          <div className="dm-banner-actions">
            {activeMessages.length > 1 && (
              <div className="dm-banner-pagination">
                <button
                  type="button"
                  className="dm-page-btn"
                  onClick={handlePrev}
                  title="Previous message"
                >
                  <i className="fa fa-chevron-left"></i>
                </button>
                <span>
                  {currentIndex + 1} / {activeMessages.length}
                </span>
                <button
                  type="button"
                  className="dm-page-btn"
                  onClick={handleNext}
                  title="Next message"
                >
                  <i className="fa fa-chevron-right"></i>
                </button>
              </div>
            )}

            <button
              type="button"
              className="dm-btn-view"
              onClick={handleOpenDetails}
            >
              <i className="fa fa-eye"></i> View Full Message
            </button>

            <button
              type="button"
              className="dm-btn-dismiss"
              onClick={() => handleDismiss(currentMsg._id)}
              title="Close & Mark as Read"
            >
              <i className="fa fa-check"></i> Close
            </button>
          </div>
        </div>
      </div>

      <DirectorMessageModal
        isOpen={isModalOpen}
        message={modalMessage || currentMsg}
        onClose={() => setIsModalOpen(false)}
        onDismiss={handleDismiss}
      />
    </>
  );
}
