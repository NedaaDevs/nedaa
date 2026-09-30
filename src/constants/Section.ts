/** A section's heading: a screen's title, or a sheet's quiet label. */
export const SECTION_KIND = {
  TITLE: "title",
  LABEL: "label",
} as const;

export type SectionKind = (typeof SECTION_KIND)[keyof typeof SECTION_KIND];
