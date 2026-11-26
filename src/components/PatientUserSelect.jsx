import { useEffect, useMemo, useState } from "react";
import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";

export const getPatientUserId = (user) =>
  String(user?.id || user?.user_id || user?.userId || "").trim();

export const getPatientLabel = (user) => {
  if (!user) return "";
  if (user.label) return user.label;
  const name = user.name || user.email || "Unknown";
  const phone = [user.phone_code, user.phone].filter(Boolean).join(" ");
  return [name, phone].filter(Boolean).join(" - ");
};

export const applyPatientProfile = (user, setFieldValue, extraFields = []) => {
  if (!user || !setFieldValue) return;
  const userId = getPatientUserId(user);
  setFieldValue("user_id", userId);
  const name = user.name || "";
  if (name) {
    setFieldValue("name", name);
    setFieldValue("first_name", name);
  }
  if (user.email) setFieldValue("email", user.email);
  if (user.phone) {
    setFieldValue("phone", String(user.phone).replace(/\D/g, ""));
  }
  const code = user.phone_code || user.country_code || user.phoneCode || user.dial_code;
  if (code) setFieldValue("country_code", code);
  if (user.passport_number || user.passport_num) {
    setFieldValue("passport_number", user.passport_number || user.passport_num);
  }
  extraFields.forEach((field) => {
    if (user[field] != null && user[field] !== "") {
      setFieldValue(field, user[field]);
    }
  });
};

export default function PatientUserSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  error = false,
  helperText = "",
  fallbackUser = null,
}) {
  const [options, setOptions] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const query =
      fallbackUser?.email ||
      fallbackUser?.phone ||
      fallbackUser?.name ||
      fallbackUser?.first_name ||
      "";
    if (query) setSearch(String(query).trim());
  }, [fallbackUser?.email, fallbackUser?.phone, fallbackUser?.name]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token") || "";
        const params = new URLSearchParams({
          page: "1",
          per_page: "10",
        });
        if (search) params.set("search", search);
        const response = await axios.get(`${AdminBaseUrl}active-users?${params}`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const list = Array.isArray(response.data?.data) ? response.data.data : [];
        if (!cancelled) {
          setOptions(list);
          if (!value && list.length === 1 && onChange) {
            onChange(getPatientUserId(list[0]), list[0]);
            setSelectedUser(list[0]);
          }
        }
      } catch (err) {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const selected = useMemo(() => {
    if (selectedUser && String(getPatientUserId(selectedUser)) === String(value)) {
      return selectedUser;
    }
    const fromOptions = options.find(
      (item) => String(getPatientUserId(item)) === String(value),
    );
    if (fromOptions) return fromOptions;
    if (value) {
      return {
        id: value,
        label: fallbackUser
          ? getPatientLabel({ ...fallbackUser, id: value })
          : `User ${value}`,
        name: fallbackUser?.name || `User ${value}`,
        ...fallbackUser,
      };
    }
    if (fallbackUser?.name || fallbackUser?.email) {
      return { id: "", ...fallbackUser, label: getPatientLabel(fallbackUser) };
    }
    return null;
  }, [options, selectedUser, value, fallbackUser]);

  useEffect(() => {
    const label = getPatientLabel(selected);
    if (label) setInputValue(label);
  }, [selected]);

  return (
    <div className="set-field">
      <label>
        User
        {required ? <span className="text-danger">*</span> : null}
      </label>
      <Autocomplete
        disabled={disabled}
        options={
          selected &&
          !options.some(
            (item) =>
              String(getPatientUserId(item)) === String(getPatientUserId(selected)),
          )
            ? [selected, ...options]
            : options
        }
        loading={loading}
        value={selected}
        inputValue={inputValue}
        filterOptions={(items) => items}
        onInputChange={(_, next, reason) => {
          if (reason === "input") {
            setInputValue(next);
            setSearch(next.trim());
          }
          if (reason === "clear") {
            setInputValue("");
            setSearch("");
          }
        }}
        getOptionLabel={(option) => getPatientLabel(option)}
        isOptionEqualToValue={(option, item) =>
          String(getPatientUserId(option)) === String(getPatientUserId(item))
        }
        onChange={(_, user) => {
          setSelectedUser(user || null);
          const userId = getPatientUserId(user);
          onChange(userId, user || null);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Search name, email, phone or passport"
            error={error}
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            sx={{
              "& .MuiInputBase-root": { height: 38 },
              "& .MuiInputBase-input": { padding: "6px 12px" },
            }}
          />
        )}
      />
    </div>
  );
}

