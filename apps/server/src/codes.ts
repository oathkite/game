import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@game/protocol";

// 入室コードと接続トークン。設計書 09 の 9.4 と 05 の 5.7。

const pick = (rng: () => number, alphabet: string): string => alphabet[Math.min(alphabet.length - 1, Math.floor(rng() * alphabet.length))] ?? alphabet[0] ?? "A";

export const generateCode = (rng: () => number, taken: (code: string) => boolean): string => {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += pick(rng, ROOM_CODE_ALPHABET);
    if (!taken(code)) return code;
  }
  throw new Error("入室コードを生成できない");
};

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateToken = (rng: () => number): string => {
  let token = "";
  for (let i = 0; i < 32; i++) token += pick(rng, TOKEN_ALPHABET);
  return token;
};
