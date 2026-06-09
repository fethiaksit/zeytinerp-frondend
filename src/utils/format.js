export const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export const dateTR = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
};

export const dateTimeTR = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthStartISO = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

export const categoryLabel = (value) =>
  ({
    kira: "Kira",
    elektrik: "Elektrik",
    su: "Su",
    personel: "Personel",
    yakit: "Yakıt",
    yemek: "Yemek",
    market_gideri: "Market Gideri",
    diger: "Diğer",
    market_satis: "Market Satış",
    tup_satis: "Tüp Satış",
    veresiye_tahsilat: "Veresiye Tahsilat",
  })[value] || value || "-";

export const supplierTransactionLabel = (value) =>
  ({
    purchase: "Gelen Fatura",
    invoice: "Gelen Fatura",
    payment: "Ödeme",
    return: "İade / Fatura Düşümü",
  })[value] || value || "-";

export const supplierPaymentMethodLabel = (value) =>
  ({
    cash: "Nakit",
    credit_card: "Kredi Kartı",
    current_account: "Cari",
    bank_transfer: "Havale/EFT",
    other: "Diğer",
  })[value] || value || "-";

export const supplierTransactionTone = (value) => (value === "payment" || value === "return" ? "success" : "danger");

export const employeeTransactionLabel = (value) =>
  ({
    work: "Çalışma",
    payment: "Maaş Ödemesi",
    advance: "Avans",
  })[value] || value || "-";

export const financialDebtTypeLabel = (value) =>
  ({
    bank_loan: "Banka Kredisi",
    credit_card: "Kredi Kartı",
    installment_debt: "Taksitli Borç",
    other: "Diğer",
  })[value] || value || "-";

export const financialDebtStatusLabel = (value) =>
  ({
    active: "Aktif",
    closed: "Kapalı",
  })[value] || value || "-";

export const financialPaymentMethodLabel = (value) =>
  ({
    cash: "Nakit",
    bank_transfer: "Havale/EFT",
    credit_card: "Kart",
    other: "Diğer",
  })[value] || value || "-";

export const bankTransactionTypeLabel = (value) =>
  ({
    cash_deposit: "Nakit Yatırma",
    pos_income: "POS Yatışı",
    bank_income: "Banka Geliri",
    payment: "Ödeme",
    expense: "Gider",
    transfer_in: "Transfer Girişi",
    transfer_out: "Transfer Çıkışı",
    correction: "Düzeltme",
  })[value] || value || "-";

export const walletTransactionTypeLabel = (value) =>
  ({
    opening_balance: "Açılış Bakiyesi",
    cash_income: "Kasaya Para Girişi",
    cash_sale: "Nakit Satış",
    cash_expense: "Nakit Gider",
    cash_payment: "Kasadan Ödeme",
    cash_withdraw: "Kasadan Çıkış",
    cash_deposit: "Kasaya Para Yatırma",
    correction: "Düzeltme",
  })[value] || value || "-";

export const cashTotal = (row) =>
  Number(row?.cash_amount || 0) + Number(row?.pos_amount || 0) + Number(row?.qr_amount || 0);

export const asNumber = (value) => Number(value || 0);

export const readFinancialTotal = (row) =>
  asNumber(row?.total_debt ?? row?.total_amount ?? row?.principal_amount ?? row?.amount);

export const readFinancialPaid = (row) => asNumber(row?.paid_total ?? row?.total_paid ?? row?.paid_amount);

export const readFinancialRemaining = (row) => {
  const explicit = row?.remaining_debt ?? row?.remaining_amount ?? row?.balance;
  if (explicit !== undefined && explicit !== null) return asNumber(explicit);
  return Math.max(0, readFinancialTotal(row) - readFinancialPaid(row));
};

export const readFinancialDueDate = (row) => row?.due_date ?? row?.last_payment_date ?? row?.end_date ?? row?.payment_due_date;

export const readFinancialEndDate = (row) => row?.end_date ?? row?.due_date ?? row?.last_payment_date ?? row?.payment_due_date;

export const readInstallmentAmount = (row) => asNumber(row?.amount ?? row?.installment_amount ?? row?.total_amount);

export const readInstallmentPaid = (row) => asNumber(row?.paid_amount ?? row?.paid_total ?? row?.total_paid);

export const readInstallmentRemaining = (row) => {
  const explicit = row?.remaining_amount ?? row?.remaining_debt ?? row?.balance;
  if (explicit !== undefined && explicit !== null) return asNumber(explicit);
  return Math.max(0, readInstallmentAmount(row) - readInstallmentPaid(row));
};

export const installmentStatusLabel = (value) =>
  ({
    unpaid: "Ödenmedi",
    partial: "Kısmi",
    paid: "Ödendi",
    overdue: "Gecikmiş",
    pending: "Bekliyor",
  })[value] || value || "-";
