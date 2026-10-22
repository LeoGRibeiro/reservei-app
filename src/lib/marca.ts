/**
 * @file marca.ts
 * @description Identidade da plataforma (não da arena). Trocar o nome do produto = alterar este arquivo
 * e o domínio (`NEXT_PUBLIC_ROOT_DOMAIN`). Telas voltadas ao atleta usam o nome da arena
 * (`useConfiguracaoSiteArena`), nunca estas constantes.
 *
 * Atenção: o domínio do e-mail sintético dos atletas (`DOMINIO_EMAIL_SINTETICO` em
 * `lib/supabase/authService.ts`) é identidade de login e NÃO acompanha mudanças de marca.
 */

/** Nome comercial da plataforma. */
export const NOME_PRODUTO = "Reservei";

/** Frase curta de posicionamento usada na página comercial e em metadados. */
export const SLOGAN_PRODUTO = "Gestão e reservas online para arenas esportivas";

/**
 * WhatsApp comercial do fundador (somente dígitos com DDI), usado na página comercial.
 * Configurável por `NEXT_PUBLIC_WHATSAPP_COMERCIAL`.
 */
export const WHATSAPP_COMERCIAL = (process.env.NEXT_PUBLIC_WHATSAPP_COMERCIAL || "").replace(/\D/g, "");
