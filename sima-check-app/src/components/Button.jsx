const variants = {
  primary: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold',
  secondary: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white font-semibold border border-slate-600',
  success: 'bg-emerald-500 hover:bg-emerald-400 text-white font-bold',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-bold',
  outline: 'bg-transparent border-2 border-amber-500 text-amber-500 hover:bg-amber-500/10 font-semibold',
}

export default function Button({ children, variant = 'primary', onClick, disabled, fullWidth, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-4 px-6 rounded-2xl text-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation select-none ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
