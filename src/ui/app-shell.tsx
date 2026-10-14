import type { ReactNode } from "react";

/**
 * Estructura base tomada de Fit-App (que a su vez traduce el scaffold de Kloset).
 *
 * `h-dvh` + `overflow-hidden` en el contenedor y `overflow-y-auto` en el
 * <main> es deliberado: el scroll vive DENTRO del área de contenido en vez de
 * en el <body>. Sin esto, el body entero scrollea y la barra de navegación se
 * puede arrastrar fuera de la pantalla con overscroll. `dvh` en vez de `vh`
 * porque en móvil la barra de URL cambia de alto.
 *
 * `header` y `nav` son slots: viven fuera del área scrolleable para que los
 * elementos `sticky` del contenido se peguen justo debajo del header.
 */
export function AppShell({ children, nav, header }: { children: ReactNode; nav?: ReactNode; header?: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {header}
      <main
        id="app-scroll-area"
        className="flex w-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
      >
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col">{children}</div>
      </main>
      {nav}
    </div>
  );
}
