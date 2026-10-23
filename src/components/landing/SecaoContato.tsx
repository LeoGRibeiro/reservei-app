/**
 * @file SecaoContato.tsx
 * @description Seção "Localização e Contato" do portal da arena: endereço com link para o mapa, horário de
 * funcionamento e canais de atendimento, tudo vindo do cadastro da arena (Configurações).
 */

"use client";

import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { SECAO_IDS } from "@/lib/landingPage/secoes";
import { useCatalogoArenaStore } from "@/store/useCatalogoArenaStore";
import { enderecoDaArena, whatsappInternacional } from "@/hooks/useConfiguracaoSiteArena";

/**
 * Link de busca no Google Maps para o endereço da arena.
 *
 * @param endereco Endereço completo
 * @returns URL de busca do Google Maps
 *
 * @example
 * ```ts
 * linkMapa("Av. Roberto Camelier, 580 – Belém/PA");
 * ```
 */
export function linkMapa(endereco: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

export function SecaoContato() {
  const arena = useCatalogoArenaStore((s) => s.arena);
  if (!arena || !arena.nome) return null;

  const endereco = enderecoDaArena(arena, "");
  const whatsapp = whatsappInternacional(arena.whatsapp || arena.telefone);
  const telefone = arena.telefone || arena.whatsapp;

  return (
    <section id={SECAO_IDS.CONTATO} aria-labelledby="contato-titulo" className="scroll-mt-20 py-14 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <h2 id="contato-titulo" className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Localização e Contato
          </h2>
          <p className="text-slate-400 text-sm">Como chegar e como falar com a {arena.nome}.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {endereco && (
            <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <MapPin className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <h3 className="text-sm font-bold text-white">Endereço</h3>
              <p className="text-sm text-slate-300">{endereco}</p>
              <a
                href={linkMapa(endereco)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold text-emerald-400 hover:text-emerald-300"
              >
                Ver no mapa →
              </a>
            </article>
          )}

          <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <Clock className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <h3 className="text-sm font-bold text-white">Horário de funcionamento</h3>
            <p className="text-sm text-slate-300">
              Todos os dias, das {arena.horarioAbertura} às {arena.horarioFechamento}
            </p>
          </article>

          <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 sm:col-span-2">
            <h3 className="text-sm font-bold text-white">Atendimento</h3>
            <div className="flex flex-wrap gap-2">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
                </a>
              )}
              {telefone && (
                <a
                  href={`tel:+55${telefone.replace(/\D/g, "")}`}
                  className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" aria-hidden="true" /> {telefone}
                </a>
              )}
              {arena.email && (
                <a
                  href={`mailto:${arena.email}`}
                  className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" /> {arena.email}
                </a>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
