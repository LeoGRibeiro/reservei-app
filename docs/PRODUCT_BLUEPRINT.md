# 🏟️ Reservei — Product & Business Blueprint

> **Status:** Documento Vivo / Oficial de Produto  
> **Última Atualização:** 20/10/2026  
> **Propósito:** Registrar as definições estratégicas de produto, modelo de negócio, módulos contratáveis e fluxo de disponibilização comercial, garantindo persistência absoluta de contexto entre sessões de desenvolvimento.

---

## 1. Visão Executiva & Modelo de Negócio

O **Reservei** é uma plataforma multi-tenant *white-label* de gestão de complexos esportivos e agendamento de quadras (Beach Tennis, Futevôlei, Futebol Society, Vôlei, Futsal, Tênis e Padel).

### Modelo Comercial: Venda Direta B2B ("Porta a Porta")
- **Público-Alvo:** Proprietários e gestores de complexos esportivos.
- **Canal de Aquisição:** Venda direta consultiva presencial/remota pelo fundador.
- **Fluxo de Monetização:**
  - **Taxa de Implantação/Setup (Única):** R$ 400 a R$ 800 (abrange parametrização das quadras, upload de identidade visual, configuração de horários e treinamento básico da equipe).
  - **Mensalidade Recorrente de Software (SaaS):** R$ 180 a R$ 350 por mês (cobrada diretamente via Pix PJ ou boleto bancário emitido pelo fundador).
  - **Despriorização do Self-Service:** Não há checkout público para donos de arena comprarem sozinhos na Landing Page; o onboarding é sempre assistido e controlado internamente pelo Super Admin.

---

## 2. Arquitetura de Disponibilização (Multi-Tenant White-Label)

### Infraestrutura Compartilhada
- **Frontend & APIs:** 1 única aplicação Next.js 16 rodando na Vercel.
- **Banco de Dados & Storage:** 1 único PostgreSQL gerenciado no Supabase, protegido por Row Level Security (RLS) e particionamento lógico via coluna `arena_id`.
- **Roteamento por Subdomínios Estritos:**
  - Toda arena possui uma URL exclusiva: `https://[slug].reservei.com` (ex: `https://arenadoze.reservei.com`, `https://Central.reservei.com`).
  - O acesso por caminho (`reservei.com/arenadoze`) **é expressamente proibido** para clientes finais e redireciona (HTTP 301) para o subdomínio oficial.
  - Em ambiente local: `http://[slug].localhost:3000`.
  - A Vercel opera com domínio Wildcard (`*.reservei.com`), garantindo emissão automática de certificado SSL e ativação instantânea de novas arenas sem intervenção em infraestrutura.

---

## 3. Modularidade & Feature Flags (Venda Customizada por Cliente)

Nem toda arena compra o pacote completo. A plataforma foi desenhada para ligar e desligar módulos conforme a negociação comercial:

| Módulo | Descrição | Opcional / Core |
| :--- | :--- | :--- |
| **Core de Agendamento & Agenda** | Grade de horários interativa, checkout Pix com sinal e painel administrativo de balcão (`/admin`). | **Core (Obrigatório)** |
| **Contratos & Mensalistas** | Gestão de turmas fixas, contratos contínuos e projeção de agenda de 6 meses. | Opcional |
| **Mural de Vagas Sociais** | Matchmaking de atletas para completar partidas abertas. | Opcional |
| **Clube de Fidelidade** | Cartela digital de selos e cálculo ponderado de ticket médio para cupons. | Opcional |
| **Escolinhas Parceiras** | Vitrine de escolinhas de esportes no portal da arena. | Opcional |
| **WhatsApp Booking Determinístico** | Botões e listas interativas no WhatsApp para autoagendamento. | Opcional |
| **WhatsApp AI Concierge** | Assistente de IA para dúvidas, horários, regras e informações da arena. | Opcional |

A ativação é controlada na entidade `arenas.modulos_ativos` (array ou jsonb no Supabase).

---

## 4. Estratégia de Mensageria & Inteligência Artificial no WhatsApp

### Regra de Ouro: Reserva Determinística vs. Consulta por IA
Para blindar o sistema contra alucinações de LLMs em transações financeiras:

1. **Efetivação de Reservas (100% Determinística):**
   - Segue a UX comprovada do mercado via mensagens interativas oficiais da Meta (Evolution API / Z-API):
     1. Menu interativo com botões nativos.
     2. Lista de durações ("1 hora", "2 horas").
     3. Seleção de modalidade e grade de horários disponíveis.
     4. Emissão imediata de Pix Copia-e-Cola e confirmação atômica via webhook.
2. **WhatsApp AI Concierge (Opcional & Restrito a Consultas):**
   - Ativado apenas se a arena contratante pagar por este adicional.
   - **Escopo Estrito:** Tirar dúvidas sobre o complexo, regras de cancelamento, estrutura física, estacionamento, modalidades disponíveis e consultar horários livres.
   - **Não emite nem finaliza reservas diretamente:** Ao identificar que o cliente deseja agendar, a IA o transfere de forma elegante para o fluxo interativo determinístico de agendamento ou para atendimento humano.

---

## 5. Destaque de Portfólio & Engenharia AI-Native

O projeto é mantido sob os mais altos padrões da indústria para demonstrar maturidade de engenharia corporativa a recrutadores e lideranças técnicas:
- **Two-Tier Agentic Engineering:** Divisão estrita entre o papel de Arquiteto/CTO (Antigravity) e Engenheiro de Implementação (Claude).
- **Spec-Driven Development (SDD):** RFCs detalhadas na pasta `SPEC/` antes de qualquer alteração de código.
- **Suíte de Testes Automatizados:** Manutenção de testes unitários e de integração com cobertura rigorosa no Vitest.
- **Zero Gambiarras Acadêmicas:** Erradicação de atalhos e métricas artificiais de faculdade (como inflar linhas de código). Foco exclusivo em código limpo, modular, auditável e resiliente.
