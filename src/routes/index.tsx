import { createFileRoute } from "@tanstack/react-router";
import { MathFightingDojo } from "@/components/math-dojo/MathFightingDojo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Math Fighting Dojo — Fun Math Battles for Kids" },
      {
        name: "description",
        content:
          "A friendly stickman fighting game where kids power up with quick math answers. Practice addition and subtraction in fast, fun battles.",
      },
      { property: "og:title", content: "Math Fighting Dojo" },
      {
        property: "og:description",
        content: "Fun stickman math battles for kids. Answer fast, land combos, win the dojo!",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <MathFightingDojo />;
}
