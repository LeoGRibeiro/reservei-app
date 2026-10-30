import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os testes de ponta a ponta sobem um segundo servidor (apontado para o Supabase local) sem
  // disputar a pasta de build com o `npm run dev` do dia a dia.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
