/**
 * @file AdminEquipePage.tsx
 * @description Tela Equipe (somente proprietário): convidar gerentes e operadores de balcão, mudar papel,
 * desativar acesso e gerar nova senha temporária. A credencial temporária aparece uma única vez, com
 * atalhos para copiar ou enviar pelo WhatsApp.
 */

"use client";

import { useState } from "react";
import { UserCog, UserPlus, KeyRound, Copy, MessageCircle, Power, X } from "lucide-react";
import { toast } from "sonner";
import { useEquipeArena } from "@/hooks/useEquipeArena";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { DESCRICAO_PAPEL, PAPEIS_CONVIDAVEIS, ROTULO_PAPEL } from "@/lib/admin/permissoes";
import type { CredencialTemporaria } from "@/lib/admin/equipeServidorService";
import type { ArenaUserRole } from "@/lib/arena/types";

const CLASSE_INPUT =
  "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500";

/**
 * Monta a mensagem de acesso enviada ao novo membro.
 *
 * @param nomeArena Nome da arena
 * @param credencial E-mail e senha temporária
 * @param urlPainel Endereço do painel
 * @returns Texto da mensagem
 */
export function montarMensagemAcesso(nomeArena: string, credencial: CredencialTemporaria, urlPainel: string): string {
  return (
    `Olá! Seu acesso ao painel da *${nomeArena}* está pronto.\n\n` +
    `🔗 ${urlPainel}\n` +
    `📧 E-mail: ${credencial.email}\n` +
    `🔑 Senha temporária: ${credencial.senhaTemporaria}\n\n` +
    `No primeiro acesso você vai criar a sua própria senha.`
  );
}

/** Caixa que exibe a credencial temporária recém-gerada. */
function CaixaCredencial({
  credencial,
  nomeArena,
  onFechar,
}: {
  credencial: CredencialTemporaria;
  nomeArena: string;
  onFechar: () => void;
}) {
  const urlPainel = typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";
  const mensagem = montarMensagemAcesso(nomeArena, credencial, urlPainel);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      toast.success("Mensagem de acesso copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  return (
    <div role="alert" className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-emerald-300">Acesso gerado</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Esta senha aparece só agora. Envie para a pessoa; ela vai trocá-la no primeiro acesso.
          </p>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="text-slate-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono">
        {mensagem}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={copiar}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" /> Copiar mensagem
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}

interface Props {
  /** Slug da arena ativa */
  arenaSlug: string;
  /** Usuário logado (não pode alterar o próprio acesso) */
  usuarioId: string | null;
}

export function AdminEquipePage({ arenaSlug, usuarioId }: Props) {
  const nomeArena = useConfiguracaoSiteArena().nomePlataforma;
  const { membros, carregando, erro, convidar, alterar, redefinirSenha } = useEquipeArena(arenaSlug);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ArenaUserRole>("operador");
  const [enviando, setEnviando] = useState(false);
  const [credencial, setCredencial] = useState<CredencialTemporaria | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const res = await convidar({ nome, email, role });
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.erro);
      return;
    }
    setCredencial(res.credencial ?? null);
    setNome("");
    setEmail("");
    toast.success("Membro convidado.");
  };

  const acaoMembro = async (userId: string, acao: () => Promise<{ ok: boolean; erro?: string; credencial?: CredencialTemporaria }>, sucesso: string) => {
    setOcupadoId(userId);
    const res = await acao();
    setOcupadoId(null);
    if (!res.ok) {
      toast.error(res.erro);
      return;
    }
    if (res.credencial) setCredencial(res.credencial);
    toast.success(sucesso);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <UserCog className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Equipe</h1>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Dê acesso ao painel para quem trabalha na arena. Cada perfil vê só o que precisa.
        </p>
      </div>

      {credencial && (
        <CaixaCredencial credencial={credencial} nomeArena={nomeArena} onFechar={() => setCredencial(null)} />
      )}

      <form onSubmit={handleConvidar} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-400" />
          Convidar membro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="equipe-nome" className="block text-xs font-semibold text-slate-400 mb-1">
              Nome
            </label>
            <input id="equipe-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={CLASSE_INPUT} required />
          </div>
          <div>
            <label htmlFor="equipe-email" className="block text-xs font-semibold text-slate-400 mb-1">
              E-mail (usado no login)
            </label>
            <input
              id="equipe-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={CLASSE_INPUT}
              required
            />
          </div>
        </div>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="block text-xs font-semibold text-slate-400 mb-2">Perfil de acesso</legend>
          {PAPEIS_CONVIDAVEIS.map((papel) => (
            <label
              key={papel}
              className={`cursor-pointer rounded-xl border p-3 text-sm ${
                role === papel ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800 bg-slate-950"
              }`}
            >
              <input
                type="radio"
                name="equipe-role"
                value={papel}
                checked={role === papel}
                onChange={() => setRole(papel)}
                className="sr-only"
              />
              <span className="font-bold text-white block">{ROTULO_PAPEL[papel]}</span>
              <span className="text-xs text-slate-400">{DESCRICAO_PAPEL[papel]}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          disabled={enviando}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
        >
          {enviando ? "Gerando acesso..." : "Gerar acesso"}
        </button>
      </form>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white">Membros</h2>
        {carregando && membros.length === 0 ? (
          <p className="text-sm text-slate-500">Carregando equipe...</p>
        ) : erro ? (
          <p className="text-sm text-red-400">{erro}</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {membros.map((m) => {
              const ehVoce = m.userId === usuarioId;
              const editavel = !ehVoce && m.role !== "proprietario";
              const ocupado = ocupadoId === m.userId;
              return (
                <li key={m.userId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className={m.ativo ? "" : "opacity-50"}>
                    <p className="text-sm font-bold text-white">
                      {m.nome} {ehVoce && <span className="text-xs text-slate-500">(você)</span>}
                    </p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {ROTULO_PAPEL[m.role]}
                      {!m.ativo && " · acesso desativado"}
                      {m.ativo && m.senhaPendente && " · ainda não fez o primeiro acesso"}
                    </p>
                  </div>
                  {editavel && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Perfil de ${m.nome}`}
                        value={m.role}
                        disabled={ocupado}
                        onChange={(e) =>
                          acaoMembro(m.userId, () => alterar(m.userId, { role: e.target.value as ArenaUserRole }), "Perfil atualizado.")
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        {PAPEIS_CONVIDAVEIS.map((p) => (
                          <option key={p} value={p}>
                            {ROTULO_PAPEL[p]}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={ocupado}
                        onClick={() => acaoMembro(m.userId, () => redefinirSenha(m.userId), "Nova senha temporária gerada.")}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Nova senha
                      </button>
                      <button
                        disabled={ocupado}
                        onClick={() =>
                          acaoMembro(
                            m.userId,
                            () => alterar(m.userId, { ativo: !m.ativo }),
                            m.ativo ? "Acesso desativado." : "Acesso reativado."
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                          m.ativo
                            ? "bg-red-500/10 border-red-500/30 text-red-300"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" /> {m.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
