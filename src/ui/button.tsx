import { forwardRef } from "react";
import clsx from "clsx";

/**
 * Traducción de Kloset button.tsx (misma referencia en variantes/tamaños).
 *
 * Variantes:
 *  - primary:  pill negro (--fab), texto blanco. Acción principal.
 *  - neutral:  pill gris #B8B8BD, texto blanco. Acción secundaria de hero.
 *  - gradient: degradado azul→violeta, EXCLUSIVO de acciones asistidas
 *    por IA.
 *  - outline:  borde suave, transparente. Acciones terciarias.
 *  - danger:   borde/texto rojo. Eliminar, archivar.
 *
 * El tamaño es una PROP, no una clase por `className`: Tailwind emite las
 * utilidades en orden fijo y una utilidad de tamaño pasada por className
 * puede perder por cascada contra la del variant sin avisar.
 */
type ButtonVariant = "primary" | "neutral" | "gradient" | "outline" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-fab text-fab-content hover:opacity-90",
  neutral: "bg-[#B8B8BD] text-white hover:opacity-90",
  gradient:
    "text-white bg-[linear-gradient(110deg,var(--gradient-start)_0%,var(--gradient-end)_100%)] hover:opacity-90",
  outline: "border border-border-soft text-text-primary hover:bg-surface-soft",
  danger: "border border-danger text-danger hover:bg-danger/5",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 px-3.5 text-caption font-medium",
  md: "min-h-[52px] gap-2 px-5 text-body-medium font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth = false, className, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center rounded-full transition-[opacity,transform] duration-[var(--duration-fast)] active:scale-[0.98] active:opacity-[0.78] disabled:pointer-events-none disabled:opacity-40",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
