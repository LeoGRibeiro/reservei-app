/**
 * @file DetalheReserva.tsx
 * @description Tela única do detalhe da reserva (`/admin/reservas/{id}`): quem, onde, quando, quanto
 * já pagou e quanto falta, as ações do balcão (receber, remarcar, cancelar, não compareceu, WhatsApp)
 * e o histórico de quem fez o quê. Substitui as duas telas antigas de detalhe.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Planos D, E e F)
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, MessageCircle, Wallet, XCircle, UserX, UserCheck } from "lucide-react";
import { Aviso, Botao, Cartao, Carregando, CabecalhoPagina, EstadoVazio, LinhaDetalhe, StatusReserva, classeBotao } from "@/components/admin/ui";
import { usePainel } from "@/components/admin/painel/ContextoPainel";
import { useReservaDetalhe } from "@/hooks/useReservaDetalhe";
import { dataExtensa, dataHora, linkWhatsApp, moeda, telefone } from "@/lib/admin/formatos";
import { descreverQuadra } from "@/store/useCatalogoArenaStore";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { getHoje } from "@/lib/constants";
import { FORMAS_PAGAMENTO } from "@/lib/reservas/formasPagamento";
import type { Reserva } from "@/store/useReservasStore";
import type { EventoReserva } from "@/lib/supabase/reservasService";
import { JanelaCancelar, JanelaQuitar, JanelaRemarcar, valorPago } from "./JanelasBalcao";

type JanelaAberta = "quitar" | "cancelar" | "remarcar" | null;

const ROTULO_SINAL: Record<string, string> = {
  devolvido: "sinal devolvido",
  devolver_depois: "sinal a devolver",
  retido: "sinal ficou com a arena",
  sem_pagamento: "sem pagamento",
};

/** Frase de um evento do histórico. */
export function descreverEvento(e: EventoReserva, nomeQuadra: (id: string) => string): string {
  const d = e.detalhes;
  switch (e.tipo) {
    case "quitada": {
      const forma = FORMAS_PAGAMENTO[d.forma as keyof typeof FORMAS_PAGAMENTO] ?? String(d.forma ?? "");
      const desconto = Number(d.desconto) > 0 ? ` (desconto de ${moeda(Number(d.desconto))}: ${d.motivo})` : "";
      return `Recebeu ${moeda(Number(d.valor))} em ${forma.toLowerCase()}${desconto}`;
    }
    case "cancelada":
      return `Cancelou: ${d.motivo} · ${ROTULO_SINAL[String(d.sinal)] ?? ""}`;
    case "remarcada": {
      const de = d.de as { data: string; horarios: string[]; quadraId: string };
      const para = d.para as { data: string; horarios: string[]; quadraId: string };
      const dif = Number(d.diferenca) || 0;
      const valor = dif > 0 ? ` · diferença de ${moeda(dif)} a receber` : Number(d.credito) > 0 ? ` · crédito de ${moeda(Number(d.credito))}` : "";
      return `Remarcou de ${dataExtensa(de.data, false)} ${de.horarios[0]} (${nomeQuadra(de.quadraId)}) para ${dataExtensa(para.data, false)} ${para.horarios[0]} (${nomeQuadra(para.quadraId)})${valor}`;
    }
    case "nao_compareceu":
      return "Marcou que o cliente não compareceu";
    case "compareceu":
      return "Desfez o \"não compareceu\"";
    case "devolucao_registrada":
      return `Registrou a devolução de ${moeda(Number(d.valor))}`;
    default:
      return e.tipo;
  }
}

function mensagens(r: Reserva, nomeArena: string, quadra: string) {
  const quando = `${dataExtensa(r.data, false)}, das ${r.horaInicio} às ${r.horaFim}`;
  const falta = Number(r.valorPendente) || 0;
  return {
    confirmacao: `Olá, ${r.nomeCliente}! Sua reserva na ${nomeArena} está confirmada: ${quadra}, ${quando}.${falta > 0 ? ` Fica ${moeda(falta)} para pagar no balcão.` : ""}`,
    cobranca: `Olá, ${r.nomeCliente}! Lembrando da sua reserva na ${nomeArena} (${quadra}, ${quando}): fica ${moeda(falta)} para pagar no balcão.`,
  };
}

