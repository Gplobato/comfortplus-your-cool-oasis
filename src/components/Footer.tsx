import { Snowflake, Instagram, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-foreground py-12">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 items-center">
          <div className="flex items-center gap-2">
            <Snowflake className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold text-primary-foreground">ComfortPlus</span>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              © 2025 ComfortPlus. Todos os direitos reservados.
            </p>
            <p className="text-xs text-muted-foreground">
              CNPJ: 41.353.783/0001-74
            </p>
          </div>

          <div className="flex items-center gap-4 md:justify-end">
            <a href="#" className="p-2 rounded-full hover:bg-muted/10 transition-colors">
              <Instagram className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
            </a>
            <a href="#" className="p-2 rounded-full hover:bg-muted/10 transition-colors">
              <Mail className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
