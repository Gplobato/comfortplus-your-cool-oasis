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

/** Disparado quando o usuário informa dados de pagamento (antes de redirecionar ao gateway). */
export function trackAddPaymentInfo(value: number, currency = "BRL") {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", "AddPaymentInfo", {
    value,
    currency,
  });
}

/** Disparado na conversão: usuário confirmou e está sendo redirecionado ao pagamento. */
export function trackPurchase(
  value: number,
  currency = "BRL",
  contentName?: string,
  contentIds?: string[],
  numItems?: number
) {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", "Purchase", {
    value,
    currency,
    content_name: contentName,
    content_ids: contentIds,
    num_items: numItems,
  });
}
