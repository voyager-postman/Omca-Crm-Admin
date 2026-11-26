import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorMessage, Field, Form, Formik } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { Autocomplete, Checkbox, TextField } from "@mui/material";
import { GetAllCountries2 } from "../../reducer/Countries";
import { GetAllHositalData } from "../../reducer/HospitalSlice";
import CountryCodeSelect from "../Enquiry/CountryCodeSelect";
import { NativeSubmitButton } from "../../components/Common/SubmitButton";
import {
  contactNumberYup,
  handleContactNumberChange,
  optionalContactNumberYup,
} from "../../utils/phoneValidation";
import {
  GENERAL_ENQUIRY_FORMS,
  isPickupIdLocationType,
} from "./generalEnquiryFormConfig";
import {
  fetchGeneralEnquiry,
  buildHomeCareSavePayload,
  buildPickupSavePayload,
  fetchAirports,
  geocodeAddress,
  fetchHomeCareServices,
  fetchHomeCareTypes,
  fetchTestList,
  saveGeneralEnquiry,
} from "./generalEnquiryApi";
import {
  crmSaveErrorMessage,
  isCrmSaveSuccess,
} from "../../services/crmRequestSaveApi";
import LocationDropdown from "../../components/LocationSelects";
import PatientUserSelect, {
  applyPatientProfile,
} from "../../components/PatientUserSelect";
import { fetchGuestHouseById, fetchGuestHouses } from "../../services/guestHouseApi";
import { isOnOrAfterToday, todayDateInput } from "../../utils/dateInput";

const dateFieldMin = (name, values) => {
  const today = todayDateInput();
  if (name === "checkout" && values.checkin && values.checkin > today) {
    return values.checkin;
  }
  if (name === "end_date" && values.start_date && values.start_date > today) {
    return values.start_date;
  }
  return today;
};

