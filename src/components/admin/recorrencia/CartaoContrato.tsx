/**
 * Cartão-resumo de um contrato recorrente (escolinha ou grupo).
 * O conteúdo específico de cada tela (ações, sessões) entra via `children`.
 */

import { CalendarDays, Clock, MapPin, Phone, User } from "lucide-react";
import { mascaraWhatsApp, formatarDataExibicao } from "@/lib/constants";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { DIAS_SEMANA, type ContratoRecorrente } from "@/lib/recorrencia/types";

interface Props {
  contrato: ContratoRecorrente;
  /** Quantas sessões ainda ativas (hoje em diante) */
  sessoesFuturas: number;
  children?: React.ReactNode;
}

export function CartaoContrato({ contrato, sessoesFuturas, children }: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const quadra = quadrasCatalogo.find((q) => q.id === contrato.quadraId);
  const dias = DIAS_SEMANA.filter((d) => contrato.diasSemana.includes(d.valor))
    .map((d) => d.curto)
    .join(", ");

  return (
    <article
      id={`contrato-${contrato.id}`}
      className={`bg-painel-superficie border rounded-lg p-5 space-y-4 ${
        contrato.ativo ? "border-painel-linha" : "border-painel-linha opacity-70"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {contrato.fotoUrl && (
            <img
              src={contrato.fotoUrl}
              alt={contrato.nome}
              className="w-12 h-12 rounded-md object-cover border border-painel-linha shrink-0"
            />
          )}
          <div>
            <h3 className="text-base font-bold text-painel-tinta">{contrato.nome}</h3>
            <p className="text-xs text-painel-suave mt-0.5">
              {contrato.esporte ?? "Esporte não informado"} ·{" "}
              {contrato.tipo === "escolinha" ? "Escolinha" : "Grupo comum"}
              {contrato.faixaEtaria && ` · ${contrato.faixaEtaria}`}
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            contrato.ativo
              ? "bg-painel-destaque-suave text-painel-destaque border-painel-destaque"
              : "bg-painel-elevada text-painel-suave border-painel-linha"
          }`}
        >
          {contrato.ativo ? `${sessoesFuturas} sessões futuras` : "Encerrado"}
        </span>
      </header>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-painel-suave">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-painel-suave flex-shrink-0" />
          <dd>
            {dias} · {contrato.meses} {contrato.meses === 1 ? "mês" : "meses"} desde{" "}
            {formatarDataExibicao(contrato.dataInicio, { day: "numeric", month: "short", year: "numeric" })}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-painel-suave flex-shrink-0" />
          <dd>
            {contrato.horaInicio} – {contrato.horaFim}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-painel-suave flex-shrink-0" />
          <dd>{quadra ? `Quadra ${quadra.numero}` : contrato.quadraId}</dd>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-painel-suave flex-shrink-0" />
          <dd>{contrato.responsavelNome}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-painel-suave flex-shrink-0" />
          <dd>{mascaraWhatsApp(contrato.contatoWhatsapp)}</dd>
        </div>
      </dl>

      {children}
    </article>
  );
}
