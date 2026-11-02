/**
 * @file AvisoHorasGratis.tsx
 * @description Aviso da tela Hoje: horas grátis do Clube esperando o dono (ou gerente) liberar ou
 * recusar, com atalho para a fila da tela Fidelidade. Não aparece quando não há pedido.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §10
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, classeBotao } from "@/components/admin/ui";
import { contarHorasGratisEmAnalise } from "@/lib/supabase/fidelidadeService";

/**
 * @param props.contar Fonte da contagem (troca nos testes)
 *
 * @example
 * ```tsx
 * {pode("analisar_voucher") && <AvisoHorasGratis />}
 * ```
 */
export function AvisoHorasGratis({ contar = contarHorasGratisEmAnalise }: { contar?: () => Promise<number> }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let ativo = true;
    contar().then((n) => ativo && setTotal(n));
    return () => {
      ativo = false;
    };
  }, [contar]);

  if (total === 0) return null;
  return (
    <Aviso
      tom="atencao"
      titulo={total === 1 ? "1 hora grátis do Clube para liberar" : `${total} horas grátis do Clube para liberar`}
      acoes={
        <Link href="/admin/fidelidade" className={classeBotao("secundario", "sm")}>
          Ver pedidos
        </Link>
      }
    >
      Atletas bateram a meta. Eles só veem a hora grátis depois que você liberar.
    </Aviso>
  );
}
