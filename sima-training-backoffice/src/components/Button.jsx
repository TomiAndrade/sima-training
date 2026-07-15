const variants = {
  primary: 'bg-red-600 hover:bg-red-700 text-white font-medium border border-red-600',
  secondary: 'bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium border border-slate-300',
  danger: 'bg-transparent hover:bg-red-50 text-red-600 font-medium border border-red-300',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-medium border border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium border border-emerald-600',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs tracking-wide',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
