import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'dark' | 'outline' | 'danger' | 'ghost';
type Size = 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-amber text-charcoal hover:bg-amber-light',
  dark: 'bg-charcoal text-paper hover:bg-charcoal/85',
  outline: 'border-2 border-charcoal/80 text-charcoal bg-surface hover:bg-charcoal/5',
  danger: 'bg-danger text-white hover:bg-danger/90',
  ghost: 'text-charcoal hover:bg-charcoal/5',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm rounded-lg gap-2',
  lg: 'min-h-14 px-5 text-base rounded-xl gap-2',
  xl: 'min-h-16 px-6 text-lg rounded-2xl gap-3',
};

export function Button({
  variant = 'primary',
  size = 'lg',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-surface rounded-2xl shadow-card ${className}`}>{children}</div>;
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <h1 className="text-2xl font-bold tracking-tight text-balance">{children}</h1>
      {aside}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-wash text-danger px-4 py-3 text-sm font-medium">
      {children}
    </p>
  );
}
