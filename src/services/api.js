import axios from "axios";
import { clearAuth, getToken } from "../utils/auth.js";
import { navigate } from "../utils/router.js";

const configuredBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api";

function normalizeApiBaseUrl(url) {
  const trimmed = String(url || "").replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
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

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
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
      if (window.location.pathname !== "/login") navigate("/login");
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
    "income_entries",
    "products",
    "stock_movements",
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
    ? "Backend bağlantısı kurulamadı. Go API'nin http://localhost:8081/api adresinde çalıştığını kontrol edin."
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
  login: (payload) => api.post("/auth/login", payload).then(dataOf),
};

export const dashboardApi = {
  summary: () => api.get("/dashboard").then(dataOf),
  monthly: (params) => api.get("/dashboard/monthly", { params }).then(dataOf),
};

export const suppliersApi = {
  list: () => api.get("/suppliers").then(dataOf),
  listWithBalances: async () => {
    const [rows, balances] = await Promise.all([suppliersApi.list(), suppliersApi.balances()]);
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
  list: (params = {}) => api.get("/expenses", { params }).then(dataOf),
  create: (payload) => api.post("/expenses", payload).then(dataOf),
  update: (id, payload) => api.put(`/expenses/${id}`, payload).then(dataOf),
  remove: (id) => api.delete(`/expenses/${id}`).then(dataOf),
};

export const incomeApi = {
  list: (params = {}) => api.get("/income-entries", { params }).then(dataOf),
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
