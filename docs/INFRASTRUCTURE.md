# Infrastructure

Everything about how this site gets from a `git push` to a browser.

## The map

| Domain | Repo | Serves |
| --- | --- | --- |
| `sixthwall.productions` | [`omniharmonic/sixthwall-productions`](https://github.com/omniharmonic/sixthwall-productions) | The site. Canonical. |
| `www.sixthwall.productions` | ↳ same | GitHub 301s it to the apex automatically. |
| `sixthwallproductions.com` | [`omniharmonic/sixthwallproductions.com`](https://github.com/omniharmonic/sixthwallproductions.com) | A redirect stub → canonical. |

Registrar and DNS host for both: **Namecheap**, on BasicDNS
(`dns1.registrar-servers.com` / `dns2.registrar-servers.com`).

Two repos because **GitHub Pages allows one custom domain per repository**, so
the canonical site cannot also answer for the `.com`.

## Deployment

- **`sixthwall-productions`** — GitHub Actions
  (`.github/workflows/deploy.yml`). Push to `main` → typecheck → `astro build`
  → publish `dist/`. Pages source is set to `workflow`.
- **`sixthwallproductions.com`** — served straight from the `main` branch, no
  build. Pages source is set to `main` / `/`.

## DNS records

Identical on both zones — both point at GitHub Pages.

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | 300 |
| A | `@` | `185.199.109.153` | 300 |
| A | `@` | `185.199.110.153` | 300 |
| A | `@` | `185.199.111.153` | 300 |
| AAAA | `@` | `2606:50c0:8000::153` | 300 |
| AAAA | `@` | `2606:50c0:8001::153` | 300 |
| AAAA | `@` | `2606:50c0:8002::153` | 300 |
| AAAA | `@` | `2606:50c0:8003::153` | 300 |
| CNAME | `www` | `omniharmonic.github.io.` | 300 |

These are GitHub's published Pages addresses. Verify them any time with:

```bash
gh api meta --jq '.pages[]'
```

TTL is 300s (5 min) to keep changes quick to iterate on. Raising it to 1800
once things are settled is fine — GitHub's Pages IPs change very rarely.

---

## ⚠️ Outstanding manual step: remove the parking redirects

**Both domains still carry a leftover Namecheap "URL Redirect Record" on `@`**
from their parked state. It must be deleted by hand — the Namecheap API cannot
represent or delete URL records, so this cannot be automated.

**Why it matters:** GitHub sees the extra address and marks the domain
`is_proxied: true`, which makes it **refuse to issue the Let's Encrypt
certificate**. Until this is removed there is no HTTPS — `http://` works,
`https://` does not.

The site is *not* broken in the meantime: four of the five apex addresses are
GitHub's and serve the site directly; the fifth 302s to `www`, which lands on
the site anyway. It just costs the certificate.

**To fix — about a minute, for each of the two domains:**

1. Namecheap → **Domain List** → **Manage** next to the domain
2. **Advanced DNS** tab
3. Under **Host Records**, find the row of type **URL Redirect Record** with
   host `@` (its value points at a parkingpage / redirect URL)
4. Delete that row (trash icon), then **Save All Changes**
5. Leave every A, AAAA and CNAME record above untouched

Then confirm GitHub agrees:

```bash
gh api repos/omniharmonic/sixthwall-productions/pages/health \
  --jq '.domain | {is_proxied, is_valid, https_eligible}'
```

You want `is_proxied: false`. The certificate is then issued automatically,
usually within 15 minutes but occasionally up to an hour.

### Then turn on HTTPS enforcement

Once the certificate exists, force every visitor onto it:

```bash
gh api -X PUT repos/omniharmonic/sixthwall-productions/pages \
  -F https_enforced=true
gh api -X PUT repos/omniharmonic/sixthwallproductions.com/pages \
  -F https_enforced=true
```

(Or tick **Enforce HTTPS** in each repo's Settings → Pages.)

---

## Outstanding: contact email

`hello@sixthwall.productions` is live in the site's markup but **has no mailbox
behind it yet**. Namecheap includes free email forwarding, but it is configured
in the dashboard, not the API:

1. Namecheap → **Domain List** → **Manage** on `sixthwall.productions`
2. **Domain** tab → **Redirect Email** section
3. Add an alias: `hello` → whichever inbox should receive it
4. Namecheap adds the required MX records itself

Do this *after* the DNS work above, and let Namecheap manage the MX records —
adding them by hand conflicts with the forwarding feature.

To use a different address instead, change `email` in `src/config/site.ts`.
Nothing else references it.

---

## Changing the canonical domain

The canonical hostname lives in **three** places that must agree:

1. `public/CNAME` — travels with the build to GitHub Pages
2. `site.url` in `src/config/site.ts` — canonical tag, Open Graph, sitemap
3. The Pages custom domain setting on the repo:
   ```bash
   gh api -X PUT repos/omniharmonic/sixthwall-productions/pages -f cname=NEW.DOMAIN
   ```

Plus `public/robots.txt`, which names the sitemap URL, and the redirect target
in the other repo's `index.html` and `404.html`.

## Verifying

```bash
# Are the authoritative servers serving what we think?
dig +short @dns1.registrar-servers.com sixthwall.productions A
dig +short @dns1.registrar-servers.com www.sixthwall.productions CNAME

# Does GitHub consider the domain healthy?
gh api repos/omniharmonic/sixthwall-productions/pages/health --jq '.domain'

# Test a specific address directly, bypassing DNS caching
curl -sS --resolve sixthwall.productions:80:185.199.108.153 \
  http://sixthwall.productions/ | grep -o '<title>[^<]*</title>'

# Latest deploy
gh run list --limit 3
```
