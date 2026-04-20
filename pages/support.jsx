import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const PALETTE = {
  bg:        "#03070f",
  panel:     "#070f1c",
  panelAlt:  "#0a1626",
  border:    "#0e1e30",
  text:      "#ccd9ea",
  textSoft:  "#4d6a84",
  textMuted: "#283d52",
  blue:      "#1a80ff",
  blueSoft:  "rgba(26,128,255,0.10)",
  green:     "#00c87a",
  red:       "#e83248",
  amber:     "#e8980a",
}

const MONO = '"JetBrains Mono","Fira Code","SF Mono",ui-monospace,monospace'
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function safeUuid(v) { return UUID_RE.test(v) ? v : null }

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

  // ── Auth + profile prefill
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
    if (!name.trim())        { setError('Please enter your name.');          return }
    if (!issueTitle.trim())  { setError('Please enter an issue title.');     return }
    if (!description.trim()) { setError('Please describe the issue.');       return }

    setSubmitting(true)
    setError('')

    const { error: dbError } = await supabase.from('support_requests').insert([{
      name:          name.trim(),
      facility:      facility.trim() || null,
      issue_title:   issueTitle.trim(),
      description:   description.trim(),
      user_id:       user?.id || null,
      company:       profile?.company    || null,
      company_id:    safeUuid(profile?.company_id),
      user_role:     profile?.role       || null,
    }])

    if (dbError) {
      setError(dbError.message || 'Submission failed. Please try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: PALETTE.bg }}>
        <p style={{ color: PALETTE.textSoft, fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', fontFamily: MONO }}>
          Loading…
        </p>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        body { margin: 0; }
        input:focus, textarea:focus {
          border-color: rgba(26,128,255,0.50) !important;
          box-shadow: 0 0 0 3px rgba(26,128,255,0.08) !important;
          outline: none !important;
        }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:#03070f; }
        ::-webkit-scrollbar-thumb { background:#162840; border-radius:3px; }
      `}} />

      {/* ── TOP NAV ── */}
      <header style={s.topNav}>
        <div style={s.topNavBrand}>
          <div style={s.topNavName}>Support</div>
          <div style={s.topNavMeta}>Operations Dashboard</div>
        </div>
        <div style={s.topNavRight}>
          <button style={s.backBtn} onClick={() => router.back()}>← Back</button>
        </div>
      </header>

      <main style={s.main}>

        {/* ── ISSUE FORM ── */}
        <div style={s.panelCard}>
          <div style={s.sectionTopRow}>
            <div style={s.sectionHeading}>Submit a Support Request</div>
          </div>
          <div style={s.sectionDivider} />

          {submitted ? (
            <div style={s.successBox}>
              <div style={s.successTitle}>Request submitted</div>
              <div style={s.successText}>
                We've received your request and will follow up as soon as possible.
              </div>
              <button style={{ ...s.primaryButton, marginTop: '16px' }} onClick={() => router.back()}>
                ← Back to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.fieldRow}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                    style={s.input}
                  />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Facility <span style={s.optionalTag}>(optional)</span></label>
                  <input
                    type="text"
                    value={facility}
                    onChange={(e) => setFacility(e.target.value)}
                    placeholder="e.g. 4821"
                    style={s.input}
                  />
                </div>
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>Issue Title</label>
                <input
                  type="text"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  required
                  placeholder="Brief summary of the issue"
                  style={s.input}
                />
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>What's happening?</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Describe the issue in as much detail as possible — what you were doing, what went wrong, and any error messages you saw."
                  style={s.textarea}
                />
              </div>

              {error && <p style={s.errorBox}>{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                style={{ ...s.primaryButton, ...(submitting ? s.buttonDisabled : {}) }}
              >
                {submitting ? 'Submitting…' : 'Submit Request →'}
              </button>
            </form>
          )}
        </div>

        {/* ── QUICK SUPPORT ── */}
        <div style={s.quickSupportCard}>
          <div style={s.quickSupportLabel}>Quick Support</div>
          <div style={s.quickSupportText}>
            For quicker support, call this number during business hours:
          </div>
          <div style={s.quickSupportPhone}>205-269-1916</div>
        </div>

      </main>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: PALETTE.bg,
    color: PALETTE.text,
    fontFamily: SANS,
  },

  // ── NAV
  topNav: {
    background: PALETTE.panel,
    borderBottom: `1px solid ${PALETTE.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 100,
    height: '52px', paddingLeft: '20px', paddingRight: '16px',
    boxSizing: 'border-box',
  },
  topNavBrand: { display: 'flex', flexDirection: 'column', gap: '2px' },
  topNavName:  { fontWeight: 700, color: PALETTE.text, fontSize: '13px', letterSpacing: '0.01em' },
  topNavMeta:  { color: PALETTE.textSoft, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' },
  topNavRight: { display: 'flex', alignItems: 'center' },
  backBtn: {
    border: `1px solid ${PALETTE.border}`,
    background: 'transparent',
    color: PALETTE.textSoft, borderRadius: '3px', padding: '5px 11px',
    fontSize: '10px', fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.07em', textTransform: 'uppercase',
    fontFamily: SANS,
  },

  // ── LAYOUT
  main: {
    maxWidth: '760px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '14px',
    padding: '20px 16px', boxSizing: 'border-box',
  },

  // ── CARDS
  panelCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: '4px', padding: '20px 22px',
  },
  quickSupportCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderLeft: `3px solid ${PALETTE.blue}`,
    borderRadius: '4px', padding: '20px 22px',
  },

  // ── TYPOGRAPHY
  sectionTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' },
  sectionHeading: { fontSize: '11px', fontWeight: 800, color: PALETTE.text, textTransform: 'uppercase', letterSpacing: '0.10em' },
  sectionDivider: { height: '1px', background: PALETTE.border, margin: '0 0 20px' },

  label: {
    display: 'block', marginBottom: '8px',
    fontSize: '10px', fontWeight: 700, color: PALETTE.textSoft,
    textTransform: 'uppercase', letterSpacing: '0.09em',
  },
  optionalTag: {
    color: PALETTE.textMuted, fontWeight: 400,
    textTransform: 'none', letterSpacing: 0,
  },

  // ── FORM
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column' },
  input: {
    padding: '11px 13px', borderRadius: '3px',
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text, outline: 'none',
    fontSize: '14px', boxSizing: 'border-box', width: '100%',
    fontFamily: SANS,
    transition: 'border-color 0.15s ease',
  },
  textarea: {
    width: '100%', minHeight: '130px', borderRadius: '3px',
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text, padding: '14px 16px',
    fontSize: '14px', lineHeight: 1.7,
    resize: 'vertical', outline: 'none',
    boxSizing: 'border-box', fontFamily: SANS,
  },
  errorBox: {
    margin: 0, padding: '10px 13px', borderRadius: '3px',
    background: 'rgba(232,50,72,0.10)',
    border: '1px solid rgba(232,50,72,0.28)',
    color: PALETTE.red, fontSize: '12px', lineHeight: 1.5,
  },

  // ── BUTTONS
  primaryButton: {
    border: `1px solid ${PALETTE.blue}`,
    background: 'rgba(26,128,255,0.12)',
    color: PALETTE.blue, borderRadius: '3px', padding: '10px 18px',
    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.07em', textTransform: 'uppercase',
    fontFamily: SANS,
  },
  buttonDisabled: { opacity: 0.45, cursor: 'not-allowed' },

  // ── SUCCESS STATE
  successBox: {
    padding: '12px 0',
  },
  successTitle: {
    fontSize: '16px', fontWeight: 700, color: PALETTE.green, marginBottom: '8px',
  },
  successText: {
    fontSize: '13px', color: PALETTE.textSoft, lineHeight: 1.6,
  },

  // ── QUICK SUPPORT
  quickSupportLabel: {
    fontSize: '10px', fontWeight: 800, color: PALETTE.blue,
    textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: '10px',
  },
  quickSupportText: {
    fontSize: '13px', color: PALETTE.textSoft, lineHeight: 1.6, marginBottom: '10px',
  },
  quickSupportPhone: {
    fontSize: '22px', fontWeight: 700, fontFamily: MONO,
    color: PALETTE.text, letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  },
}
