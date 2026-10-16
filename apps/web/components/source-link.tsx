// AGPL-3.0 §13: los usuarios que interactúan con la aplicación por red deben poder
// obtener el código fuente correspondiente de la versión que se ejecuta.
const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL;

export function SourceLink({ className = "" }: { className?: string }) {
  if (!SOURCE_URL) return null;
  return (
    <a
      href={SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs text-fg-dim underline-offset-2 hover:underline ${className}`}
    >
      Código fuente (AGPL-3.0)
    </a>
  );
}
