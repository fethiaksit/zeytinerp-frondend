import { useEffect, useRef, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import {
  bankAccounts,
  bankTransactions,
  dailyCashApi,
  dashboardApi,
  debtSnapshot,
  expensesApi,
  financialDebtsApi,
  getErrorMessage,
  incomeApi,
  moneyAnalysis,
  supplierTransactionsApi,
  wallet,
} from "../services/api.js";
import { cashTotal, categoryLabel, dateTR, financialDebtTypeLabel, money, moneyCurrency, readInstallmentRemaining, todayISO, walletTransactionTypeLabel } from "../utils/format.js";

const emptyData = {
  debt: {},
  analysis: {},
  monthly: {},
  cashBalance: 0,
  bankBalance: 0,
  supplierTransactions: [],
  dueRows: [],
  movements: [],
  dailyExpenses: [],
};

export default function FinanceCenter({ notify }) {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenseDetail, setExpenseDetail] = useState({ date: "", rows: [], loading: false, error: "" });
  const expenseDetailRequestRef = useRef(0);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const month = date.slice(0, 7);
      const [year, monthNumber] = month.split("-").map(Number);
      const startDate = `${month}-01`;
      const endDate = nextMonthStart(year, monthNumber);

      const [debt, analysis, monthly, walletRows, accounts, cashReports, expenses, incomes, debts, supplierTransactions] = await Promise.all([
        debtSnapshot.get(date),
        moneyAnalysis.get(month),
        dashboardApi.monthly({ year, month: monthNumber }),
        wallet.transactions().catch(() => []),
        bankAccounts.list().catch(() => []),
        dailyCashApi.list().catch(() => []),
        expensesApi.list({ start_date: startDate, end_date: endDate }).catch(() => []),
        incomeApi.list({ start_date: startDate, end_date: endDate }).catch(() => []),
        financialDebtsApi.list().catch(() => []),
        supplierTransactionsApi.list().catch(() => []),
      ]);

      const bankTransactionGroups = await Promise.all(
        asArray(accounts).map(async (account) => ({
          account,
          transactions: await bankTransactions.list(readID(account)).catch(() => []),
        })),
      );
      const installmentGroups = await Promise.all(
        asArray(debts).map(async (debtRow) => ({
          debt: debtRow,
          installments: await financialDebtsApi.installments(readID(debtRow)).catch(() => []),
        })),
      );

      setData({
        debt: debt || {},
        analysis: analysis || {},
        monthly: monthly || {},
        cashBalance: walletBalanceAtDate(asArray(walletRows), date),
        bankBalance: bankBalanceAtDate(bankTransactionGroups, date),
        supplierTransactions: asArray(supplierTransactions),
        dueRows: upcomingPaymentRows(installmentGroups, date),
        movements: buildMovements({ cashReports, expenses, incomes, walletRows, date }),
        dailyExpenses: asArray(expenses),
      });
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      setData(emptyData);
      notify(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      expenseDetailRequestRef.current += 1;
    };
  }, []);

  const openExpenseDetail = async (selectedDate) => {
    const requestId = expenseDetailRequestRef.current + 1;
    expenseDetailRequestRef.current = requestId;
    setExpenseDetail({ date: selectedDate, rows: [], loading: true, error: "" });

    try {
      const response = await expensesApi.byDate(selectedDate);
      if (expenseDetailRequestRef.current !== requestId) return;
      setExpenseDetail({ date: selectedDate, rows: expenseRowsOf(response), loading: false, error: "" });
    } catch (requestError) {
      if (expenseDetailRequestRef.current !== requestId) return;
      setExpenseDetail({
        date: selectedDate,
        rows: [],
        loading: false,
        error: `Gider detayları yüklenemedi: ${getErrorMessage(requestError)}`,
      });
    }
  };

  const closeExpenseDetail = () => {
    expenseDetailRequestRef.current += 1;
    setExpenseDetail({ date: "", rows: [], loading: false, error: "" });
  };

  const metrics = financeMetrics(data);
  const debtTotal = metrics.totalDebts;
  const currentMoney = metrics.totalMoney;
  const cashFlow = {
    revenue: metrics.monthlyRevenue,
    collected: metrics.monthlyCollected,
    expense: metrics.monthlyExpense,
    net: metrics.monthlyNetCashflow,
  };
  const netStatus = metrics.netWorth;
  const debtRows = debtDistributionRows(data.debt);
  const currencyDebtTotals = supplierCurrencyTotals(data.supplierTransactions);
  const currencyDebtRows = [
    { label: "Toplam TL Borç", currency: "TRY", original: currencyDebtTotals.TRY, tryAmount: currencyDebtTotals.TRY },
    { label: "Toplam USD Borç", currency: "USD", original: currencyDebtTotals.USD, tryAmount: currencyDebtTotals.USDTRY },
    { label: "Toplam EUR Borç", currency: "EUR", original: currencyDebtTotals.EUR, tryAmount: currencyDebtTotals.EURTRY },
    { label: "Genel TL Karşılığı", currency: "TRY", original: currencyDebtTotals.totalTRY, tryAmount: currencyDebtTotals.totalTRY },
  ];

  const debtColumns = [
    { key: "label", header: "Borç Kalemi" },
    { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount) },
  ];
  const currencyDebtColumns = [
    { key: "label", header: "Toplam" },
    { key: "original", header: "Orijinal Tutar", align: "right", render: (row) => moneyCurrency(row.original, row.currency) },
    { key: "tryAmount", header: "TL Karşılığı", align: "right", render: (row) => money(row.tryAmount) },
  ];
  const dueColumns = [
    { key: "window", header: "Durum", render: (row) => <span className={`badge ${row.tone}`}>{row.window}</span> },
    { key: "institution", header: "Kurum", render: (row) => row.institution || "-" },
    { key: "title", header: "Başlık", render: (row) => row.title || "-" },
    { key: "debt_type", header: "Borç Türü", render: (row) => financialDebtTypeLabel(row.debt_type) },
    { key: "due_date", header: "Vade Tarihi", render: (row) => dateTR(row.due_date) },
    { key: "remaining", header: "Kalan", align: "right", render: (row) => money(row.remaining) },
  ];
  const movementColumns = [
    { key: "date", header: "Tarih", render: (row) => dateTR(row.date) },
    { key: "type", header: "Tür" },
    { key: "description", header: "Açıklama" },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      render: (row) => <span className={`amount-text ${row.effect === "Azaltır" ? "danger" : "success"}`}>{money(Math.abs(row.amount))}</span>,
    },
    { key: "effect", header: "Bakiye Etkisi", render: (row) => <span className={`badge ${row.effect === "Azaltır" ? "danger" : "success"}`}>{row.effect}</span> },
  ];

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Finans Merkezi</h2>
            <p>İşletmenin para, borç ve yaklaşan ödeme durumunu tek ekranda gösterir.</p>
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
        <div className="state-box">Finans merkezi yükleniyor...</div>
      ) : error ? (
        <div className="state-box">{error}</div>
      ) : (
        <>
          <section className="finance-overview-grid">
            <StatCard title="Kasadaki Para" value={money(metrics.cashBalance)} tone="success" />
            <StatCard title="Bankadaki Para" value={money(metrics.bankBalance)} tone="success" />
            <StatCard title="Toplam Para" value={money(currentMoney)} hint="Kasa + banka toplamı." />
            <StatCard title="Firma Borçları" value={money(metrics.supplierDebts)} tone="warning" />
            <StatCard title="Finans Borçları" value={money(metrics.financialDebts)} tone="warning" />
            <StatCard title="Personel Borçları" value={money(metrics.personnelDebts)} tone="warning" />
            <StatCard title="Toplam Borç" value={money(debtTotal)} tone="warning" />
            <StatCard title="Net Varlık" value={money(netStatus)} hint="Toplam para - toplam borç." tone={netStatus >= 0 ? "success" : "danger"} />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Aylık Para Hareketi</h2>
                <p>{date.slice(0, 7)} ayındaki ciro, tahsilat ve gider özeti.</p>
              </div>
            </div>
            <div className="stat-grid">
              <StatCard title="Bu Ay Ciro" value={money(cashFlow.revenue)} hint="Cari ve veresiye satışlar dahil olabilir." tone="success" />
              <StatCard title="Bu Ay Tahsil Edilen Para" value={money(cashFlow.collected)} hint="Kasaya ve bankaya fiilen giren para." tone="success" />
              <StatCard title="Bu Ay Gider" value={money(cashFlow.expense)} tone="danger" />
              <StatCard title="Bu Ay Net Nakit Akışı" value={money(cashFlow.net)} hint="Tahsil edilen para - gider." tone={cashFlow.net >= 0 ? "success" : "danger"} />
            </div>
            <CashFlowChart data={cashFlow} />
            <div className="daily-expense-section">
              <div>
                <h3>Günlük Giderler</h3>
                <p>Detayları görmek için bir güne tıklayın.</p>
              </div>
              <DailyExpenseChart rows={data.dailyExpenses} month={date.slice(0, 7)} onSelectDate={openExpenseDetail} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Borç Dağılımı</h2>
            </div>
            <DataTable columns={debtColumns} rows={debtRows} emptyText="Borç kaydı bulunmuyor." />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Dövizli Firma Borçları</h2>
                <p>Firma hareketlerindeki orijinal tutarlar ve kurla hesaplanan TL karşılıkları.</p>
              </div>
            </div>
            <DataTable columns={currencyDebtColumns} rows={currencyDebtRows} emptyText="Dövizli firma borcu bulunmuyor." />
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Yaklaşan Ödemeler</h2>
            </div>
            <DataTable columns={dueColumns} rows={data.dueRows} emptyText="Yaklaşan ödeme bulunmuyor." />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Detay Hareketler</h2>
                <p>Seçilen güne ait gelir, gider ve cüzdan hareketleri.</p>
              </div>
            </div>
            <DataTable columns={movementColumns} rows={data.movements} emptyText="Bu tarihte hareket bulunmuyor." />
          </section>
        </>
      )}
      <ExpenseDetailModal detail={expenseDetail} onClose={closeExpenseDetail} onRetry={openExpenseDetail} />
    </div>
  );
}

