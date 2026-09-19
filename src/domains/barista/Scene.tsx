import type { RunState } from "../../engine/types";

const SYRUP: Record<string, string> = { caramel: "#C8862B", vanilla: "#E5D3A0", hazelnut: "#8A5A3C" };
const ICE: [number, number][] = [[70, 70], [98, 62], [122, 74], [84, 92], [112, 96]];

/** A cup that fills as the drink is made: shots, hot or cold milk, ice, syrup. */
export function CupScene({ S }: { S: RunState }) {
  const c = S.cup ?? { shots: 0, milk: "none", ice: false, syrup: "none" };
  const eh = c.shots * 9;
  const mh = c.milk === "none" ? 0 : 62;
  const parts: string[] = [];
  if (c.shots) parts.push(`${c.shots} shot${c.shots > 1 ? "s" : ""}`);
  if (c.milk !== "none") parts.push(c.milk === "hot" ? "steamed oat" : "cold oat" + (c.ice ? " + ice" : ""));
  if (c.syrup !== "none") parts.push(c.syrup);
  const caption = parts.length ? parts.join(" · ") : S.cancelled ? "Ticket voided" : "Empty cup";
  return (
    <div className="scene">
      <svg viewBox="0 0 200 150" role="img" aria-label={`Cup: ${caption}`}>
        <defs>
          <clipPath id="cupClip"><polygon points="52,30 148,30 138,136 62,136" /></clipPath>
        </defs>
        <polygon points="52,30 148,30 138,136 62,136" className="cup-outline" />
        <path d="M146 52 q26 4 20 30 q-4 18 -24 18" className="cup-handle" />
        <g clipPath="url(#cupClip)">
          <rect x={40} width={120} y={136 - eh} height={eh} fill="#5A3520" />
          <rect x={40} width={120} y={136 - eh - mh} height={mh} fill={c.milk === "cold" ? "#F4F1EA" : "#EFE2CC"} />
          <g opacity={c.ice ? 1 : 0}>
            {ICE.map(([x, y]) => <rect key={x} x={x} y={y} width={14} height={14} rx={3} className="ice-cube" />)}
          </g>
          {SYRUP[c.syrup] && (
            <polyline points="60,40 72,48 84,40 96,48 108,40 120,48 132,40 140,46" fill="none" stroke={SYRUP[c.syrup]} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          )}
        </g>
        <g opacity={c.milk === "hot" ? 1 : 0}>
          {["M80 24 q-6 -8 0 -14 q6 -6 0 -12", "M100 22 q-6 -8 0 -14 q6 -6 0 -12", "M120 24 q-6 -8 0 -14 q6 -6 0 -12"].map(d => <path key={d} d={d} className="steam-wisp" />)}
        </g>
      </svg>
      <p className="scene-caption">{caption}</p>
    </div>
  );
}
