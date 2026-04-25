import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const P = {
  pageBg:    "#F6F4FA",
  surface:   "#FFFFFF",
  surfaceSub:"#FAF9FD",
  border:    "#E5E0F0",
  borderMid: "#CFC8E8",
  text:      "#1C1830",
  soft:      "#5C5278",
  muted:     "#9589AE",
  purple:    "#6B5EA8",
  purpleMid: "#7B6BBB",
  purpleDim: "rgba(107,94,168,0.10)",
  green:     "#2E7D52",
  greenDim:  "rgba(46,125,82,0.09)",
  red:       "#8A2E2E",
  redDim:    "rgba(138,46,46,0.08)",
}
const BTN_GRAD = "linear-gradient(135deg, #7B6BBB 0%, #5A4D94 100%)"
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'
const MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function safeUuid(v) { return UUID_RE.test(v) ? v : null }

function Logo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="18" rx="2" fill={P.purple} opacity="0.15"/>
      <rect x="3" y="2" width="14" height="18" rx="2" stroke={P.purple} strokeWidth="1.6"/>
      <path d="M7 7h6M7 11h6M7 15h4" stroke={P.purple} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="18" cy="17" r="4" fill={P.purpleDim} stroke={P.purple} strokeWidth="1.4"/>
      <path d="M18 15v4M16 17h4" stroke={P.purple} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export default function SupportPage() {
  const router = useRouter()

  const [user,        setUser]        = useState(null)
  const [profile,     setProfile]     = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [name,        setName]        = useState('')
  const [facility,    setFacility]    = useState('')
  const [issueTitle,  setIssueTitle]  = useState('')
  const [description, setDescription] = useState('')

  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, facility_number, company, company_id, role')
        .eq('id', authUser.id)
        .maybeSingle()

      if (prof) {
        setProfile(prof)
        setName(prof.full_name || '')
        setFacility(prof.facility_number ? String(prof.facility_number) : '')
      }

      setAuthLoading(false)
    }
    init()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim())        { setError('Please enter your name.');       return }
    if (!issueTitle.trim())  { setError('Please enter an issue title.');  return }
    if (!description.trim()) { setError('Please describe the issue.');    return }

    setSubmitting(true)
    setError('')

    const { error: dbError } = await supabase.from('support_requests').insert([{
      name:        name.trim(),
      facility:    facility.trim() || null,
      issue_title: issueTitle.trim(),
      description: description.trim(),
      user_id:     user?.id || null,
      company:     profile?.company    || null,
      company_id:  safeUuid(profile?.company_id),
      user_role:   profile?.role       || null,
    }])

    if (dbError) {
      setError(dbError.message || 'Submission failed. Please try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (authLoading) return (
    <div style={{ minHeight:'100vh', background:P.pageBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:`2px solid ${P.border}`, borderTopColor:P.purple, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={s.page}>
      <Head><title>Support — Playbook by OSS</title></Head>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>

      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.brand}>
            <Logo size={20}/>
            <div style={s.brandText}>
              <span style={s.brandName}>Playbook</span>
              <span style={s.brandBy}>by OSS</span>
            </div>
          </div>
          <button style={s.backBtn} onClick={() => router.back()}>← Back</button>
        </div>
      </header>

      <main style={s.main}>

        {/* ── FORM CARD ── */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>Submit a Support Request</div>
          </div>
          <div style={s.divider}/>

          {submitted ? (
            <div style={s.successBox}>
              <div style={s.successTitle}>Request submitted ✓</div>
              <div style={s.successText}>
                We've received your request and will follow up as soon as possible.
              </div>
              <button style={s.primaryBtn} onClick={() => router.back()}>
                ← Back to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.fieldRow}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Your Name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    required placeholder="Jane Smith" style={s.input}
                  />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>
                    Facility <span style={s.optionalTag}>(optional)</span>
                  </label>
                  <input
                    type="text" value={facility} onChange={e => setFacility(e.target.value)}
                    placeholder="e.g. 4821" style={s.input}
                  />
                </div>
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>Issue Title</label>
                <input
                  type="text" value={issueTitle} onChange={e => setIssueTitle(e.target.value)}
                  required placeholder="Brief summary of the issue" style={s.input}
                />
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>What's happening?</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  required
                  placeholder="Describe the issue in as much detail as possible — what you were doing, what went wrong, and any error messages you saw."
                  style={s.textarea}
                />
              </div>

              {error && <div style={s.errorBox}>{error}</div>}

              <button
                type="submit" disabled={submitting}
                style={{ ...s.submitBtn, ...(submitting ? { opacity: 0.65 } : {}) }}
              >
                {submitting ? 'Submitting…' : 'Submit Request →'}
              </button>
            </form>
          )}
        </div>

        {/* ── QUICK SUPPORT CARD ── */}
        <div style={s.quickCard}>
          <div style={s.quickLabel}>Quick Support</div>
          <div style={s.quickText}>
            For faster help, call us during business hours:
          </div>
          <div style={s.quickPhone}>205-269-1916</div>
        </div>

      </main>
    </div>
  )
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #F6F4FA; -webkit-font-smoothing: antialiased; }
  @keyframes spin { to { transform: rotate(360deg); } }
  input:focus, textarea:focus {
    border-color: rgba(107,94,168,0.55) !important;
    box-shadow: 0 0 0 3px rgba(107,94,168,0.08) !important;
    outline: none !important;
  }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #F6F4FA; }
  ::-webkit-scrollbar-thumb { background: #CFC8E8; border-radius: 3px; }
`

const s = {
  page:    { minHeight:'100vh', background:P.pageBg, color:P.text, fontFamily:SANS },

  // ── Header
  header:      { background:P.surface, borderBottom:`1px solid ${P.border}`, position:'sticky', top:0, zIndex:100, height:60, boxShadow:'0 1px 8px rgba(107,94,168,0.06)' },
  headerInner: { maxWidth:760, margin:'0 auto', padding:'0 24px', height:'100%', display:'flex', alignItems:'center', justifyContent:'space-between' },
  brand:       { display:'flex', alignItems:'center', gap:10 },
  brandText:   { display:'flex', flexDirection:'column', gap:1 },
  brandName:   { fontSize:14, fontWeight:700, color:P.text, letterSpacing:'-0.01em', lineHeight:1 },
  brandBy:     { fontSize:9, fontWeight:600, color:P.muted, letterSpacing:'0.09em', textTransform:'uppercase', fontFamily:MONO, lineHeight:1 },
  backBtn:     { background:'transparent', border:`1.5px solid ${P.border}`, borderRadius:7, color:P.soft, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:SANS, transition:'border-color 0.15s,color 0.15s' },

  // ── Layout
  main:  { maxWidth:760, margin:'0 auto', padding:'28px 20px 60px', display:'flex', flexDirection:'column', gap:16 },

  // ── Cards
  card:      { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:'24px 28px', boxShadow:'0 2px 12px rgba(107,94,168,0.05)' },
  cardHeader:{ marginBottom:16 },
  cardTitle: { fontSize:12, fontWeight:700, color:P.text, textTransform:'uppercase', letterSpacing:'0.09em' },
  divider:   { height:1, background:P.border, margin:'0 0 22px' },

  quickCard:  { background:P.surface, border:`1px solid ${P.border}`, borderLeft:`3px solid ${P.purple}`, borderRadius:10, padding:'20px 28px', boxShadow:'0 2px 12px rgba(107,94,168,0.05)' },
  quickLabel: { fontSize:11, fontWeight:700, color:P.purple, textTransform:'uppercase', letterSpacing:'0.10em', marginBottom:8 },
  quickText:  { fontSize:13, color:P.soft, lineHeight:1.6, marginBottom:10 },
  quickPhone: { fontSize:22, fontWeight:700, color:P.text, fontFamily:MONO, letterSpacing:'0.04em' },

  // ── Form
  form:        { display:'flex', flexDirection:'column', gap:18 },
  fieldRow:    { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16 },
  fieldGroup:  { display:'flex', flexDirection:'column', gap:6 },
  label:       { fontSize:11, fontWeight:600, color:P.soft, textTransform:'uppercase', letterSpacing:'0.08em' },
  optionalTag: { color:P.muted, fontWeight:400, textTransform:'none', letterSpacing:0 },
  input:       { padding:'11px 13px', borderRadius:8, border:`1.5px solid ${P.border}`, background:P.surfaceSub, color:P.text, fontSize:14, width:'100%', fontFamily:SANS, transition:'border-color 0.15s' },
  textarea:    { width:'100%', minHeight:140, borderRadius:8, border:`1.5px solid ${P.border}`, background:P.surfaceSub, color:P.text, padding:'12px 14px', fontSize:14, lineHeight:1.7, resize:'vertical', fontFamily:SANS },
  errorBox:    { padding:'10px 14px', borderRadius:8, background:P.redDim, border:`1px solid rgba(138,46,46,0.20)`, color:P.red, fontSize:13, lineHeight:1.5 },
  submitBtn:   { width:'100%', height:46, background:BTN_GRAD, border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 2px 10px rgba(107,94,168,0.22)', transition:'opacity 0.15s', letterSpacing:'-0.01em', fontFamily:SANS },

  // ── Success
  successBox:   { padding:'8px 0' },
  successTitle: { fontSize:16, fontWeight:700, color:P.green, marginBottom:8 },
  successText:  { fontSize:13, color:P.soft, lineHeight:1.6, marginBottom:16 },
  primaryBtn:   { background:'transparent', border:`1.5px solid ${P.purple}`, borderRadius:8, color:P.purple, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:SANS },
}
