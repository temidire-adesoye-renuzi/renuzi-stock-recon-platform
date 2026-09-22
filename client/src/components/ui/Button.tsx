type Variant = 'primary' | 'accent' | 'ghost' | 'outline'
type Size = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-[#25277A] border border-transparent',
  accent: 'bg-accent text-white hover:bg-[#CF6718] border border-transparent',
  outline: 'bg-white text-ink border border-neutral-300 hover:bg-neutral-50',
  ghost: 'bg-transparent text-neutral-600 border border-transparent hover:bg-neutral-100',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    />
  )
}
