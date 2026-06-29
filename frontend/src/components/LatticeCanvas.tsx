import { useEffect, useRef } from "react";

type Node = { x: number; y: number; z: number };

/**
 * Dependency-free 3D "encrypted lattice" — a rotating cube grid of nodes + edges
 * rendered with real 3D math (rotation, perspective projection, depth shading)
 * on a 2D canvas. Reads as lattice cryptography / FHE. Purple, square nodes.
 */
export function LatticeCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const cnv = canvasRef.current as HTMLCanvasElement;
    const ctx2d = cnv.getContext("2d");
    if (!ctx2d) return;
    const c = ctx2d as CanvasRenderingContext2D;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Build a 3x3x3 lattice of nodes.
    const nodes: Node[] = [];
    const span = [-1, 0, 1];
    for (const x of span) for (const y of span) for (const z of span) nodes.push({ x, y, z });

    // Edges connect nodes adjacent along exactly one axis.
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
        if (d === 1) edges.push([i, j]);
      }
    }

    let width = 0;
    let height = 0;

    function resize() {
      const rect = cnv.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cnv.width = Math.max(1, Math.floor(width * dpr));
      cnv.height = Math.max(1, Math.floor(height * dpr));
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cnv);

    // Pointer parallax target.
    let targetRX = -0.5;
    let targetRY = 0.6;
    let curRX = targetRX;
    let curRY = targetRY;
    function onPointer(event: PointerEvent) {
      const rect = cnv.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetRY = 0.6 + nx * 0.9;
      targetRX = -0.5 + ny * 0.7;
    }
    window.addEventListener("pointermove", onPointer);

    let raf = 0;
    let t = 0;

    function project(n: Node, rx: number, ry: number, scale: number) {
      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const cx = Math.cos(rx);
      const sx = Math.sin(rx);
      const x = n.x * cy - n.z * sy;
      let z = n.x * sy + n.z * cy;
      const y = n.y * cx - z * sx;
      z = n.y * sx + z * cx;
      const distance = 4.2;
      const perspective = distance / (distance - z);
      return {
        sx: width / 2 + x * scale * perspective,
        sy: height / 2 + y * scale * perspective,
        depth: z
      };
    }

    function frame() {
      t += reduced ? 0 : 0.0045;
      curRY += (targetRY - curRY) * 0.05;
      curRX += (targetRX - curRX) * 0.05;
      const ry = curRY + (reduced ? 0 : t);
      const rx = curRX + (reduced ? 0 : Math.sin(t * 0.6) * 0.15);

      const scale = Math.min(width, height) * 0.26;
      c.clearRect(0, 0, width, height);

      const projected = nodes.map((n) => project(n, rx, ry, scale));

      // edges
      c.lineWidth = 1;
      for (const [i, j] of edges) {
        const a = projected[i];
        const b = projected[j];
        const depth = (a.depth + b.depth) / 2;
        const alpha = 0.12 + ((depth + 1.4) / 2.8) * 0.5;
        c.strokeStyle = `rgba(168, 85, 247, ${Math.max(0.05, Math.min(0.6, alpha))})`;
        c.beginPath();
        c.moveTo(a.sx, a.sy);
        c.lineTo(b.sx, b.sy);
        c.stroke();
      }

      // nodes (squares), far first
      const order = projected.map((p) => p).sort((m, n) => m.depth - n.depth);
      for (const p of order) {
        const k = (p.depth + 1.4) / 2.8; // 0 far .. 1 near
        const size = 3 + k * 5;
        const alpha = 0.3 + k * 0.7;
        c.save();
        c.shadowBlur = 14 * k;
        c.shadowColor = "rgba(192, 132, 252, 0.9)";
        c.fillStyle = `rgba(${Math.round(200 + k * 30)}, ${Math.round(130 + k * 60)}, 252, ${alpha})`;
        c.fillRect(p.sx - size / 2, p.sy - size / 2, size, size);
        c.restore();
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
