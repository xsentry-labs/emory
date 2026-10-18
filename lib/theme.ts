export const THEME_COOKIE = "emory-theme";
export type Theme = "dark" | "light";

/** Dark unless the visitor chose light. */
export const parseTheme = (value: string | undefined): Theme => (value === "light" ? "light" : "dark");
