const variants = {
  primary: 'bg-red-600 hover:bg-red-500 text-white font-semibold',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-medium',
  ghost: 'bg-transparent hover:bg-slate-700 text-slate-300 font-medium',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export default function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
