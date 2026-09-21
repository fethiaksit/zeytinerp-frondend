import { useEffect, useState } from "react";
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

const textValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
};

const numberValue = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      const result = await customersApi.list();
      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.customers)
            ? result.customers
            : [];
      setCustomers(rows);
    } catch (error) {
      setCustomers([]);
      notify?.(getErrorMessage(error));
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
      name: textValue(customer?.name),
      phone: textValue(customer?.phone),
      address: textValue(customer?.address),
      credit_limit: customer?.credit_limit == null ? "" : textValue(customer.credit_limit),
      note: textValue(customer?.note),
      is_active: customer?.is_active !== false,
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name) {
      notify?.("Müşteri adı zorunludur.");
      return;
    }

    if (!phone) {
      notify?.("Telefon numarası zorunludur.");
      return;
    }

    const creditLimit = form.credit_limit === "" ? null : Number(form.credit_limit);
    if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      notify?.("Kredi limiti 0 veya daha büyük olmalıdır.");
      return;
    }

    const payload = {
      name,
      phone,
      address: form.address.trim(),
      note: form.note.trim(),
      is_active: Boolean(form.is_active),
      credit_limit: creditLimit,
    };

    try {
      if (editing?.id) {
        await customersApi.update(editing.id, payload);
        notify?.("Cari müşteri güncellendi.", "success");
      } else {
        await customersApi.create(payload);
        notify?.("Cari müşteri eklendi.", "success");
      }

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      notify?.(getErrorMessage(error));
    }
  };

  const deactivate = async (customer) => {
    if (!customer?.id) return;
    if (!window.confirm(`${textValue(customer.name) || "Bu müşteri"} cari hesabı pasife alınsın mı?`)) return;

    try {
      await customersApi.remove(customer.id);
      notify?.("Cari müşteri pasife alındı.", "success");
      await load();
    } catch (error) {
      notify?.(getErrorMessage(error));
    }
  };

  const q = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = customers.filter((customer) => {
    if (!q) return true;
    const name = textValue(customer?.name).toLocaleLowerCase("tr-TR");
    const phone = textValue(customer?.phone).toLocaleLowerCase("tr-TR");
    return name.includes(q) || phone.includes(q);
  });

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

      {loading ? (
        <div className="state-box">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="state-box empty">Henüz cari müşteri kaydı yok.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Telefon</th>
                <th className="right">Bakiye</th>
                <th className="right">Kredi Limiti</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, index) => (
                <tr key={customer?.id ?? index}>
                  <td>{textValue(customer?.name) || "-"}</td>
                  <td>{textValue(customer?.phone) || "-"}</td>
                  <td className="right">{money(numberValue(customer?.balance))}</td>
                  <td className="right">
                    {customer?.credit_limit == null ? "—" : money(numberValue(customer.credit_limit))}
                  </td>
                  <td>
                    <span className={`badge ${customer?.is_active !== false ? "success" : "muted"}`}>
                      {customer?.is_active !== false ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="ghost-button" type="button" onClick={() => openEdit(customer)}>
                        Düzenle
                      </button>
                      {customer?.is_active !== false && (
                        <button className="danger-button" type="button" onClick={() => deactivate(customer)}>
                          Pasife Al
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
