import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ShieldCheck, Truck, ArrowLeft, Package } from "lucide-react";
import productHero from "@/assets/product-hero.png";
import { trackAddPaymentInfo, trackPurchase } from "@/lib/facebook-pixel";

const PRODUCT_NAME = "ComfortPlus — Ar Portátil USB";
const UNIT_PRICE = 59.9;

interface CheckoutPageProps {
  onBack: () => void;
  quantity: number;
  checkoutUrl: string;
}

export const CheckoutPage = ({ onBack, quantity, checkoutUrl }: CheckoutPageProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const total = UNIT_PRICE * quantity;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    cep: "",
    address: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fetchCep = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          address: data.logradouro ?? prev.address,
          neighborhood: data.bairro ?? prev.neighborhood,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCepBlur = () => {
    if (form.cep.trim()) fetchCep(form.cep);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    trackAddPaymentInfo(total, "BRL");
    trackPurchase(total, "BRL", PRODUCT_NAME, ["comfortplus-1"], quantity);

    window.location.href = checkoutUrl;
  };

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="container mx-auto px-6 py-8 md:py-12">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 md:mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar à loja
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid lg:grid-cols-5 gap-8 lg:gap-10"
        >
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-8">
            <Card className="border-border bg-card/80 shadow-card overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl">Dados pessoais</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Como no documento"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="(11) 99999-9999"
                    required
                    value={form.phone}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    name="cpf"
                    placeholder="000.000.000-00"
                    required
                    value={form.cpf}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/80 shadow-card overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl">Endereço de entrega</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    name="cep"
                    placeholder="00000-000"
                    required
                    value={form.cep}
                    onChange={handleChange}
                    onBlur={handleCepBlur}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="Sua cidade"
                    required
                    value={form.city}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Rua / Avenida</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Logradouro"
                    required
                    value={form.address}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    name="number"
                    placeholder="Nº"
                    required
                    value={form.number}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    name="complement"
                    placeholder="Apto, bloco (opcional)"
                    value={form.complement}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    name="neighborhood"
                    placeholder="Bairro"
                    value={form.neighborhood}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="UF"
                    required
                    value={form.state}
                    onChange={handleChange}
                    className="mt-1.5 rounded-xl bg-frost border-border"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/80 shadow-card overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Ao clicar em &quot;Ir para pagamento&quot;, você será redirecionado ao ambiente seguro da Cakto para finalizar o pagamento.
                </p>
              </CardContent>
            </Card>

            <Button
              type="submit"
              variant="hero"
              size="xl"
              className="w-full rounded-xl"
              disabled={isSubmitting}
            >
              <ShieldCheck className="w-5 h-5" />
              {isSubmitting ? "Redirecionando..." : `Ir para pagamento — R$ ${total.toFixed(2).replace(".", ",")}`}
            </Button>
          </form>

          <div className="lg:col-span-2">
            <Card className="sticky top-8 border-border bg-card shadow-card overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Resumo do pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <img
                    src={productHero}
                    alt={PRODUCT_NAME}
                    className="w-20 h-20 rounded-xl object-cover bg-frost shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm">{PRODUCT_NAME}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Qtd: {quantity}</p>
                    <p className="text-primary font-bold mt-1">R$ {(UNIT_PRICE * quantity).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm border-t border-border pt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">R$ {total.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-primary" />
                      Frete SEDEX
                    </span>
                    <span className="text-foreground font-medium">3 a 5 dias úteis</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-foreground text-lg">R$ {total.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                  <Package className="w-4 h-4 text-primary shrink-0" />
                  <span>Entrega via SEDEX para todo o Brasil. Prazo de 3 a 5 dias úteis.</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                  <span>Compra 100% segura. Ambiente protegido na Cakto.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
