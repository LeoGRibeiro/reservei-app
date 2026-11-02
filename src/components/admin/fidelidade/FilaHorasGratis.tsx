/**
 * @file FilaHorasGratis.tsx
 * @description Fila "Horas grátis para liberar" da tela Fidelidade: atletas que bateram a meta do
 * Clube. O dono (ou gerente) confere as horas que geraram o pedido e **libera** (o atleta passa a
 * ver e usar no Clube) ou **recusa** com motivo. A decisão é gravada no servidor
 * (`POST /api/admin/fidelidade/vouchers/{id}`).
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §10
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { AreaTexto, Aviso, Botao, Campo, Cartao, Janela } from "@/components/admin/ui";
import { formatarDataExibicao, formatarMoeda } from "@/lib/constants";
import type { SeloFidelidade, VoucherFidelidade } from "@/lib/fidelidade/types";

/** Decisão enviada ao servidor. */
export type Decisao = { decisao: "liberar" } | { decisao: "recusar"; motivo: string };

export interface FilaHorasGratisProps {
  /** Vouchers com status `em_analise` */
  pedidos: VoucherFidelidade[];
  /** Selos da arena (para mostrar as horas que geraram cada pedido) */
  selos: SeloFidelidade[];
  /** Nome do atleta pelo id */
  nomeAtleta: (usuarioId: string) => string;
  /** Envia a decisão; devolve a mensagem de erro do servidor, se houver */
  aoDecidir: (voucherId: string, decisao: Decisao) => Promise<string | null>;
}

/**
 * @example
 * ```tsx
 * <FilaHorasGratis pedidos={emAnalise} selos={selos} nomeAtleta={nome} aoDecidir={decidir} />
 * ```
 */
export function FilaHorasGratis({ pedidos, selos, nomeAtleta, aoDecidir }: FilaHorasGratisProps) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<VoucherFidelidade | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);

  if (pedidos.length === 0) return null;

  async function decidir(v: VoucherFidelidade, decisao: Decisao) {
    setOcupado(v.id);
    try {
      const erro = await aoDecidir(v.id, decisao);
      if (erro) {
        toast.error(erro);
        return false;
      }
      toast.success(decisao.decisao === "liberar" ? `Hora grátis liberada para ${nomeAtleta(v.usuarioId)}.` : "Pedido recusado.");
      return true;
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Cartao
      titulo={`Horas grátis para liberar (${pedidos.length})`}
      descricao="Estes atletas bateram a meta do Clube. Confira as horas e libere ou recuse. O atleta só vê a hora grátis depois de liberada."
    >
      <ul className="divide-y divide-painel-linha" aria-label="Horas grátis para liberar">
        {pedidos.map((v) => {
          const origem = selos.filter((s) => s.voucherId === v.id).sort((a, b) => a.dataJogo.localeCompare(b.dataJogo));
          const horas = origem.reduce((soma, s) => soma + s.horasContabilizadas, 0);
          return (
            <li key={v.id} aria-label={`Pedido de ${nomeAtleta(v.usuarioId)}`} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-painel-tinta">{nomeAtleta(v.usuarioId)}</p>
                <p className="text-sm text-painel-suave">
                  Pedido em {formatarDataExibicao(v.criadoEm.slice(0, 10))} · vale até {formatarMoeda(v.valorTeto)}
                  {horas > 0 ? ` · ${horas} ${horas === 1 ? "hora jogada" : "horas jogadas"}` : ""}
                </p>
                {origem.length > 0 && (
                  <p className="text-xs text-painel-suave">Jogos: {origem.map((s) => formatarDataExibicao(s.dataJogo)).join(", ")}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Botao variante="secundario" icone={X} disabled={ocupado === v.id} onClick={() => { setRecusando(v); setMotivo(""); setErroMotivo(null); }}>
                  Recusar
                </Botao>
                <Botao icone={Check} carregando={ocupado === v.id} onClick={() => void decidir(v, { decisao: "liberar" })}>
                  Liberar
                </Botao>
              </div>
            </li>
          );
        })}
      </ul>

      <Janela
        aberta={!!recusando}
        largura="sm"
        titulo="Recusar a hora grátis?"
        descricao={recusando ? nomeAtleta(recusando.usuarioId) : undefined}
        aoFechar={() => setRecusando(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setRecusando(null)}>
              Voltar
            </Botao>
            <Botao
              variante="perigo"
              carregando={!!recusando && ocupado === recusando.id}
              onClick={async () => {
                if (!recusando) return;
                if (motivo.trim().length < 3) return setErroMotivo("Diga o motivo (fica registrado no painel).");
                if (await decidir(recusando, { decisao: "recusar", motivo: motivo.trim() })) setRecusando(null);
              }}
            >
              Recusar
            </Botao>
          </>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Motivo" erro={erroMotivo} ajuda="Ex.: horas de reservas que não foram jogadas.">
            {(id, inv) => <AreaTexto id={id} aria-invalid={inv} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          <Aviso tom="atencao">As horas usadas neste pedido não voltam para a cartela do atleta.</Aviso>
        </div>
      </Janela>
    </Cartao>
  );
}
