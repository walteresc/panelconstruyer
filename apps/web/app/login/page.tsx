"use client";

import { SourceLink } from "@/components/source-link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <BrandLogo className="mb-3" />
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Accede al panel de operaciones de Construyer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs text-fg-muted">Correo</label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@correo.com"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs text-fg-muted">Contraseña</label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Ingresando…" : "Iniciar sesión"}
            </Button>
            {error && (
              <p role="alert" className="rounded-lg border border-red/25 bg-red/5 px-3 py-2 text-sm text-red">
                No se pudo iniciar sesión. Verifica tu correo y tu contraseña e inténtalo de nuevo.
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-xs leading-5 text-fg-muted">
            El registro de nuevas organizaciones está desactivado en producción.
          </p>
          <p className="mt-2 text-center"><SourceLink /></p>
        </CardContent>
      </Card>
    </div>
  );
}
