/**
 * @file AdminEscolinhasPage.tsx
 * @description Tela Escolinhas do painel: **um cadastro só** por escolinha (professor, foto, descrição,
 * turmas com dias, horários, categoria e quadra, "Bloquear na agenda" e o botão "Quero uma vaga"),
 * no formulário {@link FormEscolinhaSite}. O que é salvo aparece na seção Escolinhas do site
 * (`landing_page_schools`); as turmas com "Bloquear na agenda" viram contratos recorrentes por baixo
 * ({@link useAgendaEscolinha}), que o dono não precisa ver.
 *
 * Contratos de escolinha antigos (sem escolinha do site) aparecem no aviso {@link HorariosAntigos}
 * para o dono ligar a uma escolinha ou encerrar.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §4
 */

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, CalendarX, Eye, EyeOff, GraduationCap, Link2, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEscolinhasSite } from "@/hooks/useEscolinhasSite";
import { useAgendaEscolinha } from "@/hooks/useAgendaEscolinha";
import { useContratosService } from "@/hooks/useContratosService";
import { useArena } from "@/hooks/useArena";
import { useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { uploadImagemInstitucional } from "@/lib/supabase/institucionalRepository";
import {
  escolinhaVazia,
  MAX_TURMAS,
  normalizarWhatsApp,
  tituloEscolinha,
  turmaDoContrato,
  turmasPreenchidas,
  turmaVazia,
  vincularContratos,
  type EscolinhaSite,
} from "@/lib/institucional/escolinhasSite";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";
import { FormEscolinhaSite } from "./institucional/FormEscolinhaSite";
import { HorariosAntigos } from "./escolinhas/HorariosAntigos";
import { Aviso, Botao, CabecalhoPagina, Carregando, Confirmacao, EstadoVazio, Etiqueta } from "@/components/admin/ui";

/** Formulário aberto: nova (id nulo) ou edição. */
type Edicao = { id: string | null; dados: Omit<EscolinhaSite, "id"> } | null;

/**
 * @example
 * ```tsx
 * // app/(plataforma)/admin/(painel)/escolinhas/page.tsx
 * export default function Page() { return <AdminEscolinhasPage />; }
 * ```
 */
export function AdminEscolinhasPage() {
  const { escolinhas: doSite, carregando, erro, salvar, alternarVisibilidade, excluir } = useEscolinhasSite();
  const { arena } = useArena();
  const { sincronizarAgenda, liberarAgenda } = useAgendaEscolinha();
  const { getContratosPorTipo, carregarSessoes, atualizarContrato, encerrarContrato } = useContratosService();
  const quadrasCatalogo = useQuadrasCatalogo();
  const horarios = useHorariosCatalogo();
  const quadras = quadrasCatalogo.map((q) => ({ id: q.id, nome: q.descricao }));
  const nomeQuadra = (id: string) => quadras.find((q) => q.id === id)?.nome ?? "quadra";
  const whatsappArena = normalizarWhatsApp(arena?.whatsapp ?? "");
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [excluindo, setExcluindo] = useState<EscolinhaSite | null>(null);

  // Contratos e sessões completos (o aviso de horários antigos e o encerramento dependem deles)
  useEffect(() => {
    void carregarSessoes();
  }, [carregarSessoes]);

  // Turmas ligadas aos contratos da agenda (inclusive os gravados sem o id na turma) e os que sobram
  const { escolinhas, antigos: semTurma } = vincularContratos(doSite, getContratosPorTipo("escolinha"));
  const antigos = carregando ? [] : semTurma;

  const abrirNova = () => {
    const dados = escolinhaVazia(escolinhas.length + 1);
    setEdicao({ id: null, dados: { ...dados, turmas: [turmaVazia(quadras[0]?.id)] } });
  };
  const abrirEdicao = (e: EscolinhaSite) => {
    const { id, ...dados } = e;
    setEdicao({ id, dados: { ...dados, turmas: dados.turmas.length ? dados.turmas : [turmaVazia(quadras[0]?.id)] } });
  };

  const remover = async (e: EscolinhaSite) => {
    const naAgenda = e.turmas.filter((t) => t.contratoId).length;
    try {
      await liberarAgenda(e.turmas);
      await excluir(e.id);
      toast.success(naAgenda ? "Escolinha excluída e horários liberados na agenda." : "Escolinha excluída do site.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  };

  const alternar = async (e: EscolinhaSite) => {
    try {
      await alternarVisibilidade(e);
      toast.success(e.ativa ? "Escolinha escondida do site." : "Escolinha visível no site.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar.");
    }
  };

  /** Liga um horário antigo a uma escolinha: vira turma dela, com o mesmo contrato. */
  const ligar = async (contrato: ContratoRecorrente, escolinha: EscolinhaSite) => {
    if (escolinha.turmas.length >= MAX_TURMAS) {
      toast.error(`A escolinha já tem ${MAX_TURMAS} turmas. Escolha outra ou remova uma turma.`);
      return;
    }
    try {
      const { id, ...resto } = escolinha;
      // A turma entra primeiro: se a gravação do contrato falhar, o aviso some mesmo assim (a turma o referencia)
      await salvar(id, { ...resto, turmas: [...resto.turmas, turmaDoContrato(contrato)] });
      const vinculo = await atualizarContrato(contrato.id, {
        escolinhaId: id,
        nome: tituloEscolinha(escolinha),
        responsavelNome: escolinha.professor || contrato.responsavelNome,
      });
      if (!vinculo.ok) {
        toast.warning("O horário virou turma da escolinha, mas o contrato não foi atualizado.", { description: vinculo.motivo });
        return;
      }
      toast.success(`Horário ligado à escolinha ${tituloEscolinha(escolinha)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ligar o horário.");
    }
  };

  const encerrar = async (contrato: ContratoRecorrente) => {
    const r = await encerrarContrato(contrato.id);
    if (r.ok) toast.success("Horário encerrado", { description: `${r.sessoesCanceladas} aulas liberadas na agenda.` });
    else toast.error("Não foi possível encerrar o horário.");
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Escolinhas"
        descricao="Cada escolinha aparece no site como “Aula”, com as turmas e o botão “Quero uma vaga”. Turmas com “Bloquear na agenda” reservam a quadra sozinhas."
        acoes={
          <Botao id="btn-admin-nova-escolinha" icone={Plus} onClick={abrirNova}>
            Nova escolinha
          </Botao>
        }
      />

      <HorariosAntigos contratos={antigos} escolinhas={escolinhas} nomeQuadra={nomeQuadra} aoLigar={ligar} aoEncerrar={encerrar} />

      {carregando ? (
        <Carregando texto="Carregando escolinhas..." />
      ) : erro ? (
        <Aviso tom="erro">{erro}</Aviso>
      ) : escolinhas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-painel-linha-forte bg-painel-superficie">
          <EstadoVazio
            icone={GraduationCap}
            titulo="Nenhuma escolinha cadastrada"
            descricao="Enquanto não houver escolinha visível, a seção Escolinhas some do site."
            acao={
              <Botao icone={Plus} onClick={abrirNova}>
                Nova escolinha
              </Botao>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {escolinhas.map((e) => (
            <article
              key={e.id}
              className="flex flex-col justify-between rounded-lg border border-painel-linha bg-painel-superficie p-5"
              aria-label={tituloEscolinha(e)}
            >
              <div>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-painel-tinta">{tituloEscolinha(e)}</h2>
                    <p className="text-sm text-painel-suave">
                      {e.nome.trim() ? `${e.esporte} · ` : ""}Prof. {e.professor}
                    </p>
                  </div>
                  {!e.ativa && <Etiqueta tom="cancelada">Escondida</Etiqueta>}
                </div>
                <ul className="mb-3 space-y-2 text-sm text-painel-tinta" aria-label="Turmas">
                  {turmasPreenchidas(e.turmas).map((t, i) => (
                    <li key={i} className="rounded-md bg-painel-elevada px-3 py-2">
                      <div className="flex flex-wrap gap-x-2">
                        <span className="font-semibold">{t.dias}</span>
                        <span>{t.horas}</span>
                        {t.categoria && <span className="ml-auto text-painel-suave">{t.categoria}</span>}
                      </div>
                      {t.contratoId ? (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-painel-destaque-forte">
                          <CalendarCheck aria-hidden className="size-3.5" /> Na agenda · {nomeQuadra(t.quadraId)}
                        </span>
                      ) : t.bloquearAgenda ? (
                        <span className="mt-0.5 block text-xs text-amber-800">Não foi bloqueada na agenda (edite e salve de novo)</span>
                      ) : (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-painel-suave">
                          <CalendarX aria-hidden className="size-3.5" /> Só no site
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mb-4 flex items-center gap-1.5 text-sm text-painel-suave">
                  {e.tipoBotao === "link" ? (
                    <>
                      <Link2 aria-hidden className="size-4 text-painel-destaque" /> Botão abre link
                    </>
                  ) : (
                    <>
                      <MessageCircle aria-hidden className="size-4 text-painel-destaque" /> WhatsApp{" "}
                      {e.whatsapp ? `(${normalizarWhatsApp(e.whatsapp).replace(/^55/, "")})` : "da arena"}
                      {e.mensagemWhatsapp ? " · mensagem personalizada" : ""}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-painel-linha pt-3">
                <Botao variante="fantasma" tamanho="sm" onClick={() => alternar(e)}>
                  {e.ativa ? (
                    <>
                      <Eye aria-hidden className="size-4 text-painel-destaque" /> No site
                    </>
                  ) : (
                    <>
                      <EyeOff aria-hidden className="size-4" /> Escondida
                    </>
                  )}
                </Botao>
                <div className="flex items-center gap-1.5">
                  <Botao variante="secundario" tamanho="sm" icone={Pencil} onClick={() => abrirEdicao(e)} aria-label={`Editar ${tituloEscolinha(e)}`}>
                    Editar
                  </Botao>
                  <Botao variante="perigo" tamanho="sm" onClick={() => setExcluindo(e)} aria-label={`Excluir ${tituloEscolinha(e)}`}>
                    <Trash2 aria-hidden className="size-4" />
                  </Botao>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Confirmacao
        aberta={!!excluindo}
        titulo="Excluir esta escolinha?"
        rotuloConfirmar="Excluir"
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={async () => {
          if (!excluindo) return;
          await remover(excluindo);
          setExcluindo(null);
        }}
      >
        {excluindo && (
          <>
            &ldquo;{tituloEscolinha(excluindo)}&rdquo; sai do site
            {excluindo.turmas.some((t) => t.contratoId) ? " e os horários dela na agenda são liberados de hoje em diante" : ""}. Isso não pode ser
            desfeito.
          </>
        )}
      </Confirmacao>

      {edicao && (
        <FormEscolinhaSite
          inicial={edicao.dados}
          editando={edicao.id !== null}
          whatsappArena={whatsappArena}
          quadras={quadras}
          horarios={horarios}
          aoEnviarFoto={(arquivo) => uploadImagemInstitucional(arquivo, "professores")}
          aoCancelar={() => setEdicao(null)}
          aoSalvar={async (dados, periodo) => {
            const salva = await salvar(edicao.id, dados);
            const agenda = await sincronizarAgenda(salva, edicao.dados.turmas, periodo, whatsappArena);
            const mudouVinculo = agenda.turmas.some((t, i) => t.contratoId !== salva.turmas[i]?.contratoId);
            if (mudouVinculo) {
              const { id, ...resto } = salva;
              await salvar(id, { ...resto, turmas: agenda.turmas });
            }
            const partes = [
              edicao.id ? "Escolinha atualizada no site." : "Escolinha publicada no site.",
              agenda.criadas ? `${agenda.criadas} turma(s) bloqueada(s) na agenda.` : "",
              agenda.encerradas ? `${agenda.encerradas} horário(s) liberado(s) na agenda.` : "",
            ].filter(Boolean);
            if (agenda.falhas.length) {
              toast.warning(partes.join(" "), {
                description: `Não deu para bloquear na agenda: ${agenda.falhas.join(" | ")}`,
                duration: 15000,
              });
            } else {
              toast.success(partes.join(" "));
            }
            setEdicao(null);
          }}
        />
      )}
    </div>
  );
}
