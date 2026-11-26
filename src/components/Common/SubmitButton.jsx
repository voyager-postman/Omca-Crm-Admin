import React from "react";
import Button from "@mui/material/Button";
import { useSubmitLock } from "../../hooks/useSubmitLock";

/**
 * MUI Button that locks on click until the async onClick finishes.
 * Prevents duplicate API submissions from double-clicks.
 */
export default function SubmitButton({
  onClick,
  children = "Submit",
  busyLabel = "Submitting...",
  disabled = false,
  variant = "contained",
  type = "button",
  className,
  ...rest
}) {
  const { busy, run } = useSubmitLock();

  const handleClick = async (event) => {
    if (disabled || busy) return;
    if (!onClick) return;
    await run(async () => onClick(event));
  };

  return (
    <Button
      type={type}
      variant={variant}
      className={className}
      disabled={disabled || busy}
      onClick={handleClick}
      {...rest}
    >
      {busy ? busyLabel : children}
    </Button>
  );
}

/**
 * Native <button> with the same double-submit lock (for Formik / bootstrap forms).
 */
export function NativeSubmitButton({
  onClick,
  children = "Submit",
  busyLabel = "Submitting...",
  disabled = false,
  type = "submit",
  className = "submit-btn",
  ...rest
}) {
  const { busy, run } = useSubmitLock();

  const handleClick = async (event) => {
    if (disabled || busy) return;
    if (onClick) {
      await run(async () => onClick(event));
    }
  };

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || busy}
      onClick={onClick ? handleClick : undefined}
      {...rest}
    >
      {busy ? busyLabel : children}
    </button>
  );
}
