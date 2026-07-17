import { StoreBadges } from "./store-badges";

type AppStoreButtonProps = {
  location: string;
  theme?: "dark" | "light";
};

export function AppStoreButton({ location, theme = "dark" }: AppStoreButtonProps) {
  return <StoreBadges compact={theme === "light"} location={location} />;
}
