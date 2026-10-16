// Navegación compartida por la barra lateral, el menú móvil y la paleta de comandos.
// Construyer: panel interno de operaciones (solicitudes, trabajos, agenda, cotizaciones y facturas).

export interface NavLink {
  href: string;
  label: string;
  icon: string;
}

export interface NavSection {
  label: string;
  links: NavLink[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Campo",
    links: [
      { href: "/", label: "Hoy", icon: "◈" },
      { href: "/jobs/new", label: "Nuevo trabajo", icon: "＋" },
      { href: "/jobs", label: "Trabajos", icon: "⊞" },
    ],
  },
  {
    label: "Operaciones",
    links: [
      { href: "/dispatch", label: "Despacho", icon: "⇄" },
      { href: "/schedule", label: "Agenda", icon: "◐" },
      { href: "/closeout", label: "Cierre de trabajos", icon: "✓" },
      { href: "/pipeline", label: "Embudo", icon: "⊟" },
      { href: "/customers", label: "Clientes y equipos", icon: "⊕" },
      { href: "/estimates", label: "Cotizaciones", icon: "◷" },
      { href: "/invoices", label: "Facturas y pagos", icon: "◎" },
      { href: "/service-plans", label: "Planes de mantenimiento", icon: "◌" },
      { href: "/documents", label: "Documentos", icon: "▤" },
      { href: "/price-book", label: "Lista de precios", icon: "⊡" },
    ],
  },
  {
    label: "Calidad",
    links: [
      { href: "/reviews", label: "Reseñas", icon: "★" },
      { href: "/reports", label: "Reportes", icon: "◫" },
    ],
  },
  {
    label: "Sistema",
    links: [
      { href: "/integrations", label: "Integraciones", icon: "⧉" },
      { href: "/settings", label: "Configuración", icon: "⚙" },
    ],
  },
];

export const NAV_LINKS: NavLink[] = NAV_SECTIONS.flatMap((section) => section.links);

export function activeNavHref(pathname: string): string | null {
  const matches = NAV_LINKS.filter(({ href }) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export function decodeJwt(token: string): { name?: string; email?: string; role?: string } | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}
