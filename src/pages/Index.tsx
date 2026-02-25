import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { ProductShowcase } from "@/components/ProductShowcase";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import { CheckoutPage } from "@/components/CheckoutPage";
import type { CartItem } from "@/components/CartDrawer";
import productHero from "@/assets/product-hero.png";

const PRODUCT: Omit<CartItem, "quantity"> = {
  id: "comfortplus-1",
  name: "ComfortPlus — Ar Condicionado Portátil USB",
  price: 297,
  image: productHero,
};

const Index = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  const addToCart = () => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === PRODUCT.id);
      if (existing) {
        return prev.map((item) =>
          item.id === PRODUCT.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...PRODUCT, quantity: 1 }];
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

  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (showCheckout) {
    return (
      <CheckoutPage
        onBack={() => setShowCheckout(false)}
        quantity={totalQuantity || 1}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar
        cartItems={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onCheckout={() => setShowCheckout(true)}
      />
      <HeroSection onAddToCart={addToCart} />
      <FeaturesSection />
      <ProductShowcase onAddToCart={addToCart} />
      <div id="testimonials">
        <TestimonialsSection />
      </div>
      <CTASection onAddToCart={addToCart} />
      <Footer />
    </div>
  );
};

export default Index;
