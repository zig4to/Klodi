import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js privzeto blokira cross-origin zahteve do dev sredstev (_next/*),
  // zato brez tega telefon prek LAN IP-ja dobi HTML, JS pa se ne naloži in
  // gumbi/kliki ne delujejo. Dovolimo lokalno omrežje za `npm run dev`.
  allowedDevOrigins: ["**.trycloudflare.com", "192.168.*.*", "10.*.*.*", "**.ts.net"],

  // Skrij Next.js značko/indikator v spodnjem levem kotu med razvojem.
  // Napake pri prevajanju/izvajanju se še vedno prikažejo.
  devIndicators: false,

  // Ne generiraj samodejnih AGENTS.md / CLAUDE.md datotek ob build/dev.
  agentRules: false,
};

export default nextConfig;
