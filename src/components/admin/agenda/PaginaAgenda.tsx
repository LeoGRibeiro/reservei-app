/**
 * @file PaginaAgenda.tsx
 * @description Agenda do painel (`/admin/agenda?data=AAAA-MM-DD&visao=dia|mes`).
 *
 * - **Dia**: uma coluna por quadra e uma linha por horário, com o nome do cliente legível e a cor do
 *   status. Clicar numa reserva abre o detalhe; clicar num horário livre abre a escolha rápida
 *   ({@link EscolhaHorarioLivre}: "Nova reserva" ou "Bloquear horário", já com quadra, dia e hora);
 *   clicar num bloqueio permite liberar.
 * - **Mês**: calendário com o total de reservas por dia; clicar no dia abre o Dia.
 *
 * A data e a visão ficam no endereço (F5, Voltar e link compartilhado funcionam).
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano F)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import { CalendarPlus, ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { Abas, Botao, CabecalhoPagina, Confirmacao, Etiqueta, Janela } from "@/components/admin/ui";
import { useReservasService } from "@/hooks/useReservasService";
import { useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { LockService } from "@/lib/pagamento/lockService";
import { descreverStatus, dataExtensa, type TomStatus } from "@/lib/admin/formatos";
import { hrefReserva } from "@/lib/admin/navegacao";
import { quadraFechadaEm } from "@/lib/arena/bloqueioQuadra";
import { getHoje } from "@/lib/constants";
import { somarDias } from "@/lib/datas/fusoHorario";
import { gerarDiasCalendarioMensal, getNomeMesExtenso } from "@/lib/adminAgenda/adminAgendaService";
import type { Reserva } from "@/store/useReservasStore";
import { JanelaBloqueio, JanelaNovaReserva, type SelecaoInicial } from "./JanelasAgenda";

type Visao = "dia" | "mes";

const COR_CELULA: Record<TomStatus, string> = {
  neutro: "bg-stone-50 border-stone-300 text-stone-800",
  aguardando: "bg-sky-50 border-sky-300 text-sky-900",
  sinal: "bg-amber-50 border-amber-300 text-amber-950",
  quitada: "bg-emerald-50 border-emerald-300 text-emerald-950",
  cancelada: "bg-red-50 border-red-200 text-red-800",
  bloqueio: "bg-stone-200 border-stone-400 text-stone-800",
  fixo: "bg-indigo-50 border-indigo-300 text-indigo-950",
};

const LEGENDA: { tom: TomStatus; rotulo: string }[] = [
  { tom: "sinal", rotulo: "Falta pagar" },
  { tom: "quitada", rotulo: "Quitada" },
  { tom: "aguardando", rotulo: "Aguardando Pix" },
  { tom: "fixo", rotulo: "Aula ou grupo" },
  { tom: "bloqueio", rotulo: "Bloqueado" },
];

/** Reserva que ocupa a quadra no horário (ignora canceladas e Pix com prazo vencido). */
export function ocupanteDoHorario(reservas: Reserva[], quadraId: string, data: string, horario: string, agora = new Date()): Reserva | undefined {
  return reservas.find((r) => r.quadraId === quadraId && r.data === data && r.horarios.includes(horario) && LockService.isReservaOcupandoSlot(r, agora));
}

