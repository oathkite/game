import { Filter, GlProgram, Texture } from "pixi.js";
import type { GradeTable } from "./gradeTables";

// 色の寄せの置き換え表を GPU で当てるフィルター。設計書 41.13 の評価と改善（2 回目）。TBD-41 で「足りなければシェーダー」とした形。
// 画素の色に最も近い表の元の色を探し、ぴったり一致したら先の色へ置き換える。パレットの外の色（文字のふちなど）はそのまま。
// 強さは 4 × 4 の Bayer で art px ごとに置き換えるかを決め（半透明に混ぜない）、スポットライトの内側は置き換えない。縁の 1 段は市松。
// 効いている間だけ container.filters に入れ、ふだんは外して描画の手間を増やさない。

/** 表に入る色の数の上限。表は 64 × 2 の texture（1 行目が元、2 行目が先）で渡す */
const LUT_SIZE = 64;

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }
`;

const fragment = `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform sampler2D uLut;
// 頂点のシェーダーと精度を揃える（揃えないとリンクに失敗する）
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uCount;
uniform float uStrength;
uniform vec4 uSpot;
uniform float uPixel;
float bayer4(vec2 p) {
  float x = mod(p.x, 4.0), y = mod(p.y, 4.0);
  float i = y * 4.0 + x;
  float v = 0.0;
  if (i < 0.5) v = 0.0; else if (i < 1.5) v = 8.0; else if (i < 2.5) v = 2.0; else if (i < 3.5) v = 10.0;
  else if (i < 4.5) v = 12.0; else if (i < 5.5) v = 4.0; else if (i < 6.5) v = 14.0; else if (i < 7.5) v = 6.0;
  else if (i < 8.5) v = 3.0; else if (i < 9.5) v = 11.0; else if (i < 10.5) v = 1.0; else if (i < 11.5) v = 9.0;
  else if (i < 12.5) v = 15.0; else if (i < 13.5) v = 7.0; else if (i < 14.5) v = 13.0; else v = 5.0;
  return (v + 0.5) / 16.0;
}
void main(void) {
  vec4 c = texture2D(uTexture, vTextureCoord);
  if (c.a < 0.99) { gl_FragColor = c; return; }
  vec2 screen = uOutputFrame.xy + vTextureCoord * uInputSize.xy;
  vec2 art = floor(screen / uPixel);
  if (uStrength <= bayer4(art)) { gl_FragColor = c; return; }
  if (uSpot.z > 0.0) {
    float d = distance((art + 0.5) * uPixel, uSpot.xy);
    if (d < uSpot.z) { gl_FragColor = c; return; }
    if (d < uSpot.z + uSpot.w && mod(art.x + art.y, 2.0) < 0.5) { gl_FragColor = c; return; }
  }
  float best = 1.0;
  float index = -1.0;
  for (int i = 0; i < ${LUT_SIZE}; i++) {
    if (float(i) >= uCount) break;
    vec3 from = texture2D(uLut, vec2((float(i) + 0.5) / ${LUT_SIZE}.0, 0.25)).rgb;
    vec3 diff = from - c.rgb;
    float dist = dot(diff, diff);
    if (dist < best) { best = dist; index = float(i); }
  }
  if (index < 0.0 || best > 0.0005) { gl_FragColor = c; return; }
  vec3 to = texture2D(uLut, vec2((index + 0.5) / ${LUT_SIZE}.0, 0.75)).rgb;
  gl_FragColor = vec4(to, 1.0);
}
`;

export type GradeFilter = {
  readonly filter: Filter;
  /** 置き換え表を渡す */
  readonly setTable: (table: GradeTable) => void;
  /** 強さ（0〜1）。Bayer の閾値を超えた art px だけ置き換える */
  readonly setStrength: (strength: number) => void;
  /** スポットライト（画面の px）。radius が 0 なら無し。edge は市松の縁の幅 */
  readonly setSpot: (x: number, y: number, radius: number, edge: number) => void;
  /** 1 art px の画面の px */
  readonly setPixel: (px: number) => void;
  readonly destroy: () => void;
};

export const createGradeFilter = (): GradeFilter => {
  const canvas = document.createElement("canvas");
  canvas.width = LUT_SIZE; canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  const lut = Texture.from(canvas);
  lut.source.scaleMode = "nearest";
  const filter = new Filter({
    glProgram: GlProgram.from({ vertex, fragment, name: "grade-filter" }),
    resources: {
      gradeUniforms: {
        uCount: { value: 0, type: "f32" },
        uStrength: { value: 1, type: "f32" },
        uSpot: { value: new Float32Array(4), type: "vec4<f32>" },
        uPixel: { value: 2, type: "f32" },
      },
      uLut: lut.source,
    },
  });
  const uniforms = filter.resources.gradeUniforms.uniforms as { uCount: number; uStrength: number; uSpot: Float32Array; uPixel: number };
  return {
    filter,
    setTable: (table) => {
      const image = ctx.createImageData(LUT_SIZE, 2), entries = [...table.entries()].slice(0, LUT_SIZE);
      entries.forEach(([from, to], i) => {
        const put = (row: number, rgb: number): void => {
          const o = (row * LUT_SIZE + i) * 4;
          image.data[o] = (rgb >> 16) & 0xff; image.data[o + 1] = (rgb >> 8) & 0xff; image.data[o + 2] = rgb & 0xff; image.data[o + 3] = 255;
        };
        put(0, from); put(1, to);
      });
      ctx.putImageData(image, 0, 0);
      lut.source.update();
      uniforms.uCount = entries.length;
    },
    setStrength: (strength) => { uniforms.uStrength = strength; },
    setSpot: (x, y, radius, edge) => { uniforms.uSpot[0] = x; uniforms.uSpot[1] = y; uniforms.uSpot[2] = radius; uniforms.uSpot[3] = edge; },
    setPixel: (px) => { uniforms.uPixel = px; },
    destroy: () => { filter.destroy(); lut.destroy(true); },
  };
};
