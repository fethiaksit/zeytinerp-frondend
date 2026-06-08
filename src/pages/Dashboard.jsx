import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import {
  dailyCashApi,
  dashboardApi,
  employeeTransactionsApi,
  employeesApi,
  expensesApi,
  financialAlertsApi,
  financialDebtsApi,
  getErrorMessage,
  incomeApi,
  supplierTransactionsApi,
  suppliersApi,
  bankWallet,
} from "../services/api.js";
import {
  cashTotal,
  categoryLabel,
  dateTR,
  dateTimeTR,
  financialDebtTypeLabel,
  installmentStatusLabel,
  money,
  monthStartISO,
  readFinancialDueDate,
  readFinancialRemaining,
  readInstallmentAmount,
  readInstallmentRemaining,
  todayISO,
} from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptySummary = {
  today_revenue: 0,
  today_expense: 0,
  today_net: 0,
  month_revenue: 0,
  month_expense: 0,
  month_net: 0,
  supplier_debt_total: 0,
  employee_debt_total: 0,
};

export default function Dashboard({ notify }) {
  const [summary, setSummary] = useState(emptySummary);
  const [suppliers, setSuppliers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [financialDebts, setFinancialDebts] = useState([]);
  const [financialInstallments, setFinancialInstallments] = useState([]);
  const [financialAlerts, setFinancialAlerts] = useState({});
  const [bankSummary, setBankSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const startDate = monthStartISO();
        const endDate = todayISO();
        const [
          dashboard,
          cashRows,
          expenseRows,
          incomeRows,
          supplierRows,
          employeeRows,
          supplierTransactions,
          employeeTransactions,
        ] =
          await Promise.all([
            dashboardApi.summary(),
            dailyCashApi.list(),
            expensesApi.list({ start_date: startDate, end_date: endDate }),
            incomeApi.list({ start_date: startDate, end_date: endDate }),
            suppliersApi.listWithBalances(),
            employeesApi.listWithBalances(),
            supplierTransactionsApi.list(),
            employeeTransactionsApi.list(),
          ]);
        const financialDebtRows = await financialDebtsApi.list().catch(() => []);
        const financialInstallmentRows = await loadFinancialInstallments(financialDebtRows);
        const financialAlertRows = await financialAlertsApi.list().catch(() => ({}));
        const bankSummaryData = await bankWallet.summary().catch(() => ({}));

        setSummary(normalizeSummary(dashboard, cashRows, expenseRows, incomeRows, supplierRows, employeeRows));
        setActivities(buildActivities(cashRows, expenseRows, incomeRows, supplierTransactions, employeeTransactions));
        setSuppliers(supplierRows);
        setFinancialDebts(financialDebtRows);
        setFinancialInstallments(financialInstallmentRows);
        setFinancialAlerts(normalizeAlerts(financialAlertRows));
        setBankSummary(bankSummaryData || {});
      } catch (error) {
        notify(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const topDebtors = useMemo(
    () =>
      [...suppliers]
        .sort((a, b) => Number(b.current_debt ?? b.debt ?? b.balance ?? 0) - Number(a.current_debt ?? a.debt ?? a.balance ?? 0))
        .slice(0, 8),
    [suppliers],
  );

  const financialSummary = useMemo(
    () => buildFinancialSummary(financialDebts, financialInstallments, financialAlerts),
    [financialDebts, financialInstallments, financialAlerts],
  );
  const upcomingFinancialInstallments = useMemo(
    () => buildUpcomingFinancialInstallments(financialInstallments),
    [financialInstallments],
  );

  const statCards = [
    ["Bugünkü Ciro", summary.today_revenue],
    ["Bugünkü Gider", summary.today_expense, "danger"],
    ["Bugünkü Kasa", summary.today_net, Number(summary.today_net) >= 0 ? "success" : "danger"],
    ["Bu Ay Ciro", summary.month_revenue],
    ["Bu Ay Gider", summary.month_expense, "danger"],
    ["Bu Ay Net", summary.month_net, Number(summary.month_net) >= 0 ? "success" : "danger"],
    ["Toplam Firma Borcu", summary.supplier_debt_total, "warning"],
    ["Toplam Personel Gideri", summary.employee_debt_total, "warning"],
    ["Toplam Banka Bakiyesi", readBankTotalBalance(bankSummary), "success"],
    { title: "Toplam Finans Borcu", value: money(financialSummary.totalDebt), tone: "warning" },
    { title: "Bu Ay Ödenecek Finans Borcu", value: money(financialSummary.thisMonthDue), tone: "warning" },
    {
      title: "Geciken Finans Borcu Sayısı",
      value: financialSummary.overdueCount,
      tone: financialSummary.overdueCount > 0 ? "danger" : "success",
    },
    { title: "7 Gün İçinde Ödenecek", value: money(financialSummary.sevenDayDue), tone: "warning" },
    { title: "30 Gün İçinde Ödenecek", value: money(financialSummary.thirtyDayDue), tone: "default" },
  ];

  const supplierColumns = [
    { key: "name", header: "Firma" },
    { key: "phone", header: "Telefon" },
    { key: "debt", header: "Borç", align: "right", render: (row) => money(row.current_debt ?? row.debt ?? row.balance) },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <button className="ghost-button" type="button" onClick={() => navigate(`/firmalar/${row.id}`)}>
          Detay
        </button>
      ),
    },
  ];

  const activityColumns = [
    { key: "created_at", header: "Tarih", render: (row) => dateTimeTR(row.created_at || row.report_date || row.expense_date) },
    { key: "title", header: "Hareket", render: (row) => row.title || row.note || row.category || "Kayıt" },
    { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount || row.total || cashTotal(row)) },
  ];

  const upcomingColumns = [
    { key: "institution", header: "Kurum", render: (row) => row.debt?.institution || row.institution || row.organization || row.company || "-" },
    { key: "debt_type", header: "Borç Türü", render: (row) => financialDebtTypeLabel(row.debt?.debt_type || row.debt_type) },
    { key: "title", header: "Başlık", render: (row) => row.debt?.title || row.title || row.debt_title || "-" },
    { key: "installment_no", header: "Taksit No", render: (row) => row.installment_no || "-" },
    { key: "due_date", header: "Vade Tarihi", render: (row) => dateTR(row.due_date) },
    { key: "remaining_amount", header: "Kalan", align: "right", render: (row) => money(readInstallmentRemaining(row)) },
    {
      key: "due_status",
      header: "Durum",
      render: (row) => <span className={`badge ${row.dueTone}`}>{row.dueText || installmentStatusLabel(row.status)}</span>,
    },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <button className="ghost-button" type="button" onClick={() => navigate(`/finans-borclari/${row.financial_debt_id || row.debt_id || row.debt?.id}`)}>
          Detay
        </button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="stat-grid">
        {statCards.map((card) => (
          <StatCard
            key={Array.isArray(card) ? card[0] : card.title}
            title={Array.isArray(card) ? card[0] : card.title}
            value={Array.isArray(card) ? money(card[1]) : card.value}
            tone={(Array.isArray(card) ? card[2] : card.tone) || "default"}
          />
        ))}
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Firmalar</h2>
            </div>
          </div>
          <DataTable columns={supplierColumns} rows={topDebtors} loading={loading} emptyText="Borçlu firma bulunamadı." />
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Son Hareketler</h2>
              <p>Kasa ve gider kayıtlarından son işlemler.</p>
            </div>
          </div>
          <DataTable columns={activityColumns} rows={activities} loading={loading} emptyText="Henüz hareket yok." />
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Yaklaşan Finans Taksitleri</h2>
            <p>Vadesi geçmiş veya 30 gün içinde ödenecek finans taksitleri.</p>
          </div>
        </div>
        <DataTable columns={upcomingColumns} rows={upcomingFinancialInstallments} loading={loading} emptyText="Yaklaşan finans taksiti bulunmuyor." />
      </section>
    </div>
  );
}

