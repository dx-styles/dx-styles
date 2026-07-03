import { brand, ctaLink, glyph, link, links, wrapper } from "./TopNav.styles";

const navItems = [
  { href: "#why", label: "Why" },
  { href: "#api", label: "API" },
  { href: "#live-demo", label: "Live demo" },
  { href: "#theme-studio", label: "Themes" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#dx", label: "DX" },
];

export const TopNav = (): JSX.Element => {
  return (
    <nav className={wrapper} aria-label="Primary navigation">
      <a className={brand} href="#top" aria-label="dx-styles home">
        <span className={glyph} aria-hidden="true">
          dx
        </span>
        <span>dx-styles</span>
      </a>
      <div className={links}>
        {navItems.map((item) => (
          <a key={item.href} className={link} href={item.href}>
            {item.label}
          </a>
        ))}
      </div>
      <a className={ctaLink} href="#get-started">
        Get started →
      </a>
    </nav>
  );
};
