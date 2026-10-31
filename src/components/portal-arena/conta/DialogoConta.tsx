/**
 * @file DialogoConta.tsx
 * @description Entrar e criar conta com código no WhatsApp, sem senha, no mesmo ticket do checkout.
 * O lado azul lista as vantagens e mostra uma cartela de exemplo. Passo 1: WhatsApp (e nome e
 * nascimento para criar); depois de reservar sem conta, "Confirme o seu WhatsApp". Passo 2: "Digite o
 * código" (6 números, "Reenviar em 0:30", "Trocar número"). No celular os botões ficam no fim da tela.
 */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { entrarComCodigo, pedirCodigo, type ModoAcesso } from "@/lib/portal/contaApi";
import { mascaraWhats, nomeProprio, plural } from "@/lib/portal/formatos";
import { CarimbosMini } from "../base/Carimbos";
import { DialogoTicket } from "../base/DialogoTicket";
import { useAviso } from "../base/Aviso";
import { Icone } from "../Icone";

/** Reserva recém-feita sem conta (modo `concluir`). */
export interface ReservaSemConta {
  nome: string;
  whatsapp: string;
  horas: number;
  reservaId: string;
  checkoutToken: string;
}

export interface DialogoContaProps {
  aberto: boolean;
  aoFechar: () => void;
  modoInicial: ModoAcesso;
  /** Frase no lugar do subtítulo (ex.: "Entre para esta reserva virar carimbo no Clube.") */
  motivo?: string;
  arena: { id: string; nome: string; logoUrl: string; ddd: string };
  /** Meta do Clube (null = arena sem Clube) */
  metaClube: number | null;
  reservaSemConta: ReservaSemConta | null;
  /** Entrou: nome do atleta e como entrou */
  aoEntrar: (nome: string, modo: ModoAcesso) => void;
}

const REENVIO_S = 30;

/**
 * @example
 * ```tsx
 * <DialogoConta aberto modoInicial="entrar" arena={...} metaClube={10} reservaSemConta={null} aoEntrar={...} aoFechar={...} />
 * ```
 */
