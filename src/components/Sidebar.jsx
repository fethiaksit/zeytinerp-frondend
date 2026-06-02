const links = [
  { path: "/", label: "Dashboard", icon: "▣" },
  { path: "/firmalar", label: "Firmalar", icon: "◆" },
  { path: "/personel", label: "Personel", icon: "●" },
  { path: "/gunluk-kasa", label: "Günlük Kasa", icon: "₺" },
  { path: "/finans-borclari", label: "Finans Borçları", icon: "◈" },
  { path: "/finans-uyarilari", label: "Finans Uyarıları", icon: "!" },
  { path: "/giderler", label: "Giderler", icon: "↓" },
  { path: "/gelirler", label: "Gelirler", icon: "↑" },
  { path: "/raporlar", label: "Raporlar", icon: "▤" },
];

function isActive(activePath, linkPath) {
  if (linkPath === "/") return activePath === "/";
  return activePath.startsWith(linkPath);
}

export default function Sidebar({ activePath, open, onClose }) {
  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>Market ERP</strong>
            <span>Yönetim Paneli</span>
          </div>
        </div>
        <nav className="nav-list">
          {links.map((link) => (
            <a
              key={link.path}
              href={link.path}
              className={`nav-item ${isActive(activePath, link.path) ? "active" : ""}`}
              onClick={onClose}
            >
              <span>{link.icon}</span>
              {link.label}
            </a>
          ))}
        </nav>
      </aside>
      {open && <button className="sidebar-backdrop" type="button" aria-label="Menüyü kapat" onClick={onClose} />}
    </>
  );
}
