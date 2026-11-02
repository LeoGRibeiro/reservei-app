/**
 * @file PaginaClientes.tsx
 * @description Clientes da arena (`/admin/clientes`): todo mundo que já reservou, com ou sem conta no
 * site, agrupado pelo WhatsApp. Busca, filtro por conta, ordem por última visita ou por quantidade de
 * reservas. A ficha do cliente mostra as reservas, abre o WhatsApp e (gerente ou dono) bloqueia ou
 * libera o cliente NESTA arena e gera senha temporária para quem tem conta.
 *
 * A conta do atleta é dele e vale em todas as arenas: o painel não edita nem exclui a conta (o próprio
 * atleta faz isso no site).
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano F, tela Clientes)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Users } from "lucide-react";
import {
  Aviso,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Carregando,
  Confirmacao,
  Entrada,
  EstadoVazio,
  Etiqueta,
  Janela,
  Paginacao,
  Selecao,
  StatusReserva,
  Tabela,
  Td,
  Tr,
  classeBotao,
} from "@/components/admin/ui";
import { usePainel } from "@/components/admin/painel/ContextoPainel";
import { listarClientesDaArena, listarReservasDoCliente, type ClienteArena } from "@/lib/supabase/painelRepository";
import { chamarApi } from "@/lib/api/clienteApi";
import { dataCurta, dataHora, linkWhatsApp, moeda, telefone } from "@/lib/admin/formatos";
import { hrefReserva } from "@/lib/admin/navegacao";
import { descreverQuadra, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import type { Reserva } from "@/store/useReservasStore";

const POR_PAGINA = 50;
type Filtro = "todos" | "com_conta" | "sem_conta" | "bloqueados";
type Ordem = "recentes" | "mais_reservas" | "nome";

/**
 * Filtra e ordena os clientes.
 *
 * @param clientes Lista completa
 * @param busca Nome (inclusive nomes antigos) ou parte do WhatsApp
 */
export function filtrarClientes(clientes: ClienteArena[], busca: string, filtro: Filtro, ordem: Ordem): ClienteArena[] {
  const termo = busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  const lista = clientes.filter((c) => {
    if (filtro === "com_conta" && !c.usuarioId) return false;
    if (filtro === "sem_conta" && c.usuarioId) return false;
    if (filtro === "bloqueados" && !c.bloqueado) return false;
    if (!termo) return true;
    if (digitos.length >= 4 && c.telefone.includes(digitos)) return true;
    return [c.nome, ...c.outrosNomes].some((n) => n.toLowerCase().includes(termo));
  });
  const ultima = (c: ClienteArena) => c.proximaData ?? c.ultimaData ?? "";
  return lista.sort((a, b) =>
    ordem === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : ordem === "mais_reservas" ? b.reservas - a.reservas : ultima(b).localeCompare(ultima(a))
  );
}

