import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GetAllCountries2 } from "../../reducer/Countries";
import Swal from "sweetalert2";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { createInsurance } from "../../services/insuranceApi";
import CountryCodeSelect from "./CountryCodeSelect";

export default function InsuranceCreateModal({ open, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const { Countries } = useSelector((state) => state.Countries || {});

  useEffect(() => {
    if (open && (!Countries || Countries.length === 0)) {
      dispatch(GetAllCountries2());
    }
  }, [open, dispatch, Countries]);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone_code: "",
    phone: "",
    email: "",
    password: "",
    insurance_id: "",
    status: 1,
  });

  const handleReset = () => {
    setFormData({
      name: "",
      phone_code: "",
      phone: "",
      email: "",
      password: "",
      insurance_id: "",
      status: 1,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      Swal.fire("Validation Error", "Insurance partner name is required", "warning");
      return;
    }
    if (!formData.phone_code.trim()) {
      Swal.fire("Validation Error", "Please select a country code", "warning");
      return;
    }
    if (!formData.phone.trim()) {
      Swal.fire("Validation Error", "Phone number is required", "warning");
      return;
    }
    if (!formData.email.trim()) {
      Swal.fire("Validation Error", "Email address is required", "warning");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      Swal.fire("Validation Error", "Please enter a valid email address", "warning");
      return;
    }
    if (!formData.password.trim()) {
      Swal.fire("Validation Error", "Password is required for the insurance partner", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone_code: formData.phone_code.trim(),
        phone: formData.phone.trim(),
        password: formData.password.trim(),
        status: Number(formData.status),
      };
      if (formData.email.trim()) {
        payload.email = formData.email.trim();
      }
      if (formData.insurance_id.trim()) {
        payload.insurance_id = formData.insurance_id.trim();
      }

      const res = await createInsurance(payload);
      if (res && res.success) {
        Swal.fire({
          icon: "success",
          title: "Insurance Partner Created",
          text: res.message || "New insurance partner created and selected successfully!",
          timer: 2000,
          showConfirmButton: false,
        });

        const createdData = res.data || {
          id: res.id,
          name: payload.name,
          phone: payload.phone,
          phone_code: payload.phone_code,
          email: payload.email,
          insurance_id: res.insurance_id || payload.insurance_id,
        };

        handleReset();
        if (onSuccess) {
          onSuccess(createdData);
        }
        onClose();
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed to Create Insurance Partner",
          text: res?.message || "An unexpected error occurred",
        });
      }
    } catch (err) {
      console.error("Create insurance partner error:", err);
      Swal.fire({
        icon: "error",
        title: "Submission Error",
        text: err?.response?.data?.message || err?.message || "Failed to create insurance partner",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        "& .MuiFormLabel-asterisk": {
          color: "#ef4444 !important",
          fontWeight: "700 !important",
        },
      }}
      PaperProps={{
        style: {
          borderRadius: 14,
          padding: "4px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
        },
      }}
    >
      <DialogTitle
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "#ecfeff",
              color: "#0891b2",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            <i className="fa-solid fa-shield-alt fa-shield" />
          </span>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>
            Add New Insurance Partner
          </span>
        </div>
        <IconButton size="small" onClick={onClose} disabled={submitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent style={{ paddingTop: "18px" }}>
          <div className="row g-3">
            {/* Name */}
            <div className="col-12">
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Insurance Company / TPA / Partner Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <TextField
                fullWidth
                size="small"
                required
                placeholder="e.g. Star Health, Religare, Max Bupa..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Insurance ID (Optional) */}
            <div className="col-12">
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Custom Insurance Code / ID (Optional)
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="Leave blank for auto-generated ID (e.g. INS1001)"
                value={formData.insurance_id}
                onChange={(e) => setFormData({ ...formData, insurance_id: e.target.value })}
              />
            </div>

            {/* Country Code & Phone */}
            <div className="col-md-5">
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Country Code <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <CountryCodeSelect
                value={formData.phone_code}
                onChange={(val) => setFormData({ ...formData, phone_code: val })}
                required
              />
            </div>

            <div className="col-md-7">
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Contact / Desk Phone <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <TextField
                fullWidth
                size="small"
                required
                placeholder="Desk / Mobile Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            {/* Email */}
            <div className="col-12">
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Official Claim Desk Email <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <TextField
                fullWidth
                type="email"
                size="small"
                required
                placeholder="claims@insurance.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {/* Password */}
            <div className="col-12">
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Portal Login Password <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <TextField
                fullWidth
                type="password"
                size="small"
                required
                placeholder="Set partner portal login password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
        </DialogContent>

        <DialogActions
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Button
            onClick={onClose}
            disabled={submitting}
            variant="text"
            style={{ textTransform: "none", color: "#64748b", fontWeight: 600 }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            variant="contained"
            style={{
              textTransform: "none",
              backgroundColor: "#0891b2",
              color: "#ffffff",
              fontWeight: 700,
              padding: "6px 20px",
              boxShadow: "0 2px 6px rgba(8, 145, 178, 0.3)",
            }}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CircularProgress size={16} color="inherit" />
                Creating...
              </span>
            ) : (
              "Create Insurance Partner"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
