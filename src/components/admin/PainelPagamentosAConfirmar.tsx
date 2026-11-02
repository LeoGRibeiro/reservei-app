/**
 * @file PainelPagamentosAConfirmar.tsx
 * @description Fila de Pix "já paguei" (chave Pix direta da arena) esperando o balcão conferir no
 * extrato. Confirmar garante a reserva; recusar (com motivo) libera o horário. As decisões passam pelo
 * servidor, que confere o vínculo do operador com a arena.
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { chamarApi } from "@/lib/api/clienteApi";
import { useReservasService } from "@/hooks/useReservasService";
import { descreverQuadra, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { dataCurta, linkWhatsApp, moeda } from "@/lib/admin/formatos";
import { hrefReserva } from "@/lib/admin/navegacao";
import { Botao, Campo, Cartao, Entrada, Etiqueta, Janela } from "@/components/admin/ui";
import type { Reserva } from "@/store/useReservasStore";

/** Minutos depois do aviso do atleta em que o pedido aparece como atrasado. */
const MINUTOS_ATRASO = 30;

/**
 * Reservas com Pix manual informado pelo atleta e ainda não conferido, da mais antiga para a mais nova.
 *
 * @param reservas Reservas carregadas
 */
export function filtrarPagamentosAConfirmar(reservas: Reserva[]): Reserva[] {
  return reservas
    .filter((r) => r.status === "em_processamento" && r.gatewayProvedor === "manual" && Boolean(r.pagamentoInformadoEm))
    .sort((a, b) => String(a.pagamentoInformadoEm).localeCompare(String(b.pagamentoInformadoEm)));
}

/**
 * Minutos desde que o atleta avisou que pagou.
 *
 * @param informadoEm Instante ISO do aviso
 * @param agora Instante de referência
 */
export function minutosDesde(informadoEm: string | undefined, agora: Date = new Date()): number {
  if (!informadoEm) return 0;
  return Math.max(0, Math.floor((agora.getTime() - new Date(informadoEm).getTime()) / 60000));
}

export function PainelPagamentosAConfirmar({ arenaSlug }: { arenaSlug: string }) {
  const { reservas, recarregarReservas } = useReservasService();
  const quadras = useQuadrasCatalogo();
  const fila = useMemo(() => filtrarPagamentosAConfirmar(reservas), [reservas]);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<Reserva | null>(null);
  const [motivo, setMotivo] = useState("");

  if (fila.length === 0) return null;

  const decidir = async (reserva: Reserva, acao: "confirmar" | "recusar", motivoRecusa = "") => {
    setOcupadoId(reserva.id);
    const res = await chamarApi("/api/admin/pagamentos/manual", {
      method: "POST",
      corpo: { arenaSlug, reservaId: reserva.id, acao, motivo: motivoRecusa },
    });
    setOcupadoId(null);
    if (!res.ok) {
      toast.error(res.erro);
      return false;
    }
    toast.success(acao === "confirmar" ? "Pagamento confirmado. Reserva garantida." : "Pagamento recusado. Horário liberado.");
    await recarregarReservas();
    return true;
  };

  return (
    <Cartao titulo={`Pix para conferir (${fila.length})`} descricao="Confira no extrato do banco da arena se o Pix caiu antes de confirmar." semPadding>
      <ul className="divide-y divide-painel-linha">
        {fila.map((r) => {
          const minutos = minutosDesde(r.pagamentoInformadoEm);
          return (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <Link href={hrefReserva(r.id)} className="font-medium text-painel-tinta hover:underline">
                  {r.nomeCliente}
                </Link>{" "}
                <span className="text-painel-suave">
                  · {moeda(r.pixValor ?? r.valorSinal)} · {descreverQuadra(r.quadraId, quadras)} · {dataCurta(r.data)} {r.horaInicio}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-painel-suave">
                  <span>Avisou há {minutos} min</span>
                  {minutos >= MINUTOS_ATRASO && <Etiqueta tom="sinal">Esperando há muito tempo</Etiqueta>}
                  {r.whatsappCliente && (
                    <a className="text-painel-destaque hover:underline" href={linkWhatsApp(r.whatsappCliente)} target="_blank" rel="noopener noreferrer">
                      Falar no WhatsApp
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Botao tamanho="sm" variante="secundario" disabled={ocupadoId !== null} onClick={() => setRecusando(r)}>
                  Não caiu
                </Botao>
                <Botao tamanho="sm" carregando={ocupadoId === r.id} disabled={ocupadoId !== null} onClick={() => decidir(r, "confirmar")}>
                  Confirmar Pix
                </Botao>
              </div>
            </li>
          );
        })}
      </ul>
      <Janela
        aberta={!!recusando}
        titulo="Recusar o Pix"
        descricao="A reserva é cancelada e o horário volta a ficar livre."
        largura="sm"
        aoFechar={() => setRecusando(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setRecusando(null)}>Voltar</Botao>
            <Botao
              variante="perigo"
              disabled={motivo.trim().length < 3}
              carregando={ocupadoId === recusando?.id}
              onClick={async () => {
                if (recusando && (await decidir(recusando, "recusar", motivo.trim()))) {
                  setRecusando(null);
                  setMotivo("");
                }
              }}
            >
              Recusar Pix
            </Botao>
          </>
        }
      >
        <Campo rotulo="Motivo" ajuda="O atleta vê este motivo.">
          {(id) => <Entrada id={id} value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: o Pix não caiu no extrato" />}
        </Campo>
      </Janela>
    </Cartao>
  );
}
