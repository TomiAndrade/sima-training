const variants = {
  primary: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold',
  secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold border border-slate-300',
  success: 'bg-emerald-500 hover:bg-emerald-400 text-white font-bold',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-bold',
  outline: 'bg-transparent border-2 border-red-600 text-red-500 hover:bg-red-600/10 font-semibold',
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
