import { Button } from "@recensio/ui/button";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useAtom } from "@effect/atom-react/Hooks";
import * as Atom from "effect/reactivity/Atom";

const KEY = "theme";

/** Runs before first paint, so the stored (or system) theme never flashes. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

/**
 * The `dark` class on `<html>` is the source of truth; this reads it and
 * writes it. The server cannot know it, so the first render reads light.
 */
export const dark = Atom.writable(
  () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  (context, value: boolean) => {
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem(KEY, value ? "dark" : "light");
    context.setSelf(value);
  },
).pipe(
  Atom.keepAlive,
  Atom.withServerValue(() => false),
);

export function ThemeToggle() {
  const [isDark, setDark] = useAtom(dark);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setDark(!isDark)}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </Button>
  );
}
