import { createContext, useContext, useState, useEffect } from "react";

const LIGHT = {
  bg: "#dfff00",
  fg: "#000000",
  error: "#8b1a1a",
  hover: "#fff",
  cardBg: "transparent",
  inputBg: "transparent",
  scrollTrack: "#dfff00",
  scrollThumb: "#000000",
};

const DARK = {
  bg: "#1a1a1a",
  fg: "#dfff00",
  error: "#ff4444",
  hover: "#2a2a2a",
  cardBg: "#222",
  inputBg: "#222",
  scrollTrack: "#1a1a1a",
  scrollThumb: "#dfff00",
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("dt_theme") === "dark");

  useEffect(() => {
    localStorage.setItem("dt_theme", dark ? "dark" : "light");
    const t = dark ? DARK : LIGHT;
    const root = document.documentElement;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--fg", t.fg);
    root.style.setProperty("--error", t.error);
    root.style.setProperty("--hover", t.hover);
    root.style.setProperty("--card-bg", t.cardBg);
    root.style.setProperty("--input-bg", t.inputBg);
    root.style.setProperty("--scroll-track", t.scrollTrack);
    root.style.setProperty("--scroll-thumb", t.scrollThumb);
  }, [dark]);

  const toggle = () => setDark((d) => !d);
  const colors = dark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ dark, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
