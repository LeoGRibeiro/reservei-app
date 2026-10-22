# Implantação — checklist de go-live

Passos de infraestrutura que dependem de acesso às contas do fundador (Vercel, Supabase, registro.br, Asaas).
Referência: `SPEC/2026-10-22-mvp-go-live.md` §9.

## A. Para a demonstração (agora)

1. **Supabase → SQL Editor**: rode, nesta ordem:
   1. `src/lib/supabase/migracoes/2026-10-22-fase8-mvp-go-live.sql`
   2. `src/lib/supabase/seed-arena-belem.sql`. A última linha do resultado traz o link de ativação do dono: `/admin?token=...`.

   Os dois scripts foram validados num PostgreSQL (PGlite) partindo do zero e podem ser executados mais de uma vez.
2. **Vercel → Settings → Environment Variables** (Production), depois **Redeploy**:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_ARENA_RAIZ_SLUG` | `arena-belem` |
   | `PAGAMENTO_SIMULADO_HABILITADO` | `true` |
   | `PAGAMENTO_CREDENCIAIS_SECRET` | 32+ caracteres aleatórios (veja abaixo). **Nunca troque depois de usar**: as chaves Asaas salvas deixariam de abrir. |
   | `NEXT_PUBLIC_WHATSAPP_COMERCIAL` | seu WhatsApp com DDI (ex.: `5591999999999`), usado na página `/para-arenas` |

   Para gerar o segredo, rode: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
3. Abra `https://reserveei.vercel.app/admin?token=...` (o link do passo 1) e crie a conta de proprietário da Arena Belém.
4. No painel, suba fotos em **Institucional & LP**. Revise os preços em **Gestão de Quadras**.

> Atenção: a migração coloca as arenas **já existentes** (arena-demo, gouvea, teste-claude) em modo *Demonstração*.
> Arenas novas nascem em modo *Pix manual* e precisam cadastrar a chave Pix em **Pagamentos**.

## B. Antes do primeiro contrato

1. **Nome e domínio.** Decida o nome e registre o `.com.br` no registro.br (~R$ 40/ano).
2. **Vercel → Domains.** Adicione `dominio.com.br` e `*.dominio.com.br`. No registro.br, troque os servidores DNS para `ns1.vercel-dns.com` e `ns2.vercel-dns.com`, o que é obrigatório para o wildcard. Defina `NEXT_PUBLIC_ROOT_DOMAIN=dominio.com.br` e remova `NEXT_PUBLIC_ARENA_RAIZ_SLUG`.
   - A raiz do domínio passa a mostrar a página comercial; cada arena fica em `slug.dominio.com.br`.
3. **Supabase Pro** (~US$ 25/mês). O plano gratuito pausa o projeto após 7 dias sem uso e não tem backup diário.
4. **E-mail transacional (recuperação de senha do admin).** Crie uma conta no Resend, verifique o domínio e configure em Supabase → Authentication → SMTP Settings. Em **URL Configuration**, adicione `https://*.dominio.com.br/admin/redefinir-senha`.
5. **Supabase → Authentication → Settings.** Ative "Leaked password protection".
6. **Revisão jurídica.** Leve `/termos` e `/privacidade` a um advogado; os textos ficam em `src/lib/legal/termos.ts`.
7. **Pagamentos da arena.** No painel da arena, em **Pagamentos**, conecte o Asaas da arena (chave de produção `$aact_prod_...`) ou cadastre a chave Pix. Depois, tire do modo *Demonstração*.

## C. Por arena nova (onboarding)

1. `/super-admin` → criar arena (slug, módulos, quantidade de quadras) → enviar o link de ativação ao dono.
2. Com o dono: quadras, preços por faixa, horários, política de cancelamento, chave Pix ou Asaas, equipe.
3. Fazer uma reserva de teste de ponta a ponta com um Pix real de valor baixo.
