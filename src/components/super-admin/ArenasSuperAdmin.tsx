/**
 * @file ArenasSuperAdmin.tsx
 * @description Painel de arenas do Super Admin: lista todas as arenas e altera o que só a plataforma
 * controla (endereço, módulos contratados, arena ativa e modo demonstração), além de gerar uma senha
 * temporária para o dono. Usa a senha de Super Admin digitada no topo da página.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano A)
 */

"use client";

import { useCallback, useState } from "react";
import { MODULOS_DISPONIVEIS, type ModuloArena } from "@/lib/arena/modulos";
import type { ArenaPlataforma } from "@/lib/admin/arenasPlataforma";

/** Módulos que podem ser ligados ou desligados (o agendamento é sempre ativo). */
const MODULOS_OPCIONAIS = (Object.keys(MODULOS_DISPONIVEIS) as ModuloArena[]).filter((id) => id !== "agendamento_core");

const ROTULO_MODO: Record<string, string> = {
  manual: "Pix direto",
  asaas: "Asaas",
  simulado: "Demonstração",
};

interface Mensagem {
  tipo: "sucesso" | "erro";
  texto: string;
}

async function chamar<T>(segredo: string, url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "x-super-admin-secret": segredo, ...(init?.headers ?? {}) },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as T & { error?: string };
  if (!resposta.ok) throw new Error(corpo.error ?? "Falha na operação.");
  return corpo;
}

const classeCampo =
  "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500";

/**
 * Formulário de edição de uma arena (endereço, módulos, status e demonstração).
 */
