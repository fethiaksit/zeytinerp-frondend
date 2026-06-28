import { useEffect, useMemo, useRef, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { expensesApi, getErrorMessage } from "../services/api.js";
import { categoryLabel, dateTR, filterByDateRange, money, monthStartISO, todayISO } from "../utils/format.js";

const categories = ["kira", "elektrik", "su", "personel", "yakit", "yemek", "market_gideri", "diger"];
const emptyForm = {
  expense_date: todayISO(),
  category: "market_gideri",
  amount: "",
  payment_method: "Nakit",
  note: "",
};

export default function Expenses({ notify }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ start_date: monthStartISO(), end_date: todayISO() });
  const loadRequestRef = useRef(0);

  const load = async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const expenseRows = await expensesApi.list(filters);
      if (requestId !== loadRequestRef.current) return;
      setRecords(Array.isArray(expenseRows) ? expenseRows : []);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      notify(getErrorMessage(error));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.start_date, filters.end_date]);

  const visibleRows = useMemo(
    () => filterByDateRange(records, "expense_date", filters),
    [records, filters.start_date, filters.end_date],
  );
  const totalExpense = visibleRows.reduce((total, row) => total + Number(row.amount || 0), 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      expense_date: String(row.expense_date || "").slice(0, 10),
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
        await expensesApi.update(editing.id, payload);
        notify("Gider güncellendi.", "success");
      } else {
        await expensesApi.create(payload);
        notify("Gider eklendi.", "success");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Gider kaydı silinsin mi?")) return;
    try {
      await expensesApi.remove(row.id);
      notify("Gider silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "expense_date", header: "Tarih", render: (row) => dateTR(row.expense_date) },
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
        <StatCard title="Seçilen Aralık Toplam Gider" value={money(totalExpense)} tone="danger" />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Giderler</h2>
            <p>Kategori bazlı market giderlerini yönetin.</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreate}>
            Gider Ekle
          </button>
        </div>
        <div className="filter-row">
          <label>
            Başlangıç
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((current) => ({ ...current, start_date: e.target.value }))}
            />
          </label>
          <label>
            Bitiş
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((current) => ({ ...current, end_date: e.target.value }))}
            />
          </label>
        </div>
        <DataTable columns={columns} rows={visibleRows} loading={loading} emptyText="Bu aralıkta gider kaydı yok." />
      </section>
      <Modal title={editing ? "Gider Düzenle" : "Gider Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <ExpenseForm form={form} setForm={setForm} onSubmit={save} />
      </Modal>
    </div>
  );
}

function ExpenseForm({ form, setForm, onSubmit }) {
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Tarih
        <input type="date" {...field("expense_date")} required />
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
