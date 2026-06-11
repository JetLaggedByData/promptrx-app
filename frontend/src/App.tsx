import { useState } from "react";
import { useAppStore } from "./store/useAppStore";
import { useVoiceInput } from "./hooks/useVoiceInput";
import {
  useGenerate,
  useUpgrade,
  useLogin,
  useRegister,
  useFeedback,
  useContact,
} from "./hooks";
import type {
  GenerateResponse,
  UpgradeResponse,
  ChatMessage,
  ScoreSchema,
} from "./types";

// ─── Design tokens ────────────────────────────────────────────────
const C = {
  bg: "#07080a",
  surface: "#0d0f12",
  border: "#181b20",
  borderHover: "#262b32",
  accent: "#d4973a",
  accentDim: "#5e4219",
  accentBg: "#d4973a14",
  text: "#e6e1da",
  textSub: "#9a938a",
  textMuted: "#8b8479",
  green: "#52a872",
  greenBg: "#52a87214",
  red: "#c95858",
};

const DIMS = [
  { key: "role_clarity", label: "Role" },
  { key: "context_richness", label: "Context" },
  { key: "task_specificity", label: "Task" },
  { key: "output_definition", label: "Output" },
  { key: "model_alignment", label: "Universal Fit" },
] as const;

const STEPS = [
  {
    id: "role",
    label: "What's your role?",
    placeholder:
      "e.g. Project Engineer, HSE Manager, Operations Lead, Asset Integrity Engineer…",
    type: "text",
  },
  {
    id: "domain",
    label: "What domain do you work in?",
    placeholder:
      "e.g. Offshore O&G, Decommissioning, Pipelines, Subsea, Drilling…",
    type: "text",
  },
  {
    id: "experience",
    label: "Experience level?",
    type: "select",
    options: ["Beginner", "Intermediate", "Advanced", "Expert"],
  },
  {
    id: "task",
    label: "What do you need AI help with?",
    placeholder:
      "e.g. Write a project progress report, draft a scope of work, summarise a technical review…",
    type: "textarea",
  },
  {
    id: "constraints",
    label: "Any constraints? (optional)",
    placeholder: "e.g. Client-facing, max 400 words, include a risk register…",
    type: "textarea",
    optional: true,
  },
] as const;

function avg(s: ScoreSchema) {
  return Math.round(Object.values(s).reduce((a, b) => a + b, 0) / 5);
}

