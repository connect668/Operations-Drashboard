import Head from 'next/head'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const P = {
  bg:       "#090E14",
  surface:  "#10171F",
  raise:    "#172030",
  border:   "#22303F",
  borderMid:"#2C3E52",
  text:     "#EDF1F5",
  soft:     "#95A8B8",
  muted:    "#60778A",
  blue:     "#4A82B0",
  blueDim:  "rgba(74,130,176,0.14)",
  red:      "#A85858",
  redDim:   "rgba(168,88,88,0.12)",
}
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'
const MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
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
    <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:28,height:28,border:`2px solid ${P.borderMid}`,borderTopColor:P.blue,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={s.page}>
      <Head><title>Playbook — Sign In</title></Head>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      <div style={s.gridBg} aria-hidden/>

      <div style={s.wrap}>
        <div style={s.card}>
          {/* Brand */}
          <div style={s.brandRow}>
            <span style={s.brandDot}/>
            <span style={s.brandName}>Playbook</span>
          </div>

          <h1 style={s.heading}>Sign in</h1>
          <p style={s.subheading}>Access your team's operational playbook</p>

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                required placeholder="you@company.com" style={s.input} autoComplete="email"/>
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                required placeholder="••••••••" style={s.input} autoComplete="current-password"/>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            <button type="submit" disabled={submitting} style={{...s.submitBtn,...(submitting?{opacity:0.6}:{})}}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={s.footer}>
            <span style={{color:P.soft,fontSize:14}}>No account? </span>
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
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  @keyframes spin { to { transform: rotate(360deg); } }
  input:focus {
    border-color: rgba(74,130,176,0.55) !important;
    box-shadow: 0 0 0 3px rgba(74,130,176,0.10) !important;
    outline: none !important;
  }
`

const s = {
  page:    { minHeight:'100vh', background:P.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', fontFamily:SANS, position:'relative', overflow:'hidden' },
  gridBg:  { position:'fixed', inset:0, pointerEvents:'none', backgroundImage:`linear-gradient(rgba(74,130,176,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(74,130,176,0.035) 1px,transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 },
  wrap:    { width:'100%', maxWidth:420, position:'relative', zIndex:1 },
  card:    { background:P.surface, border:`1px solid ${P.borderMid}`, borderTop:`2px solid ${P.blue}`, borderRadius:14, padding:'32px 24px', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' },
  brandRow:{ display:'flex', alignItems:'center', gap:8, marginBottom:24 },
  brandDot:{ width:10, height:10, borderRadius:'50%', background:P.blue, boxShadow:`0 0 10px ${P.blue}`, display:'inline-block' },
  brandName:{ fontSize:13, fontWeight:800, color:P.blue, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:MONO },
  heading: { fontSize:26, fontWeight:700, color:P.text, margin:'0 0 6px', letterSpacing:'-0.02em' },
  subheading:{ fontSize:14, color:P.soft, margin:'0 0 28px', lineHeight:1.5 },
  form:    { display:'flex', flexDirection:'column', gap:18 },
  field:   { display:'flex', flexDirection:'column', gap:8 },
  label:   { fontSize:11, fontWeight:700, color:P.soft, textTransform:'uppercase', letterSpacing:'0.09em' },
  input:   { width:'100%', height:52, background:P.raise, border:`1px solid ${P.borderMid}`, borderRadius:10, color:P.text, padding:'0 16px', fontSize:15, fontFamily:SANS, transition:'border-color 0.15s,box-shadow 0.15s' },
  errorBox:{ background:P.redDim, border:`1px solid rgba(168,88,88,0.28)`, borderRadius:8, padding:'12px 16px', fontSize:13, color:P.red, lineHeight:1.5 },
  submitBtn:{ width:'100%', height:52, background:P.blue, border:'none', borderRadius:10, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', letterSpacing:'-0.01em', boxShadow:'0 4px 16px rgba(74,130,176,0.30)', transition:'opacity 0.15s', marginTop:4 },
  footer:  { marginTop:24, textAlign:'center' },
  footerLink:{ fontSize:14, color:P.blue, textDecoration:'none', fontWeight:700 },
}
