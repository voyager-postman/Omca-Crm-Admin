import React, { useState, useRef, useEffect, useMemo } from "react";

// Format dial code to always have a leading "+"
function formatDialCode(code) {
  if (!code) return "";
  const trimmed = String(code).trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed}`;
}

// Comprehensive mapping from country name to ISO 2-letter country code
const COUNTRY_NAME_TO_CODE = {
  afghanistan: "af",
  albania: "al",
  algeria: "dz",
  "american samoa": "as",
  andorra: "ad",
  angola: "ao",
  anguilla: "ai",
  antarctica: "aq",
  "antigua and barbuda": "ag",
  argentina: "ar",
  armenia: "am",
  aruba: "aw",
  australia: "au",
  austria: "at",
  azerbaijan: "az",
  bahamas: "bs",
  bahrain: "bh",
  bangladesh: "bd",
  barbados: "bb",
  belarus: "by",
  belgium: "be",
  belize: "bz",
  benin: "bj",
  bermuda: "bm",
  bhutan: "bt",
  bolivia: "bo",
  "bosnia and herzegovina": "ba",
  botswana: "bw",
  brazil: "br",
  bulgaria: "bg",
  burkina: "bf",
  burundi: "bi",
  cambodia: "kh",
  cameroon: "cm",
  canada: "ca",
  chad: "td",
  chile: "cl",
  china: "cn",
  colombia: "co",
  congo: "cg",
  "costa rica": "cr",
  croatia: "hr",
  cuba: "cu",
  cyprus: "cy",
  "czech republic": "cz",
  czechia: "cz",
  denmark: "dk",
  djibouti: "dj",
  dominica: "dm",
  "dominican republic": "do",
  ecuador: "ec",
  egypt: "eg",
  "el salvador": "sv",
  eritrea: "er",
  estonia: "ee",
  ethiopia: "et",
  fiji: "fj",
  finland: "fi",
  france: "fr",
  gabon: "ga",
  gambia: "gm",
  georgia: "ge",
  germany: "de",
  ghana: "gh",
  greece: "gr",
  grenada: "gd",
  guatemala: "gt",
  guinea: "gn",
  guyana: "gy",
  haiti: "ht",
  honduras: "hn",
  "hong kong": "hk",
  hungary: "hu",
  iceland: "is",
  india: "in",
  indonesia: "id",
  iran: "ir",
  iraq: "iq",
  ireland: "ie",
  israel: "il",
  italy: "it",
  jamaica: "jm",
  japan: "jp",
  jordan: "jo",
  kazakhstan: "kz",
  kenya: "ke",
  kuwait: "kw",
  kyrgyzstan: "kg",
  laos: "la",
  latvia: "lv",
  lebanon: "lb",
  liberia: "lr",
  libya: "ly",
  lithuania: "lt",
  luxembourg: "lu",
  madagascar: "mg",
  malawi: "mw",
  malaysia: "my",
  maldives: "mv",
  mali: "ml",
  malta: "mt",
  mauritania: "mr",
  mauritius: "mu",
  mexico: "mx",
  moldova: "md",
  monaco: "mc",
  mongolia: "mn",
  montenegro: "me",
  morocco: "ma",
  mozambique: "mz",
  myanmar: "mm",
  namibia: "na",
  nepal: "np",
  netherlands: "nl",
  "new zealand": "nz",
  nicaragua: "ni",
  niger: "ne",
  nigeria: "ng",
  norway: "no",
  oman: "om",
  pakistan: "pk",
  palestine: "ps",
  panama: "pa",
  paraguay: "py",
  peru: "pe",
  philippines: "ph",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  romania: "ro",
  russia: "ru",
  rwanda: "rw",
  "saudi arabia": "sa",
  senegal: "sn",
  serbia: "rs",
  seychelles: "sc",
  "sierra leone": "sl",
  singapore: "sg",
  slovakia: "sk",
  slovenia: "si",
  somalia: "so",
  "south africa": "za",
  "south korea": "kr",
  spain: "es",
  "sri lanka": "lk",
  sudan: "sd",
  suriname: "sr",
  sweden: "se",
  switzerland: "ch",
  syria: "sy",
  taiwan: "tw",
  tajikistan: "tj",
  tanzania: "tz",
  thailand: "th",
  togo: "tg",
  tunisia: "tn",
  turkey: "tr",
  turkmenistan: "tm",
  uganda: "ug",
  ukraine: "ua",
  "united arab emirates": "ae",
  uae: "ae",
  "united kingdom": "gb",
  uk: "gb",
  "united states": "us",
  usa: "us",
  uruguay: "uy",
  uzbekistan: "uz",
  venezuela: "ve",
  vietnam: "vn",
  yemen: "ye",
  zambia: "zm",
  zimbabwe: "zw",
};

// Helper to get image URL for country flag
export function getCountryFlagUrl(code, name) {
  let cleanCode = (code || "").trim().toLowerCase();
  if (!cleanCode || cleanCode.length !== 2) {
    cleanCode = (COUNTRY_NAME_TO_CODE[(name || "").toLowerCase()] || "").toLowerCase();
  }
  if (cleanCode && cleanCode.length === 2) {
    return `https://flagcdn.com/w40/${cleanCode}.png`;
  }
  return null;
}

