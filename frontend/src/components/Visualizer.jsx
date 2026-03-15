import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";

// ── Colour maps ───────────────────────────────────────────────────────────────
const SSR_C = {
  green:  { hex:"#22c55e", emissive:"#15803d", label:"CERTIFIED STABLE" },
  orange: { hex:"#f59e0b", emissive:"#b45309", label:"CONDITIONAL"      },
  red:    { hex:"#ef4444", emissive:"#b91c1c", label:"HAZARD WARNING"   },
};
const FS_C = {
  green:  { hex:"#22c55e", emissive:"#15803d", label:"Stable"   },
  orange: { hex:"#f59e0b", emissive:"#b45309", label:"Marginal" },
  red:    { hex:"#ef4444", emissive:"#b91c1c", label:"Critical" },
};
const ssrCol = (k) => SSR_C[k] || SSR_C.red;
const fsCol  = (k) => FS_C[k]  || FS_C.red;

// ── AI text renderer ──────────────────────────────────────────────────────────
const bold = (t) => typeof t!=="string"||!t.includes("**") ? t :
  t.split(/\*\*(.*?)\*\*/g).map((p,i)=>i%2===1?<strong key={i} style={{color:"#f1f5f9"}}>{p}</strong>:p);

const Advice = ({ text }) => {
  if (!text) return <p style={{color:"#475569",fontSize:12}}>No advice yet.</p>;
  return (
    <div>
      {text.replace(/\\\[[\s\S]*?\\\]/g,"").split("\n").map((line,i)=>{
        if (!line.trim()) return <div key={i} style={{height:4}}/>;
        if (line.startsWith("### ")) return <p key={i} style={{color:"#60a5fa",fontWeight:"bold",fontSize:12,margin:"10px 0 3px"}}>{line.slice(4)}</p>;
        if (/^\d+\.\s/.test(line)) {
          const [n,...r]=line.split(/\.\s/);
          return <div key={i} style={{display:"flex",gap:7,marginBottom:5}}>
            <span style={{color:"#3b82f6",fontWeight:"bold",fontSize:11,minWidth:14,flexShrink:0}}>{n}.</span>
            <span style={{fontSize:12,color:"#cbd5e1",lineHeight:1.55}}>{bold(r.join(". "))}</span>
          </div>;
        }
        if (/^\s*[-•]\s/.test(line)) return <div key={i} style={{display:"flex",gap:7,marginBottom:3,paddingLeft:8}}>
          <span style={{color:"#3b82f6",fontSize:10,marginTop:3,flexShrink:0}}>▸</span>
          <span style={{fontSize:12,color:"#cbd5e1",lineHeight:1.55}}>{bold(line.replace(/^\s*[-•]\s/,""))}</span>
        </div>;
        return <p key={i} style={{fontSize:12,color:"#cbd5e1",lineHeight:1.55,marginBottom:2}}>{bold(line)}</p>;
      })}
    </div>
  );
};

const Row = ({l,v,vc,mono}) => (
  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
    <span style={{color:"#64748b"}}>{l}</span>
    <span style={{color:vc||"#e2e8f0",fontWeight:vc?600:400,fontFamily:mono?"monospace":"inherit"}}>{v}</span>
  </div>
);
const Sec = ({t}) => <div style={{fontSize:9,color:"#334155",letterSpacing:1.5,fontWeight:700,
  margin:"10px 0 5px",borderBottom:"1px solid #1e293b",paddingBottom:3,textTransform:"uppercase"}}>{t}</div>;

const Gauge = ({ score, colour, cert }) => {
  const c = ssrCol(colour);
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:5}}>
        <span style={{fontSize:9,color:"#64748b",letterSpacing:1.5,fontWeight:700}}>STRUCTURAL STABILITY RATING</span>
        <span style={{fontSize:28,fontWeight:900,color:c.hex,fontFamily:"monospace",lineHeight:1}}>
          {score}<span style={{fontSize:13,color:"#334155"}}>/100</span>
        </span>
      </div>
      <div style={{height:7,background:"#1e293b",borderRadius:4,overflow:"hidden",marginBottom:7}}>
        <div style={{height:"100%",width:`${Math.min(100,parseFloat(score)||0)}%`,background:c.hex,borderRadius:4,transition:"width .5s"}}/>
      </div>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,border:`1px solid ${c.hex}55`,borderRadius:6,padding:"3px 12px",background:c.hex+"18"}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:c.hex}}/>
        <span style={{fontSize:11,fontWeight:700,color:c.hex,letterSpacing:1.5}}>{cert}</span>
      </div>
    </div>
  );
};

