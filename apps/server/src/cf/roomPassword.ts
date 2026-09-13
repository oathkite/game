export type PasswordDigest = { readonly salt: string; readonly hash: string };
const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
const digest = async (password: string, salt: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256)));
};
export const hashRoomPassword = async (password: string): Promise<PasswordDigest> => {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await digest(password, salt) };
};
export const verifyRoomPassword = async (password: string, stored: PasswordDigest): Promise<boolean> => {
  const actual = await digest(password, stored.salt);
  let difference = actual.length ^ stored.hash.length;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return difference === 0;
};
