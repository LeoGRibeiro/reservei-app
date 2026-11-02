/**
 * @file PaginaFinanceiro.tsx
 * @description Financeiro do painel (`/admin/financeiro?mes=AAAA-MM`): números do período pelo dia do
 * jogo (recebido, a receber no balcão, descontos do Clube e devoluções), totais por quadra e por dia e
 * a lista de reservas paginada no banco, com filtros e exportação em CSV.
 *
 * Tudo é calculado no Postgres (`resumo_financeiro`): os números batem mesmo com milhares de reservas.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Planos C e F)
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Botao, CabecalhoPagina, Cartao, Carregando, EstadoVazio, Entrada, Numero, Paginacao, Selecao, StatusReserva, Tabela, Td, Tr } from "@/components/admin/ui";
import { buscarResumoFinanceiro, listarReservasFinanceiro, type ResumoFinanceiro, type SituacaoFinanceiro } from "@/lib/supabase/painelRepository";
import { descreverQuadra, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { dataCurta, descreverStatus, moeda, telefone } from "@/lib/admin/formatos";
import { hrefReserva } from "@/lib/admin/navegacao";
import { getNomeMesExtenso } from "@/lib/adminAgenda/adminAgendaService";
import { getHoje } from "@/lib/constants";
import type { Reserva } from "@/store/useReservasStore";

const POR_PAGINA = 50;

const SITUACOES: { id: SituacaoFinanceiro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "falta_pagar", rotulo: "Falta pagar" },
  { id: "quitadas", rotulo: "Quitadas" },
  { id: "canceladas", rotulo: "Canceladas" },
  { id: "aguardando_pix", rotulo: "Aguardando Pix" },
];

/** Primeiro e último dia de um mês "AAAA-MM". */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Mês vizinho ("2026-11" + 1 = "2026-12"). */
export function somarMes(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const pago = (r: Reserva) => Math.max(0, (Number(r.valorTotal) || 0) - (Number(r.valorPendente) || 0));

/** Linhas CSV (separador ";" para abrir direto no Excel em português). */
export function reservasParaCsv(reservas: Reserva[], nomeQuadra: (id: string) => string): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const valor = (n: number) => n.toFixed(2).replace(".", ",");
  const linhas = [["Data", "Início", "Fim", "Quadra", "Cliente", "WhatsApp", "Valor", "Pago", "Falta", "Situação"].map(esc).join(";")];
  for (const r of reservas) {
    linhas.push(
      [r.data, r.horaInicio, r.horaFim, nomeQuadra(r.quadraId), r.nomeCliente, telefone(r.whatsappCliente), valor(Number(r.valorTotal) || 0), valor(pago(r)), valor(r.status === "pendente" ? Number(r.valorPendente) || 0 : 0), descreverStatus(r).rotulo]
        .map(esc)
        .join(";")
    );
  }
  return linhas.join("\r\n");
}

