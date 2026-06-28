export function withDateRangeQuery(endpoint, params = {}) {
  const searchParams = new URLSearchParams();
  const startValue = String(params.start_date ?? "").trim();
  const endValue = String(params.end_date ?? "").trim();

  if (startValue) searchParams.set("start_date", startValue);
  if (endValue) searchParams.set("end_date", endValue);

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
