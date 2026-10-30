/**
 * @file formatos.ts
 * @description Textos do portal: dinheiro, horas, datas por extenso, plurais, nomes e tempo relativo.
 * Mesmas regras do protótipo aprovado, para os textos saírem idênticos.
 */

export const SEM_CURTA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const SEM = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MES_CURTO = MES.map((m) => m.slice(0, 3));

/**
 * Data ISO como objeto Date ao meio-dia (evita troca de dia por fuso).
 *
 * @example
 * ```ts
 * paraData("2026-10-30").getDay(); // 5 (sexta)
 * ```
 */
export function paraData(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

/** Date → 'AAAA-MM-DD' (no fuso local). */
export function paraISO(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Soma dias a uma data ISO. */
export function somarDias(iso: string, n: number): string {
  const dt = paraData(iso);
  dt.setDate(dt.getDate() + n);
  return paraISO(dt);
}

/** Dias inteiros entre duas datas ISO (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((paraData(b).getTime() - paraData(a).getTime()) / 86_400_000);
}

/** Hora cheia 'HH:00' (ex.: 7 → "07:00"). */
export const hh = (h: number): string => `${String(h).padStart(2, "0")}:00`;

/** Hora de 'HH:mm' como número (ex.: "19:00" → 19). */
export const horaDe = (hora: string): number => Number(hora.split(":")[0]);

/**
 * Valor em reais sem centavos quando inteiro (ex.: 100 → "R$ 100"; 82.5 → "R$ 82,50").
 */
export function reais(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Primeira letra maiúscula. */
export const maiuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** "a, b e c". */
export function lista(itens: string[]): string {
  return itens.length < 2 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** "1 hora" / "2 horas". */
export const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/**
 * Nome do esporte para exibir (ex.: "Beach Tennis" → "Beach tennis", "Futebol Society" → "Futebol society").
 */
export const rotuloEsporte = (esporte: string): string => maiuscula(esporte.toLowerCase());

/**
 * Esporte dentro de uma frase: minúsculo, mas siglas e nomes próprios ficam (ex.: "Beach tennis" →
 * "beach tennis"; "CT Falcão 12" continua "CT Falcão 12").
 */
export function esporteNaFrase(esporte: string): string {
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(esporte) ? esporte.charAt(0).toLowerCase() + esporte.slice(1) : esporte;
}

/** "Hoje" ou "Amanhã" (ou null). */
export function relativo(iso: string, hoje: string): string | null {
  if (iso === hoje) return "Hoje";
  if (iso === somarDias(hoje, 1)) return "Amanhã";
  return null;
}

/** "Hoje, sexta-feira, 30 de outubro" ou "Sábado, 31 de outubro". */
export function diaLongo(iso: string, hoje: string): string {
  const d = paraData(iso);
  const base = `${SEM[d.getDay()]}, ${d.getDate()} de ${MES[d.getMonth()]}`;
  const rel = relativo(iso, hoje);
  return rel ? `${rel}, ${base}` : maiuscula(base);
}

/** "Hoje, 30 de out" ou "Sáb, 31 de out". */
export function diaCurto(iso: string, hoje: string): string {
  const d = paraData(iso);
  return `${relativo(iso, hoje) ?? SEM_CURTA[d.getDay()]}, ${d.getDate()} de ${MES_CURTO[d.getMonth()]}`;
}

/** "31 de outubro". */
export function dataLonga(iso: string): string {
  const d = paraData(iso);
  return `${d.getDate()} de ${MES[d.getMonth()]}`;
}

/** "12 de março de 1994". */
export function dataNascimento(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} de ${MES[m - 1]} de ${a}`;
}

/** "31/10". */
export function diaMes(iso: string): string {
  const d = paraData(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Nome com iniciais maiúsculas, mantendo "de", "da", "dos" e "e" minúsculos.
 *
 * @example
 * ```ts
 * nomeProprio("marina   de souza"); // "Marina de Souza"
 * ```
 */
export function nomeProprio(t: string): string {
  return t
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && /^(d[aeo]s?|e)$/i.test(p) ? p.toLowerCase() : maiuscula(p.toLowerCase())))
    .join(" ");
}

/** Primeiro nome com inicial maiúscula. */
export const primeiroNome = (nome: string): string => maiuscula(nome.trim().split(/\s+/)[0] ?? "");

/** 'HH:mm' → "7h" / "7h30". */
export function horaCurta(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "Todos os dias, das 7h às 23h". */
export function funcionamento(abertura: string, fechamento: string): string {
  return `Todos os dias, das ${horaCurta(abertura)} às ${horaCurta(fechamento)}`;
}

/**
 * Tempo desde a publicação, em dias de calendário: "hoje", "ontem", "há 3 dias", "há 2 semanas".
 *
 * @param iso Data ISO da publicação (só a data conta)
 * @param hoje Data ISO de hoje no fuso da arena
 */
export function haQuanto(iso: string, hoje: string): string {
  const dias = Math.max(0, diasEntre(iso, hoje));
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) return `há ${plural(Math.floor(dias / 7), "semana", "semanas")}`;
  if (dias < 365) return `há ${plural(Math.floor(dias / 30), "mês", "meses")}`;
  return `há ${plural(Math.floor(dias / 365), "ano", "anos")}`;
}

/**
 * Tempo desde um pedido: "há 2 horas", "ontem", "há 3 dias".
 *
 * @param instante ISO do pedido
 * @param agora Instante atual
 */
export function haQuantoTempo(instante: string, agora: Date): string {
  const minutos = Math.max(0, Math.floor((agora.getTime() - new Date(instante).getTime()) / 60_000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${plural(minutos, "minuto", "minutos")}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${plural(horas, "hora", "horas")}`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** Máscara do WhatsApp enquanto digita: "(91) 98498-2865". */
export function mascaraWhats(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (!n) return "";
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

/** Link do WhatsApp com mensagem pronta. */
export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Código curto da reserva mostrado ao atleta (ex.: "K7P2"), derivado do id. */
export function codigoReserva(id: string): string {
  const alfanumerico = id.replace(/[^a-z0-9]/gi, "");
  return alfanumerico.slice(-4).toUpperCase();
}
