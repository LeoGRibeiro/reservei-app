/**
 * @file JanelasAgenda.tsx
 * @description Janelas da Agenda: nova reserva no balcão (preço da tabela da quadra, pagamento já
 * recebido, cliente com ou sem conta) e bloqueio de horário. Abrem já com a quadra, o dia e o horário
 * clicados na grade; mostram só horários livres.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Planos E e F)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { Aviso, Botao, Campo, Entrada, Janela, OpcaoCartao, Selecao, AreaTexto } from "@/components/admin/ui";
import { usePainel } from "@/components/admin/painel/ContextoPainel";
import { useArena } from "@/hooks/useArena";
import { useReservasService } from "@/hooks/useReservasService";
import { useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";
import { calcularPrecoReserva } from "@/lib/arena/arenaService";
import { chamarApi } from "@/lib/api/clienteApi";
import { getHoje, mascaraWhatsApp } from "@/lib/constants";
import { moeda } from "@/lib/admin/formatos";
import { ESPORTES } from "@/lib/quadras";
import { MOTIVOS_BLOQUEIO_SUGERIDOS } from "@/lib/adminAgenda/types";
import { horariosLivres } from "@/components/admin/reservas/JanelasBalcao";
import type { FormaPagamento } from "@/lib/reservas/formasPagamento";

/** Ponto de partida das janelas (o que foi clicado na grade). */
export interface SelecaoInicial {
  quadraId?: string;
  data?: string;
  horario?: string;
}

/**
 * Escolha de horários seguidos entre os livres da quadra no dia.
 */
