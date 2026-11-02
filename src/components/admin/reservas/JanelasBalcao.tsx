/**
 * @file JanelasBalcao.tsx
 * @description Janelas das ações do balcão sobre uma reserva: receber o restante (com a forma de
 * pagamento), cancelar (dizendo o que acontece com o sinal) e remarcar (dia, quadra e horário livres).
 * Cada janela explica a consequência antes de confirmar e mostra o erro do servidor sem fechar.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano E)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { Aviso, Botao, Campo, Entrada, Janela, OpcaoCartao, Selecao, AreaTexto } from "@/components/admin/ui";
import { moeda } from "@/lib/admin/formatos";
import { getHoje } from "@/lib/constants";
import { LockService } from "@/lib/pagamento/lockService";
import { useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { useReservasService } from "@/hooks/useReservasService";
import type { Reserva } from "@/store/useReservasStore";
import type { AcaoBalcao, DestinoSinal, FormaPagamento } from "@/lib/reservas/balcaoServidorService";

type Executar = (acao: AcaoBalcao) => Promise<{ ok: true; reserva: Reserva } | { ok: false; erro: string }>;

interface JanelaBase {
  reserva: Reserva;
  aberta: boolean;
  aoFechar: () => void;
  executar: Executar;
  /** Chamado depois que o servidor confirmou */
  aoConcluir: (mensagem: string) => void;
}

/** Valor pago até agora (total menos o que falta). */
export const valorPago = (r: Pick<Reserva, "valorTotal" | "valorPendente">) => Math.max(0, (Number(r.valorTotal) || 0) - (Number(r.valorPendente) || 0));

// ─── Receber o restante ──────────────────────────────────────────────────────

const FORMAS: { id: FormaPagamento; rotulo: string }[] = [
  { id: "dinheiro", rotulo: "Dinheiro" },
  { id: "pix", rotulo: "Pix" },
  { id: "cartao", rotulo: "Cartão" },
];

