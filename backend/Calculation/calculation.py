import math


# ──────────────────────────────────────────────
# 1. MOHR-COULOMB  →  Factor of Safety
# ──────────────────────────────────────────────
def calculate_fs(row):
    """
    Mohr-Coulomb failure criterion:
        FS = (c' + (σ - u) · tan φ') / τ
    """
    c     = float(row['cohesion'])
    sigma = float(row['normalStress'])
    phi   = math.radians(float(row['frictionAngle']))
    tau   = float(row['shearStress'])
    u     = float(row.get('porePressure', 0))

    fs = (c + (sigma - u) * math.tan(phi)) / tau
    return round(fs, 2)


# ──────────────────────────────────────────────
# 2. TERZAGHI  →  Bearing Capacity
# ──────────────────────────────────────────────
def calculate_bearing_capacity(row):
    """
    Terzaghi general bearing capacity (strip footing):
        qu = c·Nc + γ·Df·Nq + 0.5·γ·B·Nγ
    Applies local shear correction when SPT N < 10.
    """
    c     = float(row['cohesion'])
    phi_d = float(row.get('frictionAngle', 0))
    gamma = float(row.get('unitWeight', 18))
    Df    = float(row.get('foundationDepth', 1.5))
    B     = float(row.get('foundationWidth', 1.5))
    gw    = float(row.get('groundwaterDepth', 999))
    spt_n = float(row.get('sptN', 30))

    # Local shear correction for soft/loose soils (SPT N < 10)
    local_shear = spt_n < 10
    if local_shear:
        c     = (2 / 3) * c
        phi_d = math.degrees(math.atan((2 / 3) * math.tan(math.radians(phi_d))))

    phi = math.radians(phi_d)

    if phi_d == 0:
        Nc, Nq, Ng = 5.14, 1.0, 0.0
    else:
        Nq = math.exp(math.pi * math.tan(phi)) * (math.tan(math.radians(45 + phi_d / 2)) ** 2)
        Nc = (Nq - 1) / math.tan(phi)
        Ng = 2 * (Nq + 1) * math.tan(phi)

    qu = c * Nc + gamma * Df * Nq + 0.5 * gamma * B * Ng

    # Groundwater correction
    if gw <= Df:
        qu *= 0.5
    elif gw <= Df + B:
        factor = 0.5 + 0.5 * (gw - Df) / B
        qu *= factor

    qa = qu / 3.0

    return {
        "ultimate_bc":   round(qu, 2),
        "allowable_bc":  round(qa, 2),
        "Nc":            round(Nc, 3),
        "Nq":            round(Nq, 3),
        "Ngamma":        round(Ng, 3),
        "local_shear":   local_shear,
    }


# ──────────────────────────────────────────────
# 3. STRUCTURAL STABILITY RATING  (SSR)
# ──────────────────────────────────────────────
def calculate_ssr(fs: float, qa: float, applied_load: float, spt_n: float) -> dict:
    """
    Weighted SSR score (0-100):
      40% → FS score      : linearly scaled, FS 1.0=0 pts, FS 2.5+=40 pts
      40% → BC adequacy   : ratio qa/applied_load, capped at 1.0 → 40 pts
                            (if applied_load=0, assume adequate → 40 pts)
      20% → SPT N score   : N<=5=0, N>=30=20 pts, linear between

    Certification bands:
      80-100 → CERTIFIED STABLE   (green)
      50-79  → CONDITIONAL        (amber)
      0-49   → HAZARD WARNING     (red)
    """
    # FS component (0–40)
    fs_clamped = max(1.0, min(fs, 2.5))
    fs_score   = ((fs_clamped - 1.0) / 1.5) * 40

    # BC adequacy component (0–40)
    if applied_load <= 0:
        bc_score = 40.0
    else:
        ratio    = min(qa / applied_load, 1.0) if applied_load > 0 else 1.0
        bc_score = ratio * 40

    # SPT N component (0–20)
    spt_clamped = max(0, min(spt_n, 30))
    spt_score   = (spt_clamped / 30) * 20

    total = round(fs_score + bc_score + spt_score, 1)

    if total >= 80:
        cert   = "CERTIFIED STABLE"
        level  = "Low"
        colour = "green"
    elif total >= 50:
        cert   = "CONDITIONAL"
        level  = "Moderate"
        colour = "orange"
    else:
        cert   = "HAZARD WARNING"
        level  = "High"
        colour = "red"

    return {
        "ssr_score":      total,
        "certification":  cert,
        "risk_level":     level,
        "colour":         colour,
        "fs_score":       round(fs_score, 1),
        "bc_score":       round(bc_score, 1),
        "spt_score":      round(spt_score, 1),
    }