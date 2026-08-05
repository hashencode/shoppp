export const themeViewportIds = ["desktop", "laptop", "tablet", "mobile"] as const;

export type ThemeViewportId = (typeof themeViewportIds)[number];

export const themeViewports = {
  desktop: { height: 1000, width: 1440 },
  laptop: { height: 900, width: 1024 },
  mobile: { height: 844, width: 390 },
  tablet: { height: 1024, width: 768 },
} as const satisfies Record<ThemeViewportId, { height: number; width: number }>;
