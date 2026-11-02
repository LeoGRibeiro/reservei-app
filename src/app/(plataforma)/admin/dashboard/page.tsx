import { permanentRedirect } from "next/navigation";

/** Endereço antigo do painel: a tela "Hoje" fica em /admin. */
export default function PaginaDashboardAntiga() {
  permanentRedirect("/admin");
}
