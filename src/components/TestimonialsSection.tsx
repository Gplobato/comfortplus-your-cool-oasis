import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Mariana Silva",
    role: "Designer Freelancer",
    rating: 5,
    text: "Mudou completamente meu home office! Antes eu não conseguia trabalhar à tarde por causa do calor. Agora fico confortável o dia inteiro. Vale cada centavo!",
    avatar: "MS",
  },
  {
    name: "Rafael Santos",
    role: "Desenvolvedor",
    rating: 5,
    text: "Comprei com certa desconfiança, mas fui surpreendido. Resfria de verdade, é silencioso e o design é lindo na mesa. Já indiquei para 5 amigos.",
    avatar: "RS",
  },
  {
    name: "Ana Carolina Lima",
    role: "Estudante de Medicina",
    rating: 5,
    text: "Estudo muitas horas por dia e o calor era meu pior inimigo. O ComfortPlus resolveu isso de forma simples e barata. Amo a função umidificador!",
    avatar: "AL",
  },
  {
    name: "Pedro Oliveira",
    role: "Empresário",
    rating: 5,
    text: "Comprei 10 unidades para o escritório. Cada colaborador tem o seu e a satisfação da equipe aumentou demais. Investimento inteligente!",
    avatar: "PO",
  },
  {
    name: "Juliana Ferreira",
    role: "Influenciadora Digital",
    rating: 5,
    text: "Mostrei nos stories e esgotou o estoque em 2 horas! Produto incrível, funciona muito bem e é super instagramável. Amei!",
    avatar: "JF",
  },
  {
    name: "Carlos Eduardo",
    role: "Gamer Profissional",
    rating: 5,
    text: "Setup gamer + calor = pesadelo. O ComfortPlus resolveu. USB direto no PC, super silencioso e mantém o cantinho fresco durante as streams.",
    avatar: "CE",
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm tracking-widest uppercase">Depoimentos</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mt-3">
            Mais de <span className="text-gradient">50.000 Clientes</span> Satisfeitos
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-lg">
            Veja o que dizem quem já transformou seu conforto com o ComfortPlus.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-2xl bg-frost shadow-card hover:shadow-soft transition-shadow duration-300"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-gold text-gold" />
                ))}
              </div>
              <p className="text-foreground text-sm leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cta-gradient flex items-center justify-center text-primary-foreground text-sm font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
