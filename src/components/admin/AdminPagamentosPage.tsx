/**
 * @file AdminPagamentosPage.tsx
 * @description Tela Pagamentos (somente proprietário): define como a arena recebe o Pix das reservas online.
 * - Chave Pix da arena (manual): sem taxas e sem integração; o balcão confere o extrato.
 * - Conta Asaas da arena: confirmação automática; o dono cola a chave de API e o resto é configurado sozinho.
 * - Demonstração: pagamento simulado (só em ambientes de demonstração).
 * O dinheiro sempre cai na conta da própria arena.
 */

"use client";

import { useEffect, useState } from "react";
import { Wallet, KeyRound, Zap, FlaskConical, CheckCircle2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { usePagamentosArena } from "@/hooks/usePagamentosArena";
import type { ModoPagamentoArena } from "@/lib/arena/types";
import type { TipoChavePix } from "@/lib/pagamento/brCode";

const CLASSE_INPUT =
  "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500";

const ROTULO_MODO: Record<ModoPagamentoArena, string> = {
  manual: "Pix direto na chave da arena",
  asaas: "Conta Asaas da arena (confirmação automática)",
  simulado: "Demonstração (pagamento simulado)",
  legado: "Configuração antiga",
};

const TIPOS_CHAVE: Array<{ valor: TipoChavePix; rotulo: string }> = [
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "cpf", rotulo: "CPF" },
  { valor: "telefone", rotulo: "Celular" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "aleatoria", rotulo: "Chave aleatória" },
];

/** Selo "Em uso" exibido no cartão do modo ativo. */
function SeloEmUso() {
  return (
    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
      <CheckCircle2 className="w-3.5 h-3.5" /> Em uso
    </span>
  );
}

interface Props {
  arenaSlug: string;
}

