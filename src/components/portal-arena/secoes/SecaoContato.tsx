/**
 * @file SecaoContato.tsx
 * @description Contato (`#contato`): mapa em escala de cinza com pino e nome, endereço, Google Maps,
 * Waze e "Avaliar no Google", funcionamento, WhatsApp, pagamento, política recolhida e "Chamar no WhatsApp".
 */

import { funcionamento, linkWhatsApp } from "@/lib/portal/formatos";
import type { ArenaPortal } from "@/lib/portal/types";
import { Icone } from "../Icone";

/** Links de rota e avaliação a partir dos dados da arena. */
export function linksDoMapa(arena: ArenaPortal): { maps: string; waze: string; avaliar: string } {
  const temCoordenadas = arena.latitude !== undefined && arena.longitude !== undefined;
  const busca = encodeURIComponent([arena.endereco, arena.bairro, arena.cidade, arena.estado].filter(Boolean).join(", "));
  const maps =
    arena.googleMapsUrl ??
    (temCoordenadas
      ? `https://www.google.com/maps/search/?api=1&query=${arena.latitude},${arena.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${busca}`);
  const waze = temCoordenadas ? `https://waze.com/ul?ll=${arena.latitude},${arena.longitude}&navigate=yes` : `https://waze.com/ul?q=${busca}&navigate=yes`;
  // Sem o Place ID (ChIJ...), a página da arena no Maps também tem o botão de avaliar
  const avaliar = arena.googlePlaceId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(arena.googlePlaceId)}` : maps;
  return { maps, waze, avaliar };
}

/** "Av. X, 580 · Bairro". */
export const linhaEndereco = (arena: ArenaPortal): string => [arena.endereco, arena.bairro].filter(Boolean).join(" · ");

/**
 * @example
 * ```tsx
 * <SecaoContato arena={dados.arena} />
 * ```
 */
export function SecaoContato({ arena }: { arena: ArenaPortal }) {
  const { maps, waze, avaliar } = linksDoMapa(arena);
  const cidade = [`${arena.cidade}, ${arena.estado}`, arena.cep].filter(Boolean).join(" · ");
  return (
    <section className="secao contato" id="contato" aria-labelledby="ct-titulo">
      <div className="wrap ct-grid">
        <div className="ct-mapa">
          {arena.mapaUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- mapa estático em escala de cinza pelo CSS
            <img src={arena.mapaUrl} alt={`Mapa com a localização da ${arena.nome}`} width={1200} height={720} loading="lazy" />
          )}
          <span className="pino" aria-hidden="true">
            <Icone nome="map-pin" />
          </span>
          <span className="pino-nome" aria-hidden="true">
            {arena.nome}
          </span>
        </div>
        <div className="ct-info">
          <h2 id="ct-titulo">Como chegar</h2>
          <p className="ct-end">
            {linhaEndereco(arena)}
            {arena.enderecoReferencia && (
              <>
                <br />
                {arena.enderecoReferencia}
              </>
            )}
            <br />
            {cidade}
          </p>
          <div className="ct-acoes">
            <a className="btn-navy" href={maps} target="_blank" rel="noopener">
              <Icone nome="map-pin" />
              Abrir no Google Maps
            </a>
            <a className="btn-borda" href={waze} target="_blank" rel="noopener">
              <Icone nome="navigation" />
              Ir com o Waze
            </a>
            <a className="btn-borda" href={avaliar} target="_blank" rel="noopener">
              <Icone nome="star" />
              Avaliar no Google
            </a>
          </div>
          <dl className="ct-dados">
            <div>
              <dt>Funcionamento</dt>
              <dd>{funcionamento(arena.horarioAbertura, arena.horarioFechamento)}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>
                <a href={`https://wa.me/${arena.whatsappDigitos}`} target="_blank" rel="noopener">
                  {arena.whatsappExibicao}
                </a>
              </dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>{`Sinal de ${arena.percentualSinal}% no Pix ao reservar. O restante na arena.`}</dd>
            </div>
          </dl>
          {arena.politicaCancelamento && (
            <details className="ct-politica">
              <summary>Política de cancelamento</summary>
              <p id="politica-texto">{arena.politicaCancelamento}</p>
            </details>
          )}
          <a className="btn-amarelo ct-whats" href={linkWhatsApp(arena.whatsappDigitos, `Olá! Vim pelo site da ${arena.nome}.`)} target="_blank" rel="noopener">
            <Icone nome="message-circle" />
            Chamar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
