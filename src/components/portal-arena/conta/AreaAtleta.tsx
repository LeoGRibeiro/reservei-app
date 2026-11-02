/**
 * @file AreaAtleta.tsx
 * @description Minha conta (`/minha-conta`, `/minha-conta/clube`, `/minha-conta/dados`): topo em areia
 * com "Voltar para as quadras", avatar, "Olá, Nome", WhatsApp e fichas (Próximo jogo, Clube, Para usar);
 * abas Reservas (ingressos, histórico, pedidos e ajuda), Clube (cartela, horas grátis, carimbos) e Meus
 * dados (edição, falar com a arena, sair, excluir). Visitante vê o cartão "Minha conta · Entrar · Criar conta".
 */

"use client";

import Link from "next/link";
import { useState, type FormEvent, type MouseEvent } from "react";
import type { ClubeArena, QuadraPortal } from "@/lib/portal/types";
import {
  carimboMaisAntigo,
  carimbosValidos,
  historicoReservas,
  horasGratisValidas,
  proximasReservas,
  totalCarimbos,
  type AtletaPortal,
  type ReservaAtleta,
} from "@/lib/portal/contaAtleta";
import type { DadosConta } from "@/lib/portal/contaRepository";
import {
  MES_CURTO,
  SEM_CURTA,
  dataLonga,
  dataNascimento,
  diaCurto,
  diaLongo,
  funcionamento,
  hh,
  linkWhatsApp,
  mascaraWhats,
  paraData,
  plural,
  reais,
  rotuloEsporte,
} from "@/lib/portal/formatos";
import { CanhotoData } from "../base/CanhotoData";
import { CartelaClube } from "../secoes/SecaoClube";
import { Icone } from "../Icone";

export type AbaConta = "reservas" | "clube" | "dados";

/** Pedido feito em partida de outra pessoa, com o que o mural mostra dela. */
export interface PedidoFeitoNaConta {
  id: string;
  esporte: string;
  data: string;
  hora: number;
  quadraNome: string;
  organizador: string;
}

export interface AreaAtletaProps {
  carregando: boolean;
  atleta: AtletaPortal | null;
  conta: DadosConta;
  aba: AbaConta;
  hoje: string;
  quadras: QuadraPortal[];
  clube: ClubeArena | null;
  arena: { nome: string; logoUrl: string; whatsappDigitos: string; horarioAbertura: string; horarioFechamento: string };
  temMural: boolean;
  pedidosFeitos: PedidoFeitoNaConta[];
  editando: boolean;
  aoEditar: (editando: boolean) => void;
  aoSalvarDados: (dados: { nome: string; telefone: string; nascimento: string }) => Promise<string | null>;
  aoTrocarAba: (aba: AbaConta) => void;
  aoNavegar: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
  aoEntrar: () => void;
  aoCriar: () => void;
  aoSair: () => void;
  aoExcluir: () => void;
  aoCancelar: (reservaId: string) => void;
  aoVagas: (reservaId: string) => void;
  aoAgenda: (reserva: ReservaAtleta) => void;
  aoVerMural: () => void;
  aoUsarHoraGratis: () => void;
}

const ABAS: [AbaConta, string, "ticket" | "gift" | "user"][] = [
  ["reservas", "Reservas", "ticket"],
  ["clube", "Clube", "gift"],
  ["dados", "Meus dados", "user"],
];

const faixa = (r: Pick<ReservaAtleta, "horas">) => `${hh(r.horas[0])} às ${hh(r.horas[r.horas.length - 1] + 1)}`;

/**
 * @example
 * ```tsx
 * <AreaAtleta atleta={atleta} conta={conta} aba="reservas" ... />
 * ```
 */