export function DetalheReserva({ reservaId }: { reservaId: string }) {
  const { arena, arenaSlug } = usePainel();
  const quadras = useQuadrasCatalogo();
  const { reserva, estado, eventos, executar, ocupado } = useReservaDetalhe(reservaId, arenaSlug);
  const [janela, setJanela] = useState<JanelaAberta>(null);
  const nomeQuadra = (id: string) => descreverQuadra(id, quadras);

  if (estado === "carregando") return <Carregando texto="Abrindo a reserva..." />;
  if (!reserva) {
    return (
      <EstadoVazio
        titulo={estado === "erro" ? "Não foi possível abrir a reserva" : "Reserva não encontrada"}
        descricao={estado === "erro" ? "Confira a conexão e tente de novo." : "Ela pode ter sido apagada ou ser de outra arena."}
        acao={
          <Link href="/admin/agenda" className={classeBotao("secundario")}>
            Ir para a agenda
          </Link>
        }
      />
    );
  }

  const quadra = nomeQuadra(reserva.quadraId);
  const ehCliente = !reserva.tipoReserva || reserva.tipoReserva === "avulsa" || reserva.tipoReserva === "admin_manual";
  const ativa = reserva.status === "pendente" || reserva.status === "confirmada";
  const falta = Number(reserva.valorPendente) || 0;
  const pago = valorPago(reserva);
  const hoje = getHoje();
  const msgs = mensagens(reserva, arena.nome, quadra);

  const concluir = (mensagem: string) => {
    setJanela(null);
    toast.success(mensagem);
  };
  const comparecimento = async (compareceu: boolean) => {
    const r = await executar({ acao: "comparecimento", compareceu });
    if (r.ok) toast.success(compareceu ? "Marcação desfeita." : "Registrado: o cliente não compareceu.");
    else toast.error(r.erro);
  };
  const registrarDevolucao = async () => {
    const r = await executar({ acao: "registrar_devolucao" });
    if (r.ok) toast.success("Devolução registrada.");
    else toast.error(r.erro);
  };

  return (
    <div className="space-y-5">
      <Link href={`/admin/agenda?data=${reserva.data}`} className="inline-flex items-center gap-1.5 text-sm text-painel-suave hover:text-painel-tinta">
        <ArrowLeft className="size-4" /> Agenda de {dataExtensa(reserva.data, false)}
      </Link>

      <CabecalhoPagina
        titulo={reserva.tipoReserva === "manutencao_bloqueio" ? "Horário bloqueado" : reserva.nomeCliente || "Reserva"}
        descricao={`${quadra} · ${dataExtensa(reserva.data)} · ${reserva.horaInicio} às ${reserva.horaFim}`}
        acoes={<StatusReserva reserva={reserva} />}
      />

      {!ehCliente && (
        <Aviso tom="info" titulo={reserva.tipoReserva === "manutencao_bloqueio" ? "Bloqueio de horário" : "Sessão de turma ou grupo"}>
          {reserva.tipoReserva === "manutencao_bloqueio" ? (
            <>Para liberar este horário, remova o bloqueio na agenda.</>
          ) : (
            <>
              Esta sessão é gerenciada em{" "}
              <Link className="underline" href={reserva.tipoReserva === "grupo" ? "/admin/grupos" : "/admin/escolinhas"}>
                {reserva.tipoReserva === "grupo" ? "Grupos" : "Escolinhas"}
              </Link>
              .
            </>
          )}
        </Aviso>
      )}
      {reserva.naoCompareceu && <Aviso tom="atencao" titulo="O cliente não compareceu" />}
      {reserva.status === "cancelada" && (
        <Aviso
          tom={reserva.reembolsoStatus === "pendente" ? "atencao" : "info"}
          titulo={`Cancelada${reserva.canceladaEm ? ` em ${dataHora(reserva.canceladaEm)}` : ""}`}
          acoes={
            reserva.reembolsoStatus === "pendente" ? (
              <Botao tamanho="sm" variante="secundario" onClick={registrarDevolucao} carregando={ocupado}>
                Já devolvi
              </Botao>
            ) : undefined
          }
        >
          {reserva.motivoCancelamento && <p>Motivo: {reserva.motivoCancelamento}</p>}
          {reserva.reembolsoStatus === "pendente" && <p>Falta devolver {moeda(reserva.reembolsoValor)} ao cliente.</p>}
          {reserva.reembolsoStatus === "reembolsado" && <p>Sinal de {moeda(reserva.reembolsoValor)} devolvido.</p>}
          {reserva.reembolsoStatus === "retido" && <p>O sinal ficou com a arena.</p>}
        </Aviso>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {ehCliente && (
            <Cartao titulo="Pagamento">
              <dl className="divide-y divide-painel-linha">
                <LinhaDetalhe rotulo="Valor da reserva">{moeda(reserva.valorTotal)}</LinhaDetalhe>
                {Number(reserva.descontoFidelidade) > 0 && <LinhaDetalhe rotulo="Desconto do Clube">{moeda(reserva.descontoFidelidade)}</LinhaDetalhe>}
                <LinhaDetalhe rotulo="Já pago">
                  {moeda(pago)}
                  {reserva.formaPagamentoRestante && falta === 0 && pago > 0 && (
                    <span className="text-painel-suave"> · restante em {FORMAS_PAGAMENTO[reserva.formaPagamentoRestante].toLowerCase()}</span>
                  )}
                </LinhaDetalhe>
                <LinhaDetalhe rotulo="Falta receber">
                  <span className={falta > 0 && ativa ? "font-semibold text-amber-800" : ""}>{moeda(ativa ? falta : 0)}</span>
                </LinhaDetalhe>
              </dl>
            </Cartao>
          )}

          <Cartao titulo={ehCliente ? "Cliente" : "Detalhes"}>
            <dl className="divide-y divide-painel-linha">
              {ehCliente && <LinhaDetalhe rotulo="Nome">{reserva.nomeCliente}</LinhaDetalhe>}
              {reserva.whatsappCliente && (
                <LinhaDetalhe rotulo="WhatsApp">
                  <a className="text-painel-destaque underline-offset-2 hover:underline" href={linkWhatsApp(reserva.whatsappCliente)} target="_blank" rel="noopener noreferrer">
                    {telefone(reserva.whatsappCliente)}
                  </a>
                </LinhaDetalhe>
              )}
              {ehCliente && <LinhaDetalhe rotulo="Conta no site">{reserva.userId ? "Sim" : "Não (reservou sem conta ou no balcão)"}</LinhaDetalhe>}
              {reserva.esporte && <LinhaDetalhe rotulo="Esporte">{reserva.esporte}</LinhaDetalhe>}
              {reserva.observacoes && <LinhaDetalhe rotulo="Observações">{reserva.observacoes}</LinhaDetalhe>}
              <LinhaDetalhe rotulo="Criada em">{dataHora(reserva.criadaEm)}</LinhaDetalhe>
            </dl>
          </Cartao>

          <Cartao titulo="Histórico" descricao="Quem fez o quê nesta reserva.">
            {eventos.length === 0 ? (
              <p className="text-sm text-painel-suave">Nenhuma ação do balcão registrada ainda.</p>
            ) : (
              <ol className="space-y-3">
                {eventos.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-painel-tinta">{descreverEvento(e, nomeQuadra)}</p>
                    <p className="text-xs text-painel-suave">
                      {dataHora(e.criadoEm)}
                      {e.autorNome ? ` · ${e.autorNome}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
        </div>

        {ehCliente && (
          <aside className="space-y-5">
            <Cartao titulo="Ações">
              <div className="flex flex-col gap-2">
                {ativa && falta > 0 && (
                  <Botao icone={Wallet} onClick={() => setJanela("quitar")}>
                    Receber {moeda(falta)}
                  </Botao>
                )}
                {ativa && reserva.data >= hoje && (
                  <Botao variante="secundario" icone={CalendarClock} onClick={() => setJanela("remarcar")}>
                    Remarcar
                  </Botao>
                )}
                {ativa && reserva.data <= hoje && (
                  <Botao variante="secundario" icone={reserva.naoCompareceu ? UserCheck : UserX} onClick={() => comparecimento(!!reserva.naoCompareceu)} carregando={ocupado}>
                    {reserva.naoCompareceu ? "Desfazer \"não compareceu\"" : "Não compareceu"}
                  </Botao>
                )}
                {reserva.status !== "cancelada" && (
                  <Botao variante="perigo" icone={XCircle} onClick={() => setJanela("cancelar")}>
                    Cancelar reserva
                  </Botao>
                )}
                {reserva.status === "cancelada" && <p className="text-sm text-painel-suave">Reserva cancelada: sem ações.</p>}
              </div>
            </Cartao>

            {reserva.whatsappCliente && (
              <Cartao titulo="WhatsApp" descricao="Abre a conversa com a mensagem pronta para você revisar e enviar.">
                <div className="flex flex-col gap-2">
                  <a className={classeBotao("secundario")} href={linkWhatsApp(reserva.whatsappCliente, msgs.confirmacao)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" /> Enviar confirmação
                  </a>
                  {ativa && falta > 0 && (
                    <a className={classeBotao("secundario")} href={linkWhatsApp(reserva.whatsappCliente, msgs.cobranca)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="size-4" /> Lembrar do restante
                    </a>
                  )}
                </div>
              </Cartao>
            )}
          </aside>
        )}
      </div>

      {janela === "quitar" && <JanelaQuitar reserva={reserva} aberta aoFechar={() => setJanela(null)} executar={executar} aoConcluir={concluir} />}
      {janela === "cancelar" && (
        <JanelaCancelar reserva={reserva} aberta aoFechar={() => setJanela(null)} executar={executar} aoConcluir={concluir} politica={arena.politicaCancelamento} />
      )}
      {janela === "remarcar" && <JanelaRemarcar reserva={reserva} aberta aoFechar={() => setJanela(null)} executar={executar} aoConcluir={concluir} />}
    </div>
  );
}