export function DialogoConta(props: DialogoContaProps) {
  const { aberto, arena, metaClube, reservaSemConta } = props;
  const aviso = useAviso();
  const [modo, setModo] = useState<ModoAcesso>(props.modoInicial);
  const [motivo, setMotivo] = useState(props.motivo ?? "");
  const [etapa, setEtapa] = useState<"dados" | "codigo">("dados");
  const [form, setForm] = useState({ whats: "", nome: "", nasc: "" });
  const [codigo, setCodigo] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [reenvio, setReenvio] = useState(0);
  const [aberturaAnterior, setAberturaAnterior] = useState({ aberto, modo: props.modoInicial, motivo: props.motivo });

  // Cada abertura começa no passo 1, no modo pedido (os dados digitados ficam)
  if (aberto !== aberturaAnterior.aberto || props.modoInicial !== aberturaAnterior.modo || props.motivo !== aberturaAnterior.motivo) {
    setAberturaAnterior({ aberto, modo: props.modoInicial, motivo: props.motivo });
    if (aberto) {
      setModo(props.modoInicial);
      setMotivo(props.motivo ?? "");
      setEtapa("dados");
      setErros({});
      setCodigo("");
    }
  }

  // Contagem do "Reenviar em 0:30"
  useEffect(() => {
    if (reenvio <= 0) return;
    const id = setTimeout(() => setReenvio((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [reenvio]);

  // Foco no primeiro campo do passo (ou no título)
  useEffect(() => {
    if (!aberto) return;
    const quadro = requestAnimationFrame(() => {
      (document.querySelector<HTMLElement>("#au-form input:not([hidden])") ?? document.getElementById("auth-titulo"))?.focus();
    });
    return () => cancelAnimationFrame(quadro);
  }, [aberto, modo, etapa]);

  const whatsDoPedido = modo === "concluir" && reservaSemConta ? reservaSemConta.whatsapp : form.whats;

  const trocarAba = (novo: ModoAcesso) => {
    setModo(novo);
    setMotivo("");
    setEtapa("dados");
    setErros({});
  };

  const enviarDados = async () => {
    const novos: Record<string, string> = {};
    if (modo === "criar" && form.nome.trim().split(/\s+/).filter(Boolean).length < 2) novos["au-nome"] = "Informe seu nome completo.";
    if (modo !== "concluir" && form.whats.replace(/\D/g, "").length < 10) novos["au-whats"] = "WhatsApp inválido. Use DDD e número.";
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      document.getElementById(primeiro)?.focus();
      return;
    }
    setEnviando(true);
    const r = await pedirCodigo(arena.id, whatsDoPedido, modo);
    setEnviando(false);
    if (!r.ok) {
      if (modo === "concluir") aviso(r.erro ?? "Não foi possível mandar o código.");
      else setErros({ "au-whats": r.erro ?? "Não foi possível mandar o código." });
      return;
    }
    setCodigo("");
    setEtapa("codigo");
    setReenvio(r.dados?.reenviarEmSegundos ?? REENVIO_S);
  };

  const enviarCodigo = async () => {
    if (codigo.length !== 6) {
      setErros({ "au-codigo": "Digite os 6 números do código." });
      document.getElementById("au-codigo")?.focus();
      return;
    }
    setEnviando(true);
    const r = await entrarComCodigo({
      arenaId: arena.id,
      telefone: whatsDoPedido,
      codigo,
      modo,
      nome: modo === "concluir" ? reservaSemConta?.nome : modo === "criar" ? form.nome : undefined,
      nascimento: modo === "criar" && form.nasc ? form.nasc : undefined,
      reservaId: modo === "concluir" ? reservaSemConta?.reservaId : undefined,
      checkoutToken: modo === "concluir" ? reservaSemConta?.checkoutToken : undefined,
    });
    setEnviando(false);
    if (!r.ok) {
      setErros({ "au-codigo": r.erro });
      document.getElementById("au-codigo")?.focus();
      return;
    }
    props.aoEntrar(r.nome, modo);
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    void (etapa === "codigo" ? enviarCodigo() : enviarDados());
  };

  const reenviar = async () => {
    setReenvio(REENVIO_S);
    const r = await pedirCodigo(arena.id, whatsDoPedido, modo);
    if (r.ok) aviso("Mandamos um código novo no seu WhatsApp.");
    else {
      setReenvio(0);
      aviso(r.erro ?? "Não foi possível mandar o código.");
    }
  };

  const textoBotao = etapa === "codigo" ? (enviando ? (modo === "entrar" ? "Entrando…" : "Criando conta…") : modo === "entrar" ? "Entrar" : "Criar conta") : null;
  const botaoCodigo = (
    <button type="submit" className="btn-amarelo ck-gerar" disabled={enviando} aria-busy={enviando || undefined}>
      {enviando ? (
        "Enviando código…"
      ) : (
        <>
          <Icone nome="message-circle" />
          Receber código no WhatsApp
        </>
      )}
    </button>
  );

  const campoWhats = (dica?: string) => (
    <div className="campo" data-campo="au-whats" data-erro={erros["au-whats"] ? "" : undefined}>
      <label htmlFor="au-whats">WhatsApp</label>
      <input
        type="tel"
        id="au-whats"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={`(${arena.ddd}) 90000-0000`}
        value={form.whats}
        aria-describedby={dica ? "d-au-whats e-au-whats" : "e-au-whats"}
        aria-invalid={erros["au-whats"] ? true : undefined}
        onChange={(e) => setForm((f) => ({ ...f, whats: mascaraWhats(e.target.value) }))}
      />
      {dica && (
        <p className="dica" id="d-au-whats">
          {dica}
        </p>
      )}
      <p className="erro" id="e-au-whats" hidden={!erros["au-whats"]}>
        {erros["au-whats"]}
      </p>
    </div>
  );

  const ladoAzul = (
    <>
      <div className="ck-cab">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
        <img src={arena.logoUrl} alt="" width={388} height={374} />
        <div>
          <b>{arena.nome}</b>
          <span>Sua conta</span>
        </div>
      </div>
      {modo === "concluir" && reservaSemConta && metaClube ? (
        <>
          <p className="au-tit">Sua reserva já vira carimbo</p>
          <p className="au-curto">
            {`Com a conta, ${reservaSemConta.horas === 1 ? "a hora de hoje entra" : `as ${reservaSemConta.horas} horas de hoje entram`} na sua cartela do Clube.`}
          </p>
          <div className="au-cartela">
            <CarimbosMini cheias={0} novas={Math.min(reservaSemConta.horas, metaClube)} total={metaClube} />
            <p>{`+${plural(reservaSemConta.horas, "carimbo", "carimbos")} na cartela. Com ${metaClube}, você ganha 1 hora grátis.`}</p>
          </div>
        </>
      ) : (
        <>
          <p className="au-tit">Com a conta, você</p>
          <p className="au-curto">
            {metaClube ? "Entra com um código no WhatsApp, sem senha, e junta carimbos no Clube." : "Entra com um código no WhatsApp, sem senha."}
          </p>
          <ul className="au-van">
            <li>
              <Icone nome="check" />
              <span>Entra com um código no WhatsApp. Sem senha para lembrar</span>
            </li>
            {metaClube && (
              <li>
                <Icone nome="check" />
                <span>{`Junta carimbos no Clube: a cada ${metaClube} horas, 1 hora grátis`}</span>
              </li>
            )}
            <li>
              <Icone nome="check" />
              <span>Acompanha e cancela suas reservas</span>
            </li>
            <li>
              <Icone nome="check" />
              <span>Chama gente para a sua partida e pede vaga nas outras</span>
            </li>
          </ul>
          {metaClube && (
            <div className="au-cartela">
              <CarimbosMini cheias={3} total={metaClube} />
              <p>{`Exemplo de cartela: 3 de ${metaClube} carimbos.`}</p>
            </div>
          )}
        </>
      )}
    </>
  );

  let corpo;
  if (etapa === "codigo") {
    corpo = (
      <>
        <h2 className="ck-h" id="auth-titulo" tabIndex={-1}>
          Digite o código
        </h2>
        <p className="ck-sub">
          {"Mandamos um código de 6 números para o WhatsApp "}
          <b className="num">{whatsDoPedido}</b>.
        </p>
        <div className="campo" data-campo="au-codigo" data-erro={erros["au-codigo"] ? "" : undefined}>
          <label htmlFor="au-codigo">Código</label>
          <input
            type="text"
            id="au-codigo"
            className="au-codigo num"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={codigo}
            aria-describedby="e-au-codigo"
            aria-invalid={erros["au-codigo"] ? true : undefined}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <p className="erro" id="e-au-codigo" hidden={!erros["au-codigo"]}>
            {erros["au-codigo"]}
          </p>
        </div>
        <button type="submit" className="btn-amarelo ck-gerar" disabled={enviando} aria-busy={enviando || undefined}>
          {textoBotao}
        </button>
        <p className="au-troca">
          <button type="button" className="link" id="au-reenviar" disabled={reenvio > 0} onClick={() => void reenviar()}>
            {reenvio > 0 ? (
              <>
                {"Reenviar em "}
                <span className="num">{`0:${String(reenvio).padStart(2, "0")}`}</span>
              </>
            ) : (
              "Reenviar código"
            )}
          </button>
          {" · "}
          <button type="button" className="link" onClick={() => setEtapa("dados")}>
            Trocar número
          </button>
        </p>
      </>
    );
  } else if (modo === "entrar") {
    corpo = (
      <>
        <h2 className="ck-h" id="auth-titulo" tabIndex={-1}>
          Entre na sua conta
        </h2>
        <p className="ck-sub">{motivo || "Digite o seu WhatsApp. Mandamos um código para você entrar, sem senha."}</p>
        {campoWhats()}
        {botaoCodigo}
        <p className="au-troca">
          {"Ainda não tem conta? "}
          <button type="button" className="link" onClick={() => trocarAba("criar")}>
            Criar conta
          </button>
        </p>
      </>
    );
  } else if (modo === "criar") {
    corpo = (
      <>
        <h2 className="ck-h" id="auth-titulo" tabIndex={-1}>
          Crie sua conta
        </h2>
        <p className="ck-sub">{motivo || "Leva menos de um minuto e não precisa de senha. A próxima reserva já vira carimbo no Clube."}</p>
        <div className="campo" data-campo="au-nome" data-erro={erros["au-nome"] ? "" : undefined}>
          <label htmlFor="au-nome">Nome completo</label>
          <input type="text" id="au-nome" autoComplete="name" value={form.nome} aria-describedby="e-au-nome"
            aria-invalid={erros["au-nome"] ? true : undefined} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          <p className="erro" id="e-au-nome" hidden={!erros["au-nome"]}>
            {erros["au-nome"]}
          </p>
        </div>
        {campoWhats("Você entra com ele. As confirmações das reservas também chegam nele.")}
        <div className="campo">
          <label htmlFor="au-nasc">
            {"Data de nascimento "}
            <span className="opc">(opcional)</span>
          </label>
          <input type="date" id="au-nasc" value={form.nasc} aria-describedby="d-au-nasc" onChange={(e) => setForm((f) => ({ ...f, nasc: e.target.value }))} />
          <p className="dica" id="d-au-nasc">
            Para a arena lembrar do seu aniversário.
          </p>
        </div>
        {botaoCodigo}
        <p className="au-troca">
          {"Já tem conta? "}
          <button type="button" className="link" onClick={() => trocarAba("entrar")}>
            Entrar
          </button>
        </p>
      </>
    );
  } else {
    corpo = (
      <>
        <h2 className="ck-h" id="auth-titulo" tabIndex={-1}>
          Confirme o seu WhatsApp
        </h2>
        <p className="ck-sub">Usamos os dados da sua reserva. Só falta confirmar o número com um código.</p>
        <dl className="au-dados">
          <div>
            <dt>Nome</dt>
            <dd>{nomeProprio(reservaSemConta?.nome ?? "")}</dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd className="num">{reservaSemConta?.whatsapp}</dd>
          </div>
        </dl>
        {botaoCodigo}
        <button type="button" className="link ck-voltar" onClick={props.aoFechar}>
          Agora não
        </button>
      </>
    );
  }

  return (
    <DialogoTicket id="auth" className="au" aberto={aberto} aoFechar={props.aoFechar} idTitulo="auth-titulo" rotuloResumo="Vantagens da conta"
      idResumo="au-lado" resumo={ladoAzul}>
      <div className="au-abas" id="au-abas" role="tablist" aria-label="Entrar ou criar conta" hidden={modo === "concluir" || etapa === "codigo"}>
        <button type="button" role="tab" aria-selected={modo === "entrar"} onClick={() => trocarAba("entrar")}>
          Entrar
        </button>
        <button type="button" role="tab" aria-selected={modo === "criar"} onClick={() => trocarAba("criar")}>
          Criar conta
        </button>
      </div>
      <form id="au-form" noValidate onSubmit={enviar}>
        {corpo}
      </form>
    </DialogoTicket>
  );
}