export function AreaAtleta(props: AreaAtletaProps) {
  const { atleta, carregando } = props;
  if (carregando) return null;
  if (!atleta) {
    return (
      <div className="wrap conta-fechada">
        <div className="cf-card">
          <h1 id="cc-titulo">Minha conta</h1>
          <p>Entre para ver suas reservas, seus carimbos do Clube e seus dados.</p>
          <div className="cf-acoes">
            <button type="button" className="btn-amarelo" onClick={props.aoEntrar}>
              Entrar
            </button>
            <button type="button" className="btn-borda" onClick={props.aoCriar}>
              Criar conta
            </button>
          </div>
          <a className="link" href="#reservar" onClick={(e) => props.aoNavegar(e, "reservar")}>
            Voltar para as quadras
          </a>
        </div>
      </div>
    );
  }
  return (
    <>
      <CabecalhoConta {...props} atleta={atleta} />
      <div className="wrap conta-corpo" role="tabpanel" id="cc-painel" aria-labelledby={`aba-${props.aba}`}>
        {props.aba === "reservas" && <AbaReservas {...props} atleta={atleta} />}
        {props.aba === "clube" && props.clube && <AbaClube {...props} atleta={atleta} clube={props.clube} />}
        {props.aba === "dados" && <AbaDados {...props} atleta={atleta} />}
      </div>
    </>
  );
}

