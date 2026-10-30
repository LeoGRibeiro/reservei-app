/**
 * @file realtime.mjs
 * @description Subconjunto do Supabase Realtime (protocolo Phoenix, serializer 2.0.0) para testes:
 * aceita canais com `postgres_changes` e transmite as gravações feitas pela API REST local.
 */

/**
 * Cria o hub de Realtime sobre um WebSocketServer do pacote `ws`.
 *
 * @param {import("ws").WebSocketServer} wss Servidor de WebSocket
 * @returns {{ transmitir: (mudanca: { tipo: string, tabela: string, linhas: object[] }) => void }}
 */
export function criarRealtime(wss) {
  /** @type {{ ws: any, topico: string, joinRef: string, ligacoes: { id: number, event: string, table: string, filter?: string }[] }[]} */
  const canais = [];
  let proximoId = 1;

  const enviar = (ws, [joinRef, ref, topico, evento, payload]) => {
    if (ws.readyState === 1) ws.send(JSON.stringify([joinRef, ref, topico, evento, payload]));
  };

  wss.on("connection", (ws) => {
    ws.on("message", (bruto) => {
      let msg;
      try {
        msg = JSON.parse(String(bruto));
      } catch {
        return;
      }
      const [joinRef, ref, topico, evento, payload] = Array.isArray(msg)
        ? msg
        : [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];

      if (topico === "phoenix" && evento === "heartbeat") {
        enviar(ws, [null, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]);
        return;
      }
      if (evento === "phx_join") {
        const pedidas = payload?.config?.postgres_changes ?? [];
        const ligacoes = pedidas.map((p) => ({ id: proximoId++, event: p.event, schema: p.schema, table: p.table, filter: p.filter }));
        canais.push({ ws, topico, joinRef, ligacoes });
        enviar(ws, [joinRef, ref, topico, "phx_reply", { status: "ok", response: { postgres_changes: ligacoes } }]);
        if (ligacoes.length) {
          enviar(ws, [joinRef, null, topico, "system",
            { extension: "postgres_changes", status: "ok", message: "Subscribed to PostgreSQL", channel: topico.replace(/^realtime:/, "") }]);
        }
        return;
      }
      if (evento === "phx_leave") {
        const i = canais.findIndex((c) => c.ws === ws && c.topico === topico);
        if (i >= 0) canais.splice(i, 1);
        enviar(ws, [joinRef, ref, topico, "phx_reply", { status: "ok", response: {} }]);
      }
    });
    ws.on("close", () => {
      for (let i = canais.length - 1; i >= 0; i--) if (canais[i].ws === ws) canais.splice(i, 1);
    });
  });

  /** Confere um filtro `coluna=eq.valor` contra a linha. */
  const passaFiltro = (filtro, linha) => {
    if (!filtro) return true;
    const m = filtro.match(/^(\w+)=(eq|neq|in)\.(.*)$/);
    if (!m) return true;
    const valor = String(linha?.[m[1]] ?? "");
    if (m[2] === "eq") return valor === m[3];
    if (m[2] === "neq") return valor !== m[3];
    return m[3].replace(/[()]/g, "").split(",").includes(valor);
  };

  return {
    transmitir({ tipo, tabela, linhas }) {
      for (const linha of linhas ?? []) {
        for (const canal of canais) {
          const ids = canal.ligacoes
            .filter((l) => l.table === tabela && (l.event === "*" || l.event === tipo) && passaFiltro(l.filter, linha))
            .map((l) => l.id);
          if (!ids.length) continue;
          enviar(canal.ws, [canal.joinRef, null, canal.topico, "postgres_changes", {
            ids,
            data: {
              schema: "public",
              table: tabela,
              commit_timestamp: new Date().toISOString(),
              type: tipo,
              columns: [],
              record: tipo === "DELETE" ? null : linha,
              old_record: tipo === "INSERT" ? null : linha,
              errors: null,
            },
          }]);
        }
      }
    },
  };
}
