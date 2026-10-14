import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { REPO_URL } from "./config";
import { useRecording } from "./hooks/useRecording";
import { sensorStatusLabel, useSensors } from "./hooks/useSensors";
import { useWakeLock } from "./hooks/useWakeLock";
import { TiltLab } from "./labs/tilt/TiltLab";
import { useTiltLab } from "./labs/tilt/useTiltLab";
import { diagnosticsText, getDiagnostics } from "./lib/diagnostics";
import { copyText } from "./lib/export";
import { deriveXAxisKinematics } from "./lib/kinematics";
import { CaptureScreen } from "./screens/CaptureScreen";
import { ChartsScreen } from "./screens/ChartsScreen";
import { DiagnosticsScreen } from "./screens/DiagnosticsScreen";
import { LabsScreen } from "./screens/LabsScreen";
import { MagnitudesScreen } from "./screens/MagnitudesScreen";
import {
  AppShell,
  BottomNavigation,
  ChartIcon,
  ChevronLeftIcon,
  ConfirmHost,
  FlaskIcon,
  GithubIcon,
  RecordIcon,
  SensorIcon,
  ShieldCheckIcon,
  SigmaIcon,
  ToastHost,
  showToast,
  useBackLayer,
  type BottomNavTab,
} from "./ui";

type Tab = "labs" | "magnitudes" | "capture" | "charts" | "diagnostics";

const TABS: BottomNavTab<Tab>[] = [
  { key: "labs", label: "Labs", icon: FlaskIcon },
  { key: "magnitudes", label: "Magnitudes", icon: SigmaIcon },
  { key: "capture", label: "Capturar", icon: RecordIcon },
  { key: "charts", label: "Gráficos", icon: ChartIcon },
  { key: "diagnostics", label: "Diagnóstico", icon: ShieldCheckIcon },
];

function deviceLabelFrom(userAgent: string): string {
  const android = /Android [\d.]+[^;)]*/.exec(userAgent)?.[0];
  const ios = /(iPhone|iPad).*?OS ([\d_]+)/.exec(userAgent);
  const browser = /EdgA?\/[\d.]+|SamsungBrowser\/[\d.]+|Firefox\/[\d.]+|FxiOS\/[\d.]+|CriOS\/[\d.]+|Chrome\/[\d.]+|Version\/[\d.]+.*Safari/.exec(userAgent)?.[0];
  const os = android ?? (ios ? `${ios[1]} iOS ${ios[2].replaceAll("_", ".")}` : "Escritorio u otro");
  return `${os} · ${browser ?? "navegador desconocido"}`;
}

