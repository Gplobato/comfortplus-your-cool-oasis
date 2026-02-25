import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, Truck, ArrowLeft, Check } from "lucide-react";
import productHero from "@/assets/product-hero.png";

interface CheckoutPageProps {
  onBack: () => void;
  quantity: number;
}

export const CheckoutPage = ({ onBack, quantity }: CheckoutPageProps) => {
  const [step, setStep] = useState<"info" | "success">("info");
  const price = 297;
  const total = price * quantity;

  const [form, setForm] = useState({
    name: "", email: "", phone: "", cpf: "",
    cep: "", address: "", number: "", complement: "", city: "", state: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("success");
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-frost border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm";

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="container mx-auto px-6 py-12">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Voltar à loja</span>
        </button>

        <AnimatePresence mode="wait">
          {step === "info" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-5 gap-10"
            >
              {/* Form */}
              <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6">Dados Pessoais</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input name="name" placeholder="Nome completo" required value={form.name} onChange={handleChange} className={inputClass} />
                    <input name="email" type="email" placeholder="E-mail" required value={form.email} onChange={handleChange} className={inputClass} />
                    <input name="phone" placeholder="Telefone (WhatsApp)" required value={form.phone} onChange={handleChange} className={inputClass} />
                    <input name="cpf" placeholder="CPF" required value={form.cpf} onChange={handleChange} className={inputClass} />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6">Endereço de Entrega</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input name="cep" placeholder="CEP" required value={form.cep} onChange={handleChange} className={inputClass} />
                    <input name="city" placeholder="Cidade" required value={form.city} onChange={handleChange} className={inputClass} />
                    <input name="address" placeholder="Rua / Avenida" required value={form.address} onChange={handleChange} className={`${inputClass} sm:col-span-2`} />
                    <input name="number" placeholder="Número" required value={form.number} onChange={handleChange} className={inputClass} />
                    <input name="complement" placeholder="Complemento" value={form.complement} onChange={handleChange} className={inputClass} />
                    <input name="state" placeholder="Estado" required value={form.state} onChange={handleChange} className={inputClass} />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6">Pagamento</h2>
                  <div className="p-6 rounded-2xl bg-frost border border-border text-center">
                    <CreditCard className="w-8 h-8 text-primary mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      O gateway de pagamento será integrado em breve. Clique em "Finalizar Pedido" para simular a compra.
                    </p>
                  </div>
                </div>

                <Button variant="hero" size="xl" type="submit" className="w-full">
                  <ShieldCheck className="w-5 h-5" />
                  Finalizar Pedido — R$ {total.toFixed(2).replace(".", ",")}
                </Button>
              </form>

              {/* Summary */}
              <div className="lg:col-span-2">
                <div className="sticky top-8 p-6 rounded-2xl bg-card shadow-card border border-border space-y-6">
                  <h3 className="font-bold text-foreground text-lg">Resumo do Pedido</h3>
                  <div className="flex gap-4">
                    <img src={productHero} alt="ComfortPlus" className="w-20 h-20 rounded-xl object-cover bg-frost" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">ComfortPlus — Ar Portátil USB</p>
                      <p className="text-muted-foreground text-xs mt-1">Qtd: {quantity}</p>
                      <p className="text-primary font-bold mt-1">R$ {total.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm border-t border-border pt-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">R$ {total.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="text-success font-semibold">Grátis</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-bold text-foreground text-lg">R$ {total.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-success" />
                      <span>Compra 100% segura</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <span>Entrega em 3-7 dias úteis</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto text-center py-20 space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-success mx-auto flex items-center justify-center">
                <Check className="w-10 h-10 text-success-foreground" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground">Pedido Recebido!</h2>
              <p className="text-muted-foreground">
                Obrigado pela sua compra! Quando o gateway de pagamento for integrado, você receberá a confirmação por e-mail.
              </p>
              <Button variant="hero" size="lg" onClick={onBack}>
                Voltar à Loja
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