// Flag component with graceful fallback
function CountryFlag({ code, name, width = 20, height = 15, style = {} }) {
  const [hasError, setHasError] = useState(false);
  const flagUrl = getCountryFlagUrl(code, name);

  if (!flagUrl || hasError) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: "#e2e8f0",
          color: "#475569",
          fontSize: "9px",
          fontWeight: 700,
          borderRadius: "2px",
          flexShrink: 0,
          lineHeight: 1,
          ...style,
        }}
      >
        {(code || name || "").slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={name || code || "flag"}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setHasError(true)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        objectFit: "cover",
        borderRadius: "2px",
        boxShadow: "0 0 1px rgba(0,0,0,0.35)",
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}

// Standard fallback countries commonly used in medical tourism & CRM
const FALLBACK_COUNTRIES = [
  { name: "India", code: "IN", dial_code: "+91" },
  { name: "United Arab Emirates", code: "AE", dial_code: "+971" },
  { name: "Oman", code: "OM", dial_code: "+968" },
  { name: "Saudi Arabia", code: "SA", dial_code: "+966" },
  { name: "Bangladesh", code: "BD", dial_code: "+880" },
  { name: "Uzbekistan", code: "UZ", dial_code: "+998" },
  { name: "Kenya", code: "KE", dial_code: "+254" },
  { name: "Nigeria", code: "NG", dial_code: "+234" },
  { name: "Tanzania", code: "TZ", dial_code: "+255" },
  { name: "Uganda", code: "UG", dial_code: "+256" },
  { name: "Ethiopia", code: "ET", dial_code: "+251" },
  { name: "Iraq", code: "IQ", dial_code: "+964" },
  { name: "Kuwait", code: "KW", dial_code: "+965" },
  { name: "Qatar", code: "QA", dial_code: "+974" },
  { name: "Bahrain", code: "BH", dial_code: "+973" },
  { name: "United States", code: "US", dial_code: "+1" },
  { name: "United Kingdom", code: "GB", dial_code: "+44" },
  { name: "Canada", code: "CA", dial_code: "+1" },
  { name: "Australia", code: "AU", dial_code: "+61" },
  { name: "Germany", code: "DE", dial_code: "+49" },
  { name: "France", code: "FR", dial_code: "+33" },
  { name: "Singapore", code: "SG", dial_code: "+65" },
  { name: "Malaysia", code: "MY", dial_code: "+60" },
  { name: "Indonesia", code: "ID", dial_code: "+62" },
  { name: "Nepal", code: "NP", dial_code: "+977" },
  { name: "Sri Lanka", code: "LK", dial_code: "+94" },
  { name: "Afghanistan", code: "AF", dial_code: "+93" },
  { name: "Egypt", code: "EG", dial_code: "+20" },
  { name: "South Africa", code: "ZA", dial_code: "+27" },
];

