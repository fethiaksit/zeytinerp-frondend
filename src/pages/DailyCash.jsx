import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { dailyCashApi, getErrorMessage } from "../services/api.js";
import { cashTotal, dateTR, money, todayISO } from "../utils/format.js";

const emptyForm = {
  report_date: todayISO(),
  cash_amount: "",
  pos_amount: "",
  qr_amount: "",
  credit_collection: "",
  credit_given: "",
  note: "",
};

export default function DailyCash({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await dailyCashApi.list());
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      report_date: String(row.report_date || "").slice(0, 10),
      cash_amount: row.cash_amount || "",
      pos_amount: row.pos_amount || "",
      qr_amount: row.qr_amount || "",
      credit_collection: row.credit_collection || "",
      credit_given: row.credit_given || "",
      note: row.note || "",
    });
    setModalOpen(true);
  };

  const payload = () => ({
    ...form,
    cash_amount: Number(form.cash_amount || 0),
    pos_amount: Number(form.pos_amount || 0),
    qr_amount: Number(form.qr_amount || 0),
    credit_collection: Number(form.credit_collection || 0),
    credit_given: Number(form.credit_given || 0),
  });

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editing) {
        await dailyCashApi.update(editing.id, payload());
        notify("Kasa kaydı güncellendi.", "success");
      } else {
        await dailyCashApi.create(payload());
        notify("Kasa kaydı eklendi.", "success");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Kasa kaydı silinsin mi?")) return;
    try {
      await dailyCashApi.remove(row.id);
      notify("Kasa kaydı silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "report_date", header: "Tarih", render: (row) => dateTR(row.report_date) },
    { key: "cash_amount", header: "Nakit", align: "right", render: (row) => money(row.cash_amount) },
    { key: "pos_amount", header: "POS", align: "right", render: (row) => money(row.pos_amount) },
    { key: "qr_amount", header: "QR", align: "right", render: (row) => money(row.qr_amount) },
    { key: "total", header: "Ciro", align: "right", render: (row) => money(cashTotal(row)) },
    { key: "credit_collection", header: "Veresiye Tahsilat", align: "right", render: (row) => money(row.credit_collection) },
    { key: "credit_given", header: "Veresiye Verilen", align: "right", render: (row) => money(row.credit_given) },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <div className="row-actions">
          <button className="ghost-button" type="button" onClick={() => openEdit(row)}>
            Düzenle
          </button>
          <button className="danger-button" type="button" onClick={() => remove(row)}>
            Sil
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Günlük Kasa</h2>
          <p>Nakit, POS, QR ve veresiye hareketlerini gün sonu olarak kaydedin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          Kasa Kaydı Ekle
        </button>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Henüz kasa kaydı yok." />

      <Modal title={editing ? "Kasa Kaydı Düzenle" : "Kasa Kaydı Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <CashForm form={form} setForm={setForm} onSubmit={save} />
      </Modal>
    </section>
  );
}

function CashForm({ form, setForm, onSubmit }) {
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Tarih
        <input type="date" {...field("report_date")} required />
      </label>
      <label>
        Nakit
        <input type="number" step="0.01" {...field("cash_amount")} />
      </label>
      <label>
        POS
        <input type="number" step="0.01" {...field("pos_amount")} />
      </label>
      <label>
        QR
        <input type="number" step="0.01" {...field("qr_amount")} />
      </label>
      <label>
        Veresiye Tahsilat
        <input type="number" step="0.01" {...field("credit_collection")} />
      </label>
      <label>
        Veresiye Verilen
        <input type="number" step="0.01" {...field("credit_given")} />
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
