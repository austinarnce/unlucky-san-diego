const respond = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a[i] ^ b[i];
  }
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return respond({ error: "Webhook not configured" }, 503);
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return respond({ error: "Missing signature" }, 400);
    }

    const body = await request.text();

    // Stripe signs the exact raw request body.
    const parts = signature.split(",");
    const timestamp = parts
      .find(part => part.startsWith("t="))
      ?.slice(2);

    const signatures = parts
      .filter(part => part.startsWith("v1="))
      .map(part => part.slice(3));

    if (!timestamp || !signatures.length) {
      return respond({ error: "Invalid signature" }, 400);
    }

    // Reject old webhook requests.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) {
      return respond({ error: "Expired signature" }, 400);
    }

    const encoder = new TextEncoder();

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
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");

    const valid = signatures.some(sig => {
      if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
      const actual = new Uint8Array(
        sig.match(/.{2}/g).map(hex => parseInt(hex, 16))
      );
      return safeEqual(digest, actual);
    });

    if (!valid) {
      return respond({ error: "Invalid signature" }, 400);
    }

    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.payment_status === "paid") {
        console.log("Verified paid checkout session:", session.id);

        // Next step:
        // Save the order and send an email notification.
      }
    }

    return respond({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return respond({ error: "Webhook processing failed" }, 500);
  }
}
