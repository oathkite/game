export const MUSIC_URLS = {
  hangar: new URL('../assets/music/hangar.ogg', import.meta.url).href,
  lobby: new URL('../assets/music/lobby.ogg', import.meta.url).href,
  room: new URL('../assets/music/room.ogg', import.meta.url).href,
  ridgeline: new URL('../assets/music/ridgeline.ogg', import.meta.url).href,
  'stone-bridge': new URL('../assets/music/stone-bridge.ogg', import.meta.url).href,
  'sky-islands': new URL('../assets/music/sky-islands.ogg', import.meta.url).href,
  terraces: new URL('../assets/music/terraces.ogg', import.meta.url).href,
  result: new URL('../assets/music/result.ogg', import.meta.url).href,
} as const;
export type MusicName = keyof typeof MUSIC_URLS;
export const stageMusic = (mapId: string): MusicName => {
  if (mapId === 'rock-arch' || mapId === 'stone-bridge') return 'stone-bridge';
  if (mapId === 'sky-islands') return 'sky-islands';
  if (mapId === 'reed-hills' || mapId === 'terraces') return 'terraces';
  return 'ridgeline';
};