function CabecalhoConta(props: AreaAtletaProps & { atleta: AtletaPortal }) {
  const { atleta, conta, hoje, clube } = props;
  const ativas = proximasReservas(conta.reservas);
  const prox = ativas[0];
  const horasGratis = horasGratisValidas(conta.horasGratis, hoje);
  const meta = clube?.meta ?? 10;
  const abas = ABAS.filter(([id]) => id !== "clube" || clube);
  return (
    <section className="conta-cab">
      <div className="wrap">
        <a className="cc-voltar" href="#reservar" onClick={(e) => props.aoNavegar(e, "reservar")}>
          <Icone nome="chevron-left" />
          Voltar para as quadras
        </a>
        <div className="cc-linha">
          <div className="cc-quem">
            <span className="avatar avatar-xl" aria-hidden="true">
              {atleta.primeiro.charAt(0)}
            </span>
            <div>
              <h1 id="cc-titulo">{`Olá, ${atleta.primeiro}`}</h1>
              <p className="num">{atleta.whatsapp}</p>
            </div>
          </div>
          <ul className="cc-resumo">
            <li>
              <span>Próximo jogo</span>
              <b>
                {prox ? (
                  <>
                    {`${diaCurto(prox.data, hoje)} · `}
                    <span className="num">{hh(prox.horas[0])}</span>
                  </>
                ) : (
                  "Nenhum marcado"
                )}
              </b>
            </li>
            {clube && (
              <li>
                <span>Clube</span>
                <b className="num">{`${totalCarimbos(conta.carimbos, hoje, meta)} de ${meta} carimbos`}</b>
              </li>
            )}
            {horasGratis.length > 0 && (
              <li className="cc-premio">
                <span>Para usar</span>
                <b>{horasGratis.length === 1 ? "1 hora grátis" : `${horasGratis.length} horas grátis`}</b>
              </li>
            )}
          </ul>
        </div>
        <div className="abas" role="tablist" aria-label="Minha conta">
          {abas.map(([id, nome, icone]) => (
            <button key={id} type="button" role="tab" id={`aba-${id}`} aria-controls="cc-painel" aria-selected={props.aba === id}
              onClick={() => props.aoTrocarAba(id)}>
              <Icone nome={icone} />
              {nome}
              {id === "reservas" && ativas.length > 0 && <span className="cont num">{ativas.length}</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AbaReservas(props: AreaAtletaProps & { atleta: AtletaPortal }) {
  const { conta, hoje, quadras, arena } = props;
  const ativas = proximasReservas(conta.reservas);
  const passadas = historicoReservas(conta.reservas);
  const nomeQuadra = (id: string) => quadras.find((q) => q.id === id)?.nome ?? "";
  return (
    <div className="cc-grid">
      <div>
        <section className="cc-bloco" aria-labelledby="cc-prox">
          <div className="cc-bloco-cab">
            <h2 className="cc-h" id="cc-prox">
              Próximos jogos
            </h2>
            {ativas.length > 0 && (
              <a className="btn-borda" href="#reservar" onClick={(e) => props.aoNavegar(e, "reservar")}>
                Nova reserva
              </a>
            )}
          </div>
          {ativas.length ? (
            <div className="cc-lista">
              {ativas.map((r) => (
                <IngressoReserva key={r.id} {...props} reserva={r} quadraNome={nomeQuadra(r.quadraId)} />
              ))}
            </div>
          ) : (
            <div className="vazio">
              <b>Nenhum jogo marcado</b>
              <p>Escolha um dia e um horário livre para jogar.</p>
              <a className="btn-amarelo" href="#reservar" onClick={(e) => props.aoNavegar(e, "reservar")}>
                Reservar um horário
              </a>
            </div>
          )}
        </section>
        <section className="cc-bloco" aria-labelledby="cc-hist">
          <h2 className="cc-h" id="cc-hist">
            Histórico
          </h2>
          {passadas.length ? (
            <ul className="hist">
              {passadas.map((r) => {
                const cancelada = r.situacao === "cancelada";
                return (
                  <li key={r.id}>
                    <div>
                      <b>
                        {`${diaCurto(r.data, hoje)} · `}
                        <span className="num">{faixa(r)}</span>
                      </b>
                      <span className="sub">{`${nomeQuadra(r.quadraId)} · ${rotuloEsporte(r.esporte)}`}</span>
                    </div>
                    <span className={cancelada ? "hist-st cancelada" : "hist-st"}>{cancelada ? "Cancelada" : "Jogou"}</span>
                    <span className="num hist-v">{reais(r.total)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cc-nada">Os jogos que você já fez aparecem aqui.</p>
          )}
        </section>
      </div>
      <aside className="cc-lado">
        {props.temMural && (
          <section className="cartao" aria-labelledby="cc-ped">
            <h3 id="cc-ped">Pedidos para jogar</h3>
            {props.pedidosFeitos.length ? (
              <ul className="feitos">
                {props.pedidosFeitos.map((p) => (
                  <li key={p.id}>
                    <b>
                      {`${rotuloEsporte(p.esporte)} · ${diaCurto(p.data, hoje)}, `}
                      <span className="num">{hh(p.hora)}</span>
                    </b>
                    <span>{`${p.quadraNome} · com ${p.organizador}`}</span>
                    <span className="ped-st">{`Aguardando ${p.organizador} chamar no WhatsApp`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Viu uma partida procurando jogadores? Peça para entrar e acompanhe aqui.</p>
            )}
            <button type="button" className="link" onClick={props.aoVerMural}>
              Ver partidas procurando jogadores
            </button>
          </section>
        )}
        <section className="cartao" aria-labelledby="cc-ajuda">
          <h3 id="cc-ajuda">Precisa mudar algo?</h3>
          <p>Você pode cancelar até o início do jogo. Com mais de 24 horas de antecedência, você recebe de volta o valor pago, no Pix.</p>
          <a className="btn-borda" href={linkWhatsApp(arena.whatsappDigitos, "Olá! Vim pela Minha conta do site e preciso de ajuda com uma reserva.")}
            target="_blank" rel="noopener">
            <Icone nome="message-circle" />
            Falar com a arena
          </a>
          <Link className="link cc-regras" href="/regras#cancelamento">
            Regras de cancelamento
          </Link>
        </section>
      </aside>
    </div>
  );
}

function IngressoReserva(props: AreaAtletaProps & { reserva: ReservaAtleta; quadraNome: string }) {
  const { reserva: r, quadraNome, hoje, conta, arena } = props;
  const d = paraData(r.data);
  const resto = r.total - r.pago;
  const pedidos = conta.pedidosRecebidos.filter((p) => p.reservaId === r.id);
  const ativos = pedidos.filter((p) => p.status !== "combinado" && p.status !== "rejeitado");
  const novos = ativos.filter((p) => p.status === "pendente").length;
  const combinados = pedidos.filter((p) => p.status === "combinado").length;
  const linha = `${quadraNome} · ${diaCurto(r.data, hoje)} · ${faixa(r)}`;
  let vagas = null;
  if (props.temMural) {
    vagas = r.vagasCompleta ? (
      <>
        <p>
          <Icone nome="check" />
          <span>
            <b>Partida completa</b>
            {` · combinado com ${plural(combinados, "jogador", "jogadores")}`}
          </span>
        </p>
        <button type="button" className="btn-borda" onClick={() => props.aoVagas(r.id)}>
          Ver detalhes
        </button>
      </>
    ) : r.permiteVagas ? (
      <>
        <p>
          <Icone nome="users" />
          <span>
            <b>No mural procurando jogadores</b>
            {ativos.length ? (
              <>
                {` · ${plural(ativos.length, "pedido", "pedidos")}${novos ? ", " : ""}`}
                {novos > 0 && <span className="novo">{novos === 1 ? "1 novo" : `${novos} novos`}</span>}
              </>
            ) : (
              " · nenhum pedido ainda"
            )}
          </span>
        </p>
        <button type="button" className="btn-borda" onClick={() => props.aoVagas(r.id)}>
          Ver pedidos
        </button>
      </>
    ) : (
      <>
        <p>
          <Icone nome="users" />
          <span>Faltou gente? Coloque a partida no mural.</span>
        </p>
        <button type="button" className="btn-borda" onClick={() => props.aoVagas(r.id)}>
          Procurar jogadores
        </button>
      </>
    );
  }
  return (
    <article className="rsv" id={`rsv-${r.codigo}`} aria-labelledby={`rsv-t-${r.codigo}`}>
      <CanhotoData className="rsv-data" semana={SEM_CURTA[d.getDay()]} dia={d.getDate()} mes={MES_CURTO[d.getMonth()]} hora={hh(r.horas[0])} />
      <div className="rsv-corpo">
        <div className="rsv-topo">
          <div>
            <p className="rsv-quando">
              {`${diaLongo(r.data, hoje)} · `}
              <span className="num">{faixa(r)}</span>
            </p>
            <h3 id={`rsv-t-${r.codigo}`}>{quadraNome}</h3>
            <p className="rsv-sub">{`${rotuloEsporte(r.esporte)} · ${plural(r.horas.length, "hora", "horas")} · Nº ${r.codigo}`}</p>
          </div>
          <p className={resto > 0 ? "rsv-estado" : "rsv-estado pago"}>
            <i aria-hidden="true" />
            {resto > 0 ? "Sinal pago" : "Tudo pago"}
          </p>
        </div>
        <dl className="rsv-valores">
          <div>
            <dt>Total</dt>
            <dd className="num">{reais(r.total)}</dd>
          </div>
          <div>
            <dt>Pago no Pix</dt>
            <dd className="num">{reais(r.pago)}</dd>
          </div>
          {resto > 0 && (
            <div className="rsv-arena">
              <dt>Pagar na arena</dt>
              <dd className="num">{reais(resto)}</dd>
            </div>
          )}
        </dl>
        {vagas && <div className="rsv-vagas">{vagas}</div>}
        <div className="rsv-acoes">
          <button type="button" className="btn-navy" onClick={() => props.aoAgenda(r)}>
            <Icone nome="calendar-plus" />
            Adicionar à agenda
          </button>
          <a className="btn-borda" href={linkWhatsApp(arena.whatsappDigitos, `Olá! Tenho uma dúvida sobre a minha reserva Nº ${r.codigo}: ${linha}.`)}
            target="_blank" rel="noopener">
            <Icone nome="message-circle" />
            Falar com a arena
          </a>
          <button type="button" className="link-perigo" onClick={() => props.aoCancelar(r.id)}>
            Cancelar reserva
          </button>
        </div>
      </div>
    </article>
  );
}

function AbaClube(props: AreaAtletaProps & { atleta: AtletaPortal; clube: ClubeArena }) {
  const { conta, hoje, clube, quadras, atleta, arena } = props;
  const [copiado, setCopiado] = useState<string | null>(null);
  const horasGratis = horasGratisValidas(conta.horasGratis, hoje);
  const validos = carimbosValidos(conta.carimbos, hoje);
  const antigo = carimboMaisAntigo(conta.carimbos, hoje);
  const quadraDoCarimbo = (reservaId: string) => {
    const reserva = conta.reservas.find((r) => r.id === reservaId);
    return quadras.find((q) => q.id === reserva?.quadraId)?.nome ?? "";
  };
  const teto = clube.valorTeto;
  const copiar = async (codigo: string) => {
    await navigator.clipboard?.writeText(codigo).catch(() => undefined);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };
  return (
    <div className="cc-clube">
      <CartelaClube
        clube={clube}
        nomeArena={arena.nome}
        logoUrl={arena.logoUrl}
        hoje={hoje}
        mostrarUltimos={false}
        atleta={{ nome: atleta.nome, carimbos: totalCarimbos(conta.carimbos, hoje, clube.meta), ultimos: [], horasGratis }}
        aoCriarConta={props.aoCriar}
        aoUsarHoraGratis={props.aoUsarHoraGratis}
        aoNavegar={props.aoNavegar}
      />
      <div>
        <section className="cc-bloco" aria-labelledby="cc-cup">
          <h2 className="cc-h" id="cc-cup">
            Horas grátis
          </h2>
          {(conta.horasEmAnalise ?? 0) > 0 && (
            <p className="cc-analise" role="status">
              {conta.horasEmAnalise === 1
                ? "Sua hora grátis está em análise pela arena. Assim que for liberada, ela aparece aqui."
                : `Suas ${conta.horasEmAnalise} horas grátis estão em análise pela arena. Assim que forem liberadas, aparecem aqui.`}
            </p>
          )}
          {horasGratis.length ? (
            <>
              <ul className="cupons">
                {horasGratis.map((c) => (
                  <li key={c.id} className="cupom">
                    <b className="cupom-h">1h</b>
                    <div>
                      <b>1 hora grátis</b>
                      <span>{`Em qualquer quadra${teto !== null ? `, até ${reais(teto)}` : ""}. Vale até ${dataLonga(c.expiraEm)}.`}</span>
                    </div>
                    <p className="cupom-cod">
                      {"Código "}
                      <code>{c.codigo}</code>{" "}
                      <button type="button" className="link" onClick={() => void copiar(c.codigo)}>
                        {copiado === c.codigo ? "Copiado" : "Copiar"}
                      </button>
                    </p>
                  </li>
                ))}
              </ul>
              <p className="cc-nota">No site, a hora grátis aparece no ticket da reserva. Reservando pelo WhatsApp, informe o código.</p>
            </>
          ) : (conta.horasEmAnalise ?? 0) > 0 ? null : (
            <p className="cc-nada">{`Quando você juntar ${clube.meta} carimbos, a sua hora grátis aparece aqui.`}</p>
          )}
        </section>
        <section className="cc-bloco" aria-labelledby="cc-car">
          <h2 className="cc-h" id="cc-car">
            Seus carimbos
          </h2>
          {antigo && validos.length > 0 && (
            <p className="cc-nota">{`Os carimbos de ${dataLonga(antigo.data)} vencem em ${dataLonga(antigo.expiraEm)}. Cada carimbo vale ${plural(clube.mesesValidade, "mês", "meses")}.`}</p>
          )}
          {validos.length ? (
            <ul className="hist hist-clube">
              {validos.map((c) => (
                <li key={c.id}>
                  <div>
                    <b>{diaCurto(c.data, hoje)}</b>
                    <span className="sub">{quadraDoCarimbo(c.reservaId)}</span>
                  </div>
                  <b className="num">{`+${plural(c.horas, "carimbo", "carimbos")}`}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cc-nada">Cada hora reservada com a sua conta vira um carimbo.</p>
          )}
          <a className="link cc-como" href="#clube" onClick={(e) => props.aoNavegar(e, "clube")}>
            Como funciona o Clube
          </a>
        </section>
      </div>
    </div>
  );
}

function AbaDados(props: AreaAtletaProps & { atleta: AtletaPortal }) {
  const { atleta, arena, editando } = props;
  const [form, setForm] = useState({ nome: atleta.nome, whats: atleta.whatsapp, nasc: atleta.nascimento });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [editandoAntes, setEditandoAntes] = useState(editando);
  if (editando !== editandoAntes) {
    setEditandoAntes(editando);
    if (editando) {
      setForm({ nome: atleta.nome, whats: atleta.whatsapp, nasc: atleta.nascimento });
      setErros({});
    }
  }

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (form.nome.trim().split(/\s+/).filter(Boolean).length < 2) novos["md-nome"] = "Informe seu nome completo.";
    if (form.whats.replace(/\D/g, "").length < 10) novos["md-whats"] = "WhatsApp inválido. Use DDD e número.";
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      document.getElementById(primeiro)?.focus();
      return;
    }
    setSalvando(true);
    const erro = await props.aoSalvarDados({ nome: form.nome, telefone: form.whats, nascimento: form.nasc });
    setSalvando(false);
    if (erro) setErros({ "md-whats": erro });
  };

  return (
    <div className="cc-dados">
      <div>
        {editando ? (
          <form className="cartao" id="form-dados" noValidate onSubmit={salvar}>
            <h3>Seus dados</h3>
            <div className="campo" data-campo="md-nome" data-erro={erros["md-nome"] ? "" : undefined}>
              <label htmlFor="md-nome">Nome completo</label>
              <input type="text" id="md-nome" autoComplete="name" value={form.nome} aria-describedby="e-md-nome"
                aria-invalid={erros["md-nome"] ? true : undefined} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              <p className="erro" id="e-md-nome" hidden={!erros["md-nome"]}>
                {erros["md-nome"]}
              </p>
            </div>
            <div className="campo" data-campo="md-whats" data-erro={erros["md-whats"] ? "" : undefined}>
              <label htmlFor="md-whats">WhatsApp</label>
              <input type="tel" id="md-whats" inputMode="tel" autoComplete="tel-national" value={form.whats}
                placeholder={`(${atleta.whatsappDigitos.slice(0, 2) || "11"}) 90000-0000`} aria-describedby="d-md-whats e-md-whats"
                aria-invalid={erros["md-whats"] ? true : undefined} onChange={(e) => setForm((f) => ({ ...f, whats: mascaraWhats(e.target.value) }))} />
              <p className="dica" id="d-md-whats">
                É o seu login. Se mudar, use o número novo para entrar.
              </p>
              <p className="erro" id="e-md-whats" hidden={!erros["md-whats"]}>
                {erros["md-whats"]}
              </p>
            </div>
            <div className="campo">
              <label htmlFor="md-nasc">
                {"Data de nascimento "}
                <span className="opc">(opcional)</span>
              </label>
              <input type="date" id="md-nasc" value={form.nasc} onChange={(e) => setForm((f) => ({ ...f, nasc: e.target.value }))} />
            </div>
            <div className="form-acoes">
              <button type="submit" className="btn-amarelo" disabled={salvando} aria-busy={salvando || undefined}>
                Salvar
              </button>
              <button type="button" className="btn-borda" onClick={() => props.aoEditar(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <section className="cartao" aria-labelledby="md-t">
            <h3 id="md-t">Seus dados</h3>
            <dl className="dl-dados">
              <div>
                <dt>Nome</dt>
                <dd>{atleta.nome}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  <span className="num">{atleta.whatsapp}</span> <small>· seu login</small>
                </dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{atleta.nascimento ? dataNascimento(atleta.nascimento) : "Não informado"}</dd>
              </div>
            </dl>
            <div className="form-acoes">
              <button type="button" className="btn-borda" onClick={() => props.aoEditar(true)}>
                Editar dados
              </button>
            </div>
          </section>
        )}
      </div>
      <div>
        <section className="cartao" aria-labelledby="ar-t">
          <h3 id="ar-t">Falar com a arena</h3>
          <p>{`Dúvida sobre um horário, um pedido especial ou o Clube? A arena responde no WhatsApp, ${funcionamento(arena.horarioAbertura, arena.horarioFechamento).replace("Todos os dias, ", "")}.`}</p>
          <a className="btn-borda" href={linkWhatsApp(arena.whatsappDigitos, `Olá! Sou ${atleta.nome} e vim pela Minha conta do site.`)} target="_blank" rel="noopener">
            <Icone nome="message-circle" />
            Chamar no WhatsApp
          </a>
        </section>
        <section className="cartao">
          <h3>Sair da conta</h3>
          <p>Para entrar de novo, é só pedir um código no seu WhatsApp.</p>
          <div className="form-acoes">
            <button type="button" className="btn-borda" onClick={props.aoSair}>
              <Icone nome="log-out" />
              Sair
            </button>
          </div>
        </section>
        <section className="cartao">
          <h3>Excluir conta</h3>
          <p>Apaga seus dados e seus carimbos do Clube. Não dá para desfazer.</p>
          <div className="form-acoes">
            <button type="button" className="link-perigo" onClick={props.aoExcluir}>
              Excluir minha conta
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
