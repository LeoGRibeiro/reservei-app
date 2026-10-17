import { getSecaoPorId } from "@/lib/landingPage/navegacao";
import { SECAO_IDS } from "@/lib/landingPage/secoes";

/** ID do título principal — usado pelo `aria-labelledby` da seção de reserva. */
export const ID_TITULO_RESERVA = `${SECAO_IDS.INICIO}-titulo`;

/**
 * Título compacto do fluxo de reserva (único `h1` da página).
 *
 * Regra de Ouro (SPEC/2026-10-06-lp-base-navegacao.md §2.2): o agendamento é a
 * primeira coisa visível. Por isso este cabeçalho é propositalmente enxuto —
 * uma linha de título e uma de apoio — sem banners empurrando o calendário.
 *
 * @example
 * <section id="inicio" aria-labelledby={ID_TITULO_RESERVA}>
 *   <CabecalhoReserva />
 *   <CalendarioSelector ... />
 * </section>
 */
export function CabecalhoReserva({ nomeArena }: { nomeArena?: string } = {}) {
  const secao = getSecaoPorId(SECAO_IDS.INICIO);
  if (!secao) return null;

  const tituloFinal = nomeArena ? `${secao.titulo} · ${nomeArena}` : secao.titulo;

  return (
    <div>
      <h1 id={ID_TITULO_RESERVA} className="text-xl md:text-2xl font-black text-white tracking-tight">
        {tituloFinal}
      </h1>
      <p className="text-xs md:text-sm text-slate-400 mt-1">{secao.subtitulo}</p>
    </div>
  );
}
