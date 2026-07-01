import Modal from "./Modal.jsx";
import { categoryLabel, money } from "../utils/format.js";

export default function ExpenseDetailModal({ detail, onClose, onRetry }) {
  const total = detail.rows.reduce((sum, row) => sum + expenseAmount(row), 0);

  return (
    <Modal
      title="Bugünkü Giderler"
      open={Boolean(detail.date)}
      onClose={onClose}
      cardClassName="expense-detail-modal"
    >
      {detail.loading ? (
        <div className="expense-detail-state" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Giderler yükleniyor...</span>
        </div>
      ) : detail.error ? (
        <div className="expense-detail-state error" role="alert">
          <strong>Gider bilgileri alınamadı.</strong>
          <span>{detail.error}</span>
          <button className="secondary-button" type="button" onClick={onRetry}>
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          {detail.rows.length === 0 ? (
            <div className="expense-detail-state empty">Bugün gider kaydı bulunamadı.</div>
          ) : (
            <ExpenseRows rows={detail.rows} />
          )}
          <div className="expense-detail-total">
            <span>Toplam Gider</span>
            <strong>{money(total)}</strong>
          </div>
        </>
      )}
    </Modal>
  );
}

function ExpenseRows({ rows }) {
  return (
    <>
      <div className="expense-detail-table-wrap">
        <table className="expense-detail-table">
          <thead>
            <tr>
              <th>Saat</th>
              <th>Kategori</th>
              <th>Ödeme Türü</th>
              <th className="right">Tutar</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={expenseKey(row, index)}>
                <td>{expenseTime(row)}</td>
                <td><CategoryBadge value={row.category ?? row.category_name} /></td>
                <td><PaymentBadge value={row.payment_method ?? row.payment_type} /></td>
                <td className="right amount-text danger">{money(expenseAmount(row))}</td>
                <td className="expense-description">{expenseDescription(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="expense-detail-cards">
        {rows.map((row, index) => (
          <article className="expense-detail-card" key={expenseKey(row, index)}>
            <div className="expense-detail-card-head">
              <CategoryBadge value={row.category ?? row.category_name} />
              <strong>{money(expenseAmount(row))}</strong>
            </div>
            <dl>
              <div><dt>Saat</dt><dd>{expenseTime(row)}</dd></div>
              <div><dt>Ödeme Türü</dt><dd><PaymentBadge value={row.payment_method ?? row.payment_type} /></dd></div>
              <div><dt>Açıklama</dt><dd>{expenseDescription(row)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function CategoryBadge({ value }) {
  const tones = {
    kira: "warning",
    elektrik: "orange",
    su: "info",
    personel: "success",
    yakit: "danger",
    yemek: "orange",
    market_gideri: "success",
    diger: "muted",
  };
  return <span className={`badge ${tones[value] || "info"}`}>{categoryLabel(value)}</span>;
}

function PaymentBadge({ value }) {
  const normalized = String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/[\s/-]+/g, "_");
  const labels = {
    cash: "Nakit",
    nakit: "Nakit",
    bank: "Banka",
    banka: "Banka",
    bank_transfer: "Banka",
    havale_eft: "Havale/EFT",
    credit_card: "Kredi Kartı",
    kredi_kartı: "Kredi Kartı",
    kredi_karti: "Kredi Kartı",
  };
  const tones = {
    cash: "success",
    nakit: "success",
    bank: "info",
    banka: "info",
    bank_transfer: "info",
    havale_eft: "info",
    credit_card: "warning",
    kredi_kartı: "warning",
    kredi_karti: "warning",
  };
  return <span className={`badge ${tones[normalized] || "muted"}`}>{labels[normalized] || value || "-"}</span>;
}

function expenseKey(row, index) {
  return row.id || `${expenseDateTime(row)}-${index}`;
}

function expenseAmount(row) {
  const amount = Number(row?.amount ?? row?.expense_amount ?? row?.total_amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function expenseDateTime(row) {
  return row?.created_at ?? row?.expense_datetime ?? row?.expense_date ?? row?.date ?? "";
}

function expenseTime(row) {
  const explicitTime = String(row?.expense_time ?? row?.time ?? "");
  const explicitMatch = explicitTime.match(/(?:^|T|\s)(\d{2}):(\d{2})/);
  if (explicitMatch) return `${explicitMatch[1]}:${explicitMatch[2]}`;

  const value = expenseDateTime(row);
  if (!/[T\s]\d{2}:\d{2}/.test(String(value))) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const match = String(value).match(/[T\s](\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "-";
  }
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
}

function expenseDescription(row) {
  return row?.note || row?.description || row?.title || "-";
}