export function AdminPagamentosPage({ arenaSlug }: Props) {
  const { resumo, carregando, erro, salvarPix, definirModo, conectarAsaas, desconectarAsaas } =
    usePagamentosArena(arenaSlug);

  const [tipoChave, setTipoChave] = useState<TipoChavePix>("cnpj");
  const [chave, setChave] = useState("");
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [cidadeRecebedor, setCidadeRecebedor] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Preenche o formulário com a chave já cadastrada
  useEffect(() => {
    if (!resumo?.pixManual) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o formulário com o servidor
    setTipoChave(resumo.pixManual.tipoChave);
    setChave(resumo.pixManual.chave);
    setNomeRecebedor(resumo.pixManual.nomeRecebedor);
    setCidadeRecebedor(resumo.pixManual.cidadeRecebedor);
  }, [resumo?.pixManual]);

  const executar = async (rotulo: string, acao: () => Promise<string | null>, sucesso: string) => {
    setOcupado(rotulo);
    const falha = await acao();
    setOcupado(null);
    if (falha) toast.error(falha);
    else toast.success(sucesso);
    return !falha;
  };

  const cabecalho = (
    <div className="border-b border-slate-800 pb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Wallet className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Pagamentos</h1>
      </div>
      <p className="text-slate-400 text-xs sm:text-sm mt-1">
        Escolha como a arena recebe o Pix das reservas online. O dinheiro cai sempre na conta da arena.
      </p>
    </div>
  );

  if (carregando) {
    return (
      <div className="space-y-8 max-w-4xl">
        {cabecalho}
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }
  if (!resumo) {
    return (
      <div className="space-y-8 max-w-4xl">
        {cabecalho}
        <p className="text-sm text-red-400">{erro}</p>
      </div>
    );
  }

  const modoAtual = resumo.modo;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {cabecalho}

      <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Modo atual</p>
        <p className="text-base font-bold text-white mt-1">{ROTULO_MODO[modoAtual]}</p>
        {modoAtual === "manual" && !resumo.pixManual && (
          <p className="text-xs text-amber-300 mt-1">
            Cadastre a chave Pix abaixo. Sem ela, os atletas não conseguem pagar pelo site.
          </p>
        )}
      </div>

      {/* ── Pix manual ─────────────────────────────────────────────── */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await executar(
            "pix",
            () => salvarPix({ chave, tipoChave, nomeRecebedor, cidadeRecebedor }),
            "Chave Pix salva."
          );
        }}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" /> Pix direto na chave da arena
          </h2>
          {modoAtual === "manual" && <SeloEmUso />}
        </div>
        <p className="text-xs text-slate-400">
          Sem taxas e sem cadastro extra. O atleta paga um Pix com o valor exato, toca em “Já fiz o Pix” e o
          balcão confirma ao ver o valor no extrato.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pix-tipo" className="block text-xs font-semibold text-slate-400 mb-1">
              Tipo da chave
            </label>
            <select
              id="pix-tipo"
              value={tipoChave}
              onChange={(e) => setTipoChave(e.target.value as TipoChavePix)}
              className={CLASSE_INPUT}
            >
              {TIPOS_CHAVE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pix-chave" className="block text-xs font-semibold text-slate-400 mb-1">
              Chave Pix
            </label>
            <input id="pix-chave" value={chave} onChange={(e) => setChave(e.target.value)} className={CLASSE_INPUT} required />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pix-nome" className="block text-xs font-semibold text-slate-400 mb-1">
              Nome do titular (como aparece no banco)
            </label>
            <input
              id="pix-nome"
              value={nomeRecebedor}
              onChange={(e) => setNomeRecebedor(e.target.value)}
              className={CLASSE_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="pix-cidade" className="block text-xs font-semibold text-slate-400 mb-1">
              Cidade do titular
            </label>
            <input
              id="pix-cidade"
              value={cidadeRecebedor}
              onChange={(e) => setCidadeRecebedor(e.target.value)}
              className={CLASSE_INPUT}
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={ocupado !== null}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
          >
            {ocupado === "pix" ? "Salvando..." : "Salvar chave Pix"}
          </button>
          {resumo.pixManual && modoAtual !== "manual" && (
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() => executar("modo-manual", () => definirModo("manual"), "Agora a arena recebe pela chave Pix.")}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold"
            >
              Usar este modo
            </button>
          )}
        </div>
      </form>

      {/* ── Asaas ──────────────────────────────────────────────────── */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> Conta Asaas da arena
          </h2>
          {modoAtual === "asaas" && <SeloEmUso />}
        </div>
        <p className="text-xs text-slate-400">
          A reserva é confirmada sozinha assim que o Pix cai, sem conferência no balcão. O Asaas cobra uma taxa por
          Pix recebido, direto da conta da arena.
        </p>

        {resumo.asaas ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-200">
              Conectado à conta <strong>{resumo.asaas.contaNome ?? "Asaas"}</strong>
              {resumo.asaas.sandbox && <span className="text-amber-300"> (ambiente de testes)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {modoAtual !== "asaas" && (
                <button
                  disabled={ocupado !== null}
                  onClick={() => executar("modo-asaas", () => definirModo("asaas"), "Agora a arena recebe pelo Asaas.")}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold"
                >
                  Usar este modo
                </button>
              )}
              <button
                disabled={ocupado !== null}
                onClick={() => {
                  if (!window.confirm("Desconectar o Asaas? A arena volta a receber pela chave Pix.")) return;
                  void executar("desconectar", desconectarAsaas, "Asaas desconectado.");
                }}
                className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-bold flex items-center gap-1.5"
              >
                <Link2Off className="w-4 h-4" /> Desconectar
              </button>
            </div>
          </div>
        ) : !resumo.asaasDisponivel ? (
          <p className="text-xs text-amber-300">
            A conexão com o Asaas ainda não foi habilitada neste servidor. Use a chave Pix por enquanto.
          </p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executar("conectar", () => conectarAsaas(apiKey), "Conta Asaas conectada!");
              if (ok) setApiKey("");
            }}
            className="space-y-3"
          >
            <ol className="text-xs text-slate-400 list-decimal list-inside space-y-0.5">
              <li>No Asaas, abra Integrações → Chave de API e gere uma chave.</li>
              <li>Cole a chave abaixo. O aviso de pagamentos é configurado automaticamente.</li>
            </ol>
            <input
              aria-label="Chave de API do Asaas"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="$aact_..."
              className={CLASSE_INPUT}
              required
            />
            <button
              type="submit"
              disabled={ocupado !== null}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
            >
              {ocupado === "conectar" ? "Conectando..." : "Conectar Asaas"}
            </button>
          </form>
        )}
      </section>

      {/* ── Demonstração ───────────────────────────────────────────── */}
      {resumo.simuladoDisponivel && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-400" /> Demonstração
            </h2>
            {modoAtual === "simulado" && <SeloEmUso />}
          </div>
          <p className="text-xs text-slate-400">
            O atleta vê um botão “Simular pagamento”. Nenhum dinheiro é movimentado. Use só para apresentações.
          </p>
          {modoAtual !== "simulado" && (
            <button
              disabled={ocupado !== null}
              onClick={() => executar("modo-simulado", () => definirModo("simulado"), "Modo demonstração ativado.")}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold"
            >
              Usar este modo
            </button>
          )}
        </section>
      )}
    </div>
  );
}
