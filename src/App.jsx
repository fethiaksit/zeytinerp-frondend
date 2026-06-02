import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import SupplierDetail from "./pages/SupplierDetail.jsx";
import Employees from "./pages/Employees.jsx";
import EmployeeDetail from "./pages/EmployeeDetail.jsx";
import DailyCash from "./pages/DailyCash.jsx";
import FinancialDebtDetail from "./pages/FinancialDebtDetail.jsx";
import FinancialDebts from "./pages/FinancialDebts.jsx";
import FinancialAlerts from "./pages/FinancialAlerts.jsx";
import Expenses from "./pages/Expenses.jsx";
import IncomeEntries from "./pages/IncomeEntries.jsx";
import Reports from "./pages/Reports.jsx";
const routes = [
  { path: "/", title: "Dashboard", component: Dashboard },
  { path: "/firmalar", title: "Firmalar", component: Suppliers },
  { path: "/personel", title: "Personel", component: Employees },
  { path: "/gunluk-kasa", title: "Günlük Kasa", component: DailyCash },
  { path: "/finans-borclari", title: "Finans Borçları", component: FinancialDebts },
  { path: "/finans-uyarilari", title: "Finans Uyarıları", component: FinancialAlerts },
  { path: "/giderler", title: "Giderler", component: Expenses },
  { path: "/gelirler", title: "Gelirler", component: IncomeEntries },
  { path: "/raporlar", title: "Raporlar", component: Reports },
];

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
  const [pathname, setPathname] = useState(window.location.pathname);
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

  const route = useMemo(() => getRoute(pathname), [pathname]);
  const Page = route.component;

  const notify = (message, type = "error") => {
    setToast({ message, type });
  };

  return (
    <>
      <Layout activePath={pathname} title={route.title}>
        <Page params={route.params || {}} notify={notify} />
      </Layout>
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}
