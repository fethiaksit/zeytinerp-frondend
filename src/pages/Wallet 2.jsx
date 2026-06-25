import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import { bankAccounts, bankTransactions, bankWallet, getErrorMessage } from "../services/api.js";
import { bankTransactionTypeLabel, dateTR, money, todayISO } from "../utils/format.js";

export default function Wallet({ notify }) {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [dailySummary, setDailySummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [accountRows, walletSummary, walletDailySummary] = await Promise.all([
          bankAccounts.list().catch(() => []),
          bankWallet.summary().catch(() => ({})),
          bankWallet.dailySummary(todayISO()).catch(() => ({})),
        ]);
        const normalizedAccounts = asArray(accountRows);
        const transactionRows = await loadAllTransactions(normalizedAccounts);

        setAccounts(normalizedAccounts);
        setTransactions(transactionRows);
        setSummary(walletSummary || {});
        setDailySummary(walletDailySummary || {});
      } catch (error) {
        notify(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const walletSummary = useMemo(
    () => buildWalletSummary(summary, dailySummary, accounts, transactions),
    [summary, dailySummary, accounts, transactions],
  );
  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(readTransactionDate(b)) - new Date(readTransactionDate(a))).slice(0, 20),
    [transactions],
  );

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(readTransactionDate(row)) },
    { key: "type", header: "İşlem Tipi", render: (row) => bankTransactionTypeLabel(row.type) },
    { key: "note", header: "Açıklama", render: (row) => row.note || row.description || row.title || "-" },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      render: (row) => (
        <span className={`amount-text ${isTransactionOut(row) ? "danger" : "success"}`}>
          {money(isTransactionOut(row) ? -Math.abs(readTransactionAmount(row)) : Math.abs(readTransactionAmount(row)))}
        </span>
      ),
    },
    { key: "balance_after", header: "İşlem Sonrası Bakiye", align: "right", render: (row) => money(readBalanceAfter(row)) },
  ];

  return (
    <div className="page-stack">
      <section className="wallet-balance-panel">
        <span>Mevcut Bakiye</span>
        <strong>{money(walletSummary.balance)}</strong>
      </section>

      <div className="stat-grid two">
        <StatCard title="Bugünkü Giriş" value={money(walletSummary.todayIn)} tone="success" />
        <StatCard title="Bugünkü Çıkış" value={money(walletSummary.todayOut)} tone="danger" />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Son Hareketler</h2>
          </div>
        </div>
        <DataTable columns={columns} rows={recentTransactions} loading={loading} emptyText="Henüz cüzdan hareketi yok." />
      </section>
    </div>
  );
}

async function loadAllTransactions(accounts) {
  const results = await Promise.allSettled(accounts.map((account) => bankTransactions.list(readAccountId(account))));
  return results.flatMap((result) => (result.status === "fulfilled" ? asArray(result.value) : []));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readAccountId(account) {
  return account?.id ?? account?.account_id ?? account?.bank_account_id;
}

function readAccountBalance(account) {
  return Number(account?.current_balance ?? account?.balance ?? account?.opening_balance ?? 0);
}

function readTransactionDate(transaction) {
  return transaction?.transaction_date ?? transaction?.date ?? transaction?.created_at;
}

function readTransactionAmount(transaction) {
  return Number(transaction?.amount ?? 0);
}

function readBalanceAfter(transaction) {
  return Number(transaction?.balance_after ?? transaction?.account_balance_after ?? transaction?.current_balance ?? 0);
}

function transactionEffect(type, amount) {
  if (["cash_deposit", "pos_income", "bank_income", "transfer_in"].includes(type)) return "in";
  if (["payment", "expense", "transfer_out"].includes(type)) return "out";
  if (type === "correction") return Number(amount || 0) < 0 ? "out" : "in";
  return "in";
}

function isTransactionOut(transaction) {
  return transactionEffect(transaction.type, readTransactionAmount(transaction)) === "out";
}

function buildWalletSummary(summary, dailySummary, accounts, transactions) {
  const today = todayISO();
  const todayTransactions = transactions.filter((row) => String(readTransactionDate(row) || "").slice(0, 10) === today);
  const fallbackTodayIn = todayTransactions
    .filter((row) => !isTransactionOut(row))
    .reduce((sum, row) => sum + Math.abs(readTransactionAmount(row)), 0);
  const fallbackTodayOut = todayTransactions
    .filter(isTransactionOut)
    .reduce((sum, row) => sum + Math.abs(readTransactionAmount(row)), 0);

  const todayIn = Number(summary.today_in ?? summary.today_inflow ?? dailySummary.inflow ?? dailySummary.total_in ?? fallbackTodayIn);
  const todayOut = Number(summary.today_out ?? summary.today_outflow ?? dailySummary.outflow ?? dailySummary.total_out ?? fallbackTodayOut);

  return {
    balance: Number(
      summary.total_bank_balance ??
        summary.total_balance ??
        summary.balance ??
        accounts.reduce((sum, account) => sum + readAccountBalance(account), 0),
    ),
    todayIn,
    todayOut,
  };
}
