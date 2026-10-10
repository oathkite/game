import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpectatorConsole } from "../src/worldUi/SpectatorConsole";
import { BattleMenu } from "../src/worldUi/BattleMenu";

// 観戦の帯（設計書 21.4）と、観戦者の対戦設定。観戦者には誰の番かと、観戦でも効く操作だけを出す

const strip = (actor: { name: string; color: string } | null, keepView = false) =>
  renderToStaticMarkup(createElement(SpectatorConsole, { actor, keepView, onKeepView: () => undefined, wind: createElement("span", { className: "wind" }) }));

describe("SpectatorConsole", () => {
  it("names the acting player in the team color next to the spectating status", () => {
    const html = strip({ name: "ゲスト", color: "#ff7775" });
    expect(html).toContain('role="status">観戦中</span>');
    expect(html).toContain('data-testid="spectator-turn" style="color:#ff7775">ゲスト の番</strong>');
    expect(html).toContain('class="wind"');
  });

  it("leaves out the turn when nobody is acting and reflects the manual camera choice", () => {
    expect(strip(null)).not.toContain("spectator-turn");
    expect(strip(null, true)).toMatch(/<input[^>]*checked=""[^>]*\/?>手動視点を維持/);
    expect(strip(null, false)).not.toContain("checked");
  });
});

describe("BattleMenu for spectators", () => {
  const menu = (spectator: boolean) => renderToStaticMarkup(createElement(BattleMenu, { seconds: 12, spectator, close: () => undefined, surrender: () => undefined, exit: undefined, finished: false }));

  it("shows the camera keys that work while spectating, without the surrender and aiming keys", () => {
    const html = menu(true);
    expect(html).toContain("Tab：機体を順に見る　C：手番へ");
    expect(html).not.toContain("降参");
    expect(html).not.toContain("Space：溜めて発射");
  });

  it("keeps the full controls for participants", () => {
    const html = menu(false);
    expect(html).toContain("降参");
    expect(html).toContain("Space：溜めて発射　Q / E：武器　Tab：機体を順に見る");
  });
});