const toDateInput = (value) => {
  if (value === undefined || value === null || value === "" || value === 0 || value === "0") {
    return "";
  }
  const str = String(value).trim();
  if (/^0{4}/.test(str) || str.startsWith("0000-00-00")) return "";
  const dmy = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  if (year < 1990) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (value) => {
  if (!value) return "";
  const str = String(value);
  const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const meridian = ampmMatch[3].toUpperCase();
    if (meridian === "PM" && hour < 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${ampmMatch[2]}`;
  }
  const isoTime = str.match(/T(\d{2}):(\d{2})/);
  if (isoTime) return `${isoTime[1]}:${isoTime[2]}`;
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
};

const firstValue = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = value.id ?? value._id ?? value.name ?? "";
      if (nested !== "") return nested;
      continue;
    }
    return value;
  }
  return "";
};

const mergeRecords = (base = {}, extra = {}) => {
  const merged = { ...base };
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    merged[key] = value;
  });
  return merged;
};

const unwrapArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.guesthouses)) return payload.guesthouses;
  if (Array.isArray(payload?.rooms)) return payload.rooms;
  if (Array.isArray(payload?.data?.rooms)) return payload.data.rooms;
  return [];
};

const matchByIdOrName = (list = [], value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return (
    list.find((item) => String(item?.id ?? item?._id ?? "") === raw) ||
    list.find(
      (item) =>
        String(item?.name || item?.title || "").trim().toLowerCase() === lower,
    ) ||
    null
  );
};

const getListItemId = (item) =>
  String(
    item?.id ?? item?._id ?? item?.hospitalId ?? item?.test_id ?? "",
  ).trim();

const getListItemLabel = (item) =>
  item?.name ||
  item?.title ||
  item?.test_name ||
  item?.hospitalName ||
  item?.home_care_type ||
  "";

const pickupOptionsFor = (type, { hospitals, airports, guestHouses }) => {
  if (type === "Hospital") return hospitals;
  if (type === "Airport") return airports;
  if (type === "Guest House") return guestHouses;
  return [];
};

const pickupOptionAddress = (type, option) => {
  if (type === "Airport") return option?.address || getListItemLabel(option);
  if (type === "Guest House") {
    const name = option?.name || option?.title || "";
    return option?.address ? `${name}, ${option.address}` : name;
  }
  return option?.address || getListItemLabel(option);
};

const plainText = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const homeCareTypeId = (item) =>
  String(item?.home_care_type_id ?? item?.id ?? "").trim();

const homeCareServiceId = (item) => String(item?.id ?? "").trim();

const homeCareServiceLabel = (item) => {
  const text = plainText(item?.home_care_services) || item?.home_care_type || "Service";
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
};

const parseIdList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object"
          ? getListItemId(item) || getListItemLabel(item)
          : String(item || "").trim(),
      )
      .filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const DETAIL_TYPE_KEYS = {
  Story: ["stay", "story", "guest_house"],
  Flight: ["flight", "flights"],
  Pickup: ["pickup", "pickup_drop"],
  HomeCareRequest: ["home_care", "homecare"],
  LabTest: ["lab_test", "test_ords", "test"],
  PatientContactEnquiry: ["contact_us", "contact"],
};

const unwrapEnquiryRow = (res, model) => {
  const body = res?.data?.data ?? res?.data ?? res?.detail ?? res ?? {};
  if (Array.isArray(body) && body[0] && typeof body[0] === "object") {
    return body[0];
  }
  if (body && typeof body === "object") {
    const keys = DETAIL_TYPE_KEYS[model] || [];
    for (const key of keys) {
      const candidate = body[key];
      if (Array.isArray(candidate) && candidate[0] && typeof candidate[0] === "object") {
        return candidate[0];
      }
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        return candidate;
      }
    }
  }
  return body && !Array.isArray(body) ? body : {};
};

const FormField = ({ label, name, required, children, colClass = "col-md-4" }) => (
  <div className={colClass}>
    <div className="set-field">
      <label>
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </label>
      {children}
      <ErrorMessage name={name} component="div" className="text-danger" />
    </div>
  </div>
);

export default function GeneralEnquiryRequestForm() {
  const { formKey } = useParams();
  const config = GENERAL_ENQUIRY_FORMS[formKey];
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { Countries } = useSelector((state) => state.Countries);
  const hospitals = useSelector((state) =>
    Array.isArray(state.hospital?.hospital) ? state.hospital.hospital : [],
  );
  const recordId = location.state?.id;
  const isEdit = Boolean(recordId);
  const [initialValues, setInitialValues] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(isEdit);
  const [guestHouses, setGuestHouses] = useState([]);
  const [guestRooms, setGuestRooms] = useState([]);
  const [tests, setTests] = useState([]);
  const [homeCareTypes, setHomeCareTypes] = useState([]);
  const [homeCareServices, setHomeCareServices] = useState([]);
  const [homeCareServicesLoading, setHomeCareServicesLoading] = useState(false);
  const [pendingHomeCareTypeName, setPendingHomeCareTypeName] = useState("");
  const [airports, setAirports] = useState([]);
  const [geocodingPrefix, setGeocodingPrefix] = useState("");

  useEffect(() => {
    dispatch(GetAllCountries2());
  }, [dispatch]);

  useEffect(() => {
    if (config?.key !== "pickup") return;
    let cancelled = false;
    dispatch(GetAllHositalData());
    fetchAirports()
      .then((list) => {
        if (!cancelled) setAirports(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setAirports([]);
      });
    return () => {
      cancelled = true;
    };
  }, [config?.key, dispatch]);

  useEffect(() => {
    if (config?.key !== "story" && config?.key !== "pickup") return;
    let cancelled = false;
    fetchGuestHouses()
      .then((res) => {
        if (!cancelled) setGuestHouses(unwrapArray(res));
      })
      .catch(() => {
        if (!cancelled) setGuestHouses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [config?.key]);

  useEffect(() => {
    if (config?.key !== "test-form") return;
    let cancelled = false;
    dispatch(GetAllHositalData());
    fetchTestList()
      .then((list) => {
        if (!cancelled) setTests(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setTests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [config?.key, dispatch]);

  useEffect(() => {
    if (config?.key !== "home-care") return;
    let cancelled = false;
    fetchHomeCareTypes()
      .then((list) => {
        if (!cancelled) setHomeCareTypes(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setHomeCareTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [config?.key]);

  useEffect(() => {
    if (config?.key !== "home-care" || !homeCareTypes.length) return;
    if (initialValues?.home_care_type_id || !pendingHomeCareTypeName) return;
    const name = pendingHomeCareTypeName.trim().toLowerCase();
    const match = homeCareTypes.find(
      (item) => String(item.home_care_type || "").trim().toLowerCase() === name,
    );
    if (!match) return;
    setInitialValues((prev) =>
      prev ? { ...prev, home_care_type_id: homeCareTypeId(match) } : prev,
    );
  }, [
    config?.key,
    homeCareTypes,
    initialValues?.home_care_type_id,
    pendingHomeCareTypeName,
  ]);

  useEffect(() => {
    if (config?.key !== "home-care") return;
    const typeId = initialValues?.home_care_type_id;
    if (!typeId) {
      setHomeCareServices([]);
      return;
    }
    let cancelled = false;
    setHomeCareServicesLoading(true);
    fetchHomeCareServices(typeId)
      .then((list) => {
        if (cancelled) return;
        const services = Array.isArray(list) ? list : [];
        setHomeCareServices(services);
        if (services.length === 1) {
          const onlyId = homeCareServiceId(services[0]);
          setInitialValues((prev) => {
            if (!prev || prev.home_care_service_id) return prev;
            return { ...prev, home_care_service_id: onlyId };
          });
        }
      })
      .catch(() => {
        if (!cancelled) setHomeCareServices([]);
      })
      .finally(() => {
        if (!cancelled) setHomeCareServicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config?.key, initialValues?.home_care_type_id]);

  const emptyValues = useMemo(() => {
    if (!config) return {};
    const values = { country_code: "", user_id: "" };
    config.fields.forEach((field) => {
      values[field.name] = "";
    });
    (config.hiddenFields || []).forEach((name) => {
      values[name] = "";
    });
    if (config.termsKey) values[config.termsKey] = false;
    return values;
  }, [config]);

  const mapRecord = (row = {}) => {
    const values = { ...emptyValues };
    values.country_code = firstValue(
      row.country_code,
      row.phoneCode,
      row.phone_code,
      row.dial_code,
    );
    values.user_id = firstValue(
      row.user_id,
      row.userId,
      location.state?.user_id,
    );
    if (config.termsKey) {
      if (config.key === "home-care") {
        const saved = firstValue(
          row.term_condition,
          row.terms_condtion,
          row[config.termsKey],
        );
        values[config.termsKey] =
          saved === true ||
          saved === 1 ||
          saved === "1" ||
          saved === "true";
      } else {
        values[config.termsKey] = true;
      }
    }
    config.fields.forEach((field) => {
      let value = row[field.name];
      if (field.name === "first_name") {
        value = firstValue(row.first_name, row.first_name_2, row.name);
      } else if (field.name === "name") {
        value = firstValue(row.name, row.first_name, row.first_name_2);
      } else if (field.name === "email") {
        value = firstValue(row.email, row.email_2);
      } else if (field.name === "phone") {
        value = firstValue(row.phone, row.phone_2);
      } else if (field.name === "services") {
        value = firstValue(row.services, row.services_2);
      } else if (field.name === "destination_location") {
        value = firstValue(row.destination_location, row.drop_location);
      } else if (field.name === "guestHouse_id") {
        value = firstValue(
          row.guestHouse_id,
          row.guesthouse_id,
          row.guest_house_id,
          row.guesthouse?.id,
          row.guesthouse,
        );
      } else if (field.name === "guestHouseRoom_id") {
        value = firstValue(
          row.guestHouseRoom_id,
          row.guesthouse_room_id,
          row.guest_house_room_id,
          row.guesthouse_room_type?.id,
          row.guesthouse_room_type,
        );
      } else if (field.name === "rooms") {
        value = firstValue(row.rooms, row.no_of_rooms, row.number_of_rooms);
      } else if (field.name === "adults") {
        value = firstValue(row.adults, row.no_of_adults, row.number_of_adults);
      } else if (field.name === "children") {
        value = firstValue(row.children, row.no_of_children, row.number_of_children);
      } else if (field.name === "payment_mode") {
        value = firstValue(row.payment_mode, row.paymentMode, row.payment_type);
      } else if (field.name === "country_id") {
        value = firstValue(
          row.country_id,
          row.country?.id,
          row.country_name,
          row.country,
        );
      } else if (field.name === "state_id") {
        value = firstValue(
          row.state_id,
          row.state?.id,
          row.state_name,
          row.state,
        );
      } else if (field.name === "city_id") {
        value = firstValue(
          row.city_id,
          row.city?.id,
          row.city_name,
          row.city,
        );
      } else if (field.name === "test_ids") {
        value = parseIdList(
          Array.isArray(row.test_ids) || row.test_ids
            ? row.test_ids
            : firstValue(row.test_id, row.test_names, row.tests),
        ).join(",");
      } else if (field.name === "home_care_type_id") {
        const typeValue = row.home_care_type;
        value = firstValue(
          row.home_care_type_id,
          row.homeCareTypeId,
          typeValue && typeof typeValue === "object"
            ? typeValue.home_care_type_id || typeValue.id
            : "",
        );
        if (value !== undefined && value !== null && value !== "" && !/^\d+$/.test(String(value))) {
          value = "";
        }
      } else if (field.name === "home_care_service_id") {
        const services = row.home_care_services;
        const serviceFromObject =
          services && typeof services === "object" && !Array.isArray(services)
            ? services.id || services.home_care_service_id
            : "";
        const serviceFromList = Array.isArray(services)
          ? services
              .map((item) =>
                typeof item === "object"
                  ? item.id || item.home_care_service_id
                  : /^\d+$/.test(String(item || "").trim())
                  ? String(item).trim()
                  : "",
              )
              .filter(Boolean)
              .join(",")
          : "";
        value = firstValue(
          row.home_care_service_id,
          row.home_care_services_id,
          serviceFromObject,
          serviceFromList,
        );
        if (value !== undefined && value !== null && value !== "" && !/^[\d,]+$/.test(String(value))) {
          value = "";
        }
      } else if (field.name === "hosp_id") {
        value = firstValue(
          row.hosp_id,
          row.hospital_id,
          row.hospital?.id,
          row.hospital,
        );
      } else if (field.name === "flight_type") {
        if (row.flight_type) value = row.flight_type;
        else if (String(row.type) === "2") value = "Round Trip";
        else if (String(row.type) === "1") value = "One Way";
      } else {
        value = firstValue(value, row[field.name]);
      }
      if (value && typeof value === "object") {
        value = firstValue(value.id, value._id, value.name);
      }
      if (field.type === "date") value = toDateInput(value);
      if (field.type === "time") value = toTimeInput(value);
      values[field.name] = value ?? "";
    });
    (config.hiddenFields || []).forEach((name) => {
      const value = row[name];
      values[name] =
        value === undefined || value === null ? "" : String(value).trim();
    });
    return values;
  };

  const applyMappedRecord = (row) => {
    const mapped = mapRecord(row);
    setPendingHomeCareTypeName(
      typeof row.home_care_type === "string" ? row.home_care_type : "",
    );
    setInitialValues(mapped);
    if (mapped.guestHouse_id && /^\d+$/.test(String(mapped.guestHouse_id))) {
      loadRooms(mapped.guestHouse_id);
    }
  };

  useEffect(() => {
    if (!config) return;
    if (!isEdit) {
      setInitialValues(emptyValues);
      setLoadingDetail(false);
      return;
    }
    const listRecord = location.state?.record || {};
    if (Object.keys(listRecord).length) {
      applyMappedRecord(listRecord);
      setLoadingDetail(false);
    }
    let cancelled = false;
    const load = async () => {
      if (!Object.keys(listRecord).length) setLoadingDetail(true);
      try {
        const res = await fetchGeneralEnquiry(recordId, config.model);
        const row = mergeRecords(listRecord, unwrapEnquiryRow(res, config.model));
        if (!cancelled) applyMappedRecord(row);
      } catch (error) {
        if (!cancelled && !Object.keys(listRecord).length) {
          Swal.fire(
            "Error",
            error?.response?.data?.message || `Failed to load ${config.title}`,
            "error",
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [config, isEdit, recordId, emptyValues]);

  const validationSchema = useMemo(() => {
    if (!config) return Yup.object();
    const shape = {
      user_id: Yup.string().trim().required("Please select a patient"),
    };
    if (config.termsKey && (!isEdit || config.key === "home-care")) {
      shape[config.termsKey] = Yup.boolean().oneOf(
        [true],
        "Please agree to the Terms and Conditions",
      );
    }
    config.fields.forEach((field) => {
      if (field.type === "phone") {
        shape.country_code = field.required
          ? Yup.string().required("Country code is required")
          : Yup.string().nullable();
        shape[field.name] = field.required
          ? contactNumberYup({ label: field.label })
          : optionalContactNumberYup({ label: field.label });
        return;
      }
      if (field.type === "email") {
        let schema = Yup.string().email("Enter a valid email");
        shape[field.name] = field.required
          ? schema.required(`${field.label} is required`)
          : schema.nullable();
        return;
      }
      if (field.type === "number") {
        let schema = Yup.number().typeError("Enter a valid number");
        shape[field.name] = field.required
          ? schema.required(`${field.label} is required`)
          : schema.nullable();
        return;
      }
      if (field.type === "date") {
        let schema = Yup.string().test(
          "not-past",
          "Previous dates are not allowed",
          (value) => isOnOrAfterToday(value),
        );
        if (field.name === "checkout") {
          schema = schema.test(
            "after-checkin",
            "Check out cannot be before check in",
            function (value) {
              const checkin = this.parent.checkin;
              if (!value || !checkin) return true;
              return value >= checkin;
            },
          );
        }
        if (field.name === "end_date") {
          schema = schema.test(
            "after-start",
            "End date cannot be before start date",
            function (value) {
              const start = this.parent.start_date;
              if (!value || !start) return true;
              return value >= start;
            },
          );
        }
        shape[field.name] = field.required
          ? schema.required(`${field.label} is required`)
          : schema.nullable();
        return;
      }
      if (field.type === "pickup_location") {
        const prefix = field.locationPrefix;
        const typeKey = `${prefix}_location_type`;
        shape[field.name] = Yup.string()
          .trim()
          .required(`${field.label} address is required`);
        shape[`${prefix}_location_id`] = Yup.string().test(
          "location-id",
          `Please select the ${field.label.toLowerCase()} location`,
          function (value) {
            if (!isPickupIdLocationType(this.parent[typeKey])) return true;
            return Boolean(String(value || "").trim());
          },
        );
        const coordinate = (key, label, limit) => {
          shape[`${prefix}_${key}`] = Yup.string().test(
            key,
            `Enter a valid ${label} (-${limit} to ${limit})`,
            function (value) {
              if (!this.parent[typeKey]) return true;
              if (isPickupIdLocationType(this.parent[typeKey])) return true;
              const raw = String(value ?? "").trim();
              if (!raw) {
                return this.createError({ message: `${label} is required` });
              }
              const number = Number(raw);
              return Number.isFinite(number) && Math.abs(number) <= limit;
            },
          );
        };
        coordinate("latitude", "Latitude", 90);
        coordinate("longitude", "Longitude", 180);
        return;
      }
      let schema = Yup.string();
      shape[field.name] = field.required
        ? schema.trim().required(`${field.label} is required`)
        : schema.nullable();
    });
    return Yup.object().shape(shape);
  }, [config, isEdit]);

  const goBack = () => {
    if (config) localStorage.setItem("generalEnquiryTab", config.key);
    navigate("/Admin/General_Enquiries");
  };

  const loadRooms = async (guestHouseId) => {
    if (!guestHouseId) {
      setGuestRooms([]);
      return;
    }
    try {
      const res = await fetchGuestHouseById(guestHouseId);
      const rooms = unwrapArray(res?.data?.rooms || res?.rooms || res);
      setGuestRooms(
        rooms.filter(
          (item) => item && (item.id || item._id || item.title || item.name),
        ),
      );
    } catch (error) {
      setGuestRooms([]);
    }
  };

  useEffect(() => {
    if (!initialValues?.guestHouse_id) return;
    const match = matchByIdOrName(guestHouses, initialValues.guestHouse_id);
    if (match) {
      const id = String(match.id || match._id || "");
      if (id && id !== String(initialValues.guestHouse_id)) {
        setInitialValues((prev) =>
          prev ? { ...prev, guestHouse_id: id } : prev,
        );
      }
      loadRooms(id || initialValues.guestHouse_id);
      return;
    }
    if (/^\d+$/.test(String(initialValues.guestHouse_id))) {
      loadRooms(initialValues.guestHouse_id);
    }
  }, [guestHouses, initialValues?.guestHouse_id]);

  useEffect(() => {
    if (!initialValues?.guestHouseRoom_id || !guestRooms.length) return;
    const match = matchByIdOrName(guestRooms, initialValues.guestHouseRoom_id);
    if (!match) return;
    const id = String(match.id || match._id || "");
    if (id && id !== String(initialValues.guestHouseRoom_id)) {
      setInitialValues((prev) =>
        prev ? { ...prev, guestHouseRoom_id: id } : prev,
      );
    }
  }, [guestRooms, initialValues?.guestHouseRoom_id]);

  const handleSubmit = async (values, { setSubmitting }) => {
    const buildJsonPayload = {
      "home-care": buildHomeCareSavePayload,
      pickup: buildPickupSavePayload,
    }[config.key];
    if (buildJsonPayload) {
      try {
        const res = await saveGeneralEnquiry(
          buildJsonPayload(values, isEdit ? recordId : undefined),
          config.savePath,
        );
        if (!isCrmSaveSuccess(res)) {
          Swal.fire(
            "Error",
            crmSaveErrorMessage({ response: { data: res } }, `Unable to save ${config.title}`),
            "error",
          );
          return;
        }
        await Swal.fire(
          "Success",
          res?.message ||
            (isEdit ? `${config.title} updated` : `${config.title} created`),
          "success",
        );
        goBack();
      } catch (error) {
        Swal.fire(
          "Error",
          crmSaveErrorMessage(error, `Unable to save ${config.title}`),
          "error",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const formData = new FormData();
    if (isEdit) formData.append("id", recordId);
    formData.append("user_id", values.user_id);

    Object.entries(values).forEach(([key, value]) => {
      if (key === "user_id") return;
      if (config.termsKey && key === config.termsKey) return;
      if (value === undefined || value === null || value === "") return;
      if (key === "home_care_type_id" || key === "home_care_service_id") {
        return;
      }
      if (key === "test_ids") {
        String(value)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((id) => formData.append("test_ids[]", id));
        return;
      }
      if (key === "flight_type") {
        formData.append(
          "type",
          String(value).toLowerCase().includes("round") ? "2" : "1",
        );
        return;
      }
      formData.append(key, value);
    });

    if (values.country_code) formData.append("phone_code", values.country_code);
    if (config.termsKey) {
      formData.append(config.termsKey, values[config.termsKey] ? "1" : "0");
    }

    try {
      const res = await saveGeneralEnquiry(formData, config.savePath);
      if (!isCrmSaveSuccess(res)) {
        Swal.fire(
          "Error",
          crmSaveErrorMessage({ response: { data: res } }, `Unable to save ${config.title}`),
          "error",
        );
        return;
      }
      await Swal.fire(
        "Success",
        res?.message ||
          (isEdit ? `${config.title} updated` : `${config.title} created`),
        "success",
      );
      goBack();
    } catch (error) {
      Swal.fire(
        "Error",
        crmSaveErrorMessage(error, `Unable to save ${config.title}`),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!config) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <p>Form not found.</p>
        </div>
      </div>
    );
  }

  if (loadingDetail || !initialValues) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const autocompleteInputSx = {
    "& .MuiInputBase-root": { height: 38 },
    "& .MuiInputBase-input": { padding: "6px 12px" },
  };

  const autocompleteMultiSx = {
    "& .MuiOutlinedInput-root": {
      minHeight: 38,
      height: "auto !important",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "4px",
      padding: "4px 8px",
    },
    "& .MuiAutocomplete-input": {
      minWidth: "70px !important",
      padding: "4px 6px !important",
    },
    "& .MuiChip-root": {
      height: 24,
      maxWidth: "100%",
    },
    "& .MuiChip-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="topmainhd">
              <h6>
                <i
                  className="fa-solid fa-arrow-left-long me-2"
                  onClick={goBack}
                  style={{ cursor: "pointer" }}
                ></i>
                {isEdit ? `Edit ${config.title}` : `Create ${config.title}`}
              </h6>
            </div>
          </div>
          <div className="col-md-12">
            <Formik
              enableReinitialize
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ values, setFieldValue, errors, touched, isSubmitting }) => (
                <Form>
                  <div className="row gx-3 gy-3">
                    <div className="col-md-12">
                      <div className="main_content">
                        <div className="row gx-3 gy-3">
                          <div className="col-md-4">
                            <PatientUserSelect
                              value={values.user_id}
                              disabled={isEdit}
                              required
                              fallbackUser={{
                                name: values.name || values.first_name,
                                email: values.email,
                                phone: values.phone,
                                country_code: values.country_code,
                                passport_number: values.passport_number,
                              }}
                              error={Boolean(errors.user_id && touched.user_id)}
                              helperText={
                                errors.user_id && touched.user_id
                                  ? errors.user_id
                                  : ""
                              }
                              onChange={(userId, patient) => {
                                setFieldValue("user_id", userId);
                                if (!isEdit && patient) {
                                  applyPatientProfile(patient, setFieldValue);
                                }
                              }}
                            />
                          </div>
                          {config.fields.map((field) => {
                            if (field.type === "phone") {
                              return (
                                <div className="col-md-4" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <div
                                      className="country-code"
                                      style={{ position: "relative" }}
                                    >
                                      <CountryCodeSelect
                                        value={values.country_code}
                                        onChange={(code) =>
                                          setFieldValue("country_code", code)
                                        }
                                        countries={Countries}
                                        error={Boolean(
                                          errors.country_code && touched.country_code,
                                        )}
                                      />
                                      <Field
                                        className="form-control code-in"
                                        name={field.name}
                                        placeholder="Enter phone number"
                                        onChange={(e) =>
                                          handleContactNumberChange(
                                            e,
                                            setFieldValue,
                                            field.name,
                                          )
                                        }
                                      />
                                    </div>
                                    <ErrorMessage
                                      name="country_code"
                                      component="div"
                                      className="text-danger"
                                    />
                                    <ErrorMessage
                                      name={field.name}
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (
                              field.type === "country_id" ||
                              field.type === "state_id" ||
                              field.type === "city_id"
                            ) {
                              const locType = field.type.replace("_id", "");
                              return (
                                <LocationDropdown
                                  key={field.name}
                                  type={locType}
                                  label={field.label}
                                  name={field.name}
                                  required={field.required}
                                  value={values[field.name]}
                                  countryId={values.country_id}
                                  stateId={values.state_id}
                                  error={Boolean(
                                    errors[field.name] && touched[field.name],
                                  )}
                                  onChange={(id) => {
                                    setFieldValue(field.name, id);
                                    if (field.type === "country_id") {
                                      setFieldValue("state_id", "");
                                      setFieldValue("city_id", "");
                                    }
                                    if (field.type === "state_id") {
                                      setFieldValue("city_id", "");
                                    }
                                  }}
                                />
                              );
                            }

                            if (field.type === "hospital") {
                              const selected =
                                hospitals.find(
                                  (item) =>
                                    getListItemId(item) ===
                                      String(values.hosp_id || "") ||
                                    getListItemLabel(item).toLowerCase() ===
                                      String(values.hosp_id || "").toLowerCase(),
                                ) ||
                                (values.hosp_id
                                  ? {
                                      id: values.hosp_id,
                                      name: String(values.hosp_id),
                                    }
                                  : null);
                              return (
                                <div className="col-md-4" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <Autocomplete
                                      options={hospitals}
                                      getOptionLabel={(option) =>
                                        getListItemLabel(option)
                                      }
                                      isOptionEqualToValue={(option, item) =>
                                        getListItemId(option) ===
                                          getListItemId(item) ||
                                        getListItemLabel(option).toLowerCase() ===
                                          getListItemLabel(item).toLowerCase()
                                      }
                                      value={selected}
                                      onChange={(_, item) =>
                                        setFieldValue(
                                          "hosp_id",
                                          getListItemId(item),
                                        )
                                      }
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder="Select Hospital"
                                          error={Boolean(
                                            errors.hosp_id && touched.hosp_id,
                                          )}
                                          sx={autocompleteInputSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name="hosp_id"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "test_ids") {
                              const selectedIds = parseIdList(values.test_ids);
                              const selected = selectedIds.map((id) => {
                                const match =
                                  tests.find(
                                    (item) => getListItemId(item) === String(id),
                                  ) ||
                                  tests.find(
                                    (item) =>
                                      getListItemLabel(item).toLowerCase() ===
                                      String(id).toLowerCase(),
                                  );
                                return (
                                  match || {
                                    id,
                                    name: String(id),
                                  }
                                );
                              });
                              return (
                                <div className="col-md-8" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <Autocomplete
                                      multiple
                                      disableCloseOnSelect
                                      options={tests}
                                      getOptionLabel={(option) =>
                                        getListItemLabel(option)
                                      }
                                      isOptionEqualToValue={(option, item) =>
                                        getListItemId(option) ===
                                          getListItemId(item) ||
                                        getListItemLabel(option).toLowerCase() ===
                                          getListItemLabel(item).toLowerCase()
                                      }
                                      value={selected}
                                      onChange={(_, items) =>
                                        setFieldValue(
                                          "test_ids",
                                          (items || [])
                                            .map((item) => getListItemId(item))
                                            .filter(Boolean)
                                            .join(","),
                                        )
                                      }
                                      renderOption={(props, option, { selected: isSelected }) => (
                                        <li {...props}>
                                          <Checkbox
                                            size="small"
                                            checked={isSelected}
                                            style={{ marginRight: 8 }}
                                          />
                                          {getListItemLabel(option)}
                                        </li>
                                      )}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder={
                                            selected.length ? "" : "Select Tests"
                                          }
                                          error={Boolean(
                                            errors.test_ids && touched.test_ids,
                                          )}
                                          sx={autocompleteMultiSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name="test_ids"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "guesthouse") {
                              const selected =
                                matchByIdOrName(
                                  guestHouses,
                                  values.guestHouse_id,
                                ) ||
                                (values.guestHouse_id
                                  ? {
                                      id: values.guestHouse_id,
                                      name: String(values.guestHouse_id),
                                    }
                                  : null);
                              const options =
                                selected &&
                                !matchByIdOrName(guestHouses, selected.id || selected.name)
                                  ? [selected, ...guestHouses]
                                  : guestHouses;
                              return (
                                <div className="col-md-4" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <Autocomplete
                                      options={options}
                                      getOptionLabel={(option) =>
                                        option?.name || option?.title || ""
                                      }
                                      isOptionEqualToValue={(option, item) =>
                                        String(option?.id || option?._id || "") ===
                                          String(item?.id || item?._id || "") ||
                                        String(
                                          option?.name || option?.title || "",
                                        ).toLowerCase() ===
                                          String(
                                            item?.name || item?.title || "",
                                          ).toLowerCase()
                                      }
                                      value={selected}
                                      onChange={(_, item) => {
                                        const nextId = item?.id || item?._id || "";
                                        setFieldValue("guestHouse_id", nextId);
                                        setFieldValue("guestHouseRoom_id", "");
                                        loadRooms(nextId);
                                      }}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder="Select Guest House"
                                          error={Boolean(
                                            errors.guestHouse_id &&
                                              touched.guestHouse_id,
                                          )}
                                          sx={autocompleteInputSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name="guestHouse_id"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "guesthouse_room") {
                              const selected =
                                matchByIdOrName(
                                  guestRooms,
                                  values.guestHouseRoom_id,
                                ) ||
                                (values.guestHouseRoom_id
                                  ? {
                                      id: values.guestHouseRoom_id,
                                      title: String(values.guestHouseRoom_id),
                                    }
                                  : null);
                              const options =
                                selected &&
                                !matchByIdOrName(
                                  guestRooms,
                                  selected.id || selected.title,
                                )
                                  ? [selected, ...guestRooms]
                                  : guestRooms;
                              return (
                                <div className="col-md-4" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <Autocomplete
                                      options={options}
                                      getOptionLabel={(option) =>
                                        option?.title || option?.name || ""
                                      }
                                      isOptionEqualToValue={(option, item) =>
                                        String(option?.id || option?._id || "") ===
                                          String(item?.id || item?._id || "") ||
                                        String(
                                          option?.title || option?.name || "",
                                        ).toLowerCase() ===
                                          String(
                                            item?.title || item?.name || "",
                                          ).toLowerCase()
                                      }
                                      value={selected}
                                      onChange={(_, item) =>
                                        setFieldValue(
                                          "guestHouseRoom_id",
                                          item?.id || item?._id || "",
                                        )
                                      }
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder="Select Room"
                                          error={Boolean(
                                            errors.guestHouseRoom_id &&
                                              touched.guestHouseRoom_id,
                                          )}
                                          sx={autocompleteInputSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name="guestHouseRoom_id"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "country") {
                              const selected =
                                (Countries || []).find(
                                  (c) => c.name === values[field.name],
                                ) || null;
                              return (
                                <div className="col-md-4" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <Autocomplete
                                      options={Countries || []}
                                      getOptionLabel={(option) => option?.name || ""}
                                      value={selected}
                                      onChange={(_, item) =>
                                        setFieldValue(field.name, item?.name || "")
                                      }
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder="Select Country"
                                          error={Boolean(
                                            errors[field.name] && touched[field.name],
                                          )}
                                          sx={autocompleteInputSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name={field.name}
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "home_care_type") {
                              const selected =
                                homeCareTypes.find(
                                  (item) =>
                                    homeCareTypeId(item) ===
                                    String(values.home_care_type_id || ""),
                                ) || null;
                              return (
                                <div className="col-md-4" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      <span className="text-danger">*</span>
                                    </label>
                                    <Autocomplete
                                      options={homeCareTypes}
                                      value={selected}
                                      getOptionLabel={(option) =>
                                        option?.home_care_type || ""
                                      }
                                      isOptionEqualToValue={(option, item) =>
                                        homeCareTypeId(option) === homeCareTypeId(item)
                                      }
                                      onChange={(_, item) => {
                                        const id = item ? homeCareTypeId(item) : "";
                                        setFieldValue("home_care_type_id", id);
                                        setFieldValue("home_care_service_id", "");
                                        setHomeCareServices([]);
                                        if (!id) return;
                                        setHomeCareServicesLoading(true);
                                        fetchHomeCareServices(id)
                                          .then((list) => {
                                            const services = Array.isArray(list) ? list : [];
                                            setHomeCareServices(services);
                                            if (services.length === 1) {
                                              setFieldValue(
                                                "home_care_service_id",
                                                homeCareServiceId(services[0]),
                                              );
                                            }
                                          })
                                          .catch(() => setHomeCareServices([]))
                                          .finally(() => setHomeCareServicesLoading(false));
                                      }}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder="Select Home Care Type"
                                          error={Boolean(
                                            errors.home_care_type_id &&
                                              touched.home_care_type_id,
                                          )}
                                          sx={autocompleteInputSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name="home_care_type_id"
                                      component="div"
                                      className="text-danger"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "home_care_service") {
                              const selected =
                                homeCareServices.find(
                                  (item) =>
                                    homeCareServiceId(item) ===
                                    String(values.home_care_service_id || ""),
                                ) || null;
                              return (
                                <div className="col-md-8" key={field.name}>
                                  <div className="set-field">
                                    <label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-danger">*</span>
                                      ) : null}
                                    </label>
                                    <Autocomplete
                                      options={homeCareServices}
                                      value={selected}
                                      loading={homeCareServicesLoading}
                                      disabled={!values.home_care_type_id}
                                      getOptionLabel={(option) =>
                                        homeCareServiceLabel(option)
                                      }
                                      isOptionEqualToValue={(option, item) =>
                                        homeCareServiceId(option) ===
                                        homeCareServiceId(item)
                                      }
                                      onChange={(_, item) =>
                                        setFieldValue(
                                          "home_care_service_id",
                                          item ? homeCareServiceId(item) : "",
                                        )
                                      }
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder={
                                            values.home_care_type_id
                                              ? "Select Home Care Service"
                                              : "Select a home care type first"
                                          }
                                          error={Boolean(
                                            errors.home_care_service_id &&
                                              touched.home_care_service_id,
                                          )}
                                          sx={autocompleteInputSx}
                                        />
                                      )}
                                    />
                                    <ErrorMessage
                                      name="home_care_service_id"
                                      component="div"
                                      className="text-danger"
                                    />
                                    {selected?.home_care_services ? (
                                      <div
                                        className="mt-2"
                                        style={{ fontSize: 13, color: "#374151" }}
                                        dangerouslySetInnerHTML={{
                                          __html: selected.home_care_services,
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "pickup_location") {
                              const prefix = field.locationPrefix;
                              const locationType = values[`${prefix}_location_type`];
                              const idKey = `${prefix}_location_id`;
                              const latKey = `${prefix}_latitude`;
                              const lngKey = `${prefix}_longitude`;

                              if (!locationType) {
                                return (
                                  <FormField
                                    key={field.name}
                                    label={`${field.label} Address / Location`}
                                    name={field.name}
                                    required={field.required}
                                    colClass="col-md-8"
                                  >
                                    <input
                                      className="form-control"
                                      disabled
                                      placeholder="Select location type first"
                                    />
                                  </FormField>
                                );
                              }

                              if (isPickupIdLocationType(locationType)) {
                                const options = pickupOptionsFor(locationType, {
                                  hospitals,
                                  airports,
                                  guestHouses,
                                });
                                const currentId = String(values[idKey] || "");
                                const selected =
                                  options.find(
                                    (item) => getListItemId(item) === currentId,
                                  ) ||
                                  (currentId
                                    ? {
                                        id: currentId,
                                        name: values[field.name] || currentId,
                                      }
                                    : null);
                                return (
                                  <div className="col-md-8" key={field.name}>
                                    <div className="set-field">
                                      <label>
                                        {`${field.label} ${locationType}`}
                                        {field.required ? (
                                          <span className="text-danger">*</span>
                                        ) : null}
                                      </label>
                                      <Autocomplete
                                        options={options}
                                        getOptionLabel={(option) =>
                                          getListItemLabel(option)
                                        }
                                        isOptionEqualToValue={(option, item) =>
                                          getListItemId(option) ===
                                          getListItemId(item)
                                        }
                                        value={selected}
                                        onChange={(_, item) => {
                                          setFieldValue(
                                            idKey,
                                            item ? getListItemId(item) : "",
                                          );
                                          setFieldValue(
                                            field.name,
                                            item
                                              ? pickupOptionAddress(locationType, item)
                                              : "",
                                          );
                                        }}
                                        renderInput={(params) => (
                                          <TextField
                                            {...params}
                                            size="small"
                                            placeholder={`Select ${locationType}`}
                                            error={Boolean(
                                              (errors[idKey] && touched[idKey]) ||
                                                (errors[field.name] &&
                                                  touched[field.name]),
                                            )}
                                            sx={autocompleteInputSx}
                                          />
                                        )}
                                      />
                                      {values[field.name] ? (
                                        <div
                                          className="mt-1"
                                          style={{ fontSize: 12, color: "#64748b" }}
                                        >
                                          {values[field.name]}
                                        </div>
                                      ) : null}
                                      <ErrorMessage
                                        name={idKey}
                                        component="div"
                                        className="text-danger"
                                      />
                                    </div>
                                  </div>
                                );
                              }

                              const findCoordinates = async () => {
                                const address = values[field.name];
                                if (!String(address || "").trim()) {
                                  Swal.fire(
                                    "Address required",
                                    `Enter the ${field.label.toLowerCase()} address first`,
                                    "warning",
                                  );
                                  return;
                                }
                                setGeocodingPrefix(prefix);
                                try {
                                  const result = await geocodeAddress(address);
                                  if (!result) {
                                    Swal.fire(
                                      "Not found",
                                      "Could not find coordinates for this address. Please enter them manually.",
                                      "info",
                                    );
                                    return;
                                  }
                                  setFieldValue(latKey, String(result.latitude));
                                  setFieldValue(lngKey, String(result.longitude));
                                } catch (error) {
                                  Swal.fire(
                                    "Error",
                                    "Coordinate lookup failed. Please enter them manually.",
                                    "error",
                                  );
                                } finally {
                                  setGeocodingPrefix("");
                                }
                              };

                              return (
                                <div className="col-md-8" key={field.name}>
                                  <div className="row gx-3">
                                    <FormField
                                      label={`${field.label} Address`}
                                      name={field.name}
                                      required={field.required}
                                      colClass="col-md-6"
                                    >
                                      <Field
                                        className="form-control"
                                        name={field.name}
                                        placeholder="Enter complete address"
                                      />
                                      <button
                                        type="button"
                                        className="btn btn-link p-0 mt-1"
                                        style={{ fontSize: 12 }}
                                        disabled={geocodingPrefix === prefix}
                                        onClick={findCoordinates}
                                      >
                                        {geocodingPrefix === prefix
                                          ? "Finding coordinates..."
                                          : "Find coordinates from address"}
                                      </button>
                                    </FormField>
                                    <FormField
                                      label="Latitude"
                                      name={latKey}
                                      required
                                      colClass="col-md-3"
                                    >
                                      <Field
                                        className="form-control"
                                        name={latKey}
                                        inputMode="decimal"
                                        placeholder="28.6028006"
                                      />
                                    </FormField>
                                    <FormField
                                      label="Longitude"
                                      name={lngKey}
                                      required
                                      colClass="col-md-3"
                                    >
                                      <Field
                                        className="form-control"
                                        name={lngKey}
                                        inputMode="decimal"
                                        placeholder="77.3711213"
                                      />
                                    </FormField>
                                  </div>
                                </div>
                              );
                            }

                            if (field.type === "select") {
                              const prefix = field.locationPrefix;
                              return (
                                <FormField
                                  key={field.name}
                                  label={field.label}
                                  name={field.name}
                                  required={field.required}
                                >
                                  <Field
                                    as="select"
                                    className="form-control"
                                    name={field.name}
                                    {...(prefix
                                      ? {
                                          onChange: (e) => {
                                            setFieldValue(field.name, e.target.value);
                                            [
                                              "location",
                                              "location_id",
                                              "latitude",
                                              "longitude",
                                            ].forEach((suffix) =>
                                              setFieldValue(`${prefix}_${suffix}`, ""),
                                            );
                                          },
                                        }
                                      : {})}
                                  >
                                    <option value="">Select</option>
                                    {(field.options || []).map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                    {values[field.name] &&
                                      !(field.options || []).includes(
                                        values[field.name],
                                      ) && (
                                        <option value={values[field.name]}>
                                          {values[field.name]}
                                        </option>
                                      )}
                                  </Field>
                                </FormField>
                              );
                            }

                            if (field.type === "textarea") {
                              return (
                                <FormField
                                  key={field.name}
                                  label={field.label}
                                  name={field.name}
                                  required={field.required}
                                  colClass="col-md-8"
                                >
                                  <Field
                                    as="textarea"
                                    className="form-control"
                                    name={field.name}
                                    rows={3}
                                    placeholder="Enter here"
                                  />
                                </FormField>
                              );
                            }

                            return (
                              <FormField
                                key={field.name}
                                label={field.label}
                                name={field.name}
                                required={field.required}
                              >
                                <Field
                                  className="form-control"
                                  type={
                                    field.type === "date" ||
                                    field.type === "time" ||
                                    field.type === "number" ||
                                    field.type === "email"
                                      ? field.type
                                      : "text"
                                  }
                                  name={field.name}
                                  placeholder="Enter here"
                                  min={
                                    field.type === "date"
                                      ? dateFieldMin(field.name, values)
                                      : undefined
                                  }
                                />
                              </FormField>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      {config.termsKey && (!isEdit || config.key === "home-care") ? (
                        <div className="mb-3">
                          <label className="d-flex align-items-center gap-2">
                            <Field type="checkbox" name={config.termsKey} />
                            I agree with the Terms and Conditions
                            <span className="text-danger">*</span>
                          </label>
                          <ErrorMessage
                            name={config.termsKey}
                            component="div"
                            className="text-danger"
                          />
                        </div>
                      ) : null}
                      <NativeSubmitButton
                        type="submit"
                        className="submit-btn"
                        disabled={isSubmitting}
                      >
                        {isEdit ? "Update" : "Submit"}
                      </NativeSubmitButton>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
}
