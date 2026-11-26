export const STAFF_ACTION_OPTIONS = [
  { value: "edit", label: "Edit" },
  { value: "delete", label: "Delete" },
  { value: "export", label: "Export" },
];

const ACTION_KEYS = STAFF_ACTION_OPTIONS.map((item) => item.value);

const isTruthy = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

export const actionsArrayToObject = (selected = []) => {
  const set = new Set(
    (Array.isArray(selected) ? selected : [])
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    edit: set.has("edit"),
    delete: set.has("delete"),
    export: set.has("export"),
  };
};

const fromFlags = (source = {}) => ({
  edit: isTruthy(source.canEdit ?? source.edit),
  delete: isTruthy(source.canDelete ?? source.delete),
  export: isTruthy(source.canExport ?? source.export),
});

export const parseActionPayload = (raw) => {
  if (!raw && raw !== false) return null;

  if (Array.isArray(raw)) {
    return actionsArrayToObject(raw);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return parseActionPayload(parsed);
      }
    } catch {
      // comma-separated: "edit,delete,export"
    }
    return actionsArrayToObject(trimmed.split(","));
  }

  if (typeof raw === "object") {
    return {
      edit: isTruthy(raw.edit ?? raw.canEdit),
      delete: isTruthy(raw.delete ?? raw.canDelete),
      export: isTruthy(raw.export ?? raw.canExport),
    };
  }

  return null;
};

export const staffRecordToActionsArray = (staff = {}) => {
  const parsed =
    parseActionPayload(staff.action) ||
    parseActionPayload(staff.actions) ||
    fromFlags(staff);
  return ACTION_KEYS.filter((key) => parsed[key]);
};

export const normalizeStaffAction = (payload = {}) => {
  const details = payload.details || {};
  const role = String(details.role || payload.role || "").toLowerCase();

  if (
    role === "admin" ||
    role === "superadmin" ||
    role === "super admin" ||
    role.includes("manager") ||
    role.includes("sub-admin") ||
    role.includes("subadmin") ||
    role.includes("sub admin")
  ) {
    return { edit: true, delete: role.includes("admin"), export: true };
  }

  const parsed =
    parseActionPayload(details.action) ||
    parseActionPayload(payload.action) ||
    fromFlags({ ...payload, ...details });

  return {
    edit: Boolean(parsed?.edit),
    delete: Boolean(parsed?.delete),
    export: Boolean(parsed?.export),
  };
};

export const persistStaffAction = (payload) => {
  localStorage.setItem(
    "staffAction",
    JSON.stringify(normalizeStaffAction(payload || {})),
  );
};

export const getStaffAction = () => {
  const raw = localStorage.getItem("staffAction");
  if (!raw) {
    return { edit: true, delete: false, export: true };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      edit: Boolean(parsed?.edit),
      delete: Boolean(parsed?.delete),
      export: Boolean(parsed?.export),
    };
  } catch {
    return { edit: true, delete: false, export: true };
  }
};

const getCrmRole = () =>
  (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toLowerCase();

export const isCrmAdmin = () => {
  const role = getCrmRole();
  return role === "admin" || role === "superadmin" || role === "super admin";
};

export const isCrmSubAdmin = () => {
  const role = getCrmRole();
  return (
    role === "sub-admin" ||
    role === "subadmin" ||
    role === "sub_admin" ||
    role === "sub admin" ||
    role.includes("sub-admin") ||
    role.includes("subadmin") ||
    role.includes("sub admin")
  );
};

export const isCrmManager = () => {
  const role = getCrmRole();
  return (
    role === "manager" ||
    role === "general manager" ||
    role === "operations manager" ||
    role === "case manager" ||
    role.endsWith(" manager") ||
    role.startsWith("manager ") ||
    role.includes("manager")
  );
};

const isReferralRole = () => {
  const role = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toUpperCase();
  return role === "REFERRAL" || role === "REFERRER" || role === "INSURANCE";
};

export const canStaffEdit = () => {
  if (isCrmAdmin() || isCrmSubAdmin() || isCrmManager()) return true;
  if (isReferralRole()) return false;
  return Boolean(getStaffAction().edit);
};

export const canStaffDelete = () => {
  if (isCrmAdmin()) return true;
  if (isReferralRole()) return false;
  return Boolean(getStaffAction().delete);
};

export const canStaffExport = () => {
  if (isCrmAdmin()) return true;
  if (isReferralRole()) return false;
  return Boolean(getStaffAction().export);
};
