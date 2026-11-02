"use client";

import { AdminUsuariosPage } from "@/components/admin/AdminUsuariosPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

export default function PaginaClientes() {
  const { arenaSlug, pode } = usePainel();
  return (
    <LegadoEscuro>
      <AdminUsuariosPage arenaSlug={arenaSlug} podeRedefinirSenha={pode("redefinir_senha_atleta")} />
    </LegadoEscuro>
  );
}
