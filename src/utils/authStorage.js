import { persistStaffAction } from "./staffActions";

// Automatically clean any literal "undefined" or "null" corrupted values from localStorage
if (typeof window !== "undefined" && window.localStorage) {
  try {
    ["_id", "insurance_id", "insurance_mysql_id", "referral_id", "referral_mysql_id", "hospital_id"].forEach((k) => {
      const v = window.localStorage.getItem(k);
      if (v === "undefined" || v === "null") {
        window.localStorage.removeItem(k);
      }
    });
  } catch (e) {}
}

export const AUTH_KEYS = [
  "email",
  "_id",
  "token",
  "loginTime",
  "token_expire_time",
  "permissionArray",
  "Role",
  "name",
  "authSessionId",
  "hospital_id",
  "referral_id",
  "referral_mysql_id",
  "insurance_id",
  "insurance_mysql_id",
  "staffAction",
];

export const SESSION_KEYS = ["tabenquiry", "patientMainTab"];

const MANAGED_KEYS = [...AUTH_KEYS, ...SESSION_KEYS];

export const getAppPrefix = () => {
  if (process.env.REACT_APP_AUTH_PREFIX) {
    const prefix = process.env.REACT_APP_AUTH_PREFIX;
    return prefix.endsWith("_") ? prefix : `${prefix}_`;
  }

  if (typeof window === "undefined") {
    return "crm_";
  }

  const path = window.location.pathname.toLowerCase();
  if (path === "/hospital" || path.startsWith("/hospital/")) {
    return "hospital_";
  }

  return "crm_";
};

export const authKey = (key) => `${getAppPrefix()}${key}`;

export const getKnownUserIdKey = () => `${getAppPrefix()}knownUserId`;

export const isManagedStorageKey = (storageKey) => {
  const prefix = getAppPrefix();
  if (storageKey.startsWith(prefix)) {
    return MANAGED_KEYS.includes(storageKey.slice(prefix.length));
  }
  return false;
};

let patchInstalled = false;

export function installAuthStoragePatch() {
  if (patchInstalled || typeof window === "undefined") {
    return;
  }

  patchInstalled = true;

  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.getItem = function (key) {
    if (this !== localStorage || !MANAGED_KEYS.includes(key)) {
      return originalGetItem.call(this, key);
    }

    const prefixedValue = originalGetItem.call(this, authKey(key));
    if (prefixedValue !== null) {
      return prefixedValue;
    }

    if (getAppPrefix() === "crm_") {
      return originalGetItem.call(this, key);
    }

    return null;
  };

  Storage.prototype.setItem = function (key, value) {
    if (this !== localStorage || !MANAGED_KEYS.includes(key)) {
      return originalSetItem.call(this, key, value);
    }

    return originalSetItem.call(this, authKey(key), value);
  };

  Storage.prototype.removeItem = function (key) {
    if (this !== localStorage || !MANAGED_KEYS.includes(key)) {
      return originalRemoveItem.call(this, key);
    }

    originalRemoveItem.call(this, authKey(key));

    if (getAppPrefix() === "crm_") {
      originalRemoveItem.call(this, key);
    }
  };
}

export const getToken = () => localStorage.getItem("token");

export const getRole = () => localStorage.getItem("Role");

export const getUserId = () => localStorage.getItem("_id");

export const getEmail = () => localStorage.getItem("email");

export const getAuthSessionId = () => localStorage.getItem("authSessionId") || "";

export const parsePermissions = () => {
  const raw = localStorage.getItem("permissionArray") || "";
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith("/") ? p : `/${p}`));
};

