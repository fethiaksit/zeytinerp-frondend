import { useEffect, useState } from "react";
import { authApi } from "../services/api.js";
import { getToken, saveAuth } from "../utils/auth.js";
import { navigate } from "../utils/router.js";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) navigate("/");
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

      saveAuth(token, result?.user || {});
      console.log("Login saved token:", token);
      navigate("/");
    } catch (apiError) {
      setError(apiError?.code === "ERR_NETWORK" ? "Sunucuya bağlanılamadı" : "Kullanıcı adı veya şifre hatalı");
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
