import { ROUTE_ATTRIBUTE, TOOLBAR_SCRIPT_ID } from './route-attribute';
import { PaperCampToolbarElement, TOOLBAR_TAG_NAME } from './toolbar-element';

if (!customElements.get(TOOLBAR_TAG_NAME)) {
  customElements.define(TOOLBAR_TAG_NAME, PaperCampToolbarElement);
}

if (!document.querySelector(TOOLBAR_TAG_NAME)) {
  const el = document.createElement(TOOLBAR_TAG_NAME);
  const route = document.getElementById(TOOLBAR_SCRIPT_ID)?.getAttribute(ROUTE_ATTRIBUTE);
  if (route) el.setAttribute(ROUTE_ATTRIBUTE, route);
  document.body.insertBefore(el, document.body.firstChild);
}
