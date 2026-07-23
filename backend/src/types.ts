import { z } from "zod";

export const MovieSchema = z.object({
  id: z.number(),
  name: z.string(),
  releaseDate: z.string().nullable().optional(),
  runtimeInMinutes: z.number().nullable().optional(),
  filmUrl: z.string().nullable().optional(),
  mediumPosterImageUrl: z.string().nullable().optional(),
  largePosterImageUrl: z.string().nullable().optional(),
  genres: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  distributor: z.string().nullable().optional(),
  detailPageUrl: z.string().nullable().optional(),
  isNowPlaying: z.boolean().default(false),
  isComingSoon: z.boolean().default(false),
  hasShowtimes: z.boolean().default(false),
});
export type Movie = z.infer<typeof MovieSchema>;

export const TheatreSchema = z.object({
  theatreId: z.number(),
  theatreName: z.string(),
  shortTheatreName: z.string().nullable().optional(),
  theatreUrl: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  provinceCode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});
export type Theatre = z.infer<typeof TheatreSchema>;