// ─── Radar chart ──────────────────────────────────────────────────
function Radar({
  scores,
  color = C.accent,
  size = 160,
}: {
  scores: ScoreSchema;
  color?: string;
  size?: number;
}) {
  const cx = 85,
    cy = 85,
    r = 62;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const outer = DIMS.map((_, i) => ({
    x: cx + r * Math.cos(ang(i)),
    y: cy + r * Math.sin(ang(i)),
  }));
  const data = DIMS.map((d, i) => {
    const v = (scores[d.key] || 0) / 100;
    return {
      x: cx + v * r * Math.cos(ang(i)),
      y: cy + v * r * Math.sin(ang(i)),
    };
  });
  const path = (pts: { x: number; y: number }[]) =>
    pts
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
      .join(" ") + "Z";
  return (
    <svg
      viewBox="0 0 170 170"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    >
      {[0.25, 0.5, 0.75, 1].map((lv) => {
        const pts = DIMS.map((_, i) => ({
          x: cx + lv * r * Math.cos(ang(i)),
          y: cy + lv * r * Math.sin(ang(i)),
        }));
        return (
          <path
            key={lv}
            d={path(pts)}
            fill="none"
            stroke={C.border}
            strokeWidth={lv === 1 ? 1.5 : 1}
          />
        );
      })}
      {outer.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x.toFixed(1)}
          y2={p.y.toFixed(1)}
          stroke={C.border}
          strokeWidth="1"
        />
      ))}
      <path
        d={path(data)}
        fill={color + "1e"}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {data.map((p, i) => (
        <circle
          key={i}
          cx={p.x.toFixed(1)}
          cy={p.y.toFixed(1)}
          r="3.5"
          fill={color}
        />
      ))}
      {outer.map((_, i) => {
        const lx = cx + (r + 17) * Math.cos(ang(i)),
          ly = cy + (r + 17) * Math.sin(ang(i));
        return (
          <text
            key={i}
            x={lx.toFixed(1)}
            y={ly.toFixed(1)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8"
            fill={C.textSub}
            fontFamily="'Courier New', monospace"
            letterSpacing="0.06em"
          >
            {DIMS[i].label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Output panel ─────────────────────────────────────────────────
function Output({
  result,
  before,
  onReset,
}: {
  result: GenerateResponse;
  before?: ScoreSchema;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const after = avg(result.scores);
  const beforeAvg = before ? avg(before) : null;

  function copy() {
    navigator.clipboard.writeText(result.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Radar scores={result.scores} />
          <div
            style={{
              fontSize: 11,
              color: C.textSub,
              fontFamily: "monospace",
              marginTop: 4,
              letterSpacing: "0.1em",
            }}
          >
            QUALITY
          </div>
          <div
            style={{
              fontSize: 12,
              color: after >= 80 ? C.green : after >= 60 ? C.accent : C.red,
              fontFamily: "monospace",
              marginTop: 6,
              maxWidth: 160,
              lineHeight: 1.5,
            }}
          >
            {after >= 80
              ? "Strong across all dimensions"
              : after >= 60
                ? `Weakest: ${DIMS.reduce((a, b) => (result.scores[a.key] < result.scores[b.key] ? a : b)).label}`
                : `Needs work on ${DIMS.reduce((a, b) => (result.scores[a.key] < result.scores[b.key] ? a : b)).label.toLowerCase()}`}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          {beforeAvg !== null ? (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textSub,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  marginBottom: 6,
                }}
              >
                BEFORE → AFTER
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  style={{
                    fontSize: 28,
                    fontFamily: "Georgia,serif",
                    color: C.red,
                  }}
                >
                  {beforeAvg}
                </span>
                <span style={{ color: C.textSub, fontFamily: "monospace" }}>
                  →
                </span>
                <span
                  style={{
                    fontSize: 42,
                    fontFamily: "Georgia,serif",
                    color: C.accent,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {after}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontFamily: "monospace",
                    color: after - beforeAvg >= 0 ? C.green : C.red,
                  }}
                >
                  {after - beforeAvg >= 0 ? "+" : ""}
                  {after - beforeAvg}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textSub,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  marginBottom: 4,
                }}
              >
                PROMPT SCORE
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontFamily: "Georgia,serif",
                    color: C.accent,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {after}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: C.textSub,
                    fontFamily: "monospace",
                  }}
                >
                  /100
                </span>
              </div>
            </div>
          )}
          {DIMS.map((d) => (
            <div key={d.key} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: C.textSub,
                    fontFamily: "monospace",
                    letterSpacing: "0.06em",
                  }}
                >
                  {d.label.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: C.accent,
                    fontFamily: "monospace",
                  }}
                >
                  {result.scores[d.key]}
                </span>
              </div>
              <div
                style={{
                  height: 2,
                  background: C.border,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${result.scores[d.key]}%`,
                    background: `linear-gradient(90deg,${C.accentDim},${C.accent})`,
                    borderRadius: 2,
                    transition: "width 1.1s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20, position: "relative" }}>
        <div
          style={{
            fontSize: 11,
            color: C.textSub,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            marginBottom: 10,
          }}
        >
          YOUR GENERATED PROMPT
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 80px 18px 20px",
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.75,
              color: C.text,
              fontFamily: "Georgia,serif",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {result.prompt}
          </pre>
        </div>
        <button
          onClick={copy}
          style={{
            position: "absolute",
            top: 30,
            right: 14,
            background: copied ? C.greenBg : C.accentBg,
            border: `1px solid ${copied ? C.green + "66" : C.accentDim}`,
            borderRadius: 6,
            padding: "7px 13px",
            fontSize: 12,
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            color: copied ? C.green : C.accent,
            cursor: "pointer",
            transition: "all .2s",
          }}
        >
          {copied ? "✓ COPIED" : "COPY"}
        </button>
      </div>

      {"improvements" in result &&
        (result as UpgradeResponse).improvements?.length > 0 && (
          <div
            style={{
              padding: "14px 16px",
              background: C.greenBg,
              border: `1px solid ${C.green}44`,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: C.green,
                fontFamily: "monospace",
                letterSpacing: "0.12em",
                marginBottom: 8,
              }}
            >
              WHAT IMPROVED
            </div>
            {(result as UpgradeResponse).improvements.map((imp, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.green, fontSize: 11 }}>+</span>
                <span
                  style={{
                    fontSize: 14,
                    color: C.textSub,
                    fontFamily: "monospace",
                    lineHeight: 1.6,
                  }}
                >
                  {imp}
                </span>
              </div>
            ))}
          </div>
        )}

      {result.techniques?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: C.textSub,
              fontFamily: "monospace",
              letterSpacing: "0.12em",
              marginBottom: 8,
            }}
          >
            TECHNIQUES
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {result.techniques.map((t, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: `1px solid ${C.border}`,
                  color: C.textSub,
                  fontFamily: "monospace",
                  background: C.surface,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.tips?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: C.textSub,
              fontFamily: "monospace",
              letterSpacing: "0.12em",
              marginBottom: 8,
            }}
          >
            PRO TIPS
          </div>
          {result.tips.map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  color: C.accent,
                  fontFamily: "monospace",
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                →
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: C.textSub,
                  fontFamily: "monospace",
                  lineHeight: 1.65,
                }}
              >
                {tip}
              </span>
            </div>
          ))}
        </div>
      )}

      <FeedbackWidget promptId={result.prompt_id} />

      <button
        onClick={onReset}
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          letterSpacing: "0.1em",
          color: C.textSub,
          background: "none",
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: "9px 20px",
          cursor: "pointer",
          marginTop: 20,
        }}
      >
        ← START OVER
      </button>
    </div>
  );
}

// ─── Start guide ──────────────────────────────────────────────────
const SAMPLE_SCORES: ScoreSchema = {
  role_clarity: 88,
  context_richness: 82,
  task_specificity: 91,
  output_definition: 85,
  model_alignment: 86,
};
const SAMPLE_PROMPT =
  "ROLE: You are a Project Engineer with 6 years of experience in offshore oil and gas, currently working on a North Sea platform decommissioning project. You report to the project manager and coordinate between the operator, contractors, and regulatory bodies.\n\nTASK:\n1. Write a weekly progress report covering scope, schedule, and cost status for the decommissioning programme\n2. Highlight any open actions, risks, or regulatory hold points with their current status\n3. Summarise what was completed this week and what is planned for next week\n4. Keep the tone professional and factual — no filler\n\nOUTPUT: Structured progress report, max 400 words. Sections: This Week → Next Week → Risks & Actions → Regulatory & Change Log. Bullet points throughout. Plain English — no unexplained abbreviations.\n\nAUDIENCE: The operator's project manager — experienced in O&G but not in the day-to-day detail of this decommissioning scope.\n\nCONSTRAINTS: Do not mark items complete unless confirmed. Flag anything awaiting regulatory approval or client sign-off clearly.";

const HOW_IT_WORKS = [
  { n: "01", title: "Describe yourself", sub: "Role · domain · task" },
  { n: "02", title: "AI engineers it", sub: "Precision-crafted prompt" },
  { n: "03", title: "Copy + score", sub: "Rated across 5 dimensions" },
];

function StartGuide() {
  const { setMode } = useAppStore();

  function begin() {
    localStorage.setItem("promptrx_seen", "1");
    setMode("wizard");
  }

  const sampleAvg = Math.round(
    Object.values(SAMPLE_SCORES).reduce((a, b) => a + b, 0) / 5,
  );

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 3-step strip */}
      <div
        style={{
          display: "flex",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        {HOW_IT_WORKS.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: "18px 16px",
              borderRight: i < 2 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: C.accent,
                fontFamily: "monospace",
                letterSpacing: "0.14em",
                marginBottom: 8,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                fontSize: 15,
                fontFamily: "Georgia,serif",
                color: C.text,
                marginBottom: 5,
              }}
            >
              {s.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.textSub,
                fontFamily: "monospace",
                lineHeight: 1.5,
              }}
            >
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Three ways */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: C.textSub,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            marginBottom: 10,
          }}
        >
          THREE WAYS TO USE IT
        </div>
        {[
          {
            tab: "BUILD",
            desc: "Know what you need? Answer 5 quick questions.",
          },
          {
            tab: "CHAT",
            desc: "Not sure where to start? Just tell us your problem.",
          },
          {
            tab: "UPGRADE",
            desc: "Already tried a prompt? Paste it — we'll improve it.",
          },
        ].map((m) => (
          <div
            key={m.tab}
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 8,
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: C.accent,
                letterSpacing: "0.1em",
                minWidth: 56,
              }}
            >
              {m.tab}
            </span>
            <span
              style={{
                fontSize: 14,
                fontFamily: "Georgia,serif",
                color: C.textSub,
                lineHeight: 1.5,
              }}
            >
              {m.desc}
            </span>
          </div>
        ))}
      </div>

      {/* Sample output */}
      <div
        style={{
          fontSize: 11,
          color: C.textSub,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}
      >
        EXAMPLE OUTPUT
      </div>

      <div
        style={{
          opacity: 0.65,
          pointerEvents: "none",
          userSelect: "none",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <Radar scores={SAMPLE_SCORES} size={120} />
          <div style={{ flex: 1, minWidth: 140 }}>
            <div
              style={{
                fontSize: 11,
                color: C.textSub,
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              PROMPT SCORE
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 40,
                  fontFamily: "Georgia,serif",
                  color: C.accent,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {sampleAvg}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: C.textSub,
                  fontFamily: "monospace",
                }}
              >
                /100
              </span>
            </div>
            {DIMS.map((d) => (
              <div key={d.key} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textSub,
                      fontFamily: "monospace",
                    }}
                  >
                    {d.label.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: C.accent,
                      fontFamily: "monospace",
                    }}
                  >
                    {SAMPLE_SCORES[d.key]}
                  </span>
                </div>
                <div
                  style={{
                    height: 2,
                    background: C.border,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${SAMPLE_SCORES[d.key]}%`,
                      background: `linear-gradient(90deg,${C.accentDim},${C.accent})`,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "14px 16px",
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.75,
              color: C.text,
              fontFamily: "Georgia,serif",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {SAMPLE_PROMPT}
          </pre>
        </div>
      </div>

      <button
        onClick={begin}
        style={{
          width: "100%",
          padding: "12px",
          background: C.accent,
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          fontWeight: 700,
          color: "#07080a",
          cursor: "pointer",
        }}
      >
        GET STARTED →
      </button>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────
function Skeleton() {
  const bar = (w: string) => (
    <div
      style={{
        height: 10,
        width: w,
        background: C.border,
        borderRadius: 4,
        marginBottom: 10,
      }}
    />
  );
  return (
    <div style={{ animation: "shimmer 1.6s ease-in-out infinite" }}>
      <style>{`@keyframes shimmer{0%,100%{opacity:.35}50%{opacity:.7}}`}</style>
      <div
        style={{ display: "flex", gap: 24, marginBottom: 28, flexWrap: "wrap" }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: C.border,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div
            style={{
              width: 64,
              height: 44,
              background: C.border,
              borderRadius: 6,
              marginBottom: 18,
            }}
          />
          {[100, 85, 70, 90, 60].map((w, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              {bar(`${w}%`)}
              <div
                style={{ height: 2, background: C.border, borderRadius: 2 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 18,
        }}
      >
        {bar("100%")}
        {bar("92%")}
        {bar("97%")}
        {bar("55%")}
      </div>
    </div>
  );
}

// ─── Wizard mode ──────────────────────────────────────────────────
function WizardMode() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const { mutateAsync, isPending, error } = useGenerate();
  const cur = STEPS[step];
  const val = data[cur.id] || "";
  const ok = "optional" in cur && cur.optional ? true : val.trim().length > 0;
  const {
    listening,
    supported: voiceSupported,
    toggle: toggleVoice,
    interim,
    error: voiceError,
  } = useVoiceInput((updater) =>
    setData((d) => ({ ...d, [cur.id]: updater(d[cur.id] || "") })),
  );

  async function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    const r = await mutateAsync({
      mode: "wizard",
      profile: {
        role: data.role ?? "",
        domain: data.domain ?? "",
        experience: data.experience ?? "",
        task: data.task ?? "",
        constraints: data.constraints ?? "",
      },
    });
    setResult(r);
  }

  if (result)
    return (
      <Output
        result={result}
        onReset={() => {
          setResult(null);
          setStep(0);
          setData({});
        }}
      />
    );

  if (isPending) return <Skeleton />;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 2,
                borderRadius: 999,
                background: i <= step ? C.accent : C.border,
                transition: "background .4s",
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textSub,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
          }}
        >
          STEP {step + 1} OF {STEPS.length}
        </div>
      </div>
      <h2
        style={{
          fontSize: 24,
          fontFamily: "Georgia,serif",
          fontWeight: 400,
          color: C.text,
          margin: "0 0 20px",
          letterSpacing: "-0.01em",
        }}
      >
        {cur.label}
      </h2>
      {cur.type === "text" && (
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            autoFocus
            value={val}
            onChange={(e) =>
              setData((d) => ({ ...d, [cur.id]: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && ok && next()}
            placeholder={
              listening
                ? "Listening…"
                : "placeholder" in cur
                  ? cur.placeholder
                  : ""
            }
            style={{
              flex: 1,
              background: C.surface,
              border: `1px solid ${listening ? C.red + "66" : C.border}`,
              borderRadius: 8,
              padding: "13px 16px",
              fontSize: 14,
              fontFamily: "Georgia,serif",
              color: C.text,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color .2s",
            }}
          />
          {voiceSupported && (
            <MicButton listening={listening} onClick={toggleVoice} />
          )}
        </div>
      )}
      {cur.type === "textarea" && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <textarea
            autoFocus
            value={val}
            onChange={(e) =>
              setData((d) => ({ ...d, [cur.id]: e.target.value }))
            }
            placeholder={
              listening
                ? "Listening…"
                : "placeholder" in cur
                  ? cur.placeholder
                  : ""
            }
            rows={5}
            style={{
              flex: 1,
              background: C.surface,
              border: `1px solid ${listening ? C.red + "66" : C.border}`,
              borderRadius: 8,
              padding: "13px 16px",
              fontSize: 15,
              fontFamily: "Georgia,serif",
              color: C.text,
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              lineHeight: 1.7,
              transition: "border-color .2s",
            }}
          />
          {voiceSupported && (
            <MicButton listening={listening} onClick={toggleVoice} />
          )}
        </div>
      )}
      {cur.type !== "select" && (
        <VoiceStatus
          supported={voiceSupported}
          listening={listening}
          interim={interim}
          error={voiceError}
        />
      )}
      {cur.type === "select" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {"options" in cur &&
            cur.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setData((d) => ({ ...d, [cur.id]: opt }))}
                style={{
                  background: val === opt ? C.accentBg : C.surface,
                  border: `1px solid ${val === opt ? C.accentDim : C.border}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontFamily: "monospace",
                  letterSpacing: "0.03em",
                  color: val === opt ? C.accent : C.textSub,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all .15s",
                }}
              >
                {opt}
              </button>
            ))}
        </div>
      )}
      {error && (
        <p
          style={{
            fontSize: 13,
            color: C.red,
            fontFamily: "monospace",
            marginTop: 10,
          }}
        >
          Error generating prompt. Please try again.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              padding: "11px 18px",
              fontSize: 13,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              color: C.textSub,
              background: "none",
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ← BACK
          </button>
        )}
        <button
          onClick={next}
          disabled={!ok || isPending}
          style={{
            flex: 1,
            padding: "12px 20px",
            fontSize: 13,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            fontWeight: 700,
            color: ok && !isPending ? "#07080a" : C.textMuted,
            background: ok && !isPending ? C.accent : C.border,
            border: "none",
            borderRadius: 6,
            cursor: ok && !isPending ? "pointer" : "default",
            transition: "all .2s",
          }}
        >
          {isPending
            ? "GENERATING…"
            : step === STEPS.length - 1
              ? "GENERATE →"
              : "NEXT →"}
        </button>
      </div>
    </div>
  );
}

// Reusable microphone toggle button used across all input modes.
function MicButton({
  listening,
  onClick,
  disabled,
}: {
  listening: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.92)}}`}</style>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={listening ? "Stop listening" : "Speak your answer"}
        style={{
          padding: "12px 14px",
          background: listening ? C.red + "18" : C.surface,
          border: `1px solid ${listening ? C.red + "66" : C.border}`,
          borderRadius: 8,
          cursor: disabled ? "default" : "pointer",
          color: listening ? C.red : C.textSub,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: listening ? "pulse 1.2s ease-in-out infinite" : "none",
          transition: "all .2s",
          flexShrink: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
    </>
  );
}

// Caption shown under a voice-enabled field. One element handles all three
// states: a discoverability hint when idle, live interim words while
// listening, and an actionable message on error.
function VoiceStatus({
  supported,
  listening,
  interim,
  error,
}: {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
}) {
  if (!supported) return null;
  let content: string;
  let color: string;
  if (error) {
    content = error;
    color = C.red;
  } else if (listening) {
    content = interim ? `● ${interim}` : "● Listening…";
    color = C.red;
  } else {
    content = "Tip: tap the mic to dictate your answer";
    color = C.textMuted;
  }
  return (
    <div
      aria-live="polite"
      style={{
        fontSize: 11,
        fontFamily: "monospace",
        color,
        marginTop: 7,
        minHeight: 15,
        letterSpacing: "0.02em",
      }}
    >
      {content}
    </div>
  );
}

// ─── Chat mode ────────────────────────────────────────────────────
function ChatMode() {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [started, setStarted] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const {
    listening,
    supported: voiceSupported,
    toggle: toggleVoice,
    interim,
    error: voiceError,
  } = useVoiceInput((updater) => setInput(updater));
  const { mutateAsync } = useGenerate();

  function start() {
    setStarted(true);
    setMsgs([
      {
        role: "assistant",
        content: "What's your role, and what do you need AI help with today?",
      },
    ]);
  }

  async function send() {
    if (!input.trim() || aiThinking) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setAiThinking(true);
    try {
      // Anthropic API requires conversation to start with a user message
      const firstUserIdx = next.findIndex((m) => m.role === "user");
      const apiMsgs = firstUserIdx >= 0 ? next.slice(firstUserIdx) : next;
      const r = await mutateAsync({ mode: "chat", messages: apiMsgs });
      if ("prompt" in r && r.prompt) {
        setResult(r as GenerateResponse);
      } else {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: (r as unknown as { message: string }).message || "",
          },
        ]);
      }
    } catch {
      // Without this the chat just stopped responding on a failed request.
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry — something went wrong on my end. Please send that again.",
        },
      ]);
    } finally {
      setAiThinking(false);
    }
  }

  if (result)
    return (
      <Output
        result={result}
        onReset={() => {
          setResult(null);
          setMsgs([]);
          setStarted(false);
        }}
      />
    );

  if (!started)
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <h3
          style={{
            fontSize: 20,
            fontFamily: "Georgia,serif",
            fontWeight: 400,
            color: C.text,
            margin: "0 0 10px",
          }}
        >
          Tell us what you need
        </h3>
        <p
          style={{
            fontSize: 14,
            color: C.textSub,
            fontFamily: "monospace",
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          Answer a few questions — we'll build the right prompt for you.
        </p>
        <button
          onClick={start}
          style={{
            padding: "12px 32px",
            background: C.accent,
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            fontWeight: 700,
            color: "#07080a",
            cursor: "pointer",
          }}
        >
          Start Building →
        </button>
      </div>
    );

  return (
    <div>
      <div style={{ minHeight: 280, marginBottom: 16 }}>
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 15px",
                borderRadius:
                  m.role === "user"
                    ? "12px 12px 2px 12px"
                    : "2px 12px 12px 12px",
                background: m.role === "user" ? C.accentBg : C.surface,
                border: `1px solid ${m.role === "user" ? C.accentDim : C.border}`,
                fontSize: 15,
                fontFamily: "Georgia,serif",
                lineHeight: 1.65,
                color: m.role === "user" ? C.accent : C.text,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {aiThinking && (
          <div style={{ display: "flex", gap: 5, padding: "14px 4px" }}>
            <style>{`@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.accent,
                  animation: `blink 1.2s ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? "Listening…" : "Type your answer…"}
          disabled={aiThinking}
          style={{
            flex: 1,
            background: C.surface,
            border: `1px solid ${listening ? C.red + "66" : C.border}`,
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 15,
            fontFamily: "Georgia,serif",
            color: C.text,
            outline: "none",
            transition: "border-color .2s",
          }}
        />
        {voiceSupported && (
          <MicButton
            listening={listening}
            onClick={toggleVoice}
            disabled={aiThinking}
          />
        )}
        <button
          onClick={send}
          disabled={!input.trim() || aiThinking}
          style={{
            padding: "12px 20px",
            background: input.trim() ? C.accent : C.border,
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            color: input.trim() ? "#07080a" : C.textSub,
            cursor: input.trim() ? "pointer" : "default",
            fontWeight: 700,
          }}
        >
          →
        </button>
      </div>
      <VoiceStatus
        supported={voiceSupported}
        listening={listening}
        interim={interim}
        error={voiceError}
      />
    </div>
  );
}

// ─── Upgrade mode ─────────────────────────────────────────────────
function UpgradeMode() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<UpgradeResponse | null>(null);
  const { mutateAsync, isPending, error } = useUpgrade();
  const {
    listening,
    supported: voiceSupported,
    toggle: toggleVoice,
    interim,
    error: voiceError,
  } = useVoiceInput((updater) => setRaw((prev) => updater(prev)));

  async function go() {
    const r = await mutateAsync({ raw_prompt: raw });
    setResult(r);
  }

  if (result)
    return (
      <Output
        result={result}
        before={result.before_scores}
        onReset={() => {
          setResult(null);
          setRaw("");
        }}
      />
    );

  if (isPending) return <Skeleton />;

  return (
    <div>
      <h2
        style={{
          fontSize: 24,
          fontFamily: "Georgia,serif",
          fontWeight: 400,
          color: C.text,
          margin: "0 0 8px",
          letterSpacing: "-0.01em",
        }}
      >
        Paste your rough prompt
      </h2>
      <p
        style={{
          fontSize: 13,
          color: C.textSub,
          fontFamily: "monospace",
          margin: "0 0 18px",
        }}
      >
        We'll score it before and after — and show exactly what changed
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <textarea
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={
            listening
              ? "Listening…"
              : 'e.g.\n"Write a weekly progress report for my project manager"\n"Summarise this inspection finding for a client"\n\nAny prompt — rough, vague, or half-formed.'
          }
          rows={8}
          style={{
            flex: 1,
            background: C.surface,
            border: `1px solid ${listening ? C.red + "66" : C.border}`,
            borderRadius: 8,
            padding: "14px 16px",
            fontSize: 15,
            fontFamily: "Georgia,serif",
            color: C.text,
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
            lineHeight: 1.75,
            transition: "border-color .2s",
          }}
        />
        {voiceSupported && (
          <MicButton listening={listening} onClick={toggleVoice} />
        )}
      </div>
      <VoiceStatus
        supported={voiceSupported}
        listening={listening}
        interim={interim}
        error={voiceError}
      />
      {error && (
        <p
          style={{
            fontSize: 13,
            color: C.red,
            fontFamily: "monospace",
            marginTop: 8,
          }}
        >
          Error upgrading prompt. Please try again.
        </p>
      )}
      <button
        onClick={go}
        disabled={!raw.trim() || isPending}
        style={{
          marginTop: 14,
          width: "100%",
          padding: "13px",
          background: raw.trim() && !isPending ? C.accent : C.border,
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          fontWeight: 700,
          color: raw.trim() && !isPending ? "#07080a" : C.textMuted,
          cursor: raw.trim() && !isPending ? "pointer" : "default",
          transition: "all .2s",
        }}
      >
        {isPending ? "ANALYZING…" : "ANALYZE + UPGRADE →"}
      </button>
    </div>
  );
}

// ─── Auth modal ───────────────────────────────────────────────────
function jwtSub(token: string): string {
  // The sub claim is the user's UUID — not sensitive, and reading it here
  // avoids a second request to /auth/me just to learn our own id.
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(b64)) as { sub?: string }).sub ?? "";
  } catch {
    return "";
  }
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const { login } = useAppStore();
  const loginMut = useLogin();
  const regMut = useRegister();
  const mut = tab === "login" ? loginMut : regMut;

  async function submit() {
    try {
      const r = await mut.mutateAsync({ email, password: pass });
      login(r.access_token, { id: jwtSub(r.access_token), email, role: "user" });
      onClose();
    } catch {
      // error displayed via mut.error
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 13,
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                background: tab === t ? C.accentBg : "none",
                border: `1px solid ${tab === t ? C.accentDim : C.border}`,
                borderRadius: 6,
                color: tab === t ? C.accent : C.textSub,
                cursor: "pointer",
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          type="email"
          style={{
            width: "100%",
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "12px",
            fontSize: 15,
            fontFamily: "monospace",
            color: C.text,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="password"
          type="password"
          style={{
            width: "100%",
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "12px",
            fontSize: 15,
            fontFamily: "monospace",
            color: C.text,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 16,
          }}
        />
        {mut.error && (
          <p
            style={{
              fontSize: 13,
              color: C.red,
              fontFamily: "monospace",
              marginBottom: 10,
            }}
          >
            Invalid credentials
          </p>
        )}
        <button
          onClick={submit}
          disabled={mut.isPending}
          style={{
            width: "100%",
            padding: "12px",
            background: C.accent,
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            fontWeight: 700,
            color: "#07080a",
            cursor: "pointer",
          }}
        >
          {mut.isPending
            ? "LOADING…"
            : tab === "login"
              ? "SIGN IN"
              : "CREATE ACCOUNT"}
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "8px",
            fontSize: 12,
            fontFamily: "monospace",
            color: C.textSub,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ─── Feedback widget ──────────────────────────────────────────────
function FeedbackWidget({ promptId }: { promptId?: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const { mutateAsync, isPending, isSuccess } = useFeedback();

  async function submit() {
    if (!rating) return;
    await mutateAsync({
      prompt_id: promptId,
      rating,
      comment: comment || undefined,
    });
  }

  if (isSuccess)
    return (
      <div
        style={{
          fontSize: 13,
          color: C.green,
          fontFamily: "monospace",
          marginTop: 20,
          paddingTop: 18,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        ✓ THANKS FOR YOUR FEEDBACK
      </div>
    );

  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 18,
        borderTop: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.textSub,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}
      >
        RATE THIS PROMPT
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            style={{
              fontSize: 22,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: s <= (hover || rating) ? C.accent : C.border,
              transition: "color .1s",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment…"
        rows={2}
        style={{
          width: "100%",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: "9px 12px",
          fontSize: 14,
          fontFamily: "monospace",
          color: C.text,
          outline: "none",
          resize: "none",
          boxSizing: "border-box",
          marginBottom: 10,
        }}
      />
      <button
        onClick={submit}
        disabled={!rating || isPending}
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          letterSpacing: "0.1em",
          color: rating && !isPending ? "#07080a" : C.textMuted,
          background: rating && !isPending ? C.accent : C.border,
          border: "none",
          borderRadius: 6,
          padding: "8px 20px",
          cursor: rating && !isPending ? "pointer" : "default",
          transition: "all .2s",
        }}
      >
        {isPending ? "SENDING…" : "SUBMIT FEEDBACK"}
      </button>
    </div>
  );
}

// ─── Contact modal ────────────────────────────────────────────────
function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { mutateAsync, isPending, isSuccess, error } = useContact();

  async function submit() {
    if (!name.trim() || !email.trim() || !message.trim()) return;
    await mutateAsync({ name, email, message });
  }

  const inputStyle = {
    width: "100%",
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "12px",
    fontSize: 15,
    fontFamily: "monospace",
    color: C.text,
    outline: "none",
    boxSizing: "border-box" as const,
    marginBottom: 10,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
          width: "100%",
          maxWidth: 420,
        }}
      >
        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 28, color: C.green, marginBottom: 12 }}>
              ✓
            </div>
            <p
              style={{
                fontSize: 15,
                color: C.text,
                fontFamily: "monospace",
                marginBottom: 20,
              }}
            >
              Message sent — we'll be in touch.
            </p>
            <button
              onClick={onClose}
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: C.textSub,
                background: "none",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "8px 20px",
                cursor: "pointer",
              }}
            >
              CLOSE
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                color: C.accent,
                marginBottom: 20,
              }}
            >
              CONTACT
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              type="email"
              style={inputStyle}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message…"
              rows={5}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.7,
                fontFamily: "Georgia,serif",
              }}
            />
            {error && (
              <p
                style={{
                  fontSize: 13,
                  color: C.red,
                  fontFamily: "monospace",
                  marginBottom: 10,
                }}
              >
                Failed to send. Please try again.
              </p>
            )}
            <button
              onClick={submit}
              disabled={
                isPending || !name.trim() || !email.trim() || !message.trim()
              }
              style={{
                width: "100%",
                padding: "12px",
                background: C.accent,
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "monospace",
                letterSpacing: "0.12em",
                fontWeight: 700,
                color: "#07080a",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              {isPending ? "SENDING…" : "SEND MESSAGE"}
            </button>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: 12,
                fontFamily: "monospace",
                color: C.textSub,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              CANCEL
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────
export default function App() {
  const { mode, setMode, user, logout } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const MODES = [
    { id: "start" as const, label: "Get Started" },
    { id: "wizard" as const, label: "Build" },
    { id: "chat" as const, label: "Chat" },
    { id: "upgrade" as const, label: "Upgrade" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,textarea,button{font-family:inherit}input::placeholder,textarea::placeholder{color:${C.textMuted}}textarea{font-family:'Georgia',serif!important}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}button:not(:disabled):hover{filter:brightness(1.15);transition:filter .15s}input:focus,textarea:focus{outline:2px solid ${C.accent}44!important;border-color:${C.accentDim}!important;transition:border-color .15s}@media(max-width:600px){.hdr-row{flex-direction:column!important;gap:10px!important}.hdr-btns{align-self:flex-start}.tab-nav button{padding:10px 14px!important;font-size:10px!important}.main-pad{padding:0 16px!important}.main-content{padding:24px 16px 0!important}}`}</style>

      <header
        style={{ borderBottom: `1px solid ${C.border}`, padding: "20px 0 0" }}
      >
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 24px" }}>
          <div
            className="hdr-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontFamily: "Georgia,serif",
                    fontWeight: 600,
                    color: C.accent,
                    letterSpacing: "-0.02em",
                  }}
                >
                  PromptRx
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: `1px solid ${C.accentDim}`,
                    color: C.accent,
                    fontFamily: "monospace",
                    letterSpacing: "0.12em",
                  }}
                >
                  FREE
                </span>
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: C.textSub,
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                }}
              >
                Get the AI response you actually wanted.
              </p>
            </div>
            <div className="hdr-btns" style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowContact(true)}
                style={{
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: C.textSub,
                  background: "none",
                  border: `1px solid ${C.border}`,
                  padding: "7px 14px",
                  borderRadius: 6,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                CONTACT
              </button>
              {user ? (
                <button
                  onClick={logout}
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: C.textSub,
                    background: "none",
                    border: `1px solid ${C.border}`,
                    padding: "7px 14px",
                    borderRadius: 6,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  LOGOUT
                </button>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: C.accent,
                    background: C.accentBg,
                    border: `1px solid ${C.accentDim}`,
                    padding: "7px 14px",
                    borderRadius: 6,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  SIGN IN
                </button>
              )}
            </div>
          </div>
          {!user && (
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                fontFamily: "monospace",
                letterSpacing: "0.06em",
                marginBottom: 4,
                textAlign: "right",
              }}
            >
              Sign in to save prompts &amp; track score improvements
            </div>
          )}
          <div className="tab-nav" style={{ display: "flex" }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  padding: "12px 22px",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${mode === m.id ? C.accent : "transparent"}`,
                  fontSize: 13,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  color: mode === m.id ? C.accent : C.textSub,
                  cursor: "pointer",
                  transition: "all .25s",
                  marginBottom: -1,
                }}
              >
                {m.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        className="main-pad"
        style={{ maxWidth: 660, margin: "0 auto", padding: "0 24px" }}
      >
        <div
          style={{
            borderBottom: `1px solid ${C.border}`,
            padding: "12px 0 14px",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: C.textSub,
              fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}
          >
            {mode === "start" &&
              "New here? See how it works and what you'll get"}
            {mode === "wizard" &&
              "Answer 5 questions → get a prompt engineered for your exact context"}
            {mode === "chat" &&
              "Chat naturally → PromptRx extracts context, then generates your prompt"}
            {mode === "upgrade" &&
              "Paste any rough prompt → get a scored, precision-upgraded version"}
          </p>
        </div>
      </div>

      <main
        className="main-content"
        style={{ maxWidth: 660, margin: "0 auto", padding: "32px 24px 0" }}
      >
        {mode === "start" && <StartGuide />}
        {mode === "wizard" && <WizardMode key="wizard" />}
        {mode === "chat" && <ChatMode key="chat" />}
        {mode === "upgrade" && <UpgradeMode key="upgrade" />}
      </main>

      <footer
        style={{
          maxWidth: 660,
          margin: "56px auto 0",
          padding: "24px 24px",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: C.textSub,
              fontFamily: "monospace",
              letterSpacing: "0.06em",
            }}
          >
            PROMPTRX · FREE TO USE · 2026
          </p>
          <p
            style={{
              fontSize: 12,
              color: C.textMuted,
              fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}
          >
            Context-first AI prompt engineering
          </p>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  );
}
