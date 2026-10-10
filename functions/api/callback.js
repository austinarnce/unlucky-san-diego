
function escapeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function popupHtml(origin, payload, ok) {
  const message = ok
    ? `authorization:github:success:${JSON.stringify({ token: payload })}`
    : `authorization:github:error:${JSON.stringify({ message: payload })}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>UNLUCKY login</title>
</head>
<body>
  <p>${ok
    ? 'Login complete. You can close this window.'
    : 'Login failed. Close this window and try again.'}</p>

  <script>
    (function () {
      const origin = ${escapeForInlineScript(origin)};
      const message = ${escapeForInlineScript(message)};

      function receiveMessage(event) {
        if (event.origin !== origin) return;

        if (event.data === 'authorizing:github') {
          window.removeEventListener('message', receiveMessage);
          window.opener.postMessage(message, origin);
          setTimeout(() => window.close(), 800);
        }
      }

      window.addEventListener('message', receiveMessage);

      if (window.opener) {
        window.opener.postMessage('authorizing:github', origin);
      }
    })();
  </script>
</body>
</html>`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cookies = request.headers.get('Cookie') || '';

  const stateCookie = cookies
    .split(';')
    .map(x => x.trim())
    .find(x => x.startsWith('unlucky_oauth_state='))
    ?.split('=')[1];

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');

  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'Set-Cookie':
      'unlucky_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0',
  };

  if (!stateCookie || !state || stateCookie !== state || !code) {
    return new Response(
      popupHtml(url.origin, 'OAuth state validation failed or GitHub denied access.', false),
      { status: 400, headers }
    );
  }

  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return new Response(
      popupHtml(url.origin, 'OAuth credentials are missing in Cloudflare.', false),
      { status: 503, headers }
    );
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'UNLUCKY-Decap-CMS',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/callback`,
        state,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.access_token) {
      return new Response(
        popupHtml(
          url.origin,
          result.error_description || result.error || 'GitHub token exchange failed.',
          false
        ),
        { status: 502, headers }
      );
    }

    return new Response(
      popupHtml(url.origin, result.access_token, true),
      { headers }
    );
  } catch (_) {
    return new Response(
      popupHtml(url.origin, 'Could not contact GitHub.', false),
      { status: 502, headers }
    );
  }
}
