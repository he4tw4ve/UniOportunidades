import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const css = readFileSync(
  new URL("./design-system.css", import.meta.url),
  "utf8",
);
const globals = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
function color(name: string) {
  const match = (css + globals).match(
    new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, "i"),
  );
  if (!match) throw new Error(`Token ausente: ${name}`);
  return match[1];
}
function luminance(hex: string) {
  const values = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
it("los pares de texto de los tokens principales alcanzan contraste AA normal", () => {
  for (const [foreground, background] of [
    ["brand-blue", "#ffffff"],
    ["text-strong", "#ffffff"],
    ["text-secondary", "#ffffff"],
    ["brand-navy", "brand-gold"],
    ["#e2e8f7", "brand-navy"],
    ["warning-text", "warning-bg"],
    ["error-text", "error-bg"],
    ["info-text", "info-bg"],
    ["success-text", "success-bg"],
  ]) {
    const a = foreground.startsWith("#") ? foreground : color(foreground),
      b = background.startsWith("#") ? background : color(background);
    expect(
      ratio(a, b),
      `${foreground} sobre ${background}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});
