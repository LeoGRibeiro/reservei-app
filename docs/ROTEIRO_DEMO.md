# Roteiro de demonstração — Arena Belém

> Duração: 10 a 15 minutos. Leve o celular (visão do atleta) e o notebook (visão do balcão).
> Endereço da demo: `https://reserveei.vercel.app` (arena raiz = `arena-belem`).

## Antes de sair de casa

- [ ] Rodou o `seed-arena-belem.sql` hoje? Ele renova as reservas de exemplo das próximas 2 semanas.
- [ ] Abriu `https://reserveei.vercel.app` no celular e viu a faixa amarela "Demonstração"?
- [ ] Entrou no `/admin` com a conta de proprietário da Arena Belém?
- [ ] Subiu 3 a 5 fotos do Instagram da arena em **Institucional & LP → Galeria**? A demo fica muito mais convincente com as fotos deles.
- [ ] Conferiu os preços em **Gestão de Quadras**? Os valores do seed são estimativas: areia R$ 80/h de dia, R$ 90 no fim de semana e R$ 100 à noite; society R$ 150, R$ 160 e R$ 180.

## Contexto do cliente (pesquisa de 22/10/2026)

- Av. Roberto Camelier, 580, Jurunas. (91) 98498-2865. Instagram @arenabelem, com cerca de 10 mil seguidores.
- 3 quadras de areia + 1 society. Beach tennis, futevôlei, vôlei de praia e futebol.
- Escolinha de futebol licenciada do CT Falcão12 (não vem no seed: cadastre ao vivo, veja o passo 6 do balcão).
- Estacionamento, espaço de eventos, churrasqueiras, vestiários, bar e lanchonete.
- **Hoje usam o AgendeiQuadras** (link da bio do Instagram). Os argumentos estão no fim deste roteiro.

## 1. Comece pela dor (2 min)

Pergunte, não afirme:
- "Quantas mensagens de 'tem horário?' vocês respondem por dia?"
- "Já aconteceu de marcar o mesmo horário para duas pessoas?"
- "Quem reserva e não aparece paga alguma coisa?"
- "Como vocês controlam os mensalistas e a escolinha?"

## 2. Visão do atleta, no celular (4 min)

1. Abra `reserveei.vercel.app`. Mostre o **nome da Arena Belém**, as 3 quadras de areia e o society.
2. Escolha uma quadra de areia, um dia e um horário livre **à noite**: o preço do horário nobre aparece sozinho.
3. Mostre a lista de esportes: só aparecem os da quadra (beach tennis, futevôlei e vôlei de praia).
4. Preencha nome e WhatsApp, aceite os termos e mostre a **política de cancelamento da arena** antes do pagamento.
5. Tela do Pix: mostre o QR Code e o "copia e cola". Toque em **Simular pagamento aprovado**.
6. A reserva é confirmada na hora e o horário some da grade para todo mundo.

**Frase-chave:** "O atleta reservou e pagou o sinal sem ninguém da arena precisar responder no WhatsApp."

## 3. Visão do balcão, no notebook (5 min)

O painel novo é neutro e igual para toda arena; o nome da Arena Belém fica sempre no topo.

1. Entre em `/admin`. A tela **Hoje** mostra quem está em quadra agora, os próximos horários com o que falta receber, o total a receber no balcão e (para o dono) o recebido e a ocupação do dia.
2. Se aparecer **Pix para conferir**: um atleta pagou na chave Pix da arena e avisou. Explique que é o modo sem taxa, em que o balcão só confere o extrato. Clique em **Confirmar Pix**.
3. Abra a **Agenda** (visão Dia): uma coluna por quadra, com a reserva feita no celular já lá. Clique num horário livre → **Nova reserva** para um cliente que ligou (o preço vem da tabela da quadra; marque "Pagou o sinal · dinheiro").
4. Clique numa reserva → **detalhe**: **Receber o restante** (dinheiro, Pix ou cartão), **Remarcar** (só mostra horários livres e recalcula o preço) e **Cancelar** dizendo o que acontece com o sinal. Mostre o **Histórico**: quem fez cada coisa e quando.
5. **Bloqueie** um horário para manutenção ou torneio (clique no horário livre → Bloquear horário).
6. **Escolinhas**: cadastre uma turma ao vivo (ex.: futebol, terça e quinta às 17h, "Bloquear na agenda"). Ela aparece no site e reserva os horários fixos sozinha.
7. **Clientes**: todo mundo que já reservou, com ou sem conta, pelo WhatsApp. Mostre o bloqueio de cliente (só nesta arena).
8. **Equipe**: crie um acesso de *operador de balcão* e explique que ele não vê Financeiro, preços nem configurações (nem digitando o endereço).
9. **Recebimento**: chave Pix da arena (sem taxa) ou Asaas (confirma sozinho). Nos dois casos **o dinheiro cai na conta da arena**.
10. **Financeiro**: escolha o mês. Recebido, falta receber, descontos do Clube e devoluções, por quadra e por dia, e a planilha para o contador.

## 4. Diferenciais frente ao AgendeiQuadras (2 min)

Sem falar mal do concorrente; destaque o que é diferente:
- **A marca é da arena.** O atleta reserva no site da Arena Belém, não num app com arenas concorrentes ao lado. Os contatos dos atletas ficam com vocês.
- **Pix direto na conta da arena**, com a opção de não pagar taxa de intermediação, no modo chave Pix.
- **Implantação acompanhada e atendimento local em Belém**, com ajuste aos módulos que vocês usam: escolinha, mensalistas, fidelidade, mural de vagas.

## 5. Fechamento

- Proposta: taxa de implantação + mensalidade (veja `docs/PRODUCT_BLUEPRINT.md`).
- Próximo passo concreto: "Me passa os preços reais e a chave Pix da arena que eu deixo o sistema pronto para vocês testarem uma semana com os mensalistas."

## Se algo der errado ao vivo

- **Pix não gera:** a arena precisa estar em modo *Demonstração* (ligado no `/super-admin` → Arenas → Editar) e a Vercel com `PAGAMENTO_SIMULADO_HABILITADO=true`.
- **Grade vazia:** o seed não rodou, ou rodou há mais de 2 semanas. Rode `seed-arena-belem.sql` de novo.
- **Esqueceu a senha do admin:** use `/super-admin` → Carregar arenas → **Nova senha do dono**.
