/**
 * @file AdminQuadrasPage.tsx
 * @description Tela "Quadras e preços": o que o site mostra de cada quadra, o painel edita.
 *
 * - Card por quadra com foto, nome, linha de esportes e os preços **como aparecem no site**
 *   ("R$ 80 de dia · R$ 100 à noite"), na ordem do site (setas sobem e descem).
 * - Tarifas: criar, **editar** e excluir, com o efeito de cada uma no site.
 * - Fechar a quadra inteira por um período (reforma, evento) ou "até eu liberar", e reabrir.
 * - "Coberta" e "iluminação" saíram do painel (o site não mostra; as colunas ficam no banco).
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useArena } from "@/hooks/useArena";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import type { Quadra, QuadraPreco } from "@/lib/arena/types";
import { quadraFechadaEm, textoPeriodoFechamento } from "@/lib/arena/bloqueioQuadra";
import { resumoPrecosNoSite, efeitoDaTarifa } from "@/lib/arena/precosNoSite";
import { formatarMoeda, getHoje } from "@/lib/constants";
import { DIAS_SEMANA } from "@/lib/recorrencia/types";
import { uploadImagemInstitucional } from "@/lib/supabase/institucionalRepository";
import { listarReservasDaQuadraNoPeriodo } from "@/lib/supabase/reservasService";
import { textoEsportes } from "@/components/portal-arena/reservar/CardQuadra";
import { Botao, CabecalhoPagina, Carregando, Confirmacao, EstadoVazio, Etiqueta } from "@/components/admin/ui";
import { JanelaQuadra, type DadosQuadra } from "./quadras/JanelaQuadra";
import { JanelaTarifa, type DadosTarifa } from "./quadras/JanelaTarifa";
import { JanelaFechamento, type DadosFechamento } from "./quadras/JanelaFechamento";

/** Dias da tarifa em texto: "Todos os dias", "Seg a Sex", "Sáb e Dom", "Seg, Qua e Sex". */
export function textoDiasTarifa(dias: number[]): string {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  if (ordenados.length === 7) return "Todos os dias";
  if (ordenados.join() === "1,2,3,4,5") return "Seg a Sex";
  if (ordenados.join() === "0,6") return "Sáb e Dom";
  const nomes = ordenados.map((d) => DIAS_SEMANA[d].curto);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : (nomes[0] ?? "");
}

type JanelaAberta =
  | { tipo: "quadra"; quadra?: Quadra }
  | { tipo: "tarifa"; quadra: Quadra; tarifa?: QuadraPreco }
  | { tipo: "fechar"; quadra: Quadra }
  | null;

/**
 * @example
 * ```tsx
 * // app/(plataforma)/admin/(painel)/quadras/page.tsx
 * export default function Page() { return <AdminQuadrasPage />; }
 * ```
 */
