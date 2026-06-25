import { useState } from "react";
import Sidebar from "./Sidebar.jsx";

export default function Layout({ activePath, title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar activePath={activePath} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="content-shell">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Menüyü aç">
            ☰
          </button>
          <div>
            <p className="eyebrow">Market ERP Admin</p>
            <h1>{title}</h1>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
