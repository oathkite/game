import { expect, it } from "vitest";
import { handle } from "../src/index.js";
import { started } from "./helpers.js";
it("walking into a void finishes without a shot; safe moves cannot claim a loss", () => {
  const {state} = started();
  const actor=state.match.currentSeat, player=state.match.players[actor];
  const cells=new Uint8Array(state.mask.width*state.mask.height);
  for(let y=player.y;y<state.mask.height;y++) for(let x=0;x<=player.x;x++) cells[y*state.mask.width+x]=1;
  const cliff={...state,mask:{...state.mask,cells}};
  expect(handle(cliff,{type:"moveRingOut",seat:actor,x:player.x-1},0).state.match.phase).toBe("acting");
  const result=handle(cliff,{type:"moveRingOut",seat:actor,x:player.x+1},0);
  expect(result.state.match.result).toMatchObject({winner:actor===0?1:0,reason:"ringOut"});
  expect(result.state.match.players[actor].hp).toBe(0);
  expect(result.effects.some(e=>e.message.type==="match.finished")).toBe(true);
});
