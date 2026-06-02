import { useEffect } from "react";
import { getToken } from "../utils/auth.js";
import { navigate } from "../utils/router.js";

export default function ProtectedRoute({ children, fallback = null }) {
  const token = getToken();

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token]);

  if (!token) return fallback;

  return children;
}
