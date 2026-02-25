import { motion } from "framer-motion";
import { Snowflake } from "lucide-react";
import { CartDrawer, type CartItem } from "./CartDrawer";

interface NavbarProps {
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

export const Navbar = ({ cartItems, onUpdateQuantity, onRemoveItem, onCheckout }: NavbarProps) => {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-40 glass"
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Snowflake className="w-6 h-6 text-primary" />
          <span className="text-lg font-bold text-foreground">ComfortPlus</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {["Início", "Recursos", "Depoimentos"].map((item) => (
            <a
              key={item}
              href={`#${item === "Início" ? "" : item === "Recursos" ? "features" : "testimonials"}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item}
            </a>
          ))}
        </div>

        <CartDrawer
          items={cartItems}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemoveItem}
          onCheckout={onCheckout}
        />
      </div>
    </motion.nav>
  );
};
