import assert from "node:assert/strict";
import test from "node:test";
import { parseSessionUser } from "./api.js";

test("session responses require every display and authorization field", () => {
  assert.throws(() => parseSessionUser({}), /Respuesta de sesión no válida/);
  assert.throws(
    () => parseSessionUser({ id: "owner-1", name: undefined, email: "owner@example.test", role: "owner" }),
    /Respuesta de sesión no válida/,
  );
});

test("a complete session user passes validation", () => {
  const user = { id: "owner-1", name: "Morgan Owner", email: "owner@example.test", role: "owner" };
  assert.deepEqual(parseSessionUser(user), user);
});
