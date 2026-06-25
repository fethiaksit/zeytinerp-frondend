import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import SupplierDetail from "./pages/SupplierDetail.jsx";
import Employees from "./pages/Employees.jsx";
import EmployeeDetail from "./pages/EmployeeDetail.jsx";
import DailyCash from "./pages/DailyCash.jsx";
import FinancialDebtDetail from "./pages/FinancialDebtDetail.jsx";
import FinancialDebts from "./pages/FinancialDebts.jsx";
import FinancialAlerts from "./pages/FinancialAlerts.jsx";
import DebtReport from "./pages/DebtReport.jsx";
import MoneyAnalysis from "./pages/MoneyAnalysis.jsx";
import FinanceCenter from "./pages/FinanceCenter.jsx";
import Expenses from "./pages/Expenses.jsx";
import IncomeEntries from "./pages/IncomeEntries.jsx";
import Login from "./pages/Login.jsx";
import Reports from "./pages/Reports.jsx";
import BankWallet from "./pages/BankWallet.jsx";
import Wallet from "./pages/Wallet.jsx";
const routes = [
  { path: "/", title: "Dashboard", component: Dashboard },
  { path: "/cuzdan", title: "Cüzdan", component: Wallet },
  { path: "/firmalar", title: "Firmalar", component: Suppliers },
  { path: "/personel", title: "Personel", component: Employees },
  { path: "/gunluk-kasa", title: "Günlük Kasa", component: DailyCash },
  { path: "/banka-cuzdani", title: "Banka Cüzdanı", component: BankWallet },
  { path: "/finans-borclari", title: "Finans Borçları", component: FinancialDebts },
  { path: "/finans-uyarilari", title: "Finans Uyarıları", component: FinancialAlerts },
  { path: "/finans-merkezi", title: "Finans Merkezi", component: FinanceCenter },
  { path: "/borc-raporu", title: "Borç Raporu", component: DebtReport },
  { path: "/para-analizi", title: "Para Analizi", component: MoneyAnalysis },
  { path: "/giderler", title: "Giderler", component: Expenses },
  { path: "/gelirler", title: "Gelirler", component: IncomeEntries },
  { path: "/raporlar", title: "Raporlar", component: Reports },
];

function readToken() {
  return localStorage.getItem("zeytinerp_token");
}

function getInitialPathname() {
  const pathname = window.location.pathname;
  if (pathname !== "/login" && !readToken()) {
    window.history.replaceState({}, "", "/login");
    return "/login";
  }
  return pathname;
}

function getRoute(pathname) {
  const supplierMatch = pathname.match(/^\/firmalar\/([^/]+)$/);
  if (supplierMatch) {
    return { title: "Firma Detay", component: SupplierDetail, params: { id: supplierMatch[1] } };
  }

  const employeeMatch = pathname.match(/^\/personel\/([^/]+)$/);
  if (employeeMatch) {
    return { title: "Personel Detay", component: EmployeeDetail, params: { id: employeeMatch[1] } };
  }

  const financialDebtMatch = pathname.match(/^\/finans-borclari\/([^/]+)$/);
  if (financialDebtMatch) {
    return { title: "Finans Borcu Detay", component: FinancialDebtDetail, params: { id: financialDebtMatch[1] } };
  }

  return routes.find((route) => route.path === pathname) || routes[0];
}

export default function App() {
  const [pathname, setPathname] = useState(getInitialPathname);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleRoute = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const isLoginPage = pathname === "/login";
  const token = readToken();
  const route = useMemo(() => getRoute(pathname), [pathname]);
  const Page = route.component;

  useEffect(() => {
    if (!token && !isLoginPage) {
      window.history.replaceState({}, "", "/login");
      setPathname("/login");
    }
  }, [isLoginPage, token]);

  const notify = (message, type = "error") => {
    setToast({ message, type });
  };

  return (
    <>
      {isLoginPage ? (
        <Login />
      ) : !token ? (
        <Login />
      ) : (
        <ProtectedRoute>
          <Layout activePath={pathname} title={route.title}>
            <Page params={route.params || {}} notify={notify} />
          </Layout>
        </ProtectedRoute>
      )}
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}
