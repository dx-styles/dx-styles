import { type ReactElement, useEffect, useMemo, useState } from "react";

import { TopNav } from "./components/TopNav";
import { ApiShowcase } from "./sections/ApiShowcase";
import { CallToAction } from "./sections/CallToAction";
import { DeveloperExperience } from "./sections/DeveloperExperience";
import { Hero } from "./sections/Hero";
import { LiveDemo } from "./sections/LiveDemo";
import { Pillars } from "./sections/Pillars";
import { Pipeline } from "./sections/Pipeline";
import { ThemeStudio } from "./sections/ThemeStudio";
import { page } from "./styles/layout";
import {
  DEFAULT_BASE_COLOR,
  getBaseColorOklch,
  getSitePalette,
  getSiteThemeVars,
} from "./themePalette";

export const App = (): ReactElement => {
  const [baseColor, setBaseColor] = useState(DEFAULT_BASE_COLOR);
  const baseOklch = useMemo(() => getBaseColorOklch(baseColor), [baseColor]);
  const palette = useMemo(() => getSitePalette(baseColor), [baseColor]);

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const themeVars = getSiteThemeVars(baseColor);
    const previousVars = Object.keys(themeVars).map((name) => ({
      name,
      priority: rootStyle.getPropertyPriority(name),
      value: rootStyle.getPropertyValue(name),
    }));

    Object.entries(themeVars).forEach(([name, value]) => {
      rootStyle.setProperty(name, String(value));
    });

    return () => {
      previousVars.forEach(({ name, priority, value }) => {
        if (value === "") {
          rootStyle.removeProperty(name);
          return;
        }
        rootStyle.setProperty(name, value, priority);
      });
    };
  }, [baseColor]);

  return (
    <div className={page}>
      <TopNav />
      <Hero />
      <Pillars />
      <ApiShowcase />
      <LiveDemo />
      <ThemeStudio
        baseColor={baseColor}
        baseOklch={baseOklch}
        palette={palette}
        onBaseColorChange={setBaseColor}
      />
      <Pipeline />
      <DeveloperExperience />
      <CallToAction />
    </div>
  );
};
