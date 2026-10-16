export interface AppointmentWindow {
  startsAt: Date;
  endsAt: Date;
}

export interface AppointmentWindowPatch {
  startsAt?: string;
  endsAt?: string;
}

export type AppointmentWindowResult =
  | { ok: true; startsAt: Date; endsAt: Date }
  | { ok: false; error: string };

/**
 * Uses half-open intervals: [start, end). Two visits that touch at the boundary
 * are valid back-to-back appointments rather than a conflict.
 */
export function appointmentWindowsOverlap(left: AppointmentWindow, right: AppointmentWindow) {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}

/**
 * Resolves a partial appointment-time patch against the persisted window and
 * validates the resulting interval. The API must validate the final combined
 * state, not only a pair of values supplied in the same request.
 */
export function resolveAppointmentWindow(
  current: AppointmentWindow,
  patch: AppointmentWindowPatch,
): AppointmentWindowResult {
  const startsAt = patch.startsAt ? new Date(patch.startsAt) : current.startsAt;
  const endsAt = patch.endsAt ? new Date(patch.endsAt) : current.endsAt;

  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    return { ok: false, error: "startsAt y endsAt deben ser fechas y horas válidas" };
  }

  if (endsAt <= startsAt) {
    return { ok: false, error: "endsAt debe ser posterior a startsAt" };
  }

  return { ok: true, startsAt, endsAt };
}
