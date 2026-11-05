import castleUrl from "../assets/music/8bit_castle.mod?url";
import { TICK_MS } from "../core/loop";
import {
  DEFAULT_MUSIC_VOLUME,
  MUSIC_CHANNELS,
  type MusicName,
  musicFadeTicks,
  musicGain,
} from "./rules";

/** Filter 1 is no interpolation, like the mixer 0x40CA50. Separation 200 pans voices fully (0x40B693). */
const WORKLET_CONFIG = { repeatCount: -1, stereoSeparation: 200, interpolationFilter: 1 };
/** The worklet answers a play only once its WASM is ready, and throws before that. */
const PLAY_RETRY_MS = 200;

/**
 * Plays the modules through the worklet files of chiptune3, served by the Vite plugin. Its own
 * player class is left out: it locates the worklet with a URL that does not survive bundling.
 */
/** Unlike the pack, these are versioned: Vite bundles them. */
const FREE_MUSIC: Partial<Record<MusicName, string>> = { "8bit_castle": castleUrl };

export class Music {
  private readonly gain: GainNode;
  private readonly node: Promise<AudioWorkletNode>;
  private readonly files = new Map<MusicName, Promise<ArrayBuffer>>();
  private wanted: MusicName | null = null;
  private started = false;
  private ticket = 0;
  private volume = DEFAULT_MUSIC_VOLUME;
  private channels = 0;
  private playing: MusicName | null = null;
  private position: number | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly base: string,
    private readonly onStart: (channels: number) => void,
  ) {
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
    this.node = this.createNode();
  }

  /** The module asked for last: the one playing, or the one about to. */
  get current(): MusicName | null {
    return this.wanted;
  }

  /** Song position of the module asked for, null until it starts ([0x423E70], service 0x3E). */
  get order(): number | null {
    return this.playing === this.wanted ? this.position : null;
  }

  /** Asking for the current module changes nothing: it goes on playing (0x4077AF). */
  play(name: MusicName): void {
    if (name === this.wanted) return;
    this.wanted = name;
    const ticket = ++this.ticket;
    this.switchTo(name, ticket).catch((e: unknown) => {
      console.error("music unavailable:", e);
    });
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (!this.started) return;
    const { gain } = this.gain;
    gain.cancelScheduledValues(this.ctx.currentTime);
    gain.setValueAtTime(musicGain(this.channels, volume), this.ctx.currentTime);
  }

  private async createNode(): Promise<AudioWorkletNode> {
    await this.ctx.audioWorklet.addModule(`${this.base}chiptune/chiptune3.worklet.js`);
    const node = new AudioWorkletNode(this.ctx, "libopenmpt-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    node.port.addEventListener("message", (e: MessageEvent<{ cmd: string; order: number }>) => {
      if (e.data.cmd === "pos") this.position = e.data.order;
    });
    node.port.start();
    node.port.postMessage({ cmd: "config", val: WORKLET_CONFIG });
    node.connect(this.gain);
    return node;
  }

  private load(name: MusicName): Promise<ArrayBuffer> {
    let file = this.files.get(name);
    if (!file) {
      file = fetch(FREE_MUSIC[name] ?? `${this.base}music/${name}.mod`).then((res) => {
        if (!res.ok) throw new Error(`failed to load ${name}: HTTP ${res.status}`);
        return res.arrayBuffer();
      });
      this.files.set(name, file);
    }
    return file;
  }

  private async switchTo(name: MusicName, ticket: number): Promise<void> {
    const [node, file] = await Promise.all([this.node, this.load(name), this.fadeOut()]);
    if (ticket !== this.ticket) return;
    await this.running();
    if (ticket !== this.ticket) return;
    const channels = MUSIC_CHANNELS[name];
    await this.start(node, file, ticket, musicGain(channels, this.volume));
    if (ticket === this.ticket) {
      this.started = true;
      this.channels = channels;
      this.playing = name;
      this.position = null;
      this.onStart(channels);
    }
  }

  /** Only the music fades before a change, one step per tick (0x40666A). */
  private fadeOut(): Promise<void> {
    if (!this.started) return Promise.resolve();
    const ms = musicFadeTicks(this.volume) * TICK_MS;
    const { gain } = this.gain;
    const now = this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + ms / 1000);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Before the first user gesture the context is suspended and the module would be lost. */
  private running(): Promise<void> {
    if (this.ctx.state === "running") return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.ctx.state !== "running") return;
        this.ctx.removeEventListener("statechange", check);
        resolve();
      };
      this.ctx.addEventListener("statechange", check);
    });
  }

  private start(
    node: AudioWorkletNode,
    file: ArrayBuffer,
    ticket: number,
    level: number,
  ): Promise<void> {
    const { gain } = this.gain;
    gain.cancelScheduledValues(this.ctx.currentTime);
    gain.setValueAtTime(level, this.ctx.currentTime);
    return new Promise((resolve) => {
      const send = () => {
        if (ticket !== this.ticket) return finish();
        node.port.postMessage({ cmd: "play", val: file });
        // The worklet turns on the Amiga resampler for each module, overriding the filter.
        node.port.postMessage({
          cmd: "setCtl",
          val: { name: "render.resampler.emulate_amiga", val: "0" },
        });
      };
      const timer = setInterval(send, PLAY_RETRY_MS);
      const finish = () => {
        clearInterval(timer);
        node.port.onmessage = null;
        resolve();
      };
      node.port.onmessage = (e: MessageEvent<{ cmd: string }>) => {
        if (e.data.cmd === "meta") finish();
      };
      send();
    });
  }
}
