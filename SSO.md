# PEA SSO Login

## Flow

1. User clicks **"เข้าสู่ระบบด้วย PEA SSO"** on the login page ([src/components/Auth.jsx](src/components/Auth.jsx)).
   This is a plain `<a href="{VITE_API_BASE_URL}/api/auth/sso/login">` — a full browser
   navigation, not a `fetch`/`axios` call — because the backend needs to redirect the
   whole page through the PEA SSO provider and back.

2. Backend authenticates with PEA SSO, then redirects the browser back to the frontend
   callback URL with the result in the **URL fragment** (never the query string or path,
   so it's never logged server-side):

   ```
   {FRONTEND_SSO_CALLBACK_URL}#token=<jwt>&user=<url-encoded JSON>
   ```

3. [src/components/SsoCallback.jsx](src/components/SsoCallback.jsx) (route `/sso-callback`,
   registered in [src/App.jsx](src/App.jsx)) reads the fragment with `URLSearchParams`,
   parses `user` as JSON, and calls the same `onAuthSuccess(userData, token)` used by the
   normal username/password login — so both flows end up in identical `localStorage` /
   app state. No separate parser.

4. On success, the user lands on the dashboard automatically. On a missing/malformed
   fragment, the page shows a Thai error message with a button back to `/login` instead
   of crashing.

## Logout

SSO-authenticated users carry a Keycloak session/cookie that our own JWT
blacklist doesn't touch, so logout needs an extra step. [src/App.jsx](src/App.jsx)
records how the user logged in (`localStorage.auth_provider`, set to `'sso'`
or `'local'` in `handleAuthSuccess`) and branches in `handleLogout`:

- **Local login** (unchanged): fire-and-forget `POST /api/auth/logout`, clear
  local state, `navigate('login')` immediately. Never blocks on the network.
- **SSO login**: clear local state immediately (same as local), then
  `POST /api/auth/logout` to blacklist our JWT (5s timeout so a hung backend
  can't strand the user), and only after that finishes (success, error, or
  timeout) do a full-page `window.location.href = "{VITE_API_BASE_URL}/api/auth/sso/logout"`.
  This must be a real navigation, not `fetch` — the browser needs to actually
  land on that URL for Keycloak to clear its own session cookie.

## Config

- **`FRONTEND_SSO_CALLBACK_URL`** (backend `.env`): `http://172.21.5.254:5173/sso-callback`
  (current LAN dev address this project is tested against). Update this if the frontend
  is deployed to a different host/port.

## Deployment note

This app is a client-side-routed SPA (no server-side routes). If it's served from a
static host (nginx, etc.) in production, that host **must** rewrite all unmatched paths
to `index.html` (SPA fallback), or a direct browser navigation to `/sso-callback` (and
any other in-app path) will 404. Vite's own dev server already does this automatically.
