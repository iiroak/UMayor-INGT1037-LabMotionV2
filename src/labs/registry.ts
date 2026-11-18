import { GUIDE_MRU_URL, GUIDE_MRUA_URL, GUIDE_URL } from "../config";

export type LabId = "tilt" | "mru" | "mrua";

/** «piloto»: el laboratorio funciona, pero aún no se validó con teléfonos reales. */
export type LabStatus = "estable" | "piloto";

export type LabEntry = {
  id: LabId;
  title: string;
  summary: string;
  guideUrl: string;
  guideLabel: string;
  status: LabStatus;
};

/** Laboratorios que muestra la pestaña Labs, en orden. */
export const LABS: readonly LabEntry[] = [
  {
    id: "tilt",
    title: "Medición de inclinación",
    summary: "Acelerómetro + transportador físico · 0°, 30°, 45° y 60°",
    guideUrl: GUIDE_URL,
    guideLabel: "Inclinación",
    status: "estable",
  },
  {
    id: "mru",
    title: "Movimiento rectilíneo uniforme (MRU)",
    summary: "Solo el teléfono · empujón, crucero a velocidad constante y frenado",
    guideUrl: GUIDE_MRU_URL,
    guideLabel: "MRU",
    status: "piloto",
  },
  {
    id: "mrua",
    title: "Movimiento uniformemente acelerado (MRUA)",
    summary: "Solo el teléfono · bajada por una rampa y comparación con g·sen θ",
    guideUrl: GUIDE_MRUA_URL,
    guideLabel: "MRUA",
    status: "piloto",
  },
];

export function labById(id: LabId): LabEntry {
  const entry = LABS.find((lab) => lab.id === id);
  if (!entry) throw new Error(`Laboratorio desconocido: ${id}`);
  return entry;
}
