# Infrastructure

Everything about how this site gets from a `git push` to a browser.

## The map

| Domain | Repo | Serves |
| --- | --- | --- |
| `sixthwall.productions` | [`omniharmonic/sixthwall-productions`](https://github.com/omniharmonic/sixthwall-productions) | The site. Canonical. HTTPS enforced. |
| `www.sixthwall.productions` | ↳ same | GitHub 301s it to the apex automatically. |
| `sixthwallproductions.com` | [`omniharmonic/sixthwallproductions.com`](https://github.com/omniharmonic/sixthwallproductions.com) | A redirect stub → canonical. |

Registrar and DNS host for both: **Namecheap**, on BasicDNS
(`dns1.registrar-servers.com` / `dns2.registrar-servers.com`).

Two repos because **GitHub Pages allows one custom domain per repository**, so
the canonical site cannot also answer for the `.com`.

## Deployment

- **`sixthwall-productions`** — GitHub Actions
  (`.github/workflows/deploy.yml`). Push to `main` → typecheck → `astro build`
  → publish `dist/`. Pages source is `workflow`.
- **`sixthwallproductions.com`** — served straight from the `main` branch, no
  build. Pages source is `main` / `/`.

## DNS records

Both zones point at GitHub Pages with the same web records.

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
| TXT | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:hello@sixthwall.productions; fo=1` | 1800 |

Plus, on `sixthwall.productions` only, the RFC 7489 authorisation that lets the
`.com` send its DMARC reports to an address on this domain:

| Type | Host | Value |
| --- | --- | --- |
| TXT | `sixthwallproductions.com._report._dmarc` | `v=DMARC1` |

Verify GitHub's addresses any time with `gh api meta --jq '.pages[]'`.

> **Careful:** the MX and SPF records for mail are **not** in the list above and
> must not be added by hand. Namecheap injects them from the Email Forwarding
> feature — they do not appear in the API's record list at all. Writing MX
> records manually fights that feature. See *Email* below.

### The parked-domain trap (resolved 2026-08-14)

Both domains arrived parked, carrying a **URL Redirect Record on `@`** that the
Namecheap API cannot read, write or delete (it shows only under
`omittedRecords`, and `force: true` does not remove it). It materialises as a
fifth apex A record pointing at a Namecheap redirect box, which makes GitHub
report `is_proxied: true` and **refuse to issue the certificate**.

Removed by hand via Advanced DNS → delete the `URL Redirect Record` row on `@`.
If a certificate ever fails to appear on a Namecheap domain, check this first:

```bash
dig +short @dns1.registrar-servers.com DOMAIN A   # one IP too many?
```

## HTTPS

`sixthwall.productions` holds a Let's Encrypt certificate and has
`https_enforced: true`, so `http://` 301s to `https://`.

To turn enforcement on for a domain once its certificate exists:

```bash
gh api -X PUT repos/omniharmonic/REPO/pages -F https_enforced=true
```

Check whether a certificate is pending or blocked:

```bash
gh api repos/omniharmonic/REPO/pages/health \
  --jq '.domain | {is_proxied, is_valid, is_https_eligible, caa_error, https_error}'
```

`is_https_eligible: true` with `caa_error: null` means GitHub has approved it and
the certificate is merely queued — wait rather than reconfigure. Issuance is
usually minutes but is documented as up to an hour.

## Email

`hello@sixthwall.productions` → forwards to `synergy@benjaminlife.one`.

Namecheap's free Email Forwarding provisions the mail DNS automatically when
enabled — five `eforward*.registrar-servers.com` MX records and an SPF record
(`v=spf1 include:spf.efwd.registrar-servers.com ~all`). These are injected by
the feature and are invisible to the DNS API.

**The alias itself is not a DNS record.** It lives in a table in the Namecheap
dashboard: **Domain List → Manage → Domain tab → Redirect Email**, mapping
`hello` → the destination inbox. Nothing in DNS encodes that mapping.

Forwarding is **receive-only** — replies go out as the destination address.
To send *as* `hello@sixthwall.productions`, add the domain to Proton Mail as a
custom domain (`benjaminlife.one` is already set up that way) and replace the
Namecheap MX/SPF with Proton's, plus their DKIM CNAMEs. That needs a Proton plan
with a spare custom-domain slot.

To change the address, edit `email` in `src/config/site.ts`. Nothing else
references it.

### DMARC

`p=reject` on both domains. That is the correct posture while nothing
legitimately sends as either domain — there is no mail to break, and it stops
anyone spoofing `hello@sixthwall.productions`.

**If you set up outbound mail** (Proton, a newsletter, a transactional sender),
configure its SPF and DKIM *before* sending, or `p=reject` will bounce your own
mail. Relaxing to `p=none` while you test is a one-record change.

Aggregate reports go to `hello@sixthwall.productions` (so, to your Proton inbox)
as XML attachments. Expect very few. Drop the `rua=` and `fo=` parameters to
stop them.

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
# Authoritative DNS
dig +short @dns1.registrar-servers.com sixthwall.productions A
dig +short TXT _dmarc.sixthwall.productions

# GitHub's view of the domain
gh api repos/omniharmonic/sixthwall-productions/pages/health --jq '.domain'

# End to end, including the HTTPS redirect
curl -sSL -o /dev/null -w '%{url_effective} %{http_code}\n' http://sixthwall.productions/

# Certificate
echo | openssl s_client -servername sixthwall.productions \
  -connect sixthwall.productions:443 2>/dev/null | openssl x509 -noout -issuer -dates

# Latest deploy
gh run list --limit 3
```
