import clsx from "clsx";

/**
 * Traducción de Kloset empty-state-card.tsx: cuadro 176px, icono+título+
 * descripción+action opcional.
 */
export function EmptyStateCard({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  // Tarjeta a todo el ancho (antes un cuadrado fijo de 176px que en móvil
  // partía el texto en 6 líneas y dejaba huecos enormes a los lados).
  return (
    <div className={clsx("flex flex-col items-center gap-4 py-6 text-center", className)}>
      <div className="flex w-full flex-col items-center justify-center gap-3 rounded-[22px] bg-surface-soft px-6 py-8">
        {icon}
        <div className="flex max-w-xs flex-col gap-1">
          <p className="text-body-medium font-medium text-text-primary">{title}</p>
          {description && <p className="text-caption text-text-secondary">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
