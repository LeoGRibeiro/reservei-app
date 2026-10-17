/**
 * @file AdminConfiguracoesPage.tsx
 * @description Painel administrativo de configurações gerais do Tenant (Arena).
 * Gerencia dados cadastrais, subdomínio oficial, horários de abertura/fechamento,
 * percentual de sinal Pix e regras operacionais de antecedência mínima.
 */

"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  Globe,
  Phone,
  Clock,
  Shield,
  Percent,
  MapPin,
  Save,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useArena } from "@/hooks/useArena";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import { construirUrlArena } from "@/lib/arena/subdomain";

export function AdminConfiguracoesPage() {
  const { arena, recarregar, carregando } = useArena();

  // Estados locais do formulário
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
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
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (arena) {
      setNome(arena.nome || "");
      setSlug(arena.slug || "");
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
    }
  }, [arena]);

  const urlArena = construirUrlArena(slug || "sua-arena");

  const copiarUrl = () => {
    navigator.clipboard.writeText(urlArena);
    toast.success("URL copiada para a área de transferência!");
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !slug.trim()) {
      toast.error("Nome da arena e subdomínio/slug são obrigatórios.");
      return;
    }

    setSalvando(true);
    try {
      const atualizada = await ArenaRepository.salvarArena({
        id: arena.id,
        nome: nome.trim(),
        slug: slug.trim().toLowerCase(),
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
        <span className="inline-block w-8 h-8 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs mt-3">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Configurações da Arena
          </h1>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Defina as informações comerciais, subdomínio de acesso e regras operacionais da sua arena.
        </p>
      </div>

      {/* ── Banner de Subdomínio / URL Pública ───────────────────────────────── */}
      <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
            <Globe className="w-3.5 h-3.5" /> Endereço Público Oficial da Arena
          </span>
          <p className="text-sm font-black text-white font-mono break-all">
            {urlArena}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Este é o link direto exclusivo para seus clientes agendarem horários online.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copiarUrl}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar Link
          </button>
          <a
            href={urlArena}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Acessar Portal
          </a>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="space-y-6">
        {/* ── 1. Dados Comerciais e Subdomínio ───────────────────────────────── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Identificação Comercial & Subdomínio
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Nome Comercial da Arena
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Arena Praia Leopoldina"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Subdomínio (Slug para a URL)
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  placeholder="ex: leopoldina"
                  className="w-full bg-slate-950 border border-slate-800 rounded-l-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="bg-slate-800 text-slate-400 border border-l-0 border-slate-800 px-3 py-2 rounded-r-xl text-xs font-mono select-none">
                  .reservei.com
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                CNPJ ou CPF do Responsável
              </label>
              <input
                type="text"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                E-mail Administrativo
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@arena.com.br"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ── 2. Contatos e Localização ───────────────────────────────────────── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            Contatos & Localização Física
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                WhatsApp Oficial de Notificações
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(91) 98123-4567"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Telefone Fixo / Balcão
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(91) 3210-0000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Av. Visconde de Souza Franco, 1000 - Reduto"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                maxLength={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ── 3. Regras Operacionais e Pagamento Pix ───────────────────────────── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Horários Operacionais & Sinal Financeiro
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Horário Abertura
              </label>
              <input
                type="time"
                value={horarioAbertura}
                onChange={(e) => setHorarioAbertura(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Horário Fechamento
              </label>
              <input
                type="time"
                value={horarioFechamento}
                onChange={(e) => setHorarioFechamento(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Sinal Mínimo Pix (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={percentualSinal}
                onChange={(e) => setPercentualSinal(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Ex: 50% exige metade no Pix; 100% exige valor integral.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Antecedência Mínima (min)
              </label>
              <input
                type="number"
                min={0}
                step={15}
                value={antecedenciaMinutos}
                onChange={(e) => setAntecedenciaMinutos(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Tempo mínimo antes da partida para reservar online.
              </span>
            </div>
          </div>
        </div>

        {/* ── Botão Salvar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-all duration-150 shadow-lg shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            {salvando ? "Salvando Alterações..." : "Salvar Configurações da Arena"}
          </button>
        </div>
      </form>
    </div>
  );
}
