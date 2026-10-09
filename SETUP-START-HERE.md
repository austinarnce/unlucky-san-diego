# UNLUCKY Store Editor — setup guide

Your existing storefront is preserved. This package adds a Decap CMS editor at:

**https://unlucky-san-diego.pages.dev/admin/**

**The editor will not be able to log in until the GitHub OAuth app and Cloudflare secrets are configured.** The login is not ready merely by uploading this ZIP. Checkout is still DEMO ONLY.

## Step 1 — Replace the repository files

In GitHub, open `austinarnce/unlucky-san-diego` on `main`. Upload the contents of this ZIP (not the outer folder), replacing matching files and adding the new `functions/`, `images/`, and `admin/editor-logo.svg`. You can also use GitHub Desktop or a git client. Review changes before committing. Cloudflare Pages should redeploy automatically after the commit.

**Cloudflare Pages Functions must be deployed from the `functions/` directory at the project root.** The deployment must be Git-connected and have Functions enabled; a static drag-and-drop upload will not run the OAuth functions.

## Step 2 — Create a GitHub OAuth app

1. Sign in to GitHub. Go to **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Application name:** `UNLUCKY Store Editor`.
3. **Homepage URL:** `https://unlucky-san-diego.pages.dev`.
4. **Authorization callback URL:** `https://unlucky-san-diego.pages.dev/api/callback`.
5. Register the app and copy its **Client ID**. Generate a **Client Secret**. Keep the secret private.

If you later use a custom domain, update the homepage/callback and `admin/config.yml` to match the actual editor domain. OAuth callback must match the domain serving `/admin/`.

## Step 3 — Add Cloudflare Pages environment variables

In Cloudflare Dashboard → **Workers & Pages** → your Pages project → **Settings → Variables and Secrets** (wording can vary):

- `GITHUB_OAUTH_CLIENT_ID`: your GitHub OAuth app Client ID.
- `GITHUB_OAUTH_CLIENT_SECRET`: your GitHub OAuth app Client Secret. Mark it as encrypted/secret where supported.

Add both to the **Production** environment. Redeploy the Pages project so the Functions receive them. **Never put the Client Secret in GitHub files, content.json, or screenshots.**

## Step 4 — Test the editor

1. Visit `https://unlucky-san-diego.pages.dev/api/auth` — it should redirect to GitHub, not display a missing-credentials message. If you test here, finish or cancel the authorization.
2. Visit `https://unlucky-san-diego.pages.dev/admin/` and click **Login with GitHub**.
3. In **UNLUCKY Store → Homepage & Products**, change a harmless piece of copy and save/publish.
4. Verify the change committed to GitHub and appeared on the Cloudflare site after deployment.
5. Upload a product photo via the editor, confirm it is saved in `images/`, and verify it displays on the site.

## What the editor changes

- Homepage tagline and brand story
- Product names, prices, images, sizes, and whether they appear on the site
- Product list order, including adding and removing products

The visual layout (CSS/HTML) is not drag-and-drop editable through Decap CMS. New product images are stored in `images/`.

## Security and limitations

- This implementation uses GitHub OAuth with `public_repo` scope, which can authorize access to public repositories in your GitHub account. Review the GitHub permission screen before approving. You can revoke the OAuth app later in GitHub settings.
- The editor URL is public, but only GitHub users who can write to the configured repository should be able to publish changes. Do not share GitHub credentials or OAuth secrets.
- This is a simple OAuth integration, not a full authentication service. For a production store, consider an independently maintained/authenticated CMS backend and security review.
- **Checkout still does not take real payments.** Stripe, inventory, tax, shipping, and order fulfillment are not configured.
- GitHub, Decap CMS, and Cloudflare Pages can be used without a monthly subscription within their respective free-tier limits. Domain registration, transaction fees, and optional services can cost money.

## Troubleshooting

- `/api/auth` says credentials missing: Cloudflare secrets are absent or deployment not refreshed.
- `/api/auth` returns 404: Pages Functions are not deployed; verify root `functions/` directory and Git deployment.
- GitHub says callback mismatch: check OAuth app callback exactly matches `/api/callback` on your live editor domain.
- Decap logs in but can't save: verify you're using a GitHub account with write access to `austinarnce/unlucky-san-diego` and the repository/branch are correct.
