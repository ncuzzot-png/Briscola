const SOUND_FILES = {
  card: "assets/sfx/card-play.wav",
  win: "assets/sfx/trick-win.wav",
  lose: "assets/sfx/trick-lose.wav",
  button: "assets/sfx/button-click.wav",
};

const sounds = {};
let unlocked = false;
let muted = false;

Object.entries(SOUND_FILES).forEach(([key, src]) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.onerror = () => {
    sounds[key] = { audio, ok: false };
  };
  sounds[key] = { audio, ok: true };
});

export function unlockSfx() {
  if (unlocked) return;
  unlocked = true;
  Object.values(sounds).forEach((entry) => {
    if (!entry.ok) return;
    const audio = entry.audio;
    const prevVolume = audio.volume;
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = prevVolume;
      }).catch(() => {
        audio.volume = prevVolume;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prevVolume;
    }
  });
}

export function playSfx(name) {
  if (!unlocked || muted) return;
  const entry = sounds[name];
  if (!entry || !entry.ok) return;
  const audio = entry.audio;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}
