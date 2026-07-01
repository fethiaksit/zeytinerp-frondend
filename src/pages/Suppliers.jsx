import { useEffect, useRef, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { getErrorMessage, suppliersApi } from "../services/api.js";
import { money } from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  note: "",
  is_active: true,
  visit_days: [],
};

const weekDays = [
  { value: "monday", label: "Pazartesi", shortLabel: "Pzt" },
  { value: "tuesday", label: "Salı", shortLabel: "Sal" },
  { value: "wednesday", label: "Çarşamba", shortLabel: "Çar" },
  { value: "thursday", label: "Perşembe", shortLabel: "Per" },
  { value: "friday", label: "Cuma", shortLabel: "Cum" },
  { value: "saturday", label: "Cumartesi", shortLabel: "Cmt" },
  { value: "sunday", label: "Pazar", shortLabel: "Paz" },
];

const dayLabels = new Map(weekDays.map((day) => [day.value, day.label]));

export default function Suppliers({ notify }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [visitFilter, setVisitFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const loadRequest = useRef(0);

  const load = async (filter = visitFilter, searchTerm = search) => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    try {
      const query = searchTerm.trim();
      let rows;

      if (filter === "today") {
        rows = await suppliersApi.todayVisitsWithBalances();
      } else if (filter !== "all") {
        rows = await suppliersApi.visitsWithBalances(filter);
      } else {
        rows = await suppliersApi.listWithBalances(query ? { search: query } : {});
      }

      if (requestId !== loadRequest.current) return;
      setSuppliers(query ? filterSuppliers(rows, query) : rows);
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      const query = searchTerm.trim();
      if (!query || filter !== "all") {
        setSuppliers([]);
        notify(getErrorMessage(error));
        return;
      }

      try {
        const rows = await suppliersApi.listWithBalances();
        if (requestId === loadRequest.current) setSuppliers(filterSuppliers(rows, query));
      } catch (fallbackError) {
        if (requestId !== loadRequest.current) return;
        setSuppliers([]);
        notify(getErrorMessage(fallbackError));
      }
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load(visitFilter, search);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search, visitFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      note: supplier.note || "",
      is_active: supplier.is_active ?? true,
      visit_days: normalizeVisitDays(supplier.visit_days),
    });
    setModalOpen(true);
  };

  const toggleVisitDay = (day) => {
    setForm((current) => ({
      ...current,
      visit_days: current.visit_days.includes(day)
        ? current.visit_days.filter((item) => item !== day)
        : weekDays.map((item) => item.value).filter((item) => item === day || current.visit_days.includes(item)),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, visit_days: normalizeVisitDays(form.visit_days) };
      if (editing) {
        await suppliersApi.update(editing.id, payload);
        notify("Firma güncellendi.", "success");
      } else {
        await suppliersApi.create(payload);
        notify("Firma eklendi.", "success");
      }
      setModalOpen(false);
      await load(visitFilter, search);
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "name", header: "Firma" },
    { key: "phone", header: "Telefon" },
    { key: "address", header: "Adres" },
    {
      key: "visit_days",
      header: "Geliş Günleri",
      render: (row) => <VisitDays days={row.visit_days} />,
    },
    {
      key: "debt",
      header: "Borç",
      align: "right",
      render: (row) => money(row.current_debt ?? row.debt ?? row.balance),
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <span className={`badge ${row.is_active ? "success" : "muted"}`}>{row.is_active ? "Aktif" : "Pasif"}</span>,
    },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <div className="row-actions">
          <button className="ghost-button" type="button" onClick={() => navigate(`/firmalar/${row.id}`)}>
            Detay
          </button>
          <button className="ghost-button" type="button" onClick={() => openEdit(row)}>
            Düzenle
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Firma Listesi</h2>
          <p>Alış yapılan firmaları ve güncel borçlarını yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          Firma Ekle
        </button>
      </div>

      <div className="filter-row">
        <label className="search-field">
          <span>Arama</span>
          <input placeholder="Firma ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="visit-filter-field">
          <span>Geliş günü</span>
          <select value={visitFilter} onChange={(e) => setVisitFilter(e.target.value)}>
            <option value="all">Tüm firmalar</option>
            <option value="today">Bugün Gelecek Firmalar</option>
            {weekDays.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visitFilter === "today" && <div className="visit-filter-note">Bugün gelecek firmalar gösteriliyor.</div>}

      <DataTable columns={columns} rows={suppliers} loading={loading} emptyText={getEmptyText(visitFilter)} />

      <Modal title={editing ? "Firma Düzenle" : "Firma Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label>
            Firma Adı
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="span-2">
            Adres
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="span-2">
            Not
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <fieldset className="visit-days-fieldset span-2">
            <legend>Geliş Günleri</legend>
            <p>Firmanın düzenli olarak geldiği günleri seçin.</p>
            <div className="visit-day-options">
              {weekDays.map((day) => (
                <label key={day.value} className="visit-day-option">
                  <input
                    type="checkbox"
                    checked={form.visit_days.includes(day.value)}
                    onChange={() => toggleVisitDay(day.value)}
                  />
                  <span className="visit-day-long">{day.label}</span>
                  <span className="visit-day-short">{day.shortLabel}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Aktif firma
          </label>
          <div className="form-actions span-2">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function VisitDays({ days }) {
  const normalizedDays = normalizeVisitDays(days);
  if (!normalizedDays.length) return <span className="muted-text">Belirtilmedi</span>;

  return (
    <div className="visit-day-badges">
      {normalizedDays.map((day) => (
        <span className="badge" key={day}>
          {dayLabels.get(day) || day}
        </span>
      ))}
    </div>
  );
}

function normalizeVisitDays(value) {
  let days = value;

  if (typeof days === "string") {
    try {
      days = JSON.parse(days);
    } catch {
      days = days.split(",");
    }
  }

  if (!Array.isArray(days)) return [];

  const selected = new Set(days.map((day) => String(day).trim().toLocaleLowerCase("en-US")));
  return weekDays.map((day) => day.value).filter((day) => selected.has(day));
}

function getEmptyText(filter) {
  if (filter === "today") return "Bugün gelecek firma bulunmuyor.";
  const day = dayLabels.get(filter);
  return day ? `${day} günü gelecek firma bulunmuyor.` : "Henüz firma kaydı yok.";
}

function filterSuppliers(rows, searchTerm) {
  const query = searchTerm.toLocaleLowerCase("tr-TR");
  return rows.filter((row) =>
    [row.name, row.phone, row.address, row.note].some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(query)),
  );
}
