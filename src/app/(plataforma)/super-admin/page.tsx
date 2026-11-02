/**
 * @file page.tsx
 * @description Tela de Super Admin: cadastra uma nova arena em ~1 minuto e gerencia as existentes
 * (endereço, módulos, status, modo demonstração e senha do dono). Protegida pela senha
 * SUPER_ADMIN_SECRET (validada no servidor).
 */

"use client";

import { useState } from "react";
import { MODULOS_DISPONIVEIS, MODULOS_PADRAO, type ModuloArena } from "@/lib/arena/modulos";
import { DOMINIO_RAIZ_PADRAO } from "@/lib/arena/subdomain";
import { ArenasSuperAdmin } from "@/components/super-admin/ArenasSuperAdmin";

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
    "w-full bg-painel-elevada border border-painel-linha rounded-lg px-3 py-2.5 text-sm text-painel-tinta outline-none focus:border-painel-destaque";
  const classeRotulo = "block text-sm font-medium text-painel-tinta mb-1";

  return (
    <div className="painel min-h-screen bg-painel-fundo flex flex-col items-center justify-center gap-6 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-painel-superficie border border-painel-linha rounded-md p-6 space-y-4"
      >
        <h1 className="text-lg font-bold text-painel-tinta">Super Admin · Nova Arena</h1>

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
          <p className="text-xs text-painel-suave mt-1">
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
          <p className="text-xs text-painel-suave mb-2">Agendamento (core) está sempre incluído.</p>
          <div className="space-y-1.5">
            {MODULOS_OPCIONAIS.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm text-painel-tinta">
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
            className={resultado.tipo === "erro" ? "text-red-700 text-sm" : "text-painel-destaque text-sm"}
          >
            {resultado.mensagem}
          </p>
        )}

        {urlConvite && (
          <div className="border border-painel-destaque rounded-lg p-3 space-y-2">
            <p className="text-xs text-painel-suave">Link de ativação do dono:</p>
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
              className="w-full bg-painel-linha hover:bg-painel-fundo text-painel-tinta font-semibold rounded-lg py-2.5 text-sm"
            >
              {copiado ? "Link copiado!" : "Copiar Link de Ativação do Dono"}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-painel-destaque hover:bg-painel-destaque-forte disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm"
        >
          {carregando ? "Criando..." : "Criar Arena"}
        </button>
      </form>

      <ArenasSuperAdmin segredo={segredo} />
    </div>
  );
}
