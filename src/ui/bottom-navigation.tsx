import clsx from "clsx";

/**
 * Barra inferior de tabs del mismo ancho (patrón de Fit-App).
 *
 * Tab activo: icono más grueso + pastilla de fondo suave + label en peso
 * semibold. Los targets táctiles miden ≥ 56px de alto y el estado activo se
 * comunica también con `aria-current`, no solo con color.
 */
export interface BottomNavTab<T extends string = string> {
  key: T;
  label: string;
  icon: (props: { size?: number; strokeWidth?: number; className?: string }) => React.ReactElement;
}

function TabButton<T extends string>({
  tab,
  isActive,
  onClick,
}: {
  tab: BottomNavTab<T>;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[11px] leading-[14px] transition-colors active:opacity-70"
      aria-current={isActive ? "page" : undefined}
    >
      <span
        className={clsx(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-[var(--duration-base)]",
          isActive && "bg-surface-muted",
        )}
      >
        <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? "text-icon-primary" : "text-text-tertiary"} />
      </span>
      <span className={clsx("max-w-full truncate text-[10.5px] tracking-[-0.01em]", isActive ? "font-semibold text-icon-primary" : "text-text-tertiary")}>
        {tab.label}
      </span>
    </button>
  );
}

export function BottomNavigation<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: BottomNavTab<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    // `pb-[env(safe-area-inset-bottom)]` evita que la barra quede debajo del
    // indicador de gestos en iOS.
    <nav
      aria-label="Secciones de LabMotion"
      className="relative z-20 shrink-0 border-t border-divider bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="relative mx-auto flex h-[60px] max-w-3xl items-stretch px-1">
        {tabs.map((tab) => (
          <TabButton key={tab.key} tab={tab} isActive={active === tab.key} onClick={() => onChange(tab.key)} />
        ))}
      </div>
    </nav>
  );
}
