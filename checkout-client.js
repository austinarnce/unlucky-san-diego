// Loaded after store.js (both scripts use defer). Uses the existing cart variable.
(() => {
  const button = document.getElementById('checkout');
  if (!button) return;
  button.onclick = async () => {
    if (!Array.isArray(cart) || cart.length === 0) {
      alert('Your bag is empty.');
      return;
    }
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'OPENING SECURE CHECKOUT…';
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map(({ id, size, qty }) => ({ id, size, qty })) })
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Checkout could not start.');
      const destination = new URL(result.url);
      if (destination.protocol !== 'https:' || !['checkout.stripe.com', 'checkout.stripe.dev'].includes(destination.hostname)) throw new Error('Unexpected checkout destination.');
      location.assign(result.url);
    } catch (error) {
      alert(error.message || 'Checkout unavailable. Please try again.');
      button.disabled = false;
      button.textContent = previous;
    }
  };
})();
