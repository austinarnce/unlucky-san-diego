const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_SECRET_KEY.startsWith('sk_')) return json({ error: 'Stripe is not configured yet.' }, 503);
    if (!env.CHECKOUT_ENABLED || env.CHECKOUT_ENABLED !== 'true') return json({ error: 'Checkout is not enabled yet.' }, 503);
    const origin = new URL(request.url).origin;
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: 'Cart is too large.' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid cart.' }, 400); }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) return json({ error: 'Invalid cart.' }, 400);
    const catalogResponse = await env.ASSETS.fetch(new Request(`${origin}/content.json`));
    if (!catalogResponse.ok) return json({ error: 'Product catalog unavailable.' }, 503);
    const catalog = await catalogResponse.json();
    const products = new Map((catalog.products || []).filter(p => p.active === true).map(p => [p.id, p]));
    const combined = new Map();
    let totalUnits = 0;
    for (const item of body.items) {
      if (!item || typeof item.id !== 'string' || typeof item.size !== 'string' || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 20) return json({ error: 'Invalid product selection.' }, 400);
      const product = products.get(item.id);
      if (!product || !Array.isArray(product.sizes) || !product.sizes.includes(item.size)) return json({ error: 'An item or size is no longer available. Refresh the page.' }, 400);
      if (typeof product.name !== 'string' || !product.name.trim() || typeof product.price !== 'number' || !Number.isFinite(product.price)) return json({ error: 'Invalid product configuration.' }, 503);
      const cents = Math.round(product.price * 100);
      if (cents < 50 || cents > 10000000 || Math.abs(product.price * 100 - cents) > 0.00001) return json({ error: 'Invalid product price.' }, 503);
      const key = `${item.id}\u0000${item.size}`;
      const prior = combined.get(key);
      const quantity = (prior?.qty || 0) + item.qty;
      if (quantity > 20) return json({ error: 'Maximum 20 of each size.' }, 400);
      combined.set(key, { product, size: item.size, qty: quantity, cents });
      totalUnits += item.qty;
    }
    if (totalUnits > 50) return json({ error: 'Maximum 50 items per order.' }, 400);
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${origin}/shop.html`);
    params.set('billing_address_collection', 'auto');
    params.set('shipping_address_collection[allowed_countries][0]', 'US');
    params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
    params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
    params.set('shipping_options[0][shipping_rate_data][display_name]', 'Free US shipping');
    params.set('phone_number_collection[enabled]', 'false');
    params.set('customer_creation', 'always');
    params.set('payment_method_types[0]', 'card');
    params.set('metadata[store]', 'UNLUCKY San Diego');
    params.set('automatic_tax[enabled]', env.STRIPE_AUTOMATIC_TAX === 'true' ? 'true' : 'false');
    let i = 0;
    for (const { product, size, qty, cents } of combined.values()) {
      const prefix = `line_items[${i}]`;
      params.set(`${prefix}[price_data][currency]`, 'usd');
      params.set(`${prefix}[price_data][unit_amount]`, String(cents));
      params.set(`${prefix}[price_data][product_data][name]`, `${product.name} — ${size}`.slice(0, 250));
      params.set(`${prefix}[quantity]`, String(qty));
      i++;
    }
    const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const result = await stripe.json();
    if (!stripe.ok || !result.url) {
      console.error('Stripe checkout error', result.error?.code, result.error?.message);
      return json({ error: result.error?.message || 'Unable to start checkout.' }, 502);
    }
    return json({ url: result.url });
  } catch (err) {
    console.error('Checkout failed', err);
    return json({ error: 'Checkout is temporarily unavailable.' }, 500);
  }
}
