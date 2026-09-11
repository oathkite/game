import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CountdownDial } from "../src/ui/CountdownDial";

it.each([[20, 100], [10, 50], [5, 25], [0, 0], [25, 100], [-1, 0], [null, 0]])("shows remaining fraction for %s seconds", (seconds, fraction) => {
  const html = renderToStaticMarkup(createElement(CountdownDial, { seconds }));
  expect(html).toContain(`stroke-dasharray="${fraction} 100"`);
  expect(html).toContain(seconds === null ? "—" : `>${Math.max(0, seconds)}<`);
});
