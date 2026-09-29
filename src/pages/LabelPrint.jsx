import { useEffect, useMemo, useState } from "react";
import { getErrorMessage, productsApi } from "../services/api.js";

const money = (value) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0));
const productName = (p) => p?.name || p?.product_name || p?.title || "Ürün";
const barcodeOf = (p) => p?.barcode || p?.barcode_number || p?.ean || p?.code || "";
const priceOf = (p) => p?.sale_price ?? p?.selling_price ?? p?.price ?? p?.retail_price ?? 0;

export default function LabelPrint({ notify }) {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("50x30");

  useEffect(() => {
    productsApi.list()
      .then((rows) => setProducts(Array.isArray(rows) ? rows : []))
      .catch((error) => notify?.(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [notify]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return products.slice(0, 100);
    return products.filter((p) =>
      [productName(p), barcodeOf(p)].some((v) => String(v || "").toLocaleLowerCase("tr-TR").includes(q))
    ).slice(0, 100);
  }, [products, query]);

  const selectedProducts = useMemo(() =>
    products.filter((p) => Number(selected[p.id] || 0) > 0), [products, selected]);

  const setCount = (id, count) => {
    const next = Math.max(0, Math.min(99, Number(count) || 0));
    setSelected((prev) => ({ ...prev, [id]: next }));
  };

  const printLabels = () => {
    if (!selectedProducts.length) {
      notify?.("Yazdırmak için en az bir ürün seçin.");
      return;
    }
    window.print();
  };

  return (
    <div className="page-stack label-print-page">
      <section className="panel no-print">
        <div className="panel-header">
          <div>
            <h2>Zebra Ürün Etiketi</h2>
            <p>Ürünü bul, etiket adedini seç ve Zebra yazıcıdan bas.</p>
          </div>
          <button className="primary-button" type="button" onClick={printLabels}>
            🖨 {selectedProducts.length ? `${selectedProducts.length} ürün yazdır` : "Etiket Yazdır"}
          </button>
        </div>
        <div className="filter-row">
          <input
            className="search-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ürün adı veya barkod ara..."
            autoFocus
          />
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="50x30">50 × 30 mm</option>
            <option value="40x30">40 × 30 mm</option>
            <option value="50x40">50 × 40 mm</option>
          </select>
          <button className="ghost-button" type="button" onClick={() => setSelected({})}>Seçimi Temizle</button>
        </div>
        {loading ? <p>Ürünler yükleniyor...</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ürün</th><th>Barkod</th><th>Fiyat</th><th>Etiket Adedi</th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{productName(p)}</strong></td>
                    <td>{barcodeOf(p) || "—"}</td>
                    <td>{money(priceOf(p))}</td>
                    <td>
                      <div className="label-count">
                        <button type="button" onClick={() => setCount(p.id, (selected[p.id] || 0) - 1)}>−</button>
                        <input type="number" min="0" max="99" value={selected[p.id] || 0} onChange={(e) => setCount(p.id, e.target.value)} />
                        <button type="button" onClick={() => setCount(p.id, (selected[p.id] || 0) + 1)}>+</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="4">Ürün bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`label-sheet label-size-${size}`}>
        {selectedProducts.flatMap((p) =>
          Array.from({ length: Number(selected[p.id] || 0) }, (_, i) => (
            <article className="product-label" key={`${p.id}-${i}`}>
              <div className="label-name">{productName(p)}</div>
              <div className="label-price">{money(priceOf(p))}</div>
              <div className="label-barcode-number">{barcodeOf(p) || "BARKOD YOK"}</div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