export const clearAuth = () => {
  MANAGED_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const setAuth = (user) => {
  clearAuth();

  const permissions = Array.isArray(user.permissions)
    ? user.permissions.join(",")
    : user.permissions || "";

  localStorage.setItem("email", user.details.email);
  localStorage.setItem("_id", user.details._id);
  localStorage.setItem("token", user.token);
  localStorage.setItem("loginTime", user.loginTime);
  localStorage.setItem("token_expire_time", user.token_expire_time);
  localStorage.setItem("permissionArray", permissions);
  localStorage.setItem("Role", user.details.role);
  localStorage.setItem("name", user.details.name);
  localStorage.setItem(
    "authSessionId",
    `${user.details._id}-${Date.now()}`
  );

  const hospitalId =
    user.details.hospital_id ??
    user.details.hospitalId ??
    user.details.hospital?.hospital_id ??
    user.details.hospital?.hospitalId ??
    user.details.hospital?.id ??
    "";
  if (hospitalId !== "" && hospitalId != null) {
    localStorage.setItem("hospital_id", String(hospitalId));
  }

  if (String(user.details?.role || "").toUpperCase() === "REFERRAL") {
    if (user.details?.referral_id) {
      localStorage.setItem("referral_id", String(user.details.referral_id));
    }
    const mysqlId =
      user.details?.id ??
      user.details?.mysql_id ??
      user.details?.referral_mysql_id;
    if (mysqlId !== undefined && mysqlId !== null && String(mysqlId).trim() !== "") {
      localStorage.setItem("referral_mysql_id", String(mysqlId));
    }
  } else {
    localStorage.removeItem("referral_id");
    localStorage.removeItem("referral_mysql_id");
  }

  if (String(user.details?.role || "").toUpperCase() === "INSURANCE") {
    const rawInsId =
      user.details?.insurance_id ??
      user.details?.insuranceId ??
      user.details?.id ??
      user.details?.mysql_id ??
      user.details?._id;
    if (rawInsId != null && String(rawInsId).trim() !== "" && String(rawInsId) !== "undefined" && String(rawInsId) !== "null") {
      localStorage.setItem("insurance_id", String(rawInsId));
    }
    const insMysqlId =
      user.details?.id ??
      user.details?.mysql_id ??
      user.details?.insurance_mysql_id;
    if (insMysqlId !== undefined && insMysqlId !== null && String(insMysqlId).trim() !== "") {
      localStorage.setItem("insurance_mysql_id", String(insMysqlId));
    }
  } else {
    localStorage.removeItem("insurance_id");
    localStorage.removeItem("insurance_mysql_id");
  }

  persistStaffAction(user);

  sessionStorage.setItem(getKnownUserIdKey(), user.details._id);
};

export const getHospitalId = () => localStorage.getItem("hospital_id") || "";

export const isMongoObjectId = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

export const isReferralUser = () => {
  const role = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toUpperCase();
  return role === "REFERRAL" || role === "REFERRER";
};

export const getReferralId = () => {
  if (isReferralUser()) {
    const val = localStorage.getItem("referral_id") || "";
    return val && val !== "undefined" && val !== "null" ? val : "";
  }
  if (localStorage.getItem("referral_id")) {
    localStorage.removeItem("referral_id");
  }
  return "";
};

export const getReferralMysqlId = () => {
  if (!isReferralUser()) return null;

  const direct =
    localStorage.getItem("referral_mysql_id") ||
    localStorage.getItem("referral_user_id") ||
    localStorage.getItem("mysql_id") ||
    "";
  if (direct && !isNaN(Number(direct))) {
    return Number(direct);
  }

  const rawId = localStorage.getItem("_id") || "";
  if (rawId && !isNaN(Number(rawId))) {
    return Number(rawId);
  }

  const refId = localStorage.getItem("referral_id") || "";
  if (refId && !isNaN(Number(refId))) {
    return Number(refId);
  }

  const matched = String(refId || rawId).match(/\d+/);
  if (matched && matched[0]) {
    return Number(matched[0]);
  }

  return rawId ? (isNaN(Number(rawId)) ? rawId : Number(rawId)) : null;
};

export const isInsuranceUser = () => {
  const role = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toUpperCase();
  return role === "INSURANCE";
};

export const isPartnerUser = () => isReferralUser() || isInsuranceUser();

export const getInsuranceId = () => {
  if (isInsuranceUser()) {
    const val =
      localStorage.getItem("insurance_id") ||
      localStorage.getItem("insurance_mysql_id") ||
      localStorage.getItem("_id") ||
      "";
    return val && val !== "undefined" && val !== "null" ? val : "";
  }
  if (localStorage.getItem("insurance_id")) {
    localStorage.removeItem("insurance_id");
  }
  return "";
};

export const getInsuranceMysqlId = () => {
  if (!isInsuranceUser()) return null;

  const direct =
    localStorage.getItem("insurance_mysql_id") ||
    localStorage.getItem("insurance_user_id") ||
    localStorage.getItem("mysql_id") ||
    "";
  if (direct && !isNaN(Number(direct))) {
    return Number(direct);
  }

  const rawId = localStorage.getItem("_id") || "";
  if (rawId && !isNaN(Number(rawId))) {
    return Number(rawId);
  }

  const insId = localStorage.getItem("insurance_id") || "";
  if (insId && !isNaN(Number(insId))) {
    return Number(insId);
  }

  const matched = String(insId || rawId).match(/\d+/);
  if (matched && matched[0]) {
    return Number(matched[0]);
  }

  return rawId ? (isNaN(Number(rawId)) ? rawId : Number(rawId)) : null;
};

export const isHospitalApp = () => getAppPrefix() === "hospital_";

export const isHospitalUser = () => {
  const role = (localStorage.getItem("Role") || "").toLowerCase();
  return isHospitalApp() || role === "hospital";
};

export const getLoginPath = () => {
  const publicUrl = process.env.PUBLIC_URL || "";
  if (publicUrl && publicUrl !== "/") {
    return publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  }

  if (getAppPrefix() === "hospital_") {
    return "/hospital/";
  }

  return "/";
};

export const isPhysiotherapistUser = () => {
  const role = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    sessionStorage.getItem("role") ||
    ""
  )
    .trim()
    .toLowerCase();
  return (
    role.includes("physio") ||
    role.includes("therapist") ||
    role === "physiotherapy"
  );
};