function normalizeSummary(dashboard, cashRows, expenseRows, incomeRows, supplierRows, employeeRows) {
  const fallback = buildSummary(cashRows, expenseRows, incomeRows, supplierRows, employeeRows);
  return {
    today_revenue: dashboard.today_revenue ?? dashboard.todayRevenue ?? dashboard.daily_revenue ?? fallback.today_revenue,
    today_expense: dashboard.today_expense ?? dashboard.todayExpense ?? dashboard.daily_expense ?? fallback.today_expense,
    today_net: dashboard.today_net ?? dashboard.todayNet ?? dashboard.daily_net ?? fallback.today_net,
    month_revenue: dashboard.month_revenue ?? dashboard.monthRevenue ?? dashboard.monthly_revenue ?? fallback.month_revenue,
    month_expense: dashboard.month_expense ?? dashboard.monthExpense ?? dashboard.monthly_expense ?? fallback.month_expense,
    month_net: dashboard.month_net ?? dashboard.monthNet ?? dashboard.monthly_net ?? fallback.month_net,
    supplier_debt_total: dashboard.supplier_debt_total ?? dashboard.total_supplier_debt ?? fallback.supplier_debt_total,
    employee_debt_total: dashboard.employee_debt_total ?? dashboard.total_employee_debt ?? fallback.employee_debt_total,
  };
}

