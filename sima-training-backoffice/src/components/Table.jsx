export default function Table({ columns, data, actions }) {
  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-widest text-[10px] whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
            {actions && (
              <th className="text-right px-4 py-3 text-slate-500 font-semibold uppercase tracking-widest text-[10px]">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-200/70 hover:bg-slate-50 transition-colors duration-100"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
              {actions && (
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {actions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="px-4 py-10 text-center text-slate-400 text-[11px] font-mono uppercase tracking-widest"
              >
                — Sin registros —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
