import React, { useState, useEffect } from "react";

const BUILDING_OPTIONS = [
  "Residential",
  "Commercial",
  "Industrial",
  "Infrastructure (Bridge/Dam)",
  "Temporary Structure",
];
const SOIL_TYPES = [
  "Clay",
  "Sandy Clay",
  "Sand",
  "Gravel",
  "Silt",
  "Loam",
  "Rock",
  "Peat",
];

const initialSite = {
  siteId: "SITE-001",
  siteLength: "",
  siteWidth: "",
  numPillars: "",
  buildingType: "Residential",
  soilType: "Clay",
  sptN: "",
  unitWeight: "",
  foundationWidth: "",
  foundationDepth: "",
  groundwaterDepth: "",
  appliedLoad: "",
};
const initialMohr = {
  measureX: "",
  measureY: "",
  cohesion: "",
  normalStress: "",
  frictionAngle: "",
  shearStress: "",
  porePressure: "",
};

const SITE_FIELDS = [
  { key: "siteId", label: "Site ID", unit: "", hint: "SITE-001", type: "text" },
  { key: "siteLength", label: "Site Length", unit: "m", hint: "20" },
  { key: "siteWidth", label: "Site Width", unit: "m", hint: "15" },
  { key: "numPillars", label: "No. of Pillars", unit: "pcs", hint: "4" },
];
const TERZAGHI_FIELDS = [
  { key: "unitWeight", label: "Unit Weight γ", unit: "kN/m³", hint: "18" },
  { key: "foundationWidth", label: "Footing Width B", unit: "m", hint: "1.5" },
  {
    key: "foundationDepth",
    label: "Embedment Depth Df",
    unit: "m",
    hint: "1.5",
  },
  {
    key: "groundwaterDepth",
    label: "Groundwater Depth",
    unit: "m",
    hint: "3.8",
  },
  { key: "appliedLoad", label: "Total Building Load", unit: "kN", hint: "500" },
];
const MOHR_FIELDS = [
  { key: "cohesion", label: "Cohesion c'", unit: "kPa", hint: "25" },
  { key: "normalStress", label: "Normal Stress σ'", unit: "kPa", hint: "100" },
  { key: "frictionAngle", label: "Friction Angle φ'", unit: "°", hint: "30" },
  { key: "shearStress", label: "Shear Stress τ", unit: "kPa", hint: "60" },
  { key: "porePressure", label: "Pore Pressure u", unit: "kPa", hint: "0" },
];

function calcFs(r) {
  const {
    cohesion: c,
    normalStress: s,
    frictionAngle: a,
    shearStress: t,
    porePressure: u,
  } = r;
  if (!c || !s || !a || !t) return null;
  const phi = (parseFloat(a) * Math.PI) / 180;
  const fs =
    (parseFloat(c) + (parseFloat(s) - (parseFloat(u) || 0)) * Math.tan(phi)) /
    parseFloat(t);
  return isFinite(fs) ? fs.toFixed(2) : null;
}
function fsColour(fs) {
  const v = parseFloat(fs);
  if (v >= 2.0)
    return {
      bg: "#dcfce7",
      border: "#86efac",
      text: "#166534",
      dot: "#22c55e",
      label: "Stable",
    };
  if (v >= 1.2)
    return {
      bg: "#fef3c7",
      border: "#fcd34d",
      text: "#92400e",
      dot: "#f59e0b",
      label: "Marginal",
    };
  return {
    bg: "#fee2e2",
    border: "#fca5a5",
    text: "#991b1b",
    dot: "#ef4444",
    label: "Critical",
  };
}
function ssrColour(c) {
  if (c === "green") return { hex: "#22c55e", bg: "#dcfce7", text: "#166534" };
  if (c === "orange") return { hex: "#f59e0b", bg: "#fef3c7", text: "#92400e" };
  return { hex: "#ef4444", bg: "#fee2e2", text: "#991b1b" };
}

