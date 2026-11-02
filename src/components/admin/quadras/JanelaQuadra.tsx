/**
 * @file JanelaQuadra.tsx
 * @description Cadastro e edição de quadra com tudo o que o site mostra: nome, esportes (com a linha
 * exatamente como aparece no site), piso, preço padrão da hora e foto (envio, enquadramento e texto
 * alternativo). "Coberta" e "iluminação" saíram: o site não mostra (as colunas ficam no banco).
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8
 */

"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Aviso, Botao, Campo, Entrada, Janela, Selecao } from "@/components/admin/ui";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import type { Quadra, TipoPisoQuadra } from "@/lib/arena/types";
import { textoEsportes } from "@/components/portal-arena/reservar/CardQuadra";

export const TIPOS_PISO: { valor: TipoPisoQuadra; rotulo: string }[] = [
  { valor: "areia", rotulo: "Areia" },
  { valor: "society", rotulo: "Grama sintética (society)" },
  { valor: "saibro", rotulo: "Saibro" },
  { valor: "pu_cimentado", rotulo: "Piso PU / poliesportivo" },
  { valor: "madeira", rotulo: "Madeira" },
  { valor: "outro", rotulo: "Outro" },
];

/** Dados do formulário (o que o site usa). */
export interface DadosQuadra {
  nome: string;
  esportes: Esporte[];
  tipoPiso: TipoPisoQuadra;
  valorHoraPadrao: number;
  fotoUrl: string;
  /** "X% Y%" */
  fotoPosicao: string;
  fotoDescricao: string;
}

/** "50% 40%" → [50, 40] (padrão: centro). */
export function lerPosicao(posicao?: string): [number, number] {
  const m = /^(\d{1,3})% (\d{1,3})%$/.exec(posicao ?? "");
  return m ? [Math.min(100, Number(m[1])), Math.min(100, Number(m[2]))] : [50, 50];
}

/** Valida o formulário da quadra. */
export function validarQuadra(d: DadosQuadra): string[] {
  const erros: string[] = [];
  if (!d.nome.trim()) erros.push("Dê um nome à quadra (ex.: Areia 1 · Terraço).");
  if (d.esportes.length === 0) erros.push("Marque pelo menos um esporte.");
  if (!(d.valorHoraPadrao > 0)) erros.push("Informe o preço da hora.");
  if (d.fotoUrl && !d.fotoDescricao.trim()) erros.push("Descreva a foto em poucas palavras (para quem usa leitor de tela).");
  return erros;
}

export interface JanelaQuadraProps {
  quadra?: Quadra;
  aoFechar: () => void;
  aoSalvar: (dados: DadosQuadra) => Promise<void>;
  aoEnviarFoto: (arquivo: File) => Promise<{ success: boolean; url?: string; error?: string }>;
}

/**
 * @example
 * ```tsx
 * <JanelaQuadra quadra={q} aoFechar={fechar} aoSalvar={salvar} aoEnviarFoto={upload} />
 * ```
 */