export function JanelaQuitar({ reserva, aberta, aoFechar, executar, aoConcluir }: JanelaBase) {
  const falta = Number(reserva.valorPendente) || 0;
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [valor, setValor] = useState(falta.toFixed(2));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const recebido = Number(valor.replace(",", "."));
  const desconto = Number.isFinite(recebido) ? Math.max(0, falta - recebido) : 0;

  async function confirmar() {
    setErro(null);
    if (!forma) return setErro("Escolha como o cliente pagou.");
    if (!Number.isFinite(recebido) || recebido < 0 || recebido > falta + 0.009) return setErro(`Informe um valor entre R$ 0,00 e ${moeda(falta)}.`);
    if (desconto > 0.009 && motivo.trim().length < 3) return setErro("Recebeu menos que o restante: diga o motivo do desconto.");
    setEnviando(true);
    const r = await executar({ acao: "quitar", forma, valorRecebido: recebido, motivoDesconto: motivo.trim() || undefined });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoConcluir(`Recebido ${moeda(recebido)}. Reserva quitada.`);
  }

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Receber o restante"
      descricao={`Falta ${moeda(falta)} de ${reserva.nomeCliente}.`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={confirmar} carregando={enviando}>Confirmar recebimento</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-painel-tinta">Como o cliente pagou?</legend>
          <div className="grid grid-cols-3 gap-2">
            {FORMAS.map((f) => (
              <OpcaoCartao key={f.id} name="forma" rotulo={f.rotulo} checked={forma === f.id} onChange={() => setForma(f.id)} />
            ))}
          </div>
        </fieldset>
        <Campo rotulo="Valor recebido (R$)" ajuda="Já vem com o restante. Mude só se deu desconto.">
          {(id) => <Entrada id={id} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />}
        </Campo>
        {desconto > 0.009 && (
          <Campo rotulo="Motivo do desconto" ajuda={`Desconto de ${moeda(desconto)}. Fica registrado no histórico.`}>
            {(id) => <Entrada id={id} value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente fiel, atraso da quadra" />}
          </Campo>
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

// ─── Cancelar ────────────────────────────────────────────────────────────────

const MOTIVOS = ["Cliente desistiu", "Chuva", "Problema na quadra", "Remarcou por outro canal", "Outro"];

export function JanelaCancelar({ reserva, aberta, aoFechar, executar, aoConcluir, politica }: JanelaBase & { politica?: string }) {
  const pago = valorPago(reserva);
  const [motivoBase, setMotivoBase] = useState(MOTIVOS[0]);
  const [detalhe, setDetalhe] = useState("");
  const [destino, setDestino] = useState<DestinoSinal | null>(pago > 0 ? null : "sem_pagamento");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    const motivo = motivoBase === "Outro" ? detalhe.trim() : [motivoBase, detalhe.trim()].filter(Boolean).join(": ");
    if (motivo.length < 3) return setErro("Escreva o motivo do cancelamento.");
    if (!destino) return setErro("Diga o que acontece com o sinal.");
    setEnviando(true);
    const r = await executar({ acao: "cancelar", motivo, destinoSinal: destino });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoConcluir("Reserva cancelada. O horário foi liberado.");
  }

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Cancelar reserva"
      descricao="O horário volta a ficar livre na agenda e no site na hora."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao variante="perigo" onClick={confirmar} carregando={enviando}>Cancelar reserva</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Motivo">
          {(id) => (
            <Selecao id={id} value={motivoBase} onChange={(e) => setMotivoBase(e.target.value)}>
              {MOTIVOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo={motivoBase === "Outro" ? "Qual o motivo?" : "Detalhe"} opcional={motivoBase !== "Outro"}>
          {(id) => <AreaTexto id={id} value={detalhe} maxLength={250} onChange={(e) => setDetalhe(e.target.value)} className="min-h-16" />}
        </Campo>
        {pago > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-painel-tinta">O cliente pagou {moeda(pago)}. E o sinal?</legend>
            <OpcaoCartao name="destino" rotulo="Devolvi agora" descricao="Já fiz o Pix ou entreguei o dinheiro." checked={destino === "devolvido"} onChange={() => setDestino("devolvido")} />
            <OpcaoCartao
              name="destino"
              rotulo="Vou devolver depois"
              descricao="Fica na lista de devoluções da tela Hoje até você marcar que devolveu."
              checked={destino === "devolver_depois"}
              onChange={() => setDestino("devolver_depois")}
            />
            <OpcaoCartao name="destino" rotulo="O sinal fica com a arena" descricao="Cancelamento fora do prazo da política." checked={destino === "retido"} onChange={() => setDestino("retido")} />
            {politica && <p className="text-xs text-painel-suave">Política da arena: {politica}</p>}
          </fieldset>
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

// ─── Remarcar ────────────────────────────────────────────────────────────────

/** Horários livres de uma quadra num dia, ignorando a própria reserva. */
export function horariosLivres(todas: Reserva[], quadraId: string, data: string, horarios: string[], ignorarId: string, agora = new Date()): string[] {
  const ocupados = new Set(LockService.filtrarHorariosOcupadosComLock(todas.filter((r) => r.id !== ignorarId), quadraId, data, agora));
  const hoje = getHoje();
  const horaAgora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  return horarios.filter((h) => !ocupados.has(h) && (data > hoje || h > horaAgora));
}

export function JanelaRemarcar({ reserva, aberta, aoFechar, executar, aoConcluir }: JanelaBase) {
  const quadras = useQuadrasCatalogo();
  const horarios = useHorariosCatalogo();
  const { carregarPeriodo } = useReservasService();
  const [data, setData] = useState(reserva.data >= getHoje() ? reserva.data : getHoje());
  const [quadraId, setQuadraId] = useState(reserva.quadraId);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [doDia, setDoDia] = useState<Reserva[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    let ativo = true;
    carregarPeriodo(data, data).then((lista) => {
      if (ativo) setDoDia(lista);
    });
    return () => {
      ativo = false;
    };
  }, [aberta, data, carregarPeriodo]);

  const livres = useMemo(() => (doDia ? horariosLivres(doDia, quadraId, data, horarios, reserva.id) : []), [doDia, quadraId, data, horarios, reserva.id]);

  function alternar(h: string) {
    setEscolhidos((atual) => {
      if (atual.includes(h)) return atual.filter((x) => x !== h);
      const proximo = [...atual, h].sort();
      // Mantém só horários seguidos: começa de novo se o clique quebrar a sequência
      const indices = proximo.map((x) => horarios.indexOf(x));
      const seguidos = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
      return seguidos ? proximo : [h];
    });
  }

  async function confirmar() {
    setErro(null);
    if (escolhidos.length === 0) return setErro("Escolha o novo horário.");
    setEnviando(true);
    const pagoAntes = valorPago(reserva);
    const r = await executar({ acao: "remarcar", data, horarios: escolhidos, quadraId });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const credito = pagoAntes - (Number(r.reserva.valorTotal) || 0);
    const falta = Number(r.reserva.valorPendente) || 0;
    aoConcluir(
      credito > 0.009
        ? `Reserva remarcada. O novo horário custa menos: o cliente tem ${moeda(credito)} de crédito para devolver ou abater.`
        : falta > 0.009
          ? `Reserva remarcada. Falta receber ${moeda(falta)} no balcão.`
          : "Reserva remarcada."
    );
  }

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      largura="lg"
      titulo="Remarcar reserva"
      descricao="O pagamento continua valendo. O preço é recalculado: se custar mais, a diferença fica para receber; se custar menos, vira crédito do cliente."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={confirmar} carregando={enviando} disabled={escolhidos.length === 0}>
            Remarcar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nova data">
            {(id) => (
              <Entrada
                id={id}
                type="date"
                min={getHoje()}
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                  setEscolhidos([]);
                  setDoDia(null);
                }}
              />
            )}
          </Campo>
          <Campo rotulo="Quadra">
            {(id) => (
              <Selecao
                id={id}
                value={quadraId}
                onChange={(e) => {
                  setQuadraId(e.target.value);
                  setEscolhidos([]);
                }}
              >
                {quadras.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.descricao}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-painel-tinta">
            Horários livres <span className="font-normal text-painel-suave">(toque nos horários seguidos)</span>
          </legend>
          {!doDia ? (
            <p className="text-sm text-painel-suave">Conferindo a agenda...</p>
          ) : livres.length === 0 ? (
            <p className="text-sm text-painel-suave">Nenhum horário livre nesta quadra neste dia.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {livres.map((h) => {
                const marcado = escolhidos.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => alternar(h)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-sm tabular-nums",
                      marcado ? "border-painel-destaque bg-painel-destaque text-white" : "border-painel-linha-forte bg-painel-superficie hover:bg-painel-elevada"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}
