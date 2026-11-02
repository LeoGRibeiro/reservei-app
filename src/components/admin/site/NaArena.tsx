/**
 * @file NaArena.tsx
 * @description Bloco "Na arena" da tela Site: lista editável dos tópicos da seção Estrutura do site
 * ("**3 quadras de areia** tratada"), com adicionar, editar, reordenar e excluir, e prévia de como
 * fica no site. Grava em `arena_conteudo.destaques_estrutura`.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §9.1
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { Aviso, Botao, Cartao, Entrada } from "@/components/admin/ui";
import {
  limparDestaques,
  MAX_DESTAQUE,
  MAX_DESTAQUES,
  MAX_RESTO,
  mover,
  validarDestaques,
  type DestaqueEstrutura,
} from "@/lib/institucional/destaquesEstrutura";

export interface NaArenaProps {
  inicial: DestaqueEstrutura[];
  aoSalvar: (lista: DestaqueEstrutura[]) => Promise<void>;
}

/**
 * @example
 * ```tsx
 * <NaArena inicial={destaques} aoSalvar={salvarDestaques} />
 * ```
 */
export function NaArena({ inicial, aoSalvar }: NaArenaProps) {
  const [lista, setLista] = useState<DestaqueEstrutura[]>(inicial);
  const [salva, setSalva] = useState(JSON.stringify(limparDestaques(inicial)));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const alterada = JSON.stringify(limparDestaques(lista)) !== salva;

  const mudar = (i: number, campo: keyof DestaqueEstrutura, valor: string) => setLista((l) => l.map((d, j) => (j === i ? { ...d, [campo]: valor } : d)));

  async function salvar() {
    const limpa = limparDestaques(lista);
    const encontrados = validarDestaques(limpa);
    setErros(encontrados);
    if (encontrados.length) return;
    setSalvando(true);
    try {
      await aoSalvar(limpa);
      setLista(limpa);
      setSalva(JSON.stringify(limpa));
      toast.success("Tópicos “Na arena” salvos. Já aparecem no site.");
    } catch (err) {
      setErros([err instanceof Error ? err.message : "Não foi possível salvar."]);
    } finally {
      setSalvando(false);
    }
  }

  const previa = limparDestaques(lista).filter((d) => d.destaque);

  return (
    <Cartao
      titulo="Na arena"
      descricao="Lista ao lado das fotos na seção Estrutura do site. A primeira parte sai em negrito."
      acoes={
        <Botao tamanho="sm" onClick={() => void salvar()} carregando={salvando} disabled={!alterada}>
          Salvar tópicos
        </Botao>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {lista.length === 0 && <p className="text-sm text-painel-suave">Nenhum tópico. Sem tópicos, o site esconde a caixa “Na arena”.</p>}
          <ol className="space-y-3" aria-label="Tópicos Na arena">
            {lista.map((d, i) => (
              <li key={i} className="rounded-md border border-painel-linha p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr]">
                  <label className="text-sm text-painel-tinta">
                    <span className="mb-1 block font-medium">Em negrito</span>
                    <Entrada
                      aria-label={`Tópico ${i + 1}: parte em negrito`}
                      value={d.destaque}
                      maxLength={MAX_DESTAQUE}
                      placeholder="3 quadras de areia"
                      onChange={(e) => mudar(i, "destaque", e.target.value)}
                    />
                  </label>
                  <label className="text-sm text-painel-tinta">
                    <span className="mb-1 block font-medium">Complemento</span>
                    <Entrada
                      aria-label={`Tópico ${i + 1}: complemento`}
                      value={d.resto}
                      maxLength={MAX_RESTO}
                      placeholder="tratada, com rede de beach tennis"
                      onChange={(e) => mudar(i, "resto", e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Subir tópico ${i + 1}`} disabled={i === 0} onClick={() => setLista((l) => mover(l, i, -1))}>
                    <ArrowUp aria-hidden className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Descer tópico ${i + 1}`} disabled={i === lista.length - 1} onClick={() => setLista((l) => mover(l, i, 1))}>
                    <ArrowDown aria-hidden className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Excluir tópico ${i + 1}`} onClick={() => setLista((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden className="size-4 text-red-700" />
                  </Botao>
                </div>
              </li>
            ))}
          </ol>
          <Botao variante="secundario" icone={Plus} disabled={lista.length >= MAX_DESTAQUES} onClick={() => setLista((l) => [...l, { destaque: "", resto: "" }])}>
            Adicionar tópico
          </Botao>
          {erros.length > 0 && (
            <Aviso tom="erro" titulo="Confira antes de salvar">
              <ul className="list-disc pl-4">
                {erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Aviso>
          )}
          {alterada && erros.length === 0 && <p className="text-sm text-amber-800">Há mudanças não salvas.</p>}
        </div>

        <div aria-label="Prévia no site" className="rounded-lg bg-painel-elevada p-4">
          <p className="mb-2 text-xs font-medium text-painel-suave">Como fica no site</p>
          <p className="mb-2 font-semibold text-painel-tinta">Na arena</p>
          <ul className="space-y-1.5 text-sm text-painel-tinta">
            {previa.map((d, i) => (
              <li key={i} className="flex gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>
                  <b>{d.destaque}</b> {d.resto}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Cartao>
  );
}
