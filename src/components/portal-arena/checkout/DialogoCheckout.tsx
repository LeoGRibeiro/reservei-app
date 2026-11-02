/**
 * @file DialogoCheckout.tsx
 * @description Checkout em forma de ticket: "Seus dados" (visitante ou "Reservando como"), Pix (QR,
 * valor, 10 minutos guardando o horário, copia e cola, recebedor; "Simular pagamento" só no modo
 * simulado), "Tempo esgotado" e "Confirmada" (carimbo, dia do jogo, agenda, Clube ou criar conta).
 * No celular é tela cheia; o Pix aparece sem o resumo azul e os botões ficam no fim da tela (CSS).
 */

"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState, type FormEvent, type MouseEvent } from "react";
import type { ResumoSelecao } from "@/lib/portal/agenda";
import { codigoReserva, diaCurto, diaLongo, maiuscula, mascaraWhats, plural, reais, rotuloEsporte } from "@/lib/portal/formatos";
import type { EstadoPix, EtapaCheckout, ReservaConfirmada } from "@/hooks/portal/useCheckoutPortal";
import type { ModoPagamentoArena } from "@/lib/arena/types";
import { CarimbosMini } from "../base/Carimbos";
import { DialogoTicket } from "../base/DialogoTicket";
import { ItensTicket } from "../reservar/TicketReserva";
import { Icone } from "../Icone";

/** Atleta logado, como o checkout precisa. */
export interface AtletaNoCheckout {
  nome: string;
  primeiro: string;
  whatsapp: string;
}

/** Clube no checkout. */
export interface ClubeNoCheckout {
  nome: string;
  meta: number;
  teto: number | null;
}

export interface DialogoCheckoutProps {
  aberto: boolean;
  aoFechar: () => void;
  etapa: EtapaCheckout;
  /** Seleção atual (dados e Pix) */
  resumo: ResumoSelecao | null;
  confirmada: ReservaConfirmada | null;
  dia: string;
  hoje: string;
  arena: { nome: string; logoUrl: string; percentualSinal: number; modoPagamento: ModoPagamentoArena; recebedor: string; politica: string; dddWhatsapp: string };
  atleta: AtletaNoCheckout | null;
  clube: ClubeNoCheckout | null;
  temHoraGratis: boolean;
  usarHoraGratis: boolean;
  aoUsarHoraGratis: (usar: boolean) => void;
  integral: boolean;
  aoEscolherIntegral: (integral: boolean) => void;
  pix: EstadoPix;
  enviando: boolean;
  aoEnviar: (dados: { nome: string; whatsapp: string; esporte: string }) => void;
  aoSimular: () => void;
  aoInformarPagamento: () => void;
  aoExpirar: () => void;
  aoVoltar: () => void;
  aoEntrar: () => void;
  aoVerReservas: (reservaId: string) => void;
  aoCriarConta: () => void;
  aoBaixarAgenda: () => void;
}

/** Prazo para pagar o Pix (o lock do servidor também dura 10 minutos). */
const PRAZO_PIX_S = 600;

/**
 * Segundos iniciais do cronômetro: o que falta para o prazo do servidor, quando o relógio do aparelho
 * concorda com ele; senão, os 10 minutos cheios (relógio do aparelho adiantado ou atrasado).
 */
export function segundosIniciaisDoPix(expiraEm: string | null, agora: number): number {
  if (!expiraEm) return PRAZO_PIX_S;
  const falta = Math.ceil((new Date(expiraEm).getTime() - agora) / 1000);
  return falta > 0 && falta <= PRAZO_PIX_S ? falta : PRAZO_PIX_S;
}

