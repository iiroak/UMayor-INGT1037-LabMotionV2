/**
 * Extrae un bloque `// #region nombre` … `// #endregion` de un archivo fuente
 * importado con `?raw`. Así la UI muestra exactamente el código que ejecuta la
 * página, no una copia escrita a mano.
 */
export function extractRegion(source: string, region: string): string {
  const startMarker = `// #region ${region}`;
  const start = source.indexOf(startMarker);
  if (start < 0) return "Código no disponible.";
  const contentStart = source.indexOf("\n", start) + 1;
  const end = source.indexOf("// #endregion", contentStart);
  return source.slice(contentStart, end < 0 ? source.length : end).trim();
}
