// Team-management safeguards. Pure rules so they can be unit-tested without a
// database; the users route runs them inside a transaction (with an advisory
// lock on the org) so the owner count cannot race a concurrent change.
//
// Rules:
//   1. Only owners manage the team (403).
//   2. A user cannot change their own role or remove themselves (409) — another
//      owner must perform the change so the account is never orphaned.
//   3. The final active owner can never be demoted or removed (409) — an org
//      must always keep at least one owner with access.
export type UserRole = "owner" | "dispatcher" | "technician";

export type TeamChange =
  | { kind: "role"; targetRole: UserRole }
  | { kind: "deactivate" }
  | { kind: "remove" };

export interface TeamActor {
  id: string;
  role: UserRole;
}

export interface TeamTarget {
  id: string;
  role: UserRole;
  active: boolean;
}

export interface TeamSnapshot {
  actor: TeamActor;
  target: TeamTarget;
  /** Number of other active owners in the org, excluding the target. */
  otherActiveOwners: number;
}

export type TeamGuardResult =
  | { ok: true }
  | { ok: false; code: 403 | 409; error: string; hint?: string };

export function guardTeamChange(snapshot: TeamSnapshot, change: TeamChange): TeamGuardResult {
  // Rule 1 — team management is an owner capability.
  if (snapshot.actor.role !== "owner") {
    return {
      ok: false,
      code: 403,
      error: "Solo los propietarios pueden gestionar al equipo.",
      hint: "Pide a un propietario que haga este cambio.",
    };
  }

  const actingOnSelf = snapshot.actor.id === snapshot.target.id;

  // Rule 2 — no self-removal or self role change.
  if (actingOnSelf) {
    if (change.kind !== "role") {
      return {
        ok: false,
        code: 409,
        error: "No puedes eliminar tu propia cuenta.",
        hint: "Otro propietario debe quitarte del equipo.",
      };
    }
    if (change.targetRole !== snapshot.target.role) {
      return {
        ok: false,
        code: 409,
        error: "No puedes cambiar tu propio rol.",
        hint: "Pide a otro propietario que cambie tu rol.",
      };
    }
  }

  // Rule 3 — the final active owner is protected.
  const isActiveOwner = snapshot.target.role === "owner" && snapshot.target.active;
  if (isActiveOwner && snapshot.otherActiveOwners === 0) {
    if (change.kind === "role" && change.targetRole !== "owner") {
      return {
        ok: false,
        code: 409,
        error: "No se puede degradar al último propietario.",
        hint: "Asigna primero el rol de propietario a otra persona.",
      };
    }
    if (change.kind !== "role") {
      return {
        ok: false,
        code: 409,
        error: "No se puede eliminar al último propietario.",
        hint: "Asigna primero el rol de propietario a otra persona.",
      };
    }
  }

  return { ok: true };
}
