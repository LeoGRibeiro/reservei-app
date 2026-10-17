<div align="center">

# 🏟️ Reservei
### Plataforma Enterprise de Gestão de Arenas Esportivas & Agendamento Inteligente

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Tests-388%20Passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

<br />

**Desenvolvido por [Leonardo G. Ribeiro](https://github.com/LeoGRibeiro)**  
*Engenheiro de Software Full Stack*

[🌐 Demonstração Online](https://dsai-ap1-reservei-jykz9j1rz-leo-gr-ibeiro.vercel.app) • [📋 Especificações Técnicas (SDD)](./SPEC/) • [🧪 Suíte de Testes](#-qualidade-de-software--testes-automatizados) • [🏗️ Arquitetura](#️-destaques-de-arquitetura--decisões-de-engenharia)

</div>

---

## 📌 Visão Executiva do Produto

O **Reservei** é uma solução SaaS completa (*Software as a Service*) projetada para digitalizar, automatizar e escalar a operação de complexos esportivos e arenas multi-quadra (Beach Tennis, Futevôlei, Futebol Society, Futsal, Tênis e Padel).

A plataforma ataca diretamente os principais gargalos operacionais e financeiros enfrentados por gestores de arenas:
* **Eliminação de *Double Booking*:** Algoritmo atômico de reserva de slots e controle de concorrência em tempo real.
* **Redução de No-Shows:** Exigência de sinal antecipado via Pix dinâmico integrado e controle de inadimplência/reincidência com lista de restrição auditável.
* **Gestão de Recorrência Complexa:** Orquestração de contratos contínuos (mensalistas, turmas de escolinhas e grupos fixos) com projeção automatizada de agenda para até 6 meses.
* **Retenção & Socialização:** Programa de fidelidade gamificado com cálculo ponderado de ticket médio e mural social de busca de parceiros para completar partidas.
* **Auditoria & Governança Operacional:** Trilha completa de auditoria para ações administrativas, cancelamentos com aviso prévio e controle de bloqueio preventivo de usuários.

---

## 🏛️ Destaques de Arquitetura & Decisões de Engenharia

O projeto foi concebido sob princípios de engenharia corporativa (*Enterprise Software Architecture*), priorizando manutenibilidade, previsibilidade de estado, resiliência e facilidade de evolução:

### 1. Spec-Driven Development (SDD)
Antes de qualquer implementação em código, a arquitetura de cada subsistema foi formalmente desenhada e versionada em documentos RFC na pasta [`SPEC/`](./SPEC/) (17 especificações detalhadas abordando modelos de dados, contratos de API, matrizes de transição de estado e edge cases de negócio).

### 2. Separação Estrita de Responsabilidades (*Clean Architecture Layering*)
* **Entidades & Modelos de Domínio:** Tipagem estrita de ponta a ponta em TypeScript (`src/types/`), eliminando ambiguidades e assegurando integridade estática absoluta.
* **Camada de Serviços & Use Cases:** Regras de negócio desacopladas da camada de apresentação (ex.: projeção de datas de recorrência, validações de cancelamento com aviso prévio, cálculo de ticket médio de vouchers).
* **Camada de Repositórios & Abstração de Dados:** Isolamento da comunicação com o Supabase (PostgreSQL / RLS / Storage) através de repositórios tipados, com mecanismos defensivos de *fallback/mock* integrados para garantir resiliência operacional contínua.
* **Custom Hooks & Reactive State:** Encapsulamento de lógicas reativas e consumo de stores globais com **Zustand**, evitando renderizações desnecessárias e acoplamento direto de componentes à infraestrutura.

### 3. Concorrência Segura & Prevenção de Conflitos de Agenda
Tratamento de condições de corrida (*race conditions*) em janelas de checkout simultâneas:
* Estratégia de bloqueio temporário de slot durante o fluxo de pagamento Pix.
* Validação atômica no banco de dados e políticas de segurança em nível de linha (*Row Level Security - RLS*).

### 4. Resiliência Operacional & Arquitetura Defensiva
* **Mecanismos de Fallback Inteligentes:** Estratégia de dados resiliente que mantém a aplicação funcional mesmo em cenários de instabilidade na conexão com provedores externos.
* **Auditoria e Rastreabilidade:** Registro sistemático de justificativas de bloqueio, cancelamentos programados e movimentações financeiras.

---

## 🚀 Principais Módulos da Aplicação

### 🏟️ 1. Portal do Cliente & Fluxo de Reserva Ágil
* **Seleção Inteligente de Quadras:** Filtros dinâmicos por modalidade esportiva, tipo de piso e comodidades.
* **Grade de Horários Interativa:** Visualização em tempo real de horários disponíveis, ocupados e em processamento.
* **Checkout & Pagamento Instantâneo Pix:** Agrupamento de slots múltiplos ou contíguos com cálculo automático de sinal financeiro, geração de QR Code dinâmico e código "Copia-e-Cola".
* **Onboarding Sem Atrito:** Fluxo de identificação simplificado via número de WhatsApp com validação instantânea.
* **Painel "Minha Conta":** Histórico de reservas, comprovantes de quitação, visualização de vouchers ativos e cartela de selos.

### 🤝 2. Mural Social de Vagas Abertas (Matchmaking de Jogadores)
* **Preenchimento de Vagas Ociosas:** Organizadores de partidas podem disponibilizar vagas remanescentes para a comunidade de atletas da arena.
* **Candidatura em 1 Clique:** Jogadores avulsos podem consultar partidas que precisam de membros por modalidade e manifestar interesse instantaneamente.
* **Painel de Moderação do Criador:** Aprovação/rejeição de interessados com acionamento direto via WhatsApp para fechamento do grupo.

### 🏆 3. Motor de Fidelidade Gamificado
* **Cartela Digital de Selos:** Bonificação automática por hora jogada com prazos de validade dinâmicos.
* **Algoritmo de Ticket Médio Ponderado:** Sistema que calcula o benefício de desconto com base no valor efetivamente gasto pelo usuário no complexo, impedindo distorções financeiras.
* **Resgate Integrado no Checkout:** Aplicação automática de vouchers conquistados diretamente na etapa de pagamento.

### 🔄 4. Motor de Contratos Recorrentes & Mensalistas
* **Orquestração de Escolinhas & Grupos:** Cadastro de contratos fixos com múltiplos dias e horários semanais.
* **Materialização Contínua da Agenda:** Projeção algorítmica de ocorrências para até 6 meses à frente, mantendo slots reservados automaticamente.
* **Política de Aviso Prévio:** Liberação assistida e cancelamento programado com trilha de auditoria e liberação automática de slots futuros.

### 📊 5. Backoffice Administrativo Enterprise (`/admin`)
* **Dashboard Executivo & KPIs:** Receitas realizadas vs. projetadas, taxa de ocupação das quadras e volumetria de reservas por modalidade.
* **Agenda Matriz Interativa:** Alternância rápida entre visualização diária multi-quadra e calendário mensal consolidado.
* **Lançamento Manual de Balcão:** Interface otimizada para atendentes presenciais registrarem locações avulsas via telefone ou balcão.
* **Bloqueio Estrutural de Slots:** Interdição seletiva para manutenção preventiva, reformas ou torneios fechados.
* **Gestão de Restrição de Clientes:** Mecanismo de bloqueio motivado com histórico de no-shows, protegendo o complexo contra reservas fraudulentas.
* **Gestão de Conteúdo Institucional:** Upload e gerenciamento da galeria de fotos e cadastro de escolinhas parceiras via Supabase Storage.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Justificativa Técnica |
| :--- | :--- | :--- |
| **Framework Web** | [Next.js 16 (App Router)](https://nextjs.org/) | Server-Side Rendering (SSR), React Server Components e rotas modernas de alta performance. |
| **Linguagem Base** | [TypeScript 5](https://www.typescriptlang.org/) | Tipagem estrita de ponta a ponta, reduzindo bugs em tempo de compilação. |
| **Biblioteca de UI** | [React 19](https://react.dev/) | Primitivas concorrentes modernas, actions e gerenciamento de transições. |
| **Estilização** | [Tailwind CSS 4](https://tailwindcss.com/) | Design system utilitário de alta performance sem overhead de runtime. |
| **Design System** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) | Componentes acessíveis (WAI-ARIA), semânticos, desacoplados e responsivos. |
| **Estado Global** | [Zustand](https://zustand-demo.pmnd.rs/) | Gestão de estado minimalista, reativa, sem boilerplate e com persistência local. |
| **Backend & Banco de Dados** | [Supabase](https://supabase.com/) (PostgreSQL) | Persistência relacional, Row Level Security (RLS), Storage de arquivos e Realtime. |
| **Suíte de Testes** | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) | Execução ultrarrápida com JSDOM, cobertura de testes unitários e de integração. |
| **Smooth Scroll** | [Lenis](https://lenis.darkroom.engineering/) | Rolagem inercial suave para experiência premium na Landing Page. |
| **Notificações** | [Sonner](https://sonner.emilkowal.ski/) | Feedback visual assíncrono e intuitivo para o usuário. |

---

## 🧪 Qualidade de Software & Testes Automatizados

A estabilidade e a corretude das regras de negócio são garantidas por uma suíte robusta com **388 testes automatizados** distribuídos em **39 arquivos de teste**:

```text
Test Files  39 passed (39)
Tests       388 passed (388)
Status      100% Passing
```

### Escopo dos Testes:
* **Prevenção de Conflitos (*Double Booking*):** Validação de locks concorrentes e regras atômicas de alocação de horários.
* **Projeção de Recorrência & Calendário:** Testes determinísticos para materialização de datas, anos bissextos e viradas de mês.
* **Motor de Fidelidade & Cálculos Financeiros:** Precisão matemática do ticket médio ponderado, regras de arredondamento e validade temporal de selos.
* **Regras de Negócio de Vagas Abertas:** Limites de ocupação, candidaturas duplicadas e fluxo de aprovação de atletas.
* **Políticas de Acesso & Bloqueio:** Validação de comportamento do sistema frente a usuários restritos por no-show.
* **Acessibilidade e Componentes de Interface:** Renderização, interações de formulários, modais e comportamento responsivo.

Execute os testes com um único comando:
```bash
npm test
```

---

## 🏗️ Estrutura do Projeto

```text
reservei/
├── SPEC/                  # 17 Especificações Técnicas de Arquitetura (SDD)
├── tests/                 # Suíte com 388 testes automatizados (39 arquivos)
│   ├── api/               # Testes de rotas de API e webhooks de pagamento
│   ├── components/        # Testes de UI (Admin, Portal, Landing, Vagas)
│   ├── hooks/             # Testes de hooks customizados
│   ├── lib/               # Testes de lógica de negócio e cálculos
│   └── store/             # Testes de stores reativos Zustand
└── src/                   # Aplicação Next.js (App Router)
    ├── app/               # Rotas e páginas (/, /admin, /login, /minha-conta, /api)
    ├── components/        # Componentes organizados por domínio de negócio
    ├── hooks/             # Custom hooks encapsulando lógica de negócio reativa
    ├── lib/               # Domain services, algoritmos e integrações
    │   ├── adminAgenda/   # Lógica e serviços da agenda administrativa
    │   ├── arena/         # Serviços de multi-arenas e domínios
    │   ├── fidelidade/    # Cálculos de ticket médio ponderado e selos
    │   ├── institucional/ # Repositórios e helpers de conteúdo
    │   ├── pagamento/     # Concorrência, locks Pix e conciliação
    │   ├── recorrencia/   # Algoritmos de contratos contínuos e datas
    │   ├── supabase/      # Clients Supabase, repositórios tipados e schema SQL
    │   └── vagas/         # Regras de negócio do mural de partidas
    ├── store/             # Stores Zustand (autenticação, reservas, contratos)
    └── types/             # Definições estritas de interfaces e tipos TypeScript
```

---

## ⚡ Como Executar o Projeto Localmente

### Pré-requisitos
* **Node.js** 18.x ou superior
* **NPM**, **PNPM** ou **Yarn**

### 1. Clonar o Repositório
```bash
git clone https://github.com/LeoGRibeiro/reservei-app.git
cd reservei-app
```

### 2. Configurar Variáveis de Ambiente
Crie o arquivo `.env.local` na pasta `src/` (ou utilize os fallbacks de desenvolvimento já embutidos):
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 3. Instalar Dependências e Iniciar Servidor de Desenvolvimento
```bash
# Na raiz do projeto:
npm install
npm run dev
```

* **Aplicação Web:** [http://localhost:3000](http://localhost:3000)  
* **Painel Administrativo:** [http://localhost:3000/admin](http://localhost:3000/admin)  
* **Execução dos Testes:** `npm test`

---

## 👨‍💻 Autor & Contato

**Leonardo G. Ribeiro**  
Software Engineer | Full Stack

* **GitHub:** [@LeoGRibeiro](https://github.com/LeoGRibeiro)
* **LinkedIn:** [Leonardo G. Ribeiro](https://linkedin.com/in/leogribeiro)
* **Repositório do Projeto:** [github.com/LeoGRibeiro/reservei-app](https://github.com/LeoGRibeiro/reservei-app)

---

<div align="center">
  <sub>Construído com excelência técnica, arquitetura limpa e foco em experiência do usuário.</sub>
</div>
