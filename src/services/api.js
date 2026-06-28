import axios from "axios";
import { clearAuth, getToken } from "../utils/auth.js";
import { withDateRangeQuery } from "../utils/apiParams.js";

const configuredBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://zeytinerp.herevemarket.com/api";

function normalizeApiBaseUrl(url) {
  const trimmed = String(url || "").replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function requestUrl(endpoint) {
  const baseUrl = String(api.defaults.baseURL || "").replace(/\/+$/, "");
  const path = String(endpoint || "").startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
}

export const api = axios.create({
  baseURL: normalizeApiBaseUrl(configuredBaseUrl),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const method = (config.method || "GET").toUpperCase();
  const endpoint = config.url || "";
  const url = `${config.baseURL || ""}${config.url || ""}`;
  const token = getToken();
  const isPublicRequest = endpoint === "/auth/login" || endpoint === "../health";

  if (!token && !isPublicRequest) {
    if (window.location.pathname !== "/login") window.location.href = "/login";
    return Promise.reject(new Error("Oturum gerekli"));
  }

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
      config.headers.delete("content-type");
    } else {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
  }

  console.log("API URL:", import.meta.env.VITE_API_URL);
  console.log("Request endpoint:", endpoint);
  console.log("API Request:", method, url, config.data);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuth();
      sessionStorage.setItem("zeytinerp_auth_message", "Oturum süresi doldu. Lütfen tekrar giriş yapın.");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

function dataOf(response) {
  const body = response.data;
  if (body == null) return [];
  const knownKeys = [
    "data",
    "items",
    "results",
    "dashboard",
    "report",
    "supplier",
    "employee",
    "product",
    "daily_cash_report",
    "cash_report",
    "expense",
    "income_entry",
    "transaction",
    "transactions",
    "file",
    "files",
    "supplier_transaction_file",
    "supplier_transaction_files",
    "financial_debt",
    "financial_debts",
    "financial_debt_payment",
    "financial_debt_payments",
    "financial_installment",
    "financial_installments",
    "installment",
    "installments",
    "financial_alerts",
    "alerts",
    "suppliers",
    "supplier_balances",
    "balances",
    "employees",
    "employee_balances",
    "daily_cash_reports",
    "cash_reports",
    "expenses",
    "incomes",
    "income_entries",
    "products",
    "stock_movements",
    "bank_account",
    "bank_accounts",
    "bank_transaction",
    "bank_transactions",
    "bank_wallet",
    "bank_summary",
    "wallet",
    "wallet_summary",
    "wallet_transaction",
    "wallet_transactions",
    "summary",
    "daily_summary",
    "monthly_summary",
  ];
  const key = knownKeys.find((item) => body[item] !== undefined);
  return key ? body[key] : body;
}
const asArray = (value) => (Array.isArray(value) ? value : []);
const readId = (row, fallbackKey) => row?.id ?? row?.[fallbackKey];
const readBalance = (row) => row?.balance ?? row?.current_debt ?? row?.debt ?? row?.salary_debt ?? row?.amount ?? 0;

function mergeBalances(rows, balances, fallbackKey) {
  const balanceMap = new Map(asArray(balances).map((row) => [String(readId(row, fallbackKey)), readBalance(row)]));
  return asArray(rows).map((row) => ({
    ...row,
    current_debt: balanceMap.has(String(row.id)) ? balanceMap.get(String(row.id)) : row.current_debt ?? row.balance ?? row.debt,
  }));
}

export const getErrorMessage = (error) =>
  error?.code === "ERR_NETWORK"
    ? `Backend bağlantısı kurulamadı. API adresini kontrol edin: ${api.defaults.baseURL}`
    : (typeof error?.response?.data === "string" ? error.response.data : null) ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      "İşlem sırasında bir hata oluştu.";

export const healthApi = {
  check: () => api.get("../health").then(dataOf),
};

export const authApi = {
  login: (payload) => {
    console.log("Login request URL:", requestUrl("/auth/login"));
    return api.post("/auth/login", payload).then(dataOf);
  },
};

export const dashboardApi = {
  summary: () => api.get("/dashboard").then(dataOf),
  monthly: (params) => api.get("/dashboard/monthly", { params }).then(dataOf),
};

export const suppliersApi = {
  list: (params = {}) => api.get("/suppliers", { params }).then(dataOf),
  listWithBalances: async (params = {}) => {
    const [rows, balances] = await Promise.all([suppliersApi.list(params), suppliersApi.balances()]);
    return mergeBalances(rows, balances, "supplier_id");
  },
  get: (id) => api.get(`/suppliers/${id}`).then(dataOf),
  create: (payload) => api.post("/suppliers", payload).then(dataOf),
  update: (id, payload) => api.put(`/suppliers/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/suppliers/${id}`).then(dataOf),
  balance: (id) => api.get(`/suppliers/${id}/balance`).then(dataOf),
  balances: () => api.get("/suppliers-balances").then(dataOf),
};

export const supplierTransactionsApi = {
  list: (params = {}) => api.get("/supplier-transactions", { params }).then(dataOf),
  create: (payload) => api.post("/supplier-transactions", payload).then(dataOf),
  remove: (id) => api.delete(`/supplier-transactions/${id}`).then(dataOf),
};

export const exchangeRates = {
  latest: (currency) => api.get("/exchange-rates/latest", { params: { currency } }),
};

export const supplierTransactionFiles = {
  list: (transactionId) => api.get(`/supplier-transactions/${transactionId}/files`).then(dataOf),
  upload: (transactionId, files) => {
    const formData = new FormData();
    Array.from(files || []).forEach((file) => formData.append("files", file));
    return api.post(`/supplier-transactions/${transactionId}/files`, formData).then(dataOf);
  },
  remove: (fileId) => api.delete(`/supplier-transaction-files/${fileId}`).then(dataOf),
};

export const supplierTransactionFilesApi = supplierTransactionFiles;

export const employeesApi = {
  list: () => api.get("/employees").then(dataOf),
  listWithBalances: async () => {
    const [rows, balances] = await Promise.all([employeesApi.list(), employeesApi.balances()]);
    return mergeBalances(rows, balances, "employee_id");
  },
  get: (id) => api.get(`/employees/${id}`).then(dataOf),
  create: (payload) => api.post("/employees", payload).then(dataOf),
  update: (id, payload) => api.put(`/employees/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/employees/${id}`).then(dataOf),
  balance: (id) => api.get(`/employees/${id}/balance`).then(dataOf),
  balances: () => api.get("/employees-balances").then(dataOf),
};

export const employeeTransactionsApi = {
  list: (params = {}) => api.get("/employee-transactions", { params }).then(dataOf),
  create: (payload) => api.post("/employee-transactions", payload).then(dataOf),
  remove: (id) => api.delete(`/employee-transactions/${id}`).then(dataOf),
};

export const dailyCashApi = {
  list: () => api.get("/cash-reports").then(dataOf),
  get: (id) => api.get(`/cash-reports/${id}`).then(dataOf),
  create: (payload) => api.post("/cash-reports", payload).then(dataOf),
  update: (id, payload) => api.put(`/cash-reports/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/cash-reports/${id}`).then(dataOf),
};

export const expensesApi = {
  list: (params = {}) => api.get(withDateRangeQuery("/expenses", params)).then(dataOf),
  create: (payload) => api.post("/expenses", payload).then(dataOf),
  update: (id, payload) => api.put(`/expenses/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/expenses/${id}`).then(dataOf),
};

export const incomeApi = {
  list: (params = {}) => api.get(withDateRangeQuery("/income-entries", params)).then(dataOf),
  create: (payload) => api.post("/income-entries", payload).then(dataOf),
  update: (id, payload) => api.put(`/income-entries/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/income-entries/${id}`).then(dataOf),
};

export const productsApi = {
  list: () => api.get("/products").then(dataOf),
  get: (id) => api.get(`/products/${id}`).then(dataOf),
  create: (payload) => api.post("/products", payload).then(dataOf),
  update: (id, payload) => api.put(`/products/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/products/${id}`).then(dataOf),
  stock: (id) => api.get(`/products/${id}/stock`).then(dataOf),
};

export const stockMovementsApi = {
  list: () => api.get("/stock-movements").then(dataOf),
  create: (payload) => api.post("/stock-movements", payload).then(dataOf),
};

export const bankAccounts = {
  list: () => api.get("/bank-accounts").then(dataOf),
  create: (data) => api.post("/bank-accounts", data).then(dataOf),
  get: (id) => api.get(`/bank-accounts/${id}`).then(dataOf),
  update: (id, data) => api.put(`/bank-accounts/${id}`, data).then(dataOf),
  remove: (id) => api.delete(`/bank-accounts/${id}`).then(dataOf),
};

export const bankTransactions = {
  list: async (accountId) => {
    try {
      return await api.get(`/bank-accounts/${accountId}/transactions`).then(dataOf);
    } catch (error) {
      if (error?.response?.status === 404) return api.get("/bank-transactions", { params: { account_id: accountId } }).then(dataOf);
      throw error;
    }
  },
  create: async (accountId, data) => {
    try {
      return await api.post(`/bank-accounts/${accountId}/transactions`, data).then(dataOf);
    } catch (error) {
      if (error?.response?.status === 404) return api.post("/bank-transactions", { ...data, bank_account_id: Number(accountId) }).then(dataOf);
      throw error;
    }
  },
  remove: (transactionId) => api.delete(`/bank-transactions/${transactionId}`).then(dataOf),
};

export const bankWallet = {
  summary: () => api.get("/bank-wallet/summary").then(dataOf),
  dailySummary: (date) => api.get("/bank-wallet/daily-summary", { params: { date } }).then(dataOf),
  monthlySummary: (month) => api.get("/bank-wallet/monthly-summary", { params: { month } }).then(dataOf),
};

export const wallet = {
  summary: () => api.get("/wallet/summary").then(dataOf),
  transactions: () => api.get("/wallet/transactions").then(dataOf),
  createTransaction: (payload) => api.post("/wallet/transactions", payload).then(dataOf),
  deleteTransaction: (id) => api.delete(`/wallet/transactions/${id}`).then(dataOf),
};

export const walletApi = {
  ...wallet,
  removeTransaction: wallet.deleteTransaction,
};

export const debtSnapshot = {
  get: (date) => api.get("/debt-snapshot", { params: { date } }).then(dataOf),
};

export const moneyAnalysis = {
  get: (month) => api.get("/money-analysis", { params: { month } }).then(dataOf),
};

export const financialDebtsApi = {
  list: () => api.get("/financial-debts").then(dataOf),
  get: (id) => api.get(`/financial-debts/${id}`).then(dataOf),
  create: (payload) => api.post("/financial-debts", payload).then(dataOf),
  update: (id, payload) => api.put(`/financial-debts/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/financial-debts/${id}`).then(dataOf),
  summary: (id) => api.get(`/financial-debts/${id}/summary`).then(dataOf),
  installments: (id) => api.get(`/financial-debts/${id}/installments`).then(dataOf),
  addInstallment: (id, payload) => api.post(`/financial-debts/${id}/installments`, payload).then(dataOf),
  addInstallmentsBulk: (id, payload) => api.post(`/financial-debts/${id}/installments/bulk`, payload).then(dataOf),
};

export const financialInstallmentsApi = {
  update: (id, payload) => api.put(`/financial-installments/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/financial-installments/${id}`).then(dataOf),
};

export const financialDebtPaymentsApi = {
  list: (params = {}) => api.get("/financial-debt-payments", { params }).then(dataOf),
  create: (payload) => api.post("/financial-debt-payments", payload).then(dataOf),
  remove: (id) => api.delete(`/financial-debt-payments/${id}`).then(dataOf),
};

export const financialAlertsApi = {
  list: () => api.get("/financial-alerts").then(dataOf),
};

export const reportsApi = {
  monthly: async (params) => {
    try {
      return await api.get("/reports", { params }).then(dataOf);
    } catch (error) {
      if (error?.response?.status === 404) return dashboardApi.summary();
      throw error;
    }
  },
};
