const sfx = {
  select: new URL('../Assets/sfx/sfx_select.ogg', import.meta.url).href,
  play: new URL('../Assets/sfx/sfx_play.ogg', import.meta.url).href,
  pass: new URL('../Assets/sfx/sfx_pass.ogg', import.meta.url).href,
  draw: new URL('../Assets/sfx/sfx_draw.ogg', import.meta.url).href,
  cardWhoosh: new URL('../Assets/sfx/sfx_card_whoosh.ogg', import.meta.url).href,
  cardLand: new URL('../Assets/sfx/sfx_card_land.ogg', import.meta.url).href,
  hit: new URL('../Assets/sfx/sfx_hit.ogg', import.meta.url).href,
  block: new URL('../Assets/sfx/sfx_block.ogg', import.meta.url).href,
  dodge: new URL('../Assets/sfx/sfx_dodge.ogg', import.meta.url).href,
  breath: new URL('../Assets/sfx/sfx_breath.ogg', import.meta.url).href,
  crystalBreak: new URL('../Assets/sfx/sfx_crystal_break.ogg', import.meta.url).href,
  posture: new URL('../Assets/sfx/sfx_posture.ogg', import.meta.url).href,
  counter: new URL('../Assets/sfx/sfx_counter.ogg', import.meta.url).href,
  ko: new URL('../Assets/sfx/sfx_ko.ogg', import.meta.url).href,
};

export type SfxKey = keyof typeof sfx;

const audioCache: Record<string, HTMLAudioElement | null> = {};

export function playSound(key: SfxKey, volume = 0.7) {
  try {
    let el = audioCache[key];
    if (!el) {
      el = new Audio(sfx[key]);
      el.preload = 'auto';
      audioCache[key] = el;
    }
    el.volume = volume;
    // clone to allow overlapping plays for fast repeated events
    const clone = el.cloneNode(true) as HTMLAudioElement;
    clone.play().catch(() => {});
  } catch (e) {
    // ignore (browsers may block autoplay until interaction)
  }
}

export default { playSound };
