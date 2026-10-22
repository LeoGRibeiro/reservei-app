/**
 * @module components/landing/SecaoEscolinhas
 *
 * Seção "Escolinhas e Aulas" da Landing Page.
 *
 * Apresenta as modalidades de formação esportiva contínua (Tênis, Beach Tennis,
 * Futebol Society, etc.), perfis dos professores responsáveis, horários,
 * faixas etárias e botão de conversão direta com mensagem pré-formatada no WhatsApp.
 *
 * @see SPEC/2026-10-06-lp-conteudo-institucional.md
 */

"use client";

import {
  GraduationCap,
  Clock,
  Users,
  MessageCircle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { SECAO_IDS } from "@/lib/landingPage/secoes";
import { gerarLinkWhatsAppEscolinha } from "@/lib/institucional/institucionalHelpers";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { useInstitucionalService } from "@/hooks/useInstitucionalService";

export function SecaoEscolinhas() {
  const { escolinhasAtivas } = useInstitucionalService();
  const nomeArena = useConfiguracaoSiteArena().nomePlataforma;

  return (
    <section
      id={SECAO_IDS.ESCOLINHAS}
      aria-labelledby="escolinhas-titulo"
      className="scroll-mt-20 py-16 sm:py-20 bg-slate-950 border-b border-slate-800/60 relative overflow-hidden"
    >
      {/* Luz ambiente de fundo */}
      <div
        className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Cabeçalho da Seção */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <GraduationCap className="w-4 h-4" aria-hidden="true" />
            <span>Aulas & Treinamento</span>
          </div>

          <h2
            id="escolinhas-titulo"
            className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight"
          >
            Escolinhas e Aulas Esportivas
          </h2>

          <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
            Metodologia profissional para todas as idades, desde a iniciação
            infantil até turmas avançadas de competição e condicionamento.
          </p>
        </div>

        {/* Grid de Cards por Modalidade */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {escolinhasAtivas.map((escolinha) => {
            const linkWhatsApp = gerarLinkWhatsAppEscolinha(escolinha, nomeArena);

            return (
              <article
                key={escolinha.id}
                data-testid={`card-escolinha-${escolinha.id}`}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-xl hover:border-emerald-500/40 hover:shadow-emerald-500/5 transition-all duration-300 group"
              >
                <div>
                  {/* Cabeçalho do Card: Nome da Modalidade e Badge */}
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                      <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-1">
                        Modalidade
                      </span>
                      <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {escolinha.sportName}
                      </h3>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold whitespace-nowrap">
                      Turmas Abertas
                    </span>
                  </div>

                  {/* Informações do Professor */}
                  <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-5">
                    <img
                      src={escolinha.teacherImageUrl}
                      alt={escolinha.teacherName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700/80 shadow flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                        Responsável Técnico
                      </span>
                      <p className="text-sm font-bold text-white truncate">
                        {escolinha.teacherName}
                      </p>
                      <span className="text-xs text-emerald-400/90 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        Instrutor Credenciado
                      </span>
                    </div>
                  </div>

                  {/* Detalhes de Horários e Idades */}
                  <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 mb-5">
                    {escolinha.faixaEtaria && (
                      <div className="flex items-start gap-2.5">
                        <Users
                          className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <strong className="text-slate-400 font-medium">Faixas: </strong>
                          <span>{escolinha.faixaEtaria}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <Clock
                        className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div>
                        <strong className="text-slate-400 font-medium">Horários: </strong>
                        <span>{escolinha.scheduleInfo}</span>
                      </div>
                    </div>
                  </div>

                  {/* Descrição Didática */}
                  {escolinha.descricao && (
                    <p className="text-xs text-slate-400 leading-relaxed mb-6 border-t border-slate-800/80 pt-4">
                      {escolinha.descricao}
                    </p>
                  )}
                </div>

                {/* Botão de Conversão WhatsApp */}
                <div className="pt-2">
                  <a
                    href={linkWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    id={`btn-escolinha-whatsapp-${escolinha.id}`}
                    className="w-full inline-flex items-center justify-center gap-2.5 h-11 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all cursor-pointer group/btn"
                  >
                    <MessageCircle className="w-4 h-4 text-slate-950" aria-hidden="true" />
                    <span>Agendar Aula Experimental</span>
                  </a>
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    Fale diretamente no WhatsApp do professor
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {escolinhasAtivas.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800">
            <p className="text-slate-400 text-sm">
              Nenhuma escolinha aberta para matrículas no momento.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
