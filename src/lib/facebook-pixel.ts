/**
 * Utilitário para disparar eventos do Facebook Pixel a partir do React.
 * O pixel base (init + PageView) é carregado no index.html.
 */
export function trackAddToCart(value: number, currency = "BRL", contentName?: string) {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", "AddToCart", {
    value,
    currency,
    content_name: contentName,
  });
}

export function trackInitiateCheckout(value: number, currency = "BRL") {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", "InitiateCheckout", {
    value,
    currency,
  });
}
