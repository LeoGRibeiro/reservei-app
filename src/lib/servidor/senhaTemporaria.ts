/**
 * @file senhaTemporaria.ts
 * @description Geração de senhas temporárias legíveis (somente servidor), usadas em convites de equipe e
 * redefinições assistidas. A pessoa é obrigada a trocá-la no primeiro acesso.
 */

import { randomInt } from "node:crypto";

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I), já que a senha é ditada ou lida no WhatsApp. */
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Gera uma senha temporária aleatória criptograficamente segura.
 *
 * @param tamanho Quantidade de caracteres (padrão 10, mínimo 8)
 * @returns Senha com letras e números
 *
 * @example
 * ```ts
 * gerarSenhaTemporaria(); // "Kp7mWx3qRt"
 * ```
 */
export function gerarSenhaTemporaria(tamanho = 10): string {
  const n = Math.max(8, tamanho);
  let senha = "";
  for (let i = 0; i < n; i++) senha += ALFABETO[randomInt(ALFABETO.length)];
  // Garante ao menos um dígito (exigência das regras de senha forte)
  if (!/\d/.test(senha)) senha = senha.slice(0, -1) + String(randomInt(2, 10));
  return senha;
}
