/**
 * @file gotrue.mjs
 * @description Subconjunto do Supabase Auth (GoTrue) para testes locais: usuários em `auth.users`
 * do PGlite, login por senha, refresh, verify por token_hash (generateLink), getUser e a API admin.
 * Os JWTs são assinados com HS256 e um segredo fixo de teste.
 */

import { createHmac, randomBytes, randomUUID, createHash } from "node:crypto";

export const SEGREDO_JWT = "segredo-local-somente-para-testes-automatizados";
const DURACAO_S = 3600;

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

/** Assina um JWT HS256. */
export function assinarJwt(payload) {
  const corpo = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  const assinatura = createHmac("sha256", SEGREDO_JWT).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

/** Chaves anon e service_role do ambiente local (válidas por 10 anos). */
export const CHAVES = {
  anon: assinarJwt({ role: "anon", iss: "supabase-local", iat: 1_700_000_000, exp: 2_000_000_000 }),
  servico: assinarJwt({ role: "service_role", iss: "supabase-local", iat: 1_700_000_000, exp: 2_000_000_000 }),
};

/** Lê as claims de um JWT, ou null. */
function lerJwt(token) {
  try {
    const [cab, corpo, assinatura] = token.split(".");
    const esperada = createHmac("sha256", SEGREDO_JWT).update(`${cab}.${corpo}`).digest("base64url");
    if (assinatura !== esperada) return null;
    const claims = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    return claims.exp * 1000 > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

/** Formata a linha de `auth.users` como o objeto `User` do GoTrue. */
function usuarioJson(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    phone: u.phone ?? "",
    email_confirmed_at: u.email_confirmed_at,
    confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: { provider: "email", providers: ["email"], ...(u.raw_app_meta_data ?? {}) },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    is_anonymous: false,
  };
}

/**
 * Cria o roteador de Auth sobre o banco.
 *
 * @param {import("@electric-sql/pglite").PGlite} db Banco com `auth.users`
 */
export function criarAuth(db) {
  /** refresh_token -> id do usuário */
  const refreshTokens = new Map();
  /** hashed_token -> email (links gerados pela API admin, uso único) */
  const links = new Map();

  const buscarPorEmail = async (email) =>
    (await db.query("SELECT * FROM auth.users WHERE lower(email) = lower($1::text)", [email])).rows[0] ?? null;
  const buscarPorId = async (id) =>
    (await db.query("SELECT * FROM auth.users WHERE id = $1::text::uuid", [id])).rows[0] ?? null;

  async function sessao(usuario) {
    await db.query("UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1::text::uuid", [usuario.id]);
    const u = await buscarPorId(usuario.id);
    const agora = Math.floor(Date.now() / 1000);
    const access = assinarJwt({
      sub: u.id,
      role: "authenticated",
      aud: "authenticated",
      email: u.email,
      iat: agora,
      exp: agora + DURACAO_S,
      session_id: randomUUID(),
      app_metadata: usuarioJson(u).app_metadata,
      user_metadata: u.raw_user_meta_data ?? {},
    });
    const refresh = randomBytes(16).toString("hex");
    refreshTokens.set(refresh, u.id);
    return {
      access_token: access,
      token_type: "bearer",
      expires_in: DURACAO_S,
      expires_at: agora + DURACAO_S,
      refresh_token: refresh,
      user: usuarioJson(u),
    };
  }

  const erro = (status, code, msg) => ({ status, corpo: { code, error_code: code, msg, message: msg, error: code, error_description: msg } });

  /**
   * Atende `/auth/v1/<caminho>`.
   *
   * @returns {Promise<{ status: number, corpo: unknown }>}
   */
  return async function auth({ metodo, caminho, busca, cabecalhos, corpo }) {
    const token = cabecalhos.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const claims = lerJwt(token);
    const admin = claims?.role === "service_role";
    const c = corpo ?? {};

    if (caminho === "token" && metodo === "POST") {
      const tipo = busca.get("grant_type");
      if (tipo === "password") {
        const u = c.email ? await buscarPorEmail(c.email) : null;
        if (!u || u.encrypted_password !== c.password) return erro(400, "invalid_credentials", "Invalid login credentials");
        return { status: 200, corpo: await sessao(u) };
      }
      if (tipo === "refresh_token") {
        const id = refreshTokens.get(c.refresh_token);
        if (!id) return erro(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        refreshTokens.delete(c.refresh_token);
        return { status: 200, corpo: await sessao(await buscarPorId(id)) };
      }
      return erro(400, "unsupported_grant_type", "Unsupported grant type");
    }

    if (caminho === "verify" && metodo === "POST") {
      const email = links.get(c.token_hash);
      if (!email) return erro(403, "otp_expired", "Email link is invalid or has expired");
      links.delete(c.token_hash);
      return { status: 200, corpo: await sessao(await buscarPorEmail(email)) };
    }

    if (caminho === "user") {
      if (!claims?.sub) return erro(401, "bad_jwt", "invalid JWT");
      const u = await buscarPorId(claims.sub);
      if (!u) return erro(404, "user_not_found", "User not found");
      if (metodo === "PUT") {
        if (c.password) await db.query("UPDATE auth.users SET encrypted_password = $1::text WHERE id = $2::text::uuid", [c.password, u.id]);
        if (c.data) {
          await db.query("UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $1::text::jsonb WHERE id = $2::text::uuid",
            [JSON.stringify(c.data), u.id]);
        }
      }
      return { status: 200, corpo: usuarioJson(await buscarPorId(u.id)) };
    }

    if (caminho === "logout") return { status: 204, corpo: null };
    if (caminho === "recover") return { status: 200, corpo: {} };

    if (caminho.startsWith("admin/")) {
      if (!admin) return erro(403, "not_admin", "User not allowed");
      const [, recurso, id] = caminho.split("/");

      if (recurso === "users" && metodo === "POST") {
        if (c.email && (await buscarPorEmail(c.email))) {
          return erro(422, "email_exists", "A user with this email address has already been registered");
        }
        const { rows } = await db.query(
          `INSERT INTO auth.users (email, phone, encrypted_password, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
           VALUES ($1::text, $2::text, $3::text, $4::text::jsonb, $5::text::jsonb, CASE WHEN $6::text = 'true' THEN NOW() END)
           RETURNING *`,
          [c.email ?? null, c.phone ?? null, c.password ?? randomUUID(), JSON.stringify(c.user_metadata ?? {}),
            JSON.stringify(c.app_metadata ?? {}), String(Boolean(c.email_confirm))]
        );
        return { status: 200, corpo: usuarioJson(rows[0]) };
      }
      if (recurso === "users" && id && metodo === "GET") {
        const u = await buscarPorId(id);
        return u ? { status: 200, corpo: usuarioJson(u) } : erro(404, "user_not_found", "User not found");
      }
      if (recurso === "users" && !id && metodo === "GET") {
        const { rows } = await db.query("SELECT * FROM auth.users ORDER BY created_at");
        return { status: 200, corpo: { users: rows.map(usuarioJson), aud: "authenticated" } };
      }
      if (recurso === "users" && id && metodo === "PUT") {
        const u = await buscarPorId(id);
        if (!u) return erro(404, "user_not_found", "User not found");
        await db.query(
          `UPDATE auth.users SET
             encrypted_password = COALESCE($1::text, encrypted_password),
             email = COALESCE($2::text, email),
             raw_user_meta_data = raw_user_meta_data || COALESCE($3::text::jsonb, '{}'::jsonb),
             raw_app_meta_data = raw_app_meta_data || COALESCE($4::text::jsonb, '{}'::jsonb),
             updated_at = NOW()
           WHERE id = $5::text::uuid`,
          [c.password ?? null, c.email ?? null, c.user_metadata ? JSON.stringify(c.user_metadata) : null,
            c.app_metadata ? JSON.stringify(c.app_metadata) : null, id]
        );
        return { status: 200, corpo: usuarioJson(await buscarPorId(id)) };
      }
      if (recurso === "users" && id && metodo === "DELETE") {
        await db.query("DELETE FROM auth.users WHERE id = $1::text::uuid", [id]);
        return { status: 200, corpo: {} };
      }
      if (recurso === "generate_link" && metodo === "POST") {
        const u = await buscarPorEmail(c.email);
        if (!u) return erro(404, "user_not_found", "User not found");
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const hashed = createHash("sha256").update(`${c.email}${otp}${Date.now()}`).digest("hex");
        links.set(hashed, u.email);
        return {
          status: 200,
          corpo: {
            ...usuarioJson(u),
            action_link: `http://localhost/auth/v1/verify?token=${hashed}&type=${c.type}`,
            email_otp: otp,
            hashed_token: hashed,
            redirect_to: "",
            verification_type: c.type === "magiclink" ? "magiclink" : c.type,
          },
        };
      }
    }

    return erro(404, "not_found", `Rota de auth não suportada: ${metodo} ${caminho}`);
  };
}
