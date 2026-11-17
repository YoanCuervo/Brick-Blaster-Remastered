import { mountGame } from "./mount";

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
if (!canvas) throw new Error("#screen canvas not found");
await mountGame(canvas);
