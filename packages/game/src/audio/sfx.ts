import type { SoundName } from "../game/game";
import { DEFAULT_SOUND_VOLUME, SOUND_RATE, holdResample, soundGain, soundPan } from "./rules";

/** The single sound voice of the original: a new sound cuts the current one. */
export class Sfx {
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly gain: GainNode;
  private readonly panner: StereoPannerNode;
  private source: AudioBufferSourceNode | null = null;
  private channels = 4;

  constructor(
    private readonly ctx: AudioContext,
    sounds: Record<SoundName, Uint8Array>,
  ) {
    for (const [name, samples] of Object.entries(sounds)) {
      const data = holdResample(samples, SOUND_RATE, ctx.sampleRate);
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(name as SoundName, buffer);
    }
    this.gain = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.gain.connect(this.panner).connect(ctx.destination);
    this.setModuleChannels(this.channels);
  }

  /** The level and side of the sound voice depend on the module loaded with it. */
  setModuleChannels(channels: number): void {
    this.channels = channels;
    this.panner.pan.value = soundPan(channels);
  }

  play(name: SoundName): void {
    if (this.ctx.state !== "running") return;
    this.source?.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffers.get(name)!;
    this.source.connect(this.gain);
    this.gain.gain.value = soundGain(name, this.channels, DEFAULT_SOUND_VOLUME);
    this.source.start();
  }
}
