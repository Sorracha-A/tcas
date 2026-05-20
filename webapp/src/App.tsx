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

const PAGE_SIZE = 50

// Tiny searchable multi-select component
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

function fmtScore(n: number) {
  if (!n) return '-'
  return n.toFixed(2)
}

export default function App() {
  const [data, setData] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [unis, setUnis] = useState<Set<string>>(new Set())
  const [faculties, setFaculties] = useState<Set<string>>(new Set())
  const [campuses, setCampuses] = useState<Set<string>>(new Set())
  const [minOnly, setMinOnly] = useState(true) // hide rows with min_score = 0
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100])
  const [sortKey, setSortKey] = useState<SortKey>('min_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

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
  // Faculty list depends on selected unis (smart cascading)
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

  return (
    <div className="app">
      <header className="hdr">
        <h1>
          TCAS 69 รอบ 3 — คะแนน Min/Max
        </h1>
        <p className="sub">
          ข้อมูล ณ 20 พ.ค. 2569 · {data ? data.length.toLocaleString() : '-'} หลักสูตร ·
          แสดง {filtered.length.toLocaleString()} รายการ
        </p>
      </header>

      {loading && <div className="loading">กำลังโหลดข้อมูล…</div>}
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
                label="มหาวิทยาลัย"
                options={allUnis}
                selected={unis}
                onChange={(s) => {
                  setUnis(s)
                  // prune faculties not in new uni scope
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
                label="คณะ"
                options={allFaculties}
                selected={faculties}
                onChange={setFaculties}
              />
              <MultiSelect
                label="วิทยาเขต"
                options={allCampuses}
                selected={campuses}
                onChange={setCampuses}
              />
            </div>

            <div className="row3">
              <div className="range">
                <label>คะแนนต่ำสุด: {scoreRange[0]} – {scoreRange[1]}</label>
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
                ซ่อนสาขาที่ไม่มีผู้ผ่าน (คะแนน = 0)
              </label>

              <div className="sort">
                <label>เรียงตาม:</label>
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

              <button
                type="button"
                className="reset"
                onClick={() => {
                  setSearch('')
                  setUnis(new Set())
                  setFaculties(new Set())
                  setCampuses(new Set())
                  setScoreRange([0, 100])
                  setMinOnly(true)
                  setSortKey('min_score')
                  setSortDir('desc')
                }}
              >
                รีเซ็ตทั้งหมด
              </button>
            </div>
          </section>

          <section className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>มหาวิทยาลัย</th>
                  <th>คณะ / หลักสูตร / สาขา</th>
                  <th className="num sortable" onClick={() => toggleSort('seats')}>
                    รับ{arrow('seats')}
                  </th>
                  <th className="num sortable" onClick={() => toggleSort('applied')}>
                    สมัคร{arrow('applied')}
                  </th>
                  <th className="num sortable" onClick={() => toggleSort('passed')}>
                    ผ่าน{arrow('passed')}
                  </th>
                  <th
                    className="num sortable"
                    onClick={() => toggleSort('competition')}
                  >
                    แข่งขัน{arrow('competition')}
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
                  const comp = r.seats > 0 ? (r.applied / r.seats).toFixed(1) : '-'
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
                      <td className="num">{r.seats || '-'}</td>
                      <td className="num">{r.applied || '-'}</td>
                      <td className="num">{r.passed || '-'}</td>
                      <td className="num">{comp !== '-' ? `${comp}x` : '-'}</td>
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

          <footer className="ftr">
            ที่มา: PDF สถิติ TCAS69 รอบ 3 · เครื่องมือสำหรับดูข้อมูลเท่านั้น
            ตรวจสอบทางการที่เว็บ ทปอ.
          </footer>
        </>
      )}
    </div>
  )
}
