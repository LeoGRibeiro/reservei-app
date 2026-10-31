/**
 * @file not-found.tsx
 * @description Página 404 global: subdomínio de arena inexistente/inativa ou rota desconhecida.
 * Usa estilos próprios (sem Tailwind), porque é renderizada fora dos grupos de rota.
 */

import { DOMINIO_RAIZ_PADRAO } from "@/lib/arena/subdomain";
import { NOME_PRODUTO } from "@/lib/marca";

const ESTILO_PAGINA: React.CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  background: "#020617",
  color: "#ffffff",
  fontFamily: "system-ui, sans-serif",
};

export default function NaoEncontrado() {
  return (
    <main style={ESTILO_PAGINA}>
      <div style={{ maxWidth: 448, textAlign: "center", display: "grid", gap: 16 }}>
        <p style={{ fontSize: 48, margin: 0 }} aria-hidden>
          🏟️
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Arena não encontrada</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#94a3b8", margin: 0 }}>
          O endereço acessado não corresponde a nenhuma arena ativa no {NOME_PRODUTO}. Confira o link enviado
          pela arena ou fale com ela pelo WhatsApp.
        </p>
        <a
          href={`https://${DOMINIO_RAIZ_PADRAO}`}
          style={{
            justifySelf: "center",
            padding: "10px 20px",
            borderRadius: 12,
            background: "#10b981",
            color: "#020617",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Conhecer o {NOME_PRODUTO}
        </a>
      </div>
    </main>
  );
}
