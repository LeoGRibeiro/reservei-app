"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserAuth } from "@/hooks/useUserAuth";
import { mascaraWhatsApp } from "@/lib/constants";
import { useArena } from "@/hooks/useArena";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Lock, Eye, EyeOff, ArrowLeft, Loader2, Sparkles, HelpCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useUserAuth();
  useArena();
  const configArena = useConfiguracaoSiteArena();

  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 11) {
      toast.error("Número de WhatsApp incompleto", {
        description: "Digite o DDD + número com 11 dígitos.",
      });
      return;
    }

    if (!senha || senha.length < 4) {
      toast.error("Senha inválida", {
        description: "Digite sua senha de acesso.",
      });
      return;
    }

    setSubmitting(true);
    const res = await login(telefone, senha);
    setSubmitting(false);

    if (res.success) {
      toast.success("Login realizado com sucesso! 👋");
      router.push("/minha-conta");
    } else {
      toast.error("Não foi possível entrar", {
        description: res.error || "Verifique seu telefone e senha.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-white selection:bg-emerald-500/30">
      {/* Topo Navegação */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Voltar para agendamentos</span>
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🏟️</span>
            <span className="font-black text-white text-base tracking-tight">Reservei</span>
          </Link>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md">
          {/* Card Glassmorphism */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Efeito Glow decorativo */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Acesse sua Conta</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Entre para agendar sem preencher dados e gerenciar suas reservas
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* WhatsApp */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
                </Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(mascaraWhatsApp(e.target.value))}
                  placeholder="(11) 99999-0000"
                  inputMode="numeric"
                  className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-11 rounded-xl"
                  autoFocus
                />
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" /> Senha
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha de acesso"
                    className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-11 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botão de Entrar */}
              <Button
                type="submit"
                disabled={submitting || loading}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl mt-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar na Minha Conta"
                )}
              </Button>
            </form>

            {/* Aviso Recuperação de Senha */}
            <div className="mt-5 p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Esqueceu sua senha? Envie uma mensagem para nosso{" "}
                <a
                  href={`https://wa.me/${configArena.whatsappNumero}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline font-medium hover:text-emerald-300"
                >
                  WhatsApp de Suporte
                </a>{" "}
                para redefinição imediata.
              </span>
            </div>

            {/* Divisor */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                Ainda não possui uma conta?{" "}
                <Link
                  href="/cadastro"
                  className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors"
                >
                  Criar conta grátis
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé simples */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        Reservei © {new Date().getFullYear()} · Complexo Esportivo
      </footer>
    </div>
  );
}
