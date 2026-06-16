export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded ${className}`}>
      {children}
    </div>
  )
}