export function PaginaFinanceiro() {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const quadras = useQuadrasCatalogo();
  const mes = /^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? (params.get("mes") as string) : getHoje().slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);
  const [ano, numMes] = mes.split("-").map(Number);

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<SituacaoFinanceiro>("todas");
  const [quadraId, setQuadraId] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<{ itens: Reserva[]; total: number } | null>(null);
  const [exportando, setExportando] = useState(false);
  const nomeQuadra = (id: string) => descreverQuadra(id, quadras);

  useEffect(() => {
    let ativo = true;
    buscarResumoFinanceiro(inicio, fim)
      .then((r) => ativo && (setResumo(r), setErro(null)))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [inicio, fim]);

  useEffect(() => {
    let ativo = true;
    listarReservasFinanceiro({ inicio, fim, situacao, quadraId: quadraId || undefined, busca: buscaAplicada, pagina, porPagina: POR_PAGINA })
      .then((r) => ativo && setLista(r))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [inicio, fim, situacao, quadraId, buscaAplicada, pagina]);

  function irParaMes(novo: string) {
    setPagina(1);
    setResumo(null);
    setLista(null);
    router.replace(`${caminho}?mes=${novo}`, { scroll: false });
  }

  async function exportar() {
    setExportando(true);
    try {
      const todas: Reserva[] = [];
      for (let p = 1; ; p++) {
        const r = await listarReservasFinanceiro({ inicio, fim, situacao, quadraId: quadraId || undefined, busca: buscaAplicada, pagina: p, porPagina: 1000 });
        todas.push(...r.itens);
        if (todas.length >= r.total || r.itens.length === 0) break;
      }
      const blob = new Blob(["﻿" + reservasParaCsv(todas, nomeQuadra)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reservas-${mes}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Valores pelo dia do jogo. Reservas canceladas e Pix não pagos ficam de fora dos totais."
        acoes={
          <div className="flex items-center gap-2">
            <Botao variante="secundario" tamanho="sm" aria-label="Mês anterior" onClick={() => irParaMes(somarMes(mes, -1))}>
              <ChevronLeft className="size-4" />
            </Botao>
            <span className="min-w-36 text-center text-sm font-medium">
              {getNomeMesExtenso(numMes)} de {ano}
            </span>
            <Botao variante="secundario" tamanho="sm" aria-label="Próximo mês" onClick={() => irParaMes(somarMes(mes, 1))}>
              <ChevronRight className="size-4" />
            </Botao>
          </div>
        }
      />

      {erro && <Aviso tom="erro" titulo="Não foi possível carregar o financeiro">{erro}</Aviso>}

      {!resumo && !erro ? (
        <Carregando />
      ) : (
        resumo && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Numero rotulo="Recebido" valor={moeda(resumo.recebido)} detalhe={`${resumo.reservas} reservas no mês`} />
              <Numero rotulo="Falta receber no balcão" valor={moeda(resumo.aReceber)} />
              <Numero rotulo="Descontos do Clube" valor={moeda(resumo.descontos)} detalhe={`Tabela: ${moeda(resumo.valorTabela)}`} />
              <Numero rotulo="Devolvido em cancelamentos" valor={moeda(resumo.devolvido)} detalhe={`${resumo.canceladas} canceladas`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Cartao titulo="Por quadra" semPadding>
                {resumo.porQuadra.length === 0 ? (
                  <EstadoVazio titulo="Sem reservas pagas no período" />
                ) : (
                  <Tabela rotulo="Por quadra" cabecalho={["Quadra", { rotulo: "Reservas", alinhar: "direita" }, { rotulo: "Recebido", alinhar: "direita" }, { rotulo: "Falta", alinhar: "direita" }]}>
                    {resumo.porQuadra.map((q) => (
                      <tr key={q.quadraId}>
                        <Td>{nomeQuadra(q.quadraId)}</Td>
                        <Td alinhar="direita" className="tabular-nums">{q.reservas}</Td>
                        <Td alinhar="direita" className="tabular-nums">{moeda(q.recebido)}</Td>
                        <Td alinhar="direita" className="tabular-nums">{moeda(q.aReceber)}</Td>
                      </tr>
                    ))}
                  </Tabela>
                )}
              </Cartao>
              <Cartao titulo="Por dia" semPadding>
                {resumo.porDia.length === 0 ? (
                  <EstadoVazio titulo="Sem reservas pagas no período" />
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <Tabela rotulo="Por dia" cabecalho={["Dia", { rotulo: "Recebido", alinhar: "direita" }, { rotulo: "Falta", alinhar: "direita" }]}>
                      {resumo.porDia.map((d) => (
                        <tr key={d.data}>
                          <Td>{dataCurta(d.data)}</Td>
                          <Td alinhar="direita" className="tabular-nums">{moeda(d.recebido)}</Td>
                          <Td alinhar="direita" className="tabular-nums">{moeda(d.aReceber)}</Td>
                        </tr>
                      ))}
                    </Tabela>
                  </div>
                )}
              </Cartao>
            </div>
          </>
        )
      )}

      <Cartao
        titulo="Reservas do mês"
        acoes={
          <Botao variante="secundario" tamanho="sm" icone={Download} carregando={exportando} onClick={exportar}>
            Exportar planilha
          </Botao>
        }
        semPadding
      >
        <div className="flex flex-wrap gap-2 border-b border-painel-linha px-4 py-3">
          <Selecao aria-label="Situação" className="w-auto" value={situacao} onChange={(e) => (setSituacao(e.target.value as SituacaoFinanceiro), setPagina(1))}>
            {SITUACOES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao aria-label="Quadra" className="w-auto" value={quadraId} onChange={(e) => (setQuadraId(e.target.value), setPagina(1))}>
            <option value="">Todas as quadras</option>
            {quadras.map((q) => (
              <option key={q.id} value={q.id}>
                {q.descricao}
              </option>
            ))}
          </Selecao>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPagina(1);
              setBuscaAplicada(busca);
            }}
          >
            <Entrada aria-label="Buscar cliente" placeholder="Nome ou WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} className="min-w-40 flex-1" />
            <Botao type="submit" variante="secundario">
              Buscar
            </Botao>
          </form>
        </div>
        {!lista ? (
          <Carregando />
        ) : lista.itens.length === 0 ? (
          <EstadoVazio titulo="Nenhuma reserva com esses filtros" />
        ) : (
          <>
            <Tabela
              rotulo="Reservas do mês"
              cabecalho={["Dia", "Quadra", "Cliente", { rotulo: "Valor", alinhar: "direita" }, { rotulo: "Pago", alinhar: "direita" }, "Situação"]}
            >
              {lista.itens.map((r) => (
                <Tr key={r.id} onClick={() => router.push(hrefReserva(r.id))}>
                  <Td className="whitespace-nowrap tabular-nums">
                    {dataCurta(r.data)} {r.horaInicio}
                  </Td>
                  <Td className="whitespace-nowrap">{nomeQuadra(r.quadraId)}</Td>
                  <Td>{r.nomeCliente}</Td>
                  <Td alinhar="direita" className="tabular-nums">{moeda(r.valorTotal)}</Td>
                  <Td alinhar="direita" className="tabular-nums">{moeda(r.status === "cancelada" ? 0 : pago(r))}</Td>
                  <Td>
                    <StatusReserva reserva={r} />
                  </Td>
                </Tr>
              ))}
            </Tabela>
            <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={lista.total} aoMudar={setPagina} />
          </>
        )}
      </Cartao>
    </div>
  );
}
