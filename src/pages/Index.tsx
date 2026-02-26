import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { ProductShowcase } from "@/components/ProductShowcase";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import type { CartItem } from "@/components/CartDrawer";
import productHero from "@/assets/product-hero.png";
import { trackAddToCart, trackInitiateCheckout } from "@/lib/facebook-pixel";

const PRODUCT: Omit<CartItem, "quantity"> = {
  id: "comfortplus-1",
  name: "ComfortPlus — Ar Condicionado Portátil USB",
  price: 59.9,
  image: productHero,
};

const Index = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const goToCheckout = (quantity: number) => {
    const total = quantity * PRODUCT.price;
    trackInitiateCheckout(total, "BRL");
    navigate("/checkout", { state: { quantity } });
  };

  const addToCart = () => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === PRODUCT.id);
      const next = existing
        ? prev.map((item) =>
            item.id === PRODUCT.id ? { ...item, quantity: item.quantity + 1 } : item
          )
        : [...prev, { ...PRODUCT, quantity: 1 }];
      trackAddToCart(PRODUCT.price, "BRL", PRODUCT.name);
      return next;
    });
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCartItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
      );
    }
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };



  return (
    <div className="min-h-screen">
      <Navbar
        cartItems={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onCheckout={() => {
          const qty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
          if (qty === 0) return;
          goToCheckout(qty);
        }}
      />
      <HeroSection onAddToCart={addToCart} onGoToCheckout={() => goToCheckout(1)} />
      <FeaturesSection />
      <ProductShowcase onAddToCart={addToCart} />
      <div id="testimonials">
        <TestimonialsSection />
      </div>
      <CTASection onAddToCart={addToCart} onGoToCheckout={() => goToCheckout(1)} />
      <Footer />
    </div>
  );
};

export default Index;