export function JanelaQuadra({ quadra, aoFechar, aoSalvar, aoEnviarFoto }: JanelaQuadraProps) {
  const [dados, setDados] = useState<DadosQuadra>({
    nome: quadra?.nome ?? "",
    esportes: quadra?.esportes ?? [],
    tipoPiso: quadra?.tipoPiso ?? "areia",
    valorHoraPadrao: quadra?.valorHoraPadrao ?? 80,
    fotoUrl: quadra?.fotoUrl ?? "",
    fotoPosicao: quadra?.fotoPosicao ?? "50% 50%",
    fotoDescricao: quadra?.fotoDescricao ?? "",
  });
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [x, y] = lerPosicao(dados.fotoPosicao);
  const mudar = <K extends keyof DadosQuadra>(campo: K, valor: DadosQuadra[K]) => setDados((d) => ({ ...d, [campo]: valor }));

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setEnviando(true);
    const r = await aoEnviarFoto(arquivo);
    setEnviando(false);
    if (r.success && r.url) {
      mudar("fotoUrl", r.url);
      setErros([]);
    } else setErros([r.error ?? "Não foi possível enviar a foto."]);
  }

  async function salvar() {
    const encontrados = validarQuadra(dados);
    setErros(encontrados);
    if (encontrados.length) return;
    setSalvando(true);
    try {
      await aoSalvar({ ...dados, nome: dados.nome.trim(), fotoDescricao: dados.fotoDescricao.trim() });
    } catch (err) {
      setErros([err instanceof Error ? err.message : "Não foi possível salvar."]);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      aberta
      largura="lg"
      titulo={quadra ? `Editar ${quadra.nome}` : "Nova quadra"}
      descricao="Tudo aqui aparece no card da quadra no site."
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={() => void salvar()} carregando={salvando} disabled={enviando}>
            Salvar quadra
          </Botao>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Campo rotulo="Nome no site" ajuda="Ex.: Areia 1 · Terraço">
            {(id) => <Entrada id={id} value={dados.nome} maxLength={60} onChange={(e) => mudar("nome", e.target.value)} />}
          </Campo>
          <fieldset>
            <legend className="mb-1.5 block text-[15px] font-medium text-painel-tinta">Esportes</legend>
            <div className="flex flex-wrap gap-2">
              {ESPORTES.map((esp) => {
                const marcado = dados.esportes.includes(esp);
                return (
                  <button
                    key={esp}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => mudar("esportes", marcado ? dados.esportes.filter((e) => e !== esp) : [...dados.esportes, esp])}
                    className={
                      "h-9 rounded-md border px-3 text-sm transition-colors " +
                      (marcado
                        ? "border-painel-destaque bg-painel-destaque-suave font-semibold text-painel-destaque-forte"
                        : "border-painel-linha-forte bg-painel-superficie text-painel-tinta hover:bg-painel-elevada")
                    }
                  >
                    {esp}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-painel-suave">
              No site: <strong className="text-painel-tinta">{dados.esportes.length ? textoEsportes(dados.esportes) : "—"}</strong>
            </p>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Piso">
              {(id) => (
                <Selecao id={id} value={dados.tipoPiso} onChange={(e) => mudar("tipoPiso", e.target.value as TipoPisoQuadra)}>
                  {TIPOS_PISO.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Preço da hora (R$)" ajuda="Vale quando nenhuma tarifa cobre o horário.">
              {(id) => (
                <Entrada
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={5}
                  value={dados.valorHoraPadrao || ""}
                  onChange={(e) => mudar("valorHoraPadrao", Number(e.target.value))}
                />
              )}
            </Campo>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[15px] font-medium text-painel-tinta">Foto</p>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-painel-linha bg-painel-elevada">
            {dados.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia com o mesmo enquadramento do site
              <img src={dados.fotoUrl} alt={dados.fotoDescricao || "Prévia da foto"} className="size-full object-cover" style={{ objectPosition: dados.fotoPosicao }} />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-painel-suave">Sem foto: o site mostra um fundo liso.</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-painel-linha-forte bg-painel-superficie px-4 text-sm font-medium text-painel-tinta hover:bg-painel-elevada">
              <ImagePlus aria-hidden className="size-4" />
              {enviando ? "Enviando..." : dados.fotoUrl ? "Trocar foto" : "Enviar foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={enviarFoto} disabled={enviando} aria-label="Enviar foto da quadra" />
            </label>
            {dados.fotoUrl && (
              <Botao variante="fantasma" icone={Trash2} onClick={() => mudar("fotoUrl", "")}>
                Tirar foto
              </Botao>
            )}
          </div>
          {dados.fotoUrl && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm text-painel-tinta">
                  Enquadrar na horizontal
                  <input type="range" min={0} max={100} value={x} onChange={(e) => mudar("fotoPosicao", `${e.target.value}% ${y}%`)} className="mt-1 w-full accent-[var(--painel-destaque)]" />
                </label>
                <label className="text-sm text-painel-tinta">
                  Enquadrar na vertical
                  <input type="range" min={0} max={100} value={y} onChange={(e) => mudar("fotoPosicao", `${x}% ${e.target.value}%`)} className="mt-1 w-full accent-[var(--painel-destaque)]" />
                </label>
              </div>
              <Campo rotulo="Descrição da foto" ajuda="Para quem usa leitor de tela. Ex.: Quadra de areia coberta com rede de beach tennis.">
                {(id) => <Entrada id={id} value={dados.fotoDescricao} maxLength={140} onChange={(e) => mudar("fotoDescricao", e.target.value)} />}
              </Campo>
            </>
          )}
          <p className="text-xs text-painel-suave">JPG, PNG ou WebP de até 5 MB. Foto deitada funciona melhor.</p>
        </div>
      </div>
      {erros.length > 0 && (
        <div className="mt-4">
          <Aviso tom="erro" titulo="Confira antes de salvar">
            <ul className="list-disc pl-4">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Aviso>
        </div>
      )}
    </Janela>
  );
}
