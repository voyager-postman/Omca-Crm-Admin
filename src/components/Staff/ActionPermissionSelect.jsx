import React from "react";
import {
  Checkbox,
  FormControl,
  ListItemText,
  MenuItem,
  Select,
} from "@mui/material";
import { STAFF_ACTION_OPTIONS } from "../../utils/staffActions";

export default function ActionPermissionSelect({
  value = [],
  onChange,
  name = "actions",
}) {
  const selected = Array.isArray(value) ? value : [];
  const allValues = STAFF_ACTION_OPTIONS.map((item) => item.value);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    if (nextValue.includes("All")) {
      if (selected.length === allValues.length) {
        onChange([]);
      } else {
        onChange(allValues);
      }
      return;
    }
    onChange(nextValue.filter((item) => item !== "All" && item !== ""));
  };

  return (
    <div className="col-md-4 dropdownCustom">
      <div className="set-field">
        <label>
          Give Action<span className="text-danger">*</span>
        </label>
        <FormControl fullWidth>
          <Select
            multiple
            value={selected}
            name={name}
            onChange={handleChange}
            className="form-control"
            renderValue={(picked) =>
              STAFF_ACTION_OPTIONS.filter((item) => picked.includes(item.value))
                .map((item) => item.label)
                .join(", ")
            }
            sx={{ height: 38 }}
            MenuProps={{
              PaperProps: {
                style: { maxHeight: 337 },
              },
              disableAutoFocusItem: true,
            }}
          >
            <MenuItem value="All" className="custmselect staffpermiss">
              <Checkbox
                checked={selected.length === allValues.length}
                indeterminate={
                  selected.length > 0 && selected.length < allValues.length
                }
              />
              <ListItemText primary="Select All" />
            </MenuItem>
            {STAFF_ACTION_OPTIONS.map((item) => (
              <MenuItem
                key={item.value}
                value={item.value}
                className="custmselect staffpermiss"
              >
                <Checkbox checked={selected.indexOf(item.value) > -1} />
                <ListItemText primary={item.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
    </div>
  );
}
