import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import { getErrorMessage, supplierTransactionsApi, suppliersApi } from "../services/api.js";
import { dateTR, money, supplierTransactionLabel, todayISO } from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyTransaction = {
  transaction_date: todayISO(),
  type: "purchase",
  amount: "",
  payment_method: "Nakit",
  note: "",
};

export default function SupplierDetail({ params, notify }) {
  const [supplier, setSupplier] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyTransaction);

  const load = async () => {
    setLoading(true);
    try {
      const [supplierData, balanceData, transactionData] = await Promise.all([
        suppliersApi.get(params.id),
        suppliersApi.balance(params.id),
        supplierTransactionsApi.list({ supplier_id: params.id }),
      ]);
      setSupplier({ ...supplierData, current_debt: balanceData?.balance ?? balanceData?.current_debt ?? balanceData?.debt ?? balanceData });
      setTransactions(transactionData);
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const saveTransaction = async (event) => {
    event.preventDefault();
    try {
      await supplierTransactionsApi.create({ ...form, supplier_id: Number(params.id), amount: Number(form.amount) });
      setForm(emptyTransaction);
      notify("Firma hareketi eklendi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(row.transaction_date) },
    { key: "type", header: "Tip", render: (row) => supplierTransactionLabel(row.type) },
    { key: "payment_method", header: "Ödeme" },
    { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount) },
    { key: "note", header: "Not" },
  ];

  return (
    <div className="page-stack">
      <button className="ghost-button fit" type="button" onClick={() => navigate("/firmalar")}>
        ← Firmalara Dön
      </button>
      <div className="stat-grid two">
        <StatCard title="Firma" value={supplier?.name || "Yükleniyor"} hint={supplier?.phone || ""} />
        <StatCard title="Güncel Borç" value={money(supplier?.current_debt ?? supplier?.debt ?? supplier?.balance)} tone="warning" />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Firma Bilgileri</h2>
            <p>{supplier?.address || "Adres girilmemiş"}</p>
          </div>
          <span className={`badge ${supplier?.is_active ? "success" : "muted"}`}>{supplier?.is_active ? "Aktif" : "Pasif"}</span>
        </div>
        <p className="note-text">{supplier?.note || "Not bulunmuyor."}</p>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Hareket Ekle</h2>
            <p>Alış veya ödeme hareketi girin.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={saveTransaction}>
          <label>
            Tarih
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              required
            />
          </label>
          <label>
            Tip
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="purchase">Alış / Borç</option>
              <option value="payment">Ödeme</option>
            </select>
          </label>
          <label>
            Tutar
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </label>
          <label>
            Ödeme Yöntemi
            <input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} />
          </label>
          <label className="span-2">
            Not
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button" type="submit">
              Hareket Ekle
            </button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>Hareket Listesi</h2>
        </div>
        <DataTable columns={columns} rows={transactions} loading={loading} emptyText="Bu firma için hareket yok." />
      </section>
    </div>
  );
}
