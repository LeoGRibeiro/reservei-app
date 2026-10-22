"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUserAuth } from "@/hooks/useUserAuth";
import { useReservasStore } from "@/store/useReservasStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { vincularReservaDoCheckout } from "@/lib/reservas/reservasApi";
import { validarSenhaForte } from "@/lib/constants";
import { Sparkles, CheckCircle2, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  reservaId: string | null;
  /** Token do checkout: prova de que esta reserva foi feita por quem está criando a conta */
  checkoutToken?: string;
  nomeCliente: string;
  whatsappCliente: string;
  onClose: () => void;
  onSucesso: () => void;
}

export function ModalPosReservaCadastro({
  open,
  reservaId,
  checkoutToken,
  nomeCliente,
  whatsappCliente,
  onClose,
  onSucesso,
}: Props) {
  const { cadastrar } = useUserAuth();

  /** Vincula a reserva recém-feita à conta criada (servidor com Supabase; store no modo offline). */
  const vincularReserva = async (id: string, userId: string) => {
    if (isSupabaseConfigured()) {
      if (!checkoutToken) return;
      const r = await vincularReservaDoCheckout(id, checkoutToken);
      if (!r.ok) console.warn("[ModalPosReservaCadastro] Reserva não vinculada:", r.erro);
      return;
    }
    useReservasStore.getState().atualizarReserva(id, { userId });
  };

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();

    const validacao = validarSenhaForte(senha);
    if (!validacao.valido) {
      toast.error("Requisitos de senha não atendidos", {
        description: validacao.erros[0],
      });
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const res = await cadastrar(nomeCliente, whatsappCliente, senha);
    if (res.success && res.user && reservaId) {
      await vincularReserva(reservaId, res.user.id);
    }
    setLoading(false);

    if (res.success && res.user) {
      toast.success("Conta criada com sucesso! 🎉", {
        description: "Suas próximas reservas serão muito mais rápidas.",
      });
      onSucesso();
      onClose();
    } else {
      toast.error("Não foi possível criar a conta", {
        description: res.error || "Tente novamente mais tarde.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md p-6">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-black text-center text-white">
            Reserva Confirmada! 🎉
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-center text-xs mt-1">
            Deseja salvar seus dados para agilizar sua próxima reserva?
          </DialogDescription>
        </DialogHeader>

        {/* Resumo dos dados preenchidos */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 my-2 text-xs space-y-1">
          <p className="text-slate-400">
            Nome: <span className="text-white font-semibold">{nomeCliente}</span>
          </p>
          <p className="text-slate-400">
            WhatsApp de Acesso:{" "}
            <span className="text-emerald-400 font-semibold">{whatsappCliente}</span>
          </p>
        </div>

        <form onSubmit={handleCadastrar} className="space-y-3 mt-1">
          <div className="space-y-1">
            <Label className="text-xs text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" /> Defina uma senha
            </Label>
            <div className="relative">
              <Input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-slate-800 border-slate-700 h-10 rounded-xl pr-10 text-white"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Checklist de requisitos de segurança */}
            <div className="pt-1 pb-1 space-y-1 text-[11px]">
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
                      <span>Ao menos 1 letra maiúscula (A-Z)</span>
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
                      <span>Ao menos 1 caractere especial (!@#$...)</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-300">Confirme sua senha</Label>
            <Input
              type={mostrarSenha ? "text" : "password"}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Repita a senha"
              className="bg-slate-800 border-slate-700 h-10 rounded-xl text-white"
            />
          </div>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs"
            >
              Agora não, obrigado
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-10 rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Criar Minha Conta"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
