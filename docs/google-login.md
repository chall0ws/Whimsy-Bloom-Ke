# Switching on Google login

The app signs people in with Google through **Supabase Auth** (free tier is enough). Until you finish these steps it runs in **demo mode**: the "Continue with Google" button opens a pretend account picker.

Who sees what after signing in:

- **Team** (the emails in `VITE_STAFF_EMAILS`) → the dashboard. `SUPER_ADMIN` sees everything; `ADMIN` can't change fees or settings, or confirm payouts.
- **Everyone else** → the client portal (`#/portal`), with their own orders, payments, chat and details.

It takes about 15 minutes. You need a Google account and a Supabase account.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**. Name it `whimsy-bloom`, pick a region near Kenya (e.g. *Frankfurt* or *Cape Town* if offered), set a database password and create it.
2. Open **Project Settings → API** (also shown under **Connect**). Copy the **Project URL** and the **anon / publishable key**. You'll need them in step 4.
3. Note your **callback URL**. It's your Project URL plus `/auth/v1/callback`, for example:
   `https://abcdefghijkl.supabase.co/auth/v1/callback`
   (The Google provider page in step 3 also shows it, with a copy button.)

## 2. Create the Google sign-in client

In the [Google Cloud console](https://console.cloud.google.com/):

1. Create a project (top bar → project picker → **New project**), e.g. `Whimsy and Bloom`.
2. Open **Google Auth Platform** (search for it; older consoles call it **APIs & Services → OAuth consent screen**) and click **Get started**:
   - **App name:** Whimsy & Bloom. **User support email:** your email.
   - **Audience:** *External* (customers have ordinary Gmail accounts).
   - **Contact information:** your email. Agree and **Create**.
3. **Branding:** add the logo if you like. Under **Authorized domains** add `supabase.co`, plus your own domain once the site has one.
4. **Data Access:** the default scopes (`openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`) are all the app needs.
5. **Clients → Create client:**
   - **Application type:** Web application. **Name:** Whimsy & Bloom web.
   - **Authorized JavaScript origins:** `http://localhost:5173` (for testing) and your live site, e.g. `https://whimsybloom.co.ke`.
   - **Authorized redirect URIs:** the Supabase callback URL from step 1.3, exactly, with no trailing slash.
   - Click **Create**, then copy the **Client ID** and **Client secret**.
6. **Audience → Publish app.** While the app is in *Testing*, only the test users you list there can sign in, so customers would get blocked. With only the basic scopes above, Google doesn't need to review the app.

## 3. Turn on Google in Supabase

In the Supabase dashboard:

1. **Authentication → Sign In / Providers** (older dashboards: **Authentication → Providers**) → **Google** → enable it.
2. Paste the **Client ID** and **Client secret** from step 2.5 and **Save**.
3. **Authentication → URL Configuration:**
   - **Site URL:** your live site, e.g. `https://whimsybloom.co.ke`.
   - **Redirect URLs:** add `http://localhost:5173` and your live site URL. Google sends people back to these after sign-in.

## 4. Point the app at Supabase

Copy `.env.example` to `.env.local` in the project folder and fill it in:

```bash
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...            # the anon / publishable key
VITE_STAFF_EMAILS=you@gmail.com:SUPER_ADMIN, her@gmail.com:ADMIN
```

- `.env.local` is in `.gitignore`, so it isn't committed. The anon key is safe to ship in a web app; never put the **service_role** key here.
- Use the exact Google addresses you two sign in with. An entry with no role is an `ADMIN`.

Then restart: `npm run dev`, open `http://localhost:5173`, and click **Continue with Google**.

When you host the site (Netlify, Vercel, Cloudflare Pages), add the same three variables in the host's **Environment variables** settings and rebuild.

## 5. Check it works

- You → dashboard with the **Super admin** badge and the Settings page.
- Her → dashboard with the **Admin** badge, without Settings.
- Any other Google account → "This account isn't on the team", with a button to the client portal.
- `#/portal` with a customer account → asks for a phone number once, then shows their orders. If that number has chatted or ordered before, their history carries over.

## Common problems

| You see | Fix |
|---|---|
| `Error 400: redirect_uri_mismatch` | The **Authorized redirect URI** in Google must be exactly `https://<ref>.supabase.co/auth/v1/callback`. |
| Back from Google but still signed out | Add the page's address (e.g. `http://localhost:5173`) to Supabase **Redirect URLs**. `localhost` and `127.0.0.1` count as different sites. |
| "Access blocked: app is in testing" | Publish the app (step 2.6), or add the account as a test user. |
| Signed in but sent to the portal | That email isn't in `VITE_STAFF_EMAILS`, or the site wasn't rebuilt after changing it. |

## What this does and doesn't protect yet

Sign-in decides **who sees which screens**. In Stage A the shop's data still lives in each browser, so login isn't yet a security boundary for the data itself. Stage B moves orders, chats and customers into the Supabase database with row-level security rules (team sees everything; a customer only their own rows). The team list moves from `VITE_STAFF_EMAILS` into a `staff` table, and customers verify their phone number by SMS before old orders are linked to their account.
