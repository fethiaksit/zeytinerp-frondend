import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import {
  bankWallet,
  dailyCashApi,
  dashboardApi,
  expensesApi,
  financialDebtsApi,
  getErrorMessage,
  incomeApi,
  suppliersApi,
} from "../services/api.js";
import { cashTotal, categoryLabel, dateTimeTR, money, readFinancialRemaining, todayISO } from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptySummary = {
  today_revenue: 0,
  today_expense: 0,
  today_net: 0,
};

export default function Dashboard({ notify }) {
  const [summary, setSummary] = useState(emptySummary);
  const [walletBalance, setWalletBalance] = useState(0);
  const [supplierDebt, setSupplierDebt] = useState(0);
  const [financialDebt, setFinancialDebt] = useState(0);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashboard, wallet, suppliers, financialDebts, cashRows, expenseRows, incomeRows] = await Promise.all([
          dashboardApi.summary().catch(() => ({})),
          bankWallet.summary().catch(() => ({})),
          suppliersApi.listWithBalances().catch(() => []),
          financialDebtsApi.list().catch(() => []),
          dailyCashApi.list().catch(() => []),
          expensesApi.list().catch(() => []),
          incomeApi.list().catch(() => []),
        ]);

        setSummary(normalizeSummary(dashboard, cashRows, expenseRows, incomeRows));
        setWalletBalance(readWalletBalance(wallet));
        setSupplierDebt(suppliers.reduce((sum, row) => sum + Number(row.current_debt ?? row.debt ?? row.balance ?? 0), 0));
        setFinancialDebt(
          financialDebts
            .filter((row) => row.status !== "closed")
            .reduce((sum, row) => sum + readFinancialRemaining(row), 0),
        );
        setActivities(buildActivities(cashRows, expenseRows, incomeRows));
      } catch (error) {
        notify(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const activityColumns = useMemo(
    () => [
      { key: "created_at", header: "Tarih", render: (row) => dateTimeTR(row.created_at) },
      { key: "title", header: "Hareket" },
      { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount) },
    ],
    [],
  );

  return (
    <div className="page-stack">
      <div className="stat-grid dashboard-essential-grid">
        <button className="stat-card dashboard-wallet-card" type="button" onClick={() => navigate("/cuzdan")}>
          <span>💵 Cüzdan</span>
          <strong>{loading ? "Yükleniyor..." : money(walletBalance)}</strong>
        </button>
        <StatCard title="Bugünkü Ciro" value={money(summary.today_revenue)} />
        <StatCard title="Bugünkü Gider" value={money(summary.today_expense)} tone="danger" />
        <StatCard title="Bugünkü Net" value={money(summary.today_net)} tone={summary.today_net >= 0 ? "success" : "danger"} />
        <StatCard title="Firma Borcu" value={money(supplierDebt)} tone="warning" />
        <StatCard title="Finans Borcu" value={money(financialDebt)} tone="warning" />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Son Hareketler</h2>
          </div>
        </div>
        <DataTable columns={activityColumns} rows={activities} loading={loading} emptyText="Henüz hareket yok." />
      </section>
    </div>
  );
}

function normalizeSummary(dashboard, cashRows, expenseRows, incomeRows) {
  const fallback = buildTodaySummary(cashRows, expenseRows, incomeRows);
  return {
    today_revenue: Number(dashboard.today_revenue ?? dashboard.todayRevenue ?? dashboard.daily_revenue ?? fallback.today_revenue),
    today_expense: Number(dashboard.today_expense ?? dashboard.todayExpense ?? dashboard.daily_expense ?? fallback.today_expense),
    today_net: Number(dashboard.today_net ?? dashboard.todayNet ?? dashboard.daily_net ?? fallback.today_net),
  };
}

function buildTodaySummary(cashRows, expenseRows, incomeRows) {
  const today = todayISO();
  const isToday = (value) => String(value || "").slice(0, 10) === today;
  const todayCashRevenue = cashRows.filter((row) => isToday(row.report_date)).reduce((sum, row) => sum + cashTotal(row), 0);
  const todayIncome = incomeRows.filter((row) => isToday(row.income_date)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const todayExpense = expenseRows.filter((row) => isToday(row.expense_date)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const todayRevenue = todayCashRevenue + todayIncome;

  return {
    today_revenue: todayRevenue,
    today_expense: todayExpense,
    today_net: todayRevenue - todayExpense,
  };
}

function buildActivities(cashRows, expenseRows, incomeRows) {
  const cash = cashRows.map((row) => ({
    title: "Günlük kasa",
    amount: cashTotal(row),
    created_at: row.report_date,
  }));
  const expenses = expenseRows.map((row) => ({
    title: `Gider: ${categoryLabel(row.category)}`,
    amount: Number(row.amount || 0),
    created_at: row.expense_date,
  }));
  const incomes = incomeRows.map((row) => ({
    title: `Gelir: ${categoryLabel(row.category)}`,
    amount: Number(row.amount || 0),
    created_at: row.income_date,
  }));

  return [...cash, ...expenses, ...incomes]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);
}

function readWalletBalance(summary) {
  return Number(summary?.total_bank_balance ?? summary?.total_balance ?? summary?.balance ?? 0);
}
