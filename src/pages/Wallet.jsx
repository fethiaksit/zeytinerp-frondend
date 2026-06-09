import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { getErrorMessage, walletApi } from "../services/api.js";
import { dateTR, money, todayISO, walletTransactionTypeLabel } from "../utils/format.js";

const initialForm = {
  transaction_date: todayISO(),
  transaction_type: "cash_income",
  amount: "",
  description: "",
};

const transactionTypes = [
  { value: "opening_balance", label: "Açılış Bakiyesi" },
  { value: "cash_income", label: "Kasaya Para Girişi" },
  { value: "cash_sale", label: "Nakit Satış" },
  { value: "cash_expense", label: "Nakit Gider" },
  { value: "cash_payment", label: "Kasadan Ödeme" },
  { value: "cash_withdraw", label: "Kasadan Çıkış" },
  { value: "cash_deposit", label: "Kasaya Para Yatırma" },
  { value: "correction", label: "Düzeltme" },
];

export default function Wallet({ notify }) {
  const [summary, setSummary] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [walletSummary, transactionRows] = await Promise.all([walletApi.summary(), walletApi.transactions()]);
      setSummary(walletSummary || {});
      setTransactions(asArray(transactionRows));
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(readTransactionDate(b)) - new Date(readTransactionDate(a))).slice(0, 30),
    [transactions],
  );

  const amount = Number(form.amount || 0);
  const effect = transactionEffect(form.transaction_type, amount);

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(readTransactionDate(row)) },
    { key: "transaction_type", header: "İşlem Tipi", render: (row) => walletTransactionTypeLabel(readTransactionType(row)) },
    { key: "description", header: "Açıklama", render: (row) => row.description || row.note || row.title || "-" },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      render: (row) => (
        <span className={`amount-text ${isTransactionOut(row) ? "danger" : "success"}`}>
          {money(signedAmount(row))}
        </span>
      ),
    },
    { key: "balance_after", header: "İşlem Sonrası Bakiye", align: "right", render: (row) => money(readBalanceAfter(row)) },
  ];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.transaction_date || !form.transaction_type || amount === 0) {
      notify("Tarih, işlem tipi ve tutar zorunludur.");
      return;
    }
    setConfirmOpen(true);
  };

  const saveTransaction = async () => {
    setSaving(true);
    try {
      await walletApi.createTransaction({
        transaction_date: form.transaction_date,
        transaction_type: form.transaction_type,
        amount,
        title: walletTransactionTypeLabel(form.transaction_type),
        description: form.description,
      });
      setConfirmOpen(false);
      setForm(initialForm);
      notify("Cüzdan hareketi kaydedildi.", "success");
      await load();
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="wallet-balance-panel">
        <span>Mevcut Bakiye</span>
        <strong>{loading ? "Yükleniyor..." : money(readSummaryValue(summary, "current_balance", "balance", "total_balance"))}</strong>
      </section>

      <div className="stat-grid two">
        <StatCard title="Bugünkü Giriş" value={money(readSummaryValue(summary, "today_income", "today_in", "today_inflow"))} tone="success" />
        <StatCard title="Bugünkü Çıkış" value={money(readSummaryValue(summary, "today_expense", "today_out", "today_outflow"))} tone="danger" />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Cüzdan Hareketi Ekle</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Tarih
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => setForm((current) => ({ ...current, transaction_date: event.target.value }))}
            />
          </label>
          <label>
            İşlem Tipi
            <select
              value={form.transaction_type}
              onChange={(event) => setForm((current) => ({ ...current, transaction_type: event.target.value }))}
            >
              {transactionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tutar
            <input
              type="number"
              min={form.transaction_type === "correction" ? undefined : "0"}
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            />
          </label>
          <label className="span-2">
            Açıklama
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button" type="submit" disabled={saving}>
              Kaydet
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Son Hareketler</h2>
          </div>
        </div>
        <DataTable columns={columns} rows={recentTransactions} loading={loading} emptyText="Henüz cüzdan hareketi yok." />
      </section>

      <Modal title="İşlemi Onayla" open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
        <div className="confirm-summary">
          <div className="state-box compact">
            Bu işlem cüzdan bakiyesini {effect === "out" ? "azaltacak" : "artıracak"}. Onaylıyor musunuz?
          </div>
          <div className="summary-row">
            <span>İşlem Tipi</span>
            <strong>{walletTransactionTypeLabel(form.transaction_type)}</strong>
          </div>
          <div className="summary-row">
            <span>Tarih</span>
            <strong>{dateTR(form.transaction_date)}</strong>
          </div>
          <div className="summary-row">
            <span>Tutar</span>
            <strong>{money(amount)}</strong>
          </div>
          <div className="summary-row">
            <span>Açıklama</span>
            <strong>{form.description || "-"}</strong>
          </div>
        </div>
        <div className="modal-actions form-actions">
          <button className="ghost-button" type="button" disabled={saving} onClick={() => setConfirmOpen(false)}>
            Vazgeç
          </button>
          <button className="primary-button" type="button" disabled={saving} onClick={saveTransaction}>
            {saving ? "Kaydediliyor..." : "Onayla ve Kaydet"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readSummaryValue(summary, ...keys) {
  const key = keys.find((item) => summary?.[item] !== undefined && summary?.[item] !== null);
  return Number(key ? summary[key] : 0);
}

function readTransactionDate(transaction) {
  return transaction?.transaction_date ?? transaction?.date ?? transaction?.created_at;
}

function readTransactionType(transaction) {
  return transaction?.transaction_type ?? transaction?.type;
}

function readTransactionAmount(transaction) {
  return Number(transaction?.amount ?? 0);
}

function readBalanceAfter(transaction) {
  return Number(transaction?.balance_after ?? transaction?.current_balance ?? 0);
}

function transactionEffect(type, amount) {
  if (["cash_expense", "cash_payment", "cash_withdraw"].includes(type)) return "out";
  if (type === "correction") return Number(amount || 0) < 0 ? "out" : "in";
  return "in";
}

function isTransactionOut(transaction) {
  return transactionEffect(readTransactionType(transaction), readTransactionAmount(transaction)) === "out";
}

function signedAmount(transaction) {
  const amount = Math.abs(readTransactionAmount(transaction));
  return isTransactionOut(transaction) ? -amount : amount;
}
