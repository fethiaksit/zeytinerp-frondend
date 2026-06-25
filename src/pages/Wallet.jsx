import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { getErrorMessage, wallet } from "../services/api.js";
import { dateTR, money, todayISO, walletTransactionTypeLabel } from "../utils/format.js";

const initialForm = {
  transaction_date: todayISO(),
  transaction_type: "cash_income",
  amount: "",
  title: "",
  description: "",
};

const transactionTypes = [
  { value: "opening_balance", label: "Açılış Bakiyesi" },
  { value: "cash_income", label: "Nakit Gelir" },
  { value: "cash_sale", label: "Nakit Satış" },
  { value: "pos_income", label: "POS Yatışı" },
  { value: "bank_income", label: "Banka Geliri" },
  { value: "payment", label: "Ödeme" },
  { value: "expense", label: "Gider" },
  { value: "cash_withdraw", label: "Para Çekme" },
  { value: "cash_deposit", label: "Para Yatırma" },
  { value: "correction", label: "Düzeltme" },
];

export default function Wallet({ notify }) {
  const [summary, setSummary] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [walletSummary, transactionRows] = await Promise.all([wallet.summary(), wallet.transactions()]);
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

  const amount = Number(form.amount || 0);
  const effect = transactionEffect(form.transaction_type, amount);
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(readTransactionDate(b)) - new Date(readTransactionDate(a)) || readID(b) - readID(a)),
    [transactions],
  );

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(readTransactionDate(row)) },
    { key: "transaction_type", header: "İşlem Tipi", render: (row) => walletTransactionTypeLabel(readTransactionType(row)) },
    { key: "title", header: "Başlık", render: (row) => row.title || "-" },
    { key: "description", header: "Açıklama", render: (row) => row.description || row.note || "-" },
    {
      key: "in",
      header: "Giriş",
      align: "right",
      render: (row) =>
        isTransactionOut(row) ? "-" : <span className="amount-text success">{money(Math.abs(readTransactionAmount(row)))}</span>,
    },
    {
      key: "out",
      header: "Çıkış",
      align: "right",
      render: (row) =>
        isTransactionOut(row) ? <span className="amount-text danger">{money(Math.abs(readTransactionAmount(row)))}</span> : "-",
    },
    { key: "balance_after", header: "İşlem Sonrası Bakiye", align: "right", render: (row) => money(readBalanceAfter(row)) },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <button className="danger-button" type="button" disabled={deletingId === readID(row)} onClick={() => deleteTransaction(row)}>
          {deletingId === readID(row) ? "Siliniyor..." : "Sil"}
        </button>
      ),
    },
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
      await wallet.createTransaction({
        transaction_date: form.transaction_date,
        transaction_type: form.transaction_type,
        amount,
        title: form.title || walletTransactionTypeLabel(form.transaction_type),
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

  const deleteTransaction = async (row) => {
    const id = readID(row);
    if (!id || !window.confirm("Bu cüzdan hareketi silinsin mi? Bakiye yeniden hesaplanacak.")) return;

    setDeletingId(id);
    try {
      await wallet.deleteTransaction(id);
      notify("Cüzdan hareketi silindi.", "success");
      await load();
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-stack">
      <section className="wallet-balance-panel">
        <span>Mevcut Bakiye</span>
        <strong>{loading ? "Yükleniyor..." : money(readSummaryValue(summary, "current_balance", "balance", "total_balance"))}</strong>
      </section>

      <div className="stat-grid">
        <StatCard title="Bugünkü Giriş" value={money(readSummaryValue(summary, "today_income", "today_in", "today_inflow"))} tone="success" />
        <StatCard title="Bugünkü Çıkış" value={money(readSummaryValue(summary, "today_expense", "today_out", "today_outflow"))} tone="danger" />
        <StatCard
          title="Bugünkü Net"
          value={money(readSummaryValue(summary, "today_net"))}
          tone={readSummaryValue(summary, "today_net") >= 0 ? "success" : "danger"}
        />
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
          <label>
            Başlık
            <input
              value={form.title}
              placeholder={walletTransactionTypeLabel(form.transaction_type)}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
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
            <h2>Cüzdan Hareketleri</h2>
          </div>
        </div>
        <DataTable columns={columns} rows={sortedTransactions} loading={loading} emptyText="Henüz cüzdan hareketi yok." />
      </section>

      <Modal title="İşlemi Onayla" open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
        <div className="confirm-summary">
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
            <span>Bakiye Etkisi</span>
            <strong>{effect === "out" ? "Azaltır" : "Artırır"}</strong>
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

function readID(row) {
  return Number(row?.id || 0);
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
  if (["payment", "expense", "cash_withdraw"].includes(type)) return "out";
  if (type === "correction") return Number(amount || 0) < 0 ? "out" : "in";
  return "in";
}

function isTransactionOut(transaction) {
  return transactionEffect(readTransactionType(transaction), readTransactionAmount(transaction)) === "out";
}
