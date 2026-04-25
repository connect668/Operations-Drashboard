import Head from 'next/head'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const P = {
  pageBg:    "#F6F4FA",
  surface:   "#FFFFFF",
  border:    "#E5E0F0",
  borderMid: "#CFC8E8",
  text:      "#1C1830",
  soft:      "#5C5278",
  muted:     "#9589AE",
  purple:    "#6B5EA8",
  purpleMid: "#7B6BBB",
  red:       "#8A2E2E",
  redDim:    "rgba(138,46,46,0.08)",
}
const BTN_GRAD = "linear-gradient(135deg, #7B6BBB 0%, #5A4D94 100%)"
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'
const MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace'

function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="18" rx="2" fill={P.purple} opacity="0.15"/>
      <rect x="3" y="2" width="14" height="18" rx="2" stroke={P.purple} strokeWidth="1.6"/>
      <path d="M7 7h6M7 11h6M7 15h4" stroke={P.purple} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="18" cy="17" r="4" fill="rgba(107,94,168,0.10)" stroke={P.purple} strokeWidth="1.4"/>
      <path d="M18 15v4M16 17h4" stroke={P.purple} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setLoading(false)
    })
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) { setError(err.message); setSubmitting(false); return }
    router.push('/dashboard')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:P.pageBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:`2px solid ${P.border}`, borderTopColor:P.purple, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={s.page}>
      <Head><title>Playbook by OSS — Sign In</title></Head>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>

      <div style={s.wrap}>
        <div style={s.card}>
          {/* Brand */}
          <div style={s.brandRow}>
            <Logo size={28}/>
            <div style={s.brandText}>
              <span style={s.brandName}>Playbook</span>
              <span style={s.brandBy}>by OSS</span>
            </div>
          </div>

          <h1 style={s.heading}>Welcome back</h1>
          <p style={s.subheading}>Sign in to access your team's operational playbook</p>

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@company.com" style={s.input} autoComplete="email"
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" style={s.input} autoComplete="current-password"
              />
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            <button type="submit" disabled={submitting} style={{ ...s.submitBtn, ...(submitting ? { opacity: 0.65 } : {}) }}>
              {submitting ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={s.footer}>
            <span style={{ color: P.muted, fontSize: 13 }}>No account? </span>
            <Link href="/signup" style={s.footerLink}>Create one</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #F6F4FA; -webkit-font-smoothing: antialiased; }
  @keyframes spin { to { transform: rotate(360deg); } }
  input:focus {
    border-color: rgba(107,94,168,0.55) !important;
    box-shadow: 0 0 0 3px rgba(107,94,168,0.08) !important;
    outline: none !important;
  }
`

const s = {
  page:      { minHeight:'100vh', background:P.pageBg, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', fontFamily:SANS },
  wrap:      { width:'100%', maxWidth:420 },
  card:      { background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:'36px 32px', boxShadow:'0 4px 24px rgba(107,94,168,0.08)' },
  brandRow:  { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
  brandText: { display:'flex', flexDirection:'column', gap:1 },
  brandName: { fontSize:15, fontWeight:700, color:P.text, letterSpacing:'-0.01em', fontFamily:SANS, lineHeight:1 },
  brandBy:   { fontSize:10, fontWeight:600, color:P.muted, letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:MONO, lineHeight:1 },
  heading:   { fontSize:24, fontWeight:700, color:P.text, margin:'0 0 6px', letterSpacing:'-0.02em' },
  subheading:{ fontSize:14, color:P.soft, margin:'0 0 28px', lineHeight:1.5 },
  form:      { display:'flex', flexDirection:'column', gap:18 },
  field:     { display:'flex', flexDirection:'column', gap:6 },
  label:     { fontSize:11, fontWeight:600, color:P.soft, textTransform:'uppercase', letterSpacing:'0.08em' },
  input:     { width:'100%', height:48, background:P.surface, border:`1.5px solid ${P.border}`, borderRadius:8, color:P.text, padding:'0 14px', fontSize:15, fontFamily:SANS, transition:'border-color 0.15s,box-shadow 0.15s' },
  errorBox:  { background:P.redDim, border:`1px solid rgba(138,46,46,0.20)`, borderRadius:8, padding:'11px 14px', fontSize:13, color:P.red, lineHeight:1.5 },
  submitBtn: { width:'100%', height:48, background:BTN_GRAD, border:'none', borderRadius:8, color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', letterSpacing:'-0.01em', boxShadow:'0 2px 12px rgba(107,94,168,0.25)', transition:'opacity 0.15s', marginTop:4 },
  footer:    { marginTop:24, textAlign:'center' },
  footerLink:{ fontSize:13, color:P.purple, textDecoration:'none', fontWeight:600 },
}
