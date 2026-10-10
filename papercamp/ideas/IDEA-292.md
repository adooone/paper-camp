---
id: IDEA-292
title: Pair with a code from the terminal
type: feat
status: planned
created: 2026-10-10
tags:
  - cli
  - app
  - multi-project
subject: Multi-project
order: 2
---

Connecting a device to a machine means opening the link the daemon prints:
`https://paper.adoo.one/?machine=https://deimos.pitta-ray.ts.net/&token=<64 hex>`.
The link names one client, but the web app runs on several Vercel addresses —
`paper.adoo.one`, `paper-camp.vercel.app`, preview deployments — and pairing
trusts one browser origin at a time, so the printed link often opens the wrong
client. A laptop can't scan a QR code and has to copy a 150-character link
with a secret in the query string, which also lands in Vercel's request logs.
The daemon writes to a log, and IDEA-260's QR code prints only on a TTY, so the
running daemon shows no QR code at all. When the phone can't reach the
machine, because the tailnet name only resolves with Tailscale on, the client
fails without saying why. Machines are reached over Tailscale only; the
services behind them don't work outside it.

**One command: `paper-camp pair`.** It asks the running daemon for a fresh
pairing code and prints the code twice:

```
Scan with your phone:
  <QR code>
Or paste into Paper Camp on another device:
  7KQ4-M9XZ@deimos.pitta-ray.ts.net
```

It then waits and prints *Paired <origin>* when the code is used, or *Code
expired* after ten minutes, and exits. Ctrl-C cancels the code. The QR code
uses IDEA-260's half-block renderer and is drawn only on a TTY. Without one,
`pair` prints the code line alone.

**The code.** Eight characters of Crockford base32, shown as two groups of
four, then `@`, then the machine's tailnet name. The scheme is always
`https`. A code is valid for ten minutes and pairs exactly one origin. The
daemon keeps its pending codes in memory only, so a restart voids them. It
cancels a code after five failed attempts against it, and refuses more than
twenty failed attempts a minute across all codes. `pair` mints a code with
`POST /api/machine/pair-code` on loopback, authenticated with the bearer
token in `~/.config/paper-camp/update-token`, the same check the update hook
already uses. It reads the long-poll `GET /api/machine/pair-code/:code` for
the outcome. No tailnet name — the daemon was started without `--tailnet`,
or Tailscale is down — means `pair` prints *This machine isn't on a tailnet —
start the daemon with --tailnet* and exits non-zero. It never falls back to a
LAN address or a tunnel.

**The QR code opens the web app.** It encodes
`<hosted client>/#pair=7KQ4-M9XZ@deimos.pitta-ray.ts.net`, where the hosted
client is `hostedClientUrl()` (`paper.adoo.one` unless
`PAPERCAMP_HOSTED_CLIENT_URL` says otherwise). The code is in the fragment, so
it never reaches the server or its logs. On load, `machine-connection.ts`
reads `#pair=`, clears it from the address bar, and pairs.

**Pasting works in any client.** The hub's *Add a machine* card takes a code,
not a link: the field reads *Paste a pairing code*, the line above it reads
*Run `paper-camp pair` on the machine, then paste the code it prints*, and the
`daemonStartCommand` line stays. A pasted code pairs the origin it was pasted
into. `rehostPairingLink` is deleted. Pairing a code is
`POST <machine>/api/pair` with `{ code }`; the server checks it against the
pending codes, adds the caller's origin to the paired origins exactly as the
long token does now, and returns the long token in the response. The client
stores that token in `machine-store.ts` as it stores the link's token today.
Nothing after pairing changes.

**Say why a machine can't be reached.** Before pairing, the client probes
`/api/machine/projects`. A failed probe for a `.ts.net` address shows *Can't
reach deimos — this address works only on your tailnet. Open Tailscale on this
device and try again.* in place of a silent failure, with *Try again*
re-running the probe. A rejected code shows *This code expired or was already
used — run `paper-camp pair` again.*

**Links go away.** The daemon banner and `paper-camp status` stop printing
`?machine=…&token=…` links. They print the machine's tailnet name and *Run
`paper-camp pair` to connect a device*. `status --qr` is removed. The web app
stops reading `?machine=` and `?token=`. Origins that are already paired keep
working, since they are still kept in `pairing.json`. The loopback redirect at
the daemon's `/`, which pairs a browser on the machine itself, stays. The
long token stays as the thing a paired client holds.

Done when `paper-camp pair` on deimos shows a QR code that a phone with
Tailscale on scans into a paired paper.adoo.one, and the printed code pasted
into a Vercel preview pairs that preview.

### Out of scope

The native app in `paper-camp-mobile` and its scanner. A non-Tailscale way in.
The `--share` tunnel, which pairing no longer uses. Revoking a paired origin.

### Phases
- [ ] Mint and redeem pairing codes in the daemon
      `POST`/`GET /api/machine/pair-code` behind the update-token bearer on
      loopback, in-memory codes with expiry, single use and the attempt limits,
      and `/api/pair` accepting `{ code }` and returning the long token.
- [ ] Add the `paper-camp pair` command
      Mint a code, print the QR code on a TTY and the code line, wait for the
      outcome, cancel on Ctrl-C, refuse without a tailnet name.
- [ ] Pair from a code in the web app
      `#pair=` on load, the Add a machine card taking a code, the reachability
      probe with its Tailscale message, the expired-code message, and
      `rehostPairingLink` deleted.
- [ ] Remove the printed links
      Banner and `status` print the tailnet name and the `pair` hint; drop
      `status --qr` and the `?machine=`/`?token=` handling, keeping the loopback
      redirect; tests updated.
