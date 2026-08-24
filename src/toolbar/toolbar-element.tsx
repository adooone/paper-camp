import { setApiBase } from '@/app/services/api-base';
import paperUiCss from '@dendelion/paper-ui/dist/index.css?raw';
import { type Root, createRoot } from 'react-dom/client';
import { ROUTE_ATTRIBUTE } from './route-attribute';
import { Toolbar } from './toolbar';

export const TOOLBAR_TAG_NAME = 'paper-camp-toolbar';

const FONTS_LINK_ID = 'paper-camp-fonts';
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap';

// Shadow-DOM text can only use fonts the host document has loaded, so the embed loads its own.
function ensureFonts(): void {
  if (document.getElementById(FONTS_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

// Shadow DOM keeps host page CSS out and this element's own styles in — the
// paper-ui stylesheet is injected here rather than assumed present on the host.
export class PaperCampToolbarElement extends HTMLElement {
  #root: Root | null = null;

  connectedCallback(): void {
    ensureFonts();
    const route = this.getAttribute(ROUTE_ATTRIBUTE);
    if (route) setApiBase(route);
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    shadow.replaceChildren();
    const hostStyle = document.createElement('style');
    // :root font settings never cross the shadow boundary, so set it here too.
    hostStyle.textContent =
      ':host { display: block; width: 100%; font-family: "Cormorant Garamond", Georgia, serif; }';
    shadow.appendChild(hostStyle);
    const style = document.createElement('style');
    // :root never matches inside a shadow tree, so re-scope declarations to :host too.
    style.textContent = paperUiCss.replaceAll(':root', ':root, :host');
    shadow.appendChild(style);
    const mountPoint = document.createElement('div');
    // Set on the mount node, not :host, since host-page rules matching the
    // custom element directly (e.g. Tailwind preflight) outrank :host.
    mountPoint.style.fontFamily = '"Cormorant Garamond", Georgia, serif';
    shadow.appendChild(mountPoint);
    this.#root = createRoot(mountPoint);
    this.#root.render(<Toolbar route={route ?? undefined} />);
  }

  disconnectedCallback(): void {
    this.#root?.unmount();
    this.#root = null;
  }
}
