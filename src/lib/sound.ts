const sfx = {
  select: new URL('../Assets/sfx/sfx_selecionar.mp3', import.meta.url).href,
  play: new URL('../Assets/sfx/sfx_jogar.mp3', import.meta.url).href,
  pass: new URL('../Assets/sfx/sfx_passar.mp3', import.meta.url).href,
  atk: new URL('../Assets/sfx/sfx_atk.mp3', import.meta.url).href,
  def: new URL('../Assets/sfx/sfx_def.mp3', import.meta.url).href,
  dodge: new URL('../Assets/sfx/sfx_dodge.mp3', import.meta.url).href,
};

const audioCache: Record<string, HTMLAudioElement | null> = {};

export function playSound(key: keyof typeof sfx, volume = 0.7) {
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
