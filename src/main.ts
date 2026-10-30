const canvas = document.querySelector<HTMLCanvasElement>("#screen");
if (!canvas) throw new Error("#screen canvas not found");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D context unavailable");

const title = new Image();
title.src = "/backgrounds/title.png";
title.onload = () => ctx.drawImage(title, 0, 0);
title.onerror = () => {
  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  ctx.fillText("Asset pack missing: run tools/extract/extract_assets.py", 16, 240);
};
