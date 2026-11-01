import type { SoundName } from "../game/game";
import { Music } from "./music";
import { type MusicName, soundToPlay } from "./rules";
import { Sfx } from "./sfx";

/** Sound and music of the game, silent until the first user gesture allows the audio context. */
export class GameAudio {
  private readonly sfx: Sfx;
  private readonly music: Music;

  constructor(sounds: Record<SoundName, Uint8Array>, base = import.meta.env.BASE_URL) {
    const ctx = new AudioContext();
    this.sfx = new Sfx(ctx, sounds);
    this.music = new Music(ctx, base, (channels) => this.sfx.setModuleChannels(channels));

    let unlocked = false;
    const unlock = () => {
      unlocked = true;
      void ctx.resume();
    };
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);
    // The game stands still in a hidden tab: the music waits with it.
    document.addEventListener("visibilitychange", () => {
      if (!unlocked) return;
      void (document.hidden ? ctx.suspend() : ctx.resume());
    });
  }

  playMusic(name: MusicName): void {
    this.music.play(name);
  }

  /** To call after each tick, with the sounds that tick started. */
  playSounds(sounds: readonly SoundName[]): void {
    const sound = soundToPlay(sounds);
    if (sound) this.sfx.play(sound);
  }
}
