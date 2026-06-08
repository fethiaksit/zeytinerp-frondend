import { useEffect, useState } from "react";
import { bankWallet, getErrorMessage } from "../services/api.js";
import { money } from "../utils/format.js";
import { navigate } from "../utils/router.js";

export default function Dashboard({ notify }) {
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const summary = await bankWallet.summary().catch(() => ({}));
        setWalletBalance(readWalletBalance(summary));
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
        <strong>{loading ? "Yükleniyor..." : money(walletBalance)}</strong>
      </button>
    </div>
  );
}

function readWalletBalance(summary) {
  return Number(summary?.total_bank_balance ?? summary?.total_balance ?? summary?.balance ?? 0);
}
