/**
 * @file RodapeArena.tsx
 * @description Rodapé do portal: marca e endereço; colunas "Na página", "Ajuda" (Regras e dúvidas em
 * destaque, Cancelamento e chuva, Perguntas frequentes) e "Contato"; linha final com o link da
 * plataforma (MarcArena) e o crédito do mapa.
 */

import Link from "next/link";
import type { MouseEvent } from "react";
import { funcionamento } from "@/lib/portal/formatos";
import type { ArenaPortal } from "@/lib/portal/types";
import type { ItemMenu } from "@/lib/portal/visibilidade";
import { Icone } from "./Icone";

/** Página comercial da plataforma ("tenha um site assim na sua arena"). */
export const URL_PLATAFORMA = process.env.NEXT_PUBLIC_URL_PAGINA_COMERCIAL || "/para-arenas";

export interface RodapeArenaProps {
  arena: ArenaPortal;
  itens: ItemMenu[];
  ano: number;
  temPerguntas: boolean;
  aoNavegar: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
}

/**
 * @example
 * ```tsx
 * <RodapeArena arena={dados.arena} itens={itens} ano={2026} temPerguntas aoNavegar={navegar} />
 * ```
 */
export function RodapeArena({ arena, itens, ano, temPerguntas, aoNavegar }: RodapeArenaProps) {
  const endereco = [arena.endereco, arena.bairro, `${arena.cidade}/${arena.estado}`].filter(Boolean).join(" · ");
  return (
    <footer className="rodape">
      <div className="wrap rp-topo">
        <a className="rp-marca" href="#reservar" onClick={(e) => aoNavegar(e, "reservar")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
          <img src={arena.logoUrl} alt="" width={388} height={374} />
          <span>
            <b>{arena.nome}</b>
            <span>{endereco}</span>
          </span>
        </a>
        <nav className="rp-nav" aria-label="Rodapé">
          <p className="rp-tit">Na página</p>
          {itens.map((item) => (
            <a key={item.id} href={`#${item.id}`} onClick={(e) => aoNavegar(e, item.id)}>
              {item.rotulo}
            </a>
          ))}
        </nav>
        <nav className="rp-nav" aria-label="Ajuda">
          <p className="rp-tit">Ajuda</p>
          <Link className="btn-borda-claro rp-regras" href="/regras">
            <Icone nome="file-text" />
            Regras e dúvidas
          </Link>
          <Link href="/regras#cancelamento">Cancelamento e chuva</Link>
          {temPerguntas && <Link href="/regras#perguntas">Perguntas frequentes</Link>}
        </nav>
        <div className="rp-contato">
          <p className="rp-tit">Contato</p>
          <a href={`https://wa.me/${arena.whatsappDigitos}`} target="_blank" rel="noopener">
            {`WhatsApp ${arena.whatsappExibicao}`}
          </a>
          {arena.instagram && (
            <a href={`https://www.instagram.com/${arena.instagram}/`} target="_blank" rel="noopener">
              {`Instagram @${arena.instagram}`}
            </a>
          )}
          <span>{funcionamento(arena.horarioAbertura, arena.horarioFechamento)}</span>
        </div>
      </div>
      <div className="wrap rp-base">
        <span>{`© ${ano} ${arena.nome}`}</span>
        <span>
          <a className="rp-plataforma" href={URL_PLATAFORMA} target="_blank" rel="noopener">
            Reservas online com <b>MarcArena</b> · tenha um site assim na sua arena
          </a>
          {arena.mapaUrl ? " · Mapa © colaboradores do OpenStreetMap" : ""}
        </span>
      </div>
    </footer>
  );
}
