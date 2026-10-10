const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const encoder = new TextEncoder();

async function verifyStripeSignature(body, header, secret) {
  if (!header || !secret) return false;

  const parts = header.split(",").map(p => p.trim());
  const timestamp = parts.find(p => p.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter(p => p.startsWith("v1="))
    .map(p => p.slice(3));

  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) {
    return false;
  }

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${timestamp}.${body}`)
    )
  );

  const expected = Array.from(digest)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some(sig => {
    if (!/^[a-f0-9]{64}$/i.test(sig)) return false;

    let difference = 0;
    const actual = sig.toLowerCase();

    for (let i = 0; i < expected.length; i++) {
      difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    }

    return difference === 0;
  });
}

async function stripeGet(path, secret) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Stripe API error: ${response.status}`);
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export async function onRequestPost({ request, env }) {
  try {
    if (
      !env.STRIPE_WEBHOOK_SECRET ||
      !env.STRIPE_SECRET_KEY ||
      !env.RESEND_API_KEY
    ) {
      return json({ error: "Missing configuration" }, 503);
    }

    const body = await request.text();

    const valid = await verifyStripeSignature(
      body,
      request.headers.get("stripe-signature"),
      env.STRIPE_WEBHOOK_SECRET
    );

    if (!valid) {
      return json({ error: "Invalid Stripe signature" }, 400);
    }

    const event = JSON.parse(body);

    if (event.type !== "checkout.session.completed") {
      return json({ received: true });
    }

    const session = event.data.object;

    if (session.payment_status !== "paid") {
      return json({ received: true });
    }

    // Retrieve the current session directly from Stripe.
    const verifiedSession = await stripeGet(
      `checkout/sessions/${encodeURIComponent(session.id)}`,
      env.STRIPE_SECRET_KEY
    );

    if (
      verifiedSession.payment_status !== "paid" ||
      verifiedSession.status !== "complete"
    ) {
      return json({ error: "Payment not confirmed" }, 409);
    }

    // Retrieve purchased products and quantities.
    const lineItems = await stripeGet(
      `checkout/sessions/${encodeURIComponent(session.id)}/line_items?limit=100`,
      env.STRIPE_SECRET_KEY
    );

    const customer = verifiedSession.customer_details || {};
    const address = customer.address || {};
    const shipping = verifiedSession.collected_information?.shipping_details
      || verifiedSession.shipping_details
      || {};

    const shippingAddress = shipping.address || address;

    const itemsHtml = (lineItems.data || []).map(item =>
      `<li>${escapeHtml(item.description)} — Qty: ${item.quantity}</li>`
    ).join("");

    const total = (
      (verifiedSession.amount_total || 0) / 100
    ).toFixed(2);

    const html = `
      <h2>New UNLUCKY San Diego Order</h2>
      <p><strong>Order ID:</strong> ${escapeHtml(session.id)}</p>
      <p><strong>Customer:</strong> ${escapeHtml(customer.name || shipping.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customer.email)}</p>

      <h3>Purchased Items</h3>
      <ul>${itemsHtml}</ul>

      <p><strong>Total Paid:</strong> $${total}</p>

      <h3>Shipping Address</h3>
      <p>
        ${escapeHtml(shipping.name || customer.name)}<br>
        ${escapeHtml(shippingAddress.line1)}<br>
        ${escapeHtml(shippingAddress.line2)}<br>
        ${escapeHtml(shippingAddress.city)},
        ${escapeHtml(shippingAddress.state)}
        ${escapeHtml(shippingAddress.postal_code)}<br>
        ${escapeHtml(shippingAddress.country)}
      </p>

      <p>Verify this order in Stripe before fulfilling it through Tapstitch.</p>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `unlucky-${session.id}`
      },
      body: JSON.stringify({
        from: "UNLUCKY Orders <onboarding@resend.dev>",
        to: ["austinarnce@gmail.com"],
        subject: `New UNLUCKY Order — $${total}`,
        html
      })
    });

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResponse.status);
      return json({ error: "Email notification failed" }, 502);
    }

    return json({ received: true });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
}