function EditarArena({
  arena,
  segredo,
  aoSalvar,
  aoCancelar,
}: {
  arena: ArenaPlataforma;
  segredo: string;
  aoSalvar: (arena: ArenaPlataforma) => void;
  aoCancelar: () => void;
}) {
  const [slug, setSlug] = useState(arena.slug);
  const [modulos, setModulos] = useState<ModuloArena[]>(arena.modulos);
  const [ativo, setAtivo] = useState(arena.ativo);
  const [demonstracao, setDemonstracao] = useState(arena.modoPagamento === "simulado");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarModulo(id: ModuloArena) {
    setModulos((atual) => (atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const trocouEndereco = slug.trim() !== arena.slug;
    if (
      trocouEndereco &&
      !window.confirm(
        `Trocar o endereço de "${arena.slug}" para "${slug.trim()}"? Quem acessar o endereço antigo será levado para o novo.`
      )
    ) {
      return;
    }
    if (!ativo && arena.ativo && !window.confirm(`Desativar "${arena.nome}"? O site e o painel dela saem do ar.`)) return;

    setSalvando(true);
    setErro(null);
    try {
      const { arena: salva } = await chamar<{ arena: ArenaPlataforma }>(segredo, `/api/super-admin/arenas/${encodeURIComponent(arena.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ slug: slug.trim(), modulos, ativo, modoDemonstracao: demonstracao }),
      });
      aoSalvar(salva);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 border-t border-slate-800 pt-3 space-y-3" aria-label={`Editar ${arena.nome}`}>
      <div>
        <label htmlFor={`sa-slug-${arena.id}`} className="block text-xs font-medium text-slate-400 mb-1">
          Endereço (subdomínio)
        </label>
        <input
          id={`sa-slug-${arena.id}`}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          className={classeCampo}
          required
        />
        <p className="text-xs text-slate-500 mt-1">Só letras minúsculas, números e hífens. O endereço antigo continua funcionando (redireciona).</p>
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-slate-400 mb-1">Módulos contratados</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {MODULOS_OPCIONAIS.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={modulos.includes(id)} onChange={() => alternarModulo(id)} />
              {MODULOS_DISPONIVEIS[id].nome}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Arena ativa (site e painel no ar)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={demonstracao} onChange={(e) => setDemonstracao(e.target.checked)} />
          Modo demonstração (pagamento simulado)
        </label>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-red-400">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-semibold"
        >
          {salvando ? "Salvando..." : "Salvar arena"}
        </button>
        <button type="button" onClick={aoCancelar} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Lista de arenas da plataforma com edição e acesso do dono.
 *
 * @param props.segredo Senha de Super Admin digitada no topo da página
 */
export function ArenasSuperAdmin({ segredo }: { segredo: string }) {
  const [arenas, setArenas] = useState<ArenaPlataforma[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMensagem(null);
    try {
      const { arenas: lista } = await chamar<{ arenas: ArenaPlataforma[] }>(segredo, "/api/super-admin/arenas");
      setArenas(lista);
    } catch (err) {
      setMensagem({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao carregar." });
    } finally {
      setCarregando(false);
    }
  }, [segredo]);

  async function gerarSenhaDono(arena: ArenaPlataforma) {
    if (!window.confirm(`Gerar nova senha para o dono de "${arena.nome}"? A senha atual deixa de valer.`)) return;
    setMensagem(null);
    try {
      const acesso = await chamar<{ email: string; senhaTemporaria: string }>(segredo, "/api/super-admin/acesso", {
        method: "POST",
        body: JSON.stringify({ slug: arena.slug }),
      });
      setMensagem({
        tipo: "sucesso",
        texto: `${arena.nome}: login ${acesso.email} · senha temporária ${acesso.senhaTemporaria} (troca obrigatória no próximo acesso)`,
      });
    } catch (err) {
      setMensagem({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao gerar a senha." });
    }
  }

  return (
    <section className="w-full max-w-3xl bg-slate-900 border border-slate-700/60 rounded-xl p-6 space-y-4" aria-label="Arenas">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white">Arenas</h2>
        <button
          type="button"
          onClick={carregar}
          disabled={carregando || !segredo}
          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {carregando ? "Carregando..." : arenas ? "Atualizar lista" : "Carregar arenas"}
        </button>
      </div>

      {mensagem && (
        <p role={mensagem.tipo === "erro" ? "alert" : "status"} className={`text-sm break-all ${mensagem.tipo === "erro" ? "text-red-400" : "text-emerald-400"}`}>
          {mensagem.texto}
        </p>
      )}

      {arenas && arenas.length === 0 && <p className="text-sm text-slate-400">Nenhuma arena cadastrada.</p>}

      <ul className="divide-y divide-slate-800">
        {arenas?.map((arena) => (
          <li key={arena.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {arena.nome}{" "}
                  <span className={`text-xs font-normal ${arena.ativo ? "text-emerald-400" : "text-red-400"}`}>
                    {arena.ativo ? "ativa" : "desativada"}
                  </span>
                </p>
                <p className="text-xs text-slate-400 break-all">
                  {arena.url}
                  {arena.slugAnterior && <> · antes: {arena.slugAnterior}</>}
                </p>
                <p className="text-xs text-slate-500">
                  Dono: {arena.emailDono ?? "ainda não ativou"} · Recebimento: {ROTULO_MODO[arena.modoPagamento] ?? arena.modoPagamento}
                </p>
                <p className="text-xs text-slate-500">
                  Módulos: {arena.modulos.filter((m) => m !== "agendamento_core").map((m) => MODULOS_DISPONIVEIS[m].nome).join(", ") || "só agendamento"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditando(editando === arena.id ? null : arena.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Editar
                </button>
                {arena.emailDono && (
                  <button
                    type="button"
                    onClick={() => gerarSenhaDono(arena)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Nova senha do dono
                  </button>
                )}
              </div>
            </div>
            {editando === arena.id && (
              <EditarArena
                arena={arena}
                segredo={segredo}
                aoCancelar={() => setEditando(null)}
                aoSalvar={(salva) => {
                  setArenas((lista) => lista?.map((a) => (a.id === salva.id ? salva : a)) ?? null);
                  setEditando(null);
                  setMensagem({ tipo: "sucesso", texto: `${salva.nome} atualizada.` });
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