function parseCSV(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
  const sites = [];
  let current = null;
  for (const line of lines) {
    const c = line.split(",").map((v) => v.trim());
    const type = c[0].toUpperCase();
    if (type === "SITE") {
      if (c.length < 13) continue;
      if (current && current.mohrReadings.length > 0) sites.push(current);
      current = {
        siteId: c[1],
        siteLength: c[2],
        siteWidth: c[3],
        numPillars: c[4],
        buildingType: c[5],
        soilType: c[6],
        sptN: c[7],
        unitWeight: c[8],
        foundationWidth: c[9],
        foundationDepth: c[10],
        groundwaterDepth: c[11],
        appliedLoad: c[12],
        mohrReadings: [],
      };
    } else if (type === "MOHR") {
      if (!current || c.length < 7) continue;
      const r = {
        measureX: c[1],
        measureY: c[2],
        cohesion: c[3],
        normalStress: c[4],
        frictionAngle: c[5],
        shearStress: c[6],
        porePressure: c[7] || "0",
      };
      if (calcFs(r)) current.mohrReadings.push(r);
    }
  }
  if (current && current.mohrReadings.length > 0) sites.push(current);
  return sites;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, sub, note }) {
  return (
    <div
      style={{
        marginBottom: 16,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 3,
          height: 28,
          background: "linear-gradient(to bottom,#3b82f6,#93c5fd)",
          borderRadius: 2,
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#374151",
            textTransform: "uppercase",
          }}
        >
          {icon} {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            {sub}
          </div>
        )}
        {note && (
          <div
            style={{
              fontSize: 10,
              color: "#d97706",
              marginTop: 3,
              background: "#fef3c7",
              padding: "2px 8px",
              borderRadius: 4,
              display: "inline-block",
            }}
          >
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  unit,
  fieldKey,
  value,
  onChange,
  hint,
  type = "number",
}) {
  return (
    <div style={s.ig}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <label style={s.lbl}>{label}</label>
        {unit && <span style={s.unit}>{unit}</span>}
      </div>
      <input
        style={s.input}
        type={type}
        placeholder={hint || "0"}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        onFocus={(e) => {
          e.target.style.borderColor = "#3b82f6";
          e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#e2e8f0";
          e.target.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

function SelectF({ label, fieldKey, value, onChange, options }) {
  return (
    <div style={s.ig}>
      <label style={{ ...s.lbl, marginBottom: 5, display: "block" }}>
        {label}
      </label>
      <select
        style={{ ...s.input, cursor: "pointer" }}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ ...s.card, ...style }}>{children}</div>;
}

// ── Rounded Table Wrapper ─────────────────────────────────────────────────────
function TableWrap({ children, minWidth }) {
  return (
    <div
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 11,
            minWidth: minWidth || "auto",
          }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

// Shared th style with rounded first/last corners
function Th({ children, first, last }) {
  return (
    <th
      style={{
        ...s.th,
        background: "#f1f5f9",
        textAlign: "center",
        borderTopLeftRadius: first ? "10px" : 0,
        borderTopRightRadius: last ? "10px" : 0,
      }}
    >
      {children}
    </th>
  );
}

// ── Mohr Table ────────────────────────────────────────────────────────────────
function MohrTable({ readings, onRemove }) {
  if (!readings.length) return null;
  const headers = [
    "#",
    "X (m)",
    "Y (m)",
    "c' (kPa)",
    "σ' (kPa)",
    "φ' (°)",
    "τ (kPa)",
    "u (kPa)",
    "FS",
    "Status",
    "Action",
  ];
  return (
    <div style={{ marginTop: 16 }}>
      <TableWrap>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <Th key={h} first={i === 0} last={i === headers.length - 1}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {readings.map((r, i) => {
            const fs = calcFs(r);
            const fc = fs ? fsColour(fs) : null;
            const isLast = i === readings.length - 1;
            return (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
              >
                <td
                  style={{
                    ...s.td,
                    color: "#94a3b8",
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {i + 1}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.measureX}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.measureY}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.cohesion}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.normalStress}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.frictionAngle}°
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.shearStress}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.porePressure || 0}
                </td>
                <td
                  style={{
                    ...s.td,
                    fontWeight: 700,
                    color: fc ? fc.dot : "#9ca3af",
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {fs || "—"}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {fc && (
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        background: fc.bg,
                        color: fc.text,
                        border: `1px solid ${fc.border}`,
                      }}
                    >
                      {fc.label}
                    </span>
                  )}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  <button
                    onClick={() => onRemove(i)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 5,
                      border: "1px solid #fca5a5",
                      background: "#fff5f5",
                      color: "#dc2626",
                      fontSize: 10,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🗑 Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ── CSV Panel ─────────────────────────────────────────────────────────────────
function CsvPanel({ onImport, fsNow, fsNowC, mohrDraft }) {
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseCSV(ev.target.result);
      if (result.length) {
        onImport(result);
        alert(
          `✅ Imported ${result.length} site${result.length !== 1 ? "s" : ""}`,
        );
      } else
        alert(
          "No valid sites found. Each site needs a SITE row + at least one MOHR row.",
        );
      e.target.value = "";
    };
    reader.readAsText(file);
  };
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionHeader
        icon="📂"
        label="Import from CSV"
        sub="One file, one or more sites"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div
          style={{
            background: "#f8fafc",
            border: "2px dashed #cbd5e1",
            borderRadius: 10,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            style={{ display: "none" }}
            id="csvFile"
          />
          <label
            htmlFor="csvFile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                background: "#eff6ff",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              📁
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Click to choose CSV file
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                Accepts .csv or .txt — SITE/MOHR row format
              </div>
            </div>
          </label>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 10,
            border: `1px solid ${fsNow ? fsNowC.border : "#e2e8f0"}`,
            background: fsNow ? fsNowC.bg : "#f8fafc",
            padding: "16px 20px",
            minHeight: 90,
          }}
        >
          {fsNow ? (
            <>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: fsNowC.text,
                  letterSpacing: 2,
                  marginBottom: 6,
                  opacity: 0.7,
                }}
              >
                LIVE FS PREVIEW
              </div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: fsNowC.dot,
                  lineHeight: 1,
                  fontFamily: "monospace",
                }}
              >
                {fsNow}
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: "3px 16px",
                  borderRadius: 20,
                  background: fsNowC.dot + "22",
                  border: `1px solid ${fsNowC.dot}44`,
                  color: fsNowC.text,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {fsNowC.label}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: fsNowC.text,
                  opacity: 0.6,
                  marginTop: 6,
                }}
              >
                at ({mohrDraft.measureX || "?"}m, {mohrDraft.measureY || "?"}m)
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#9ca3af",
                  letterSpacing: 2,
                  marginBottom: 6,
                }}
              >
                LIVE FS PREVIEW
              </div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: "#d1d5db",
                  lineHeight: 1,
                }}
              >
                —
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Fill Mohr-Coulomb fields
                <br />
                to see live FS
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Records History ───────────────────────────────────────────────────────────
function RecordsHistory({ records, loading, onViewDashboard, onDelete }) {
  if (loading)
    return (
      <Card style={{ marginTop: 24 }}>
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          Loading records from database…
        </div>
      </Card>
    );
  if (!records.length)
    return (
      <Card style={{ marginTop: 24 }}>
        <SectionHeader
          icon="🗄️"
          label="Saved Records"
          sub="No records yet — push your first site above"
        />
      </Card>
    );
  const headers = [
    "ID",
    "Site ID",
    "Saved At",
    "L×W",
    "Pillars",
    "Type",
    "Soil",
    "Avg FS",
    "SSR",
    "Certification",
    "Readings",
    "Actions",
  ];
  return (
    <Card style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <SectionHeader
          icon="🗄️"
          label="Saved Records"
          sub={`${records.length} site${records.length !== 1 ? "s" : ""} in database`}
        />
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          PostgreSQL · persisted
        </span>
      </div>
      <TableWrap minWidth={900}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <Th key={h} first={i === 0} last={i === headers.length - 1}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const sc = ssrColour(r.ssr_colour || "red");
            const avgFs = parseFloat(r.avg_fs || 0);
            const fsC =
              avgFs >= 2 ? "#16a34a" : avgFs >= 1.2 ? "#d97706" : "#dc2626";
            const dt = r.createdAt
              ? new Date(r.createdAt).toLocaleString()
              : "—";
            const isLast = i === records.length - 1;
            return (
              <tr
                key={r.id}
                style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
              >
                <td
                  style={{
                    ...s.td,
                    color: "#94a3b8",
                    fontSize: 10,
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {r.id}
                </td>
                <td
                  style={{
                    ...s.td,
                    fontWeight: 600,
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {r.siteId}
                </td>
                <td
                  style={{
                    ...s.td,
                    fontSize: 10,
                    color: "#64748b",
                    whiteSpace: "nowrap",
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {dt}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.siteLength}×{r.siteWidth}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.numPillars}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.buildingType}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  {r.soilType}
                </td>
                <td
                  style={{
                    ...s.td,
                    fontWeight: 700,
                    color: fsC,
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {r.avg_fs}
                </td>
                <td
                  style={{
                    ...s.td,
                    fontWeight: 700,
                    color: sc.hex,
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {r.ssr_score}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      background: sc.bg,
                      color: sc.text,
                    }}
                  >
                    {r.certification}
                  </span>
                </td>
                <td
                  style={{
                    ...s.td,
                    color: "#3b82f6",
                    fontWeight: 600,
                    borderBottom: isLast ? "none" : undefined,
                  }}
                >
                  {(r.mohrReadings || []).length}
                </td>
                <td
                  style={{ ...s.td, borderBottom: isLast ? "none" : undefined }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={() => onViewDashboard(r.id)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "1px solid #3b82f6",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 10,
                        cursor: "pointer",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      📊 View
                    </button>
                    <button
                      onClick={() => onDelete(r.id, r.siteId)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "1px solid #fca5a5",
                        background: "#fff5f5",
                        color: "#dc2626",
                        fontSize: 10,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      🗑 Remove
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const DataCollector = () => {
  const [sites, setSites] = useState([]);
  const [siteData, setSiteData] = useState(initialSite);
  const [mohrDraft, setMohrDraft] = useState(initialMohr);
  const [mohrList, setMohrList] = useState([]);
  const [pushing, setPushing] = useState(false);
  const [records, setRecords] = useState([]);
  const [recLoading, setRecLoading] = useState(true);

  const hs = (k, v) => setSiteData((p) => ({ ...p, [k]: v }));
  const hm = (k, v) => setMohrDraft((p) => ({ ...p, [k]: v }));

  const loadRecords = async () => {
    setRecLoading(true);
    try {
      const d = await (
        await fetch("http://localhost:8000/api/get-foundation-data")
      ).json();
      setRecords(d);
    } catch (e) {
      console.error(e);
    } finally {
      setRecLoading(false);
    }
  };
  useEffect(() => {
    loadRecords();
  }, []);

  const addMohr = () => {
    if (!mohrDraft.measureX || !mohrDraft.measureY) {
      alert("Enter X and Y coordinates.");
      return;
    }
    if (!calcFs(mohrDraft)) {
      alert("Fill all Mohr-Coulomb fields.");
      return;
    }
    setMohrList((p) => [...p, { ...mohrDraft }]);
    setMohrDraft(initialMohr);
  };
  const removeMohr = (i) => setMohrList((p) => p.filter((_, idx) => idx !== i));

  const addSite = () => {
    if (!mohrList.length) {
      alert("Add at least one Mohr-Coulomb reading.");
      return;
    }
    setSites((p) => [...p, { ...siteData, mohrReadings: mohrList }]);
    setSiteData(initialSite);
    setMohrList([]);
    setMohrDraft(initialMohr);
  };

  const importSites = (imported) => setSites((p) => [...p, ...imported]);

  const pushToBackend = async () => {
    if (!sites.length) return;
    setPushing(true);
    try {
      const res = await fetch("http://localhost:8000/api/data-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sites),
      });
      if (res.ok) {
        const d = await res.json();
        alert(`✅ Pushed ${d.processed_count} site(s) to database!`);
        setSites([]);
        await loadRecords();
      } else {
        alert("❌ Server error.");
      }
    } catch (err) {
      alert(`❌ Backend not found.\n${err.message}`);
    } finally {
      setPushing(false);
    }
  };

  const viewDashboard = (dbId) => {
    window.location.href = `/?siteId=${dbId}`;
  };

  const deleteSite = async (dbId, siteLabel) => {
    if (!window.confirm(`Delete site "${siteLabel}" (ID ${dbId}) permanently?`))
      return;
    try {
      const res = await fetch(`http://localhost:8000/api/delete-site/${dbId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== dbId));
      } else {
        const body = await res.json().catch(() => ({}));
        alert(`❌ Delete failed: ${body.detail || res.statusText}`);
      }
    } catch (e) {
      alert(`❌ Cannot reach backend.\n${e.message}`);
    }
  };

  const fsNow = calcFs(mohrDraft);
  const fsNowC = fsNow ? fsColour(fsNow) : null;
  const crit = sites.filter(
    (r) => parseFloat(calcFs(r.mohrReadings?.[0] || {}) || 0) < 1.2,
  ).length;

  const queueHeaders = [
    "Site ID",
    "L×W",
    "Pillars",
    "Type",
    "Soil",
    "SPT",
    "Df",
    "GW",
    "Load",
    "Readings",
    "Min FS",
    "Max FS",
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.eyebrow}>URBAN FOUNDATION GUARDIAN</div>
          <h1 style={s.title}>Foundation Data Entry</h1>
          <p style={s.subtitle}>
            Enter site data · Multiple Mohr-Coulomb readings per site ·
            Persisted to PostgreSQL
          </p>
        </div>
        {sites.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                background: "#dbeafe",
                border: "1px solid #93c5fd",
                color: "#1e40af",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              📊 {sites.length} in queue
            </div>
            {crit > 0 && (
              <div
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  color: "#991b1b",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                🔴 {crit} critical
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSV + FS Preview */}
      <CsvPanel
        onImport={importSites}
        fsNow={fsNow}
        fsNowC={fsNowC}
        mohrDraft={mohrDraft}
      />

      {/* Site + Terzaghi */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader
          icon="🏗️"
          label="Site & Foundation"
          sub="Enter once per site"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {SITE_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              unit={f.unit}
              fieldKey={f.key}
              value={siteData[f.key]}
              onChange={hs}
              hint={f.hint}
              type={f.type || "number"}
            />
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <SelectF
            label="Building Category"
            fieldKey="buildingType"
            value={siteData.buildingType}
            onChange={hs}
            options={BUILDING_OPTIONS}
          />
          <SelectF
            label="Soil Type"
            fieldKey="soilType"
            value={siteData.soilType}
            onChange={hs}
            options={SOIL_TYPES}
          />
          <Field
            label="SPT N-Value"
            unit="N"
            fieldKey="sptN"
            value={siteData.sptN}
            onChange={hs}
            hint="22"
          />
        </div>
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <SectionHeader
            icon="🏛️"
            label="Bearing Capacity Parameters"
            sub="Terzaghi qu & qa"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 16,
            }}
          >
            {TERZAGHI_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                unit={f.unit}
                fieldKey={f.key}
                value={siteData[f.key]}
                onChange={hs}
                hint={f.hint}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Mohr readings */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader
          icon="⚖️"
          label="Mohr-Coulomb Readings"
          sub="Each reading has its own X,Y coordinate"
          note={`${mohrList.length} reading${mohrList.length !== 1 ? "s" : ""} added`}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 80px 1fr",
            gap: 12,
            alignItems: "end",
            marginBottom: 12,
          }}
        >
          <Field
            label="X (m)"
            unit=""
            fieldKey="measureX"
            value={mohrDraft.measureX}
            onChange={hm}
            hint="5"
          />
          <Field
            label="Y (m)"
            unit=""
            fieldKey="measureY"
            value={mohrDraft.measureY}
            onChange={hm}
            hint="8"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 12,
            }}
          >
            {MOHR_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                unit={f.unit}
                fieldKey={f.key}
                value={mohrDraft[f.key]}
                onChange={hm}
                hint={f.hint}
              />
            ))}
          </div>
        </div>
        <button onClick={addMohr} style={{ ...s.addBtn, maxWidth: 340 }}>
          ＋ Record Measurement at X:{mohrDraft.measureX || "?"} Y:
          {mohrDraft.measureY || "?"}
        </button>
        <MohrTable readings={mohrList} onRemove={removeMohr} />
      </Card>

      {/* Save site */}
      <button
        onClick={addSite}
        disabled={!mohrList.length}
        style={{
          ...s.addBtn,
          marginBottom: 16,
          opacity: mohrList.length ? 1 : 0.5,
          cursor: mohrList.length ? "pointer" : "not-allowed",
        }}
      >
        ✓ Add Site {siteData.siteId} ({mohrList.length} measurement
        {mohrList.length !== 1 ? "s" : ""}) to Queue
      </button>

      {/* Queue preview */}
      {sites.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader
            icon="📋"
            label="Push Queue"
            sub={`${sites.length} site${sites.length !== 1 ? "s" : ""} ready to push`}
          />
          <TableWrap>
            <thead>
              <tr>
                {queueHeaders.map((h, i) => (
                  <Th
                    key={h}
                    first={i === 0}
                    last={i === queueHeaders.length - 1}
                  >
                    {h}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map((site, i) => {
                const fsList = site.mohrReadings
                  .map((r) => parseFloat(calcFs(r) || 0))
                  .filter((v) => v > 0);
                const minFs = fsList.length
                  ? Math.min(...fsList).toFixed(2)
                  : "—";
                const maxFs = fsList.length
                  ? Math.max(...fsList).toFixed(2)
                  : "—";
                const minC =
                  parseFloat(minFs) < 1.2
                    ? "#dc2626"
                    : parseFloat(minFs) < 2
                      ? "#d97706"
                      : "#16a34a";
                const isLast = i === sites.length - 1;
                return (
                  <tr
                    key={i}
                    style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                  >
                    <td
                      style={{
                        ...s.td,
                        fontWeight: 600,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.siteId}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.siteLength}×{site.siteWidth}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.numPillars}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.buildingType}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.soilType}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.sptN}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.foundationDepth}m
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.groundwaterDepth}m
                    </td>
                    <td
                      style={{
                        ...s.td,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.appliedLoad}kN
                    </td>
                    <td
                      style={{
                        ...s.td,
                        fontWeight: 600,
                        color: "#3b82f6",
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {site.mohrReadings.length}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        fontWeight: 700,
                        color: minC,
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {minFs}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        fontWeight: 700,
                        color: "#16a34a",
                        borderBottom: isLast ? "none" : undefined,
                      }}
                    >
                      {maxFs}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>
      )}

      {/* Push button */}
      <button
        onClick={pushToBackend}
        disabled={pushing || !sites.length}
        style={{
          ...s.pushBtn,
          opacity: pushing || !sites.length ? 0.5 : 1,
          cursor: pushing || !sites.length ? "not-allowed" : "pointer",
        }}
      >
        {pushing
          ? "⟳ Pushing to database..."
          : `🚀 Push ${sites.length} Site${sites.length !== 1 ? "s" : ""} to Database`}
      </button>

      {pushing && (
        <>
          <div
            style={{
              marginTop: 10,
              borderRadius: 6,
              overflow: "hidden",
              height: 4,
              background: "#e2e8f0",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg,#2563eb,#60a5fa,#2563eb)",
                backgroundSize: "200% 100%",
                animation: "slide 1.2s linear infinite",
              }}
            />
            <style>{`@keyframes slide{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#64748b",
              marginTop: 6,
            }}
          >
            ⏳ Calculating FS · Bearing capacity · SSR · AI analysis · Saving to
            PostgreSQL…
          </p>
        </>
      )}

      {/* DB records history */}
      <RecordsHistory
        records={records}
        loading={recLoading}
        onViewDashboard={viewDashboard}
        onDelete={deleteSite}
      />

      <button
        onClick={() => (window.location.href = "/")}
        style={{
          width: "100%",
          marginTop: 16,
          padding: 12,
          background: "transparent",
          border: "1px solid #cbd5e1",
          borderRadius: 10,
          color: "#64748b",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          marginBottom: 40,
        }}
      >
        📊 Go to Dashboard
      </button>
    </div>
  );
};

const s = {
  page: {
    padding: "48px 40px 64px",
    maxWidth: 1400,
    margin: "0 auto",
    fontFamily: "'Segoe UI',Tahoma,sans-serif",
    background: "#f1f5f9",
    minHeight: "100vh",
    color: "#1e293b",
  },
  header: {
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 3,
    color: "#3b82f6",
    marginBottom: 4,
  },
  title: { margin: 0, fontSize: 26, fontWeight: 700, color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 4, fontSize: 13 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  ig: { display: "flex", flexDirection: "column" },
  lbl: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  unit: { fontSize: 9, color: "#94a3b8" },
  input: {
    marginTop: 4,
    padding: "9px 11px",
    borderRadius: 7,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    outline: "none",
    background: "#f8fafc",
    color: "#0f172a",
    transition: "border-color .15s,box-shadow .15s",
    width: "100%",
    boxSizing: "border-box",
  },
  addBtn: {
    width: "100%",
    padding: 12,
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: "0.05em",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    textAlign: "left",
  },
  th: {
    padding: "10px 12px",
    background: "#f1f5f9",
    color: "#64748b",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    whiteSpace: "nowrap",
    borderBottom: "2px solid #e2e8f0",
  },
  td: {
    padding: "8px 12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 11,
    color: "#374151",
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  pushBtn: {
    width: "100%",
    padding: 15,
    background: "linear-gradient(135deg,#1e40af,#2563eb)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.05em",
    boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
    marginBottom: 24,
  },
};

export default DataCollector;
