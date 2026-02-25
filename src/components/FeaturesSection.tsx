import { motion } from "framer-motion";
import { Wind, Zap, Volume2, Droplets, Thermometer, Usb, Lightbulb, PlugZap } from "lucide-react";

const features = [
  {
    icon: Thermometer,
    title: "Resfriamento Poderoso",
    description: "Reduz a temperatura do seu espaço pessoal em segundos. Ideal para escritório, quarto e home office.",
  },
  {
    icon: Usb,
    title: "Carregamento USB",
    description: "Conecte em qualquer porta USB, power bank ou notebook. Praticidade total onde você estiver.",
  },
  {
    icon: PlugZap,
    title: "Bivolt 127V / 220V",
    description: "Funciona em qualquer tomada do Brasil. Sem adaptadores, sem complicações.",
  },
  {
    icon: Wind,
    title: "3 Velocidades",
    description: "Controle preciso do fluxo de ar frio. Do modo suave ao turbo, você escolhe o conforto ideal.",
  },
  {
    icon: Droplets,
    title: "Umidificador Integrado",
    description: "Além de resfriar, umidifica o ar, combatendo o ressecamento e melhorando a qualidade do ambiente.",
  },
  {
    icon: Lightbulb,
    title: "7 Cores de LED",
    description: "Iluminação ambiente com 7 cores para personalizar seu espaço e criar o clima perfeito.",
  },
  {
    icon: Volume2,
    title: "Ultra Silencioso",
    description: "Perfeito para trabalhar, estudar ou dormir sem interrupções. Conforto sem ruído.",
  },
  {
    icon: Zap,
    title: "Baixo Consumo",
    description: "Economia de até 95% comparado a um ar condicionado convencional. Sustentável e econômico.",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm tracking-widest uppercase">Tecnologia</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mt-3">
            Por Que Escolher o <span className="text-gradient">ComfortPlus</span>?
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
            Engenharia de ponta em um design compacto. Cada detalhe foi pensado para entregar a melhor experiência de refrigeração pessoal.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-8 rounded-2xl bg-frost hover:bg-ice transition-all duration-300 shadow-card hover:shadow-soft"
            >
              <div className="w-12 h-12 rounded-xl bg-cta-gradient flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
