/** Canonical patient status options for the patients table */
export const PATIENT_STATUS_OPTIONS = [
  { value: "Travelled", label: "Travelled" },
  { value: "Traveling Today", label: "Traveling Today" },
  { value: "In_Process", label: "In Process" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Pending", label: "Pending" },
  { value: "On Hold", label: "On Hold" },
  { value: "Ongoing Treatment", label: "Ongoing Treatment" },
  { value: "Ongoing Fundraising", label: "Ongoing Fundraising" },
  { value: "Treatment Completed", label: "Treatment Completed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Local Case", label: "Local Case" },
  { value: "Follow Up", label: "Follow Up" },
  { value: "Passed Away", label: "Passed Away" },
  { value: "Arriving", label: "Arriving" },
  { value: "Departing", label: "Departing" },
  { value: "Preponed", label: "Preponed" },
  { value: "Postponed", label: "Postponed" },
  { value: "Visit 1", label: "Visit 1" },
  { value: "Visit 2", label: "Visit 2" },
];

/** Statuses that require travel details before save */
export const TRAVEL_STATUS_VALUES = [
  "Arriving",
  "Departing",
  "Preponed",
  "Postponed",
];

/** Specific statuses allowed on the Patient Travel page */
export const PATIENT_TRAVEL_STATUS_OPTIONS = [
  { value: "Arriving", label: "Arriving" },
  { value: "Departing", label: "Departing" },
  { value: "Ongoing Treatment", label: "Ongoing Treatment" },
  { value: "Preponed", label: "Preponed" },
  { value: "Postponed", label: "Postponed" },
  { value: "Travelled", label: "Travelled" },
  { value: "Traveling Today", label: "Travelling Today" },
];

const STATUS_ALIASES = {
  "traveling today": "Traveling Today",
  "travelling today": "Traveling Today",
  "traveling_today": "Traveling Today",
  "travelling_today": "Traveling Today",
  in_process: "In_Process",
  "in process": "In_Process",
  "ongoing treatment": "Ongoing Treatment",
  ongoing_treatment: "Ongoing Treatment",
  "under treatment": "Ongoing Treatment",
  "ongoing fundraising": "Ongoing Fundraising",
  ongoing_fundraising: "Ongoing Fundraising",
  "ongoing fund raising": "Ongoing Fundraising",
  fundraising: "Ongoing Fundraising",
  visit1: "Visit 1",
  "visit 1": "Visit 1",
  visit_1: "Visit 1",
  visit2: "Visit 2",
  "visit 2": "Visit 2",
  visit_2: "Visit 2",
};

/** Map API / legacy values to a Select-compatible canonical value */
export const normalizePatientStatus = (status) => {
  if (status == null || status === "") return "";
  const trimmed = String(status).trim();
  const aliasKey = trimmed.toLowerCase().replace(/_/g, " ");
  if (STATUS_ALIASES[aliasKey]) {
    return STATUS_ALIASES[aliasKey];
  }
  const exact = PATIENT_STATUS_OPTIONS.find((option) => option.value === trimmed);
  if (exact) return exact.value;
  const caseInsensitive = PATIENT_STATUS_OPTIONS.find(
    (option) => option.value.toLowerCase() === trimmed.toLowerCase(),
  );
  return caseInsensitive?.value ?? trimmed;
};

export const isTravelStatus = (status) => {
  const normalized = normalizePatientStatus(status);
  return TRAVEL_STATUS_VALUES.some(
    (value) => value.toLowerCase() === String(normalized).toLowerCase(),
  );
};

export const getPatientStatusLabel = (status) => {
  const normalized = normalizePatientStatus(status);
  const option = PATIENT_STATUS_OPTIONS.find((item) => item.value === normalized);
  return option?.label ?? status ?? "";
};

/** CSS class key for colorful status badges (Dashboard Aging Monitor, etc.) */
export const getPatientStatusBadgeKey = (status) => {
  if (status == null || status === "" || status === "—") return "default";
  const key = String(status)
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9+-]/g, "");

  const aliases = {
    "in-process": "in-process",
    "traveling-today": "traveling-today",
    "travelling-today": "traveling-today",
    "ongoing-treatment": "ongoing-treatment",
    "ongoing-fundraising": "ongoing-fundraising",
    "treatment-completed": "treatment-completed",
    "local-case": "local-case",
    "follow-up": "follow-up",
    "passed-away": "passed-away",
    "insurance-+-private": "insurance-private",
    "insurance+private": "insurance-private",
    arrival: "arriving",
  };

  return aliases[key] || key || "default";
};

export const PATIENT_STATUS_FILTER_VALUES = [
  "Travelled",
  "Traveling Today",
  "Confirmed",
  "Pending",
  "On Hold",
  "Ongoing Treatment",
  "Ongoing Fundraising",
  "Treatment Completed",
  "Cancelled",
  "Local Case",
  "Follow Up",
  "Passed Away",
  "Arrival",
  "Arriving",
  "Departing",
  "Preponed",
  "Postponed",
  "Visit 1",
  "Visit 2",
];

/** Hospital statuses shown in Treatment section listing */
export const HOSPITAL_STATUS_OPTIONS = [
  { value: "Admitted", label: "Admitted" },
  { value: "Under Review", label: "Under Review" },
  { value: "Under Surgery", label: "Under Surgery" },
  { value: "Under Recovery", label: "Under Recovery" },
  { value: "Discharged", label: "Discharged" },
];

export const HOSPITAL_STATUS_VALUES = HOSPITAL_STATUS_OPTIONS.map(
  (option) => option.value,
);

/** Manual Current Stage options for Dashboard Patient Aging Monitor */
export const PATIENT_AGING_STAGE_OPTIONS = [
  "None",
  "On Hold",
  "Travel",
  "Passed Away",
  "Cancel",
  "Treatment Completed",
  "Waiting for Report",
  "Waiting for Treatment Plan",
  "Waiting for Full Quotation",
  "Waiting for Foundation",
  "Waiting for Insurance",
  "Waiting for Visa Procedures",
  "Waiting for Travelling Procedures",
];

const AGING_STAGE_ALIASES = {
  "on hold": "On Hold",
  onhold: "On Hold",
  "on_hold": "On Hold",
  cancelled: "Cancel",
  cancel: "Cancel",
  travel: "Travel",
  travelled: "Travel",
  traveled: "Travel",
  "passed away": "Passed Away",
  passedaway: "Passed Away",
  "treatment completed": "Treatment Completed",
  "treatment_completed": "Treatment Completed",
  none: "None",
};

/** Map API / display stage text to a canonical aging-stage option */
export const normalizeAgingStage = (stage) => {
  if (stage == null || stage === "" || stage === "—") return "";
  const trimmed = String(stage).trim();
  const aliasKey = trimmed.toLowerCase();
  if (AGING_STAGE_ALIASES[aliasKey]) {
    return AGING_STAGE_ALIASES[aliasKey];
  }
  const exact = PATIENT_AGING_STAGE_OPTIONS.find((option) => option === trimmed);
  if (exact) return exact;
  const caseInsensitive = PATIENT_AGING_STAGE_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return caseInsensitive || trimmed;
};
