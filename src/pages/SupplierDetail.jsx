import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { api, getErrorMessage, supplierTransactionFiles, supplierTransactionsApi, suppliersApi } from "../services/api.js";
import {
  dateTR,
  money,
  supplierPaymentMethodLabel,
  supplierTransactionLabel,
  supplierTransactionTone,
  todayISO,
} from "../utils/format.js";
import { navigate } from "../utils/router.js";

const emptyTransaction = {
  transaction_date: todayISO(),
  type: "invoice",
  amount: "",
  invoice_no: "",
  payment_method: "cash",
  note: "",
};

const transactionTypes = [
  { value: "invoice", label: "Gelen Fatura Ekle", summaryLabel: "Gelen Fatura", description: "Firma borcunu artırır" },
  { value: "payment", label: "Ödeme Ekle", summaryLabel: "Ödeme", description: "Firma borcunu azaltır" },
  { value: "return", label: "İade / Fatura Düşümü Ekle", summaryLabel: "İade / Fatura Düşümü", description: "Firma borcunu azaltır" },
];

const supportedFileTypes = ["jpg", "jpeg", "png", "webp", "pdf"];

export default function SupplierDetail({ params, notify }) {
  const [supplier, setSupplier] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyTransaction);
  const [invoiceFiles, setInvoiceFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileModal, setFileModal] = useState({ open: false, transaction: null, files: [], loading: false });
  const [deletingFileId, setDeletingFileId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [supplierData, balanceData, transactionData] = await Promise.all([
        suppliersApi.get(params.id),
        suppliersApi.balance(params.id),
        supplierTransactionsApi.list({ supplier_id: params.id }),
      ]);
      const rows = Array.isArray(transactionData) ? transactionData : [];
      const rowsWithFiles = await attachInvoiceFiles(rows);
      setSupplier({ ...supplierData, current_debt: balanceData?.balance ?? balanceData?.current_debt ?? balanceData?.debt ?? balanceData });
      setTransactions(rowsWithFiles);
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]);

  useEffect(() => {
    console.log("Selected invoice files:", invoiceFiles);
  }, [invoiceFiles]);

  const requestSaveConfirmation = (event) => {
    event.preventDefault();
    const filesToUpload = Array.from(invoiceFiles || []);
    const unsupportedFiles = filesToUpload.filter((file) => !isSupportedFile(file));

    if (form.type === "invoice" && unsupportedFiles.length > 0) {
      notify("Sadece jpg, jpeg, png, webp veya pdf dosyası seçilebilir.");
      return;
    }

    setConfirmOpen(true);
  };

  const saveTransaction = async () => {
    setSaving(true);
    try {
      const filesToUpload = Array.from(invoiceFiles || []);
      console.log("Selected invoice files", filesToUpload);

      const unsupportedFiles = filesToUpload.filter((file) => !isSupportedFile(file));
      if (form.type === "invoice" && unsupportedFiles.length > 0) {
        notify("Sadece jpg, jpeg, png, webp veya pdf dosyası seçilebilir.");
        return;
      }

      const createdTransaction = await supplierTransactionsApi.create(buildTransactionPayload(form, params.id));
      console.log("Created transaction response", createdTransaction);
      const transactionId = readTransactionId(createdTransaction);
      let uploadFailed = false;
      let uploadedFiles = false;
      console.log("Created transaction id", transactionId);

      if (form.type === "invoice" && filesToUpload.length > 0) {
        if (!transactionId) {
          uploadFailed = true;
          notify("Fatura hareketi kaydedildi ama dosyalar yüklenemedi: transaction id alınamadı");
        } else {
          try {
            console.log("Uploading files count", filesToUpload.length);
            setUploadingFiles(true);
            await supplierTransactionFiles.upload(transactionId, filesToUpload);
            uploadedFiles = true;
            notify("Fatura dosyaları yüklendi", "success");
          } catch (uploadError) {
            uploadFailed = true;
            notify(`Fatura kaydedildi ancak görseller yüklenemedi: ${getErrorMessage(uploadError)}`);
          } finally {
            setUploadingFiles(false);
          }
        }
      }

      if (uploadFailed) {
        setForm(emptyTransaction);
        setInvoiceFiles([]);
        setFileInputKey((key) => key + 1);
        setConfirmOpen(false);
        load();
        return;
      }

      setForm(emptyTransaction);
      setInvoiceFiles([]);
      setFileInputKey((key) => key + 1);
      setConfirmOpen(false);
      if (!uploadFailed && !uploadedFiles) notify("Firma hareketi eklendi.", "success");
      load();
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setSaving(false);
      setUploadingFiles(false);
    }
  };

  const openFileModal = async (transaction) => {
    setFileModal({ open: true, transaction, files: transaction._files || [], loading: true });
    try {
      const files = asArray(await supplierTransactionFiles.list(transaction.id));
      setFileModal({ open: true, transaction, files, loading: false });
    } catch (error) {
      setFileModal({ open: true, transaction, files: transaction._files || [], loading: false });
      notify(getErrorMessage(error));
    }
  };

  const removeFile = async (file) => {
    const fileId = readFileId(file);
    if (!fileId) return;

    setDeletingFileId(fileId);
    try {
      await supplierTransactionFiles.remove(fileId);
      const nextFiles = fileModal.files.filter((item) => readFileId(item) !== fileId);
      setFileModal({ ...fileModal, files: nextFiles });
      setTransactions((rows) =>
        rows.map((row) =>
          row.id === fileModal.transaction?.id
            ? { ...row, _files: nextFiles, _file_count: nextFiles.length, files: nextFiles }
            : row,
        ),
      );
      notify("Fatura dosyası silindi.", "success");
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setDeletingFileId(null);
    }
  };

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(row.transaction_date) },
    { key: "type", header: "Tip", render: (row) => supplierTransactionLabel(row.type) },
    { key: "invoice_no", header: "Fatura No", render: (row) => row.invoice_no || "-" },
    {
      key: "files",
      header: "Fatura",
      render: (row) => {
        const fileCount = readFileCount(row);
        if (!isInvoice(row)) return "-";

        return (
          <div className="row-actions">
            {fileCount > 0 && <span className="badge info">📎 Fatura</span>}
            <button className="secondary-button" type="button" onClick={() => openFileModal(row)}>
              Faturaları Gör
            </button>
          </div>
        );
      },
    },
    { key: "payment_method", header: "Ödeme", render: (row) => (row.payment_method ? supplierPaymentMethodLabel(row.payment_method) : "-") },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      render: (row) => <span className={`amount-text ${supplierTransactionTone(row.type)}`}>{money(row.amount)}</span>,
    },
    { key: "note", header: "Not" },
  ];

  const formTitle = {
    invoice: "Gelen Fatura Ekle",
    payment: "Ödeme Ekle",
    return: "İade / Fatura Düşümü",
  }[form.type];
  const selectedTransactionType = transactionTypes.find((item) => item.value === form.type) || transactionTypes[0];

  return (
    <div className="page-stack">
      <button className="ghost-button fit" type="button" onClick={() => navigate("/firmalar")}>
        ← Firmalara Dön
      </button>
      <div className="stat-grid two">
        <StatCard title="Firma" value={supplier?.name || "Yükleniyor"} hint={supplier?.phone || ""} />
        <StatCard title="Güncel Borç" value={money(supplier?.current_debt ?? supplier?.debt ?? supplier?.balance)} tone="warning" />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Firma Bilgileri</h2>
            <p>{supplier?.address || "Adres girilmemiş"}</p>
          </div>
          <span className={`badge ${supplier?.is_active ? "success" : "muted"}`}>{supplier?.is_active ? "Aktif" : "Pasif"}</span>
        </div>
        <p className="note-text">{supplier?.note || "Not bulunmuyor."}</p>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Hareket Ekle</h2>
            <p>Önce işlem türünü seçin, sonra sadece o işleme ait alanları doldurun.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={requestSaveConfirmation}>
          <div className="operation-card-grid span-2" role="group" aria-label="Hareket tipi">
            {transactionTypes.map((item) => (
              <button
                key={item.value}
                className={`operation-card ${form.type === item.value ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setForm({ ...emptyTransaction, type: item.value, transaction_date: form.transaction_date });
                  setInvoiceFiles([]);
                  setFileInputKey((key) => key + 1);
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <div className="span-2 form-subtitle">
            <strong>{formTitle}</strong>
            <span>{selectedTransactionType.description}</span>
          </div>

          <label>
            Tarih
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              required
            />
          </label>

          {form.type === "invoice" && (
            <>
              <label>
                Fatura Tutarı
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </label>
              <label>
                Fatura No
                <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} />
              </label>
              <div className="span-2 file-upload-box">
                <label>
                  Fatura Görselleri / PDF
                  <input
                    key={fileInputKey}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => setInvoiceFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {invoiceFiles.length > 0 && (
                  <div className="selected-files">
                    {invoiceFiles.map((file, index) => (
                      <div className="file-row" key={`${file.name}-${file.size}-${index}`}>
                        <span className="file-order">{index + 1}</span>
                        <strong>{file.name}</strong>
                        <small>{formatFileSize(file.size)}</small>
                      </div>
                    ))}
                  </div>
                )}
                {uploadingFiles && <div className="state-box compact">Fatura dosyaları yükleniyor...</div>}
              </div>
              <label className="span-2">
                Açıklama
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
            </>
          )}

          {form.type === "payment" && (
            <>
              <label>
                Ödeme Tutarı
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </label>
              <label>
                Ödeme Şekli
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="cash">Nakit</option>
                  <option value="credit_card">Kredi Kartı</option>
                  <option value="current_account">Cari</option>
                  <option value="bank_transfer">Havale/EFT</option>
                  <option value="other">Diğer</option>
                </select>
              </label>
              <label className="span-2">
                Açıklama
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
            </>
          )}

          {form.type === "return" && (
            <>
              <label>
                İade Tutarı
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </label>
              <label className="span-2">
                Açıklama
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
            </>
          )}

          <div className="form-actions span-2">
            <button className="primary-button" type="submit" disabled={saving}>
              Kaydet
            </button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>Hareket Listesi</h2>
        </div>
        <DataTable columns={columns} rows={transactions} loading={loading} emptyText="Bu firma için hareket yok." />
      </section>
      <Modal
        title={`Faturalar${fileModal.transaction?.invoice_no ? ` - ${fileModal.transaction.invoice_no}` : ""}`}
        open={fileModal.open}
        onClose={() => setFileModal({ open: false, transaction: null, files: [], loading: false })}
      >
        {fileModal.loading ? (
          <div className="state-box">Faturalar yükleniyor...</div>
        ) : fileModal.files.length === 0 ? (
          <div className="state-box empty">Bu hareket için fatura dosyası yok.</div>
        ) : (
          <div className="invoice-preview-list">
            {fileModal.files.map((file, index) => {
              const fileUrl = resolveFileUrl(file);
              const fileName = readFileName(file);
              const fileId = readFileId(file);
              const isPdf = isPdfFile(file);

              return (
                <article className="invoice-preview-item" key={fileId || `${fileName}-${index}`}>
                  <div className="invoice-preview-header">
                    <div>
                      <span className="file-order">{index + 1}</span>
                      <strong>{fileName}</strong>
                      <small>{formatFileSize(readFileSize(file))}</small>
                    </div>
                    <button className="danger-button" type="button" disabled={deletingFileId === fileId} onClick={() => removeFile(file)}>
                      {deletingFileId === fileId ? "Siliniyor..." : "Sil"}
                    </button>
                  </div>
                  {isPdf ? (
                    <a className="file-link" href={fileUrl} target="_blank" rel="noreferrer">
                      PDF Aç
                    </a>
                  ) : (
                    <img src={fileUrl} alt={fileName} />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Modal>
      <Modal title="İşlemi Onayla" open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
        <div className="confirm-summary">
          <SummaryRow label="Firma" value={supplier?.name || "-"} />
          <SummaryRow label="İşlem" value={selectedTransactionType.summaryLabel} />
          <SummaryRow label="Tarih" value={dateTR(form.transaction_date)} />
          {form.type === "invoice" && (
            <>
              <SummaryRow label="Fatura No" value={form.invoice_no || "-"} />
              <SummaryRow label="Tutar" value={money(form.amount)} />
              <SummaryRow label="Açıklama" value={form.note || "-"} />
              <SummaryRow label="Eklenecek Dosya Sayısı" value={invoiceFiles.length} />
            </>
          )}
          {form.type === "payment" && (
            <>
              <SummaryRow label="Ödeme Şekli" value={supplierPaymentMethodLabel(form.payment_method)} />
              <SummaryRow label="Tutar" value={money(form.amount)} />
              <SummaryRow label="Açıklama" value={form.note || "-"} />
            </>
          )}
          {form.type === "return" && (
            <>
              <SummaryRow label="Tutar" value={money(form.amount)} />
              <SummaryRow label="Açıklama" value={form.note || "-"} />
            </>
          )}
        </div>
        <div className="form-actions modal-actions">
          <button className="ghost-button" type="button" disabled={saving} onClick={() => setConfirmOpen(false)}>
            Vazgeç
          </button>
          <button className="primary-button" type="button" disabled={saving} onClick={saveTransaction}>
            {saving ? "İşlem kaydediliyor..." : "Onayla ve Kaydet"}
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

async function attachInvoiceFiles(rows) {
  const invoiceRows = rows.filter((row) => isInvoice(row) && row.id);
  if (invoiceRows.length === 0) return rows;

  const fileResults = await Promise.allSettled(
    invoiceRows.map(async (row) => ({
      transactionId: row.id,
      files: asArray(await supplierTransactionFiles.list(row.id)),
    })),
  );

  const filesByTransaction = new Map();
  fileResults.forEach((result) => {
    if (result.status === "fulfilled") {
      filesByTransaction.set(String(result.value.transactionId), result.value.files);
    }
  });

  return rows.map((row) => {
    const existingFiles = asArray(row.files || row.attachments || row.invoice_files);
    const files = filesByTransaction.get(String(row.id)) || existingFiles;
    return {
      ...row,
      _files: files,
      _file_count: files.length || row.file_count || row.files_count || row.invoice_file_count || 0,
    };
  });
}

function buildTransactionPayload(form, supplierId) {
  const base = {
    supplier_id: Number(supplierId),
    transaction_date: form.transaction_date,
    type: form.type,
    amount: Number(form.amount || 0),
    note: form.note,
  };

  if (form.type === "invoice") {
    return {
      ...base,
      invoice_no: form.invoice_no,
    };
  }

  if (form.type === "payment") {
    return {
      ...base,
      payment_method: form.payment_method,
    };
  }

  return base;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isInvoice(row) {
  return row?.type === "invoice" || row?.type === "purchase";
}

function readTransactionId(transaction) {
  return (
    transaction?.id ??
    transaction?.data?.id ??
    transaction?.transaction?.id ??
    transaction?.data?.transaction?.id ??
    transaction?.supplier_transaction?.id ??
    transaction?.data?.supplier_transaction?.id ??
    transaction?.transaction_id ??
    transaction?.data?.transaction_id ??
    transaction?.supplier_transaction_id ??
    transaction?.data?.supplier_transaction_id
  );
}

function readFileId(file) {
  return file?.id ?? file?.file_id ?? file?.supplier_transaction_file_id;
}

function readFileName(file) {
  return file?.file_name || file?.filename || file?.name || file?.original_name || "Fatura dosyası";
}

function readFileSize(file) {
  return Number(file?.file_size ?? file?.size ?? 0);
}

function readFileCount(row) {
  return asArray(row?._files).length || row?.file_count || row?.files_count || row?.invoice_file_count || 0;
}

function readFilePath(file) {
  return file?.url || file?.file_url || file?.download_url || file?.path || file?.file_path || "";
}

function resolveFileUrl(file) {
  const path = readFilePath(file);
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${new URL(api.defaults.baseURL).origin}${path}`;
  return `${String(api.defaults.baseURL).replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function fileExtension(name) {
  return String(name || "").split(".").pop().toLowerCase();
}

function isSupportedFile(file) {
  return supportedFileTypes.includes(fileExtension(file.name));
}

function isPdfFile(file) {
  const type = file?.mime_type || file?.content_type || file?.type || "";
  return type.includes("pdf") || fileExtension(readFileName(file)) === "pdf";
}

function formatFileSize(size) {
  if (!size) return "Boyut bilinmiyor";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
