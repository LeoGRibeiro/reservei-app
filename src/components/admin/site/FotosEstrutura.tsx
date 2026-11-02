/**
 * @file FotosEstrutura.tsx
 * @description Bloco "Fotos da estrutura" da tela Site: enviar, trocar, reordenar, ocultar e excluir
 * fotos, com uma legenda curta (o site mostra a legenda sobre a foto e usa como texto alternativo).
 * O site mostra só as {@link FOTOS_ESTRUTURA} primeiras fotos visíveis; o painel marca quais são.
 * Sem categoria e sem "descrição": o site não usa.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §9
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Aviso, Botao, Campo, Cartao, Confirmacao, Entrada, EstadoVazio, Etiqueta, Janela } from "@/components/admin/ui";
import type { GaleriaItem } from "@/lib/institucional/types";

/** Quantas fotos o site mostra na seção Estrutura (bento de 4). */
export const FOTOS_ESTRUTURA = 4;
/** Legenda curta (cabe sobre a foto). */
export const MAX_LEGENDA = 40;

/** Ids das fotos que aparecem no site: as primeiras visíveis, na ordem. */
export function fotosNoSite(fotos: readonly GaleriaItem[]): Set<string> {
  return new Set(
    [...fotos]
      .filter((f) => f.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, FOTOS_ESTRUTURA)
      .map((f) => f.id)
  );
}

/** Valida a legenda. */
export function validarLegenda(legenda: string): string | null {
  const t = legenda.trim();
  if (t.length < 2) return "Escreva uma legenda curta (ex.: Quadras de areia).";
  if (t.length > MAX_LEGENDA) return `Use até ${MAX_LEGENDA} letras.`;
  return null;
}