export function AdminQuadrasPage() {
  const { arena, quadras: todas, precos, recarregar, carregando } = useArena();
  const quadras = useMemo(() => [...todas].sort((a, b) => (a.ordem || a.numero) - (b.ordem || b.numero)), [todas]);
  const [janela, setJanela] = useState<JanelaAberta>(null);
  const [excluindo, setExcluindo] = useState<{ tipo: "quadra"; quadra: Quadra } | { tipo: "tarifa"; tarifa: QuadraPreco } | null>(null);
  const [reabrindo, setReabrindo] = useState<Quadra | null>(null);
  const hoje = getHoje();

  async function salvarQuadra(dados: DadosQuadra, quadra?: Quadra) {
    const campos = {
      nome: dados.nome,
      esportes: dados.esportes,
      tipoPiso: dados.tipoPiso,
      valorHoraPadrao: dados.valorHoraPadrao,
      fotoUrl: dados.fotoUrl || undefined,
      fotoPosicao: dados.fotoUrl ? dados.fotoPosicao : undefined,
      fotoDescricao: dados.fotoUrl ? dados.fotoDescricao : undefined,
    };
    if (quadra) {
      const ok = await ArenaRepository.atualizarQuadra(quadra.id, campos);
      if (!ok) throw new Error("Não foi possível salvar a quadra. Confira a conexão e tente de novo.");
      toast.success(`Quadra ${dados.nome} atualizada.`);
    } else {
      const proximo = Math.max(0, ...quadras.map((q) => Math.max(q.numero, q.ordem || 0))) + 1;
      const criada = await ArenaRepository.criarQuadra({
        ...campos,
        arenaId: arena.id,
        numero: proximo,
        ordem: proximo,
        coberta: false,
        iluminacao: true,
        ativa: true,
      });
      if (!criada) throw new Error("Não foi possível cadastrar a quadra.");
      toast.success(`Quadra ${dados.nome} cadastrada.`);
    }
    setJanela(null);
    await recarregar();
  }

  async function salvarTarifa(quadra: Quadra, dados: DadosTarifa, tarifa?: QuadraPreco) {
    const ok = tarifa
      ? await ArenaRepository.atualizarPreco(tarifa.id, dados)
      : await ArenaRepository.criarPreco({ ...dados, arenaId: arena.id, quadraId: quadra.id, ativo: true });
    if (!ok) throw new Error("Não foi possível salvar a tarifa.");
    toast.success(tarifa ? "Tarifa atualizada." : "Tarifa cadastrada.");
    setJanela(null);
    await recarregar();
  }

  async function fecharQuadra(quadra: Quadra, dados: DadosFechamento) {
    const ok = await ArenaRepository.atualizarQuadra(quadra.id, {
      bloqueioInicio: dados.inicio,
      bloqueioFim: dados.fim || undefined,
      bloqueioMotivo: dados.motivo,
    });
    if (!ok) throw new Error("Não foi possível fechar a quadra.");
    toast.success(`${quadra.nome} fechada ${textoPeriodoFechamento({ bloqueioInicio: dados.inicio, bloqueioFim: dados.fim })}.`);
    setJanela(null);
    await recarregar();
  }

  async function reabrir(quadra: Quadra) {
    const ok = await ArenaRepository.atualizarQuadra(quadra.id, { bloqueioInicio: undefined, bloqueioFim: undefined, bloqueioMotivo: undefined });
    if (!ok) return void toast.error("Não foi possível reabrir a quadra.");
    toast.success(`${quadra.nome} reaberta para reservas.`);
    await recarregar();
  }

  /** Troca a posição no site com a quadra vizinha. */
  async function mover(indice: number, sentido: -1 | 1) {
    const a = quadras[indice];
    const b = quadras[indice + sentido];
    if (!a || !b) return;
    const ordemA = a.ordem || a.numero;
    const ordemB = b.ordem || b.numero;
    const [r1, r2] = await Promise.all([
      ArenaRepository.atualizarQuadra(a.id, { ordem: ordemB === ordemA ? ordemA + sentido : ordemB }),
      ArenaRepository.atualizarQuadra(b.id, { ordem: ordemA }),
    ]);
    if (!r1 || !r2) toast.error("Não foi possível mudar a ordem.");
    await recarregar();
  }

  const quadraFechando = janela?.tipo === "fechar" ? janela.quadra : null;
  const idFechando = quadraFechando?.id;
  const buscarDaQuadra = useCallback(
    (inicio: string, fim: string | null) => (idFechando ? listarReservasDaQuadraNoPeriodo(idFechando, inicio, fim) : Promise.resolve([])),
    [idFechando]
  );

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Quadras e preços"
        descricao="Tudo o que o site mostra de cada quadra: foto, nome, esportes, preços e horários."
        acoes={
          <Botao icone={Plus} onClick={() => setJanela({ tipo: "quadra" })}>
            Nova quadra
          </Botao>
        }
      />

      {carregando ? (
        <Carregando texto="Carregando quadras e preços..." />
      ) : quadras.length === 0 ? (
        <div className="rounded-lg border border-dashed border-painel-linha-forte bg-painel-superficie">
          <EstadoVazio titulo="Nenhuma quadra cadastrada" descricao="Cadastre a primeira quadra para o site começar a aceitar reservas." />
        </div>
      ) : (
        <ul className="space-y-4" aria-label="Quadras">
          {quadras.map((quadra, i) => {
            const tarifas = precos.filter((p) => p.quadraId === quadra.id);
            const fechada = !!quadra.bloqueioInicio && (!quadra.bloqueioFim || quadra.bloqueioFim >= hoje);
            const fechadaHoje = quadraFechadaEm(quadra, hoje);
            return (
              <li key={quadra.id} aria-label={quadra.nome} className="overflow-hidden rounded-lg border border-painel-linha bg-painel-superficie">
                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-painel-elevada sm:w-44">
                    {quadra.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura com o enquadramento do site
                      <img
                        src={quadra.fotoUrl}
                        alt={quadra.fotoDescricao ?? quadra.nome}
                        className="absolute inset-0 size-full object-cover"
                        style={quadra.fotoPosicao ? { objectPosition: quadra.fotoPosicao } : undefined}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center p-3 text-center text-xs text-painel-suave">Sem foto</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-painel-tinta">{quadra.nome}</h2>
                        <p className="text-sm text-painel-suave">{quadra.esportes.length ? textoEsportes(quadra.esportes) : "Sem esporte marcado"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Botao variante="fantasma" tamanho="sm" aria-label={`Subir ${quadra.nome} no site`} disabled={i === 0} onClick={() => void mover(i, -1)}>
                          <ArrowUp aria-hidden className="size-4" />
                        </Botao>
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          aria-label={`Descer ${quadra.nome} no site`}
                          disabled={i === quadras.length - 1}
                          onClick={() => void mover(i, 1)}
                        >
                          <ArrowDown aria-hidden className="size-4" />
                        </Botao>
                      </div>
                    </div>
                    {fechada && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-painel-tinta">
                        <Etiqueta tom={fechadaHoje ? "cancelada" : "sinal"}>{fechadaHoje ? "Fechada" : "Vai fechar"}</Etiqueta>
                        {textoPeriodoFechamento(quadra)}
                        {quadra.bloqueioMotivo ? ` · ${quadra.bloqueioMotivo}` : ""}
                      </p>
                    )}
                    <div className="mt-3 rounded-md bg-painel-elevada px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-painel-suave">No site</p>
                      {resumoPrecosNoSite(quadra, precos).map((linha) => (
                        <p key={linha} className="font-semibold text-painel-tinta">
                          {linha}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-painel-linha px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-painel-tinta">
                      Preços por horário <span className="font-normal text-painel-suave">· padrão {formatarMoeda(quadra.valorHoraPadrao)} a hora</span>
                    </p>
                    <Botao variante="secundario" tamanho="sm" icone={Plus} onClick={() => setJanela({ tipo: "tarifa", quadra })}>
                      Nova tarifa
                    </Botao>
                  </div>
                  {tarifas.length === 0 ? (
                    <p className="text-sm text-painel-suave">Sem tarifa: todos os horários custam o preço padrão.</p>
                  ) : (
                    <ul className="divide-y divide-painel-linha rounded-md border border-painel-linha">
                      {tarifas.map((t) => (
                        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-painel-tinta">
                              {t.descricao || "Tarifa"} · {formatarMoeda(t.valorHora)} a hora
                            </p>
                            <p className="text-xs text-painel-suave">
                              {textoDiasTarifa(t.diasSemana)} · {t.horaInicio} às {t.horaFim} · {efeitoDaTarifa(t)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Botao variante="fantasma" tamanho="sm" icone={Pencil} onClick={() => setJanela({ tipo: "tarifa", quadra, tarifa: t })}>
                              Editar
                            </Botao>
                            <Botao
                              variante="fantasma"
                              tamanho="sm"
                              aria-label={`Excluir tarifa ${t.descricao ?? ""}`}
                              onClick={() => setExcluindo({ tipo: "tarifa", tarifa: t })}
                            >
                              <Trash2 aria-hidden className="size-4" />
                            </Botao>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-painel-linha bg-painel-elevada px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Botao variante="secundario" tamanho="sm" icone={Pencil} onClick={() => setJanela({ tipo: "quadra", quadra })}>
                      Editar quadra
                    </Botao>
                    {fechada ? (
                      <Botao variante="secundario" tamanho="sm" icone={LockOpen} onClick={() => setReabrindo(quadra)}>
                        Reabrir
                      </Botao>
                    ) : (
                      <Botao variante="secundario" tamanho="sm" icone={Lock} onClick={() => setJanela({ tipo: "fechar", quadra })}>
                        Fechar quadra
                      </Botao>
                    )}
                  </div>
                  <Botao variante="perigo" tamanho="sm" icone={Trash2} onClick={() => setExcluindo({ tipo: "quadra", quadra })}>
                    Excluir
                  </Botao>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {janela?.tipo === "quadra" && (
        <JanelaQuadra
          quadra={janela.quadra}
          aoFechar={() => setJanela(null)}
          aoSalvar={(dados) => salvarQuadra(dados, janela.quadra)}
          aoEnviarFoto={(arquivo) => uploadImagemInstitucional(arquivo, "quadras")}
        />
      )}
      {janela?.tipo === "tarifa" && (
        <JanelaTarifa
          nomeQuadra={janela.quadra.nome}
          tarifa={janela.tarifa}
          valorSugerido={janela.quadra.valorHoraPadrao + 20}
          aoFechar={() => setJanela(null)}
          aoSalvar={(dados) => salvarTarifa(janela.quadra, dados, janela.tarifa)}
        />
      )}
      {janela?.tipo === "fechar" && (
        <JanelaFechamento
          nomeQuadra={janela.quadra.nome}
          aoFechar={() => setJanela(null)}
          aoBuscarReservas={buscarDaQuadra}
          aoConfirmar={(dados) => fecharQuadra(janela.quadra, dados)}
        />
      )}

      <Confirmacao
        aberta={!!reabrindo}
        titulo="Reabrir a quadra?"
        rotuloConfirmar="Reabrir"
        variante="primario"
        aoFechar={() => setReabrindo(null)}
        aoConfirmar={async () => {
          if (reabrindo) await reabrir(reabrindo);
          setReabrindo(null);
        }}
      >
        Os horários de {reabrindo?.nome} voltam a aparecer livres no site.
      </Confirmacao>

      <Confirmacao
        aberta={!!excluindo}
        titulo={excluindo?.tipo === "quadra" ? "Excluir esta quadra?" : "Excluir esta tarifa?"}
        rotuloConfirmar="Excluir"
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={async () => {
          if (!excluindo) return;
          const ok =
            excluindo.tipo === "quadra" ? await ArenaRepository.removerQuadra(excluindo.quadra.id) : await ArenaRepository.removerPreco(excluindo.tarifa.id);
          setExcluindo(null);
          if (!ok) return void toast.error("Não foi possível excluir.");
          toast.success(excluindo.tipo === "quadra" ? "Quadra excluída." : "Tarifa excluída.");
          await recarregar();
        }}
      >
        {excluindo?.tipo === "quadra"
          ? `${excluindo.quadra.nome} sai do site. Para parar por um tempo (reforma, evento), use “Fechar quadra”.`
          : "Os horários dessa faixa voltam a custar o preço padrão da quadra."}
      </Confirmacao>
    </div>
  );
}
