/** Dashboard permission keys for enquiry sub-tabs (Manage Permissions page). */
export const SOS_EMERGENCY_PERMISSION = "/SOS_Emergency";
export const CAMPAIGN_CONTACTS_PERMISSION = "/Campaign_Contacts";
export const CHATBOT_LEADS_PERMISSION = "/Chatbot_Leads";

/** Legacy key still accepted for SOS tab/sidebar access. */
export const SOS_EMERGENCY_PERMISSION_LEGACY = "/sos/list";

export const SOS_EMERGENCY_PERMISSIONS = [
  SOS_EMERGENCY_PERMISSION,
  SOS_EMERGENCY_PERMISSION_LEGACY,
];

export const ENQUIRY_SUB_TAB_PERMISSIONS = [
  SOS_EMERGENCY_PERMISSION,
  CAMPAIGN_CONTACTS_PERMISSION,
  CHATBOT_LEADS_PERMISSION,
];

/** Dashboard permission key for Payment Data page. */
export const PAYMENT_DATA_PERMISSION = "/Payment_Data";

/** Activity Log page — prefer singular key from Manage Permissions. */
export const ACTIVITY_LOG_PERMISSION = "/Activity_Log";
/** Legacy / alternate key still accepted. */
export const ACTIVITY_LOG_PERMISSION_LEGACY = "/Activity_Logs";

export const ACTIVITY_LOG_PERMISSIONS = [
  ACTIVITY_LOG_PERMISSION,
  ACTIVITY_LOG_PERMISSION_LEGACY,
];

/** Doctor's Review feature (enquiry / patient doctor-review actions). */
export const DOCTOR_REVIEW_PERMISSION = "/Doctor_Review";
/** Alternate key if backend uses plural variant. */
export const DOCTOR_REVIEW_PERMISSION_ALT = "/Doctors_Review";

export const DOCTOR_REVIEW_PERMISSIONS = [
  DOCTOR_REVIEW_PERMISSION,
  DOCTOR_REVIEW_PERMISSION_ALT,
];

/** Director Messages menu access permission. */
export const DIRECTOR_MESSAGES_PERMISSION = "/Director_Messages";
export const DIRECTOR_MESSAGES_PERMISSION_ALT = "/director-messages";
export const DIRECTOR_MESSAGES_PERMISSION_LOWER = "/director_messages";

export const DIRECTOR_MESSAGES_PERMISSIONS = [
  DIRECTOR_MESSAGES_PERMISSION,
  DIRECTOR_MESSAGES_PERMISSION_ALT,
  DIRECTOR_MESSAGES_PERMISSION_LOWER,
];

/** Send / Broadcast Director Message permission (on behalf of Director). */
export const SEND_DIRECTOR_MESSAGE_PERMISSION = "/Send_Director_Message";
export const SEND_DIRECTOR_MESSAGE_PERMISSION_ALT = "/send-director-message";
export const SEND_DIRECTOR_MESSAGE_PERMISSION_LOWER = "/send_director_message";

export const SEND_DIRECTOR_MESSAGE_PERMISSIONS = [
  SEND_DIRECTOR_MESSAGE_PERMISSION,
  SEND_DIRECTOR_MESSAGE_PERMISSION_ALT,
  SEND_DIRECTOR_MESSAGE_PERMISSION_LOWER,
];

/** Referral module permission. */
export const REFERRAL_PERMISSION = "/Referral";
export const REFERRAL_PERMISSION_ALT = "/referrals";
export const REFERRAL_PERMISSION_MANAGE = "/Manage_Referrals";

export const REFERRAL_PERMISSIONS = [
  REFERRAL_PERMISSION,
  REFERRAL_PERMISSION_ALT,
  REFERRAL_PERMISSION_MANAGE,
];

export const INSURANCE_PERMISSION = "/Insurance";
export const INSURANCE_PERMISSION_ALT = "/insurances";
export const INSURANCE_PERMISSION_MANAGE = "/Manage_Insurances";

export const INSURANCE_PERMISSIONS = [
  INSURANCE_PERMISSION,
  INSURANCE_PERMISSION_ALT,
  INSURANCE_PERMISSION_MANAGE,
];

export const PHYSIOTHERAPY_PERMISSION = "/Physiotherapy";
export const PATIENT_TRAVEL_PERMISSION = "/Patient_Travel";
export const GUEST_HOUSES_PERMISSION = "/Guest_Houses";
export const GUEST_HOUSES_PERMISSION_ALT = "/Manage_Guest_Houses";
export const GUEST_HOUSE_SERVICES_PERMISSION = "/Guest_House_Services";
export const ORDERS_PERMISSION = "/Orders";
export const ORDERS_PERMISSION_LOWER = "/orders";
export const MESSAGES_PERMISSION = "/Messages";
export const MESSAGES_PERMISSION_LOWER = "/messages";

