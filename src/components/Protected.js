import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Protected({ Component }) {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(
    localStorage.getItem("email") || localStorage.getItem("token")
  );

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  return <Component />;
}
