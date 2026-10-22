/**
 * Modal "saiba mais" da escolinha: informações e botão de matrícula via WhatsApp.
 */

"use client";

import { MessageCircle, Clock, CalendarDays, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mascaraWhatsApp } from "@/lib/constants";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { montarLinkWhatsApp, type AvisoEscolinha } from "@/lib/recorrencia/agenda";
import { DIAS_SEMANA } from "@/lib/recorrencia/types";

interface Props {
  aviso: AvisoEscolinha | null;
  onClose: () => void;
}

export function ModalEscolinha({ aviso, onClose }: Props) {
  const nomeArena = useConfiguracaoSiteArena().nomePlataforma;
  const dias = aviso?.diasSemana
    ? DIAS_SEMANA.filter((d) => aviso.diasSemana?.includes(d.valor))
        .map((d) => d.longo)
        .join(", ")
    : null;

  const mensagem = aviso
    ? `Olá! Vi a escolinha ${aviso.nome}${aviso.esporte ? ` de ${aviso.esporte}` : ""} na ${nomeArena} e gostaria de informações sobre a matrícula.`
    : "";

  return (
    <Dialog open={aviso !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="bg-slate-900 border border-slate-700 text-white sm:max-w-md">
        {aviso && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">{aviso.nome}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Escolinha{aviso.esporte ? ` de ${aviso.esporte}` : ""} que utiliza este horário.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm text-slate-300">
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                {aviso.horaInicio} às {aviso.horaFim}
              </p>
              {dias && (
                <p className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-violet-400" />
                  {dias}
                </p>
              )}
              {aviso.responsavelNome && (
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-violet-400" />
                  Responsável: {aviso.responsavelNome}
                </p>
              )}
              {aviso.descricao && (
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-xs font-semibold text-violet-300 mb-1.5">Descrição da escolinha:</p>
                  <p className="text-slate-300 leading-relaxed text-sm bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    {aviso.descricao}
                  </p>
                </div>
              )}
            </div>

            <a
              id="escolinha-matricula-whatsapp"
              href={montarLinkWhatsApp(aviso.contatoWhatsapp, mensagem)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm py-3 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Fazer matrícula pelo WhatsApp
            </a>
            <p className="text-center text-[11px] text-slate-500">
              Contato: {mascaraWhatsApp(aviso.contatoWhatsapp)}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