/** Patient action buttons permissions */
export const ASSIGN_PATIENT_PHYSIOTHERAPY_PERMISSION = "/Assign_Patient_Physiotherapy";
export const ASSIGN_PATIENT_COORDINATOR_PERMISSION = "/Assign_Patient_Coordinator";
export const VIEW_PATIENT_ACTIVITY_LOG_PERMISSION = "/View_Patient_Activity_Log";
export const VIEW_PATIENT_TIMELINE_PERMISSION = "/View_Patient_Timeline";

export const ASSIGN_PATIENT_PHYSIOTHERAPY_PERMISSIONS = [
  ASSIGN_PATIENT_PHYSIOTHERAPY_PERMISSION,
  "/assign_patient_physiotherapy",
  "/AssignPatientPhysiotherapy",
];

export const ASSIGN_PATIENT_COORDINATOR_PERMISSIONS = [
  ASSIGN_PATIENT_COORDINATOR_PERMISSION,
  "/assign_patient_coordinator",
  "/AssignPatientCoordinator",
];

export const VIEW_PATIENT_ACTIVITY_LOG_PERMISSIONS = [
  VIEW_PATIENT_ACTIVITY_LOG_PERMISSION,
  "/view_patient_activity_log",
  "/ViewPatientActivityLog",
];

export const VIEW_PATIENT_TIMELINE_PERMISSIONS = [
  VIEW_PATIENT_TIMELINE_PERMISSION,
  "/view_patient_timeline",
  "/ViewPatientTimeline",
  "/Patient_Timeline",
];

/** Custom event so Inquiry listing can reopen Navbar's EmergencyAlertModal. */
export const OPEN_SOS_ALERT_EVENT = "omca:open-sos-alert";

const PERMISSION_LABELS = {
  [SOS_EMERGENCY_PERMISSION]: "SOS EMERGENCY",
  [SOS_EMERGENCY_PERMISSION_LEGACY]: "SOS EMERGENCY",
  [CAMPAIGN_CONTACTS_PERMISSION]: "CAMPAIGN CONTACTS",
  [CHATBOT_LEADS_PERMISSION]: "CHATBOT LEADS",
  [PAYMENT_DATA_PERMISSION]: "PAYMENT DATA",
  [ACTIVITY_LOG_PERMISSION]: "ACTIVITY LOG",
  [ACTIVITY_LOG_PERMISSION_LEGACY]: "ACTIVITY LOG",
  [DOCTOR_REVIEW_PERMISSION]: "DOCTOR REVIEW",
  [DOCTOR_REVIEW_PERMISSION_ALT]: "DOCTOR REVIEW",
  [DIRECTOR_MESSAGES_PERMISSION]: "DIRECTOR MESSAGES",
  [DIRECTOR_MESSAGES_PERMISSION_ALT]: "DIRECTOR MESSAGES",
  [DIRECTOR_MESSAGES_PERMISSION_LOWER]: "DIRECTOR MESSAGES",
  [SEND_DIRECTOR_MESSAGE_PERMISSION]: "SEND DIRECTOR MESSAGE",
  [SEND_DIRECTOR_MESSAGE_PERMISSION_ALT]: "SEND DIRECTOR MESSAGE",
  [SEND_DIRECTOR_MESSAGE_PERMISSION_LOWER]: "SEND DIRECTOR MESSAGE",
  [REFERRAL_PERMISSION]: "REFERRAL",
  [REFERRAL_PERMISSION_ALT]: "REFERRAL",
  [REFERRAL_PERMISSION_MANAGE]: "REFERRAL",
  [PHYSIOTHERAPY_PERMISSION]: "PHYSIOTHERAPY",
  [PATIENT_TRAVEL_PERMISSION]: "PATIENT TRAVEL",
  [GUEST_HOUSES_PERMISSION]: "GUEST HOUSES",
  [GUEST_HOUSES_PERMISSION_ALT]: "GUEST HOUSES",
  [GUEST_HOUSE_SERVICES_PERMISSION]: "GUEST HOUSE SERVICES",
  [ORDERS_PERMISSION]: "ORDERS",
  [ORDERS_PERMISSION_LOWER]: "ORDERS",
  [MESSAGES_PERMISSION]: "MESSAGES",
  [MESSAGES_PERMISSION_LOWER]: "MESSAGES",
  [ASSIGN_PATIENT_PHYSIOTHERAPY_PERMISSION]: "ASSIGN PATIENT PHYSIOTHERAPY",
  [ASSIGN_PATIENT_COORDINATOR_PERMISSION]: "ASSIGN PATIENT COORDINATOR",
  [VIEW_PATIENT_ACTIVITY_LOG_PERMISSION]: "VIEW PATIENT ACTIVITY LOG",
  [VIEW_PATIENT_TIMELINE_PERMISSION]: "VIEW PATIENT TIMELINE",
};