export const isCoordinatorUser = () => {
  const role = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toLowerCase();

  // Exclude transport/driver coordinators
  if (
    role.includes("pick") ||
    role.includes("drop") ||
    role.includes("transport") ||
    role.includes("driver")
  ) {
    return false;
  }

  return (
    role === "coordinator" ||
    role === "patient coordinator" ||
    role === "medical coordinator" ||
    role === "case coordinator" ||
    role.includes("coordinator")
  );
};

export const getCurrentCoordinatorUser = () => {
  return {
    id: (localStorage.getItem("_id") || sessionStorage.getItem("_id") || "").trim(),
    name: (localStorage.getItem("name") || sessionStorage.getItem("name") || "").trim(),
    email: (localStorage.getItem("email") || sessionStorage.getItem("email") || "").trim(),
    role: (localStorage.getItem("Role") || sessionStorage.getItem("Role") || "").trim(),
  };
};

export const isAdminUser = (roleValue = localStorage.getItem("Role")) => {
  const role = String(roleValue || "").trim().toLowerCase();
  return role === "admin" || role === "superadmin" || role === "super admin";
};

export const isSubAdminUser = (roleValue = localStorage.getItem("Role")) => {
  const role = String(roleValue || "").trim().toLowerCase();
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

export const isManagerUser = (roleValue = localStorage.getItem("Role")) => {
  const role = String(roleValue || "").trim().toLowerCase();
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

export const canViewAndEditSensitivePatientDetails = (roleValue = localStorage.getItem("Role")) => {
  const role = String(roleValue || "").trim().toLowerCase();
  return isAdminUser(role) || isSubAdminUser(role) || isManagerUser(role);
};

export const canManageCoordinators = () => {
  return isAdminUser();
};

export const isSocialMediaRole = (roleValue = localStorage.getItem("Role")) => {
  const role = String(roleValue || "").trim().toLowerCase();
  return (
    role === "social media leads" ||
    role === "social media lead" ||
    role === "social_media_leads" ||
    role === "social media"
  );
};


export const getCurrentPhysiotherapistUser = () => {
  return {
    id: localStorage.getItem("_id") || "",
    name: localStorage.getItem("name") || "",
    email: localStorage.getItem("email") || "",
    role: localStorage.getItem("Role") || "",
  };
};

export const isDriverUser = () => {
  const role = (localStorage.getItem("Role") || "").trim().toLowerCase();
  const name = (localStorage.getItem("name") || "").trim().toLowerCase();
  if (role === "admin") return false;
  if (name === "test sos") return false;
  // Pick & Drop coordinators/staff manage all drivers, so they are not single vehicle drivers
  if (
    role.includes("pick & drop") ||
    role.includes("pick and drop") ||
    role.includes("pickup and drop") ||
    role.includes("pickup_and_drop") ||
    role.includes("pickup") ||
    role.includes("transport")
  ) {
    if (name !== "ravi kumar" && name !== "shivam kumar" && role !== "driver") {
      return false;
    }
  }
  return (
    role === "driver" ||
    role === "vehicle driver" ||
    name === "ravi kumar" ||
    name === "shivam kumar"
  );
};

export const isPickDropStaffUser = () => {
  const role = (localStorage.getItem("Role") || "").trim().toLowerCase();
  const name = (localStorage.getItem("name") || "").trim().toLowerCase();
  if (role === "admin") return false;
  return (
    role.includes("driver") ||
    role.includes("pickup") ||
    role.includes("transport") ||
    role.includes("pick & drop") ||
    role.includes("pick and drop") ||
    role.includes("pick_drop") ||
    role.includes("pick") ||
    role.includes("drop") ||
    name === "ravi kumar" ||
    name === "shivam kumar" ||
    name === "test sos"
  );
};

export const getCurrentDriverUser = () => {
  const name = localStorage.getItem("name") || "";
  return {
    id: localStorage.getItem("_id") || "",
    name,
    email: localStorage.getItem("email") || "",
    role: localStorage.getItem("Role") || "",
    hospitalId: localStorage.getItem("hospital_id") || "",
  };
};

export const clearKnownUserId = () => {
  sessionStorage.removeItem(getKnownUserIdKey());
};

export const notifyAuthChanged = () => {
  window.dispatchEvent(new Event("auth-changed"));
};


