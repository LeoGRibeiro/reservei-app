/**
 * @file PaginaHoje.tsx
 * @description Tela inicial do painel (`/admin`): o que está acontecendo na arena hoje. Quem está em
 * quadra agora, os próximos horários, o que falta receber no balcão, Pix para conferir e devoluções
 * pendentes. Gerente e dono também veem o recebido, a ocupação do dia e as horas grátis do Clube
 * esperando liberação.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano F, tela Hoje)
 */

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { CabecalhoPagina, Cartao, EstadoVazio, Numero, StatusReserva, Tabela, Td, Tr, classeBotao } from "@/components/admin/ui";
import { PainelPagamentosAConfirmar } from "@/components/admin/PainelPagamentosAConfirmar";
import { AvisoHorasGratis } from "./AvisoHorasGratis";
import { usePainel } from "@/components/admin/painel/ContextoPainel";
import { useReservasService } from "@/hooks/useReservasService";
import { descreverQuadra, useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { LockService } from "@/lib/pagamento/lockService";
import { dataCurta, dataExtensa, moeda } from "@/lib/admin/formatos";
import { hrefReserva } from "@/lib/admin/navegacao";
import { getHoje } from "@/lib/constants";
import type { Reserva } from "@/store/useReservasStore";
import { useRouter } from "next/navigation";

const ehBloqueio = (r: Reserva) => r.tipoReserva === "manutencao_bloqueio";
const ehCliente = (r: Reserva) => !r.tipoReserva || r.tipoReserva === "avulsa" || r.tipoReserva === "admin_manual";

/** Horário de catálogo em andamento agora (o último que já começou), ou null antes da abertura. */
export function horarioAtual(horarios: string[], agora: Date = new Date()): string | null {
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const iniciados = horarios.filter((h) => h <= hhmm);
  return iniciados.length > 0 ? iniciados[iniciados.length - 1] : null;
}

/**
 * Números do dia a partir das reservas carregadas.
 *
 * @param reservas Reservas da janela
 * @param hoje Data de hoje (YYYY-MM-DD)
 * @param totalHorarios Quadras × horários do dia (para a ocupação)
 */
export function resumoDoDia(reservas: Reserva[], hoje: string, totalHorarios: number, agora: Date = new Date()) {
  const doDia = reservas.filter((r) => r.data === hoje && LockService.isReservaOcupandoSlot(r, agora));
  const clientes = doDia.filter(ehCliente);
  const ativas = clientes.filter((r) => r.status === "pendente" || r.status === "confirmada");
  const horasOcupadas = doDia.filter((r) => !ehBloqueio(r)).reduce((acc, r) => acc + r.horarios.length, 0);
  return {
    doDia,
    reservas: clientes.length,
    recebido: ativas.reduce((acc, r) => acc + Math.max(0, (Number(r.valorTotal) || 0) - (Number(r.valorPendente) || 0)), 0),
    aReceber: ativas.filter((r) => r.status === "pendente").reduce((acc, r) => acc + (Number(r.valorPendente) || 0), 0),
    ocupacao: totalHorarios > 0 ? Math.round((horasOcupadas / totalHorarios) * 100) : 0,
  };
}

export function PaginaHoje() {
  const { arenaSlug, pode } = usePainel();
  const { reservas } = useReservasService();
  const quadras = useQuadrasCatalogo();
  const horarios = useHorariosCatalogo();
  const router = useRouter();
  const hoje = getHoje();
  const agora = new Date();
  const atual = horarioAtual(horarios, agora);
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

  const resumo = useMemo(() => resumoDoDia(reservas, hoje, quadras.length * horarios.length), [reservas, hoje, quadras.length, horarios.length]);
  const proximas = resumo.doDia.filter((r) => !ehBloqueio(r) && r.horaFim > hhmm).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.quadraId.localeCompare(b.quadraId));
  const devolucoes = reservas.filter((r) => r.status === "cancelada" && r.reembolsoStatus === "pendente").sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Hoje"
        descricao={dataExtensa(hoje)}
        acoes={
          <Link href="/admin/agenda" className={classeBotao("secundario")}>
            <CalendarDays className="size-4" /> Abrir agenda
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Reservas hoje" valor={resumo.reservas} />
        <Numero rotulo="Falta receber hoje" valor={moeda(resumo.aReceber)} detalhe="no balcão" />
        {pode("ver_receita") && <Numero rotulo="Já recebido (jogos de hoje)" valor={moeda(resumo.recebido)} />}
        {pode("ver_receita") && <Numero rotulo="Ocupação do dia" valor={`${resumo.ocupacao}%`} detalhe="dos horários de todas as quadras" />}
      </div>

      {pode("analisar_voucher") && <AvisoHorasGratis />}
      <PainelPagamentosAConfirmar arenaSlug={arenaSlug} />

      <Cartao titulo="Agora em quadra" descricao={atual ? `Horário das ${atual}` : "A arena ainda não abriu."}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quadras.map((q) => {
            const r = atual ? resumo.doDia.find((x) => x.quadraId === q.id && x.horarios.includes(atual)) : undefined;
            const seguinte = resumo.doDia.filter((x) => x.quadraId === q.id && x.horaInicio > hhmm).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0];
            return (
              <li key={q.id} className="rounded-md border border-painel-linha p-3">
                <p className="text-xs font-medium text-painel-suave">{q.descricao}</p>
                {r ? (
                  ehBloqueio(r) ? (
                    <p className="mt-1 text-sm font-medium text-painel-tinta">Bloqueado</p>
                  ) : (
                    <Link href={hrefReserva(r.id)} className="mt-1 block text-sm font-medium text-painel-tinta hover:underline">
                      {r.nomeCliente} <span className="font-normal text-painel-suave">até {r.horaFim}</span>
                    </Link>
                  )
                ) : (
                  <p className="mt-1 text-sm text-painel-suave">Livre</p>
                )}
                {r && !ehBloqueio(r) && <StatusReserva reserva={r} className="mt-1.5" />}
                {seguinte && (
                  <p className="mt-2 text-xs text-painel-suave">
                    Depois: {seguinte.horaInicio} · {ehBloqueio(seguinte) ? "bloqueado" : seguinte.nomeCliente}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Cartao>

      <Cartao titulo="Próximos horários de hoje" semPadding>
        {proximas.length === 0 ? (
          <EstadoVazio titulo="Nada mais marcado para hoje" descricao="Novas reservas do site aparecem aqui na hora." />
        ) : (
          <Tabela rotulo="Próximos horários" cabecalho={["Horário", "Quadra", "Cliente", "Situação"]}>
            {proximas.map((r) => (
              <Tr key={r.id} onClick={() => router.push(hrefReserva(r.id))}>
                <Td className="whitespace-nowrap tabular-nums">
                  {r.horaInicio}–{r.horaFim}
                </Td>
                <Td className="whitespace-nowrap">{descreverQuadra(r.quadraId, quadras)}</Td>
                <Td>
                  <Link href={hrefReserva(r.id)} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {r.nomeCliente}
                  </Link>
                </Td>
                <Td>
                  <StatusReserva reserva={r} />
                </Td>
              </Tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      {devolucoes.length > 0 && (
        <Cartao titulo={`Devoluções pendentes (${devolucoes.length})`} descricao="Reservas canceladas em que o sinal ainda precisa voltar para o cliente." semPadding>
          <ul className="divide-y divide-painel-linha">
            {devolucoes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <Link href={hrefReserva(r.id)} className="font-medium hover:underline">
                    {r.nomeCliente}
                  </Link>{" "}
                  <span className="text-painel-suave">
                    · {moeda(r.reembolsoValor)} · jogo de {dataCurta(r.data)}
                  </span>
                </span>
                <Link href={hrefReserva(r.id)} className={classeBotao("secundario", "sm")}>
                  Registrar devolução
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