function CashFlowChart({ data }) {
  const values = [
    { label: "Ciro", value: data.revenue, tone: "success" },
    { label: "Tahsilat", value: data.collected, tone: "success" },
    { label: "Gider", value: data.expense, tone: "danger" },
    { label: "Net Nakit", value: data.net, tone: data.net >= 0 ? "success" : "danger" },
  ];
  const max = Math.max(...values.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="cash-flow-chart" aria-label="Aylık nakit akışı grafiği">
      {values.map((item) => (
        <div className="cash-flow-column" key={item.label}>
          <strong>{money(item.value)}</strong>
          <div className="cash-flow-track">
            <div className={`cash-flow-bar ${item.tone}`} style={{ height: `${Math.max(8, (Math.abs(item.value) / max) * 100)}%` }} />
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DailyExpenseChart({ rows, month, onSelectDate }) {
  const days = dailyExpenseRows(rows, month);
  const max = Math.max(...days.map((day) => day.amount), 1);

  return (
    <div className="daily-expense-chart-wrap">
      <div className="daily-expense-chart" style={{ "--day-count": days.length }} aria-label={`${month} günlük gider grafiği`}>
        {days.map((day) => (
          <div className="daily-expense-column" key={day.date}>
            <span className="daily-expense-value">{day.amount > 0 ? compactMoney(day.amount) : "—"}</span>
            <button
              className="daily-expense-track"
              type="button"
              onClick={() => onSelectDate(day.date)}
              aria-label={`${longDateTR(day.date)} giderlerini aç, ${money(day.amount)}`}
              title={`${longDateTR(day.date)}: ${money(day.amount)}`}
            >
              <span className="daily-expense-bar" style={{ height: `${day.amount > 0 ? Math.max(5, (day.amount / max) * 100) : 3}%` }} />
            </button>
            <span className="daily-expense-day">{day.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseDetailModal({ detail, onClose, onRetry }) {
  const total = detail.rows.reduce((sum, row) => sum + expenseAmount(row), 0);

  return (
    <Modal
      title={detail.date ? `${longDateTR(detail.date)} Giderleri` : "Gider Detayları"}
      open={Boolean(detail.date)}
      onClose={onClose}
      cardClassName="expense-detail-modal"
    >
      {detail.loading ? (
        <div className="expense-detail-state" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Giderler yükleniyor...</span>
        </div>
      ) : detail.error ? (
        <div className="expense-detail-state error" role="alert">
          <strong>Gider bilgileri alınamadı.</strong>
          <span>{detail.error}</span>
          <button className="secondary-button" type="button" onClick={() => onRetry(detail.date)}>
            Tekrar Dene
          </button>
        </div>
      ) : detail.rows.length === 0 ? (
        <div className="expense-detail-state empty">O güne ait gider bulunamadı.</div>
      ) : (
        <>
          <ExpenseDetailTable rows={detail.rows} />
          <div className="expense-detail-total">
            <span>Toplam Gider</span>
            <strong>{money(total)}</strong>
          </div>
        </>
      )}
    </Modal>
  );
}

function ExpenseDetailTable({ rows }) {
  return (
    <>
      <div className="expense-detail-table-wrap">
        <table className="expense-detail-table">
          <thead>
            <tr>
              <th>Saat</th>
              <th>Kategori</th>
              <th>Ödeme Türü</th>
              <th className="right">Tutar</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || `${expenseDateTime(row)}-${index}`}>
                <td>{expenseTime(row)}</td>
                <td><CategoryBadge value={row.category ?? row.category_name} /></td>
                <td><PaymentBadge value={row.payment_method ?? row.payment_type} /></td>
                <td className="right amount-text danger">{money(expenseAmount(row))}</td>
                <td className="expense-description">{expenseDescription(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="expense-detail-cards">
        {rows.map((row, index) => (
          <article className="expense-detail-card" key={row.id || `${expenseDateTime(row)}-${index}`}>
            <div className="expense-detail-card-head">
              <CategoryBadge value={row.category ?? row.category_name} />
              <strong>{money(expenseAmount(row))}</strong>
            </div>
            <dl>
              <div><dt>Saat</dt><dd>{expenseTime(row)}</dd></div>
              <div><dt>Ödeme Türü</dt><dd><PaymentBadge value={row.payment_method ?? row.payment_type} /></dd></div>
              <div><dt>Açıklama</dt><dd>{expenseDescription(row)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function CategoryBadge({ value }) {
  const tones = {
    kira: "warning",
    elektrik: "orange",
    su: "info",
    personel: "success",
    yakit: "danger",
    yemek: "orange",
    market_gideri: "success",
    diger: "muted",
  };
  return <span className={`badge ${tones[value] || "info"}`}>{categoryLabel(value)}</span>;
}

function PaymentBadge({ value }) {
  const normalized = String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/[\s/-]+/g, "_");
  const labels = {
    cash: "Nakit",
    nakit: "Nakit",
    bank: "Banka",
    banka: "Banka",
    bank_transfer: "Banka",
    havale_eft: "Havale/EFT",
    credit_card: "Kredi Kartı",
    kredi_kartı: "Kredi Kartı",
    kredi_karti: "Kredi Kartı",
  };
  const tones = {
    cash: "success",
    nakit: "success",
    bank: "info",
    banka: "info",
    bank_transfer: "info",
    havale_eft: "info",
    credit_card: "warning",
    kredi_kartı: "warning",
    kredi_karti: "warning",
  };
  return <span className={`badge ${tones[normalized] || "muted"}`}>{labels[normalized] || value || "-"}</span>;
}

function dailyExpenseRows(rows, month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const totals = asArray(rows).reduce((result, row) => {
    const rowDate = dateValue(row.expense_date || row.date || row.created_at);
    if (rowDate.startsWith(`${month}-`)) {
      result[rowDate] = (result[rowDate] || 0) + expenseAmount(row);
    }
    return result;
  }, {});

  return Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return { date, day, amount: totals[date] || 0 };
  });
}

function expenseRowsOf(response) {
  if (Array.isArray(response)) return response;
  const containers = [response, response?.data];
  for (const container of containers) {
    const rows = container?.expenses ?? container?.items ?? container?.results ?? container?.records;
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function expenseAmount(row) {
  return numberOf(row?.amount ?? row?.expense_amount ?? row?.total_amount);
}

function expenseDateTime(row) {
  return row?.created_at ?? row?.expense_datetime ?? row?.expense_date ?? row?.date ?? "";
}

function expenseTime(row) {
  const explicitTime = String(row?.expense_time ?? row?.time ?? "");
  const explicitMatch = explicitTime.match(/(?:^|T|\s)(\d{2}):(\d{2})/);
  if (explicitMatch) return `${explicitMatch[1]}:${explicitMatch[2]}`;

  const value = expenseDateTime(row);
  if (!/[T\s]\d{2}:\d{2}/.test(String(value))) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const match = String(value).match(/[T\s](\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "-";
  }
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
}

function expenseDescription(row) {
  return row?.note || row?.description || row?.title || "-";
}

function longDateTR(value) {
  const parsed = dayStart(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function compactMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(numberOf(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readID(value) {
  return value?.id ?? value?.account_id ?? value?.bank_account_id;
}

function nextMonthStart(year, month) {
  const next = new Date(year, month, 1);
  return next.toISOString().slice(0, 10);
}

function numberOf(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function dateValue(value) {
  return String(value || "").slice(0, 10);
}

function walletBalanceAtDate(rows, date) {
  return rows
    .filter((row) => dateValue(row.transaction_date || row.date || row.created_at) <= date)
    .reduce((total, row) => total + walletAmount(row), 0);
}

function walletAmount(row) {
  const amount = numberOf(row.amount);
  const type = row.transaction_type || row.type;
  if (["payment", "expense", "cash_withdraw"].includes(type)) return -Math.abs(amount);
  if (type === "correction") return amount;
  return Math.abs(amount);
}

function bankBalanceAtDate(groups, date) {
  return groups.reduce((total, group) => {
    const rows = asArray(group.transactions).filter((row) => dateValue(row.transaction_date || row.date || row.created_at) <= date);
    const hasOpeningTransaction = rows.some((row) => (row.transaction_type || row.type) === "opening_balance");
    const openingBalance = hasOpeningTransaction ? 0 : numberOf(group.account?.opening_balance);
    return total + openingBalance + rows.reduce((sum, row) => sum + bankAmount(row), 0);
  }, 0);
}

function bankAmount(row) {
  const amount = numberOf(row.amount);
  const type = row.transaction_type || row.type;
  if (["payment", "expense", "transfer_out"].includes(type)) return -Math.abs(amount);
  if (type === "correction") return amount;
  return Math.abs(amount);
}

function financeMetrics(data) {
  const { analysis, monthly, debt } = data;
  const cashBalance = numberOf(analysis?.cash_balance ?? monthly?.cash_balance ?? data.cashBalance);
  const bankBalance = numberOf(analysis?.bank_balance ?? monthly?.bank_balance ?? data.bankBalance);
  const totalMoney = numberOf(analysis?.total_money ?? monthly?.total_money, cashBalance + bankBalance);
  const supplierDebts = numberOf(analysis?.supplier_debts ?? debt?.supplier_debts ?? debt?.supplier_debt_total);
  const financialDebts = numberOf(analysis?.financial_debts ?? debt?.financial_debts ?? debt?.financial_debt_total);
  const personnelDebts = numberOf(analysis?.personnel_debts ?? debt?.personnel_debts ?? debt?.employee_debt_total);
  const totalDebts = numberOf(analysis?.total_debts ?? debt?.total_debts ?? debt?.total_debt, supplierDebts + financialDebts + personnelDebts);
  const monthlyRevenue = numberOf(monthly?.monthly_revenue ?? analysis?.monthly_revenue ?? monthly?.month_revenue);
  const monthlyCollected = numberOf(monthly?.monthly_collected ?? analysis?.monthly_collected ?? monthly?.month_collected ?? monthly?.collected);
  const monthlyExpense = numberOf(monthly?.monthly_expense ?? analysis?.monthly_expense ?? monthly?.month_expense);
  const monthlyNetCashflow = numberOf(monthly?.monthly_net_cashflow ?? analysis?.monthly_net_cashflow, monthlyCollected - monthlyExpense);
  const netWorth = numberOf(analysis?.net_worth ?? debt?.net_worth, totalMoney - totalDebts);

  return {
    cashBalance,
    bankBalance,
    totalMoney,
    supplierDebts,
    financialDebts,
    personnelDebts,
    totalDebts,
    netWorth,
    monthlyRevenue,
    monthlyCollected,
    monthlyExpense,
    monthlyNetCashflow,
  };
}

function debtDistributionRows(debt) {
  const supplier = numberOf(debt?.supplier_debts ?? debt?.supplier_debt_total);
  const employee = numberOf(debt?.personnel_debts ?? debt?.employee_debt_total);
  const financial = numberOf(debt?.financial_debts ?? debt?.financial_debt_total);
  const bankLoan = numberOf(debt?.bank_loan_total);
  const creditCard = numberOf(debt?.credit_card_total);
  return [
    { label: "Firma Borçları", amount: supplier },
    { label: "Personel Borçları", amount: employee },
    { label: "Kredi Borçları", amount: bankLoan },
    { label: "Kredi Kartları", amount: creditCard },
    { label: "Diğer Finans Borçları", amount: Math.max(0, financial - bankLoan - creditCard) },
  ];
}

function supplierCurrencyTotals(rows) {
  return asArray(rows).reduce(
    (totals, row) => {
      const type = row.type;
      const effect = type === "invoice" || type === "purchase" ? 1 : type === "payment" || type === "return" ? -1 : 0;
      if (effect === 0) return totals;

      const currency = readTransactionCurrency(row);
      const originalAmount = numberOf(row.amount_original ?? row.original_amount ?? row.amount);
      const exchangeRate = currency === "TRY" ? 1 : numberOf(row.exchange_rate ?? row.rate);
      const tlAmount = numberOf(row.amount_try ?? row.tl_amount ?? row.amount_tl, originalAmount * exchangeRate);

      totals[currency] += effect * originalAmount;
      totals.totalTRY += effect * tlAmount;
      if (currency === "USD") totals.USDTRY += effect * tlAmount;
      if (currency === "EUR") totals.EURTRY += effect * tlAmount;
      return totals;
    },
    { TRY: 0, USD: 0, EUR: 0, USDTRY: 0, EURTRY: 0, totalTRY: 0 },
  );
}

function readTransactionCurrency(row) {
  const currency = String(row?.currency ?? row?.currency_code ?? "TRY").toUpperCase();
  return ["TRY", "USD", "EUR"].includes(currency) ? currency : "TRY";
}

function upcomingPaymentRows(groups, selectedDate) {
  const today = dayStart(selectedDate);
  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);

  return groups
    .flatMap(({ debt, installments }) =>
      asArray(installments).map((installment) => ({
        ...installment,
        institution: debt.institution || debt.institution_name || "-",
        title: debt.title || "-",
        debt_type: debt.debt_type,
        remaining: readInstallmentRemaining(installment),
      })),
    )
    .filter((row) => row.status !== "paid" && row.due_date && numberOf(row.remaining) > 0)
    .map((row) => ({ ...row, ...paymentWindow(row.due_date, today, sevenDays, thirtyDays) }))
    .filter((row) => row.window)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
}

function paymentWindow(dueDate, today, sevenDays, thirtyDays) {
  const due = dayStart(dueDate);
  if (due < today) return { window: "Vadesi Geçmiş", tone: "danger" };
  if (due <= sevenDays) return { window: "7 Gün İçinde", tone: "warning" };
  if (due <= thirtyDays) return { window: "30 Gün İçinde", tone: "info" };
  return {};
}

function buildMovements({ cashReports, expenses, incomes, walletRows, date }) {
  const cashMoves = asArray(cashReports)
    .filter((row) => dateValue(row.report_date) === date)
    .map((row) => ({ date, type: "Günlük Satış", description: row.note || "Günlük kasa kaydı", amount: cashTotal(row), effect: "Artırır" }));
  const expenseMoves = asArray(expenses)
    .filter((row) => dateValue(row.expense_date) === date)
    .map((row) => ({ date, type: "Gider", description: row.note || categoryLabel(row.category), amount: numberOf(row.amount), effect: "Azaltır" }));
  const incomeMoves = asArray(incomes)
    .filter((row) => dateValue(row.income_date) === date)
    .map((row) => ({ date, type: "Gelir", description: row.note || categoryLabel(row.category), amount: numberOf(row.amount), effect: "Artırır" }));
  const walletMoves = asArray(walletRows)
    .filter((row) => dateValue(row.transaction_date || row.date) === date)
    .map((row) => {
      const signedAmount = walletAmount(row);
      return {
        date,
        type: walletTransactionTypeLabel(row.transaction_type || row.type),
        description: row.description || row.title || "Cüzdan hareketi",
        amount: signedAmount,
        effect: signedAmount < 0 ? "Azaltır" : "Artırır",
      };
    });

  return [...cashMoves, ...incomeMoves, ...expenseMoves, ...walletMoves].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function dayStart(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
