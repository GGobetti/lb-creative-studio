"use client";

export function triggerConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "9999";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  // Adjust pixel ratio for retina screens
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const colors = ["#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];
  const particles: Array<{
    x: number;
    y: number;
    size: number;
    color: string;
    speedX: number;
    speedY: number;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
  }> = [];

  // Spawn 100 particles shooting up from the bottom center
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: width / 2,
      y: height + 20,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: (Math.random() - 0.5) * 16,
      speedY: -Math.random() * 15 - 12,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
    });
  }

  function update() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    let active = false;

    particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.speedY += 0.5; // gravity
      p.speedX *= 0.98; // drag
      p.rotation += p.rotationSpeed;
      
      if (p.speedY > 0) {
        p.opacity -= 0.015; // fade out as they fall down
      }

      if (p.opacity > 0 && p.y < height + 20 && p.x > -20 && p.x < width + 20) {
        active = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        
        // Draw little squares or rectangles
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (active) {
      requestAnimationFrame(update);
    } else {
      try {
        document.body.removeChild(canvas);
      } catch (e) {
        // Handle cases where element was already removed
      }
    }
  }

  update();
}
