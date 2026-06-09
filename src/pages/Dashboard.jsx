import { useEffect, useState } from "react";
import { getErrorMessage, walletApi } from "../services/api.js";
import { money } from "../utils/format.js";
import { navigate } from "../utils/router.js";

export default function Dashboard({ notify }) {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const walletSummary = await walletApi.summary();
        setSummary(walletSummary || {});
      } catch (error) {
        notify(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="dashboard-wallet-only">
      <button className="wallet-card-button" type="button" onClick={() => navigate("/cuzdan")}>
        <span>💵 Cüzdan</span>
        <strong>{loading ? "Yükleniyor..." : money(readWalletBalance(summary))}</strong>
      </button>
    </div>
  );
}

function readWalletBalance(summary) {
  return Number(summary?.current_balance ?? summary?.balance ?? summary?.total_balance ?? 0);
}