function FichaCliente({ cliente, aoFechar, aoMudar }: { cliente: ClienteArena; aoFechar: () => void; aoMudar: () => void }) {
  const { arenaSlug, pode } = usePainel();
  const quadras = useQuadrasCatalogo();
  const [reservas, setReservas] = useState<Reserva[] | null>(null);
  const [bloqueando, setBloqueando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [liberando, setLiberando] = useState(false);
  const [senha, setSenha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    listarReservasDoCliente(cliente.telefone)
      .then((l) => ativo && setReservas(l))
      .catch(() => ativo && setReservas([]));
    return () => {
      ativo = false;
    };
  }, [cliente.telefone]);

  async function acao(corpo: Record<string, unknown>, sucesso: string): Promise<void> {
    setOcupado(true);
    const r = await chamarApi("/api/admin/clientes", { method: "POST", corpo: { arenaSlug, telefone: cliente.telefone, ...corpo } });
    setOcupado(false);
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    toast.success(sucesso);
    setBloqueando(false);
    setLiberando(false);
    aoMudar();
  }

  async function gerarSenha(): Promise<void> {
    if (!cliente.usuarioId) return;
    setOcupado(true);
    const r = await chamarApi<{ acesso: { senhaTemporaria: string } }>("/api/admin/atletas/senha", { method: "POST", corpo: { arenaSlug, usuarioId: cliente.usuarioId } });
    setOcupado(false);
    if (!r.ok || !r.dados) {
      toast.error(r.erro);
      return;
    }
    setSenha(r.dados.acesso.senhaTemporaria);
  }

  return (
    <Janela aberta titulo={cliente.nome} descricao={telefone(cliente.telefone)} aoFechar={aoFechar} largura="lg">
      <div className="space-y-4">
        {cliente.bloqueado && (
          <Aviso tom="erro" titulo="Bloqueado nesta arena">
            {cliente.bloqueado.motivo} · {dataHora(cliente.bloqueado.em)}
            {cliente.bloqueado.por ? ` · ${cliente.bloqueado.por}` : ""}
          </Aviso>
        )}
        <div className="flex flex-wrap gap-2">
          <a className={classeBotao("secundario", "sm")} href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp
          </a>
          {pode("redefinir_senha_atleta") && cliente.usuarioId && (
            <Botao variante="secundario" tamanho="sm" onClick={gerarSenha} carregando={ocupado}>
              Gerar senha temporária
            </Botao>
          )}
          {pode("bloquear_cliente") &&
            (cliente.bloqueado ? (
              <Botao variante="secundario" tamanho="sm" onClick={() => setLiberando(true)}>
                Liberar cliente
              </Botao>
            ) : (
              <Botao variante="perigo" tamanho="sm" onClick={() => setBloqueando(true)}>
                Bloquear nesta arena
              </Botao>
            ))}
        </div>
        {senha && (
          <Aviso tom="sucesso" titulo="Senha temporária gerada">
            Passe para o cliente: <strong className="font-mono">{senha}</strong>. Ele troca no próximo acesso.
          </Aviso>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-painel-suave">Reservas</dt>
            <dd className="font-medium">{cliente.reservas}</dd>
          </div>
          <div>
            <dt className="text-painel-suave">Canceladas</dt>
            <dd className="font-medium">{cliente.canceladas}</dd>
          </div>
          <div>
            <dt className="text-painel-suave">Conta no site</dt>
            <dd className="font-medium">{cliente.usuarioId ? "Sim" : "Não"}</dd>
          </div>
          {pode("ver_receita") && (
            <div>
              <dt className="text-painel-suave">Total pago</dt>
              <dd className="font-medium">{moeda(cliente.totalGasto)}</dd>
            </div>
          )}
        </dl>
        {cliente.outrosNomes.length > 0 && <p className="text-sm text-painel-suave">Também reservou como: {cliente.outrosNomes.join(", ")}.</p>}
        <div className="rounded-lg border border-painel-linha">
          {!reservas ? (
            <Carregando />
          ) : reservas.length === 0 ? (
            <EstadoVazio titulo="Sem reservas" />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Tabela rotulo="Reservas do cliente" cabecalho={["Dia", "Quadra", "Situação"]}>
                {reservas.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap tabular-nums">
                      <Link href={hrefReserva(r.id)} className="hover:underline">
                        {dataCurta(r.data)} {r.horaInicio}
                      </Link>
                    </Td>
                    <Td>{descreverQuadra(r.quadraId, quadras)}</Td>
                    <Td>
                      <StatusReserva reserva={r} />
                      {r.naoCompareceu && <Etiqueta tom="cancelada" className="ml-1">Não compareceu</Etiqueta>}
                    </Td>
                  </tr>
                ))}
              </Tabela>
            </div>
          )}
        </div>
      </div>

      <Janela
        aberta={bloqueando}
        titulo="Bloquear nesta arena"
        descricao="O cliente não consegue mais reservar pelo site nesta arena. Outras arenas não são afetadas."
        largura="sm"
        aoFechar={() => setBloqueando(false)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setBloqueando(false)}>Voltar</Botao>
            <Botao variante="perigo" disabled={motivo.trim().length < 3} carregando={ocupado} onClick={() => acao({ acao: "bloquear", motivo: motivo.trim() }, "Cliente bloqueado nesta arena.")}>
              Bloquear
            </Botao>
          </>
        }
      >
        <Campo rotulo="Motivo" ajuda="Fica registrado para a equipe. O cliente vê só que precisa falar com a arena.">
          {(id) => <Entrada id={id} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: faltou 3 vezes sem avisar" />}
        </Campo>
      </Janela>
      <Confirmacao
        aberta={liberando}
        titulo="Liberar o cliente?"
        rotuloConfirmar="Liberar"
        variante="primario"
        aoFechar={() => setLiberando(false)}
        aoConfirmar={() => acao({ acao: "desbloquear" }, "Cliente liberado.")}
      >
        Ele volta a poder reservar pelo site nesta arena.
      </Confirmacao>
    </Janela>
  );
}

