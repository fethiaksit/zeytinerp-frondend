import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { financialDebtsApi, getErrorMessage } from "../services/api.js";
import {
  dateTR,
  financialDebtStatusLabel,
  financialDebtTypeLabel,
  money,
  readFinancialEndDate,
  readFinancialPaid,
  readFinancialRemaining,
  readFinancialTotal,
  todayISO,
} from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyForm = {
  institution_name: "",
  debt_type: "bank_loan",
  title: "",
  total_amount: "",
  start_date: todayISO(),
  end_date: "",
  status: "active",
  note: "",
};

export default function FinancialDebts({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await financialDebtsApi.list());
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
      institution_name: row.institution_name || row.institution || row.organization || row.company || "",
      debt_type: row.debt_type || "bank_loan",
      title: row.title || "",
      total_amount: row.total_amount ?? row.total_debt ?? row.principal_amount ?? "",
      start_date: String(row.start_date || "").slice(0, 10),
      end_date: String(readFinancialEndDate(row) || "").slice(0, 10),
      status: row.status || "active",
      note: row.note || "",
    });
    setModalOpen(true);
  };

  const payload = () => ({
    debt_type: form.debt_type,
    institution_name: form.institution_name,
    title: form.title,
    total_amount: Number(form.total_amount || 0),
    start_date: form.start_date,
    end_date: form.end_date,
    status: form.status,
    note: form.note,
  });

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editing) {
        await financialDebtsApi.update(editing.id, payload());
        notify("Finans borcu güncellendi.", "success");
      } else {
        await financialDebtsApi.create(payload());
        notify("Finans borcu eklendi.", "success");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`${row.title || "Finans borcu"} silinsin mi?`)) return;
    try {
      await financialDebtsApi.remove(row.id);
      notify("Finans borcu silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "institution_name", header: "Kurum", render: (row) => row.institution_name || row.institution || row.organization || row.company || "-" },
    { key: "debt_type", header: "Borç Türü", render: (row) => financialDebtTypeLabel(row.debt_type) },
    { key: "title", header: "Başlık" },
    { key: "total_debt", header: "Toplam Borç", align: "right", render: (row) => money(readFinancialTotal(row)) },
    { key: "paid_total", header: "Ödenen", align: "right", render: (row) => money(readFinancialPaid(row)) },
    { key: "remaining_debt", header: "Kalan Borç", align: "right", render: (row) => money(readFinancialRemaining(row)) },
    { key: "start_date", header: "Başlangıç", render: (row) => dateTR(row.start_date) },
    { key: "end_date", header: "Bitiş", render: (row) => dateTR(readFinancialEndDate(row)) },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <span className={`badge ${(row.status || "active") === "closed" ? "muted" : "success"}`}>
          {financialDebtStatusLabel(row.status || "active")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <div className="row-actions">
          <button className="ghost-button" type="button" onClick={() => navigate(`/finans-borclari/${row.id}`)}>
            Detay
          </button>
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
          <h2>Finans Borçları</h2>
          <p>Banka, kart ve taksitli borçları takip edin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          Borç Ekle
        </button>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Henüz finans borcu kaydı yok." />

      <Modal title={editing ? "Finans Borcu Düzenle" : "Finans Borcu Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <FinancialDebtForm form={form} setForm={setForm} onSubmit={save} />
      </Modal>
    </section>
  );
}

function FinancialDebtForm({ form, setForm, onSubmit }) {
  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Kurum
        <input {...field("institution_name")} required />
      </label>
      <label>
        Borç Türü
        <select {...field("debt_type")}>
          <option value="bank_loan">Banka Kredisi</option>
          <option value="credit_card">Kredi Kartı</option>
          <option value="installment_debt">Taksitli Borç</option>
          <option value="other">Diğer</option>
        </select>
      </label>
      <label className="span-2">
        Başlık
        <input {...field("title")} required />
      </label>
      <label>
        Toplam Borç
        <input type="number" step="0.01" {...field("total_amount")} required />
      </label>
      <label>
        Başlangıç Tarihi
        <input type="date" {...field("start_date")} required />
      </label>
      <label>
        Bitiş Tarihi
        <input type="date" {...field("end_date")} />
      </label>
      <label>
        Durum
        <select {...field("status")}>
          <option value="active">Aktif</option>
          <option value="closed">Kapalı</option>
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
