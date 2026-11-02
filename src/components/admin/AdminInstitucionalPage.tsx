/**
 * @module components/admin/AdminInstitucionalPage
 *
 * Tela **Site** do painel: só o que aparece na seção Estrutura do site da arena, em dois blocos.
 * 1. {@link FotosEstrutura}: fotos (enviar, trocar, reordenar, ocultar, excluir) com legenda curta.
 *    Categoria fixa e sem "descrição": o site não usa (a legenda serve de texto alternativo).
 * 2. {@link NaArena}: tópicos "Na arena" (`arena_conteudo.destaques_estrutura`).
 *
 * As escolinhas do site ficam no menu Escolinhas.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §9
 */

"use client";

import { useEffect, useState } from "react";
import { useInstitucionalService } from "@/hooks/useInstitucionalService";
import { carregarDestaques, salvarDestaques, type DestaqueEstrutura } from "@/lib/institucional/destaquesEstrutura";
import { Aviso, CabecalhoPagina, Carregando } from "@/components/admin/ui";
import { FotosEstrutura } from "./site/FotosEstrutura";
import { NaArena } from "./site/NaArena";

/**
 * @example
 * ```tsx
 * // app/(plataforma)/admin/(painel)/site/page.tsx
 * export default function Page() { return <AdminInstitucionalPage />; }
 * ```
 */
export function AdminInstitucionalPage() {
  const { galeria, carregando, criarFoto, atualizarFoto, removerFoto, fazerUploadImagem } = useInstitucionalService();
  const [destaques, setDestaques] = useState<DestaqueEstrutura[] | null>(null);
  const [erroDestaques, setErroDestaques] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarDestaques()
      .then((d) => ativo && setDestaques(d))
      .catch((e: unknown) => {
        if (!ativo) return;
        setErroDestaques(e instanceof Error ? e.message : "Não foi possível ler os tópicos.");
        setDestaques([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Site" descricao="Fotos e tópicos da seção Estrutura do site da arena. As escolinhas ficam no menu Escolinhas." />

      {carregando ? (
        <Carregando texto="Carregando fotos..." />
      ) : (
        <FotosEstrutura
          fotos={galeria}
          aoEnviarImagem={(arquivo) => fazerUploadImagem(arquivo, "galeria")}
          aoCriar={async ({ imageUrl, legenda, ordem }) => {
            await criarFoto({ imageUrl, title: legenda, description: legenda, categoria: "quadras", displayOrder: ordem, isActive: true });
          }}
          aoAtualizar={async (id, dados) => {
            await atualizarFoto(id, {
              ...(dados.imageUrl !== undefined ? { imageUrl: dados.imageUrl } : {}),
              ...(dados.legenda !== undefined ? { title: dados.legenda, description: dados.legenda } : {}),
              ...(dados.ordem !== undefined ? { displayOrder: dados.ordem } : {}),
              ...(dados.visivel !== undefined ? { isActive: dados.visivel } : {}),
            });
          }}
          aoExcluir={async (id) => {
            await removerFoto(id);
          }}
        />
      )}

      {erroDestaques && <Aviso tom="erro">{erroDestaques}</Aviso>}
      {destaques === null ? <Carregando texto="Carregando tópicos..." /> : <NaArena inicial={destaques} aoSalvar={salvarDestaques} />}
    </div>
  );
}