function GradeDia({
  data,
  reservas,
  aoClicarLivre,
  aoClicarBloqueio,
}: {
  data: string;
  reservas: Reserva[];
  aoClicarLivre: (s: SelecaoInicial) => void;
  aoClicarBloqueio: (r: Reserva) => void;
}) {
  const quadras = useQuadrasCatalogo();
  const horarios = useHorariosCatalogo();
  const passado = data < getHoje();

  return (
    <div className="overflow-x-auto rounded-lg border border-painel-linha bg-painel-superficie">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-painel-linha">
            <th scope="col" className="sticky left-0 z-10 w-16 bg-painel-superficie px-3 py-2.5 text-left text-xs font-semibold text-painel-suave">
              Hora
            </th>
            {quadras.map((q) => (
              <th key={q.id} scope="col" className="px-2 py-2.5 text-left text-sm font-semibold text-painel-tinta">
                {q.descricao}
                {quadraFechadaEm(q, data) && (
                  <span className="block text-xs font-normal text-red-800" title={q.bloqueioMotivo}>
                    Fechada{q.bloqueioMotivo ? ` · ${q.bloqueioMotivo}` : ""}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horarios.map((h) => (
            <tr key={h} className="border-b border-painel-linha last:border-0">
              <th scope="row" className="sticky left-0 z-10 bg-painel-superficie px-3 py-1.5 text-left align-top text-xs font-semibold tabular-nums text-painel-tinta">
                {h}
              </th>
              {quadras.map((q) => {
                const r = ocupanteDoHorario(reservas, q.id, data, h);
                if (!r) {
                  return (
                    <td key={q.id} className="p-1">
                      {quadraFechadaEm(q, data) ? (
                        <span className="flex h-14 items-center justify-center rounded-md bg-painel-elevada text-xs text-painel-suave" aria-label={`Fechada: ${q.descricao} às ${h}`}>
                          Fechada
                        </span>
                      ) : passado ? (
                        <span className="block h-14" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => aoClicarLivre({ quadraId: q.id, data, horario: h })}
                          aria-label={`Livre: ${q.descricao} às ${h}`}
                          className="group flex h-14 w-full items-center justify-center rounded-md border border-dashed border-painel-linha-forte text-painel-apagada hover:border-painel-destaque hover:bg-painel-destaque-suave hover:text-painel-destaque"
                        >
                          <Plus aria-hidden className="size-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                        </button>
                      )}
                    </td>
                  );
                }
                const { rotulo, tom } = descreverStatus(r);
                const primeiro = r.horarios[0] === h;
                const conteudo = (
                  <>
                    <span className="block truncate text-[15px] font-semibold">{r.tipoReserva === "manutencao_bloqueio" ? "Bloqueado" : r.nomeCliente || "Reserva"}</span>
                    {primeiro && <span className="block truncate text-xs">{r.tipoReserva === "manutencao_bloqueio" ? r.nomeCliente : rotulo}</span>}
                  </>
                );
                const classe = cn("block h-14 w-full overflow-hidden rounded-md border px-2 py-1.5 text-left leading-snug", COR_CELULA[tom], !primeiro && "border-t-transparent");
                return (
                  <td key={q.id} className="p-1">
                    {r.tipoReserva === "manutencao_bloqueio" ? (
                      <button type="button" className={classe} title={`${r.nomeCliente} — clique para liberar`} onClick={() => aoClicarBloqueio(r)}>
                        {conteudo}
                      </button>
                    ) : (
                      <Link href={hrefReserva(r.id)} className={classe} title={`${r.nomeCliente} · ${rotulo}`}>
                        {conteudo}
                      </Link>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Escolha rápida ao clicar num horário livre da grade: reservar ou bloquear, as duas já com a quadra,
 * o dia e a hora clicados.
 *
 * @example
 * ```tsx
 * <EscolhaHorarioLivre selecao={{ quadraId: "q1", data: "2026-11-02", horario: "19:00" }} aoEscolher={abrir} aoFechar={fechar} />
 * ```
 */
export function EscolhaHorarioLivre({
  selecao,
  aoEscolher,
  aoFechar,
}: {
  selecao: SelecaoInicial | null;
  aoEscolher: (tipo: "reserva" | "bloqueio", selecao: SelecaoInicial) => void;
  aoFechar: () => void;
}) {
  const quadras = useQuadrasCatalogo();
  const quadra = quadras.find((q) => q.id === selecao?.quadraId);
  const opcao =
    "flex w-full items-start gap-3 rounded-lg border border-painel-linha-forte bg-painel-superficie p-4 text-left transition-colors hover:border-painel-destaque hover:bg-painel-destaque-suave focus-visible:outline-2 focus-visible:outline-painel-foco";
  return (
    <Janela
      aberta={!!selecao}
      largura="sm"
      titulo="O que fazer neste horário?"
      descricao={selecao ? `${quadra?.descricao ?? "Quadra"} · ${dataExtensa(selecao.data ?? "")} · ${selecao.horario}` : undefined}
      aoFechar={aoFechar}
    >
      {selecao && (
        <div className="space-y-3">
          <button type="button" className={opcao} onClick={() => aoEscolher("reserva", selecao)}>
            <CalendarPlus aria-hidden className="mt-0.5 size-5 shrink-0 text-painel-destaque" />
            <span>
              <span className="block font-semibold text-painel-tinta">Nova reserva</span>
              <span className="block text-xs text-painel-suave">Cliente que ligou ou chegou no balcão.</span>
            </span>
          </button>
          <button type="button" className={opcao} onClick={() => aoEscolher("bloqueio", selecao)}>
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-painel-suave" />
            <span>
              <span className="block font-semibold text-painel-tinta">Bloquear horário</span>
              <span className="block text-xs text-painel-suave">Manutenção, evento ou torneio. Ninguém reserva por cima.</span>
            </span>
          </button>
        </div>
      )}
    </Janela>
  );
}

function CalendarioMes({ ano, mes, reservas, aoEscolherDia }: { ano: number; mes: number; reservas: Reserva[]; aoEscolherDia: (data: string) => void }) {
  const dias = useMemo(() => gerarDiasCalendarioMensal(ano, mes, reservas, getHoje()), [ano, mes, reservas]);
  return (
    <div className="overflow-hidden rounded-lg border border-painel-linha bg-painel-superficie">
      <div className="grid grid-cols-7 border-b border-painel-linha text-center text-xs font-medium text-painel-suave">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => (
          <button
            key={d.data}
            type="button"
            onClick={() => aoEscolherDia(d.data)}
            className={cn(
              "flex min-h-20 flex-col items-start gap-1 border-b border-r border-painel-linha p-2 text-left hover:bg-painel-elevada [&:nth-child(7n)]:border-r-0",
              !d.mesAtual && "bg-painel-fundo text-painel-apagada"
            )}
          >
            <span className={cn("text-sm tabular-nums", d.isHoje && "rounded bg-painel-destaque px-1.5 font-semibold text-white")}>{d.diaNumero}</span>
            {d.mesAtual && d.totalReservas > 0 && <span className="text-xs text-painel-suave">{d.totalReservas} reserva{d.totalReservas === 1 ? "" : "s"}</span>}
            {d.mesAtual && d.totalBloqueios > 0 && <span className="text-xs text-painel-suave">{d.totalBloqueios} bloqueio{d.totalBloqueios === 1 ? "" : "s"}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PaginaAgenda() {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const { reservas, carregarReservasDoMes, removerBloqueio } = useReservasService();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get("data") ?? "") ? (params.get("data") as string) : getHoje();
  const visao: Visao = params.get("visao") === "mes" ? "mes" : "dia";
  const [ano, mes] = data.split("-").map(Number);
  const [janela, setJanela] = useState<{ tipo: "reserva" | "bloqueio"; inicial: SelecaoInicial } | null>(null);
  const [bloqueio, setBloqueio] = useState<Reserva | null>(null);
  const [escolha, setEscolha] = useState<SelecaoInicial | null>(null);

  useEffect(() => {
    void carregarReservasDoMes(ano, mes);
  }, [ano, mes, carregarReservasDoMes]);

  function navegar(novaData: string, novaVisao: Visao = visao) {
    const q = new URLSearchParams({ data: novaData, ...(novaVisao === "mes" ? { visao: "mes" } : {}) });
    router.replace(`${caminho}?${q.toString()}`, { scroll: false });
  }

  const passo = (sentido: 1 | -1) => {
    if (visao === "dia") return navegar(somarDias(data, sentido));
    const d = new Date(ano, mes - 1 + sentido, 1);
    navegar(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const doDia = reservas.filter((r) => r.data === data && LockService.isReservaOcupandoSlot(r));
  const resumoDia = `${doDia.filter((r) => r.tipoReserva !== "manutencao_bloqueio").length} reservas`;

  return (
    <div>
      <CabecalhoPagina
        titulo="Agenda"
        descricao={visao === "dia" ? `${dataExtensa(data)} · ${resumoDia}` : `${getNomeMesExtenso(mes)} de ${ano}`}
        acoes={
          <>
            <Botao variante="secundario" icone={Lock} onClick={() => setJanela({ tipo: "bloqueio", inicial: { data } })}>
              Bloquear horário
            </Botao>
            <Botao icone={Plus} onClick={() => setJanela({ tipo: "reserva", inicial: { data } })}>
              Nova reserva
            </Botao>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Botao variante="secundario" tamanho="sm" aria-label={visao === "dia" ? "Dia anterior" : "Mês anterior"} onClick={() => passo(-1)}>
            <ChevronLeft className="size-4" />
          </Botao>
          <Botao variante="secundario" tamanho="sm" onClick={() => navegar(getHoje())}>
            Hoje
          </Botao>
          <Botao variante="secundario" tamanho="sm" aria-label={visao === "dia" ? "Próximo dia" : "Próximo mês"} onClick={() => passo(1)}>
            <ChevronRight className="size-4" />
          </Botao>
          <input
            type="date"
            aria-label="Escolher data"
            value={data}
            onChange={(e) => e.target.value && navegar(e.target.value)}
            className="h-9 rounded-md border border-painel-linha-forte bg-painel-superficie px-2 text-sm"
          />
        </div>
        <div className="w-44">
          <Abas
            rotulo="Visão da agenda"
            className="mb-0"
            itens={[
              { id: "dia", rotulo: "Dia" },
              { id: "mes", rotulo: "Mês" },
            ]}
            ativa={visao}
            aoTrocar={(id) => navegar(data, id as Visao)}
          />
        </div>
      </div>

      {visao === "dia" ? (
        <>
          <GradeDia
            data={data}
            reservas={reservas}
            aoClicarLivre={(s) => setEscolha(s)}
            aoClicarBloqueio={(r) => setBloqueio(r)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-painel-suave">
            <span>Legenda:</span>
            {LEGENDA.map((l) => (
              <Etiqueta key={l.tom} tom={l.tom}>
                {l.rotulo}
              </Etiqueta>
            ))}
          </div>
        </>
      ) : (
        <CalendarioMes ano={ano} mes={mes} reservas={reservas} aoEscolherDia={(d) => navegar(d, "dia")} />
      )}

      <EscolhaHorarioLivre
        selecao={escolha}
        aoFechar={() => setEscolha(null)}
        aoEscolher={(tipo, inicial) => {
          setEscolha(null);
          setJanela({ tipo, inicial });
        }}
      />
      {janela?.tipo === "reserva" && (
        <JanelaNovaReserva
          aberta
          inicial={janela.inicial}
          aoFechar={() => setJanela(null)}
          aoCriar={(r) => {
            setJanela(null);
            toast.success(`Reserva de ${r.nomeCliente} salva.`);
          }}
        />
      )}
      {janela?.tipo === "bloqueio" && (
        <JanelaBloqueio
          aberta
          inicial={janela.inicial}
          aoFechar={() => setJanela(null)}
          aoBloquear={() => {
            setJanela(null);
            toast.success("Horário bloqueado.");
          }}
        />
      )}
      <Confirmacao
        aberta={!!bloqueio}
        titulo="Liberar este horário?"
        rotuloConfirmar="Liberar horário"
        variante="primario"
        aoFechar={() => setBloqueio(null)}
        aoConfirmar={async () => {
          if (!bloqueio) return;
          const ok = await removerBloqueio(bloqueio.id);
          setBloqueio(null);
          if (ok) toast.success("Horário liberado.");
          else toast.error("Não foi possível liberar. Tente de novo.");
        }}
      >
        {bloqueio && (
          <>
            Bloqueio de {bloqueio.horaInicio} às {bloqueio.horaFim} ({bloqueio.nomeCliente}). O horário volta a ficar disponível para reservas.
          </>
        )}
      </Confirmacao>
    </div>
  );
}
