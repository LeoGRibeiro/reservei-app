/**
 * @file JanelaFechamento.tsx
 * @description Fechar a quadra inteira por um período (reforma, evento): de uma data até outra ou
 * "até eu liberar", com motivo. Antes de confirmar, lista as reservas que já caem no período: elas
 * continuam valendo e o dono decide cancelar ou remarcar pela Agenda. O banco barra reservas novas.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8.4
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, Botao, Caixa, Campo, Entrada, Janela, Selecao } from "@/components/admin/ui";
import { MOTIVO_BLOQUEIO_MAX, MOTIVOS_FECHAMENTO, validarFechamento, type ErrosFechamento } from "@/lib/arena/bloqueioQuadra";
import { formatarDataExibicao, getHoje } from "@/lib/constants";
import { hrefReserva } from "@/lib/admin/navegacao";
import type { ReservaNoCaminho } from "@/lib/supabase/reservasService";

/** Dados do fechamento (fim vazio = até liberar). */
export interface DadosFechamento {
  inicio: string;
  fim: string;
  motivo: string;
}

export interface JanelaFechamentoProps {
  nomeQuadra: string;
  aoFechar: () => void;
  /** Busca as reservas ativas no período (null = falhou) */
  aoBuscarReservas: (inicio: string, fim: string | null) => Promise<ReservaNoCaminho[] | null>;
  aoConfirmar: (dados: DadosFechamento) => Promise<void>;
}

/**
 * @example
 * ```tsx
 * <JanelaFechamento nomeQuadra="Areia 2" aoFechar={f} aoBuscarReservas={buscar} aoConfirmar={fechar} />
 * ```
 */
export function JanelaFechamento({ nomeQuadra, aoFechar, aoBuscarReservas, aoConfirmar }: JanelaFechamentoProps) {
  const hoje = getHoje();
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(hoje);
  const [ateLiberar, setAteLiberar] = useState(false);
  const [tipoMotivo, setTipoMotivo] = useState<string>(MOTIVOS_FECHAMENTO[0]);
  const [detalhe, setDetalhe] = useState("");
  const [erros, setErros] = useState<ErrosFechamento>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<{ chave: string; reservas: ReservaNoCaminho[] | null } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const fimEfetivo = ateLiberar ? "" : fim;
  const motivo = tipoMotivo === "Outro" ? detalhe.trim() : detalhe.trim() ? `${tipoMotivo} (${detalhe.trim()})` : tipoMotivo;
  const periodoValido = !!inicio && !(fimEfetivo && fimEfetivo < inicio);
  const chave = `${inicio}|${fimEfetivo}`;
  // undefined = conferindo; null = falhou; lista = resultado do período atual
  const reservas = !periodoValido ? [] : consulta?.chave === chave ? consulta.reservas : undefined;

  // Reservas que já caem no período escolhido
  useEffect(() => {
    if (!periodoValido) return;
    let ativo = true;
    aoBuscarReservas(inicio, fimEfetivo || null).then((r) => {
      if (ativo) setConsulta({ chave: `${inicio}|${fimEfetivo}`, reservas: r });
    });
    return () => {
      ativo = false;
    };
  }, [inicio, fimEfetivo, periodoValido, aoBuscarReservas]);

  async function confirmar() {
    const encontrados = validarFechamento({ inicio, fim: fimEfetivo, motivo }, hoje);
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    setSalvando(true);
    setErroGeral(null);
    try {
      await aoConfirmar({ inicio, fim: fimEfetivo, motivo });
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Não foi possível fechar a quadra.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      aberta
      titulo={`Fechar ${nomeQuadra}`}
      descricao="Reforma, evento ou torneio. No período, o site mostra os horários como “Indisponível” e ninguém reserva, nem pelo balcão."
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={() => void confirmar()} carregando={salvando}>
            Fechar a quadra
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Primeiro dia fechado" erro={erros.inicio}>
            {(id, inv) => <Entrada id={id} type="date" min={hoje} aria-invalid={inv} value={inicio} onChange={(e) => setInicio(e.target.value)} />}
          </Campo>
          <Campo rotulo="Último dia fechado" erro={erros.fim}>
            {(id, inv) => (
              <Entrada id={id} type="date" min={inicio} aria-invalid={inv} value={ateLiberar ? "" : fim} disabled={ateLiberar} onChange={(e) => setFim(e.target.value)} />
            )}
          </Campo>
        </div>
        <Caixa rotulo="Até eu liberar" descricao="Sem data para reabrir. Você reabre em Quadras e preços." checked={ateLiberar} onChange={(e) => setAteLiberar(e.target.checked)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Motivo" erro={erros.motivo}>
            {(id) => (
              <Selecao id={id} value={tipoMotivo} onChange={(e) => setTipoMotivo(e.target.value)}>
                {MOTIVOS_FECHAMENTO.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Detalhe" opcional={tipoMotivo !== "Outro"} ajuda="O site mostra o motivo para o atleta.">
            {(id) => <Entrada id={id} value={detalhe} maxLength={MOTIVO_BLOQUEIO_MAX - 20} placeholder="Ex.: troca da areia" onChange={(e) => setDetalhe(e.target.value)} />}
          </Campo>
        </div>

        {reservas === undefined ? (
          <p className="text-sm text-painel-suave" role="status">
            Conferindo reservas no período...
          </p>
        ) : reservas === null ? (
          <Aviso tom="erro">Não foi possível conferir as reservas do período. Confira a Agenda antes de fechar.</Aviso>
        ) : reservas.length === 0 ? (
          <Aviso tom="sucesso">Nenhuma reserva neste período.</Aviso>
        ) : (
          <Aviso tom="atencao" titulo={`${reservas.length === 100 ? "100 ou mais" : reservas.length} reserva(s) já marcada(s) neste período`}>
            <p>Elas continuam valendo. Cancele ou remarque cada uma pela Agenda, se for o caso.</p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {reservas.map((r) => (
                <li key={r.id}>
                  <Link href={hrefReserva(r.id)} className="underline underline-offset-2" target="_blank">
                    {formatarDataExibicao(r.data)} · {r.horaInicio}–{r.horaFim} · {r.nomeCliente || "Reserva"}
                  </Link>
                </li>
              ))}
            </ul>
          </Aviso>
        )}
        {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
      </div>
    </Janela>
  );
}
