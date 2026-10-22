/**
 * @file PaginaComercial.tsx
 * @description Página de apresentação do produto para donos de arenas (venda consultiva, sem preço público).
 * Servida em `/para-arenas` em qualquer host e na raiz do domínio da plataforma quando houver domínio próprio.
 */

import Link from "next/link";
import {
  CalendarCheck,
  Wallet,
  Store,
  Users,
  Repeat,
  Gift,
  BarChart3,
  Smartphone,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { NOME_PRODUTO, SLOGAN_PRODUTO, WHATSAPP_COMERCIAL } from "@/lib/marca";

const DORES = [
  "O WhatsApp da arena não para: “tem horário hoje às 19h?” o dia inteiro.",
  "Horário marcado duas vezes, ou anotado no caderno e esquecido.",
  "Atleta que reserva e não aparece, sem ter pago nada.",
  "Mensalistas, escolinhas e avulsos misturados numa planilha.",
];

const RECURSOS = [
  {
    icone: Smartphone,
    titulo: "Site de reservas com a marca da arena",
    texto: "O atleta vê os horários livres e reserva sozinho, 24 horas, pelo celular. É o link da bio do Instagram.",
  },
  {
    icone: Wallet,
    titulo: "Pix do sinal direto na conta da arena",
    texto: "Sem intermediário segurando o seu dinheiro. Confirmação automática (Asaas) ou conferência no balcão.",
  },
  {
    icone: CalendarCheck,
    titulo: "Agenda do balcão",
    texto: "Visão do dia por quadra, reserva manual por telefone, bloqueio para manutenção e torneios.",
  },
  {
    icone: Repeat,
    titulo: "Mensalistas e escolinhas",
    texto: "Horários fixos reservados automaticamente por meses, com controle de aviso prévio.",
  },
  {
    icone: Gift,
    titulo: "Fidelidade e mural de vagas",
    texto: "Cartela de horas jogadas que vira horário grátis e mural para completar partidas.",
  },
  {
    icone: Users,
    titulo: "Equipe com perfis de acesso",
    texto: "O balcão vê a agenda; o financeiro e as configurações ficam com o dono e o gerente.",
  },
  {
    icone: BarChart3,
    titulo: "Financeiro e ocupação",
    texto: "Sinais recebidos, valores a receber no local e taxa de ocupação por dia.",
  },
  {
    icone: ShieldCheck,
    titulo: "Sem horário duplicado",
    texto: "Enquanto o atleta paga, o horário fica segurado; ninguém mais consegue reservá-lo.",
  },
];

const ETAPAS = [
  "Cadastramos suas quadras, horários e preços (inclusive horário nobre).",
  "Conectamos o Pix da arena: chave Pix ou conta Asaas.",
  "Treinamos a equipe do balcão em uma conversa.",
  "Você divulga o link no Instagram e no WhatsApp.",
];

/** Link de contato comercial (WhatsApp do fundador), se configurado. */
function linkContato(): string | null {
  if (!WHATSAPP_COMERCIAL) return null;
  const mensagem = `Olá! Tenho uma arena e quero conhecer o ${NOME_PRODUTO}.`;
  return `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(mensagem)}`;
}

export function PaginaComercial() {
  const contato = linkContato();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <span className="font-black text-white text-lg">🏟️ {NOME_PRODUTO}</span>
        {contato && (
          <a
            href={contato}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
          >
            Falar com a gente
          </a>
        )}
      </header>

      <section className="max-w-5xl mx-auto px-4 pt-10 pb-16 text-center space-y-5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{SLOGAN_PRODUTO}</p>
        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
          Reservas online, Pix na conta da arena e agenda sem confusão.
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          O atleta reserva e paga o sinal sozinho. O balcão só acompanha.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
          >
            Ver demonstração
          </Link>
          {contato && (
            <a
              href={contato}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Quero na minha arena
            </a>
          )}
        </div>
      </section>

      <section className="bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-12 grid sm:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl font-black text-white">Parece familiar?</h2>
            <p className="text-sm text-slate-400 mt-2">O dia a dia de quem administra quadras sem sistema.</p>
          </div>
          <ul className="space-y-3">
            {DORES.map((dor) => (
              <li key={dor} className="text-sm text-slate-300 flex gap-2">
                <span className="text-red-400">✕</span>
                {dor}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-14 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white">Tudo que a arena precisa, em um só lugar</h2>
          <p className="text-sm text-slate-400">Você escolhe os módulos. Começa pelo essencial e cresce depois.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <article key={titulo} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <Icone className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">{titulo}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-12 grid sm:grid-cols-2 gap-8">
          <div className="space-y-2">
            <Store className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-black text-white">A arena é a dona do cliente</h2>
            <p className="text-sm text-slate-400">
              Em aplicativos de marketplace, o atleta reserva no app de outra empresa, ao lado das arenas concorrentes.
              Aqui o site é da sua arena, com o seu nome, e os contatos dos atletas ficam com você.
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white">Implantação acompanhada</h3>
            <ol className="space-y-2">
              {ETAPAS.map((etapa, i) => (
                <li key={etapa} className="text-sm text-slate-300 flex gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {etapa}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-black text-white">Vamos colocar sua arena no ar?</h2>
        <p className="text-sm text-slate-400">
          Mostramos o sistema funcionando com as suas quadras antes de você decidir.
        </p>
        {contato ? (
          <a
            href={contato}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
          >
            <MessageCircle className="w-4 h-4" /> Chamar no WhatsApp
          </a>
        ) : (
          <Link href="/" className="inline-block px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold">
            Ver demonstração
          </Link>
        )}
      </section>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        {NOME_PRODUTO} © {new Date().getFullYear()}
      </footer>
    </main>
  );
}