export function PaginaClientes() {
  const { pode } = usePainel();
  const [clientes, setClientes] = useState<ClienteArena[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<ClienteArena | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    listarClientesDaArena()
      .then((l) => {
        if (!ativo) return;
        setClientes(l);
        setErro(null);
        setAberto((atual) => (atual ? (l.find((c) => c.telefone === atual.telefone) ?? null) : null));
      })
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [versao]);

  const lista = useMemo(() => (clientes ? filtrarClientes(clientes, busca, filtro, ordem) : []), [clientes, busca, filtro, ordem]);
  const pagina_ = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Clientes" descricao="Todo mundo que já reservou, com ou sem conta no site, agrupado pelo WhatsApp." />
      {erro && <Aviso tom="erro" titulo="Não foi possível carregar os clientes">{erro}</Aviso>}
      <Cartao semPadding>
        <div className="flex flex-wrap gap-2 border-b border-painel-linha px-4 py-3">
          <Entrada aria-label="Buscar cliente" placeholder="Buscar por nome ou WhatsApp" value={busca} onChange={(e) => (setBusca(e.target.value), setPagina(1))} className="min-w-48 flex-1" />
          <Selecao aria-label="Filtro" className="w-auto" value={filtro} onChange={(e) => (setFiltro(e.target.value as Filtro), setPagina(1))}>
            <option value="todos">Todos</option>
            <option value="com_conta">Com conta no site</option>
            <option value="sem_conta">Só balcão (sem conta)</option>
            <option value="bloqueados">Bloqueados</option>
          </Selecao>
          <Selecao aria-label="Ordem" className="w-auto" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
            <option value="recentes">Mais recentes</option>
            <option value="mais_reservas">Mais reservas</option>
            <option value="nome">Nome</option>
          </Selecao>
        </div>
        {!clientes && !erro ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <EstadoVazio icone={Users} titulo={busca || filtro !== "todos" ? "Nenhum cliente com esses filtros" : "Ainda não há clientes"} />
        ) : (
          <>
            <Tabela
              rotulo="Clientes"
              cabecalho={["Nome", "WhatsApp", { rotulo: "Reservas", alinhar: "direita" }, "Última / próxima", ...(pode("ver_receita") ? [{ rotulo: "Total pago", alinhar: "direita" as const }] : []), ""]}
            >
              {pagina_.map((c) => (
                <Tr key={c.telefone} onClick={() => setAberto(c)}>
                  <Td>
                    <span className="font-medium">{c.nome}</span>
                    {c.outrosNomes.length > 0 && <span className="block text-xs text-painel-suave">também: {c.outrosNomes.slice(0, 2).join(", ")}</span>}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{telefone(c.telefone)}</Td>
                  <Td alinhar="direita" className="tabular-nums">{c.reservas}</Td>
                  <Td className="whitespace-nowrap text-painel-suave">
                    {c.ultimaData ? dataCurta(c.ultimaData) : "—"}
                    {c.proximaData && <span className="text-painel-tinta"> · próxima {dataCurta(c.proximaData)}</span>}
                  </Td>
                  {pode("ver_receita") && <Td alinhar="direita" className="tabular-nums">{moeda(c.totalGasto)}</Td>}
                  <Td alinhar="direita" className="whitespace-nowrap">
                    {c.bloqueado ? <Etiqueta tom="cancelada">Bloqueado</Etiqueta> : c.usuarioId ? <Etiqueta>Tem conta</Etiqueta> : null}
                  </Td>
                </Tr>
              ))}
            </Tabela>
            <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={lista.length} aoMudar={setPagina} />
          </>
        )}
      </Cartao>
      {aberto && <FichaCliente cliente={aberto} aoFechar={() => setAberto(null)} aoMudar={() => setVersao((v) => v + 1)} />}
    </div>
  );
}
