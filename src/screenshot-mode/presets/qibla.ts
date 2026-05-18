import { z } from "zod";

export const qiblaSeedSchema = z.object({
  heading: z.number().min(0).max(360),
  qiblaBearing: z.number().min(0).max(360),
  city: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type QiblaSeed = z.infer<typeof qiblaSeedSchema>;

const raw = {
  "istanbul-pointing-141": {
    heading: 152,
    qiblaBearing: 141,
    city: "Istanbul",
    lat: 41.0082,
    lng: 28.9784,
  },
} as const;

export const qiblaPresets: Record<string, QiblaSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, qiblaSeedSchema.parse(v)])
);
