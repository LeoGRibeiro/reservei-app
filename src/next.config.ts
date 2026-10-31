import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os testes de ponta a ponta sobem um segundo servidor (apontado para o Supabase local) sem
  // disputar a pasta de build com o `npm run dev` do dia a dia.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // O indicador do modo dev não existe em produção e entraria nas capturas da comparação visual
  devIndicators: process.env.NEXT_DIST_DIR === ".next-teste" ? false : undefined,
};

export default nextConfig;
