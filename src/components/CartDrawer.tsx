import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Minus, Plus, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export const CartDrawer = ({ items, onUpdateQuantity, onRemove, onCheckout }: CartProps) => {
  const [open, setOpen] = useState(false);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-full hover:bg-secondary transition-colors"
      >
        <ShoppingCart className="w-6 h-6 text-foreground" />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-cta-gradient text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold"
          >
            {count}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-50 shadow-elevated flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">Seu Carrinho</h2>
                <button onClick={() => setOpen(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Seu carrinho está vazio</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex gap-4 p-4 rounded-xl bg-frost"
                    >
                      <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                        <p className="text-primary font-bold mt-1">
                          R$ {item.price.toFixed(2).replace(".", ",")}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                            className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Minus className="w-3 h-3 text-foreground" />
                          </button>
                          <span className="text-sm font-semibold text-foreground w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Plus className="w-3 h-3 text-foreground" />
                          </button>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="ml-auto p-1 hover:bg-secondary rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="p-6 border-t border-border space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground font-bold text-lg">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-success font-medium">🚚 Frete Grátis</span>
                  </div>
                  <Button
                    variant="hero"
                    size="xl"
                    className="w-full"
                    onClick={() => {
                      onCheckout();
                      setOpen(false);
                    }}
                  >
                    <CreditCard className="w-5 h-5" />
                    Finalizar Compra
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
