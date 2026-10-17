"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserDTO } from "@ofp/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DURATIONS = [
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1.5 horas" },
  { value: "120", label: "2 horas" },
  { value: "180", label: "3 horas" },
  { value: "240", label: "4 horas" },
];

const QUICK_TIMES = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

/** Atajos de fecha: Hoy, Mañana y los 4 días siguientes con su nombre (ej. «sáb 17»). */
function quickDates(today: Date): Array<{ key: string; label: string }> {
  const weekday = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric" });
  return [0, 1, 2, 3, 4, 5].map((offset) => {
    const date = addDays(today, offset);
    const label = offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : weekday.format(date).replace(".", "");
    return { key: toKey(date), label };
  });
}

export function ScheduleJob({ jobId, requestedDate }: { jobId: string; requestedDate?: string }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);
  const [open, setOpen] = useState(false);
  // Fecha que pidió el cliente (si es futura) o mañana; hora por defecto 9:00.
  const [date, setDate] = useState(() =>
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= todayKey ? requestedDate : toKey(addDays(today, 1)),
  );
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [technicianId, setTechnicianId] = useState("");
  const [technicians, setTechnicians] = useState<UserDTO[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shortcuts = useMemo(() => quickDates(today), [today]);

  useEffect(() => {
    if (!open || technicians.length > 0) return;
    api
      .users()
      .then((rows) => setTechnicians(rows.filter((user) => user.active && ["technician", "owner"].includes(user.role))))
      .catch(() => setTechnicians([]));
  }, [open, technicians.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !time) {
      setError("Elige la fecha y la hora de inicio.");
      return;
    }
    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) {
      setError("La fecha u hora no es válida.");
      return;
    }
    if (start.getTime() < Date.now() - 60_000) {
      setError("Esa hora ya pasó. Elige una fecha y hora futuras.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const end = new Date(start.getTime() + Number(duration) * 60_000);
      await api.createAppointment({
        jobId,
        technicianId: technicianId || undefined,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
        Programar este trabajo
      </Button>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
      active ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface-200 text-fg-muted hover:text-fg"
    }`;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-fg-muted">Día</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de fecha">
          {shortcuts.map((shortcut) => (
            <button key={shortcut.key} type="button" onClick={() => setDate(shortcut.key)} className={chip(date === shortcut.key)}>
              {shortcut.label}
            </button>
          ))}
        </div>
        <Input
          id="sj-date"
          type="date"
          aria-label="Otra fecha"
          min={todayKey}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          className="mt-2"
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-fg-muted">Hora de inicio</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de hora">
          {QUICK_TIMES.map((value) => (
            <button key={value} type="button" onClick={() => setTime(value)} className={chip(time === value)}>
              {value}
            </button>
          ))}
        </div>
        <Input
          id="sj-time"
          type="time"
          aria-label="Otra hora"
          step={900}
          value={time}
          onChange={(event) => setTime(event.target.value)}
          required
          className="mt-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sj-duration" className="mb-1.5 block text-xs font-semibold text-fg-muted">Duración</label>
          <select
            id="sj-duration"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface-200 px-2 text-sm text-fg"
          >
            {DURATIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sj-tech" className="mb-1.5 block text-xs font-semibold text-fg-muted">Especialista</label>
          <select
            id="sj-tech"
            value={technicianId}
            onChange={(event) => setTechnicianId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface-200 px-2 text-sm text-fg"
          >
            <option value="">Sin asignar</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>{technician.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-xs text-red">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Programando…" : "Programar"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
