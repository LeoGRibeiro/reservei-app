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
- Escolinha de futebol licenciada do CT Falcão12.
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

1. Entre em `/admin`. O **Dashboard** traz as reservas de hoje, os sinais recebidos e a ocupação.
2. Logo no topo aparece **Pagamentos a confirmar (1)**: um atleta pagou por Pix direto na chave da arena e avisou. Explique que é o modo sem taxa, em que o balcão só confere o extrato. Clique em **Pix recebido**.
3. Abra a **Agenda**: visão do dia por quadra, com a reserva feita no celular já lá.
4. Faça uma **reserva manual** de balcão para um cliente que ligou.
5. **Bloqueie** um horário para manutenção da areia ou para um torneio.
6. **Equipe**: crie um acesso de *operador de balcão* e explique que ele não vê o financeiro.
7. **Pagamentos**: mostre as duas opções. A chave Pix da arena não tem taxa. A conta Asaas confirma sozinha. Nos dois casos **o dinheiro cai na conta da arena**.
8. **Financeiro**: sinais recebidos e valores a receber no local.

## 4. Diferenciais frente ao AgendeiQuadras (2 min)

Sem falar mal do concorrente; destaque o que é diferente:
- **A marca é da arena.** O atleta reserva no site da Arena Belém, não num app com arenas concorrentes ao lado. Os contatos dos atletas ficam com vocês.
- **Pix direto na conta da arena**, com a opção de não pagar taxa de intermediação, no modo chave Pix.
- **Implantação acompanhada e atendimento local em Belém**, com ajuste aos módulos que vocês usam: escolinha, mensalistas, fidelidade, mural de vagas.

## 5. Fechamento

- Proposta: taxa de implantação + mensalidade (veja `docs/PRODUCT_BLUEPRINT.md`).
- Próximo passo concreto: "Me passa os preços reais e a chave Pix da arena que eu deixo o sistema pronto para vocês testarem uma semana com os mensalistas."

## Se algo der errado ao vivo

- **Pix não gera:** a arena precisa estar em modo *Demonstração* (tela Pagamentos) e a Vercel com `PAGAMENTO_SIMULADO_HABILITADO=true`.
- **Grade vazia:** o seed não rodou, ou rodou há mais de 2 semanas. Rode `seed-arena-belem.sql` de novo.
- **Esqueceu a senha do admin:** use `/super-admin` → "Redefinir senha do proprietário".
