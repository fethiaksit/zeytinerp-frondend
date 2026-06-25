import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import { debtSnapshot, getErrorMessage } from "../services/api.js";
import { financialDebtTypeLabel, money, todayISO } from "../utils/format.js";

const emptyReport = {
  supplier_debt_total: 0,
  employee_debt_total: 0,
  financial_debt_total: 0,
  bank_loan_total: 0,
  credit_card_total: 0,
  total_debt: 0,
  suppliers: [],
  financial_debts: [],
  employees: [],
};

export default function DebtReport({ notify }) {
  const [date, setDate] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await debtSnapshot.get(date);
      setReport({ ...emptyReport, ...(data || {}) });
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      setReport(null);
      notify(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const suppliers = useMemo(() => asArray(report?.suppliers), [report]);
  const financialDebts = useMemo(() => asArray(report?.financial_debts), [report]);
  const employees = useMemo(() => asArray(report?.employees), [report]);
  const hasDebt = Boolean(report) && (Number(report.total_debt || 0) !== 0 || suppliers.length > 0 || financialDebts.length > 0 || employees.length > 0);

  const supplierColumns = [
    { key: "supplier_name", header: "Firma", render: (row) => row.supplier_name || row.name || "-" },
    { key: "debt", header: "Borç", align: "right", render: (row) => money(row.debt) },
  ];
  const financialDebtColumns = [
    { key: "institution", header: "Kurum", render: (row) => row.institution || row.institution_name || "-" },
    { key: "title", header: "Başlık", render: (row) => row.title || "-" },
    { key: "debt_type", header: "Borç Türü", render: (row) => financialDebtTypeLabel(row.debt_type) },
    { key: "remaining_amount", header: "Kalan Borç", align: "right", render: (row) => money(row.remaining_amount) },
  ];
  const employeeColumns = [
    { key: "employee_name", header: "Personel", render: (row) => row.employee_name || row.name || "-" },
    { key: "debt", header: "Borç", align: "right", render: (row) => money(row.debt) },
  ];

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Tarihe Göre Borç Raporu</h2>
          </div>
        </div>
        <form
          className="filter-row"
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
        >
          <label>
            Tarih
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button className="secondary-button" type="submit" disabled={loading}>
            Raporu Getir
          </button>
        </form>
      </section>

      {loading ? (
        <div className="state-box">Rapor yükleniyor...</div>
      ) : error ? (
        <div className="state-box">{error}</div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard title="Firmalara Borç" value={money(report?.supplier_debt_total)} tone="warning" />
            <StatCard title="Personel Borcu" value={money(report?.employee_debt_total)} tone="warning" />
            <StatCard title="Finans Borçları" value={money(report?.financial_debt_total)} tone="warning" />
            <StatCard title="Banka Kredileri" value={money(report?.bank_loan_total)} tone="warning" />
            <StatCard title="Kredi Kartları" value={money(report?.credit_card_total)} tone="warning" />
            <StatCard title="Toplam Borç" value={money(report?.total_debt)} tone="danger" />
          </div>

          {!hasDebt ? (
            <div className="state-box">Bu tarihte borç bulunmuyor.</div>
          ) : (
            <div className="page-stack">
              <section className="panel">
                <div className="panel-header">
                  <h2>Firma Borçları</h2>
                </div>
                <DataTable columns={supplierColumns} rows={suppliers} emptyText="Firma borcu bulunmuyor." />
              </section>
              <section className="panel">
                <div className="panel-header">
                  <h2>Finans Borçları</h2>
                </div>
                <DataTable columns={financialDebtColumns} rows={financialDebts} emptyText="Finans borcu bulunmuyor." />
              </section>
              <section className="panel">
                <div className="panel-header">
                  <h2>Personel Borçları</h2>
                </div>
                <DataTable columns={employeeColumns} rows={employees} emptyText="Personel borcu bulunmuyor." />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
