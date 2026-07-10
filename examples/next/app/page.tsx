import { note, title } from "./styles";
import { ThemeShell } from "./theme-shell";

export default function Home() {
  return (
    <ThemeShell>
      <h1 className={title}>dx-styles + Next.js</h1>
      <p className={note}>
        This heading and paragraph are rendered in a React Server Component. Their class names were
        generated at build time, so no style runtime crosses the RSC boundary. The theme switch
        below lives in a small client component.
      </p>
    </ThemeShell>
  );
}