function SeletorHorarios({
  data,
  quadraId,
  escolhidos,
  aoMudar,
}: {
  data: string;
  quadraId: string;
  escolhidos: string[];
  aoMudar: (h: string[]) => void;
}) {
  const horarios = useHorariosCatalogo();
  const { carregarPeriodo } = useReservasService();
  const [doDia, setDoDia] = useState<Reserva[] | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarPeriodo(data, data).then((lista) => {
      if (ativo) setDoDia(lista);
    });
    return () => {
      ativo = false;
    };
  }, [data, carregarPeriodo]);

  const livres = useMemo(() => (doDia ? horariosLivres(doDia, quadraId, data, horarios, "") : []), [doDia, quadraId, data, horarios]);

  function alternar(h: string) {
    if (escolhidos.includes(h)) return aoMudar(escolhidos.filter((x) => x !== h));
    const proximo = [...escolhidos, h].sort();
    const indices = proximo.map((x) => horarios.indexOf(x));
    aoMudar(indices.every((v, i) => i === 0 || v === indices[i - 1] + 1) ? proximo : [h]);
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-painel-tinta">
        Horário <span className="font-normal text-painel-suave">(toque nos horários seguidos)</span>
      </legend>
      {!doDia ? (
        <p className="text-sm text-painel-suave">Conferindo a agenda...</p>
      ) : livres.length === 0 ? (
        <p className="text-sm text-painel-suave">Nenhum horário livre nesta quadra neste dia.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {livres.map((h) => {
            const marcado = escolhidos.includes(h);
            return (
              <button
                key={h}
                type="button"
                aria-pressed={marcado}
                onClick={() => alternar(h)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-sm tabular-nums",
                  marcado ? "border-painel-destaque bg-painel-destaque text-white" : "border-painel-linha-forte bg-painel-superficie hover:bg-painel-elevada"
                )}
              >
                {h}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function CamposQuadraData({
  quadraId,
  data,
  aoMudarQuadra,
  aoMudarData,
}: {
  quadraId: string;
  data: string;
  aoMudarQuadra: (id: string) => void;
  aoMudarData: (d: string) => void;
}) {
  const quadras = useQuadrasCatalogo();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="Quadra">
        {(id) => (
          <Selecao id={id} value={quadraId} onChange={(e) => aoMudarQuadra(e.target.value)}>
            {quadras.map((q) => (
              <option key={q.id} value={q.id}>
                {q.descricao}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Data">
        {(id) => <Entrada id={id} type="date" min={getHoje()} value={data} onChange={(e) => aoMudarData(e.target.value)} />}
      </Campo>
    </div>
  );
}

// ─── Nova reserva no balcão ──────────────────────────────────────────────────

const PAGAMENTOS = [
  { id: "nada", rotulo: "Ainda não pagou", descricao: "Paga tudo no dia." },
  { id: "sinal", rotulo: "Pagou o sinal", descricao: "O resto fica para o dia." },
  { id: "integral", rotulo: "Pagou tudo", descricao: "Reserva quitada." },
] as const;

export function JanelaNovaReserva({ aberta, inicial, aoFechar, aoCriar }: { aberta: boolean; inicial: SelecaoInicial; aoFechar: () => void; aoCriar: (r: Reserva) => void }) {
  const { arenaSlug, arena } = usePainel();
  const { quadras: quadrasArena, precos } = useArena(arenaSlug);
  const catalogo = useQuadrasCatalogo();
  const [quadraId, setQuadraId] = useState(inicial.quadraId ?? catalogo[0]?.id ?? "");
  const [data, setData] = useState(inicial.data && inicial.data >= getHoje() ? inicial.data : getHoje());
  const [horarios, setHorarios] = useState<string[]>(inicial.horario ? [inicial.horario] : []);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [esporte, setEsporte] = useState("");
  const [pagamento, setPagamento] = useState<(typeof PAGAMENTOS)[number]["id"]>("nada");
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [valorCombinado, setValorCombinado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const quadra = quadrasArena.find((q) => q.id === quadraId);
  const valorTabela = useMemo(
    () => (quadra && horarios.length > 0 ? calcularPrecoReserva({ quadra, precos, data, horarios, percentualSinal: arena.percentualSinalMinimo }).valorTotal : 0),
    [quadra, precos, data, horarios, arena.percentualSinalMinimo]
  );
  const total = valorCombinado.trim() ? Number(valorCombinado.replace(",", ".")) : valorTabela;
  const sinal = Math.round(total * (arena.percentualSinalMinimo / 100) * 100) / 100;

  async function salvar() {
    setErro(null);
    if (horarios.length === 0) return setErro("Escolha o horário.");
    if (nome.trim().length < 2) return setErro("Informe o nome do cliente.");
    const digitos = whatsapp.replace(/\D/g, "");
    if (digitos && digitos.length < 10) return setErro("WhatsApp incompleto: use DDD + número.");
    if (pagamento !== "nada" && !forma) return setErro("Diga como o cliente pagou.");
    if (valorCombinado.trim() && !(Number.isFinite(total) && total >= 0)) return setErro("Valor combinado inválido.");
    setEnviando(true);
    const r = await chamarApi<{ reserva: Reserva }>("/api/admin/reservas", {
      method: "POST",
      corpo: {
        arenaSlug,
        quadraId,
        data,
        horarios,
        nomeCliente: nome.trim(),
        whatsappCliente: digitos,
        esporte: esporte || undefined,
        observacoes: observacoes.trim() || undefined,
        pagamento,
        forma: forma || undefined,
        valorCombinado: valorCombinado.trim() ? total : undefined,
      },
    });
    setEnviando(false);
    if (!r.ok || !r.dados?.reserva) return setErro(r.erro ?? "Não foi possível salvar a reserva.");
    useReservasStore.getState().mesclarReservas([r.dados.reserva]);
    aoCriar(r.dados.reserva);
  }

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      largura="lg"
      titulo="Nova reserva"
      descricao="Reserva feita no balcão ou por telefone. Aparece na agenda e no site na hora."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} carregando={enviando}>Salvar reserva</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <CamposQuadraData
          quadraId={quadraId}
          data={data}
          aoMudarQuadra={(id) => {
            setQuadraId(id);
            setHorarios([]);
          }}
          aoMudarData={(d) => {
            setData(d);
            setHorarios([]);
          }}
        />
        <SeletorHorarios data={data} quadraId={quadraId} escolhidos={horarios} aoMudar={setHorarios} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do cliente">
            {(id) => <Entrada id={id} value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} />}
          </Campo>
          <Campo rotulo="WhatsApp" opcional ajuda="Se o cliente tiver conta no site, a reserva aparece para ele.">
            {(id) => <Entrada id={id} inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(mascaraWhatsApp(e.target.value))} placeholder="(91) 99999-9999" />}
          </Campo>
          <Campo rotulo="Esporte" opcional>
            {(id) => (
              <Selecao id={id} value={esporte} onChange={(e) => setEsporte(e.target.value)}>
                <option value="">Não informar</option>
                {ESPORTES.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Valor combinado (R$)" opcional ajuda={horarios.length > 0 ? `Tabela da quadra: ${moeda(valorTabela)}. Deixe vazio para usar a tabela.` : "Escolha o horário para ver o valor da tabela."}>
            {(id) => <Entrada id={id} inputMode="decimal" value={valorCombinado} onChange={(e) => setValorCombinado(e.target.value)} placeholder={valorTabela ? valorTabela.toFixed(2) : ""} />}
          </Campo>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium text-painel-tinta">
            Pagamento {horarios.length > 0 && <span className="font-normal text-painel-suave">· total {moeda(total)} · sinal {moeda(sinal)}</span>}
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PAGAMENTOS.map((p) => (
              <OpcaoCartao key={p.id} name="pagamento" rotulo={p.rotulo} descricao={p.descricao} checked={pagamento === p.id} onChange={() => setPagamento(p.id)} />
            ))}
          </div>
          {pagamento !== "nada" && (
            <Campo rotulo="Como pagou?">
              {(id) => (
                <Selecao id={id} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
                  <option value="">Escolha</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                </Selecao>
              )}
            </Campo>
          )}
        </fieldset>

        <Campo rotulo="Observações" opcional>
          {(id) => <AreaTexto id={id} value={observacoes} maxLength={500} onChange={(e) => setObservacoes(e.target.value)} className="min-h-16" />}
        </Campo>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

// ─── Bloqueio de horário ─────────────────────────────────────────────────────

export function JanelaBloqueio({ aberta, inicial, aoFechar, aoBloquear }: { aberta: boolean; inicial: SelecaoInicial; aoFechar: () => void; aoBloquear: () => void }) {
  const catalogo = useQuadrasCatalogo();
  const { criarBloqueio } = useReservasService();
  const [quadraId, setQuadraId] = useState(inicial.quadraId ?? catalogo[0]?.id ?? "");
  const [data, setData] = useState(inicial.data && inicial.data >= getHoje() ? inicial.data : getHoje());
  const [horarios, setHorarios] = useState<string[]>(inicial.horario ? [inicial.horario] : []);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_BLOQUEIO_SUGERIDOS[0]);
  const [detalhe, setDetalhe] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setErro(null);
    if (horarios.length === 0) return setErro("Escolha o horário.");
    setEnviando(true);
    const r = await criarBloqueio({ quadraId, data, horarios, motivo, observacoes: detalhe.trim() || undefined });
    setEnviando(false);
    if (!r.ok) return setErro(r.motivo ?? "Não foi possível bloquear.");
    aoBloquear();
  }

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Bloquear horário"
      descricao="O horário some do site e ninguém consegue reservar. Use para manutenção ou evento."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} carregando={enviando}>Bloquear</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <CamposQuadraData
          quadraId={quadraId}
          data={data}
          aoMudarQuadra={(id) => {
            setQuadraId(id);
            setHorarios([]);
          }}
          aoMudarData={(d) => {
            setData(d);
            setHorarios([]);
          }}
        />
        <SeletorHorarios data={data} quadraId={quadraId} escolhidos={horarios} aoMudar={setHorarios} />
        <Campo rotulo="Motivo">
          {(id) => (
            <Selecao id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS_BLOQUEIO_SUGERIDOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Detalhe" opcional>
          {(id) => <Entrada id={id} value={detalhe} maxLength={200} onChange={(e) => setDetalhe(e.target.value)} />}
        </Campo>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}
