import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { bankAccounts, bankTransactions, bankWallet, getErrorMessage } from "../services/api.js";
import { bankTransactionTypeLabel, dateTR, money, todayISO } from "../utils/format.js";

const emptyAccount = {
  account_name: "",
  bank_name: "",
  iban: "",
  opening_balance: "",
};

const emptyTransaction = {
  transaction_date: todayISO(),
  type: "pos_income",
  amount: "",
  title: "",
  note: "",
};

const transactionTypes = [
  { value: "cash_deposit", effect: "in", description: "Banka bakiyesini artırır" },
  { value: "pos_income", effect: "in", description: "Banka bakiyesini artırır" },
  { value: "bank_income", effect: "in", description: "Banka bakiyesini artırır" },
  { value: "payment", effect: "out", description: "Banka bakiyesini azaltır" },
  { value: "expense", effect: "out", description: "Banka bakiyesini azaltır" },
  { value: "transfer_in", effect: "in", description: "Banka bakiyesini artırır" },
  { value: "transfer_out", effect: "out", description: "Banka bakiyesini azaltır" },
  { value: "correction", effect: "neutral", description: "Pozitif/negatif bakiye düzeltmesi" },
];

export default function BankWallet({ notify }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [dailySummary, setDailySummary] = useState({});
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [transactionForm, setTransactionForm] = useState(emptyTransaction);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((account) => String(readAccountId(account)) === String(selectedAccountId)) || accounts[0] || null,
    [accounts, selectedAccountId],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [accountRows, walletSummary, walletDailySummary] = await Promise.all([
        bankAccounts.list().catch(() => []),
        bankWallet.summary().catch(() => ({})),
        bankWallet.dailySummary(todayISO()).catch(() => ({})),
      ]);
      const normalizedAccounts = asArray(accountRows);
      setAccounts(normalizedAccounts);
      setSummary(walletSummary || {});
      setDailySummary(walletDailySummary || {});
      setSelectedAccountId((currentId) => currentId || readAccountId(normalizedAccounts[0]));
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (accountId) => {
    if (!accountId) {
      setTransactions([]);
      return;
    }

    setTransactionsLoading(true);
    try {
      setTransactions(asArray(await bankTransactions.list(accountId)));
    } catch (error) {
      notify(getErrorMessage(error));
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadTransactions(selectedAccountId);
  }, [selectedAccountId]);

  const saveAccount = async (event) => {
    event.preventDefault();
    setSavingAccount(true);
    try {
      await bankAccounts.create({
        account_name: accountForm.account_name,
        bank_name: accountForm.bank_name,
        iban: accountForm.iban,
        opening_balance: Number(accountForm.opening_balance || 0),
      });
      setAccountForm(emptyAccount);
      notify("Banka hesabı eklendi.", "success");
      await load();
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setSavingAccount(false);
    }
  };

  const requestTransactionConfirmation = (event) => {
    event.preventDefault();
    if (!selectedAccount) {
      notify("Önce banka hesabı seçin.");
      return;
    }
    setConfirmOpen(true);
  };

  const saveTransaction = async () => {
    if (!selectedAccount) return;

    setSavingTransaction(true);
    try {
      await bankTransactions.create(readAccountId(selectedAccount), {
        transaction_date: transactionForm.transaction_date,
        type: transactionForm.type,
        amount: Number(transactionForm.amount || 0),
        title: transactionForm.title,
        note: transactionForm.note,
      });
      setConfirmOpen(false);
      setTransactionForm(emptyTransaction);
      notify("Banka hareketi kaydedildi.", "success");
      await Promise.all([load(), loadTransactions(readAccountId(selectedAccount))]);
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setSavingTransaction(false);
    }
  };

  const removeTransaction = async (transactionId) => {
    if (!transactionId) return;
    try {
      await bankTransactions.remove(transactionId);
      notify("Banka hareketi silindi.", "success");
      await Promise.all([load(), loadTransactions(readAccountId(selectedAccount))]);
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const computedSummary = useMemo(
    () => buildBankSummary(summary, dailySummary, accounts, transactions),
    [summary, dailySummary, accounts, transactions],
  );
  const selectedType = transactionTypes.find((item) => item.value === transactionForm.type) || transactionTypes[0];
  const balanceEffect = describeBalanceEffect(transactionForm.type, transactionForm.amount);

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(readTransactionDate(row)) },
    { key: "type", header: "İşlem Tipi", render: (row) => bankTransactionTypeLabel(row.type) },
    { key: "title", header: "Başlık", render: (row) => row.title || "-" },
    { key: "note", header: "Açıklama", render: (row) => row.note || row.description || "-" },
    {
      key: "in",
      header: "Giriş",
      align: "right",
      render: (row) => (isTransactionIn(row) ? <span className="amount-text success">{money(readTransactionAmount(row))}</span> : "-"),
    },
    {
      key: "out",
      header: "Çıkış",
      align: "right",
      render: (row) => (isTransactionOut(row) ? <span className="amount-text danger">{money(Math.abs(readTransactionAmount(row)))}</span> : "-"),
    },
    { key: "balance_after", header: "İşlem Sonrası Bakiye", align: "right", render: (row) => money(readBalanceAfter(row)) },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <button className="danger-button" type="button" onClick={() => removeTransaction(readTransactionId(row))}>
          Sil
        </button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <StatCard title="Toplam Banka Bakiyesi" value={money(computedSummary.totalBalance)} tone="success" />
        <StatCard title="Bugünkü Para Girişi" value={money(computedSummary.todayIn)} tone="success" />
        <StatCard title="Bugünkü Para Çıkışı" value={money(computedSummary.todayOut)} tone="danger" />
        <StatCard title="Bugünkü Net" value={money(computedSummary.todayNet)} tone={computedSummary.todayNet >= 0 ? "success" : "danger"} />
        <StatCard title="Aktif Hesap Sayısı" value={computedSummary.activeAccountCount} />
      </div>

      <div className="bank-wallet-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Banka Hesapları</h2>
              <p>Hesap seçerek sağ tarafta hareketlerini görüntüleyin.</p>
            </div>
          </div>
          <form className="form-grid bank-account-form" onSubmit={saveAccount}>
            <label>
              Hesap adı
              <input value={accountForm.account_name} onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })} required />
            </label>
            <label>
              Banka adı
              <input value={accountForm.bank_name} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} required />
            </label>
            <label className="span-2">
              IBAN
              <input value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} />
            </label>
            <label>
              Açılış bakiyesi
              <input
                type="number"
                step="0.01"
                value={accountForm.opening_balance}
                onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={savingAccount}>
                {savingAccount ? "Kaydediliyor..." : "Hesap Ekle"}
              </button>
            </div>
          </form>

          <div className="bank-account-list">
            {loading ? (
              <div className="state-box">Hesaplar yükleniyor...</div>
            ) : accounts.length === 0 ? (
              <div className="state-box empty">Henüz banka hesabı yok.</div>
            ) : (
              accounts.map((account) => {
                const accountId = readAccountId(account);
                const active = String(accountId) === String(readAccountId(selectedAccount));
                return (
                  <article className={`bank-account-card ${active ? "active" : ""}`} key={accountId}>
                    <div>
                      <strong>{readAccountName(account)}</strong>
                      <span>{account.bank_name || account.bank || "-"}</span>
                    </div>
                    <p>{account.iban || "IBAN girilmemiş"}</p>
                    <div className="bank-card-footer">
                      <span>{money(readAccountBalance(account))}</span>
                      <button className="secondary-button" type="button" onClick={() => setSelectedAccountId(accountId)}>
                        Detay / Hareketler
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>{selectedAccount ? `${readAccountName(selectedAccount)} Hareketleri` : "Banka Hareketleri"}</h2>
              <p>{selectedAccount ? selectedAccount.iban || selectedAccount.bank_name || "" : "Hareket eklemek için önce hesap oluşturun."}</p>
            </div>
            {selectedAccount && <span className="badge success">{money(readAccountBalance(selectedAccount))}</span>}
          </div>

          <form className="form-grid" onSubmit={requestTransactionConfirmation}>
            <label>
              Tarih
              <input
                type="date"
                value={transactionForm.transaction_date}
                onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                required
              />
            </label>
            <label>
              İşlem tipi
              <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}>
                {transactionTypes.map((type) => (
                  <option value={type.value} key={type.value}>
                    {bankTransactionTypeLabel(type.value)}
                  </option>
                ))}
              </select>
            </label>
            <div className="span-2 form-subtitle">
              <strong>{bankTransactionTypeLabel(transactionForm.type)}</strong>
              <span>{selectedType.description}</span>
            </div>
            <label>
              Tutar
              <input
                type="number"
                step="0.01"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                required
              />
            </label>
            <label>
              Başlık
              <input value={transactionForm.title} onChange={(e) => setTransactionForm({ ...transactionForm, title: e.target.value })} required />
            </label>
            <label className="span-2">
              Açıklama
              <input value={transactionForm.note} onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })} />
            </label>
            <div className="form-actions span-2">
              <button className="primary-button" type="submit" disabled={!selectedAccount || savingTransaction}>
                Hareket Ekle
              </button>
            </div>
          </form>

          <DataTable columns={columns} rows={transactions} loading={transactionsLoading} emptyText="Bu hesap için hareket yok." />
        </section>
      </div>

      <Modal title="İşlemi Onayla" open={confirmOpen} onClose={() => !savingTransaction && setConfirmOpen(false)}>
        <div className="confirm-summary">
          <SummaryRow label="Hesap" value={selectedAccount ? readAccountName(selectedAccount) : "-"} />
          <SummaryRow label="İşlem Tipi" value={bankTransactionTypeLabel(transactionForm.type)} />
          <SummaryRow label="Tarih" value={dateTR(transactionForm.transaction_date)} />
          <SummaryRow label="Tutar" value={money(transactionForm.amount)} />
          <SummaryRow label="Bakiye Etkisi" value={balanceEffect} />
          <SummaryRow label="Açıklama" value={transactionForm.note || "-"} />
        </div>
        <div className="form-actions modal-actions">
          <button className="ghost-button" type="button" disabled={savingTransaction} onClick={() => setConfirmOpen(false)}>
            Vazgeç
          </button>
          <button className="primary-button" type="button" disabled={savingTransaction} onClick={saveTransaction}>
            {savingTransaction ? "İşlem kaydediliyor..." : "Onayla ve Kaydet"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readAccountId(account) {
  return account?.id ?? account?.account_id ?? account?.bank_account_id;
}

function readAccountName(account) {
  return account?.account_name || account?.name || "Banka Hesabı";
}

function readAccountBalance(account) {
  return Number(account?.current_balance ?? account?.balance ?? account?.opening_balance ?? 0);
}

function readTransactionId(transaction) {
  return transaction?.id ?? transaction?.transaction_id ?? transaction?.bank_transaction_id;
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

function isTransactionIn(transaction) {
  return transactionEffect(transaction.type, readTransactionAmount(transaction)) === "in";
}

function isTransactionOut(transaction) {
  return transactionEffect(transaction.type, readTransactionAmount(transaction)) === "out";
}

function describeBalanceEffect(type, amount) {
  const value = money(amount);
  if (transactionEffect(type, amount) === "out") return `Banka bakiyesini azaltır (${value})`;
  return `Banka bakiyesini artırır (${value})`;
}

function buildBankSummary(summary, dailySummary, accounts, transactions) {
  const today = todayISO();
  const todayTransactions = transactions.filter((row) => String(readTransactionDate(row) || "").slice(0, 10) === today);
  const fallbackTodayIn = todayTransactions.filter(isTransactionIn).reduce((sum, row) => sum + Math.abs(readTransactionAmount(row)), 0);
  const fallbackTodayOut = todayTransactions.filter(isTransactionOut).reduce((sum, row) => sum + Math.abs(readTransactionAmount(row)), 0);
  const totalBalanceFallback = accounts.reduce((sum, account) => sum + readAccountBalance(account), 0);
  const todayIn = Number(summary.today_in ?? summary.today_inflow ?? dailySummary.inflow ?? dailySummary.total_in ?? fallbackTodayIn);
  const todayOut = Number(summary.today_out ?? summary.today_outflow ?? dailySummary.outflow ?? dailySummary.total_out ?? fallbackTodayOut);

  return {
    totalBalance: Number(summary.total_bank_balance ?? summary.total_balance ?? summary.balance ?? totalBalanceFallback),
    todayIn,
    todayOut,
    todayNet: Number(summary.today_net ?? dailySummary.net ?? todayIn - todayOut),
    activeAccountCount: Number(summary.active_account_count ?? summary.account_count ?? accounts.length),
  };
}
