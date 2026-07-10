import { createTheme, createTokenContract } from "dx-styles";

export const tokens = createTokenContract(
  {
    color: {
      bg: null,
      surface: null,
      fg: null,
      muted: null,
      accent: null,
      accentFg: null,
    },
    radius: {
      md: null,
    },
  },
  { prefix: "app" },
);

export const darkTheme = createTheme(tokens, {
  color: {
    bg: "#10131a",
    surface: "#181c26",
    fg: "#f5f7fb",
    muted: "#9aa3c0",
    accent: "#7c8cff",
    accentFg: "#080a12",
  },
  radius: {
    md: "12px",
  },
});

export const lightTheme = createTheme(tokens, {
  color: {
    bg: "#f6f7fb",
    surface: "#ffffff",
    fg: "#171a22",
    muted: "#5a627a",
    accent: "#4c5ce0",
    accentFg: "#ffffff",
  },
  radius: {
    md: "12px",
  },
});
