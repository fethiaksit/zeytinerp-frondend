import { useEffect, useState } from "react";
import StatCard from "../components/StatCard.jsx";
import { getErrorMessage, reportsApi } from "../services/api.js";
import { money } from "../utils/format.js";

const now = new Date();

export default function Reports({ notify }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const load = async () => {
    setLoading(true);
    try {
      setReport(await reportsApi.monthly(filters));
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="state-box">Rapor yükleniyor...</div>;

  const metric = (keys) => keys.map((key) => report?.[key]).find((value) => value !== undefined) ?? 0;

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Aylık Rapor</h2>
            <p>Gelir, gider, net durum ve toplam borçlar.</p>
          </div>
        </div>
        <div className="filter-row">
          <label>
            Yıl
            <input
              type="number"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}
            />
          </label>
          <label>
            Ay
            <input
              type="number"
              min="1"
              max="12"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}
            />
          </label>
          <button className="secondary-button" type="button" onClick={load}>
            Raporu Getir
          </button>
        </div>
        <div className="stat-grid">
          <StatCard title="Aylık Gelir Toplamı" value={money(metric(["monthly_income", "month_income", "month_revenue", "total_income"]))} />
          <StatCard title="Aylık Gider Toplamı" value={money(metric(["monthly_expense", "month_expense", "total_expense"]))} tone="danger" />
          <StatCard
            title="Aylık Net"
            value={money(metric(["monthly_net", "month_net", "net"]))}
            tone={Number(metric(["monthly_net", "month_net", "net"])) >= 0 ? "success" : "danger"}
          />
          <StatCard title="Firma Borç Toplamı" value={money(metric(["supplier_debt_total", "total_supplier_debt"]))} tone="warning" />
          <StatCard title="Personel Borç Toplamı" value={money(metric(["employee_debt_total", "total_employee_debt"]))} tone="warning" />
        </div>
      </section>
    </div>
  );
}
