/**
 * @file page.tsx
 * @description Tela simples de Super Admin para cadastrar uma nova arena em ~1 minuto.
 * Protegida pela senha SUPER_ADMIN_SECRET (validada no servidor).
 */

"use client";

import { useState } from "react";
import { MODULOS_DISPONIVEIS, MODULOS_PADRAO, type ModuloArena } from "@/lib/arena/modulos";
import { DOMINIO_RAIZ_PADRAO } from "@/lib/arena/subdomain";

/** Módulos opcionais exibidos como checkbox (o core é sempre ativo). */
const MODULOS_OPCIONAIS = (Object.keys(MODULOS_DISPONIVEIS) as ModuloArena[]).filter(
  (id) => id !== "agendamento_core"
);

interface Resultado {
  tipo: "sucesso" | "erro";
  mensagem: string;
}

/**
 * Página `/super-admin`.
 */
export default function SuperAdminPage() {
  const [segredo, setSegredo] = useState("");
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [modulos, setModulos] = useState<ModuloArena[]>(MODULOS_PADRAO);
  const [quantidadeQuadras, setQuantidadeQuadras] = useState(3);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [urlConvite, setUrlConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function alternarModulo(id: ModuloArena) {
    setModulos((atual) => (atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setResultado(null);
    setUrlConvite(null);
    setCopiado(false);

    try {
      const resposta = await fetch("/api/super-admin/arenas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-super-admin-secret": segredo },
        body: JSON.stringify({ nome, slug, cidade, estado, whatsapp, modulos, quantidadeQuadras }),
      });
      const corpo: {
        error?: string;
        slug?: string;
        quadrasCriadas?: number;
        urlConvite?: string;
      } = await resposta
        .json()
        .catch(() => ({}));

      if (!resposta.ok) {
        setResultado({ tipo: "erro", mensagem: corpo.error ?? "Não foi possível criar a arena." });
        return;
      }

      setResultado({
        tipo: "sucesso",
        mensagem: `Arena criada com ${corpo.quadrasCriadas ?? 0} quadra(s). Envie o link abaixo ao dono (uso único).`,
      });
      setUrlConvite(corpo.urlConvite ?? null);
      setNome("");
      setSlug("");
      setCidade("");
      setEstado("");
      setWhatsapp("");
    } catch {
      setResultado({ tipo: "erro", mensagem: "Falha de conexão. Tente novamente." });
    } finally {
      setCarregando(false);
    }
  }

  async function copiarLink() {
    if (!urlConvite) return;
    try {
      await navigator.clipboard.writeText(urlConvite);
      setCopiado(true);
    } catch {
      setResultado({ tipo: "erro", mensagem: "Não foi possível copiar. Selecione o link e copie manualmente." });
    }
  }

  const classeCampo =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500";
  const classeRotulo = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-xl p-6 space-y-4"
      >
        <h1 className="text-lg font-bold text-white">Super Admin · Nova Arena</h1>

        <div>
          <label htmlFor="sa-segredo" className={classeRotulo}>
            Senha de Super Admin
          </label>
          <input
            id="sa-segredo"
            type="password"
            value={segredo}
            onChange={(e) => setSegredo(e.target.value)}
            autoComplete="off"
            className={classeCampo}
            required
          />
        </div>

        <div>
          <label htmlFor="sa-nome" className={classeRotulo}>
            Nome da Arena
          </label>
          <input
            id="sa-nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Arena Central"
            className={classeCampo}
            required
          />
        </div>

        <div>
          <label htmlFor="sa-slug" className={classeRotulo}>
            Slug
          </label>
          <input
            id="sa-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="central"
            className={classeCampo}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            URL: {slug || "slug"}.{DOMINIO_RAIZ_PADRAO}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="sa-cidade" className={classeRotulo}>
              Cidade
            </label>
            <input
              id="sa-cidade"
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className={classeCampo}
              required
            />
          </div>
          <div>
            <label htmlFor="sa-estado" className={classeRotulo}>
              Estado
            </label>
            <input
              id="sa-estado"
              type="text"
              maxLength={2}
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              placeholder="PA"
              className={classeCampo}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="sa-whatsapp" className={classeRotulo}>
            WhatsApp Comercial
          </label>
          <input
            id="sa-whatsapp"
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(91) 98123-4567"
            className={classeCampo}
            required
          />
        </div>

        <fieldset>
          <legend className={classeRotulo}>Módulos Contratados</legend>
          <p className="text-xs text-slate-500 mb-2">Agendamento (core) está sempre incluído.</p>
          <div className="space-y-1.5">
            {MODULOS_OPCIONAIS.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={modulos.includes(id)}
                  onChange={() => alternarModulo(id)}
                />
                {MODULOS_DISPONIVEIS[id].nome}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="sa-quadras" className={classeRotulo}>
            Quantidade de Quadras Iniciais
          </label>
          <input
            id="sa-quadras"
            type="number"
            min={0}
            max={20}
            value={quantidadeQuadras}
            onChange={(e) => setQuantidadeQuadras(Number(e.target.value))}
            className={classeCampo}
          />
        </div>

        {resultado && (
          <p
            role={resultado.tipo === "erro" ? "alert" : "status"}
            className={resultado.tipo === "erro" ? "text-red-400 text-sm" : "text-emerald-400 text-sm"}
          >
            {resultado.mensagem}
          </p>
        )}

        {urlConvite && (
          <div className="border border-emerald-500/40 rounded-lg p-3 space-y-2">
            <p className="text-xs text-slate-400">Link de ativação do dono:</p>
            <input
              readOnly
              aria-label="Link de ativação do dono"
              value={urlConvite}
              onFocus={(e) => e.currentTarget.select()}
              className={classeCampo}
            />
            <button
              type="button"
              onClick={copiarLink}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg py-2.5 text-sm"
            >
              {copiado ? "Link copiado!" : "Copiar Link de Ativação do Dono"}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-lg py-2.5 text-sm"
        >
          {carregando ? "Criando..." : "Criar Arena"}
        </button>
      </form>
    </div>
  );
}
