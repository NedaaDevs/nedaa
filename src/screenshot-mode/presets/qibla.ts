import { z } from "zod";

export const qiblaSeedSchema = z.object({
  heading: z.number().min(0).max(360),
  qiblaBearing: z.number().min(0).max(360),
  city: z.string(),
});

export type QiblaSeed = z.infer<typeof qiblaSeedSchema>;

const raw = {
  "istanbul-pointing-141": {
    heading: 0,
    qiblaBearing: 141,
    city: "Istanbul",
  },
} as const;

export const qiblaPresets: Record<string, QiblaSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, qiblaSeedSchema.parse(v)])
);
