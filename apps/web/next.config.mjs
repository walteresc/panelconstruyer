import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").origin;
const publicSite = (process.env.CONSTRUYER_SITE_URL ?? "https://construyer.com").replace(/\/$/, "");
const developmentSockets = process.env.NODE_ENV === "production" ? "" : " ws://127.0.0.1:* ws://localhost:*";
const developmentEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src 'self' ${apiOrigin}${developmentSockets}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${developmentEval}`,
  "style-src 'self' 'unsafe-inline'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@ofp/shared"],
  // Módulos del producto base que no se usan en Construyer (diagnóstico de electrodomésticos, página comercial).
  // La solicitud de servicio pública vive en la web de Construyer.
  async redirects() {
    return [
      { source: "/diagnostics/:path*", destination: "/", permanent: false },
      { source: "/diagnostic-library/:path*", destination: "/", permanent: false },
      { source: "/coverage", destination: "/", permanent: false },
      { source: "/welcome", destination: "/login", permanent: false },
      { source: "/documents/preview", destination: "/documents", permanent: false },
      { source: "/book", destination: `${publicSite}/cotizar/`, permanent: false },
    ];
  },

  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
  webpack(config) {
    // Shared source uses NodeNext-compatible `.js` specifiers so the API can
    // execute emitted ESM. During the Next source build, map those specifiers
    // back to their TypeScript source modules.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};
export default nextConfig;
