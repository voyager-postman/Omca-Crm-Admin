/** Local calendar date as YYYY-MM-DD (not UTC). */
export const todayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isOnOrAfterToday = (value) => {
  if (value == null || String(value).trim() === "") return true;
  return String(value).slice(0, 10) >= todayDateInput();
};
