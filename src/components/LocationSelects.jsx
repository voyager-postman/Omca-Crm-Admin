import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField, createFilterOptions } from "@mui/material";
import { ErrorMessage } from "formik";
import { getCities, getCountries, getStates } from "../services/locationApi";

const inputSx = {
  "& .MuiInputBase-root": { height: 38 },
  "& .MuiInputBase-input": { padding: "6px 12px" },
};

const nameFilter = createFilterOptions({
  stringify: (option) =>
    [option?.name, option?.title, option?.shortname, option?.id]
      .filter(Boolean)
      .join(" "),
});

const findOption = (list, value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return (
    (list || []).find((item) => String(item?.id) === raw) ||
    (list || []).find(
      (item) => String(item?.name || item?.title || "").trim().toLowerCase() === lower,
    ) ||
    null
  );
};

export default function LocationDropdown({
  label,
  name,
  required = false,
  type = "country",
  value,
  countryId,
  stateId,
  onChange,
  error = false,
  disabled = false,
  placeholder,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let list = [];
        if (type === "country") {
          list = await getCountries();
        } else if (type === "state") {
          list = await getStates(countryId);
        } else if (type === "city") {
          list = await getCities(stateId);
        }
        if (!cancelled) setOptions(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [type, countryId, stateId]);

  const selected = useMemo(() => {
    const match = findOption(options, value);
    if (match) return match;
    if (value) return { id: value, name: String(value) };
    return null;
  }, [options, value]);

  useEffect(() => {
    const match = findOption(options, value);
    if (match && String(match.id) !== String(value)) {
      onChangeRef.current?.(String(match.id));
    }
  }, [options, value]);

  const isDisabled =
    disabled ||
    (type === "state" && !countryId) ||
    (type === "city" && !stateId);

  const combinedOptions =
    selected && !findOption(options, selected.id || selected.name)
      ? [selected, ...options]
      : options;

  return (
    <div className="col-md-4">
      <div className="set-field">
        <label>
          {label}
          {required ? <span className="text-danger">*</span> : null}
        </label>
        <Autocomplete
          disabled={isDisabled}
          options={combinedOptions}
          loading={loading}
          value={selected}
          openOnFocus
          autoHighlight
          filterOptions={(opts, state) => {
            const filtered = nameFilter(opts, state);
            return filtered.length ? filtered : opts;
          }}
          getOptionLabel={(option) => option?.name || option?.title || ""}
          isOptionEqualToValue={(option, item) =>
            String(option?.id) === String(item?.id) ||
            String(option?.name || "").toLowerCase() ===
              String(item?.name || "").toLowerCase()
          }
          onChange={(_, item) => onChange(item?.id || "")}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={
                placeholder ||
                (type === "country"
                  ? "Select Country"
                  : type === "state"
                    ? "Select State"
                    : "Select City")
              }
              error={error}
              sx={inputSx}
            />
          )}
          noOptionsText={loading ? "Loading..." : "No options"}
          ListboxProps={{ style: { maxHeight: 280 } }}
        />
        {name ? (
          <ErrorMessage name={name} component="div" className="text-danger" />
        ) : null}
      </div>
    </div>
  );
}

export function CountryNameDropdown({
  label = "Country",
  name,
  required = false,
  value,
  onChange,
  error = false,
  placeholder = "Select Country",
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCountries()
      .then((list) => {
        if (!cancelled) setOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected =
    findOption(options, value) ||
    (value ? { id: value, name: String(value) } : null);

  return (
    <div className="col-md-4">
      <div className="set-field">
        <label>
          {label}
          {required ? <span className="text-danger">*</span> : null}
        </label>
        <Autocomplete
          options={options}
          loading={loading}
          value={selected}
          openOnFocus
          filterOptions={(opts, state) => {
            const filtered = nameFilter(opts, state);
            return filtered.length ? filtered : opts;
          }}
          getOptionLabel={(option) => option?.name || ""}
          isOptionEqualToValue={(option, item) => option?.name === item?.name}
          onChange={(_, item) => onChange(item?.name || "", item || null)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={placeholder}
              error={error}
              sx={inputSx}
            />
          )}
          noOptionsText={loading ? "Loading..." : "No options"}
        />
        {name ? (
          <ErrorMessage name={name} component="div" className="text-danger" />
        ) : null}
      </div>
    </div>
  );
}
