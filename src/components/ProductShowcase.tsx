import { motion } from "framer-motion";
import productLifestyle from "@/assets/product-lifestyle.png";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface ProductShowcaseProps {
  onAddToCart: () => void;
}

export const ProductShowcase = ({ onAddToCart }: ProductShowcaseProps) => {
  return (
    <section className="py-24 bg-frost-gradient">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={productLifestyle}
              alt="ComfortPlus em uso no escritório"
              className="rounded-3xl shadow-elevated w-full"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <span className="text-primary font-semibold text-sm tracking-widest uppercase">Experiência Real</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight">
              Seu Espaço. <br />
              <span className="text-gradient">Seu Clima.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Esqueça os dias sufocantes no escritório, em casa ou no quarto. O ComfortPlus cria uma zona de conforto pessoal em
              segundos. Bivolt (127V/220V), carregamento USB e design compacto para levar para qualquer lugar.
            </p>

            <div className="space-y-4">
              {[
                "7 cores de LED — ambiente personalizado para cada momento",
                "Resfria e umidifica — combate o calor e o ar seco",
                "3 velocidades — do modo suave ao turbo refrescante",
                "Bivolt (127V/220V) + Carregamento USB — use em qualquer lugar",
                "Compacto e silencioso — perfeito para mesa, quarto ou escritório",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cta-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-foreground text-sm">{item}</p>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-4">
              <div>
                <p className="text-sm text-muted-foreground line-through">R$ 119,90</p>
                <p className="text-3xl font-extrabold text-foreground">R$ 59<span className="text-lg">,90</span></p>
                <p className="text-xs text-success font-semibold">50% OFF — Oferta por tempo limitado</p>
              </div>
              <Button variant="hero" size="lg" onClick={onAddToCart}>
                <ShoppingCart className="w-5 h-5" />
                Adicionar ao Carrinho
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
