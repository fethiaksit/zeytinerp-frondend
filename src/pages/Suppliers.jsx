import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { getErrorMessage, suppliersApi } from "../services/api.js";
import { money } from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  note: "",
  is_active: true,
};

export default function Suppliers({ notify }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setSuppliers(await suppliersApi.listWithBalances());
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

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      note: supplier.note || "",
      is_active: supplier.is_active ?? true,
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editing) {
        await suppliersApi.update(editing.id, form);
        notify("Firma güncellendi.", "success");
      } else {
        await suppliersApi.create(form);
        notify("Firma eklendi.", "success");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const columns = [
    { key: "name", header: "Firma" },
    { key: "phone", header: "Telefon" },
    { key: "address", header: "Adres" },
    {
      key: "debt",
      header: "Borç",
      align: "right",
      render: (row) => money(row.current_debt ?? row.debt ?? row.balance),
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
          <button className="ghost-button" type="button" onClick={() => navigate(`/firmalar/${row.id}`)}>
            Detay
          </button>
          <button className="ghost-button" type="button" onClick={() => openEdit(row)}>
            Düzenle
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Firma Listesi</h2>
          <p>Alış yapılan firmaları ve güncel borçlarını yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          Firma Ekle
        </button>
      </div>

      <DataTable columns={columns} rows={suppliers} loading={loading} emptyText="Henüz firma kaydı yok." />

      <Modal title={editing ? "Firma Düzenle" : "Firma Ekle"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label>
            Firma Adı
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="span-2">
            Adres
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="span-2">
            Not
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Aktif firma
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
