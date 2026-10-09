// Cloudflare Pages Function: start Decap CMS GitHub OAuth login.
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return new Response('GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET in Cloudflare Pages settings.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const callback = `${url.origin}/api/callback`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('scope', 'public_repo');
  authorize.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `unlucky_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