const ASSIGNABLE_DASHBOARD_PERMISSIONS = [
  ...ENQUIRY_SUB_TAB_PERMISSIONS,
  PAYMENT_DATA_PERMISSION,
  ACTIVITY_LOG_PERMISSION,
  DOCTOR_REVIEW_PERMISSION,
  REFERRAL_PERMISSION,
  DIRECTOR_MESSAGES_PERMISSION,
  PHYSIOTHERAPY_PERMISSION,
  PATIENT_TRAVEL_PERMISSION,
  GUEST_HOUSES_PERMISSION,
  GUEST_HOUSE_SERVICES_PERMISSION,
  ORDERS_PERMISSION,
  MESSAGES_PERMISSION,
  ASSIGN_PATIENT_PHYSIOTHERAPY_PERMISSION,
  ASSIGN_PATIENT_COORDINATOR_PERMISSION,
  VIEW_PATIENT_ACTIVITY_LOG_PERMISSION,
  VIEW_PATIENT_TIMELINE_PERMISSION,
];

const parsePermissionList = (permissions) =>
  (Array.isArray(permissions)
    ? permissions
    : String(permissions || "").split(",")
  )
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("/") ? p : `/${p}`));

export const hasDashboardPermission = (permissions, permissionKey, role) => {
  const list = parsePermissionList(permissions);
  if (list.includes(permissionKey)) return true;
  return String(role || "").toLowerCase() === "admin";
};

export const hasAnyDashboardPermission = (
  permissions,
  permissionKeys = [],
  role,
) => {
  const r = String(role || localStorage.getItem("Role") || "").trim().toLowerCase();
  if (r === "admin") return true;

  const list = parsePermissionList(permissions);
  const normalizedList = list.map((k) => k.toLowerCase());
  return permissionKeys.some((key) => {
    return list.includes(key) || normalizedList.includes(key.toLowerCase());
  });
};

export const hasAssignPatientPhysioPermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, ASSIGN_PATIENT_PHYSIOTHERAPY_PERMISSIONS, role);

export const hasAssignPatientCoordinatorPermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, ASSIGN_PATIENT_COORDINATOR_PERMISSIONS, role);

export const hasViewPatientActivityLogPermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, VIEW_PATIENT_ACTIVITY_LOG_PERMISSIONS, role);

export const hasViewPatientTimelinePermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, VIEW_PATIENT_TIMELINE_PERMISSIONS, role);

export const hasSosEmergencyPermission = (permissions, role) => {
  const list = parsePermissionList(permissions);
  if (SOS_EMERGENCY_PERMISSIONS.some((ep) => list.includes(ep))) return true;
  return String(role || "").toLowerCase() === "admin";
};

export const isSocialMediaRole = (role) => {
  const r = String(role || localStorage.getItem("Role") || "").trim().toLowerCase();
  return (
    r === "social media leads" ||
    r === "social media lead" ||
    r === "social_media_leads" ||
    r === "social media"
  );
};

export const hasCampaignContactsPermission = (permissions, role) => {
  const list = parsePermissionList(permissions);
  if (list.includes(CAMPAIGN_CONTACTS_PERMISSION)) return true;
  if (String(role || "").toLowerCase() === "admin") return true;
  if (isSocialMediaRole(role)) {
    const hasAnyLeadExplicit =
      list.includes(CAMPAIGN_CONTACTS_PERMISSION) ||
      list.includes(CHATBOT_LEADS_PERMISSION);
    return !hasAnyLeadExplicit || list.includes(CAMPAIGN_CONTACTS_PERMISSION);
  }
  return false;
};

export const hasChatbotLeadsPermission = (permissions, role) => {
  const list = parsePermissionList(permissions);
  if (list.includes(CHATBOT_LEADS_PERMISSION)) return true;
  if (String(role || "").toLowerCase() === "admin") return true;
  if (isSocialMediaRole(role)) {
    const hasAnyLeadExplicit =
      list.includes(CAMPAIGN_CONTACTS_PERMISSION) ||
      list.includes(CHATBOT_LEADS_PERMISSION);
    return !hasAnyLeadExplicit || list.includes(CHATBOT_LEADS_PERMISSION);
  }
  return false;
};