export interface FotosEstruturaProps {
  fotos: GaleriaItem[];
  aoEnviarImagem: (arquivo: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  aoCriar: (dados: { imageUrl: string; legenda: string; ordem: number }) => Promise<void>;
  aoAtualizar: (id: string, dados: Partial<{ imageUrl: string; legenda: string; ordem: number; visivel: boolean }>) => Promise<void>;
  aoExcluir: (id: string) => Promise<void>;
}

/** Janela de nova foto ou edição (trocar imagem e legenda). */
function JanelaFoto({
  foto,
  aoFechar,
  aoEnviarImagem,
  aoSalvar,
}: {
  foto?: GaleriaItem;
  aoFechar: () => void;
  aoEnviarImagem: FotosEstruturaProps["aoEnviarImagem"];
  aoSalvar: (dados: { imageUrl: string; legenda: string }) => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState(foto?.imageUrl ?? "");
  const [legenda, setLegenda] = useState(foto?.title ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    const r = await aoEnviarImagem(arquivo);
    setEnviando(false);
    if (r.success && r.url) setImageUrl(r.url);
    else setErro(r.error ?? "Não foi possível enviar a foto.");
  }

  async function salvar() {
    if (!imageUrl) return setErro("Envie a foto primeiro.");
    const erroLegenda = validarLegenda(legenda);
    if (erroLegenda) return setErro(erroLegenda);
    setSalvando(true);
    try {
      await aoSalvar({ imageUrl, legenda: legenda.trim() });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      aberta
      titulo={foto ? "Editar foto" : "Nova foto da estrutura"}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={() => void salvar()} carregando={salvando} disabled={enviando}>
            Salvar foto
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-painel-linha bg-painel-elevada">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia da foto enviada
            <img src={imageUrl} alt={legenda || "Prévia"} className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-painel-suave">Nenhuma foto enviada</div>
          )}
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-painel-linha-forte bg-painel-superficie px-4 text-sm font-medium text-painel-tinta hover:bg-painel-elevada">
          <ImagePlus aria-hidden className="size-4" />
          {enviando ? "Enviando..." : imageUrl ? "Trocar foto" : "Escolher foto"}
          <input type="file" accept="image/*" className="sr-only" onChange={enviar} disabled={enviando} aria-label="Escolher foto da estrutura" />
        </label>
        <p className="text-xs text-painel-suave">Pode ser foto do celular: o painel reduz o tamanho antes de enviar.</p>
        <Campo rotulo="Legenda no site" ajuda="Aparece sobre a foto. Ex.: Quadras de areia, Bar e lanchonete.">
          {(id) => <Entrada id={id} value={legenda} maxLength={MAX_LEGENDA} onChange={(e) => setLegenda(e.target.value)} />}
        </Campo>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

/**
 * @example
 * ```tsx
 * <FotosEstrutura fotos={galeria} aoEnviarImagem={upload} aoCriar={criar} aoAtualizar={atualizar} aoExcluir={excluir} />
 * ```
 */
export function FotosEstrutura({ fotos, aoEnviarImagem, aoCriar, aoAtualizar, aoExcluir }: FotosEstruturaProps) {
  const ordenadas = [...fotos].sort((a, b) => a.displayOrder - b.displayOrder);
  const noSite = fotosNoSite(fotos);
  const [janela, setJanela] = useState<{ foto?: GaleriaItem } | null>(null);
  const [excluindo, setExcluindo] = useState<GaleriaItem | null>(null);

  async function executar(acao: () => Promise<void>, sucesso: string) {
    try {
      await acao();
      toast.success(sucesso);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  /** Troca a posição com a vizinha (renumera para evitar empates de ordem). */
  async function mover(indice: number, sentido: -1 | 1) {
    const a = ordenadas[indice];
    const b = ordenadas[indice + sentido];
    if (!a || !b) return;
    await executar(async () => {
      await aoAtualizar(a.id, { ordem: indice + sentido + 1 });
      await aoAtualizar(b.id, { ordem: indice + 1 });
    }, "Ordem atualizada.");
  }

  return (
    <Cartao
      titulo="Fotos da estrutura"
      descricao={`O site mostra as ${FOTOS_ESTRUTURA} primeiras fotos visíveis, nesta ordem.`}
      acoes={
        <Botao icone={Plus} tamanho="sm" onClick={() => setJanela({})}>
          Adicionar foto
        </Botao>
      }
    >
      {ordenadas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma foto ainda" descricao="Sem fotos, a seção Estrutura do site mostra só os tópicos “Na arena”." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Fotos da estrutura">
          {ordenadas.map((f, i) => (
            <li key={f.id} aria-label={f.title} className="flex flex-col overflow-hidden rounded-lg border border-painel-linha">
              <div className="relative aspect-[4/3] overflow-hidden bg-painel-elevada">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura da galeria */}
                <img src={f.imageUrl} alt={f.title} className={"absolute inset-0 size-full object-cover " + (f.isActive ? "" : "opacity-40")} />
                <span className="absolute left-2 top-2">
                  {noSite.has(f.id) ? <Etiqueta tom="quitada">No site</Etiqueta> : f.isActive ? <Etiqueta>Fora do site</Etiqueta> : <Etiqueta tom="cancelada">Oculta</Etiqueta>}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="font-semibold text-painel-tinta">{f.title}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1">
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Mover ${f.title} para antes`} disabled={i === 0} onClick={() => void mover(i, -1)}>
                    <ArrowUp aria-hidden className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Mover ${f.title} para depois`} disabled={i === ordenadas.length - 1} onClick={() => void mover(i, 1)}>
                    <ArrowDown aria-hidden className="size-4" />
                  </Botao>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    aria-label={f.isActive ? `Ocultar ${f.title}` : `Mostrar ${f.title}`}
                    onClick={() => void executar(() => aoAtualizar(f.id, { visivel: !f.isActive }), f.isActive ? "Foto oculta." : "Foto visível.")}
                  >
                    {f.isActive ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Editar ${f.title}`} onClick={() => setJanela({ foto: f })}>
                    <Pencil aria-hidden className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Excluir ${f.title}`} onClick={() => setExcluindo(f)}>
                    <Trash2 aria-hidden className="size-4 text-red-700" />
                  </Botao>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {janela && (
        <JanelaFoto
          foto={janela.foto}
          aoFechar={() => setJanela(null)}
          aoEnviarImagem={aoEnviarImagem}
          aoSalvar={async (dados) => {
            if (janela.foto) await aoAtualizar(janela.foto.id, { imageUrl: dados.imageUrl, legenda: dados.legenda });
            else await aoCriar({ ...dados, ordem: (ordenadas.at(-1)?.displayOrder ?? 0) + 1 });
            toast.success(janela.foto ? "Foto atualizada." : "Foto adicionada.");
            setJanela(null);
          }}
        />
      )}
      <Confirmacao
        aberta={!!excluindo}
        titulo="Excluir esta foto?"
        rotuloConfirmar="Excluir"
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={async () => {
          if (!excluindo) return;
          await executar(() => aoExcluir(excluindo.id), "Foto excluída.");
          setExcluindo(null);
        }}
      >
        &ldquo;{excluindo?.title}&rdquo; sai do site. Para tirar só por um tempo, use o olho (ocultar).
      </Confirmacao>
    </Cartao>
  );
}