function buildSummary(cashRows, expenseRows, incomeRows, supplierRows, employeeRows) {
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const isToday = (value) => String(value || "").slice(0, 10) === today;
  const isMonth = (value) => String(value || "").slice(0, 7) === thisMonth;

  const todayCashRevenue = cashRows.filter((row) => isToday(row.report_date)).reduce((sum, row) => sum + cashTotal(row), 0);
  const monthCashRevenue = cashRows.filter((row) => isMonth(row.report_date)).reduce((sum, row) => sum + cashTotal(row), 0);
  const todayIncome = incomeRows.filter((row) => isToday(row.income_date)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthIncome = incomeRows.filter((row) => isMonth(row.income_date)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const todayExpense = expenseRows.filter((row) => isToday(row.expense_date)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthExpense = expenseRows.filter((row) => isMonth(row.expense_date)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const supplierDebt = supplierRows.reduce((sum, row) => sum + Number(row.current_debt ?? row.debt ?? row.balance ?? 0), 0);
  const employeeDebt = employeeRows.reduce((sum, row) => sum + Number(row.current_debt ?? row.salary_debt ?? row.balance ?? 0), 0);
  const todayRevenue = todayCashRevenue + todayIncome;
  const monthRevenue = monthCashRevenue + monthIncome;

  return {
    today_revenue: todayRevenue,
    today_expense: todayExpense,
    today_net: todayRevenue - todayExpense,
    month_revenue: monthRevenue,
    month_expense: monthExpense,
    month_net: monthRevenue - monthExpense,
    supplier_debt_total: supplierDebt,
    employee_debt_total: employeeDebt,
  };
}

function buildActivities(cashRows, expenseRows, incomeRows, supplierTransactions, employeeTransactions) {
  const cash = cashRows.map((row) => ({
    ...row,
    title: "Günlük kasa kaydı",
    amount: cashTotal(row),
    created_at: row.report_date,
  }));
  const expenses = expenseRows.map((row) => ({
    ...row,
    title: `Gider: ${categoryLabel(row.category)}`,
    created_at: row.expense_date,
  }));
  const incomes = incomeRows.map((row) => ({
    ...row,
    title: `Gelir: ${categoryLabel(row.category)}`,
    created_at: row.income_date,
  }));
  const supplierMoves = supplierTransactions.map((row) => ({
    ...row,
    title: "Firma hareketi",
    created_at: row.transaction_date,
  }));
  const employeeMoves = employeeTransactions.map((row) => ({
    ...row,
    title: "Personel hareketi",
    created_at: row.transaction_date,
  }));
  return [...cash, ...expenses, ...incomes, ...supplierMoves, ...employeeMoves]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);
}

async function loadFinancialInstallments(debts) {
  const groups = await Promise.all(
    debts.map((debt) =>
      financialDebtsApi
        .installments(debt.id)
        .then((rows) => rows.map((row) => ({ ...row, debt, financial_debt_id: row.financial_debt_id || debt.id })))
        .catch(() => []),
    ),
  );
  return groups.flat();
}

function buildFinancialSummary(debts, installments, alerts) {
  const totalDebt = debts
    .filter((row) => row.status !== "closed")
    .reduce((sum, row) => sum + readFinancialRemaining(row), 0);
  const upcoming = buildUpcomingBuckets(installments);

  return {
    totalDebt,
    thisMonthDue: buildThisMonthDue(installments),
    overdueCount: (alerts.overdue || []).length || upcoming.overdue.length,
    sevenDayDue: sumInstallments(alerts.sevenDays?.length ? alerts.sevenDays : upcoming.sevenDays),
    thirtyDayDue: sumInstallments(alerts.thirtyDays?.length ? alerts.thirtyDays : upcoming.thirtyDays),
  };
}

function buildUpcomingFinancialInstallments(rows) {
  const today = startOfToday();
  const thirtyDaysLater = addDays(today, 30);

  return rows
    .filter((row) => row.status !== "paid")
    .map((row) => {
      const due = row.due_date ? new Date(row.due_date) : null;
      if (!due) return null;

      const overdue = due < today;
      const dueSoon = due >= today && due <= thirtyDaysLater;
      if (!overdue && !dueSoon) return null;

      return {
        ...row,
        dueTone: overdue ? "danger" : due <= addDays(today, 7) ? "warning" : "info",
        dueText: overdue ? "Vadesi Geçmiş" : due <= addDays(today, 7) ? "7 Gün İçinde" : "30 Gün İçinde",
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
}

function buildUpcomingBuckets(installments) {
  const today = startOfToday();
  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);
  return installments.reduce(
    (groups, row) => {
      if (row.status === "paid" || !row.due_date) return groups;
      const due = new Date(row.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) groups.overdue.push(row);
      if (due >= today && due <= sevenDays) groups.sevenDays.push(row);
      if (due >= today && due <= thirtyDays) groups.thirtyDays.push(row);
      return groups;
    },
    { overdue: [], sevenDays: [], thirtyDays: [] },
  );
}

function buildThisMonthDue(installments) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return installments
    .filter((row) => row.status !== "paid" && String(row.due_date || "").slice(0, 7) === month)
    .reduce((sum, row) => sum + readInstallmentRemaining(row), 0);
}

function sumInstallments(rows = []) {
  return rows.reduce((sum, row) => sum + (readInstallmentRemaining(row) || readInstallmentAmount(row)), 0);
}

function normalizeAlerts(value) {
  if (Array.isArray(value)) return { overdue: [], sevenDays: [], thirtyDays: [] };
  const source = value || {};
  return {
    overdue: source.overdue || source.overdue_installments || source.past_due || [],
    sevenDays: source.sevenDays || source.due_7_days || source.next_7_days || source.within_7_days || [],
    thirtyDays: source.thirtyDays || source.due_30_days || source.next_30_days || source.within_30_days || [],
  };
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

function readBankTotalBalance(summary) {
  return Number(summary?.total_bank_balance ?? summary?.total_balance ?? summary?.balance ?? 0);
}
