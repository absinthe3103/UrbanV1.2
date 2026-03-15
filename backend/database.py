"""
database.py — PostgreSQL connection and schema setup using psycopg2.

Tables:
  sites        — one row per site record (all scalar fields)
  mohr_readings — one row per Mohr-Coulomb reading, foreign-keyed to sites

AI response length:
  ai_advice is stored as TEXT (unlimited in PostgreSQL).
  PostgreSQL TEXT has no length limit — responses of any size are stored safely.
  Only VARCHAR(n) has a cap; we deliberately avoid it here.

Connection pooling:
  Uses psycopg2.pool.ThreadedConnectionPool (min=2, max=10).
  All functions borrow a connection via _get_conn() and always return it
  to the pool in a finally block — preventing connection leaks.
"""

import os
import psycopg2
import psycopg2.extras
import psycopg2.pool
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/soilsense"
)

# ---------------------------------------------------------------------------
# Connection pool — created once at import time.
# MIN_CONN kept small so cold starts are cheap;
# MAX_CONN sized for typical FastAPI thread concurrency.
# ---------------------------------------------------------------------------
_pool: psycopg2.pool.ThreadedConnectionPool | None = None

def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Initialise the pool lazily (once) and return it."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DB_URL,
        )
    return _pool


@contextmanager
def _get_conn():
    """
    Context manager: borrow a connection from the pool, yield it,
    then ALWAYS return it — even if an exception is raised.

    Usage:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                ...
            conn.commit()          # caller's responsibility
    """
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()            # roll back any open transaction on error
        raise
    finally:
        pool.putconn(conn)         # always return to pool


