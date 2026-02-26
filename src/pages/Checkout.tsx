import { useLocation, useNavigate } from "react-router-dom";
import { CheckoutPage } from "@/components/CheckoutPage";

const CHECKOUT_URL = "https://pay.cakto.com.br/3coih6e_784318";

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const quantity = (location.state as { quantity?: number } | null)?.quantity ?? 1;

  return (
    <CheckoutPage
      quantity={quantity}
      checkoutUrl={CHECKOUT_URL}
      onBack={() => navigate("/")}
    />
  );
};

export default Checkout;
