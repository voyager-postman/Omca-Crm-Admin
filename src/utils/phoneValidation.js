import * as Yup from "yup";

export const contactNumberDigitsRegex = (minLen = 8, maxLen = 15) =>
  new RegExp(`^[1-9][0-9]{${minLen - 1},${maxLen - 1}}$`);

export const sanitizeContactNumberInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "");
};

export const contactNumberLengthMessage = (min, max, label = "Contact number") =>
  `${label} must be ${min}-${max} digits and cannot start with 0`;

export const contactNumberYup = ({
  min = 8,
  max = 15,
  required = true,
  label = "Contact number",
} = {}) => {
  const lengthMsg = contactNumberLengthMessage(min, max, label);
  let schema = Yup.string().transform((value) =>
    sanitizeContactNumberInput(value),
  );

  if (required) {
    schema = schema.required(`${label} is required`);
  }

  return schema
    .matches(/^[0-9]+$/, `${label} must contain only digits`)
    .matches(contactNumberDigitsRegex(min, max), lengthMsg);
};

export const optionalContactNumberYup = ({
  min = 8,
  max = 15,
  label = "Contact number",
} = {}) => {
  const lengthMsg = contactNumberLengthMessage(min, max, label);
  const regex = contactNumberDigitsRegex(min, max);

  return Yup.string()
    .transform((value) => sanitizeContactNumberInput(value))
    .test("optional-contact-number", lengthMsg, (value) => {
      if (!value) return true;
      return /^[0-9]+$/.test(value) && regex.test(value);
    });
};

export const staffPhoneYup = (required = true) =>
  contactNumberYup({ min: 6, max: 15, required, label: "Phone number" });

export const hospitalContactYup = (required = true) =>
  contactNumberYup({ min: 10, max: 11, required, label: "Phone number" });

export const handleContactNumberChange = (
  e,
  setFieldValue,
  fieldName,
  onSanitized,
) => {
  const sanitized = sanitizeContactNumberInput(e.target.value);
  setFieldValue(fieldName, sanitized);
  if (onSanitized) onSanitized(sanitized);
};
