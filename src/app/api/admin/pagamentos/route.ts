/**
 * @file route.ts
 * @description Configuração de recebimento da arena (somente proprietário).
 *
 * - GET  /api/admin/pagamentos?arena=<slug>                                      -> { sucesso, resumo }
 * - POST /api/admin/pagamentos { arenaSlug, acao: "salvar_pix", chave, tipoChave, nomeRecebedor, cidadeRecebedor }
 * - POST /api/admin/pagamentos { arenaSlug, acao: "definir_modo", modo }
 * - POST /api/admin/pagamentos { arenaSlug, acao: "conectar_asaas", apiKey }
 * - POST /api/admin/pagamentos { arenaSlug, acao: "desconectar_asaas" }
 * Todas as respostas de POST devolvem o resumo atualizado. Chaves de API nunca voltam ao navegador.
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import {
  definirModoPagamento,
  obterResumoPagamentos,
  salvarPixManual,
  validarPixManual,
} from "@/lib/pagamento/configuracaoPagamentoServidorService";
import { conectarAsaas, desconectarAsaas, validarChaveAsaas } from "@/lib/pagamento/asaasContaService";
import { criptografiaConfigurada, ErroCredencial } from "@/lib/pagamento/criptografiaCredenciais";

export const dynamic = "force-dynamic";

/** Resumo de recebimento da arena. */
export async function GET(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const membro = await exigirMembroArena(
      request,
      request.nextUrl.searchParams.get("arena") ?? "",
      "configurar_pagamentos"
    );
    return NextResponse.json({ sucesso: true, resumo: await obterResumoPagamentos(membro.arenaId) });
  } catch (err) {
    return responderErro(err, "pagamentos:resumo");
  }
}

/** Altera a configuração de recebimento. */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""), "configurar_pagamentos");

    switch (corpo.acao) {
      case "salvar_pix":
        await salvarPixManual(membro, validarPixManual(corpo));
        break;
      case "definir_modo":
        await definirModoPagamento(membro, corpo.modo);
        break;
      case "conectar_asaas": {
        if (!criptografiaConfigurada()) {
          throw new ErroHttp("O servidor ainda não está pronto para guardar chaves de pagamento. Fale com o suporte.", 503);
        }
        await conectarAsaas(membro, validarChaveAsaas(corpo.apiKey), request.nextUrl.origin);
        break;
      }
      case "desconectar_asaas":
        await desconectarAsaas(membro);
        break;
      default:
        throw new ErroHttp("Ação inválida.", 400);
    }

    return NextResponse.json({ sucesso: true, resumo: await obterResumoPagamentos(membro.arenaId) });
  } catch (err) {
    if (err instanceof ErroCredencial) {
      console.error("[API pagamentos] Falha de credencial:", err.message);
      return NextResponse.json(
        { sucesso: false, erro: "Não foi possível acessar a credencial salva. Conecte o Asaas novamente." },
        { status: 500 }
      );
    }
    return responderErro(err, "pagamentos");
  }
}
