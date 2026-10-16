import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata = {
  robots: { index: false, follow: false },
  title: "Construyer — Operaciones",
    description: "Panel interno de Construyer para gestionar solicitudes, trabajos, agenda, cotizaciones y facturas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE" data-theme="light" className={jakarta.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
