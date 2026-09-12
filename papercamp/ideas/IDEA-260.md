---
id: IDEA-260
title: A QR code in the banner
type: feat
status: idea
created: 2026-09-12
tags:
  - cli
subject: Daemon
order: 2
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
