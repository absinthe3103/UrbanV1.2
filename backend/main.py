import os, requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from Calculation.calculation import calculate_fs, calculate_bearing_capacity, calculate_ssr
from database import init_db, insert_site, insert_mohr_readings, fetch_all_sites, fetch_site_by_id

load_dotenv()

API_KEY     = os.getenv("QWEN2.5_API_KEY", "sk-kF-Xeh7a8MPt-IL3bgOy1w")
AI_ENDPOINT = "https://aiworkshopapi.flexinfra.com.my/v1/chat/completions"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()          # create tables on startup if they don't exist
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Pydantic models ───────────────────────────────────────────────────────────
class MohrReading(BaseModel):
    measureX:      str
    measureY:      str
    cohesion:      str
    normalStress:  str
    frictionAngle: str
    shearStress:   str
    porePressure:  str = "0"
    fs:            str = "0"
    fs_colour:     str = "red"


class SiteRecord(BaseModel):
    siteId:           str = "SITE-001"
    siteLength:       str = "20"
    siteWidth:        str = "15"
    numPillars:       str = "4"
    buildingType:     str
    soilType:         str = "Unknown"
    sptN:             str = "0"
    unitWeight:       str = "18"
    foundationWidth:  str = "1.5"
    foundationDepth:  str = "1.5"
    groundwaterDepth: str = "999"
    appliedLoad:      str = "0"
    mohrReadings:     List[MohrReading] = []
    ultimate_bc:      str = "0"
    allowable_bc:     str = "0"
    load_per_pillar:  str = "0"
    pillar_stress:    str = "0"
    est_spacing:      str = "0"
    group_effect:     bool = False
    ssr_score:        str = "0"
    certification:    str = ""
    risk_level:       str = ""
    ssr_colour:       str = "red"
    fs_score:         str = "0"
    bc_score:         str = "0"
    spt_score:        str = "0"
    avg_fs:           str = "0"
    ai_advice:        str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────
def _fs_colour(fs: float) -> str:
    if fs >= 2.0: return "green"
    if fs >= 1.2: return "orange"
    return "red"


def get_ai_advice(site: SiteRecord, bc: dict, ssr: dict) -> str:
    readings_summary = "\n".join([
        f"  Point ({r.measureX}m, {r.measureY}m): FS={r.fs}, status={r.fs_colour}"
        for r in site.mohrReadings
    ])
    prompt = (
        f"Reviewing foundation data for a {site.buildingType} on site {site.siteId}.\n\n"
        f"SITE: {site.siteLength}m × {site.siteWidth}m · {site.numPillars} pillars · "
        f"load {site.appliedLoad} kN · {bc.get('load_per_pillar',0)} kN/pillar · "
        f"footing stress {bc.get('pillar_stress',0)} kN/m² · spacing {bc.get('est_spacing',0)}m · "
        f"group effect: {'YES' if bc.get('group_effect') else 'No'}\n\n"
        f"SOIL: {site.soilType} · SPT N={site.sptN} · γ={site.unitWeight} kN/m³ · "
        f"GW={site.groundwaterDepth}m · local shear: {bc.get('local_shear',False)}\n\n"
        f"FOUNDATION: B={site.foundationWidth}m · Df={site.foundationDepth}m · "
        f"qu={bc['ultimate_bc']} kN/m² · qa={bc['allowable_bc']} kN/m²\n\n"
        f"MOHR READINGS ({len(site.mohrReadings)} points)\n{readings_summary}\n"
        f"Average FS: {site.avg_fs}\n\n"
        f"SSR: {ssr['ssr_score']}/100 · {ssr['certification']} · "
        f"FS={ssr['fs_score']}/40 BC={ssr['bc_score']}/40 SPT={ssr['spt_score']}/20\n\n"
        "Do NOT recalculate. Provide:\n"
        "1. Risk level (Low/Moderate/High) — one-sentence justification\n"
        "2. Spatial soil risk pattern from the coordinate readings\n"
        "3. Pillar layout assessment — load distribution, group effects\n"
        "4. Recommended foundation type\n"
        "5. Engineering steps to improve stability and raise SSR\n"
        "Be concise. Numbered points only."
    )
    payload = {
        "model": "qwen2.5",
        "messages": [
            {"role": "system", "content": "Licensed geotechnical engineer. Concise numbered points. No preamble. Do not recalculate."},
            {"role": "user",   "content": prompt}
        ],
        "max_completion_tokens": 2000,
        "temperature": 0.1,
        "top_p": 0.9
    }
    try:
        r = requests.post(AI_ENDPOINT,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload, timeout=60)
        r.raise_for_status()
        return r.json()['choices'][0]['message']['content']
    except Exception as e:
        return f"AI Analysis Error: {str(e)}"


