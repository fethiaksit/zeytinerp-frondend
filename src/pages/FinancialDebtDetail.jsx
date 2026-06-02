import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import {
  financialDebtPaymentsApi,
  financialDebtsApi,
  financialInstallmentsApi,
  getErrorMessage,
} from "../services/api.js";
import {
  dateTR,
  financialPaymentMethodLabel,
  installmentStatusLabel,
  money,
  readInstallmentAmount,
  readInstallmentPaid,
  readInstallmentRemaining,
  todayISO,
} from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyInstallment = {
  installment_no: "",
  due_date: todayISO(),
  amount: "",
  note: "",
};

const emptyPayment = {
  payment_date: todayISO(),
  installment_id: "",
  amount: "",
  payment_method: "cash",
  note: "",
};

export default function FinancialDebtDetail({ params, notify }) {
  const [debt, setDebt] = useState(null);
  const [summary, setSummary] = useState({});
  const [installments, setInstallments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState(null);
  const [installmentForm, setInstallmentForm] = useState(emptyInstallment);
  const [bulkRows, setBulkRows] = useState([{ ...emptyInstallment }]);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);

  const load = async () => {
    setLoading(true);
    try {
      const [debtData, summaryData, installmentRows, paymentRows] = await Promise.all([
        financialDebtsApi.get(params.id),
        financialDebtsApi.summary(params.id).catch(() => ({})),
        financialDebtsApi.installments(params.id),
        financialDebtPaymentsApi.list(),
      ]);
      setDebt(debtData);
      setSummary(summaryData || {});
      setInstallments(installmentRows);
      setPayments(filterPayments(paymentRows, params.id, installmentRows));
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const computed = useMemo(() => buildSummary(summary, installments, payments), [summary, installments, payments]);

  const openInstallmentCreate = () => {
    setEditingInstallment(null);
    setInstallmentForm(emptyInstallment);
    setInstallmentModalOpen(true);
  };

  const openInstallmentEdit = (row) => {
    setEditingInstallment(row);
    setInstallmentForm({
      installment_no: row.installment_no ?? "",
      due_date: String(row.due_date || "").slice(0, 10),
      amount: row.amount ?? "",
      note: row.note || "",
    });
    setInstallmentModalOpen(true);
  };

  const saveInstallment = async (event) => {
    event.preventDefault();
    if (!installmentForm.installment_no || !installmentForm.due_date || !installmentForm.amount) {
      notify("Taksit no, vade tarihi ve tutar zorunludur.");
      return;
    }

    const payload = {
      ...installmentForm,
      installment_no: Number(installmentForm.installment_no),
      amount: Number(installmentForm.amount),
    };

    try {
      if (editingInstallment) {
        await financialInstallmentsApi.update(editingInstallment.id, payload);
        notify("Taksit güncellendi.", "success");
      } else {
        await financialDebtsApi.addInstallment(params.id, payload);
        notify("Taksit eklendi.", "success");
      }
      setInstallmentModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const saveBulkInstallments = async (event) => {
    event.preventDefault();
    const cleanedRows = bulkRows
      .filter((row) => row.installment_no && row.due_date && row.amount)
      .map((row) => ({
        ...row,
        installment_no: Number(row.installment_no),
        amount: Number(row.amount),
      }));

    if (!cleanedRows.length) {
      notify("En az bir geçerli taksit satırı girin.");
      return;
    }

    try {
      await financialDebtsApi.addInstallmentsBulk(params.id, { installments: cleanedRows });
      setBulkRows([{ ...emptyInstallment }]);
      setBulkModalOpen(false);
      notify("Taksit planı kaydedildi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const removeInstallment = async (row) => {
    if (!window.confirm(`${row.installment_no}. taksit silinsin mi?`)) return;
    try {
      await financialInstallmentsApi.remove(row.id);
      notify("Taksit silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const openPayment = (row) => {
    setPaymentForm({
      payment_date: todayISO(),
      installment_id: row.id,
      amount: readInstallmentRemaining(row) || row.amount || "",
      payment_method: "cash",
      note: "",
    });
    setPaymentModalOpen(true);
  };

  const savePayment = async (event) => {
    event.preventDefault();
    if (!paymentForm.installment_id || !paymentForm.payment_date || !paymentForm.amount) {
      notify("Taksit, ödeme tarihi ve tutar zorunludur.");
      return;
    }

    try {
      const body = {
        ...paymentForm,
        financial_debt_id: Number(params.id),
        installment_id: Number(paymentForm.installment_id),
        amount: Number(paymentForm.amount),
      };
      console.log("PAYMENT REQUEST BODY:", body);
      await financialDebtPaymentsApi.create(body);
      setPaymentForm(emptyPayment);
      setPaymentModalOpen(false);
      notify("Ödeme eklendi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const installmentColumns = [
    { key: "installment_no", header: "Taksit No" },
    { key: "due_date", header: "Vade Tarihi", render: (row) => dateTR(row.due_date) },
    { key: "amount", header: "Taksit Tutarı", align: "right", render: (row) => money(readInstallmentAmount(row)) },
    { key: "paid_amount", header: "Ödenen", align: "right", render: (row) => money(readInstallmentPaid(row)) },
    { key: "remaining_amount", header: "Kalan", align: "right", render: (row) => money(readInstallmentRemaining(row)) },
    {
      key: "status",
      header: "Durum",
      render: (row) => <span className={`badge ${installmentTone(row)}`}>{installmentStatusLabel(row.status || computedStatus(row))}</span>,
    },
    { key: "note", header: "Not" },
    {
      key: "pay",
      header: "Ödeme Ekle",
      render: (row) => (
        <button className="ghost-button" type="button" onClick={() => openPayment(row)}>
          Ödeme Ekle
        </button>
      ),
    },
    {
      key: "edit",
      header: "Düzenle",
      render: (row) => (
        <button className="ghost-button" type="button" onClick={() => openInstallmentEdit(row)}>
          Düzenle
        </button>
      ),
    },
    {
      key: "delete",
      header: "Sil",
      render: (row) => (
        <button className="danger-button" type="button" onClick={() => removeInstallment(row)}>
          Sil
        </button>
      ),
    },
  ];

  const paymentColumns = [
    { key: "payment_date", header: "Tarih", render: (row) => dateTR(row.payment_date) },
    { key: "amount", header: "Tutar", align: "right", render: (row) => money(row.amount) },
    { key: "payment_method", header: "Ödeme Yöntemi", render: (row) => financialPaymentMethodLabel(row.payment_method) },
    { key: "note", header: "Not" },
  ];

  return (
    <div className="page-stack">
      <button className="ghost-button fit" type="button" onClick={() => navigate("/finans-borclari")}>
        ← Finans Borçlarına Dön
      </button>

      <div className="stat-grid">
        <StatCard title="Toplam Borç" value={money(computed.totalDebt)} />
        <StatCard title="Ödenen Toplam" value={money(computed.paidTotal)} tone="success" />
        <StatCard title="Kalan Borç" value={money(computed.remainingTotal)} tone="warning" />
        <StatCard title="Geciken Tutar" value={money(computed.overdueAmount)} tone={computed.overdueAmount > 0 ? "danger" : "success"} />
        <StatCard title="Bu Ay Ödenecek" value={money(computed.thisMonthDue)} tone="warning" />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{debt?.title || "Finans Borcu"}</h2>
            <p>{debt?.institution_name || debt?.institution || debt?.organization || debt?.company || "Kurum bilgisi yok"}</p>
          </div>
        </div>
        <p className="note-text">{debt?.note || "Not bulunmuyor."}</p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Taksit Listesi</h2>
            <p>Tek taksit veya çoklu taksit planı ekleyin.</p>
          </div>
          <div className="row-actions">
            <button className="secondary-button" type="button" onClick={openInstallmentCreate}>
              Taksit Ekle
            </button>
            <button className="primary-button" type="button" onClick={() => setBulkModalOpen(true)}>
              Çoklu Taksit Ekle
            </button>
          </div>
        </div>
        <DataTable columns={installmentColumns} rows={installments} loading={loading} emptyText="Henüz taksit kaydı yok." />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Ödeme Geçmişi</h2>
            <p>Taksitlere bağlı ödeme kayıtları.</p>
          </div>
        </div>
        <DataTable columns={paymentColumns} rows={payments} loading={loading} emptyText="Henüz ödeme kaydı yok." />
      </section>

      <Modal title={editingInstallment ? "Taksit Düzenle" : "Taksit Ekle"} open={installmentModalOpen} onClose={() => setInstallmentModalOpen(false)}>
        <InstallmentForm form={installmentForm} setForm={setInstallmentForm} onSubmit={saveInstallment} />
      </Modal>

      <Modal title="Çoklu Taksit Ekle" open={bulkModalOpen} onClose={() => setBulkModalOpen(false)}>
        <BulkInstallmentForm rows={bulkRows} setRows={setBulkRows} onSubmit={saveBulkInstallments} />
      </Modal>

      <Modal title="Ödeme Ekle" open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)}>
        <PaymentForm form={paymentForm} setForm={setPaymentForm} installments={installments} onSubmit={savePayment} />
      </Modal>
    </div>
  );
}

function InstallmentForm({ form, setForm, onSubmit }) {
  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Taksit No
        <input type="number" min="1" {...field("installment_no")} required />
      </label>
      <label>
        Vade Tarihi
        <input type="date" {...field("due_date")} required />
      </label>
      <label>
        Tutar
        <input type="number" step="0.01" {...field("amount")} required />
      </label>
      <label className="span-2">
        Not
        <textarea {...field("note")} />
      </label>
      <div className="form-actions span-2">
        <button className="primary-button" type="submit">
          Kaydet
        </button>
      </div>
    </form>
  );
}

function BulkInstallmentForm({ rows, setRows, onSubmit }) {
  const updateRow = (index, key, value) => {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    const nextNo = Number(rows[rows.length - 1]?.installment_no || rows.length) + 1;
    setRows([...rows, { ...emptyInstallment, installment_no: nextNo }]);
  };

  const removeRow = (index) => {
    setRows(rows.length === 1 ? [{ ...emptyInstallment }] : rows.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <form className="page-stack" onSubmit={onSubmit}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Taksit No</th>
              <th>Vade Tarihi</th>
              <th>Tutar</th>
              <th>Not</th>
              <th>Sil</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={row.installment_no}
                    onChange={(event) => updateRow(index, "installment_no", event.target.value)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={row.due_date}
                    onChange={(event) => updateRow(index, "due_date", event.target.value)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) => updateRow(index, "amount", event.target.value)}
                    required
                  />
                </td>
                <td>
                  <input value={row.note} onChange={(event) => updateRow(index, "note", event.target.value)} />
                </td>
                <td>
                  <button className="danger-button" type="button" onClick={() => removeRow(index)}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={addRow}>
          Satır Ekle
        </button>
        <button className="primary-button" type="submit">
          Kaydet
        </button>
      </div>
    </form>
  );
}

function PaymentForm({ form, setForm, installments, onSubmit }) {
  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Tarih
        <input type="date" {...field("payment_date")} required />
      </label>
      <label>
        Taksit
        <select {...field("installment_id")} required>
          <option value="">Taksit seçin</option>
          {installments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.installment_no}. Taksit - {money(readInstallmentRemaining(row))}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tutar
        <input type="number" step="0.01" {...field("amount")} required />
      </label>
      <label>
        Ödeme Yöntemi
        <select {...field("payment_method")}>
          <option value="cash">Nakit</option>
          <option value="bank_transfer">Havale/EFT</option>
          <option value="credit_card">Kart</option>
          <option value="other">Diğer</option>
        </select>
      </label>
      <label className="span-2">
        Not
        <textarea {...field("note")} />
      </label>
      <div className="form-actions span-2">
        <button className="primary-button" type="submit">
          Kaydet
        </button>
      </div>
    </form>
  );
}

function buildSummary(summary, installments, payments) {
  const fallbackTotal = installments.reduce((sum, row) => sum + readInstallmentAmount(row), 0);
  const fallbackPaid = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalDebt = Number(summary.total_debt ?? summary.total_amount ?? fallbackTotal);
  const paidTotal = Number(summary.paid_total ?? summary.total_paid ?? fallbackPaid);
  const remainingTotal = Number(summary.remaining_debt ?? summary.remaining_amount ?? Math.max(0, totalDebt - paidTotal));
  const overdueAmount = Number(summary.overdue_amount ?? buildOverdueAmount(installments));
  const thisMonthDue = Number(summary.this_month_due ?? summary.month_due ?? buildThisMonthDue(installments));

  return { totalDebt, paidTotal, remainingTotal, overdueAmount, thisMonthDue };
}

function filterPayments(rows, debtId, installments) {
  const installmentIds = new Set(installments.map((row) => String(row.id)));
  const filtered = rows.filter(
    (row) =>
      String(row.financial_debt_id ?? row.debt_id) === String(debtId) ||
      installmentIds.has(String(row.installment_id ?? row.financial_installment_id)),
  );
  return filtered.length ? filtered : rows;
}

function buildOverdueAmount(installments) {
  const today = startOfToday();
  return installments
    .filter((row) => row.status !== "paid" && row.due_date && new Date(row.due_date) < today)
    .reduce((sum, row) => sum + readInstallmentRemaining(row), 0);
}

function buildThisMonthDue(installments) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return installments
    .filter((row) => row.status !== "paid" && String(row.due_date || "").slice(0, 7) === month)
    .reduce((sum, row) => sum + readInstallmentRemaining(row), 0);
}

function computedStatus(row) {
  if (readInstallmentRemaining(row) <= 0) return "paid";
  if (readInstallmentPaid(row) > 0) return "partial";
  if (row.due_date && new Date(row.due_date) < startOfToday()) return "overdue";
  return "unpaid";
}

function installmentTone(row) {
  const status = row.status || computedStatus(row);
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "partial") return "warning";
  return "muted";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
