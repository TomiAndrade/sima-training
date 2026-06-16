export default function Table({ columns, data, actions }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 border-b border-slate-700">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 text-slate-400 font-semibold uppercase tracking-wide text-xs">
                {col.label}
              </th>
            ))}
            {actions && <th className="text-right px-4 py-3 text-slate-400 font-semibold uppercase tracking-wide text-xs">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-200">
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
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-slate-500">
                Sin resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
