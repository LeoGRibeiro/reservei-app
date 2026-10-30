"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserAuth } from "@/hooks/useUserAuth";
import { useArena } from "@/hooks/useArena";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { NOME_PRODUTO } from "@/lib/marca";
import { mascaraWhatsApp, validarSenhaForte } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Phone,
  Lock,
  Calendar,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle,
} from "lucide-react";

export default function CadastroPage() {
  const router = useRouter();
  const { cadastrar, loading } = useUserAuth();
  useArena();
  const configArena = useConfiguracaoSiteArena();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || nome.trim().length < 3) {
      toast.error("Nome incompleto", {
        description: "Por favor, informe seu nome e sobrenome.",
      });
      return;
    }

    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 11) {
      toast.error("Número de WhatsApp inválido", {
        description: "Digite o DDD + número com 11 dígitos.",
      });
      return;
    }

    const validacaoSenha = validarSenhaForte(senha);
    if (!validacaoSenha.valido) {
      toast.error("Senha não atende aos requisitos de segurança", {
        description: validacaoSenha.erros[0],
      });
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("Senhas não coincidem", {
        description: "A confirmação deve ser exatamente igual à senha.",
      });
      return;
    }

    if (!aceiteTermos) {
      toast.error("Aceite os termos para criar a conta", {
        description: "Leia e aceite os Termos de Uso e a Política de Privacidade.",
      });
      return;
    }

    setSubmitting(true);
    const res = await cadastrar(
      nome.trim(),
      telefone,
      senha,
      dataNascimento || undefined
    );
    setSubmitting(false);

    if (res.success) {
      toast.success("Conta criada com sucesso! 🎉", {
        description: "Agora você pode agendar muito mais rápido.",
      });
      router.push("/minha-conta");
    } else {
      toast.error("Erro ao criar conta", {
        description: res.error || "Tente novamente ou use outro número.",
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
            <span className="font-black text-white text-base tracking-tight">{configArena.nomePlataforma}</span>
          </Link>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Card Glassmorphism */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Efeito Glow decorativo */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Criar Conta</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Cadastre-se para reservar em 1 clique e acompanhar seus horários
              </p>
            </div>

            {/* Vantagens */}
            <div className="mb-5 p-3 rounded-2xl bg-slate-800/40 border border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Sem redigitar dados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Histórico de reservas</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Nome Completo *
                </Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10 rounded-xl"
                  autoFocus
                />
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp (Seu Login) *
                </Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(mascaraWhatsApp(e.target.value))}
                  placeholder="(11) 99999-0000"
                  inputMode="numeric"
                  className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10 rounded-xl"
                />
              </div>

              {/* Data de Nascimento (opcional) */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Data de Nascimento{" "}
                  <span className="text-slate-500 font-normal">(opcional)</span>
                </Label>
                <Input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10 rounded-xl block w-full [color-scheme:dark]"
                />
                <p className="text-[10px] text-slate-500">
                  Usado futuramente para promoções e mimos de aniversário!
                </p>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Senha * (mínimo 6 caracteres)
                </Label>
                <div className="relative">
                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Defina uma senha"
                    className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Checklist de Segurança da Senha */}
                <div className="pt-1.5 pb-0.5 space-y-1 text-[11px]">
                  {(() => {
                    const { regras } = validarSenhaForte(senha);
                    return (
                      <>
                        <div
                          className={`flex items-center gap-1.5 transition-colors ${
                            regras.minimo ? "text-emerald-400 font-medium" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              regras.minimo ? "bg-emerald-400" : "bg-slate-600"
                            }`}
                          />
                          <span>Mínimo 6 caracteres</span>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 transition-colors ${
                            regras.maiuscula ? "text-emerald-400 font-medium" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              regras.maiuscula ? "bg-emerald-400" : "bg-slate-600"
                            }`}
                          />
                          <span>Pelo menos 1 letra maiúscula (A-Z)</span>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 transition-colors ${
                            regras.especial ? "text-emerald-400 font-medium" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              regras.especial ? "bg-emerald-400" : "bg-slate-600"
                            }`}
                          />
                          <span>Pelo menos 1 caractere especial (!@#$...)</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Confirmar Senha *
                </Label>
                <Input
                  type={mostrarSenha ? "text" : "password"}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita sua senha"
                  className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10 rounded-xl"
                />
              </div>

              {/* Aceite dos termos (LGPD) */}
              <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={aceiteTermos}
                  onChange={(e) => setAceiteTermos(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  Li e aceito os{" "}
                  <Link href="/termos" target="_blank" className="text-emerald-400 underline">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link href="/privacidade" target="_blank" className="text-emerald-400 underline">
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </label>

              {/* Botão de Cadastrar */}
              <Button
                type="submit"
                disabled={submitting || loading}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl mt-3 transition-all shadow-lg shadow-emerald-500/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Finalizar Cadastro"
                )}
              </Button>
            </form>

            {/* Divisor */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                Já possui uma conta?{" "}
                <Link
                  href="/login"
                  className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors"
                >
                  Fazer login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        {configArena.nomePlataforma} © {new Date().getFullYear()} · Reservas online por {NOME_PRODUTO}
      </footer>
    </div>
  );
}