// ── 3-D: Coloured floor slab (SSR) ───────────────────────────────────────────
function SiteSlab({ L, W, ox, oz, colour, isSelected, onClick }) {
  const [hov, setHov] = useState(false);
  const c = ssrCol(colour);
  return (
    <mesh position={[ox+L/2, 0, oz+W/2]} rotation={[-Math.PI/2,0,0]}
      onClick={e=>{e.stopPropagation();onClick();}}
      onPointerOver={e=>{e.stopPropagation();setHov(true);document.body.style.cursor="pointer";}}
      onPointerOut={()=>{setHov(false);document.body.style.cursor="default";}}>
      <planeGeometry args={[L, W]}/>
      <meshStandardMaterial color={c.hex} emissive={c.emissive}
        emissiveIntensity={isSelected?0.55:hov?0.35:0.15}
        transparent opacity={isSelected?0.92:hov?0.82:0.68} roughness={0.4}/>
    </mesh>
  );
}

// ── 3-D: Mohr indicator — flat disc + FS label at coordinate ─────────────────
function MohrIndicator({ mx, mz, colour, fs, label, isSelected, onClick }) {
  const [hov, setHov] = useState(false);
  const c = fsCol(colour);
  const r = isSelected ? 0.45 : hov ? 0.42 : 0.35;
  return (
    <group position={[mx, 0.02, mz]}>
      {/* outer ring */}
      <mesh rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[r*0.72, r, 32]}/>
        <meshStandardMaterial color={c.hex} emissive={c.emissive}
          emissiveIntensity={isSelected?0.9:hov?0.6:0.3} transparent opacity={0.9}/>
      </mesh>
      {/* inner fill — clickable */}
      <mesh rotation={[-Math.PI/2,0,0]}
        onClick={e=>{e.stopPropagation();onClick();}}
        onPointerOver={e=>{e.stopPropagation();setHov(true);document.body.style.cursor="pointer";}}
        onPointerOut={()=>{setHov(false);document.body.style.cursor="default";}}>
        <circleGeometry args={[r*0.7, 32]}/>
        <meshStandardMaterial color={c.hex} emissive={c.emissive}
          emissiveIntensity={isSelected?1:hov?0.7:0.4} transparent opacity={0.7}/>
      </mesh>
      {/* FS value label */}
      <Text position={[0, 0.35, 0]} fontSize={0.28} color={c.hex}
        outlineWidth={0.04} outlineColor="#000" anchorX="center">
        {fs}
      </Text>
      {/* coordinate label below */}
      <Text position={[0, 0.08, r+0.05]} fontSize={0.16} color="#94a3b8"
        outlineWidth={0.02} outlineColor="#000" anchorX="center">
        {label}
      </Text>
    </group>
  );
}

// ── 3-D: Surrounding dirt ────────────────────────────────────────────────────
function Ground({ totalL, totalW }) {
  const big = Math.max(totalL, totalW) * 4 + 20;
  return (
    <mesh position={[totalL/2, -0.005, totalW/2]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <planeGeometry args={[big, big]}/>
      <meshStandardMaterial color="#3d2b1a" roughness={1}/>
    </mesh>
  );
}

// ── 3-D: 1m grid lines ───────────────────────────────────────────────────────
function GridLines({ L, W, ox, oz }) {
  const lines = useMemo(()=>{
    const pts=[];
    for(let x=0;x<=Math.ceil(L);x++) pts.push([ox+x,0.01,oz, ox+x,0.01,oz+W]);
    for(let z=0;z<=Math.ceil(W);z++) pts.push([ox,0.01,oz+z, ox+L,0.01,oz+z]);
    return pts;
  },[L,W,ox,oz]);
  return (
    <>
      {lines.map((p,i)=>{
        const arr=new Float32Array([p[0],p[1],p[2],p[3],p[4],p[5]]);
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" array={arr} count={2} itemSize={3}/>
            </bufferGeometry>
            <lineBasicMaterial color="#1e3a5c" opacity={0.35} transparent/>
          </line>
        );
      })}
    </>
  );
}

// ── Site border outline ───────────────────────────────────────────────────────
function SiteBorder({ L, W, ox, oz, colour, isSelected }) {
  const c = ssrCol(colour);
  const pts = useMemo(()=>{
    const y=0.03;
    return new Float32Array([
      ox,y,oz,  ox+L,y,oz,  ox+L,y,oz+W,  ox,y,oz+W,  ox,y,oz
    ]);
  },[L,W,ox,oz]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={pts} count={5} itemSize={3}/>
      </bufferGeometry>
      <lineBasicMaterial color={c.hex} opacity={isSelected?1:0.6} transparent/>
    </line>
  );
}

