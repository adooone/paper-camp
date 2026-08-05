import { PaperCampToolbarElement, TOOLBAR_TAG_NAME } from './toolbar-element';

if (!customElements.get(TOOLBAR_TAG_NAME)) {
  customElements.define(TOOLBAR_TAG_NAME, PaperCampToolbarElement);
}

if (!document.querySelector(TOOLBAR_TAG_NAME)) {
  document.body.appendChild(document.createElement(TOOLBAR_TAG_NAME));
}
