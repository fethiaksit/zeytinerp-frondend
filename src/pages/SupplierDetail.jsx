import { useEffect, useRef, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import { exchangeRates, getErrorMessage, supplierTransactionFiles, supplierTransactionsApi, suppliersApi } from "../services/api.js";
import {
  dateTR,
  money,
  moneyCurrency,
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
  currency: "TRY",
  exchange_rate: "1",
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
  const [rateStatus, setRateStatus] = useState("try");
  const manualRateRef = useRef(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileModal, setFileModal] = useState({ open: false, transaction: null, files: [], loading: false, activeIndex: 0 });
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [invoiceDeleteModal, setInvoiceDeleteModal] = useState({ open: false, transaction: null });
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);

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

  useEffect(() => {
    if (form.currency === "TRY") {
      manualRateRef.current = false;
      setForm((current) => (current.exchange_rate === "1" ? current : { ...current, exchange_rate: "1" }));
      setRateStatus("try");
      return undefined;
    }

    let active = true;
    manualRateRef.current = false;
    setRateStatus("loading");
    exchangeRates
      .latest(form.currency)
      .then((res) => {
        console.log("exchange rate response", res.data);
        const rate = readExchangeRate(res.data);
        if (!active) return;
        if (rate > 0 && !manualRateRef.current) {
          setForm((current) => ({ ...current, exchange_rate: String(rate) }));
          setRateStatus("auto");
        } else if (!manualRateRef.current) {
          setRateStatus("error");
        }
      })
      .catch(() => {
        if (active && !manualRateRef.current) setRateStatus("error");
      });

    return () => {
      active = false;
    };
  }, [form.currency]);

  const requestSaveConfirmation = (event) => {
    event.preventDefault();
    const filesToUpload = Array.from(invoiceFiles || []);
    const unsupportedFiles = filesToUpload.filter((file) => !isSupportedFile(file));

    if (unsupportedFiles.length > 0) {
      notify("Sadece jpg, jpeg, png, webp veya pdf dosyası seçilebilir.");
      return;
    }

    if (form.currency !== "TRY" && normalizedRate(form) <= 0) {
      notify("Dövizli işlem için geçerli bir kur girin.");
      return;
    }

    setConfirmOpen(true);
  };

  const saveTransaction = async () => {
    setSaving(true);
    try {
      const filesToUpload = Array.from(invoiceFiles || []);
      console.log("Selected invoice files:", filesToUpload);

      const unsupportedFiles = filesToUpload.filter((file) => !isSupportedFile(file));
      if (unsupportedFiles.length > 0) {
        notify("Sadece jpg, jpeg, png, webp veya pdf dosyası seçilebilir.");
        return;
      }

      const createdTransaction = await supplierTransactionsApi.create(buildTransactionPayload(form, params.id));
      console.log("Created transaction response:", createdTransaction);
      const transactionId = readTransactionId(createdTransaction);
      let uploadFailed = false;
      let uploadedFiles = false;
      console.log("Created transaction id:", transactionId);

      if (filesToUpload.length > 0) {
        if (!transactionId) {
          uploadFailed = true;
          notify("Hareket kaydedildi ama dosyalar yüklenemedi: transaction id alınamadı");
        } else {
          try {
            console.log("Uploading invoice files:", filesToUpload);
            setUploadingFiles(true);
            const uploadedFilesResponse = await supplierTransactionFiles.upload(transactionId, filesToUpload);
            console.log("Uploaded files response:", uploadedFilesResponse);
            uploadedFiles = true;
            notify(`${documentLabelForType(form.type)} kaydedildi`, "success");
          } catch (uploadError) {
            uploadFailed = true;
            notify(`Hareket kaydedildi ancak dosyalar yüklenemedi: ${getErrorMessage(uploadError)}`);
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
    console.log("Viewing invoice files:", transaction);
    setFileModal({ open: true, transaction, files: transaction._files || [], loading: true, activeIndex: 0 });
    try {
      const files = asArray(await supplierTransactionFiles.list(transaction.id));
      console.log("Viewing invoice files:", files);
      setFileModal({ open: true, transaction, files, loading: false, activeIndex: 0 });
    } catch (error) {
      setFileModal({ open: true, transaction, files: transaction._files || [], loading: false, activeIndex: 0 });
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
      setFileModal({ ...fileModal, files: nextFiles, activeIndex: Math.min(fileModal.activeIndex, Math.max(nextFiles.length - 1, 0)) });
      setTransactions((rows) =>
        rows.map((row) =>
          row.id === fileModal.transaction?.id
            ? { ...row, _files: nextFiles, _file_count: nextFiles.length, files: nextFiles }
            : row,
        ),
      );
      notify("Dosya silindi.", "success");
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setDeletingFileId(null);
    }
  };

  const requestInvoiceDelete = (transaction) => {
    setInvoiceDeleteModal({ open: true, transaction });
  };

  const deleteInvoice = async () => {
    const transactionId = invoiceDeleteModal.transaction?.id;
    if (!transactionId) return;

    setDeletingInvoiceId(transactionId);
    try {
      await supplierTransactionsApi.remove(transactionId);
      setTransactions((rows) => rows.filter((row) => row.id !== transactionId));
      setInvoiceDeleteModal({ open: false, transaction: null });
      notify("Fatura silindi.", "success");
      await load();
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const columns = [
    { key: "transaction_date", header: "Tarih", render: (row) => dateTR(row.transaction_date) },
    { key: "supplier", header: "Firma", render: () => supplier?.name || "-" },
    { key: "type", header: "Tip", render: (row) => supplierTransactionLabel(row.type) },
    { key: "invoice_no", header: "Fatura No", render: (row) => row.invoice_no || "-" },
    {
      key: "files",
      header: "Dosya",
      render: (row) => {
        const fileCount = readFileCount(row);
        if (fileCount <= 0) return "-";

        return (
          <div className="row-actions">
            <button className="secondary-button attachment-button" type="button" onClick={() => openFileModal(row)}>
              📎 {fileViewButtonLabel(row)}
            </button>
          </div>
        );
      },
    },
    { key: "payment_method", header: "Ödeme", render: (row) => (row.payment_method ? supplierPaymentMethodLabel(row.payment_method) : "-") },
    {
      key: "amount_original",
      header: "Orijinal Tutar",
      align: "right",
      render: (row) => <span className={`amount-text ${supplierTransactionTone(row.type)}`}>{moneyCurrency(readOriginalAmount(row), readCurrency(row))}</span>,
    },
    { key: "currency", header: "Para Birimi", render: (row) => readCurrency(row) },
    { key: "exchange_rate", header: "Kur", align: "right", render: (row) => formatRate(readExchangeRateFromRow(row)) },
    { key: "amount_try", header: "TL Karşılığı", align: "right", render: (row) => money(readTRYAmount(row)) },
    { key: "note", header: "Açıklama", render: (row) => row.note || "-" },
    {
      key: "invoice_delete",
      header: "İşlem",
      render: (row) =>
        isInvoice(row) ? (
          <button className="danger-button" type="button" disabled={deletingInvoiceId === row.id} onClick={() => requestInvoiceDelete(row)}>
            Sil
          </button>
        ) : (
          "-"
        ),
    },
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
                  manualRateRef.current = false;
                  setRateStatus("try");
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
              <CurrencyFields form={form} setForm={setForm} rateStatus={rateStatus} setRateStatus={setRateStatus} manualRateRef={manualRateRef} />
              <TransactionFileUpload
                files={invoiceFiles}
                inputKey={fileInputKey}
                label="Fatura Görselleri / PDF"
                onChange={setInvoiceFiles}
                uploading={uploadingFiles}
                uploadingText="Fatura dosyaları yükleniyor..."
              />
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
              <CurrencyFields form={form} setForm={setForm} rateStatus={rateStatus} setRateStatus={setRateStatus} manualRateRef={manualRateRef} />
              <TransactionFileUpload
                files={invoiceFiles}
                inputKey={fileInputKey}
                label="Makbuz / Dekont Görseli"
                onChange={setInvoiceFiles}
                uploading={uploadingFiles}
                uploadingText="Makbuz / Dekont dosyaları yükleniyor..."
              />
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
              <CurrencyFields form={form} setForm={setForm} rateStatus={rateStatus} setRateStatus={setRateStatus} manualRateRef={manualRateRef} />
              <TransactionFileUpload
                files={invoiceFiles}
                inputKey={fileInputKey}
                label="İade Faturası / Evrak Görseli"
                onChange={setInvoiceFiles}
                uploading={uploadingFiles}
                uploadingText="İade evrakı dosyaları yükleniyor..."
              />
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
        title={`${documentLabelForType(fileModal.transaction?.type || "invoice")}${fileModal.transaction?.invoice_no ? ` - ${fileModal.transaction.invoice_no}` : ""}`}
        open={fileModal.open}
        onClose={() => setFileModal({ open: false, transaction: null, files: [], loading: false, activeIndex: 0 })}
      >
        {fileModal.loading ? (
          <div className="state-box">Dosyalar yükleniyor...</div>
        ) : fileModal.files.length === 0 ? (
          <div className="state-box empty">Bu hareket için dosya yok.</div>
        ) : (
          <FilePreviewModal
            activeIndex={fileModal.activeIndex}
            deletingFileId={deletingFileId}
            files={fileModal.files}
            onActiveIndexChange={(activeIndex) => setFileModal((current) => ({ ...current, activeIndex }))}
            onRemove={removeFile}
          />
        )}
      </Modal>
      <Modal
        title="Faturayı Sil"
        open={invoiceDeleteModal.open}
        onClose={() => !deletingInvoiceId && setInvoiceDeleteModal({ open: false, transaction: null })}
      >
        <p className="note-text">Bu faturayı silmek istediğine emin misin?</p>
        <div className="confirm-summary">
          <SummaryRow label="Fatura No" value={invoiceDeleteModal.transaction?.invoice_no || "-"} />
          <SummaryRow label="Tarih" value={dateTR(invoiceDeleteModal.transaction?.transaction_date)} />
          <SummaryRow label="TL Karşılığı" value={money(readTRYAmount(invoiceDeleteModal.transaction))} />
        </div>
        <div className="form-actions modal-actions">
          <button className="ghost-button" type="button" disabled={Boolean(deletingInvoiceId)} onClick={() => setInvoiceDeleteModal({ open: false, transaction: null })}>
            Vazgeç
          </button>
          <button className="danger-button" type="button" disabled={Boolean(deletingInvoiceId)} onClick={deleteInvoice}>
            {deletingInvoiceId ? "Siliniyor..." : "Evet, Sil"}
          </button>
        </div>
      </Modal>
      <Modal title="İşlemi Onayla" open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
        <div className="confirm-summary">
          <SummaryRow label="Firma" value={supplier?.name || "-"} />
          <SummaryRow label="İşlem" value={selectedTransactionType.summaryLabel} />
          <SummaryRow label="Tarih" value={dateTR(form.transaction_date)} />
          {form.type === "invoice" && (
            <>
              <SummaryRow label="Fatura No" value={form.invoice_no || "-"} />
              <CurrencySummary form={form} />
              <SummaryRow label="Açıklama" value={form.note || "-"} />
              <SummaryRow label="Eklenecek Dosya Sayısı" value={invoiceFiles.length} />
            </>
          )}
          {form.type === "payment" && (
            <>
              <SummaryRow label="Ödeme Şekli" value={supplierPaymentMethodLabel(form.payment_method)} />
              <CurrencySummary form={form} />
              <SummaryRow label="Açıklama" value={form.note || "-"} />
              <SummaryRow label="Eklenecek Dosya Sayısı" value={invoiceFiles.length} />
            </>
          )}
          {form.type === "return" && (
            <>
              <CurrencySummary form={form} />
              <SummaryRow label="Açıklama" value={form.note || "-"} />
              <SummaryRow label="Eklenecek Dosya Sayısı" value={invoiceFiles.length} />
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

function TransactionFileUpload({ files, inputKey, label, onChange, uploading, uploadingText }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) => ({
      file,
      url: file?.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    setPreviews(urls);
    return () => urls.forEach((item) => item.url && URL.revokeObjectURL(item.url));
  }, [files]);

  const updateFiles = (nextFiles) => {
    onChange(Array.from(nextFiles || []));
  };

  const addDroppedFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    updateFiles([...files, ...Array.from(event.dataTransfer.files || [])]);
  };

  return (
    <div
      className={`span-2 file-upload-box ${dragging ? "dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={addDroppedFiles}
    >
      <label>
        {label}
        <input
          key={`${inputKey}-${label}`}
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => updateFiles(e.target.files)}
        />
      </label>
      <button className="secondary-button fit" type="button" onClick={() => inputRef.current?.click()}>
        Dosya Seç
      </button>
      <div className="file-drop-zone">
        <span>Dosyaları buraya sürükleyip bırakın</span>
      </div>
      {files.length > 0 && (
        <div className="selected-files">
          {files.map((file, index) => {
            const preview = previews[index]?.url;
            return (
              <div className="file-row upload-file-row" key={`${file.name}-${file.size}-${index}`}>
                <span className="file-order">{index + 1}</span>
                <FileThumbnail file={file} src={preview} />
                <strong>{file.name}</strong>
                <small>{formatFileSize(file.size)}</small>
              </div>
            );
          })}
        </div>
      )}
      {uploading && <div className="state-box compact">{uploadingText}</div>}
    </div>
  );
}

function FileThumbnail({ file, src }) {
  if (isPdfFile(file)) {
    return <span className="file-thumbnail pdf">PDF</span>;
  }

  if (src) {
    return <img className="file-thumbnail" src={src} alt={file.name} />;
  }

  return <span className="file-thumbnail image">Resim</span>;
}

function FilePreviewModal({ activeIndex, deletingFileId, files, onActiveIndexChange, onRemove }) {
  const boundedIndex = Math.min(activeIndex, Math.max(files.length - 1, 0));
  const file = files[boundedIndex];
  const fileUrl = resolveFileUrl(file);
  const fileName = readFileName(file);
  const fileId = readFileId(file);
  const hasMultipleFiles = files.length > 1;

  const goPrevious = () => {
    onActiveIndexChange(boundedIndex === 0 ? files.length - 1 : boundedIndex - 1);
  };

  const goNext = () => {
    onActiveIndexChange(boundedIndex === files.length - 1 ? 0 : boundedIndex + 1);
  };

  return (
    <div className="invoice-preview-list">
      <article className="invoice-preview-item">
        <div className="invoice-preview-header">
          <div>
            <span className="file-order">{boundedIndex + 1}</span>
            <strong>{fileName}</strong>
            <small>{formatFileSize(readFileSize(file))}</small>
          </div>
          <button className="danger-button" type="button" disabled={deletingFileId === fileId} onClick={() => onRemove(file)}>
            {deletingFileId === fileId ? "Siliniyor..." : "Sil"}
          </button>
        </div>
        <FilePreviewBody file={file} fileName={fileName} fileUrl={fileUrl} />
        <div className="file-preview-actions">
          {hasMultipleFiles && (
            <>
              <button className="secondary-button" type="button" onClick={goPrevious}>
                Önceki
              </button>
              <button className="secondary-button" type="button" onClick={goNext}>
                Sonraki
              </button>
            </>
          )}
          <a className="file-link" href={fileUrl} target="_blank" rel="noreferrer">
            Büyüt
          </a>
          <a className="file-link" href={fileUrl} target="_blank" rel="noreferrer">
            Yeni Sekmede Aç
          </a>
          <a className="file-link" href={fileUrl} download={fileName}>
            İndir
          </a>
        </div>
        {hasMultipleFiles && (
          <div className="file-preview-strip">
            {files.map((item, index) => (
              <button
                className={`file-strip-item ${index === boundedIndex ? "active" : ""}`}
                key={readFileId(item) || `${readFileName(item)}-${index}`}
                type="button"
                onClick={() => onActiveIndexChange(index)}
              >
                {isPdfFile(item) ? <span>PDF</span> : <InvoiceImagePreview src={resolveFileUrl(item)} alt={readFileName(item)} />}
              </button>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function FilePreviewBody({ file, fileName, fileUrl }) {
  if (isPdfFile(file)) {
    return (
      <a className="pdf-preview-card" href={fileUrl} target="_blank" rel="noreferrer">
        <span>PDF</span>
        <strong>{fileName}</strong>
      </a>
    );
  }

  return <InvoiceImagePreview src={fileUrl} alt={fileName} />;
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function CurrencyFields({ form, setForm, rateStatus, setRateStatus, manualRateRef }) {
  const rate = normalizedRate(form);
  const tlAmount = Number(form.amount || 0) * rate;
  const rateMessage = {
    try: "TRY için kur 1 kabul edilir.",
    loading: "Kur alınıyor...",
    auto: "Kur otomatik alındı.",
    manual: "Manuel kur kullanılıyor.",
    error: "Kur alınamadı, lütfen manuel kur girin.",
  }[rateStatus];

  return (
    <div className="currency-fields span-2">
      <label>
        Para Birimi
        <select
          value={form.currency}
          onChange={(event) =>
            {
              manualRateRef.current = false;
              setForm((current) => ({
                ...current,
                currency: event.target.value,
                exchange_rate: event.target.value === "TRY" ? "1" : "",
              }));
            }
          }
        >
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label>
        Kur
        <input
          type="number"
          min="0"
          step="0.0001"
          disabled={form.currency === "TRY"}
          value={form.currency === "TRY" ? "1" : form.exchange_rate}
          onChange={(event) => {
            setForm((current) => ({ ...current, exchange_rate: event.target.value }));
            if (form.currency !== "TRY") {
              manualRateRef.current = true;
              setRateStatus("manual");
            }
          }}
          required
        />
      </label>
      <label>
        TL Karşılığı
        <input value={money(tlAmount)} readOnly />
      </label>
      <p className={`currency-rate-note ${rateStatus}`}>{rateMessage}</p>
    </div>
  );
}

function CurrencySummary({ form }) {
  const rate = normalizedRate(form);
  return (
    <>
      <SummaryRow label="Orijinal Tutar" value={moneyCurrency(form.amount, form.currency)} />
      <SummaryRow label="Para Birimi" value={form.currency} />
      <SummaryRow label="Kur" value={formatRate(rate)} />
      <SummaryRow label="TL Karşılığı" value={money(Number(form.amount || 0) * rate)} />
    </>
  );
}

function InvoiceImagePreview({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src || src === "#") {
    return <div className="state-box compact invoice-file-error">Fatura dosyası görüntülenemedi</div>;
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

async function attachInvoiceFiles(rows) {
  const rowsWithIds = rows.filter((row) => row.id);
  if (rowsWithIds.length === 0) return rows;

  const fileResults = await Promise.allSettled(
    rowsWithIds.map(async (row) => ({
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
    const existingFiles = asArray(row.files || row.attachments || row.invoice_files || row.receipt_files || row.return_files || row.supplier_transaction_files);
    const files = filesByTransaction.get(String(row.id)) || existingFiles;
    return {
      ...row,
      _files: files,
      _file_count: files.length || row.file_count || row.files_count || row.invoice_file_count || 0,
    };
  });
}

function buildTransactionPayload(form, supplierId) {
  const rate = normalizedRate(form);
  const originalAmount = Number(form.amount || 0);
  const base = {
    supplier_id: Number(supplierId),
    transaction_date: form.transaction_date,
    type: form.type,
    amount: originalAmount * rate,
    amount_original: originalAmount,
    currency: form.currency,
    exchange_rate: rate,
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

function documentLabelForType(type) {
  if (type === "payment") return "Makbuz / Dekont Görseli";
  if (type === "return") return "İade Faturası / Evrak Görseli";
  return "Fatura Görselleri / PDF";
}

function fileViewButtonLabel(row) {
  if (row?.type === "payment") return "Makbuz / Dekont";
  if (row?.type === "return") return "İade Evrakı";
  return "Faturayı Gör";
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

function readCurrency(row) {
  const currency = String(row?.currency ?? row?.currency_code ?? "TRY").toUpperCase();
  return ["TRY", "USD", "EUR"].includes(currency) ? currency : "TRY";
}

function readOriginalAmount(row) {
  const value = row?.amount_original ?? row?.original_amount ?? row?.foreign_amount;
  return value ?? row?.amount ?? 0;
}

function readExchangeRateFromRow(row) {
  const currency = readCurrency(row);
  if (currency === "TRY") return 1;
  return Number(row?.exchange_rate ?? row?.rate ?? 0);
}

function readTRYAmount(row) {
  const explicit = row?.amount_try ?? row?.tl_amount ?? row?.amount_tl;
  if (explicit !== undefined && explicit !== null) return Number(explicit);
  return Number(readOriginalAmount(row)) * readExchangeRateFromRow(row);
}

function normalizedRate(form) {
  if (form.currency === "TRY") return 1;
  return Number(form.exchange_rate || 0);
}

function readExchangeRate(response) {
  return Number(
    response?.data?.rate_to_try ??
      response?.rate_to_try ??
      response?.data?.exchange_rate ??
      response?.exchange_rate ??
      response?.rate ??
      response?.value ??
      response?.selling_rate ??
      response?.buying_rate ??
      0,
  );
}

function formatRate(value) {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value || 0));
}

function readFileName(file) {
  return file?.file_name || file?.filename || file?.name || file?.original_name || "Dosya";
}

function readFileSize(file) {
  return Number(file?.file_size ?? file?.size ?? 0);
}

function readFileCount(row) {
  return (
    asArray(row?._files).length ||
    row?.file_count ||
    row?.files_count ||
    row?.invoice_file_count ||
    row?.receipt_file_count ||
    row?.return_file_count ||
    row?.attachment_count ||
    row?.attachments_count ||
    0
  );
}

function readFilePath(file) {
  return file?.file_url || file?.url || file?.download_url || file?.path || file?.file_path || "";
}

function resolveFileUrl(file) {
  const path = readFilePath(file);
  if (!path) return "#";
  return path.startsWith("http") ? path : `${window.location.origin}${path}`;
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
