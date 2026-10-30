/**
 * @file SecaoInstagram.tsx
 * @description Instagram (`#instagram`): cabeçalho de perfil (@, posts e seguidores quando existem,
 * "Seguir") e grade de 8 posts no computador e 6 no celular, com fixado, Reels e carrossel.
 */

import { haQuanto, hojeDe } from "./instagramDatas";
import type { PerfilInstagram, PostInstagram } from "@/lib/portal/types";
import { Icone } from "../Icone";

export interface SecaoInstagramProps {
  usuario: string;
  nomeArena: string;
  logoUrl: string;
  perfil: PerfilInstagram | null;
  posts: PostInstagram[];
  /** Hoje no fuso da arena (para "há 3 dias") */
  hoje: string;
  fuso: string;
}

const TIPO = { reels: ["play", "Reels"], carrossel: ["copy", "Carrossel"] } as const;

/** "Arena X no Instagram · 312 posts · 4.120 seguidores". */
export function linhaPerfil(nomeArena: string, perfil: PerfilInstagram | null): string {
  const partes = [`${nomeArena} no Instagram`];
  if (perfil?.totalPosts !== undefined) partes.push(`${perfil.totalPosts.toLocaleString("pt-BR")} posts`);
  if (perfil?.seguidores !== undefined) partes.push(`${perfil.seguidores.toLocaleString("pt-BR")} seguidores`);
  return partes.join(" · ");
}

/**
 * @example
 * ```tsx
 * <SecaoInstagram usuario="minhaarena" nomeArena="Minha Arena" logoUrl="/logo.png" perfil={null} posts={posts} hoje={hoje} fuso="America/Belem" />
 * ```
 */
export function SecaoInstagram({ usuario, nomeArena, logoUrl, perfil, posts, hoje, fuso }: SecaoInstagramProps) {
  const link = `https://www.instagram.com/${usuario}/`;
  const temContagem = perfil?.totalPosts !== undefined || perfil?.seguidores !== undefined;
  return (
    <section className="secao instagram" id="instagram" aria-labelledby="ig-titulo">
      <div className="wrap">
        <div className="ig-cab">
          <a className="ig-avatar" href={link} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
            <img src={logoUrl} alt="" width={388} height={374} loading="lazy" />
          </a>
          <div className="ig-quem">
            <h2 id="ig-titulo">{`@${usuario}`}</h2>
            <p className="num">
              {`${linhaPerfil(nomeArena, perfil)}${temContagem && perfil?.contagemSimulada ? " " : ""}`}
              {temContagem && perfil?.contagemSimulada && <small>(simulado)</small>}
            </p>
          </div>
          <a className="btn-navy" href={link} target="_blank" rel="noopener">
            <Icone nome="instagram" />
            Seguir no Instagram
          </a>
        </div>
        <ul className="ig-grade" id="ig-posts">
          {posts.map((p) => {
            const tipo = p.tipo === "foto" ? null : TIPO[p.tipo];
            return (
              <li key={p.id} className="post">
                <a href={p.link || link} target="_blank" rel="noopener">
                  <span className="post-img">
                    {/* eslint-disable-next-line @next/next/no-img-element -- capa do post em object-fit */}
                    <img
                      src={p.imagemUrl}
                      alt={p.descricao}
                      width={p.largura}
                      height={p.altura}
                      style={p.posicao ? { objectPosition: p.posicao } : undefined}
                      loading="lazy"
                    />
                    {p.fixado && (
                      <span className="post-fix">
                        <Icone nome="pin" />
                        Fixado
                      </span>
                    )}
                    {tipo && (
                      <span className="post-tipo">
                        <Icone nome={tipo[0]} />
                        <span className="sr">{tipo[1]}</span>
                      </span>
                    )}
                  </span>
                  <span className="post-leg">{p.legenda}</span>
                  <span className="post-data">{haQuanto(hojeDe(p.publicadoEm, fuso), hoje)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
