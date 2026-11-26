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
import { createReferral } from "../../services/referralApi";
import CountryCodeSelect from "./CountryCodeSelect";

export default function ReferralCreateModal({ open, onClose, onSuccess }) {
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
    referral_id: "",
    status: 1,
  });

  const handleReset = () => {
    setFormData({
      name: "",
      phone_code: "",
      phone: "",
      email: "",
      password: "",
      referral_id: "",
      status: 1,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      Swal.fire("Validation Error", "Referral partner name is required", "warning");
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
      Swal.fire("Validation Error", "Password is required for the referral partner", "warning");
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
      if (formData.referral_id.trim()) {
        payload.referral_id = formData.referral_id.trim();
      }

      const res = await createReferral(payload);
      if (res && res.success) {
        Swal.fire({
          icon: "success",
          title: "Referrer Created",
          text: res.message || "New referral partner created and selected successfully!",
          timer: 2000,
          showConfirmButton: false,
        });

        const createdData = res.data || {
          id: res.id,
          name: payload.name,
          referral_id: res.referral_id || payload.referral_id,
          phone: payload.phone,
          email: payload.email,
        };

        handleReset();
        if (typeof onSuccess === "function") {
          onSuccess(createdData);
        }
        if (typeof onClose === "function") {
          onClose();
        }
      } else {
        Swal.fire("Error", res?.message || "Failed to create referral partner", "error");
      }
    } catch (err) {
      console.error("Quick add referral error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to create referral partner";
      Swal.fire("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !submitting && onClose && onClose()}
      maxWidth="sm"
      fullWidth
      sx={{
        "& .MuiFormLabel-asterisk": {
          color: "#ef4444 !important",
          fontWeight: "700 !important",
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle className="d-flex justify-content-between align-items-center border-bottom pb-2">
          <span className="fw-bold">
            <i className="fa fa-user-plus text-success me-2" />
            Add New Referral Partner
          </span>
          <IconButton
            size="small"
            onClick={() => onClose && onClose()}
            disabled={submitting}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent className="pt-3">
          <div className="row g-3">
            {/* Name */}
            <div className="col-12">
              <TextField
                label="Referral Partner Name"
                placeholder="e.g. Dr. John Doe"
                size="small"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Phone Number with Country Code */}
            <div className="col-12">
              <label
                className="form-label mb-1"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#64748b",
                  display: "block",
                }}
              >
                Phone Number <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: "2px" }}>*</span>
              </label>
              <div className="country-code" style={{ position: "relative" }}>
                <CountryCodeSelect
                  value={formData.phone_code}
                  onChange={(code) => setFormData({ ...formData, phone_code: code })}
                  countries={Countries}
                  placeholder="+Code"
                />
                <input
                  type="tel"
                  className="form-control code-in"
                  placeholder="10-digit mobile number"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    height: "38px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div className="col-12">
              <TextField
                label="Email Address"
                placeholder="e.g. doctor@hospital.com"
                type="email"
                size="small"
                fullWidth
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {/* Password */}
            <div className="col-12">
              <TextField
                label="Password"
                placeholder="Portal login password"
                type="password"
                size="small"
                fullWidth
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                helperText="Password for the referral partner to log in to their portal"
              />
            </div>

            {/* Custom Referral ID (Optional) */}
            <div className="col-12">
              <TextField
                label="Referral ID / Code"
                placeholder="Auto-generated if left blank (e.g. REF1005)"
                size="small"
                fullWidth
                value={formData.referral_id}
                onChange={(e) => setFormData({ ...formData, referral_id: e.target.value })}
                helperText="Optional. System will automatically generate one if omitted."
              />
            </div>
          </div>
        </DialogContent>

        <DialogActions className="border-top p-3">
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => onClose && onClose()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitting ? "Adding..." : "Add & Select Referrer"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
