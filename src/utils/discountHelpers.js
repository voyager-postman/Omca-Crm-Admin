export const hasAmountValue = (value) =>
  value !== "" &&
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

export const roundChargeValue = (value) =>
  String(Math.round(Number(value) * 100) / 100);

export const calculateFinalAmount = (baseAmount, discountPercentage) => {
  if (
    !hasAmountValue(baseAmount) ||
    !hasAmountValue(discountPercentage) ||
    Number(discountPercentage) > 100
  ) {
    return "";
  }

  return roundChargeValue(
    Number(baseAmount) -
      (Number(baseAmount) * Number(discountPercentage)) / 100,
  );
};

export const calculateDiscountPercentage = (baseAmount, finalAmount) => {
  if (!hasAmountValue(baseAmount) || !hasAmountValue(finalAmount)) {
    return "";
  }

  const base = Number(baseAmount);
  if (base === 0) return Number(finalAmount) === 0 ? "0" : "";

  return roundChargeValue(
    ((base - Number(finalAmount)) / base) * 100,
  );
};

export const getDiscountValidationError = (
  baseAmount,
  discountPercentage,
  finalAmount,
) => {
  if (
    discountPercentage !== "" &&
    discountPercentage !== null &&
    discountPercentage !== undefined
  ) {
    const discount = Number(discountPercentage);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      return "Discount must be between 0 and 100";
    }
  }

  if (
    finalAmount !== "" &&
    finalAmount !== null &&
    finalAmount !== undefined
  ) {
    if (!hasAmountValue(finalAmount)) {
      return "Please enter a valid final amount";
    }
    if (
      hasAmountValue(baseAmount) &&
      Number(finalAmount) > Number(baseAmount)
    ) {
      return "Final amount cannot be greater than the base amount";
    }
  }

  return "";
};

export const getDiscountedValue = (item, baseField, finalField) => {
  if (hasAmountValue(item?.[finalField])) return item[finalField];
  return item?.[baseField];
};