function Cronometro({ expiraEm, aoAcabar }: { expiraEm: string | null; aoAcabar: () => void }) {
  const [resta, setResta] = useState(() => segundosIniciaisDoPix(expiraEm, Date.now()));
  const acabou = useEffectEvent(aoAcabar);
  useEffect(() => {
    const id = setInterval(() => setResta((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (resta === 0) acabou();
  }, [resta]);
  const texto = `${String(Math.floor(resta / 60)).padStart(2, "0")}:${String(resta % 60).padStart(2, "0")}`;
  return (
    <b className="num" id="pix-timer">
      {texto}
    </b>
  );
}

/**
 * @example
 * ```tsx
 * <DialogoCheckout aberto={aberto} etapa={checkout.etapa} resumo={resumo} ... />
 * ```
 */
export function DialogoCheckout(props: DialogoCheckoutProps) {
  const { aberto, etapa, resumo, confirmada, dia, hoje, arena, atleta, clube, pix } = props;
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [esporte, setEsporte] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [verPolitica, setVerPolitica] = useState(false);
  const [erros, setErros] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState(false);
  const [abertoAntes, setAbertoAntes] = useState(aberto);

  const r = etapa === "ok" ? (confirmada?.resumo ?? null) : resumo;
  const diaReserva = etapa === "ok" && confirmada ? confirmada.dia : dia;
  const esportes = r?.quadra.esportes ?? [];
  const varios = esportes.length > 1;

  // A cada abertura: esporte único já escolhido e aceite desmarcado (estado derivado da prop, sem efeito)
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setAceite(false);
      setVerPolitica(false);
      setErros({});
      setEsporte((atual) => (esportes.length === 1 ? esportes[0] : atual && esportes.includes(atual) ? atual : null));
    }
  }

  // Foco: primeiro campo ao abrir (visitante) ou o título de cada etapa
  useEffect(() => {
    if (!aberto) return;
    const quadro = requestAnimationFrame(() => {
      const campo = etapa === "dados" ? document.getElementById("f-nome") : null;
      (campo ?? document.getElementById("ck-titulo"))?.focus();
    });
    return () => cancelAnimationFrame(quadro);
  }, [aberto, etapa, pix.carregando, pix.expirado]);

  if (!r) {
    return (
      <DialogoTicket id="ck" aberto={false} aoFechar={props.aoFechar} idTitulo="ck-titulo" rotuloResumo="Resumo da reserva" resumo={null}>
        <span />
      </DialogoTicket>
    );
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const novos: Record<string, boolean> = {};
    if (!atleta) {
      novos.nome = nome.trim().split(/\s+/).filter(Boolean).length < 2;
      novos.whats = whats.replace(/\D/g, "").length < 10;
    }
    if (varios) novos.esporte = !esporte;
    novos.aceite = !aceite;
    setErros(novos);
    const primeiro = ["nome", "whats", "esporte", "aceite"].find((k) => novos[k]);
    if (primeiro) {
      const alvo = { nome: "#f-nome", whats: "#f-whats", esporte: '#ck-dados input[name="esporte"]', aceite: "#f-aceite" }[primeiro];
      document.querySelector<HTMLElement>(alvo as string)?.focus();
      return;
    }
    props.aoEnviar({
      nome: atleta ? atleta.nome : nome.trim(),
      whatsapp: atleta ? atleta.whatsapp : whats,
      esporte: esporte ?? esportes[0] ?? "",
    });
  };

  const copiar = async (e: MouseEvent<HTMLButtonElement>) => {
    const campo = (e.currentTarget.parentElement?.querySelector("input") ?? null) as HTMLInputElement | null;
    try {
      await navigator.clipboard.writeText(pix.cobranca?.copiaECola ?? "");
    } catch {
      campo?.select();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const rotuloAgora = etapa === "ok" ? "Pago no Pix" : props.integral ? "Pagar agora" : `Sinal agora (${arena.percentualSinal}%)`;
  const resumoAzul = (
    <>
      <div className="ck-cab">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
        <img src={arena.logoUrl} alt="" width={388} height={374} />
        <div>
          <b>{arena.nome}</b>
          <span>Reserva de quadra</span>
        </div>
      </div>
      <dl className="t-linhas">
        <div>
          <dt>Quadra</dt>
          <dd>{r.quadra.nome}</dd>
        </div>
        <div>
          <dt>Dia</dt>
          <dd>{diaLongo(diaReserva, hoje)}</dd>
        </div>
        <div>
          <dt>Horário</dt>
          <dd className="num">{`${r.inicio} às ${r.fim}`}</dd>
        </div>
      </dl>
      <ItensTicket resumo={r} />
      <div className="t-total">
        <span>Total</span>
        <b className="num">{reais(r.total)}</b>
      </div>
      <div className="t-total t-agora">
        <span>{rotuloAgora}</span>
        <b className="num">{reais(etapa === "ok" && confirmada ? confirmada.pago : r.agora)}</b>
      </div>
      {etapa === "ok" && confirmada && (
        <div className="carimbo" aria-label={`Reserva confirmada, código ${codigoReserva(confirmada.reservaId)}`}>
          <small>Reserva</small>
          <span>Confirmada</span>
          <small className="num">Nº {codigoReserva(confirmada.reservaId)}</small>
        </div>
      )}
    </>
  );

  return (
    <DialogoTicket
      id="ck"
      aberto={aberto}
      aoFechar={props.aoFechar}
      idTitulo="ck-titulo"
      rotuloResumo="Resumo da reserva"
      idResumo="ck-resumo"
      etapa={etapa}
      resumo={resumoAzul}
    >
      <form className="ck-etapa" id="ck-dados" data-etapa="dados" noValidate hidden={etapa !== "dados"} onSubmit={enviar}>
        {etapa === "dados" && (
          <>
            <h2 className="ck-h" id="ck-titulo" tabIndex={-1}>
              Seus dados
            </h2>
            {atleta ? (
              <p className="ck-conta">
                <span className="avatar" aria-hidden="true">
                  {atleta.primeiro.charAt(0)}
                </span>
                <span>
                  Reservando como <b>{atleta.nome}</b>
                  <br />
                  <span className="num">{atleta.whatsapp}</span>
                </span>
              </p>
            ) : (
              <>
                <p className="ck-sub">Sem cadastro: só nome e WhatsApp. A confirmação chega por lá.</p>
                <p className="ck-tem-conta">
                  {"Tem conta? "}
                  <button type="button" className="link" onClick={props.aoEntrar}>
                    Entre
                  </button>
                  {" e esta reserva vira carimbo no Clube."}
                </p>
                <div className="campo" data-campo="nome" data-erro={erros.nome ? "" : undefined}>
                  <label htmlFor="f-nome">Nome completo</label>
                  <input type="text" id="f-nome" autoComplete="name" value={nome} aria-describedby="e-nome"
                    aria-invalid={erros.nome ? true : undefined} onChange={(e) => setNome(e.target.value)} />
                  <p className="erro" id="e-nome" hidden={!erros.nome}>
                    Informe seu nome completo.
                  </p>
                </div>
                <div className="campo" data-campo="whats" data-erro={erros.whats ? "" : undefined}>
                  <label htmlFor="f-whats">WhatsApp</label>
                  <input type="tel" id="f-whats" inputMode="tel" autoComplete="tel-national" placeholder={`(${arena.dddWhatsapp}) 90000-0000`}
                    value={whats} aria-describedby="e-whats" aria-invalid={erros.whats ? true : undefined}
                    onChange={(e) => setWhats(mascaraWhats(e.target.value))} />
                  <p className="erro" id="e-whats" hidden={!erros.whats}>
                    WhatsApp inválido. Use DDD e número.
                  </p>
                </div>
              </>
            )}
            {varios && (
              <fieldset className="campo" data-campo="esporte" data-erro={erros.esporte ? "" : undefined}>
                <legend>Esporte</legend>
                <div className="opcoes">
                  {esportes.map((e) => (
                    <label key={e} className="opcao">
                      <input type="radio" name="esporte" value={e} checked={esporte === e}
                        onChange={() => {
                          setEsporte(e);
                          setErros((x) => ({ ...x, esporte: false }));
                        }} />
                      <span>{rotuloEsporte(e)}</span>
                    </label>
                  ))}
                </div>
                <p className="erro" id="e-esporte" hidden={!erros.esporte}>
                  Escolha o esporte da partida.
                </p>
              </fieldset>
            )}
            <fieldset className="campo">
              <legend>Quanto pagar agora</legend>
              <div className="pagar">
                <label className="pg">
                  <input type="radio" name="pagamento" value="sinal" checked={!props.integral} onChange={() => props.aoEscolherIntegral(false)} />
                  <span>
                    <b>{`Sinal de ${arena.percentualSinal}%`}</b>
                    <span className="num" data-valor="sinal">
                      {reais(r.sinal)}
                    </span>
                  </span>
                </label>
                <label className="pg">
                  <input type="radio" name="pagamento" value="integral" checked={props.integral} onChange={() => props.aoEscolherIntegral(true)} />
                  <span>
                    <b>Valor integral</b>
                    <span className="num" data-valor="total">
                      {reais(r.total)}
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
            {atleta && props.temHoraGratis && (
              <label className="ck-voucher">
                <input type="checkbox" checked={props.usarHoraGratis} onChange={(e) => props.aoUsarHoraGratis(e.target.checked)} />
                <span>
                  <b>Usar minha hora grátis do Clube</b>
                  <br />
                  {`1 hora grátis nesta reserva${clube?.teto !== null && clube?.teto !== undefined ? `, até ${reais(clube.teto)}` : ""}.`}
                </span>
              </label>
            )}
            <label className="aceite" data-campo="aceite" data-erro={erros.aceite ? "" : undefined}>
              <input type="checkbox" id="f-aceite" aria-describedby="e-aceite" checked={aceite} aria-invalid={erros.aceite ? true : undefined}
                onChange={(e) => {
                  setAceite(e.target.checked);
                  setErros((x) => ({ ...x, aceite: false }));
                }} />
              <span>
                {"Li e aceito a "}
                <button type="button" className="link" aria-expanded={verPolitica} aria-controls="politica-ck"
                  onClick={(e) => {
                    e.preventDefault();
                    setVerPolitica((v) => !v);
                  }}>
                  política de cancelamento
                </button>
                .
              </span>
            </label>
            <p className="politica" id="politica-ck" hidden={!verPolitica}>
              {arena.politica}
            </p>
            <p className="erro" id="e-aceite" hidden={!erros.aceite}>
              Aceite a política para continuar.
            </p>
            <button type="submit" className="btn-amarelo ck-gerar" id="ck-gerar" disabled={props.enviando} aria-busy={props.enviando || undefined}>
              {r.agora > 0 ? (
                <span>
                  Gerar Pix de <span className="num">{reais(r.agora)}</span>
                </span>
              ) : (
                "Confirmar reserva"
              )}
            </button>
          </>
        )}
      </form>

      <div className="ck-etapa" id="ck-pix" data-etapa="pix" hidden={etapa !== "pix"}>
        {etapa === "pix" && pix.expirado && (
          <>
            <h2 className="ck-h" id="ck-titulo" tabIndex={-1}>
              Tempo esgotado
            </h2>
            <p className="ck-sub">O prazo de 10 minutos para pagar acabou e o horário foi liberado.</p>
            <button type="button" className="btn-amarelo ck-acao" onClick={props.aoFechar}>
              Escolher de novo
            </button>
          </>
        )}
        {etapa === "pix" && !pix.expirado && (pix.carregando || !pix.cobranca) && (
          <>
            <h2 className="ck-h" id="ck-titulo" tabIndex={-1}>
              Gerando seu Pix…
            </h2>
            <p className="ck-sub">Segurando o horário para você enquanto isso.</p>
          </>
        )}
        {etapa === "pix" && !pix.expirado && !pix.carregando && pix.cobranca && (
          <>
            <h2 className="ck-h" id="ck-titulo" tabIndex={-1}>
              Pague com Pix
            </h2>
            <div className="pix">
              <div className="pix-qr" role="img" aria-label={arena.modoPagamento === "simulado" ? "QR Code Pix de demonstração" : "QR Code Pix"}>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado na hora (data URL) */}
                <img src={pix.cobranca.qrCodeUrl} alt="" width={240} height={240} />
              </div>
              <div>
                <p className="pix-rot">{props.integral ? "Valor integral" : `Sinal de ${arena.percentualSinal}%`}</p>
                <p className="pix-valor num">{reais(r.agora)}</p>
                <p className="pix-como">No app do banco, escolha Pix e leia o código. Ou copie o código abaixo.</p>
                <p className="pix-timer">
                  <Icone nome="clock" />
                  <span>
                    Horário guardado por <Cronometro expiraEm={pix.expiraEm} aoAcabar={props.aoExpirar} />
                  </span>
                </p>
              </div>
            </div>
            <div className="campo">
              <label htmlFor="pix-code">Pix copia e cola</label>
              <div className="copia">
                <input id="pix-code" readOnly value={pix.cobranca.copiaECola} />
                <button type="button" className="btn-navy" onClick={copiar}>
                  <Icone nome="copy" />
                  <span>{copiado ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
            </div>
            <p className="pix-receb">
              Recebedor: <b>{arena.recebedor}</b>. Confira esse nome no app do banco antes de pagar.
            </p>
            {arena.modoPagamento === "simulado" ? (
              <>
                <p className="pix-demo">Ambiente de demonstração: nenhum valor é cobrado.</p>
                <button type="button" className="btn-amarelo ck-acao" onClick={props.aoSimular}>
                  Simular pagamento
                </button>
              </>
            ) : arena.modoPagamento === "manual" ? (
              pix.informado ? (
                <p className="pix-demo">A arena vai conferir o Pix e confirmar. Esta tela atualiza sozinha.</p>
              ) : (
                <button type="button" className="btn-amarelo ck-acao" onClick={props.aoInformarPagamento}>
                  Já fiz o Pix
                </button>
              )
            ) : null}
            <button type="button" className="link ck-voltar" onClick={props.aoVoltar}>
              Voltar e editar os dados
            </button>
          </>
        )}
      </div>

      <div className="ck-etapa" id="ck-ok" data-etapa="ok" hidden={etapa !== "ok"}>
        {etapa === "ok" && confirmada && (
          <TelaConfirmada {...props} confirmada={confirmada} nomeVisitante={nome} whatsVisitante={whats} />
        )}
      </div>
    </DialogoTicket>
  );
}

function TelaConfirmada(
  props: DialogoCheckoutProps & {
    confirmada: ReservaConfirmada;
    nomeVisitante: string;
    whatsVisitante: string;
  }
) {
  const { confirmada, atleta, clube, hoje } = props;
  const r = confirmada.resumo;
  const nome = atleta ? atleta.primeiro : props.nomeVisitante.trim().split(/\s+/)[0];
  const whats = atleta ? atleta.whatsapp : props.whatsVisitante;
  const n = r.horas.length;
  const resto = r.total - confirmada.pago;
  const antes = confirmada.carimbosAntes;
  const meta = clube?.meta ?? 10;
  return (
    <>
      <h2 className="ck-h" id="ck-titulo" tabIndex={-1}>
        {nome ? `Tudo certo, ${maiuscula(nome)}!` : "Tudo certo!"}
      </h2>
      <p className="ck-sub">
        Seu horário está garantido. O comprovante foi para o WhatsApp <span className="num">{whats}</span>.
      </p>
      <div className="ok-dia">
        <p className="ok-dia-rot">No dia do jogo</p>
        <p className="ok-dia-valor">
          {resto > 0 ? (
            <>
              Pague <span className="num">{reais(resto)}</span> na arena
            </>
          ) : (
            "Está tudo pago"
          )}
        </p>
        <p className="ok-dia-info">
          {`${diaCurto(confirmada.dia, hoje)} · `}
          <span className="num">{`${r.inicio} às ${r.fim}`}</span>
          {` · ${r.quadra.nome}. ${resto > 0 ? "Chegue 10 minutos antes." : "É só chegar e jogar."}`}
        </p>
      </div>
      <div className="ok-acoes">
        <button type="button" className="btn-navy" onClick={props.aoBaixarAgenda}>
          <Icone nome="calendar-plus" />
          Adicionar à agenda
        </button>
        {atleta && (
          <Link className="btn-borda" href="/minha-conta" onClick={(e) => {
            e.preventDefault();
            props.aoVerReservas(confirmada.reservaId);
          }}>
            <Icone nome="ticket" />
            Ver minhas reservas
          </Link>
        )}
      </div>
      {clube &&
        (atleta ? (
          <div className="ok-caixa">
            <b>{`${clube.nome}: +${plural(n, "carimbo", "carimbos")}`}</b>
            <CarimbosMini cheias={Math.min(antes, meta)} novas={Math.max(0, Math.min(n, meta - antes))} total={meta} />
            <p>
              {antes + n >= meta
                ? `Você completou ${meta} carimbos! Sua hora grátis vai para análise da arena e aparece no Clube assim que for liberada.`
                : `Agora são ${antes + n} de ${meta} carimbos. Faltam ${plural(meta - antes - n, "carimbo", "carimbos")} para ganhar 1 hora grátis.`}
            </p>
          </div>
        ) : (
          <div className="ok-caixa">
            <b>Crie sua conta com esse WhatsApp</b>
            <p>{`Você acompanha suas reservas e soma horas no ${clube.nome}: a cada ${meta} horas, 1 hora grátis.`}</p>
            <button type="button" className="btn-navy" onClick={props.aoCriarConta}>
              Criar conta
            </button>
          </div>
        ))}
      <div className="ok-fim">
        <button type="button" className="btn-borda" onClick={props.aoFechar}>
          Fechar
        </button>
      </div>
    </>
  );
}
