import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initClientSentry, ErrorBoundary } from "./monitoring/sentry";

// Initialize Sentry for client-side error monitoring
initClientSentry();

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
