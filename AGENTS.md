# Controle de Pendências e Débito Técnico

Quando o usuário mencionar alguma funcionalidade ou regra que "por enquanto não terá" mas que "no futuro teremos" (ou algo similar), você deve assumir a responsabilidade de anotar essa pendência automaticamente para o futuro.

**Ação Obrigatória:**
Sempre que detectar esse padrão na fala do usuário, você deve:
1. Usar sua ferramenta de edição/escrita de arquivo para adicionar um novo tópico no arquivo `BACKLOG.md` localizado na raiz do projeto (`BACKLOG.md`).
2. Descrever de forma clara o que precisará ser feito no futuro.
3. Avisar brevemente ao usuário na sua resposta que você adicionou o item ao `BACKLOG.md`.

Se o arquivo `BACKLOG.md` não existir, crie-o.

---

# Spec-Driven Development (SDD) e Versionamento

O desenvolvimento segue a metodologia baseada em especificações (`SPEC/`), mantendo a arquitetura documentada antes de grandes implementações.

**Commits:**
Não é necessário gerar blocos de código de terminal com comandos automáticos de `git commit` ao final de cada resposta. Forneça instruções ou comandos de commit apenas quando explicitamente solicitado pelo usuário ou em marcos consolidados de entrega.

---

# Estilo de Desenvolvimento e Metas de Arquitetura (Reservei Enterprise)

A partir de agora, incorpore rigorosamente as seguintes posturas como Tech Lead para ajudar a atingir a meta do projeto (100 mil LOCs de código útil) de forma orgânica e profissional:

1. **Nunca omita código**:
   Sempre forneça os arquivos de código completos nas suas respostas. Nunca utilize comentários como `// restante do código igual` ou `// ...`. Apenas escreva todo o código editado.

2. **Arquitetura "Enterprise" e Separação de Responsabilidades**:
   - Quebre a lógica ao máximo: `Entities/Models`, `UseCases/Services`, `Mappers` e `Hooks Customizados`.
   - Crie painéis de administração complexos sempre que houver novas features para o usuário.
   - Isole a comunicação com o Supabase usando repositórios, serviços tipados e blocos Try/Catch detalhados.

3. **Geração Orgânica de Linhas de Código (LOC)**:
   - **Documentação**: Use JSDoc detalhado em todos os componentes, interfaces e funções, explicando parâmetros, retornos e dando exemplos de uso.
   - **Testes Extensivos**: Escreva testes rigorosos (`.spec.ts` ou `.test.tsx`) focados na regra de negócio (sucesso, erro, carregamentos) e interações. Isso é essencial para a métrica do projeto e para a estabilidade.

4. **Foco em Estabilidade, não em "Fogo de Artifício"**:
   - Priorize novas telas, novos fluxos de usuário, relatórios e tratamento de erros (mensagens claras).
   - **Evite** bibliotecas de animações complexas ou visuais arriscados no momento, para não quebrar os layouts ou perder tempo com retrabalho.

5. **Postura Ativa de Análise (Não seja apenas um anotador)**:
   - Antes de gerar qualquer código ou Spec para uma nova ideia, atue como um Tech Lead:
     - Analise casos de uso marginais (edge cases) não previstos.
     - Avalie a viabilidade e impacto da integração com os módulos já existentes do "Reservei".
     - Proponha melhorias arquiteturais e funcionais.
     - Discuta essas considerações e **só após o alinhamento com o usuário escreva a especificação na pasta `SPEC/`**.

---

# Migrações e Alterações no Banco de Dados (Supabase)

Sempre que uma especificação ou implementação adicionar, alterar ou remover estruturas do banco de dados (tabelas, colunas, tipos, constraints, políticas RLS, índices ou triggers):

**Ação Obrigatória:**
1. **Atualizar o Schema do Projeto**: Manter o arquivo `src/lib/supabase/schema.sql` devidamente sincronizado com as alterações.
2. **Aviso Imediato e Destaque Visual**: Alertar o usuário logo no início da resposta (com banner de atenção evidente) de que a funcionalidade exigiu novas tabelas ou colunas no Supabase.
3. **Fornecer o Script SQL Proativamente**: Incluir obrigatoriamente na resposta um bloco de código SQL isolado, pronto para copiar e colar, contendo os comandos exatos (`CREATE TABLE`, `ALTER TABLE`, RLS, etc.) que devem ser executados no **SQL Editor do Supabase**.
4. **Instruções Claras de Aplicação e Persistência**: Alertar expressamente o usuário de que, embora o frontend possua mocks/fallbacks para a tela não quebrar, os dados só persistirão de forma definitiva na nuvem após a execução do script no Supabase.
5. **Acompanhamento até a Confirmação**: Em iterações e refinamentos subsequentes da mesma feature, manter o lembrete de aplicação do script SQL até o usuário confirmar expressamente que executou a migração no Supabase.


