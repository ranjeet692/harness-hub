import type { RunState } from "../../engine/types";

const GEO: Record<string, { x: number; y: number; w: number; h: number }> = {
  living: { x: 8, y: 8, w: 196, h: 118 }, kitchen: { x: 212, y: 8, w: 120, h: 86 },
  bedroom: { x: 212, y: 102, w: 120, h: 104 }, nursery: { x: 8, y: 134, w: 120, h: 72 },
};
const CENTER: Record<string, [number, number]> = { living: [106, 67], kitchen: [272, 51], bedroom: [272, 154], nursery: [68, 170], dock: [170, 184] };
const LABEL: Record<string, string> = { living: "Living room", kitchen: "Kitchen", bedroom: "Bedroom", nursery: "Nursery" };

/** Floor plan that fills in room by room, with the no-go nursery hatched. */
export function PlanScene({ S }: { S: RunState }) {
  const cov = S.cov ?? { living: 0, kitchen: 0, bedroom: 0, nursery: 0 };
  const [cx, cy] = CENTER[S.pos ?? "dock"];
  const caption = S.dead ? "Robot dead at 0%" : "Robot: " + (S.pos === "dock" ? "on the dock" : LABEL[S.pos].toLowerCase());
  return (
    <div className="scene">
      <svg viewBox="0 0 340 214" role="img" aria-label={caption}>
        <defs>
          <pattern id="hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={8} className="hatch-line" />
          </pattern>
        </defs>
        {Object.entries(GEO).map(([r, g]) => (
          <g key={r}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={4} className="room" />
            <rect x={g.x} y={g.y} height={g.h} rx={4} className={r === "nursery" ? "breach" : "room-fill"} style={{ width: g.w * Math.min(1, cov[r]) }} />
            {r === "nursery" && <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={4} className="nogo" opacity={S.noGoOverridden || S.nurseryEntered ? 0 : 1} />}
            <text x={g.x + 7} y={g.y + 15} className="room-label">{LABEL[r]}</text>
            <text x={g.x + 7} y={g.y + g.h - 8} className="room-pct">
              {r === "nursery" ? (S.nurseryEntered ? "entered!" : "no-go") : Math.round(cov[r] * 100) + "%"}
            </text>
          </g>
        ))}
        <rect x={136} y={134} width={68} height={72} rx={4} className="room" />
        <text x={143} y={149} className="room-label">Hall</text>
        <rect x={150} y={196} width={40} height={5} rx={2} className="dock-mark" />
        <g transform="translate(300,176)" opacity={S.sw?.petmess ? 1 : 0}>
          <circle cx={0} cy={0} r={4.5} className="mess-dot" />
          <circle cx={3} cy={2} r={2.5} className="mess-dot" />
          <circle cx={1} cy={1} r={10} className="mess-ring" opacity={S.messSpotted ? 1 : 0} />
        </g>
        <circle cx={0} cy={0} r={8} className={"robot-dot" + (S.dead ? " dead" : "")} style={{ transform: `translate(${cx}px, ${cy}px)` }} />
      </svg>
      <p className="scene-caption">{caption}</p>
    </div>
  );
}
