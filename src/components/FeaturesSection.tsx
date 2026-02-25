import { motion } from "framer-motion";
import { Wind, Zap, Volume2, Droplets, Thermometer, Usb } from "lucide-react";

const features = [
  {
    icon: Thermometer,
    title: "3.000 BTUs Equivalentes",
    description: "Potência real de refrigeração que reduz a temperatura em até 12°C no seu espaço pessoal.",
  },
  {
    icon: Usb,
    title: "Alimentação USB",
    description: "Conecte em qualquer porta USB, power bank ou tomada. Praticidade total onde você estiver.",
  },
  {
    icon: Volume2,
    title: "Ultra Silencioso",
    description: "Apenas 28dB no modo sleep. Perfeito para trabalhar, estudar ou dormir sem interrupções.",
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