// ── Report panel ──────────────────────────────────────────────────────────────
const Panel = ({ sites, selSite, selMohr, onSelSite, onSelMohr, panelW, onResize }) => {
  const site    = selSite;
  const reading = selMohr;

  return (
    <div style={{position:"absolute",top:0,left:0,zIndex:100,width:panelW,height:"100%",
      background:"rgba(8,13,24,0.98)",borderRight:"1px solid #1e293b",
      display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* header */}
      <div style={{padding:"14px 16px",borderBottom:"1px solid #1e293b",background:"#0f172a",flexShrink:0}}>
        <div style={{fontSize:9,color:"#3b82f6",letterSpacing:2,fontWeight:700,marginBottom:3}}>URBAN FOUNDATION GUARDIAN</div>
        {site ? (
          <>
            <div style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>Site: {site.siteId}</div>
            <div style={{fontSize:11,color:"#475569",marginTop:2}}>
              {site.siteLength}m × {site.siteWidth}m · {site.numPillars} pillars · {site.buildingType}
            </div>
          </>
        ) : <div style={{fontSize:13,color:"#334155"}}>No site selected</div>}
      </div>

      {/* site selector pills */}
      <div style={{padding:"8px 14px",borderBottom:"1px solid #1e293b",flexShrink:0}}>
        <div style={{fontSize:9,color:"#475569",letterSpacing:1.2,marginBottom:6,fontWeight:700}}>SITES</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {sites.map((s,i)=>{
            const c=ssrCol(s.ssr_colour||"red");
            const isSel=selSite===s;
            return (
              <button key={i} onClick={()=>{ onSelSite(isSel?null:s); onSelMohr(null); }}
                style={{padding:"4px 10px",borderRadius:5,fontSize:10,cursor:"pointer",fontWeight:isSel?700:400,
                  border:`1px solid ${isSel?c.hex:c.hex+"55"}`,
                  background:isSel?c.hex+"33":"transparent",color:isSel?c.hex:c.hex+"bb"}}>
                {s.siteId}
              </button>
            );
          })}
          {!sites.length && <span style={{fontSize:11,color:"#334155"}}>No data — push records first</span>}
        </div>
      </div>

      {/* scrollable body */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
        {!site ? (
          <div style={{textAlign:"center",paddingTop:40}}>
            <div style={{fontSize:32,marginBottom:10}}>🏗️</div>
            <div style={{fontSize:13,color:"#334155"}}>Click a site floor or select above</div>
          </div>
        ) : (
          <>
            <Gauge score={site.ssr_score} colour={site.ssr_colour||"red"} cert={site.certification}/>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
              {[["FS",site.fs_score,40],["BC",site.bc_score,40],["SPT",site.spt_score,20]].map(([l,v,m])=>(
                <div key={l} style={{background:"#0f172a",borderRadius:7,padding:"8px 5px",textAlign:"center",border:"1px solid #1e293b"}}>
                  <div style={{fontSize:8,color:"#475569",letterSpacing:1,marginBottom:3}}>{l} SCORE</div>
                  <div style={{fontSize:17,fontWeight:700,color:"#f1f5f9",fontFamily:"monospace"}}>{v}</div>
                  <div style={{fontSize:8,color:"#334155"}}>/{m}</div>
                </div>
              ))}
            </div>

            <Sec t="Site summary"/>
            <Row l="Avg FS (all readings)" v={site.avg_fs}
              vc={parseFloat(site.avg_fs)>=2?"#22c55e":parseFloat(site.avg_fs)>=1.2?"#f59e0b":"#ef4444"} mono/>
            <Row l="Soil type"      v={site.soilType}/>
            <Row l="SPT N-value"    v={site.sptN} mono/>
            <Row l="Pillars"        v={site.numPillars} mono/>
            <Row l="Total load"     v={`${site.appliedLoad} kN`}/>
            <Row l="Load / pillar"  v={`${site.load_per_pillar} kN`} vc="#60a5fa" mono/>
            <Row l="Footing stress" v={`${site.pillar_stress} kN/m²`}
              vc={parseFloat(site.allowable_bc)>=parseFloat(site.pillar_stress)?"#22c55e":"#f59e0b"} mono/>
            <Row l="Ultimate qu"    v={`${site.ultimate_bc} kN/m²`} vc="#60a5fa" mono/>
            <Row l="Allowable qa"   v={`${site.allowable_bc} kN/m²`}/>
            {site.group_effect && (
              <div style={{fontSize:11,color:"#f59e0b",background:"#f59e0b11",
                border:"1px solid #f59e0b44",borderRadius:5,padding:"5px 8px",margin:"5px 0"}}>
                ⚠ Group effect — pillars too close
              </div>
            )}

            {/* Mohr readings list */}
            <Sec t={`Mohr-Coulomb readings (${(site.mohrReadings||[]).length})`}/>
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
              {(site.mohrReadings||[]).map((r,i)=>{
                const c=fsCol(r.fs_colour||"red");
                const isSel=selMohr===r;
                return (
                  <div key={i} onClick={()=>onSelMohr(isSel?null:r)}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,cursor:"pointer",
                      background:isSel?c.hex+"22":"#0f172a",border:`1px solid ${isSel?c.hex:c.hex+"44"}`}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:c.hex,flexShrink:0}}/>
                    <span style={{fontSize:11,color:"#94a3b8",flex:1}}>({r.measureX}m, {r.measureY}m)</span>
                    <span style={{fontSize:13,fontWeight:700,color:c.hex,fontFamily:"monospace"}}>{r.fs}</span>
                    <span style={{fontSize:10,color:c.hex}}>{c.label}</span>
                  </div>
                );
              })}
            </div>

            {/* selected reading detail */}
            {reading && (
              <>
                <Sec t={`Reading — (${reading.measureX}m, ${reading.measureY}m)`}/>
                <Row l="Factor of Safety" v={reading.fs} vc={fsCol(reading.fs_colour||"red").hex} mono/>
                <Row l="Cohesion c'"       v={`${reading.cohesion} kPa`}/>
                <Row l="Normal stress σ'"  v={`${reading.normalStress} kPa`}/>
                <Row l="Friction angle φ'" v={`${reading.frictionAngle}°`}/>
                <Row l="Shear stress τ"    v={`${reading.shearStress} kPa`}/>
                <Row l="Pore pressure u"   v={`${reading.porePressure||0} kPa`}/>
              </>
            )}

            <Sec t="⚙ AI Geotechnical Advice"/>
            <Advice text={site.ai_advice}/>
          </>
        )}
      </div>

      {/* resize handle */}
      <div onMouseDown={onResize} title="Drag to resize"
        style={{position:"absolute",top:0,right:0,width:4,height:"100%",cursor:"ew-resize",background:"rgba(59,130,246,0.18)"}}/>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const Visualizer = () => {
  const [sites,   setSites]   = useState([]);
  const [selSite, setSelSite] = useState(null);
  const [selMohr, setSelMohr] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [panelW,  setPanelW]  = useState(360);
  const resRef = useRef({});

  const fetch_ = async () => {
    setSyncing(true);
    try {
      const d = await (await fetch("http://localhost:8000/api/get-foundation-data")).json();
      setSites(d);

      // If URL has ?siteId=N, auto-select that site
      const params  = new URLSearchParams(window.location.search);
      const urlId   = params.get("siteId");
      if (urlId) {
        const target = d.find(s => String(s.id) === String(urlId));
        if (target) setSelSite(target);
        // Clean URL without reload so it doesn't re-trigger on next poll
        window.history.replaceState({}, "", "/");
      }
    } catch(e) { console.error(e); }
    finally { setSyncing(false); }
  };

  useEffect(()=>{
    fetch_();
    const t=setInterval(fetch_,10000);
    return ()=>clearInterval(t);
  },[]);

  const onResize = (e) => {
    e.preventDefault();
    resRef.current = { x:e.clientX, w:panelW };
    const onMove = (e) => setPanelW(Math.max(300,Math.min(600,resRef.current.w+(e.clientX-resRef.current.x))));
    const onUp   = ()  => { window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  };

  // Only render the selected site in the 3D canvas
  const visibleSite = selSite;
  const L  = parseFloat(visibleSite?.siteLength  || 20);
  const W  = parseFloat(visibleSite?.siteWidth   || 15);

  return (
    <div style={{width:"100%",height:"100vh",background:"#0a0f1a",position:"relative",overflow:"hidden",display:"flex"}}>

      <Panel sites={sites} selSite={selSite} selMohr={selMohr}
        onSelSite={setSelSite} onSelMohr={setSelMohr}
        panelW={panelW} onResize={onResize}/>

      <div style={{flex:1,position:"relative",marginLeft:panelW}}>

        {/* sync badge */}
        <div style={{position:"absolute",top:14,right:14,zIndex:10,display:"flex",alignItems:"center",gap:6,
          background:"rgba(15,23,42,0.92)",border:"1px solid #1e293b",borderRadius:8,padding:"6px 12px"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:syncing?"#4dff88":"#334155"}}/>
          <span style={{fontSize:10,color:"#475569"}}>
            {syncing ? "Syncing..." : sites.length ? `${sites.length} site(s) in DB` : "No data"}
          </span>
          <button onClick={fetch_}
            style={{marginLeft:6,background:"#1d4ed8",border:"none",color:"white",borderRadius:5,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>
            ↺
          </button>
        </div>

        {/* legend */}
        <div style={{position:"absolute",bottom:14,right:14,zIndex:10,background:"rgba(10,15,28,0.92)",
          border:"1px solid #1e293b",borderRadius:9,padding:"10px 14px"}}>
          <div style={{fontSize:9,color:"#475569",letterSpacing:1.5,marginBottom:7,fontWeight:700}}>LEGEND</div>
          <div style={{fontSize:9,color:"#64748b",marginBottom:4,letterSpacing:1}}>FLOOR — SSR RATING</div>
          {Object.entries(SSR_C).map(([k,c])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
              <div style={{width:22,height:8,background:c.hex,borderRadius:2,opacity:.75}}/>
              <span style={{fontSize:10,color:"#94a3b8"}}>{c.label}</span>
            </div>
          ))}
          <div style={{fontSize:9,color:"#64748b",margin:"8px 0 4px",letterSpacing:1}}>DISC — FS (MOHR-COULOMB)</div>
          {Object.entries(FS_C).map(([k,c])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:c.hex}}/>
              <span style={{fontSize:10,color:"#94a3b8"}}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* No site selected state */}
        {!visibleSite && (
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            textAlign:"center",color:"#334155",zIndex:5,pointerEvents:"none"}}>
            <div style={{fontSize:48,marginBottom:16}}>🏗️</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>No site selected</div>
            <div style={{fontSize:13}}>Select a site from the panel to view its 3D analysis</div>
          </div>
        )}

        <Canvas shadows style={{background:"#0a0f1a"}}>
          <PerspectiveCamera makeDefault position={[L*0.9+5, L*0.7+3, W*0.9+5]} fov={50}/>
          <OrbitControls makeDefault minDistance={3} maxDistance={300} target={[L/2, 0, W/2]}/>
          <ambientLight intensity={0.6}/>
          <directionalLight position={[L, L, W]} intensity={1.1} castShadow shadow-mapSize={[2048,2048]}/>
          <pointLight position={[-5,12,-5]} intensity={0.3} color="#93c5fd"/>
          <hemisphereLight skyColor="#1e3a5c" groundColor="#3d2b1a" intensity={0.3}/>

          {visibleSite && (
            <group>
              {/* Dirt surround */}
              <Ground totalL={L} totalW={W}/>

              {/* Coloured floor — SSR */}
              <SiteSlab L={L} W={W} ox={0} oz={0}
                colour={visibleSite.ssr_colour||"red"} isSelected={true}
                onClick={()=>{}}/>

              {/* Grid */}
              <GridLines L={L} W={W} ox={0} oz={0}/>

              {/* Border */}
              <SiteBorder L={L} W={W} ox={0} oz={0} colour={visibleSite.ssr_colour||"red"} isSelected={true}/>

              {/* Site label */}
              <Text position={[L/2, 0.05, -0.7]} fontSize={0.38} color="#60a5fa"
                outlineWidth={0.04} outlineColor="#000" anchorX="center">
                {visibleSite.siteId}  SSR {visibleSite.ssr_score}
              </Text>

              {/* Mohr disc indicators */}
              {(visibleSite.mohrReadings||[]).map((r,ri)=>{
                const mx     = parseFloat(r.measureX||0);
                const mz     = parseFloat(r.measureY||0);
                const isMSel = selMohr===r;
                return (
                  <MohrIndicator key={ri}
                    mx={mx} mz={mz}
                    colour={r.fs_colour||"red"}
                    fs={r.fs}
                    label={`(${r.measureX},${r.measureY})`}
                    isSelected={isMSel}
                    onClick={()=>{ setSelMohr(isMSel?null:r); }}
                  />
                );
              })}
            </group>
          )}
        </Canvas>
      </div>
    </div>
  );
};

export default Visualizer;