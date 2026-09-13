import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CountdownDial } from "../src/ui/CountdownDial";

it.each([20,10,5,0,25,-1,null])("shows only remaining seconds for %s", seconds => {
  const html = renderToStaticMarkup(createElement(CountdownDial, { seconds }));
  expect(html).not.toContain("<svg");
  expect(html).toContain(seconds === null ? "—" : `>${Math.max(0, seconds)}<`);
  expect(html.includes('class="blink"')).toBe(seconds !== null && seconds <= 5);
});
