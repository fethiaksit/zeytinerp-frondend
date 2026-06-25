import { useEffect, useState } from "react";
import { authApi } from "../services/api.js";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authMessage = sessionStorage.getItem("zeytinerp_auth_message");
    if (authMessage) {
      setError(authMessage);
      sessionStorage.removeItem("zeytinerp_auth_message");
    }

    const token = localStorage.getItem("zeytinerp_token");
    if (token) {
      window.location.href = "/";
    }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authApi.login({
        username: form.username,
        password: form.password,
      });
      const token = result?.token || result?.access_token;

      if (!token) {
        setError("Kullanıcı adı veya şifre hatalı");
        return;
      }

      const user = result?.user || {};
      localStorage.setItem("zeytinerp_token", token);
      localStorage.setItem("zeytinerp_user", JSON.stringify(user));
      console.log("Login saved token:", token);
      window.location.href = "/";
    } catch (apiError) {
      console.log("Login error status:", apiError?.response?.status);
      console.log("Login error data:", apiError?.response?.data);

      if (!apiError?.response) {
        setError("Sunucuya bağlanılamadı");
        return;
      }

      setError("Kullanıcı adı veya şifre hatalı");
    } finally {
      setLoading(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">Z</div>
          <div>
            <h1>ZeytinERP</h1>
            <p>Her Eve Market Yönetim Paneli</p>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            Kullanıcı adı
            <input autoComplete="username" {...field("username")} required />
          </label>
          <label>
            Şifre
            <input type="password" autoComplete="current-password" {...field("password")} required />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </section>
    </main>
  );
}
