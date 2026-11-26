/** Test ids for the sky's views; the screen reader sees none of them. */
export const SKY_PART = {
  CANVAS: "sky-canvas",
  /** A small sky that shows a choice, beside the page's own. */
  PREVIEW: "sky-preview",
  PAINT: "sky-paint",
  BODIES: "sky-bodies",
  SUN: "sky-sun",
  SUN_RAYS: "sky-sun-rays",
  MOON: "sky-moon",
  MOON_FACE: "sky-moon-face",
  MOON_BODY: "sky-moon-body",
  MOON_HALO: "sky-moon-halo",
  /** Masks the scrolling content under the status bar, on iOS. */
  STATUS_BAR_MASK: "sky-status-bar-mask",
  /** The gradient whose alpha the mask applies to the content. */
  STATUS_BAR_MASK_IMAGE: "sky-status-bar-mask-image",
} as const;
