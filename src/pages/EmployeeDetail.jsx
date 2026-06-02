import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import { employeeTransactionsApi, employeesApi, getErrorMessage } from "../services/api.js";
import { dateTR, employeeTransactionLabel, money, todayISO } from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyTransaction = {
  transaction_date: todayISO(),
  type: "work",
  work_days: "",
  amount: "",
  note: "",
};

export default function EmployeeDetail({ params, notify }) {
  const [employee, setEmployee] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyTransaction);

  const load = async () => {
    setLoading(true);
    try {
      const [employeeData, balanceData, transactionData] = await Promise.all([
        employeesApi.get(params.id),
        employeesApi.balance(params.id),
        employeeTransactionsApi.list({ employee_id: params.id }),
      ]);
      setEmployee({ ...employeeData, current_debt: balanceData?.balance ?? balanceData?.current_debt ?? balanceData?.salary_debt ?? balanceData });
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
      await employeeTransactionsApi.create({
        ...form,
        employee_id: Number(params.id),
        work_days: Number(form.work_days || 0),
        amount: Number(form.amount || 0),
      });
      setForm(emptyTransaction);
      notify("Personel hareketi eklendi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const removeTransaction = async (row) => {
    if (!window.confirm("Personel hareketi silinsin mi?")) return;
    try {
      await employeeTransactionsApi.remove(row.id);
      notify("Personel hareketi silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(row.transaction_date) },
    { key: "type", header: "Tip", render: (row) => employeeTransactionLabel(row.type) },
    { key: "work_days", header: "Gün", align: "right", render: (row) => row.work_days || "-" },
    { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount) },
    { key: "note", header: "Not" },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <button className="danger-button" type="button" onClick={() => removeTransaction(row)}>
          Sil
        </button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <button className="ghost-button fit" type="button" onClick={() => navigate("/personel")}>
        ← Personel Listesine Dön
      </button>
      <div className="stat-grid two">
        <StatCard title="Personel" value={employee?.name || "Yükleniyor"} hint={employee?.phone || ""} />
        <StatCard title="Kalan Maaş Borcu" value={money(employee?.current_debt ?? employee?.salary_debt ?? employee?.balance)} tone="warning" />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Personel Bilgileri</h2>
            <p>Günlük ücret: {money(employee?.daily_wage)}</p>
          </div>
          <span className={`badge ${employee?.is_active ? "success" : "muted"}`}>{employee?.is_active ? "Aktif" : "Pasif"}</span>
        </div>
        <p className="note-text">{employee?.note || "Not bulunmuyor."}</p>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Hareket Ekle</h2>
            <p>Çalışma, maaş ödemesi veya avans girin.</p>
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
              <option value="work">Çalışma</option>
              <option value="payment">Maaş Ödemesi</option>
              <option value="advance">Avans</option>
            </select>
          </label>
          <label>
            Çalışılan Gün
            <input type="number" step="0.5" value={form.work_days} onChange={(e) => setForm({ ...form, work_days: e.target.value })} />
          </label>
          <label>
            Tutar
            <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
        <DataTable columns={columns} rows={transactions} loading={loading} emptyText="Bu personel için hareket yok." />
      </section>
    </div>
  );
}
