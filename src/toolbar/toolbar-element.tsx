import paperUiCss from '@dendelion/paper-ui/dist/index.css?raw';
import { type Root, createRoot } from 'react-dom/client';
import { Toolbar } from './toolbar';

export const TOOLBAR_TAG_NAME = 'paper-camp-toolbar';

// Shadow DOM keeps host page CSS out and this element's own styles in — the
// paper-ui stylesheet is injected here rather than assumed present on the host.
export class PaperCampToolbarElement extends HTMLElement {
  #root: Root | null = null;

  connectedCallback(): void {
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = paperUiCss;
    shadow.appendChild(style);
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    this.#root = createRoot(mountPoint);
    this.#root.render(<Toolbar />);
  }

  disconnectedCallback(): void {
    this.#root?.unmount();
    this.#root = null;
  }
}
