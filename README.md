# UNLUCKY San Diego — editable storefront starter

## Included
- Retro San Diego responsive storefront
- All 12 currently listed Wix products (names and displayed prices)
- Product size selectors and client-side shopping cart
- Editable content in `content.json`
- Browser-based Decap CMS configuration in `admin/`

## IMPORTANT
This is a **starter**, not a live shop. Stripe checkout is **not connected**. The checkout button intentionally cannot take payment. Stock, taxes, shipping, secure payment verification, and fulfillment must be implemented before launch. Never trust prices sent from a browser; the server must verify product IDs and prices.

## Preview locally
From this folder run `python3 -m http.server 8000`, then visit http://localhost:8000 . Or deploy to Cloudflare Pages.

## Online editing setup
1. Create a GitHub repository and upload these files.
2. Edit `admin/config.yml` and replace `YOUR_GITHUB_USERNAME/unlucky-site` with your repository path.
3. Connect the repository to Cloudflare Pages (no build command, output directory `/`).
4. Configure GitHub OAuth for Decap CMS using a trusted OAuth proxy or Decap Turbo as described at https://decapcms.org/docs/backends-overview/ . **The `/admin/` login will not work until OAuth is configured.** Some managed authentication services may have costs.
5. Once authenticated, use `https://your-domain/admin/` to edit homepage copy and product records. Changes commit to GitHub and trigger redeploys.
6. Add your own product images in the editor or repository, and confirm you have rights to use them.

## Payments
Integrate Stripe Checkout using Cloudflare Pages Functions and Stripe's secret key stored as an environment secret, not in public code. Implement server-side cart validation, checkout sessions, webhook signature verification, and order fulfillment. Fees and free-tier limits apply.

## Domain
You can connect an existing domain to Cloudflare Pages, but purchasing/renewing the domain isn't free. The current `wixsite.com` subdomain cannot be transferred as your custom domain.
<!-- Stripe checkout deployment refresh -->
