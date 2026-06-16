export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-xl shadow-lg ${className}`}>
      {children}
    </div>
  )
}
