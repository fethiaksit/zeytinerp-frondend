import { useEffect } from "react";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("zeytinerp_token");
  console.log("ProtectedRoute token:", token);

  useEffect(() => {
    if (!token && window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [token]);

  if (!token) return null;

  return children;
}
