import { cn } from "@/lib/utils";

/** Isotipo de Construyer. */
export function BrandMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- imagen estática pequeña del propio sitio
  return <img src="/logo-mark.png" alt="" width={32} height={32} className={cn("h-8 w-8 shrink-0", className)} />;
}

/** Isotipo + nombre "Construyer" (Constru en azul oscuro, yer en naranja). */
export function BrandLogo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span>
        <span className="block text-base font-extrabold leading-none tracking-tight text-brand-navy">
          Constru<span className="text-brand-orange">yer</span>
        </span>
        {subtitle && <span className="mt-1 block text-[10px] leading-none text-fg-dim">{subtitle}</span>}
      </span>
    </span>
  );
}
