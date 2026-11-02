// @vitest-environment node
/**
 * @file storageLocal.test.ts
 * @description Envio de foto pelo painel (bucket `institucional`) contra o Supabase local, com as
 * policies reais de `storage.objects`: o dono envia e a foto fica pública; visitante não envia;
 * tamanho (5 MB) e tipo (só imagem) do bucket valem. O Supabase local não tinha Storage, e todo
 * envio de foto no localhost falhava com "Rota não suportada".
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8.2 e §9.3
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// @ts-expect-error módulo JS de infraestrutura de teste (sem tipos)
import { iniciarSupabaseLocal } from "../../supabase-local/servidor.mjs";
// @ts-expect-error módulo JS de infraestrutura de teste (sem tipos)
import { RAIZ_SRC } from "../../supabase-local/banco.mjs";
// @ts-expect-error módulo JS de infraestrutura de teste (sem tipos)
import { extrairArquivoMultipart } from "../../supabase-local/storage.mjs";
import { join } from "node:path";

let local: { url: string; chaves: { anon: string; servico: string }; fechar: () => Promise<void> };
let dono: SupabaseClient;
let visitante: SupabaseClient;

const imagem = (bytes: number, tipo = "image/png") => new Blob([new Uint8Array(bytes).fill(7)], { type: tipo });

beforeAll(async () => {
  local = await iniciarSupabaseLocal({ porta: 54372, seeds: [join(RAIZ_SRC, "lib", "supabase", "seed-arena-belem.sql")] });
  const admin = createClient(local.url, local.chaves.servico, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.createUser({ email: "dono@storage.local", password: "senha-123456", email_confirm: true });
  await admin.from("arena_usuarios").insert({ arena_id: "arena-belem", user_id: data.user!.id, role: "proprietario", ativo: true });
  dono = createClient(local.url, local.chaves.anon, { auth: { persistSession: false } });
  await dono.auth.signInWithPassword({ email: "dono@storage.local", password: "senha-123456" });
  visitante = createClient(local.url, local.chaves.anon, { auth: { persistSession: false } });
}, 120_000);

afterAll(async () => {
  await local?.fechar();
});

describe("Storage local (bucket institucional)", () => {
  it("o dono envia a foto e ela fica pública no endereço do getPublicUrl", async () => {
    const { error } = await dono.storage.from("institucional").upload("arena-belem/quadras/teste.png", imagem(1024));
    expect(error).toBeNull();
    const { data } = dono.storage.from("institucional").getPublicUrl("arena-belem/quadras/teste.png");
    const resposta = await fetch(data.publicUrl);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/png");
    expect((await resposta.arrayBuffer()).byteLength).toBe(1024);
  });

  it("visitante não envia (policy do banco)", async () => {
    const { error } = await visitante.storage.from("institucional").upload("arena-belem/galeria/intruso.png", imagem(10));
    expect(error?.message).toMatch(/row-level security/);
  });

  it("recusa arquivo acima de 5 MB e o que não é imagem", async () => {
    const grande = await dono.storage.from("institucional").upload("arena-belem/galeria/grande.png", imagem(5 * 1024 * 1024 + 1));
    expect(grande.error?.message).toMatch(/maximum allowed size/);
    const pdf = await dono.storage.from("institucional").upload("arena-belem/galeria/doc.pdf", imagem(10, "application/pdf"));
    expect(pdf.error?.message).toMatch(/not supported/);
  });

  it("não sobrescreve sem upsert", async () => {
    await dono.storage.from("institucional").upload("arena-belem/galeria/uma.png", imagem(5));
    const repetida = await dono.storage.from("institucional").upload("arena-belem/galeria/uma.png", imagem(5));
    expect(repetida.error?.message).toMatch(/already exists/);
  });
});

describe("extrairArquivoMultipart", () => {
  it("acha a parte do arquivo e o tipo", () => {
    const corpo = Buffer.from(
      '--XyZ\r\nContent-Disposition: form-data; name="cacheControl"\r\n\r\n3600\r\n' +
        '--XyZ\r\nContent-Disposition: form-data; name=""; filename="blob"\r\nContent-Type: image/webp\r\n\r\nABC\r\n--XyZ--\r\n'
    );
    const arquivo = extrairArquivoMultipart(corpo, "multipart/form-data; boundary=XyZ");
    expect(arquivo?.tipo).toBe("image/webp");
    expect(arquivo?.dados.toString()).toBe("ABC");
  });
});