export default function CountryCodeSelect({
  value,
  onChange,
  countries = [],
  placeholder = "+Code",
  disabled = false,
  error = false,
  variant = "attached",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Combine Redux countries with fallback list and deduplicate
  const countryList = useMemo(() => {
    const map = new Map();

    // 1. Add from Redux countries
    if (Array.isArray(countries)) {
      countries.forEach((c) => {
        if (!c) return;
        const name = (c.name || "").trim();
        const rawCode = c.dial_code || c.phoneCode || "";
        if (!name && !rawCode) return;
        const dial_code = formatDialCode(rawCode);
        const resolvedCode =
          (c.code || COUNTRY_NAME_TO_CODE[name.toLowerCase()] || "").toUpperCase();
        const key = `${name.toLowerCase()}_${dial_code}`;
        if (!map.has(key)) {
          map.set(key, {
            _id: c._id,
            name: name || dial_code,
            code: resolvedCode,
            dial_code,
          });
        }
      });
    }

    // 2. Add fallbacks if not already present
    FALLBACK_COUNTRIES.forEach((c) => {
      const key = `${c.name.toLowerCase()}_${c.dial_code}`;
      if (!map.has(key)) {
        map.set(key, c);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [countries]);

  // Filter list by search query (name or dial code)
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return countryList;
    const cleanDigits = q.replace(/[^0-9]/g, "");
    return countryList.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const codeMatch = c.code.toLowerCase().includes(q);
      const dialMatch = c.dial_code.toLowerCase().includes(q);
      const digitMatch =
        cleanDigits && c.dial_code.replace(/[^0-9]/g, "").includes(cleanDigits);
      return nameMatch || codeMatch || dialMatch || digitMatch;
    });
  }, [countryList, searchQuery]);

  // Clean typed search query as potential custom dial code (e.g. "+123" or "123")
  const customSearchDialCode = useMemo(() => {
    const digits = searchQuery.replace(/[^0-9]/g, "");
    if (digits.length >= 1 && digits.length <= 5) {
      return `+${digits}`;
    }
    return null;
  }, [searchQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayValue = value ? formatDialCode(value) : "";

  // Resolve country object for the currently selected value to display its flag
  const selectedCountryObj = useMemo(() => {
    if (!displayValue) return null;
    return countryList.find((c) => c.dial_code === displayValue) || null;
  }, [displayValue, countryList]);

  const isStandalone = variant === "standalone";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={`form-control code-dial d-flex align-items-center justify-content-between ${
          error ? "is-invalid" : ""
        }`}
        style={{
          width: isStandalone ? "118px" : "95px",
          minWidth: isStandalone ? "118px" : "95px",
          height: isStandalone ? "40px" : "38px",
          cursor: disabled ? "default" : "pointer",
          padding: isStandalone ? "0 10px 0 12px" : "0 6px 0 8px",
          fontSize: "13px",
          fontWeight: 600,
          backgroundColor: disabled
            ? "#f1f5f9"
            : isStandalone
              ? "#ffffff"
              : "#f4f8fb",
          border: error ? "1px solid #dc3545" : "1px solid #ced4da",
          borderRight: isStandalone ? undefined : "0px",
          borderRadius: isStandalone ? "20px" : undefined,
          borderTopRightRadius: isStandalone ? "20px" : "0px",
          borderBottomRightRadius: isStandalone ? "20px" : "0px",
          color: displayValue ? "#1a202c" : "#6c757d",
          outline: "none",
          boxShadow: "none",
          userSelect: "none",
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        title={
          disabled
            ? "Country code is set from Phone No / WhatsApp"
            : "Select Country Code"
        }
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            overflow: "hidden",
          }}
        >
          {selectedCountryObj ? (
            <CountryFlag
              code={selectedCountryObj.code}
              name={selectedCountryObj.name}
              width={18}
              height={13}
            />
          ) : (
            <span style={{ fontSize: "12px", lineHeight: 1 }}>🌐</span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayValue || placeholder}
          </span>
        </div>
        {!disabled && (
          <i
            className={`fa-solid fa-chevron-${isOpen ? "up" : "down"} ms-1`}
            style={{
              fontSize: "10px",
              color: "#6c757d",
              transition: "transform 0.15s ease",
              flexShrink: 0,
            }}
          ></i>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 3px)",
            left: 0,
            width: "300px",
            maxWidth: "92vw",
            maxHeight: "320px",
            backgroundColor: "#ffffff",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
            border: "1px solid #d0d7de",
            borderRadius: "8px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #eef1f4",
              backgroundColor: "#f8fafc",
            }}
          >
            <div style={{ position: "relative" }}>
              <i
                className="fa-solid fa-magnifying-glass"
                style={{
                  position: "absolute",
                  left: "9px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              ></i>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control form-control-sm"
                placeholder="Search country or dial code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  paddingLeft: "28px",
                  fontSize: "12px",
                  height: "32px",
                  borderRadius: "5px",
                }}
              />
              {searchQuery && (
                <i
                  className="fa-solid fa-xmark"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    position: "absolute",
                    right: "9px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "12px",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                ></i>
              )}
            </div>
          </div>

          {/* List of Countries with Real Flags */}
          <div
            style={{
              overflowY: "auto",
              flex: 1,
              maxHeight: "250px",
            }}
          >
            {filteredCountries.length > 0 ? (
              filteredCountries.map((c, idx) => {
                const isSelected = displayValue === c.dial_code;
                return (
                  <div
                    key={c._id || `${c.name}_${c.dial_code}_${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(c.dial_code, c);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      backgroundColor: isSelected ? "#eef6fc" : "transparent",
                      borderBottom: "1px solid #f8f9fa",
                      transition: "background-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "#f4f8fb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        overflow: "hidden",
                        paddingRight: "8px",
                      }}
                    >
                      <CountryFlag
                        code={c.code}
                        name={c.name}
                        width={22}
                        height={16}
                      />
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? "#0fa3dd" : "#212529",
                        }}
                      >
                        {c.name}
                      </span>
                    </div>
                    <span
                      style={{
                        backgroundColor: isSelected ? "#0fa3dd" : "#edf2f7",
                        color: isSelected ? "#ffffff" : "#4a5568",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.dial_code}
                    </span>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: "16px 12px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#6c757d",
                }}
              >
                <p className="mb-2">No matching country found</p>
                {customSearchDialCode && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(customSearchDialCode);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    style={{ fontSize: "11px", padding: "3px 10px" }}
                  >
                    Use &quot;{customSearchDialCode}&quot;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