export function App() {
  const [tab, setTab] = useState<Tab>("labs");
  const [labOpen, setLabOpen] = useState(false);
  const sensors = useSensors();
  const tilt = useTiltLab(sensors);
  const recording = useRecording(sensors);

  const statusLabel = sensorStatusLabel(sensors.state, sensors.signal, sensors.latest !== null);
  const diagnostics = getDiagnostics(sensors.capabilities, sensors.state, sensors.frequencyHz, sensors.latest?.intervalMs ?? null);
  const deviceLabel = useMemo(() => deviceLabelFrom(navigator.userAgent), []);
  const chartSamples = recording.measurement?.samples ?? sensors.liveSamples;
  const kinematicPoints = useMemo(() => deriveXAxisKinematics(chartSamples), [chartSamples]);

  // Pantalla encendida mientras se mide (laboratorio abierto o captura en curso).
  useWakeLock((tab === "labs" && labOpen && sensors.state === "active") || recording.isRecording);

  // Botón "atrás" del sistema: cierra el laboratorio y luego vuelve a Labs.
  useBackLayer(tab !== "labs", () => setTab("labs"));
  useBackLayer(tab === "labs" && labOpen, () => setLabOpen(false));

  // Al cambiar de pestaña, el contenido vuelve arriba.
  const previousView = useRef(`${tab}:${labOpen}`);
  useEffect(() => {
    const key = `${tab}:${labOpen}`;
    if (previousView.current !== key) document.getElementById("app-scroll-area")?.scrollTo({ top: 0 });
    previousView.current = key;
  }, [tab, labOpen]);

  const enableSensors = async () => {
    const ok = await sensors.enable();
    if (ok) showToast("Sensores activados. Los datos no salen de este teléfono.");
    return ok;
  };

  const startRecording = async () => {
    if (await recording.start()) showToast("Captura iniciada. Realiza el movimiento y luego detén.");
  };

  const stopRecording = () => {
    const count = recording.stop();
    if (count === 0) {
      showToast("No llegaron suficientes muestras. Mantén el teléfono activo y prueba otra vez.");
      return;
    }
    setTab("charts");
    showToast(`${count} muestras guardadas localmente.`);
  };

  const copyDiagnostics = async () => {
    const copied = await copyText(diagnosticsText(diagnostics));
    showToast(copied ? "Diagnóstico copiado al portapapeles." : "No se pudo copiar el diagnóstico.");
  };

  const openDiagnostics = () => setTab("diagnostics");
  const inLab = tab === "labs" && labOpen;
  const sensorsOk = sensors.state === "active" && sensors.signal === "receiving";

  return (
    <>
      <AppShell
        header={
          <header className="z-20 shrink-0 border-b border-divider bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-[18px]">
              {inLab ? (
                <button
                  type="button"
                  className="-ml-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-body-medium font-medium text-text-primary active:opacity-70"
                  onClick={() => setLabOpen(false)}
                >
                  <ChevronLeftIcon size={22} />
                  Laboratorios
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2.5 text-title font-semibold tracking-[-0.01em] text-text-primary"
                  onClick={() => { setTab("labs"); setLabOpen(false); }}
                  aria-label="LabMotion, ir a Laboratorios"
                >
                  <span className="grid size-8 place-items-center rounded-[11px] bg-fab text-fab-content"><SensorIcon size={20} /></span>
                  <span>LabMotion</span>
                </button>
              )}
              <span className={clsx("header-status", sensorsOk && "is-active")} role="status">
                <span className="status-dot" aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
          </header>
        }
        nav={<BottomNavigation<Tab> tabs={TABS} active={tab} onChange={(next) => setTab(next)} />}
      >
        <div className="w-full min-w-0 pb-6">
          {tab === "labs" && (inLab ? (
            <TiltLab lab={tilt} sensors={sensors} diagnostics={diagnostics} deviceLabel={deviceLabel} onDiagnostics={openDiagnostics} />
          ) : (
            <LabsScreen sensors={sensors} statusLabel={statusLabel} trials={tilt.trials} onOpenTilt={() => setLabOpen(true)} onEnable={() => void enableSensors()} />
          ))}
          {tab === "magnitudes" && (
            <MagnitudesScreen latest={sensors.latest} samples={chartSamples} frequencyHz={sensors.frequencyHz} kinematicPoints={kinematicPoints} />
          )}
          {tab === "capture" && (
            <CaptureScreen recording={recording} onStart={() => void startRecording()} onStop={stopRecording} />
          )}
          {tab === "charts" && (
            <ChartsScreen
              liveSamples={sensors.liveSamples}
              measurement={recording.measurement}
              kinematicPoints={kinematicPoints}
              diagnostics={diagnostics}
              onClear={() => { recording.clear(); showToast("Captura eliminada de la sesión."); }}
              onGoCapture={() => setTab("capture")}
            />
          )}
          {tab === "diagnostics" && (
            <DiagnosticsScreen diagnostics={diagnostics} statusLabel={statusLabel} sensorsActive={sensors.state === "active"} onEnable={() => void enableSensors()} onCopy={() => void copyDiagnostics()} />
          )}
          <footer className="mx-[18px] mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-4 text-micro text-text-tertiary">
            <span>LabMotion V2 · UMayor INGT1037 · Grupo 1</span>
            <a className="inline-flex items-center gap-1.5 font-semibold text-accent-text no-underline" href={REPO_URL} target="_blank" rel="noreferrer">
              <GithubIcon size={14} />Código abierto
            </a>
          </footer>
        </div>
      </AppShell>
      <ToastHost />
      <ConfirmHost />
    </>
  );
}
