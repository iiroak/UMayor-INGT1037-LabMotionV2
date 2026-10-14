import clsx from "clsx";

/**
 * Control segmentado de Fit-App: contenedor surface-muted, segmento activo
 * blanco con sombra sutil. El estado activo se expone con `aria-pressed` y
 * peso tipográfico, no solo con color.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={clsx("flex h-[50px] gap-1 rounded-[17px] bg-surface-muted p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "min-w-0 flex-auto truncate rounded-[14px] px-2 text-[14px] leading-5 transition-colors",
              active
                ? "bg-surface font-semibold text-text-primary shadow-[0_2px_5px_rgba(0,0,0,0.09)]"
                : "font-medium text-text-tertiary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
