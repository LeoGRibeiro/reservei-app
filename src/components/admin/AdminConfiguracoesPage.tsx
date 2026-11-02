/**
 * @file AdminConfiguracoesPage.tsx
 * @description Painel administrativo de configurações gerais do Tenant (Arena).
 * Gerencia dados cadastrais, subdomínio oficial, horários de abertura/fechamento,
 * percentual de sinal Pix e regras operacionais de antecedência mínima.
 */

"use client";

import { useState } from "react";
import {
  Building2,
  Globe,
  Clock,
  Shield,
  MapPin,
  Save,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useArena } from "@/hooks/useArena";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import { construirUrlArena } from "@/lib/arena/subdomain";
import { POLITICA_CANCELAMENTO_PADRAO } from "@/lib/legal/termos";
import { CabecalhoPagina } from "@/components/admin/ui";

export function AdminConfiguracoesPage() {
  const { arena, recarregar, carregando } = useArena();

  // Estados locais do formulário
  const [nome, setNome] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("Belém");
  const [estado, setEstado] = useState("PA");
  const [cep, setCep] = useState("");
  const [horarioAbertura, setHorarioAbertura] = useState("06:00");
  const [horarioFechamento, setHorarioFechamento] = useState("23:00");
  const [percentualSinal, setPercentualSinal] = useState(50);
  const [antecedenciaMinutos, setAntecedenciaMinutos] = useState(60);
  const [politicaCancelamento, setPoliticaCancelamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  // A coluna só existe em bancos com a migração da Fase 8
  const suportaPolitica = arena?.modoPagamento !== undefined && arena.modoPagamento !== "legado";

  // Copia a arena carregada para o formulário (ajuste durante a renderização, sem efeito)
  const [arenaCarregada, setArenaCarregada] = useState<typeof arena | null>(null);
  if (arena && arena !== arenaCarregada) {
    setArenaCarregada(arena);
    setNome(arena.nome || "");
    setCnpjCpf(arena.cnpjCpf || "");
    setTelefone(arena.telefone || "");
    setWhatsapp(arena.whatsapp || "");
    setEmail(arena.email || "");
    setEndereco(arena.endereco || "");
    setCidade(arena.cidade || "Belém");
    setEstado(arena.estado || "PA");
    setCep(arena.cep || "");
    setHorarioAbertura(arena.horarioAbertura || "06:00");
    setHorarioFechamento(arena.horarioFechamento || "23:00");
    setPercentualSinal(arena.percentualSinalMinimo || 50);
    setAntecedenciaMinutos(arena.antecedenciaMinimaMinutos || 60);
    setPoliticaCancelamento(arena.politicaCancelamento || "");
  }

  // O endereço (subdomínio) é da plataforma: só o suporte muda (SPEC/2026-11-02-admin-revisao.md)
  const urlArena = construirUrlArena(arena?.slug || "sua-arena");

  const copiarUrl = () => {
    navigator.clipboard.writeText(urlArena);
    toast.success("URL copiada para a área de transferência!");
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da arena.");
      return;
    }

    setSalvando(true);
    try {
      const atualizada = await ArenaRepository.salvarArena({
        id: arena.id,
        nome: nome.trim(),
        cnpjCpf: cnpjCpf.trim(),
        telefone: telefone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        endereco: endereco.trim(),
        cidade: cidade.trim(),
        estado: estado.trim(),
        cep: cep.trim(),
        horarioAbertura,
        horarioFechamento,
        percentualSinalMinimo: Number(percentualSinal),
        antecedenciaMinimaMinutos: Number(antecedenciaMinutos),
        ...(suportaPolitica ? { politicaCancelamento: politicaCancelamento.trim() } : {}),
      });

      if (atualizada) {
        toast.success("Configurações da arena salvas com sucesso!");
        await recarregar();
      } else {
        toast.error("Falha ao atualizar configurações.");
      }
    } catch {
      toast.error("Erro inesperado ao salvar configurações.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="py-20 text-center">
        <span className="inline-block w-8 h-8 border-2 border-painel-linha border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-painel-suave text-xs mt-3">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Configurações" descricao="Dados da arena, contato, horários de funcionamento e regras das reservas." />

      {/* ── Banner de Subdomínio / URL Pública ───────────────────────────────── */}
      <div className="bg-painel-superficie border border-painel-destaque rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-painel-destaque flex items-center gap-1.5 mb-1">
            <Globe className="w-3.5 h-3.5" /> Endereço Público Oficial da Arena
          </span>
          <p className="text-sm font-semibold text-painel-tinta font-mono break-all">
            {urlArena}
          </p>
          <p className="text-xs text-painel-suave mt-1">
            Este é o link para seus clientes agendarem online. Para mudar o endereço, fale com o suporte.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copiarUrl}
            className="px-3.5 py-2 rounded-md bg-painel-elevada hover:bg-painel-fundo text-painel-tinta border border-painel-linha text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar Link
          </button>
          <a
            href={urlArena}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Acessar Portal
          </a>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="space-y-6">
        {/* ── 1. Dados Comerciais e Subdomínio ───────────────────────────────── */}
        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-painel-tinta flex items-center gap-2">
            <Building2 className="w-4 h-4 text-painel-destaque" />
            Identificação Comercial
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Nome Comercial da Arena
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Arena Central"
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                CNPJ ou CPF do Responsável
              </label>
              <input
                type="text"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                E-mail Administrativo
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@arena.com.br"
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
              />
            </div>
          </div>
        </div>

        {/* ── 2. Contatos e Localização ───────────────────────────────────────── */}
        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-painel-tinta flex items-center gap-2">
            <MapPin className="w-4 h-4 text-painel-destaque" />
            Contatos & Localização Física
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                WhatsApp Oficial de Notificações
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(91) 98123-4567"
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Telefone Fixo / Balcão
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(91) 3210-0000"
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Av. Visconde de Souza Franco, 1000 - Reduto"
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                maxLength={2}
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
              />
            </div>
          </div>
        </div>

        {/* ── 3. Regras Operacionais e Pagamento Pix ───────────────────────────── */}
        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-painel-tinta flex items-center gap-2">
            <Clock className="w-4 h-4 text-painel-destaque" />
            Horários Operacionais & Sinal Financeiro
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Horário Abertura
              </label>
              <input
                type="time"
                value={horarioAbertura}
                onChange={(e) => setHorarioAbertura(e.target.value)}
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Horário Fechamento
              </label>
              <input
                type="time"
                value={horarioFechamento}
                onChange={(e) => setHorarioFechamento(e.target.value)}
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Sinal Mínimo Pix (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={percentualSinal}
                onChange={(e) => setPercentualSinal(Number(e.target.value))}
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                required
              />
              <span className="text-xs text-painel-suave mt-1 block">
                Ex: 50% exige metade no Pix; 100% exige valor integral.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-painel-suave mb-1">
                Antecedência Mínima (min)
              </label>
              <input
                type="number"
                min={0}
                step={15}
                value={antecedenciaMinutos}
                onChange={(e) => setAntecedenciaMinutos(Number(e.target.value))}
                className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                required
              />
              <span className="text-xs text-painel-suave mt-1 block">
                Tempo mínimo antes da partida para reservar online.
              </span>
            </div>
          </div>
        </div>

        {/* ── Política de cancelamento (exibida no checkout e nos Termos) ───────── */}
        {suportaPolitica && (
          <div className="bg-painel-superficie border border-painel-linha rounded-lg p-6 space-y-3">
            <h2 className="text-base font-bold text-painel-tinta flex items-center gap-2">
              <Shield className="w-4 h-4 text-painel-destaque" />
              Política de Cancelamento
            </h2>
            <p className="text-xs text-painel-suave">
              Aparece para o atleta antes do pagamento e nos Termos de Uso. Seja claro sobre prazos e devolução do
              sinal.
            </p>
            <textarea
              aria-label="Política de cancelamento"
              value={politicaCancelamento}
              onChange={(e) => setPoliticaCancelamento(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder={POLITICA_CANCELAMENTO_PADRAO}
              className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
            />
            <p className="text-xs text-painel-suave">Em branco, vale o texto padrão mostrado acima.</p>
          </div>
        )}

        {/* ── Botão Salvar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte disabled:opacity-50 text-white font-bold text-sm transition-all duration-150"
          >
            <Save className="w-4 h-4" />
            {salvando ? "Salvando Alterações..." : "Salvar Configurações da Arena"}
          </button>
        </div>
      </form>
    </div>
  );
}
