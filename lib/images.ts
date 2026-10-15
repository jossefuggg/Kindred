import relief from "@/assets/relief.jpg";
import food from "@/assets/food.jpg";
import hospice from "@/assets/hospice.jpg";
import garden from "@/assets/garden.jpg";
import mentor from "@/assets/mentor.jpg";
import shelter from "@/assets/shelter.jpg";
import hero from "@/assets/hero.jpg";

const MAP: Record<string, string> = { relief, food, hospice, garden, mentor, shelter, community: hero };

export const charityImage = (key?: string | null) => MAP[key ?? ""] ?? hero;
export { hero as heroImage };
