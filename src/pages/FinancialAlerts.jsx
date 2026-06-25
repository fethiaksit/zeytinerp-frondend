import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import { financialAlertsApi, getErrorMessage } from "../services/api.js";
import {
  dateTR,
  financialDebtTypeLabel,
  money,
  readInstallmentAmount,
  readInstallmentRemaining,
} from "../utils/format.js";

const sections = [
  { key: "overdue", title: "Vadesi Geçenler", tone: "danger", empty: "Vadesi geçen finans taksiti yok." },
  { key: "today", title: "Bugün Ödenecekler", tone: "orange", empty: "Bugün ödenecek finans taksiti yok." },
  { key: "sevenDays", title: "7 Gün İçinde Ödenecekler", tone: "warning", empty: "7 gün içinde ödenecek finans taksiti yok." },
  { key: "thirtyDays", title: "30 Gün İçinde Ödenecekler", tone: "info", empty: "30 gün içinde ödenecek finans taksiti yok." },
];

export default function FinancialAlerts({ notify }) {
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setAlerts(normalizeAlerts(await financialAlertsApi.list()));
      } catch (error) {
        notify(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = useMemo(
    () => [
      { key: "institution", header: "Kurum", render: (row) => row.institution || row.organization || row.company || "-" },
      { key: "debt_type", header: "Borç Türü", render: (row) => financialDebtTypeLabel(row.debt_type) },
      { key: "title", header: "Başlık", render: (row) => row.title || row.debt_title || "-" },
      { key: "installment_no", header: "Taksit No", render: (row) => row.installment_no || "-" },
      { key: "due_date", header: "Vade Tarihi", render: (row) => dateTR(row.due_date) },
      { key: "amount", header: "Tutar", align: "right", render: (row) => money(readInstallmentAmount(row)) },
      { key: "remaining", header: "Kalan", align: "right", render: (row) => money(readInstallmentRemaining(row)) },
    ],
    [],
  );

  return (
    <div className="page-stack">
      {sections.map((section) => (
        <section className="panel" key={section.key}>
          <div className="panel-header">
            <div>
              <h2>{section.title}</h2>
              <p>
                <span className={`badge ${section.tone}`}>{(alerts[section.key] || []).length} kayıt</span>
              </p>
            </div>
          </div>
          <DataTable columns={columns} rows={alerts[section.key] || []} loading={loading} emptyText={section.empty} />
        </section>
      ))}
    </div>
  );
}

function normalizeAlerts(value) {
  if (Array.isArray(value)) return groupAlertsByDueDate(value);

  const source = value || {};
  return {
    overdue: source.overdue || source.overdue_installments || source.past_due || [],
    today: source.today || source.due_today || source.today_due || [],
    sevenDays: source.sevenDays || source.due_7_days || source.next_7_days || source.within_7_days || [],
    thirtyDays: source.thirtyDays || source.due_30_days || source.next_30_days || source.within_30_days || [],
  };
}

function groupAlertsByDueDate(rows) {
  const today = startOfToday();
  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);
  const grouped = { overdue: [], today: [], sevenDays: [], thirtyDays: [] };

  rows.forEach((row) => {
    if (!row.due_date) return;
    const due = new Date(row.due_date);
    due.setHours(0, 0, 0, 0);

    if (due < today) grouped.overdue.push(row);
    else if (due.getTime() === today.getTime()) grouped.today.push(row);
    else if (due <= sevenDays) grouped.sevenDays.push(row);
    else if (due <= thirtyDays) grouped.thirtyDays.push(row);
  });

  return grouped;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
