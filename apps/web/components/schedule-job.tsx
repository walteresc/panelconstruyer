"use client";

import { useEffect, useState } from "react";
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

/** Fecha elegida por el cliente (si la hay) o mañana, a las 9:00, en el formato de <input type="datetime-local">. */
function defaultStart(requestedDate?: string): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    const [y, m, d] = requestedDate.split("-").map(Number);
    if (new Date(y, m - 1, d, 23, 59) > new Date()) date.setFullYear(y, m - 1, d);
  }
  date.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleJob({ jobId, requestedDate }: { jobId: string; requestedDate?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(() => defaultStart(requestedDate));
  const [duration, setDuration] = useState("60");
  const [technicianId, setTechnicianId] = useState("");
  const [technicians, setTechnicians] = useState<UserDTO[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || technicians.length > 0) return;
    api
      .users()
      .then((rows) => setTechnicians(rows.filter((user) => user.active && ["technician", "owner"].includes(user.role))))
      .catch(() => setTechnicians([]));
  }, [open, technicians.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!startsAt) {
      setError("Elige la fecha y la hora de inicio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const start = new Date(startsAt);
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
      <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpen(true)}>
        Programar este trabajo
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="sj-start" className="mb-1.5 block text-xs font-semibold text-fg-muted">Fecha y hora de inicio</label>
        <Input id="sj-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
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
