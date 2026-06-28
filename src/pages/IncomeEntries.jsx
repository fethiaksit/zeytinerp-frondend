import { useEffect, useRef, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { getErrorMessage, incomeApi } from "../services/api.js";
import { categoryLabel, dateTR, money, monthStartISO, todayISO } from "../utils/format.js";

const categories = ["market_satis", "tup_satis", "veresiye_tahsilat", "diger"];
const emptyForm = {
  income_date: todayISO(),
  category: "market_satis",
  amount: "",
  payment_method: "Nakit",
  note: "",
};

export default function IncomeEntries({ notify }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ start_date: monthStartISO(), end_date: todayISO() });
  const appliedFiltersRef = useRef(filters);
  const loadRequestRef = useRef(0);

  const load = async (activeFilters = appliedFiltersRef.current, rememberFilters = false) => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const incomeRows = await incomeApi.list({
        start_date: activeFilters.start_date,
        end_date: activeFilters.end_date,
      });
      if (requestId !== loadRequestRef.current) return;
      setRecords(Array.isArray(incomeRows) ? incomeRows : []);
      if (rememberFilters) appliedFiltersRef.current = activeFilters;
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      notify(getErrorMessage(error));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(appliedFiltersRef.current);
  }, []);

  const totalIncome = records.reduce((total, row) => total + Number(row.amount || 0), 0);

  const listByDateRange = (event) => {
    event.preventDefault();
    const activeFilters = {
      start_date: filters.start_date.trim(),
      end_date: filters.end_date.trim(),
    };

    if (!activeFilters.start_date || !activeFilters.end_date) {
      notify("Başlangıç ve bitiş tarihlerini seçin.");
      return;
    }
    if (activeFilters.start_date > activeFilters.end_date) {
      notify("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }

    load(activeFilters, true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      income_date: String(row.income_date || "").slice(0, 10),
      category: row.category || "diger",
      amount: row.amount || "",
      payment_method: row.payment_method || "Nakit",
      note: row.note || "",
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...form, amount: Number(form.amount || 0) };
      if (editing) {
        await incomeApi.update(editing.id, payload);
        notify("Gelir güncellendi.", "success");
      } else {
        await incomeApi.create(payload);
        notify("Gelir eklendi.", "success");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Gelir kaydı silinsin mi?")) return;
    try {
      await incomeApi.remove(row.id);
      notify("Gelir silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "income_date", header: "Tarih", render: (row) => dateTR(row.income_date) },
    { key: "category", header: "Kategori", render: (row) => categoryLabel(row.category) },
    { key: "payment_method", header: "Ödeme" },
    { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount) },
    { key: "note", header: "Not" },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <div className="row-actions">
          <button className="ghost-button" type="button" onClick={() => openEdit(row)}>
            Düzenle
          </button>
          <button className="danger-button" type="button" onClick={() => remove(row)}>
            Sil
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <StatCard title="Seçilen Aralık Toplam Gelir" value={money(totalIncome)} tone="success" />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Gelirler</h2>
            <p>Market satış dışındaki ek gelirleri takip edin.</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreate}>
            Gelir Ekle
          </button>
        </div>
        <form className="filter-row" onSubmit={listByDateRange}>
          <label>
            Başlangıç
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((current) => ({ ...current, start_date: e.target.value }))}
              required
            />
          </label>
          <label>
            Bitiş
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((current) => ({ ...current, end_date: e.target.value }))}
              required
            />
          </label>
          <button className="primary-button" type="submit">
            Listele
          </button>
        </form>
        <DataTable columns={columns} rows={records} loading={loading} emptyText="Bu aralıkta gelir kaydı yok." />
      </section>
      <Modal title={editing ? "Gelir Düzenle" : "Gelir Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <IncomeForm form={form} setForm={setForm} onSubmit={save} />
      </Modal>
    </div>
  );
}

function IncomeForm({ form, setForm, onSubmit }) {
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Tarih
        <input type="date" {...field("income_date")} required />
      </label>
      <label>
        Kategori
        <select {...field("category")}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tutar
        <input type="number" step="0.01" {...field("amount")} required />
      </label>
      <label>
        Ödeme Yöntemi
        <input {...field("payment_method")} />
      </label>
      <label className="span-2">
        Not
        <textarea {...field("note")} />
      </label>
      <div className="form-actions span-2">
        <button className="primary-button" type="submit">
          Kaydet
        </button>
      </div>
    </form>
  );
}
