import React from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
 
import App from "./App";
import { setupApiAuth } from "./utils/apiAuth";
import { installAuthStoragePatch } from "./utils/authStorage";

installAuthStoragePatch();
setupApiAuth();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
