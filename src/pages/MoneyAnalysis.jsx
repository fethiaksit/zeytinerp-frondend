import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import { getErrorMessage, moneyAnalysis } from "../services/api.js";
import { money } from "../utils/format.js";

const currentMonth = new Date().toISOString().slice(0, 7);
const emptyAnalysis = {
  income: 0,
  expense: 0,
  expected_balance: 0,
  accounted_total: 0,
  unexplained_difference: 0,
  breakdown: [],
};

export default function MoneyAnalysis({ notify }) {
  const [month, setMonth] = useState(currentMonth);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await moneyAnalysis.get(month);
      setAnalysis({ ...emptyAnalysis, ...(data || {}) });
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      setAnalysis(null);
      notify(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const breakdown = useMemo(() => normalizeBreakdown(analysis?.breakdown), [analysis]);
  const hasData = Boolean(analysis) && (breakdown.length > 0 || analysisValues(analysis).some((value) => value !== 0));
  const difference = Number(analysis?.unexplained_difference || 0);

  const columns = [
    { key: "label", header: "Kalem", render: (row) => row.label || "-" },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      render: (row) => {
        const amount = Number(row.amount || 0);
        const tone = isUnexplained(row) ? differenceTone(amount) : "";
        return <span className={`amount-text ${tone}`}>{money(amount)}</span>;
      },
    },
  ];

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Para Analizi</h2>
            <p>Bu ekran, ay içinde giren ve çıkan paraya göre beklenen kalan tutarın nerede göründüğünü gösterir.</p>
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
            Ay
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button className="secondary-button" type="submit" disabled={loading}>
            Raporu Getir
          </button>
        </form>
      </section>

      {loading ? (
        <div className="state-box">Para analizi yükleniyor...</div>
      ) : error ? (
        <div className="state-box">{error}</div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard title="Bu Ay Gelir" value={money(analysis?.income)} hint="Sisteme giren toplam para." tone="success" />
            <StatCard title="Bu Ay Gider" value={money(analysis?.expense)} hint="Sistemden çıkan toplam para." tone="danger" />
            <StatCard title="Beklenen Kalan" value={money(analysis?.expected_balance)} hint="Gelir - Gider." />
            <StatCard title="Görünen Para" value={money(analysis?.accounted_total)} hint="Kasa, banka, POS, alacaklar ve avanslar." />
            <StatCard
              title="Bulunamayan Tutar"
              value={money(difference)}
              hint="Beklenen kalan ile görünen para arasındaki fark."
              tone={differenceTone(difference)}
            />
          </div>

          {!hasData ? (
            <div className="state-box">Bu ay için analiz yapılacak veri bulunamadı.</div>
          ) : (
            <section className="panel">
              <div className="panel-header">
                <h2>Para Nerede?</h2>
              </div>
              <DataTable columns={columns} rows={breakdown} emptyText="Bu ay için analiz yapılacak veri bulunamadı." />
            </section>
          )}

          <section className="analysis-note">
            <strong>Bulunamayan tutar yüksekse:</strong>
            <ul>
              <li>Eksik gider kaydı olabilir.</li>
              <li>Eksik ödeme kaydı olabilir.</li>
              <li>POS henüz bankaya geçmemiş olabilir.</li>
              <li>Cari veya veresiye kayıtları eksik olabilir.</li>
              <li>Kasadan çıkan para işlenmemiş olabilir.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function analysisValues(analysis) {
  return [
    Number(analysis.income || 0),
    Number(analysis.expense || 0),
    Number(analysis.expected_balance || 0),
    Number(analysis.accounted_total || 0),
    Number(analysis.unexplained_difference || 0),
  ];
}

function normalizeBreakdown(value) {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      ...row,
      key: row.key || row.code || row.type,
      label: row.label || row.name || row.item || row.category,
      amount: row.amount ?? row.value ?? 0,
    }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, amount]) => ({ key, label: breakdownLabel(key), amount }));
  }

  return [];
}

function isUnexplained(row) {
  const label = String(row.label || "").toLocaleLowerCase("tr-TR");
  return row.key === "unexplained_difference" || label.includes("bulunamayan");
}

function differenceTone(value) {
  if (Number(value) > 0) return "danger";
  if (Number(value) < 0) return "warning";
  return "success";
}

function breakdownLabel(key) {
  return (
    {
      cash: "Kasa",
      wallet: "Kasa",
      bank: "Banka",
      bank_balance: "Banka",
      pending_pos: "Bekleyen POS",
      receivables: "Veresiye / Cari Alacaklar",
      accounts_receivable: "Veresiye / Cari Alacaklar",
      employee_advances: "Personel Avansları",
      unexplained_difference: "Bulunamayan Tutar",
    }[key] || key
  );
}
