import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Snowflake } from "lucide-react";
import productHero from "@/assets/product-hero.png";

interface HeroSectionProps {
  onAddToCart: () => void;
}

export const HeroSection = ({ onAddToCart }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen bg-hero-gradient overflow-hidden flex items-center">
      {/* Floating frost particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/10"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-6 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ice text-ice-foreground text-sm font-medium">
              <Snowflake className="w-4 h-4" />
              <span>Tecnologia de Refrigeração Avançada</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] text-foreground">
              Conforto
              <br />
              <span className="text-gradient">Gelado</span>
              <br />
              Na Sua Mesa
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              O <strong className="text-foreground">ComfortPlus</strong> é o ar condicionado portátil que resfria, umidifica e
              ilumina com 7 cores de LED. Bivolt (127V/220V), carregamento USB,{" "}
              <strong className="text-foreground">3 velocidades</strong> e design compacto.
              Refresque seu espaço pessoal em segundos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" onClick={() => window.open("https://pay.cakto.com.br/3coih6e_784318", "_blank")}>
                <ShoppingCart className="w-5 h-5" />
                Comprar Agora — R$ 59,90
              </Button>
              <Button variant="heroOutline" size="xl" onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}>
                Saiba Mais
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">50k+</p>
                <p className="text-xs text-muted-foreground">Unidades Vendidas</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">4.9★</p>
                <p className="text-xs text-muted-foreground">Avaliação Média</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">30 dias</p>
                <p className="text-xs text-muted-foreground">Garantia Total</p>
              </div>
            </div>
          </motion.div>

          {/* Product Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
            <motion.img
              src={productHero}
              alt="ComfortPlus - Ar Condicionado Portátil USB"
              className="relative w-full max-w-md lg:max-w-lg drop-shadow-2xl"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
