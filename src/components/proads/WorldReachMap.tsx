import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { centroidFor } from "@/lib/countryCentroids";
import { formatNumber } from "@/lib/format";
import type { MetaGeoPoint } from "@/hooks/useMetaGeo";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Metric = "impressions" | "reach" | "clicks" | "leads";

interface Props {
  points: MetaGeoPoint[];
  metric?: Metric;
  loading?: boolean;
}

export function WorldReachMap({ points, metric = "impressions", loading }: Props) {
  const [hover, setHover] = useState<{ name: string; value: number; x: number; y: number } | null>(null);

  const enriched = useMemo(() => {
    const list = points
      .map((p) => {
        const c = centroidFor(p.code);
        if (!c) return null;
        return { ...p, coords: [c.lng, c.lat] as [number, number], name: c.name, value: p[metric] };
      })
      .filter((p): p is NonNullable<typeof p> => !!p && p.value > 0);
    const max = list.reduce((m, p) => Math.max(m, p.value), 0);
    return list.map((p) => ({ ...p, weight: max > 0 ? p.value / max : 0 }));
  }, [points, metric]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,hsl(220_60%_10%)_0%,hsl(230_45%_5%)_100%)]">
      {/* Grid overlay for tech look */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <ComposableMap
        projectionConfig={{ scale: 155, center: [0, 20] }}
        width={900}
        height={440}
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id="pulseGrad">
            <stop offset="0%" stopColor="hsl(320 90% 65%)" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(250 90% 60%)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <ZoomableGroup zoom={1} maxZoom={4} minZoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="hsl(230 40% 14%)"
                  stroke="hsl(230 40% 22%)"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "hsl(240 40% 20%)" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {enriched.map((p) => {
            const r = 3 + p.weight * 10;
            return (
              <Marker
                key={p.code}
                coordinates={p.coords}
                onMouseEnter={(e) =>
                  setHover({ name: p.name, value: p.value, x: (e as any).clientX, y: (e as any).clientY })
                }
                onMouseLeave={() => setHover(null)}
              >
                {/* Pulse */}
                <circle r={r * 2.4} fill="url(#pulseGrad)" opacity={0.55}>
                  <animate attributeName="r" from={r} to={r * 3.2} dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2.2s" repeatCount="indefinite" />
                </circle>
                {/* Core dot */}
                <circle
                  r={r}
                  fill="hsl(320 95% 60%)"
                  stroke="hsl(0 0% 100%)"
                  strokeWidth={1.2}
                  style={{ filter: "drop-shadow(0 0 6px hsl(320 100% 60% / 0.9))" }}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <p className="font-semibold">{hover.name}</p>
          <p className="text-white/70">{formatNumber(hover.value)} {metric}</p>
        </div>
      )}

      {loading && enriched.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
          Carregando dados geográficos…
        </div>
      )}
      {!loading && enriched.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/60">
          Sem entrega geográfica no período. Conecte uma conta ativa da Meta para ver acessos por país.
        </div>
      )}
    </div>
  );
}