# ── Routes ────────────────────────────────────────────────────────────────────
@app.post("/api/data-ingest")
async def save_data(data: List[SiteRecord]):
    saved_ids = []

    for site in data:
        d = site.model_dump()

        # 1 — FS per Mohr reading
        fs_values = []
        for reading in site.mohrReadings:
            try:
                fs_val = calculate_fs({
                    "cohesion":      reading.cohesion,
                    "normalStress":  reading.normalStress,
                    "frictionAngle": reading.frictionAngle,
                    "shearStress":   reading.shearStress,
                    "porePressure":  reading.porePressure,
                })
                reading.fs       = f"{fs_val:.2f}"
                reading.fs_colour= _fs_colour(fs_val)
                fs_values.append(fs_val)
            except Exception as e:
                print(f"Mohr FS error: {e}")
                reading.fs = "1.0"; reading.fs_colour = "red"; fs_values.append(1.0)

        site.avg_fs = f"{(sum(fs_values)/len(fs_values)):.2f}" if fs_values else "0"

        # 2 — Terzaghi
        try:
            bc = calculate_bearing_capacity(d)
            site.ultimate_bc    = str(bc["ultimate_bc"])
            site.allowable_bc   = str(bc["allowable_bc"])
            site.load_per_pillar= str(bc["load_per_pillar"])
            site.pillar_stress  = str(bc["pillar_stress"])
            site.est_spacing    = str(bc["est_spacing"])
            site.group_effect   = bc["group_effect"]
        except Exception as e:
            print(f"BC error: {e}")
            bc = {"ultimate_bc":0,"allowable_bc":0,"Nc":0,"Nq":0,"Ngamma":0,
                  "local_shear":False,"load_per_pillar":0,"pillar_stress":0,"est_spacing":0,"group_effect":False}

        # 3 — SSR
        try:
            ssr = calculate_ssr(float(site.avg_fs), float(site.allowable_bc),
                                float(site.pillar_stress), float(site.sptN))
            site.ssr_score    = str(ssr["ssr_score"])
            site.certification= ssr["certification"]
            site.risk_level   = ssr["risk_level"]
            site.ssr_colour   = ssr["colour"]
            site.fs_score     = str(ssr["fs_score"])
            site.bc_score     = str(ssr["bc_score"])
            site.spt_score    = str(ssr["spt_score"])
        except Exception as e:
            print(f"SSR error: {e}")
            ssr = {"ssr_score":0,"certification":"HAZARD WARNING","risk_level":"High",
                   "colour":"red","fs_score":0,"bc_score":0,"spt_score":0}

        # 4 — AI advice
        site.ai_advice = get_ai_advice(site, bc, ssr)

        # 5 — Persist to PostgreSQL
        try:
            site_pk = insert_site(site.model_dump())
            insert_mohr_readings(site_pk, [r.model_dump() for r in site.mohrReadings])
            saved_ids.append(site_pk)
        except Exception as e:
            print(f"DB error: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"status": "success", "processed_count": len(data), "ids": saved_ids}


@app.get("/api/get-foundation-data")
async def get_data():
    """Return all sites from PostgreSQL."""
    try:
        return fetch_all_sites()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/get-foundation-data/{site_db_id}")
async def get_site(site_db_id: int):
    """Return one site by its database ID."""
    site = fetch_site_by_id(site_db_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@app.delete("/api/delete-site/{site_db_id}")
async def delete_site(site_db_id: int):
    """Delete a site and its Mohr readings (cascade)."""
    from database import get_conn
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sites WHERE id = %s", (site_db_id,))
            conn.commit()
        return {"status": "deleted", "id": site_db_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}