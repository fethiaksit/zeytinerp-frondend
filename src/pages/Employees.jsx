import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { employeesApi, getErrorMessage } from "../services/api.js";
import { money } from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyForm = {
  name: "",
  phone: "",
  daily_wage: "",
  is_active: true,
  note: "",
};

export default function Employees({ notify }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setEmployees(await employeesApi.listWithBalances());
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

  const openEdit = (employee) => {
    setEditing(employee);
    setForm({
      name: employee.name || "",
      phone: employee.phone || "",
      daily_wage: employee.daily_wage || "",
      is_active: employee.is_active ?? true,
      note: employee.note || "",
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const payload = { ...form, daily_wage: Number(form.daily_wage || 0) };
    try {
      if (editing) {
        await employeesApi.update(editing.id, payload);
        notify("Personel güncellendi.", "success");
      } else {
        await employeesApi.create(payload);
        notify("Personel eklendi.", "success");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const remove = async (employee) => {
    if (!window.confirm(`${employee.name} silinsin mi?`)) return;
    try {
      await employeesApi.remove(employee.id);
      notify("Personel silindi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "name", header: "Personel" },
    { key: "phone", header: "Telefon" },
    { key: "daily_wage", header: "Günlük Ücret", align: "right", render: (row) => money(row.daily_wage) },
    {
      key: "debt",
      header: "Maaş Borcu",
      align: "right",
      render: (row) => money(row.current_debt ?? row.salary_debt ?? row.balance),
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <span className={`badge ${row.is_active ? "success" : "muted"}`}>{row.is_active ? "Aktif" : "Pasif"}</span>,
    },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <div className="row-actions">
          <button className="ghost-button" type="button" onClick={() => navigate(`/personel/${row.id}`)}>
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
          <h2>Personel Listesi</h2>
          <p>Günlük ücretleri, avansları ve kalan maaş borçlarını takip edin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          Personel Ekle
        </button>
      </div>

      <DataTable columns={columns} rows={employees} loading={loading} emptyText="Henüz personel kaydı yok." />

      <Modal title={editing ? "Personel Düzenle" : "Personel Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label>
            Ad Soyad
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Günlük Ücret
            <input
              type="number"
              step="0.01"
              value={form.daily_wage}
              onChange={(e) => setForm({ ...form, daily_wage: e.target.value })}
              required
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Aktif personel
          </label>
          <label className="span-2">
            Not
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button" type="submit">
              Kaydet
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
