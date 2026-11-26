import React, { useState, useRef, useEffect } from "react";
import "./CameraFileUpload.css";

/**
 * CameraFileUpload
 * Reusable component for Tab, Mobile, and Desktop CRM workflows.
 * Enables both:
 * 1. Choosing files/documents/images from device storage/gallery.
 * 2. Taking pictures directly with device camera (Native camera on mobile/tablet or Live WebCam modal).
 *
 * Supports multiple or single file mode, preview thumbnails, remove action, and full backward compatibility.
 */
const CameraFileUpload = ({
  files,
  setFiles,
  onChange,
  onFilesChange,
  multiple = true,
  accept = "image/*,.pdf,application/pdf",
  label = "",
  required = false,
  helperText = "",
  buttonText = "",
  cameraText = "Take Photo",
  disabled = false,
  showPreview = true,
  name = "files",
  id,
  className = "",
  maxFiles = 20,
}) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Normalize files into array
  const currentFileList = Array.isArray(files)
    ? files.filter(Boolean)
    : files
      ? [files]
      : [];

  const [previewUrls, setPreviewUrls] = useState({});
  const [lightboxImg, setLightboxImg] = useState(null);

  // Webcam modal state (for desktop / laptop)
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [webcamSnapshot, setWebcamSnapshot] = useState(null);
  const [webcamError, setWebcamError] = useState("");
  const [facingMode, setFacingMode] = useState("environment"); // default rear camera if available

  // Generate / revoke object URLs for image thumbnails
  useEffect(() => {
    const urls = {};
    currentFileList.forEach((file, idx) => {
      if (file instanceof Blob || file instanceof File) {
        if (file.type && file.type.startsWith("image/")) {
          try {
            urls[idx] = URL.createObjectURL(file);
          } catch (e) {
            console.error("Error creating preview URL:", e);
          }
        }
      } else if (typeof file === "string") {
        urls[idx] = file;
      }
    });
    setPreviewUrls(urls);

    return () => {
      Object.values(urls).forEach((u) => {
        if (typeof u === "string" && u.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(u);
          } catch (e) {}
        }
      });
    };
  }, [files]);

  // Dispatch change updates to parent
  const notifyChange = (newFiles) => {
    const safeFiles = Array.isArray(newFiles) ? newFiles : [newFiles];
    const finalValue = multiple ? safeFiles : safeFiles[0] || null;

    if (typeof setFiles === "function") {
      setFiles(finalValue);
    }
    if (typeof onFilesChange === "function") {
      onFilesChange(finalValue);
    }
    if (typeof onChange === "function") {
      // Provide standard synthetic event shape for existing handlers
      const syntheticEvent = {
        target: {
          name: name || "files",
          files: safeFiles,
          value: "",
        },
        currentTarget: {
          name: name || "files",
          files: safeFiles,
          value: "",
        },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent, finalValue);
    }
  };

  // Add files to current collection (deduplicating by name & size)
  const appendFiles = (incomingList, isFromCamera = false) => {
    const newItems = Array.from(incomingList || []).map((f) => {
      if (isFromCamera && f instanceof File) {
        try {
          f.__isCameraCapture = true;
        } catch (e) {}
      }
      return f;
    });

    if (!multiple) {
      notifyChange(newItems.slice(0, 1));
      return;
    }

    const existing = [...currentFileList];
    newItems.forEach((newItem) => {
      const isDuplicate = existing.some(
        (ex) =>
          ex instanceof File &&
          newItem instanceof File &&
          ex.name === newItem.name &&
          ex.size === newItem.size &&
          ex.lastModified === newItem.lastModified,
      );
      if (!isDuplicate && existing.length < maxFiles) {
        existing.push(newItem);
      }
    });

    notifyChange(existing);
  };

  // Remove individual file by index
  const removeFileAtIndex = (indexToRemove, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!multiple) {
      notifyChange([]);
      return;
    }
    const updated = currentFileList.filter((_, idx) => idx !== indexToRemove);
    notifyChange(updated);
  };

  // Trigger file manager / gallery
  const handleOpenStorage = () => {
    if (disabled) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Check if device is Mobile or Tablet (touch-enabled handheld)
  const isTouchDevice = () => {
    if (typeof window === "undefined") return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
      Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );
  };

  // Trigger camera capture
  const handleOpenCamera = () => {
    if (disabled) return;

    // Mobile / Tablet: Native camera via capture="environment" provides highest resolution,
    // optical auto-focus, flash, and immediate device integration without permission hiccups.
    if (isTouchDevice()) {
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
        cameraInputRef.current.click();
      }
      return;
    }

    // Desktop / Laptop: Launch interactive webcam modal if WebRTC is available
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      setShowWebcamModal(true);
      setWebcamSnapshot(null);
      setWebcamError("");
      startWebcamStream("environment");
    } else {
      // Fallback: Trigger camera input
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
        cameraInputRef.current.click();
      }
    }
  };

  // Start webcam video stream
  const startWebcamStream = async (mode = "environment") => {
    try {
      stopWebcamStream();
      setWebcamError("");
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to any available video camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Webcam access error:", err);
      setWebcamError(
        "Could not access camera. Please allow camera permissions or use 'Upload Files'.",
      );
    }
  };

  // Stop webcam tracks cleanly
  const stopWebcamStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Close webcam modal
  const handleCloseWebcam = () => {
    stopWebcamStream();
    setShowWebcamModal(false);
    setWebcamSnapshot(null);
    setWebcamError("");
  };

  // Capture frame from webcam
  const handleCaptureWebcam = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setWebcamSnapshot(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace("T", "_")
          .split(".")[0];
        const fileName = `camera_photo_${timestamp}.jpg`;
        const capturedFile = new File([blob], fileName, { type: "image/jpeg" });
        capturedFile.__isCameraCapture = true;
        setWebcamSnapshot({ dataUrl, file: capturedFile });
      },
      "image/jpeg",
      0.92,
    );
  };

  // Confirm webcam photo
  const handleUseWebcamPhoto = () => {
    if (webcamSnapshot && webcamSnapshot.file) {
      appendFiles([webcamSnapshot.file], true);
    }
    handleCloseWebcam();
  };

  // Retake webcam photo
  const handleRetakeWebcam = () => {
    setWebcamSnapshot(null);
    startWebcamStream(facingMode);
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopWebcamStream();
    };
  }, []);

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadBtnText =
    buttonText || (multiple ? "Upload Files" : "Upload File");

  return (
    <div className={`cfu-container ${className}`}>
      {/* Optional Header / Label */}
      {label && (
        <div className="cfu-header">
          <label className="cfu-label">
            {label}
            {required && <span className="cfu-required">*</span>}
          </label>
          {multiple && currentFileList.length > 0 && (
            <span className="cfu-count-badge">
              {currentFileList.length} {currentFileList.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons: Choose File + Take Photo */}
      <div className="cfu-actions-bar">
        <button
          type="button"
          className="cfu-btn cfu-btn-upload"
          onClick={handleOpenStorage}
          disabled={disabled}
          title="Browse and select documents or images"
        >
          <i className="fa-solid fa-cloud-arrow-up"></i>
          <span>{uploadBtnText}</span>
        </button>

        <button
          type="button"
          className="cfu-btn cfu-btn-camera"
          onClick={handleOpenCamera}
          disabled={disabled}
          title="Take picture directly using device camera"
        >
          <i className="fa-solid fa-camera"></i>
          <span>{cameraText}</span>
        </button>
      </div>

      {/* Hidden File Input for Storage / Gallery */}
      <input
        ref={fileInputRef}
        type="file"
        id={id}
        name={name}
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            appendFiles(e.target.files, false);
          }
        }}
      />

      {/* Hidden File Input for Direct Native Camera Capture (Mobile/Tablet) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            appendFiles(e.target.files, true);
          }
        }}
      />

      {/* Helper text */}
      {helperText ? (
        <p className="cfu-helper-text">{helperText}</p>
      ) : (
        <p className="cfu-helper-text">
          Upload documents or take photos using device camera (JPG, PNG, PDF)
        </p>
      )}

      {/* Visual File Preview Cards */}
      {showPreview && currentFileList.length > 0 && (
        <div className="cfu-preview-grid">
          {currentFileList.map((file, idx) => {
            const isImg =
              (file?.type && file.type.startsWith("image/")) ||
              previewUrls[idx];
            const isPdf =
              file?.type === "application/pdf" ||
              (file?.name && file.name.toLowerCase().endsWith(".pdf"));
            const fileName = file?.name || `File ${idx + 1}`;
            const isCamera = Boolean(file?.__isCameraCapture);

            return (
              <div key={idx} className="cfu-preview-card">
                <button
                  type="button"
                  className="cfu-btn-remove"
                  onClick={(e) => removeFileAtIndex(idx, e)}
                  title="Remove this file"
                  aria-label="Remove file"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>

                <div
                  className="cfu-thumb-container"
                  onClick={() => {
                    if (isImg && previewUrls[idx]) {
                      setLightboxImg({
                        url: previewUrls[idx],
                        name: fileName,
                      });
                    }
                  }}
                  title={isImg ? "Click to view full image" : fileName}
                >
                  {isImg && previewUrls[idx] ? (
                    <img
                      src={previewUrls[idx]}
                      alt={fileName}
                      className="cfu-thumb-img"
                    />
                  ) : isPdf ? (
                    <i className="fa-solid fa-file-pdf cfu-file-icon pdf"></i>
                  ) : (
                    <i className="fa-solid fa-file-lines cfu-file-icon doc"></i>
                  )}
                </div>

                <div className="cfu-preview-meta">
                  <span className="cfu-preview-name" title={fileName}>
                    {fileName}
                  </span>
                  <div className="cfu-preview-sub">
                    {file?.size && (
                      <span className="cfu-preview-size">
                        {formatSize(file.size)}
                      </span>
                    )}
                    {isCamera && (
                      <span className="cfu-badge-photo">
                        <i className="fa-solid fa-camera me-1"></i>Photo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxImg && (
        <div
          className="cfu-lightbox-backdrop"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="cfu-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="cfu-lightbox-close"
              onClick={() => setLightboxImg(null)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
            <img
              src={lightboxImg.url}
              alt={lightboxImg.name}
              className="cfu-lightbox-img"
            />
            <div className="cfu-lightbox-caption">{lightboxImg.name}</div>
          </div>
        </div>
      )}

      {/* Desktop / Laptop WebCam Modal */}
      {showWebcamModal && (
        <div className="cfu-webcam-modal-backdrop" onClick={handleCloseWebcam}>
          <div
            className="cfu-webcam-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cfu-webcam-header">
              <h6 className="cfu-webcam-title">
                <i className="fa-solid fa-camera"></i> Take Photo
              </h6>
              <button
                type="button"
                className="cfu-webcam-close"
                onClick={handleCloseWebcam}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="cfu-webcam-body">
              {webcamError ? (
                <div className="cfu-webcam-error">
                  <i className="fa-solid fa-triangle-exclamation fa-2x mb-2 d-block text-warning"></i>
                  {webcamError}
                </div>
              ) : webcamSnapshot ? (
                <img
                  src={
                    typeof webcamSnapshot === "object"
                      ? webcamSnapshot.dataUrl
                      : webcamSnapshot
                  }
                  alt="Snapshot"
                  className="cfu-webcam-snapshot"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="cfu-webcam-video"
                />
              )}
            </div>

            <div className="cfu-webcam-footer">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleCloseWebcam}
              >
                Cancel
              </button>

              {!webcamError && !webcamSnapshot && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleCaptureWebcam}
                  style={{
                    background:
                      "linear-gradient(135deg, #0d9488 0%, #0284c7 100%)",
                    border: "none",
                  }}
                >
                  <i className="fa-solid fa-camera me-1"></i> Capture Photo
                </button>
              )}

              {webcamSnapshot && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={handleRetakeWebcam}
                  >
                    <i className="fa-solid fa-rotate-left me-1"></i> Retake
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={handleUseWebcamPhoto}
                  >
                    <i className="fa-solid fa-check me-1"></i> Use Photo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraFileUpload;
