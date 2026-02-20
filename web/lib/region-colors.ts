export type Region = "North" | "East" | "West" | "South and SE";

export const REGIONS: Region[] = ["North", "East", "West", "South and SE"];

export const REGION_COLORS: Record<
  string,
  { bg: string; border: string; text: string; color: string }
> = {
  West: {
    bg: "bg-region-west-bg",
    border: "border-region-west-border",
    text: "text-region-west-fg",
    color: "var(--region-west)",
  },
  East: {
    bg: "bg-region-east-bg",
    border: "border-region-east-border",
    text: "text-region-east-fg",
    color: "var(--region-east)",
  },
  North: {
    bg: "bg-region-north-bg",
    border: "border-region-north-border",
    text: "text-region-north-fg",
    color: "var(--region-north)",
  },
  "South and SE": {
    bg: "bg-region-south-bg",
    border: "border-region-south-border",
    text: "text-region-south-fg",
    color: "var(--region-south)",
  },
};

export const REGION_HEX: Record<Region, string> = {
  West: "#2274A5",
  East: "#E96ED8",
  North: "#00B85C",
  "South and SE": "#F75C03",
};

export function getRegionStyle(region: string) {
  return (
    REGION_COLORS[region] ?? {
      bg: "bg-muted",
      border: "border-border",
      text: "text-muted-foreground",
      color: "var(--border)",
    }
  );
}
