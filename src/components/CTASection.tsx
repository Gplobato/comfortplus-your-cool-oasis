import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Shield, Truck, RotateCcw } from "lucide-react";

interface CTASectionProps {
  onAddToCart: () => void;
}

export const CTASection = ({ onAddToCart }: CTASectionProps) => {
  return (
    <section className="py-24 bg-hero-gradient">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center space-y-8"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold text-foreground">
            Garanta o Seu <span className="text-gradient">ComfortPlus</span> Hoje
          </h2>
          <p className="text-muted-foreground text-lg">
            Oferta especial com <strong className="text-foreground">40% de desconto</strong> + frete grátis para todo o Brasil.
            Estoque limitado — não perca!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground line-through">R$ 497,00</p>
              <p className="text-4xl font-extrabold text-foreground">R$ 297<span className="text-lg">,00</span></p>
              <p className="text-sm text-primary font-semibold">ou 12x de R$ 29,06</p>
            </div>
          </div>

          <Button variant="hero" size="xl" onClick={onAddToCart} className="mx-auto">
            <ShoppingCart className="w-5 h-5" />
            Quero o Meu ComfortPlus!
          </Button>

          <div className="grid sm:grid-cols-3 gap-6 pt-8">
            {[
              { icon: Shield, title: "Compra Segura", desc: "Seus dados 100% protegidos" },
              { icon: Truck, title: "Frete Grátis", desc: "Entrega para todo o Brasil" },
              { icon: RotateCcw, title: "30 Dias de Garantia", desc: "Devolução sem burocracia" },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-2">
                <item.icon className="w-8 h-8 text-primary" />
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
