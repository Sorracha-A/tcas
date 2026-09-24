import { useEffect, useMemo, useState, useRef } from 'react'
import './App.css'

type Row = {
  university: string
  campus: string
  program_code: string
  major_code: string
  project_code: string
  faculty: string
  program: string
  detail: string
  major: string
  joint_code: string
  seats: number
  applied: number
  passed: number
  max_score: number
  min_score: number
}

type SortKey =
  | 'min_score'
  | 'max_score'
  | 'applied'
  | 'passed'
  | 'seats'
  | 'university'
  | 'faculty'
  | 'competition'

type SortDir = 'asc' | 'desc'
type View = 'insights' | 'table'

const PAGE_SIZE = 50

// ---------- helpers ----------
function fmtScore(n: number) {
  if (!n) return '-'
  return n.toFixed(2)
}
function fmtInt(n: number) {
  return n.toLocaleString('en-US')
}
function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

// ---------- MultiSelect ----------
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'ค้นหา...',
}: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return options
    return options.filter((o) => o.toLowerCase().includes(ql))
  }, [options, q])

  function toggle(v: string) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }

  return (
    <div className="ms" ref={wrapRef}>
      <label className="ms-label">{label}</label>
      <button
        type="button"
        className="ms-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        {selected.size === 0 ? (
          <span className="ms-placeholder">เลือกทั้งหมด</span>
        ) : (
          <span className="ms-count">{selected.size} รายการ</span>
        )}
        <span className="ms-caret">▾</span>
      </button>
      {open && (
        <div className="ms-pop">
          <input
            className="ms-search"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="ms-actions">
            <button
              type="button"
              className="ms-mini"
              onClick={() => onChange(new Set())}
            >
              ล้าง
            </button>
            <button
              type="button"
              className="ms-mini"
              onClick={() => onChange(new Set(filtered))}
            >
              เลือกที่กรอง
            </button>
          </div>
          <div className="ms-list">
            {filtered.slice(0, 500).map((o) => (
              <label key={o} className="ms-item">
                <input
                  type="checkbox"
                  checked={selected.has(o)}
                  onChange={() => toggle(o)}
                />
                <span>{o}</span>
              </label>
            ))}
            {filtered.length > 500 && (
              <div className="ms-more">
                แสดง 500 / {filtered.length} — พิมพ์เพื่อกรองเพิ่ม
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Animated count-up ----------
function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [v, setV] = useState(0)
  const fromRef = useRef(0)
  const startRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    fromRef.current = v
    startRef.current = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (t: number) => {
      const p = Math.min(1, (t - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = fromRef.current + (value - fromRef.current) * eased
      setV(next)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{fmtInt(Math.round(v))}</>
}

// ---------- KPI card ----------
function KpiCard({
  emoji,
  label,
  value,
  sub,
  accent = 'a1',
  onClick,
}: {
  emoji: string
  label: string
  value: number | string
  sub?: string
  accent?: 'a1' | 'a2' | 'a3' | 'a4' | 'a5'
  onClick?: () => void
}) {
  return (
    <div
      className={`kpi kpi-${accent} ${onClick ? 'kpi-click' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="kpi-emoji">{emoji}</div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

// ---------- Chair seat visualization ----------
// renders a grid of chair glyphs. Filled = passed (accepted), Empty = remaining seat.
// Capped to MAX chairs; shows scale factor if needed.
const CHAIR_MAX = 600

function ChairsViz({
  seats,
  passed,
  applied,
  title,
}: {
  seats: number
  passed: number
  applied: number
  title: string
}) {
  const total = Math.max(seats, passed)
  const scale = total > CHAIR_MAX ? Math.ceil(total / CHAIR_MAX) : 1
  const drawnTotal = Math.ceil(total / scale)
  const drawnFilled = Math.ceil(passed / scale)

  const chairs = Array.from({ length: drawnTotal }, (_, i) => i < drawnFilled)
  const fillPct = pct(passed, seats || passed || 1)
  const compete = seats > 0 ? (applied / seats).toFixed(1) : '-'

  return (
    <div className="chairs-card">
      <div className="chairs-head">
        <div>
          <div className="chairs-title">{title}</div>
          <div className="chairs-sub">
            🪑 1 เก้าอี้ = {scale} ที่นั่ง · เต็ม {fillPct}% · แข่ง {compete}x
          </div>
        </div>
        <div className="chairs-legend">
          <span className="leg leg-on">นั่งแล้ว ({fmtInt(passed)})</span>
          <span className="leg leg-off">ว่าง ({fmtInt(Math.max(0, seats - passed))})</span>
        </div>
      </div>
      <div className="chairs-grid">
        {chairs.map((on, i) => (
          <span
            key={i}
            className={`chair ${on ? 'chair-on' : 'chair-off'}`}
            style={{ animationDelay: `${(i % 60) * 8}ms` }}
            title={on ? 'นั่งแล้ว' : 'ว่าง'}
          >
            🪑
          </span>
        ))}
      </div>
      <div className="chairs-bars">
        <div className="bar-row">
          <span className="bar-lbl">รับ</span>
          <div className="bar-track">
            <div className="bar-fill bar-seats" style={{ width: '100%' }}>
              {fmtInt(seats)}
            </div>
          </div>
        </div>
        <div className="bar-row">
          <span className="bar-lbl">สมัคร</span>
          <div className="bar-track">
            <div
              className="bar-fill bar-applied"
              style={{
                width: `${Math.min(100, (applied / Math.max(applied, seats)) * 100)}%`,
              }}
            >
              {fmtInt(applied)}
            </div>
          </div>
        </div>
        <div className="bar-row">
          <span className="bar-lbl">ผ่าน</span>
          <div className="bar-track">
            <div
              className="bar-fill bar-passed"
              style={{
                width: `${Math.min(100, (passed / Math.max(applied, seats)) * 100)}%`,
              }}
            >
              {fmtInt(passed)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Bar chart (horizontal, interactive) ----------
function BarChart({
  title,
  emoji,
  items,
  onClick,
  highlight,
  valueFmt,
  unit,
  colorStart = '#6cb6ff',
  colorEnd = '#a78bfa',
}: {
  title: string
  emoji: string
  items: { label: string; value: number }[]
  onClick?: (label: string) => void
  highlight?: Set<string>
  valueFmt?: (v: number) => string
  unit?: string
  colorStart?: string
  colorEnd?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="chart-card">
      <div className="chart-head">
        <span className="chart-emoji">{emoji}</span>
        <h3 className="chart-title">{title}</h3>
        {onClick && <span className="chart-hint">คลิกแถบเพื่อกรอง</span>}
      </div>
      <div className="chart-body">
        {items.map((it, idx) => {
          const w = (it.value / max) * 100
          const on = highlight?.has(it.label)
          return (
            <div
              key={it.label}
              className={`hbar ${onClick ? 'hbar-click' : ''} ${on ? 'hbar-on' : ''}`}
              onClick={() => onClick?.(it.label)}
              style={{ ['--i' as string]: idx } as React.CSSProperties}
            >
              <div className="hbar-lbl" title={it.label}>
                {it.label}
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{
                    width: `${w}%`,
                    background: `linear-gradient(90deg, ${colorStart}, ${colorEnd})`,
                  }}
                />
                <span className="hbar-val">
                  {valueFmt ? valueFmt(it.value) : fmtInt(it.value)}
                  {unit}
                </span>
              </div>
            </div>
          )
        })}
        {items.length === 0 && <div className="chart-empty">ไม่มีข้อมูล</div>}
      </div>
    </div>
  )
}

// ---------- Histogram (clickable bins) ----------
function Histogram({
  values,
  binSize = 5,
  min = 0,
  max = 100,
  onPick,
  picked,
}: {
  values: number[]
  binSize?: number
  min?: number
  max?: number
  onPick?: (range: [number, number]) => void
  picked?: [number, number]
}) {
  const bins = useMemo(() => {
    const count = Math.ceil((max - min) / binSize)
    const arr = Array.from({ length: count }, (_, i) => ({
      lo: min + i * binSize,
      hi: min + (i + 1) * binSize,
      n: 0,
    }))
    for (const v of values) {
      if (v < min || v > max) continue
      const idx = Math.min(arr.length - 1, Math.floor((v - min) / binSize))
      arr[idx].n++
    }
    return arr
  }, [values, binSize, min, max])

  const peak = Math.max(1, ...bins.map((b) => b.n))

  return (
    <div className="chart-card">
      <div className="chart-head">
        <span className="chart-emoji">📈</span>
        <h3 className="chart-title">การแจกแจงคะแนนต่ำสุด</h3>
        <span className="chart-hint">คลิกช่วงเพื่อกรอง</span>
      </div>
      <div className="histo">
        {bins.map((b, i) => {
          const h = (b.n / peak) * 100
          const isPick =
            picked && picked[0] === b.lo && picked[1] === b.hi
          return (
            <div
              key={i}
              className={`histo-col ${isPick ? 'histo-on' : ''}`}
              onClick={() => onPick?.([b.lo, b.hi])}
              title={`${b.lo}-${b.hi}: ${fmtInt(b.n)} สาขา`}
              style={{ ['--i' as string]: i } as React.CSSProperties}
            >
              <div className="histo-bar" style={{ height: `${h}%` }}>
                <span className="histo-tip">{fmtInt(b.n)}</span>
              </div>
              <div className="histo-lbl">{b.lo}</div>
            </div>
          )
        })}
      </div>
      <div className="histo-axis">คะแนน (min) →</div>
    </div>
  )
}

// ---------- Leaderboard list ----------
function Leaderboard({
  title,
  emoji,
  rows,
  onClick,
}: {
  title: string
  emoji: string
  rows: { rank: number; label: string; sub?: string; value: string; tag?: string }[]
  onClick?: (label: string) => void
}) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <span className="chart-emoji">{emoji}</span>
        <h3 className="chart-title">{title}</h3>
      </div>
      <div className="lb">
        {rows.map((r) => (
          <div
            key={r.rank + r.label}
            className={`lb-row ${onClick ? 'lb-click' : ''}`}
            onClick={() => onClick?.(r.label)}
          >
            <div className={`lb-rank rank-${r.rank}`}>
              {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
            </div>
            <div className="lb-mid">
              <div className="lb-lbl" title={r.label}>{r.label}</div>
              {r.sub && <div className="lb-sub" title={r.sub}>{r.sub}</div>}
            </div>
            <div className="lb-val">
              {r.value}
              {r.tag && <span className="lb-tag">{r.tag}</span>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="chart-empty">ไม่มีข้อมูล</div>}
      </div>
    </div>
  )
}

// ---------- main ----------
export default function App() {
  const [data, setData] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<View>('insights')
  const [search, setSearch] = useState('')
  const [unis, setUnis] = useState<Set<string>>(new Set())
  const [faculties, setFaculties] = useState<Set<string>>(new Set())
  const [campuses, setCampuses] = useState<Set<string>>(new Set())
  const [minOnly, setMinOnly] = useState(true)
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100])
  const [sortKey, setSortKey] = useState<SortKey>('min_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)
  const [chairFocus, setChairFocus] = useState<string | null>(null)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'tcas_data.json')
      .then((r) => {
        if (!r.ok) throw new Error('โหลดข้อมูลไม่ได้')
        return r.json()
      })
      .then((j: Row[]) => {
        setData(j)
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  const allUnis = useMemo(
    () => (data ? Array.from(new Set(data.map((d) => d.university))).sort() : []),
    [data]
  )
  const allCampuses = useMemo(
    () => (data ? Array.from(new Set(data.map((d) => d.campus))).sort() : []),
    [data]
  )
  const allFaculties = useMemo(() => {
    if (!data) return []
    const src = unis.size ? data.filter((d) => unis.has(d.university)) : data
    return Array.from(new Set(src.map((d) => d.faculty))).sort()
  }, [data, unis])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    let out = data
    if (unis.size) out = out.filter((d) => unis.has(d.university))
    if (faculties.size) out = out.filter((d) => faculties.has(d.faculty))
    if (campuses.size) out = out.filter((d) => campuses.has(d.campus))
    if (minOnly) out = out.filter((d) => d.min_score > 0)
    out = out.filter(
      (d) => d.min_score >= scoreRange[0] && d.min_score <= scoreRange[1]
    )
    if (q) {
      out = out.filter(
        (d) =>
          d.university.toLowerCase().includes(q) ||
          d.faculty.toLowerCase().includes(q) ||
          d.program.toLowerCase().includes(q) ||
          d.major.toLowerCase().includes(q) ||
          d.detail.toLowerCase().includes(q) ||
          d.campus.toLowerCase().includes(q)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (sortKey === 'competition') {
        av = a.seats > 0 ? a.applied / a.seats : 0
        bv = b.seats > 0 ? b.applied / b.seats : 0
      } else {
        av = a[sortKey] as number | string
        bv = b[sortKey] as number | string
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'th') * dir
      }
      return ((av as number) - (bv as number)) * dir
    })
    return out
  }, [data, search, unis, faculties, campuses, minOnly, scoreRange, sortKey, sortDir])

  useEffect(() => {
    setPage(0)
  }, [search, unis, faculties, campuses, minOnly, scoreRange, sortKey, sortDir])

  // ---------- aggregates for insights ----------
  const agg = useMemo(() => {
    const totals = filtered.reduce(
      (acc, d) => {
        acc.seats += d.seats
        acc.applied += d.applied
        acc.passed += d.passed
        return acc
      },
      { seats: 0, applied: 0, passed: 0 }
    )
    const programs = filtered.length
    const empty = filtered.filter((d) => d.passed === 0).length
    const fullSeats = filtered.filter((d) => d.seats > 0 && d.passed >= d.seats).length
    return { ...totals, programs, empty, fullSeats }
  }, [filtered])

  const topUnis = useMemo(() => {
    const m = new Map<string, { applied: number; passed: number; seats: number }>()
    for (const d of filtered) {
      const cur = m.get(d.university) || { applied: 0, passed: 0, seats: 0 }
      cur.applied += d.applied
      cur.passed += d.passed
      cur.seats += d.seats
      m.set(d.university, cur)
    }
    return [...m.entries()]
      .map(([k, v]) => ({ label: k, value: v.applied, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  }, [filtered])

  const topFaculties = useMemo(() => {
    const m = new Map<string, { applied: number; seats: number }>()
    for (const d of filtered) {
      const cur = m.get(d.faculty) || { applied: 0, seats: 0 }
      cur.applied += d.applied
      cur.seats += d.seats
      m.set(d.faculty, cur)
    }
    return [...m.entries()]
      .map(([k, v]) => ({ label: k, value: v.applied }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filtered])

  const hardestPrograms = useMemo(() => {
    return [...filtered]
      .filter((d) => d.min_score > 0)
      .sort((a, b) => b.min_score - a.min_score)
      .slice(0, 10)
      .map((d, i) => ({
        rank: i + 1,
        label: d.program,
        sub: `${d.university} · ${d.faculty}`,
        value: fmtScore(d.min_score),
        tag: 'min',
      }))
  }, [filtered])

  const mostCompetitive = useMemo(() => {
    return [...filtered]
      .filter((d) => d.seats > 0 && d.applied > 0)
      .map((d) => ({ ...d, comp: d.applied / d.seats }))
      .sort((a, b) => b.comp - a.comp)
      .slice(0, 10)
      .map((d, i) => ({
        rank: i + 1,
        label: d.program,
        sub: `${d.university} · ${d.faculty} · ${fmtInt(d.applied)} สมัคร / ${fmtInt(d.seats)} ที่`,
        value: d.comp.toFixed(1) + 'x',
      }))
  }, [filtered])

  const chairTarget = useMemo(() => {
    if (!filtered.length) return null
    // pick: focused uni, else first selected uni, else top by applied
    const pickName =
      chairFocus ||
      (unis.size === 1 ? [...unis][0] : null) ||
      (topUnis[0]?.label ?? null)
    if (!pickName) return null
    const rows = filtered.filter((d) => d.university === pickName)
    if (!rows.length) return null
    const sum = rows.reduce(
      (a, d) => {
        a.seats += d.seats
        a.applied += d.applied
        a.passed += d.passed
        return a
      },
      { seats: 0, applied: 0, passed: 0 }
    )
    return { name: pickName, ...sum }
  }, [filtered, chairFocus, unis, topUnis])

  const histValues = useMemo(
    () => filtered.filter((d) => d.min_score > 0).map((d) => d.min_score),
    [filtered]
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'university' || k === 'faculty' ? 'asc' : 'desc')
    }
  }
  function arrow(k: SortKey) {
    if (sortKey !== k) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }
  function toggleUniFilter(name: string) {
    const next = new Set(unis)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setUnis(next)
    setChairFocus(name)
  }
  function toggleFacFilter(name: string) {
    const next = new Set(faculties)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setFaculties(next)
  }
  function resetAll() {
    setSearch('')
    setUnis(new Set())
    setFaculties(new Set())
    setCampuses(new Set())
    setScoreRange([0, 100])
    setMinOnly(true)
    setSortKey('min_score')
    setSortDir('desc')
    setChairFocus(null)
  }

  const acceptRate = pct(agg.passed, agg.applied)
  const seatFill = pct(agg.passed, agg.seats)

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-top">
          <div className="hdr-titles">
            <h1>
              <span className="logo-dot" />
              TCAS 69 รอบ 3 · แดชบอร์ดสนุก ๆ
            </h1>
            <p className="sub">
              ข้อมูล ณ 20 พ.ค. 2569 · {data ? fmtInt(data.length) : '-'} หลักสูตร ·
              กำลังดู {fmtInt(filtered.length)} รายการ
            </p>
          </div>
          <div className="view-toggle">
            <button
              className={view === 'insights' ? 'on' : ''}
              onClick={() => setView('insights')}
            >
              ✨ Insights
            </button>
            <button
              className={view === 'table' ? 'on' : ''}
              onClick={() => setView('table')}
            >
              📋 ตาราง
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <div className="loading">
          <div className="loader" />
          กำลังโหลดข้อมูลสนุก ๆ…
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <section className="filters">
            <div className="row1">
              <input
                className="search"
                placeholder="🔎 ค้นหามหาลัย / คณะ / สาขา / หลักสูตร…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="row2">
              <MultiSelect
                label="🏫 มหาวิทยาลัย"
                options={allUnis}
                selected={unis}
                onChange={(s) => {
                  setUnis(s)
                  if (s.size) {
                    const validFac = new Set(
                      data
                        .filter((d) => s.has(d.university))
                        .map((d) => d.faculty)
                    )
                    setFaculties(
                      new Set([...faculties].filter((f) => validFac.has(f)))
                    )
                  }
                }}
              />
              <MultiSelect
                label="🎓 คณะ"
                options={allFaculties}
                selected={faculties}
                onChange={setFaculties}
              />
              <MultiSelect
                label="📍 วิทยาเขต"
                options={allCampuses}
                selected={campuses}
                onChange={setCampuses}
              />
            </div>

            <div className="row3">
              <div className="range">
                <label>🎯 ช่วงคะแนน min: {scoreRange[0]} – {scoreRange[1]}</label>
                <div className="range-inputs">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={scoreRange[0]}
                    onChange={(e) =>
                      setScoreRange([
                        Math.min(Number(e.target.value), scoreRange[1]),
                        scoreRange[1],
                      ])
                    }
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={scoreRange[1]}
                    onChange={(e) =>
                      setScoreRange([
                        scoreRange[0],
                        Math.max(Number(e.target.value), scoreRange[0]),
                      ])
                    }
                  />
                </div>
              </div>

              <label className="chk">
                <input
                  type="checkbox"
                  checked={minOnly}
                  onChange={(e) => setMinOnly(e.target.checked)}
                />
                ซ่อนสาขาที่ไม่มีผู้ผ่าน
              </label>

              <button type="button" className="reset" onClick={resetAll}>
                ♻️ รีเซ็ต
              </button>
            </div>

            {(unis.size > 0 || faculties.size > 0 || campuses.size > 0) && (
              <div className="chips">
                {[...unis].map((u) => (
                  <span key={'u' + u} className="chip chip-uni" onClick={() => {
                    const n = new Set(unis); n.delete(u); setUnis(n)
                  }}>🏫 {u} ✕</span>
                ))}
                {[...faculties].map((f) => (
                  <span key={'f' + f} className="chip chip-fac" onClick={() => {
                    const n = new Set(faculties); n.delete(f); setFaculties(n)
                  }}>🎓 {f} ✕</span>
                ))}
                {[...campuses].map((c) => (
                  <span key={'c' + c} className="chip chip-cmp" onClick={() => {
                    const n = new Set(campuses); n.delete(c); setCampuses(n)
                  }}>📍 {c} ✕</span>
                ))}
              </div>
            )}
          </section>

          {view === 'insights' && (
            <>
              <section className="kpis">
                <KpiCard
                  emoji="🪑"
                  label="ที่นั่งทั้งหมด"
                  value={agg.seats}
                  sub={`${agg.programs.toLocaleString()} หลักสูตร`}
                  accent="a1"
                />
                <KpiCard
                  emoji="✍️"
                  label="ผู้สมัครทั้งหมด"
                  value={agg.applied}
                  sub={`เฉลี่ย ${
                    agg.seats > 0 ? (agg.applied / agg.seats).toFixed(1) : '-'
                  }x ต่อที่`}
                  accent="a2"
                />
                <KpiCard
                  emoji="🎉"
                  label="ผ่านการคัดเลือก"
                  value={agg.passed}
                  sub={`อัตรารับ ${acceptRate}%`}
                  accent="a3"
                />
                <KpiCard
                  emoji="📊"
                  label="ที่นั่งเต็ม"
                  value={`${seatFill}%`}
                  sub={`${agg.fullSeats.toLocaleString()} สาขาเต็ม / ${agg.empty.toLocaleString()} ว่าง`}
                  accent="a4"
                />
                <KpiCard
                  emoji="🔥"
                  label="หลักสูตรเดือดสุด"
                  value={
                    mostCompetitive[0]
                      ? mostCompetitive[0].value
                      : '-'
                  }
                  sub={mostCompetitive[0]?.label.slice(0, 30) || '-'}
                  accent="a5"
                />
              </section>

              {chairTarget && (
                <ChairsViz
                  title={`🪑 เก้าอี้รวมของ ${chairTarget.name}`}
                  seats={chairTarget.seats}
                  passed={chairTarget.passed}
                  applied={chairTarget.applied}
                />
              )}

              <div className="grid-2">
                <BarChart
                  title="Top 12 มหาวิทยาลัย ตามจำนวนสมัคร"
                  emoji="🏆"
                  items={topUnis.map((u) => ({ label: u.label, value: u.value }))}
                  onClick={toggleUniFilter}
                  highlight={unis}
                  colorStart="#6cb6ff"
                  colorEnd="#a78bfa"
                />
                <BarChart
                  title="Top 10 คณะยอดฮิต"
                  emoji="🎓"
                  items={topFaculties}
                  onClick={toggleFacFilter}
                  highlight={faculties}
                  colorStart="#ffd166"
                  colorEnd="#fb923c"
                />
              </div>

              <Histogram
                values={histValues}
                onPick={(r) => setScoreRange(r)}
                picked={scoreRange[1] - scoreRange[0] === 5 ? scoreRange : undefined}
              />

              <div className="grid-2">
                <Leaderboard
                  title="คะแนน min สูงสุด (เข้ายากสุด)"
                  emoji="🧠"
                  rows={hardestPrograms}
                  onClick={(lbl) => {
                    setSearch(lbl)
                    setView('table')
                  }}
                />
                <Leaderboard
                  title="แข่งขันดุเดือดสุด (สมัคร/รับ)"
                  emoji="🔥"
                  rows={mostCompetitive}
                  onClick={(lbl) => {
                    setSearch(lbl)
                    setView('table')
                  }}
                />
              </div>

              <div className="fun-banner">
                💡 เคล็ดลับ: คลิกบนแถบกราฟเพื่อกรอง · คลิกแถวอันดับเพื่อเปิดในตาราง · ลากแถบช่วงคะแนนเพื่อโฟกัส
              </div>
            </>
          )}

          {view === 'table' && (
            <>
              <div className="sort">
                <label>⬆️⬇️ เรียงตาม:</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="min_score">คะแนนต่ำสุด</option>
                  <option value="max_score">คะแนนสูงสุด</option>
                  <option value="applied">จำนวนสมัคร</option>
                  <option value="passed">จำนวนผ่าน</option>
                  <option value="seats">จำนวนรับ</option>
                  <option value="competition">อัตราแข่งขัน (สมัคร/รับ)</option>
                  <option value="university">มหาวิทยาลัย</option>
                  <option value="faculty">คณะ</option>
                </select>
                <button
                  type="button"
                  className="dir"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  {sortDir === 'asc' ? '↑ น้อย→มาก' : '↓ มาก→น้อย'}
                </button>
              </div>

              <section className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>มหาวิทยาลัย</th>
                      <th>คณะ / หลักสูตร / สาขา</th>
                      <th className="num sortable" onClick={() => toggleSort('seats')}>
                        🪑 รับ{arrow('seats')}
                      </th>
                      <th className="num sortable" onClick={() => toggleSort('applied')}>
                        ✍️ สมัคร{arrow('applied')}
                      </th>
                      <th className="num sortable" onClick={() => toggleSort('passed')}>
                        🎉 ผ่าน{arrow('passed')}
                      </th>
                      <th
                        className="num sortable"
                        onClick={() => toggleSort('competition')}
                      >
                        🔥 แข่ง{arrow('competition')}
                      </th>
                      <th className="num sortable" onClick={() => toggleSort('max_score')}>
                        Max{arrow('max_score')}
                      </th>
                      <th className="num sortable hi" onClick={() => toggleSort('min_score')}>
                        Min{arrow('min_score')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const comp = r.seats > 0 ? r.applied / r.seats : 0
                      const compStr = r.seats > 0 ? comp.toFixed(1) + 'x' : '-'
                      const hot = comp >= 10
                      const fillStr = r.seats > 0 ? pct(r.passed, r.seats) + '%' : '-'
                      return (
                        <tr key={page * PAGE_SIZE + i}>
                          <td>
                            <div className="uni">{r.university}</div>
                            <div className="camp">{r.campus}</div>
                          </td>
                          <td>
                            <div className="fac">{r.faculty}</div>
                            <div className="prog">{r.program}</div>
                            {(r.detail || r.major) && (
                              <div className="detail">
                                {r.detail} {r.major && `· ${r.major}`}
                              </div>
                            )}
                          </td>
                          <td className="num">
                            {r.seats || '-'}
                            {r.seats > 0 && (
                              <div className="micro">{fillStr}</div>
                            )}
                          </td>
                          <td className="num">{r.applied || '-'}</td>
                          <td className="num">{r.passed || '-'}</td>
                          <td className="num">
                            {hot && <span className="hot-badge">🔥</span>}
                            {compStr}
                          </td>
                          <td className="num">{fmtScore(r.max_score)}</td>
                          <td className="num hi">{fmtScore(r.min_score)}</td>
                        </tr>
                      )
                    })}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="empty">
                          ไม่มีรายการตรงกับตัวกรอง
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <nav className="pager">
                <button disabled={page === 0} onClick={() => setPage(0)}>
                  « แรก
                </button>
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  ‹ ก่อน
                </button>
                <span>
                  หน้า {page + 1} / {pageCount}
                </span>
                <button
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ถัด ›
                </button>
                <button
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage(pageCount - 1)}
                >
                  สุดท้าย »
                </button>
              </nav>
            </>
          )}

          <footer className="ftr">
            ที่มา: PDF สถิติ TCAS69 รอบ 3 · เครื่องมือสำหรับดูข้อมูลเท่านั้น
            ตรวจสอบทางการที่เว็บ ทปอ.
            <div className="ftr-credit">เว็บไซต์โดยทีมผู้สร้าง <a href="https://siamstatement.com" target="_blank" rel="noopener">SiamStatement</a></div>
          </footer>
        </>
      )}
    </div>
  )
}