export const hasActivityLogPermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, ACTIVITY_LOG_PERMISSIONS, role);

export const hasDoctorReviewPermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, DOCTOR_REVIEW_PERMISSIONS, role);

export const hasDirectorMessagesPermission = () => true;

export const hasSendDirectorMessagePermission = (permissions, role) => {
  const r = String(role || localStorage.getItem("Role") || "").trim().toLowerCase();
  return r === "admin";
};

export const hasReferralPermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, REFERRAL_PERMISSIONS, role);

export const hasInsurancePermission = (permissions, role) =>
  hasAnyDashboardPermission(permissions, INSURANCE_PERMISSIONS, role);

export const hasEnquirySubTabPermission = (permissions, permissionKey, role) => {
  if (permissionKey === SOS_EMERGENCY_PERMISSION) {
    return hasSosEmergencyPermission(permissions, role);
  }
  if (permissionKey === CAMPAIGN_CONTACTS_PERMISSION) {
    return hasCampaignContactsPermission(permissions, role);
  }
  if (permissionKey === CHATBOT_LEADS_PERMISSION) {
    return hasChatbotLeadsPermission(permissions, role);
  }
  return hasDashboardPermission(permissions, permissionKey, role);
};

/** Ensure Manage Permissions always shows assignable dashboard permission rows. */
export const ensureEnquirySubTabPermissions = (roles) => {
  if (!Array.isArray(roles) || roles.length === 0) return roles;

  return roles.map((role) => {
    const permissions = { ...(role.permissions || {}) };

    ASSIGNABLE_DASHBOARD_PERMISSIONS.forEach((key) => {
      if (permissions[key] == null) {
        permissions[key] = 0;
      }
    });

    if (
      permissions[SOS_EMERGENCY_PERMISSION] == null &&
      permissions[SOS_EMERGENCY_PERMISSION_LEGACY] != null
    ) {
      permissions[SOS_EMERGENCY_PERMISSION] =
        permissions[SOS_EMERGENCY_PERMISSION_LEGACY];
    }

    if (
      permissions[ACTIVITY_LOG_PERMISSION] == null &&
      permissions[ACTIVITY_LOG_PERMISSION_LEGACY] != null
    ) {
      permissions[ACTIVITY_LOG_PERMISSION] =
        permissions[ACTIVITY_LOG_PERMISSION_LEGACY];
    }

    if (
      permissions[DOCTOR_REVIEW_PERMISSION] == null &&
      permissions[DOCTOR_REVIEW_PERMISSION_ALT] != null
    ) {
      permissions[DOCTOR_REVIEW_PERMISSION] =
        permissions[DOCTOR_REVIEW_PERMISSION_ALT];
    }

    return { ...role, permissions };
  });
};

/** @deprecated Use ensureEnquirySubTabPermissions */
export const ensureSosEmergencyPermission = ensureEnquirySubTabPermissions;

export const formatPermissionEndpointLabel = (endpoint) => {
  if (PERMISSION_LABELS[endpoint]) {
    return PERMISSION_LABELS[endpoint];
  }
  return String(endpoint || "")
    .replace(/_/g, " ")
    .replace(/^\//, "")
    .toUpperCase();
};

/** Hide legacy duplicate keys when the preferred dashboard key is present. */
export const getPermissionTableEndpoints = (roles) => {
  if (!Array.isArray(roles) || roles.length === 0) return [];

  const endpoints = Object.keys(roles[0]?.permissions || {});
  const hasReadableSos = endpoints.includes(SOS_EMERGENCY_PERMISSION);
  const hasActivityLog = endpoints.includes(ACTIVITY_LOG_PERMISSION);
  const hasDoctorReview = endpoints.includes(DOCTOR_REVIEW_PERMISSION);

  return endpoints.filter((endpoint) => {
    if (hasReadableSos && endpoint === SOS_EMERGENCY_PERMISSION_LEGACY) {
      return false;
    }
    if (hasActivityLog && endpoint === ACTIVITY_LOG_PERMISSION_LEGACY) {
      return false;
    }
    if (hasDoctorReview && endpoint === DOCTOR_REVIEW_PERMISSION_ALT) {
      return false;
    }
    return true;
  });
};

export const openSosAlertFromListing = (sosId, alert = null) => {
  if (!sosId) return;
  window.dispatchEvent(
    new CustomEvent(OPEN_SOS_ALERT_EVENT, {
      detail: { sosId, alert },
    }),
  );
};
