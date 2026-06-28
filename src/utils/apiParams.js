export function withDateRangeQuery(endpoint, params = {}) {
  const searchParams = new URLSearchParams();
  const startValue = String(params.start_date ?? "").trim();
  const endValue = String(params.end_date ?? "").trim();

  if (!startValue || !endValue) {
    throw new Error("start_date ve end_date parametreleri zorunludur.");
  }

  searchParams.set("start_date", startValue);
  searchParams.set("end_date", endValue);

  Object.entries(params).forEach(([key, value]) => {
    if (key === "start_date" || key === "end_date") return;
    if (value === "" || value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}
