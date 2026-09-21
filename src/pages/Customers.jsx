import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { customersApi, getErrorMessage } from "../services/api.js";
import { money } from "../utils/format.js";

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  credit_limit: "",
  note: "",
  is_active: true,
};

export default function Customers({ notify }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await customersApi.list();
      setCustomers(Array.isArray(rows) ? rows : []);
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

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      credit_limit: customer.credit_limit ?? "",
      note: customer.note || "",
      is_active: customer.is_active ?? true,
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name) {
      notify("Müşteri adı zorunludur.");
      return;
    }
    if (!phone) {
      notify("Telefon numarası zorunludur.");
      return;
    }

    const payload = {
      name,
      phone,
      address: form.address.trim(),
      note: form.note.trim(),
      is_active: Boolean(form.is_active),
      credit_limit: form.credit_limit === "" ? null : Number(form.credit_limit),
    };

    if (payload.credit_limit !== null && (!Number.isFinite(payload.credit_limit) || payload.credit_limit < 0)) {
      notify("Kredi limiti 0 veya daha büyük olmalıdır.");
      return;
    }

    try {
      if (editing) {
        await customersApi.update(editing.id, payload);
        notify("Cari müşteri güncellendi.", "success");
      } else {
        await customersApi.create(payload);
        notify("Cari müşteri eklendi.", "success");
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const deactivate = async (customer) => {
    if (!window.confirm(`${customer.name} cari hesabı pasife alınsın mı?`)) return;
    try {
      await customersApi.remove(customer.id);
      notify("Cari müşteri pasife alındı.", "success");
      await load();
    } catch (error) {
      notify(getErrorMessage(error));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return customers;
    return customers.filter((customer) => {
      const haystack = `${customer.name || ""} ${customer.phone || ""}`.toLocaleLowerCase("tr-TR");
      return haystack.includes(q);
    });
  }, [customers, query]);

  const columns = [
    { key: "name", header: "Müşteri" },
    { key: "phone", header: "Telefon" },
    {
      key: "balance",
      header: "Bakiye",
      align: "right",
      render: (row) => money(row.balance ?? 0),
    },
    {
      key: "credit_limit",
      header: "Kredi Limiti",
      align: "right",
      render: (row) => (row.credit_limit == null ? "—" : money(row.credit_limit)),
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <span className={`badge ${row.is_active ? "success" : "muted"}`}>
          {row.is_active ? "Aktif" : "Pasif"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "İşlem",
      render: (row) => (
        <div className="row-actions">
          <button className="ghost-button" type="button" onClick={() => openEdit(row)}>
            Düzenle
          </button>
          {row.is_active && (
            <button className="danger-button" type="button" onClick={() => deactivate(row)}>
              Pasife Al
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Cari Müşteriler</h2>
          <p>Cari hesap açılan müşterileri, bakiyelerini ve kredi limitlerini yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          Cari Müşteri Ekle
        </button>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <input
          type="search"
          placeholder="Ad veya telefon ile ara..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Cari müşteri ara"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyText="Henüz cari müşteri kaydı yok."
      />

      <Modal
        title={editing ? "Cari Müşteri Düzenle" : "Cari Müşteri Ekle"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form className="form-grid" onSubmit={save}>
          <label>
            Ad Soyad / Firma Adı
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>

          <label>
            Telefon
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="05xx xxx xx xx"
              required
            />
          </label>

          <label className="span-2">
            Adres
            <input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </label>

          <label>
            Kredi Limiti
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.credit_limit}
              onChange={(event) => setForm({ ...form, credit_limit: event.target.value })}
              placeholder="Opsiyonel"
            />
          </label>

          <label className="check-line">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            Aktif cari müşteri
          </label>

          <label className="span-2">
            Not
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>

          <div className="form-actions span-2">
            <button className="primary-button" type="submit">
              {editing ? "Değişiklikleri Kaydet" : "Cari Müşteri Ekle"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
