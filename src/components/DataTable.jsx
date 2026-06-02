export default function DataTable({ columns, rows, loading, emptyText = "Kayıt bulunamadı." }) {
  if (loading) {
    return <div className="state-box">Yükleniyor...</div>;
  }

  if (!rows.length) {
    return <div className="state-box empty">{emptyText}</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === "right" ? "right" : ""}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.key || index}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === "right" ? "right" : ""}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
