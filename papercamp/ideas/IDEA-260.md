---
id: IDEA-260
title: A QR code in the banner
type: feat
status: idea
created: 2026-09-12
tags:
  - cli
subject: Run & monitor
order: 3
---

The daemon prints one link, the best way in, and a phone has to type it.
The mobile app in `paper-camp-mobile` pairs by scanning, so the link
needs a form a camera can read where the link is printed: the terminal.

**The banner draws it.** Under the link, `paper-camp start` and
`paper-camp daemon` print the same link as a QR code in half-block
characters, the way `tailscale` and `gh` render codes in a terminal,
sized to the smallest version that fits the link. It appears only for a
Tailnet or Tunnel link — a host-only link is not reachable from a phone —
and only on a TTY; a daemon writing to its log prints the link alone.
`paper-camp status` gains `--qr` to print it again for the link it lists
first, so the code is one command away without restarting anything.

**One dependency, no image.** The code is generated with the `qrcode`
package's terminal renderer, which draws to the console with no canvas
or image encoding, and the package is the only addition.

### Out of scope

Rendering the code in the hosted client. Any change to what the link
carries.

### Phases
- [x] Add `qrcode` and a half-block renderer
      One helper that turns a link into the smallest terminal code that fits it.
      run: 2m9s · 42 in · 4.2k out · sonnet-5 · sess:ecc13991-0465-4d3f-ba1e-64e0cc85df35
- [ ] Draw the code under the link in the banner
      Gate it on a Tailnet or Tunnel link and on a TTY, so the daemon's log keeps the link alone.
- [ ] Add `--qr` to `paper-camp status`
      Print the code for the link `status` lists first.
- [ ] Cover the renderer and the gating with tests