def close_pool():
    """Cleanly close all pooled connections (call on app shutdown)."""
    global _pool
    if _pool and not _pool.closed:
        _pool.closeall()
        _pool = None


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
def init_db():
    """Create tables if they do not exist."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sites (
                    id              SERIAL PRIMARY KEY,
                    site_id         TEXT        NOT NULL,
                    created_at      TIMESTAMPTZ DEFAULT NOW(),

                    -- site info
                    site_length     TEXT,
                    site_width      TEXT,
                    num_pillars     TEXT,
                    building_type   TEXT,
                    soil_type       TEXT,
                    spt_n           TEXT,

                    -- terzaghi inputs
                    unit_weight      TEXT,
                    foundation_width TEXT,
                    foundation_depth TEXT,
                    groundwater_depth TEXT,
                    applied_load     TEXT,

                    -- computed results
                    ultimate_bc     TEXT,
                    allowable_bc    TEXT,
                    load_per_pillar TEXT,
                    pillar_stress   TEXT,
                    est_spacing     TEXT,
                    group_effect    BOOLEAN,
                    ssr_score       TEXT,
                    certification   TEXT,
                    risk_level      TEXT,
                    ssr_colour      TEXT,
                    fs_score        TEXT,
                    bc_score        TEXT,
                    spt_score       TEXT,
                    avg_fs          TEXT,

                    -- AI response — TEXT has no length limit in PostgreSQL
                    ai_advice       TEXT
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS mohr_readings (
                    id             SERIAL PRIMARY KEY,
                    site_pk        INTEGER REFERENCES sites(id) ON DELETE CASCADE,
                    measure_x      TEXT,
                    measure_y      TEXT,
                    cohesion       TEXT,
                    normal_stress  TEXT,
                    friction_angle TEXT,
                    shear_stress   TEXT,
                    pore_pressure  TEXT,
                    fs             TEXT,
                    fs_colour      TEXT
                );
            """)
        conn.commit()
    print("DB tables ready.")


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------
def insert_site(site_dict: dict) -> int:
    """Insert a site record. Returns the new site PK (integer id)."""
    sql = """
        INSERT INTO sites (
            site_id, site_length, site_width, num_pillars,
            building_type, soil_type, spt_n,
            unit_weight, foundation_width, foundation_depth,
            groundwater_depth, applied_load,
            ultimate_bc, allowable_bc, load_per_pillar, pillar_stress,
            est_spacing, group_effect,
            ssr_score, certification, risk_level, ssr_colour,
            fs_score, bc_score, spt_score, avg_fs,
            ai_advice
        ) VALUES (
            %(siteId)s, %(siteLength)s, %(siteWidth)s, %(numPillars)s,
            %(buildingType)s, %(soilType)s, %(sptN)s,
            %(unitWeight)s, %(foundationWidth)s, %(foundationDepth)s,
            %(groundwaterDepth)s, %(appliedLoad)s,
            %(ultimate_bc)s, %(allowable_bc)s, %(load_per_pillar)s, %(pillar_stress)s,
            %(est_spacing)s, %(group_effect)s,
            %(ssr_score)s, %(certification)s, %(risk_level)s, %(ssr_colour)s,
            %(fs_score)s, %(bc_score)s, %(spt_score)s, %(avg_fs)s,
            %(ai_advice)s
        ) RETURNING id;
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, site_dict)
            pk = cur.fetchone()[0]
        conn.commit()
    return pk


def insert_mohr_readings(site_pk: int, readings: list):
    """Bulk-insert Mohr readings for a site."""
    if not readings:
        return
    sql = """
        INSERT INTO mohr_readings (
            site_pk, measure_x, measure_y,
            cohesion, normal_stress, friction_angle,
            shear_stress, pore_pressure, fs, fs_colour
        ) VALUES %s;
    """
    rows = [
        (
            site_pk,
            r.get("measureX"), r.get("measureY"),
            r.get("cohesion"), r.get("normalStress"), r.get("frictionAngle"),
            r.get("shearStress"), r.get("porePressure"),
            r.get("fs"), r.get("fs_colour"),
        )
        for r in readings
    ]
    with _get_conn() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, sql, rows)
        conn.commit()


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------
def _row_to_site(d: dict) -> dict:
    """Map a snake_case DB row dict to the camelCase shape expected by the frontend."""
    return {
        "id":               d["id"],
        "siteId":           d["site_id"],
        "createdAt":        d["created_at"].isoformat() if d["created_at"] else "",
        "siteLength":       d["site_length"],
        "siteWidth":        d["site_width"],
        "numPillars":       d["num_pillars"],
        "buildingType":     d["building_type"],
        "soilType":         d["soil_type"],
        "sptN":             d["spt_n"],
        "unitWeight":       d["unit_weight"],
        "foundationWidth":  d["foundation_width"],
        "foundationDepth":  d["foundation_depth"],
        "groundwaterDepth": d["groundwater_depth"],
        "appliedLoad":      d["applied_load"],
        "ultimate_bc":      d["ultimate_bc"],
        "allowable_bc":     d["allowable_bc"],
        "load_per_pillar":  d["load_per_pillar"],
        "pillar_stress":    d["pillar_stress"],
        "est_spacing":      d["est_spacing"],
        "group_effect":     d["group_effect"],
        "ssr_score":        d["ssr_score"],
        "certification":    d["certification"],
        "risk_level":       d["risk_level"],
        "ssr_colour":       d["ssr_colour"],
        "fs_score":         d["fs_score"],
        "bc_score":         d["bc_score"],
        "spt_score":        d["spt_score"],
        "avg_fs":           d["avg_fs"],
        "ai_advice":        d["ai_advice"],
        "mohrReadings": (
            d["mohr_readings"]
            if d["mohr_readings"] and d["mohr_readings"] != [None]
            else []
        ),
    }


_SITE_QUERY = """
    SELECT s.*,
           json_agg(
               json_build_object(
                   'measureX',      m.measure_x,
                   'measureY',      m.measure_y,
                   'cohesion',      m.cohesion,
                   'normalStress',  m.normal_stress,
                   'frictionAngle', m.friction_angle,
                   'shearStress',   m.shear_stress,
                   'porePressure',  m.pore_pressure,
                   'fs',            m.fs,
                   'fs_colour',     m.fs_colour
               ) ORDER BY m.id
           ) AS mohr_readings
    FROM sites s
    LEFT JOIN mohr_readings m ON m.site_pk = s.id
"""


def fetch_all_sites() -> list:
    """Return all sites with their Mohr readings as a list of dicts."""
    query = _SITE_QUERY + " GROUP BY s.id ORDER BY s.created_at DESC;"
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    return [_row_to_site(dict(row)) for row in rows]


def fetch_site_by_id(site_db_id: int) -> dict | None:
    """Return a single site by its database PK (direct query — no full-table scan)."""
    query = _SITE_QUERY + " WHERE s.id = %s GROUP BY s.id;"
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, (site_db_id,))
            row = cur.fetchone()
    return _row_to_site(dict(row)) if row else None