import Head from 'next/head'
import { useState } from 'react'
import Link from 'next/link'
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

const ROLES = [
  { value:'employee',   label:'Employee'        },
  { value:'shift_lead', label:'Shift Lead'       },
  { value:'manager',    label:'Manager'          },
  { value:'gm',         label:'General Manager'  },
  { value:'area_coach', label:'Area Coach'       },
  { value:'executive',  label:'Executive'        },
]

function Logo({ size = 22 }) {
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

export default function SignupPage() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [company,  setCompany]  = useState('')
  const [role,     setRole]     = useState('employee')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [msg,      setMsg]      = useState('')
  const [isError,  setIsError]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()
    setMsg(''); setIsError(false); setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setMsg(signUpError.message); setIsError(true); setLoading(false); return }

    const authUser = data?.user
    if (!authUser) { setMsg('Something went wrong. Please try again.'); setIsError(true); setLoading(false); return }

    await supabase.from('profiles').upsert({
      id:        authUser.id,
      email:     authUser.email,
      full_name: name.trim(),
      company:   company.trim() || null,
      role:      role,
      plan:      'free',
    })

    const { data: { session } } = await supabase.auth.getSession()
    if (session) { router.push('/dashboard') }
    else { setMsg('Account created! Check your email to confirm, then sign in.'); setIsError(false); setLoading(false) }
  }

  return (
    <div style={s.page}>
      <Head><title>Create Account — Playbook by OSS</title></Head>
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

          <h1 style={s.heading}>Create account</h1>
          <p style={s.subheading}>Request access to your team's playbook</p>

          <form onSubmit={handleSignup} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                required placeholder="Jane Smith" style={s.input} autoComplete="name"
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>
                Company <span style={s.optionalTag}>(optional)</span>
              </label>
              <input
                type="text" value={company} onChange={e => setCompany(e.target.value)}
                placeholder="Acme Corp" style={s.input}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Your Role</label>
              <div style={s.roleGrid}>
                {ROLES.map(r => (
                  <button
                    key={r.value} type="button" onClick={() => setRole(r.value)}
                    style={{ ...s.roleBtn, ...(role === r.value ? s.roleBtnActive : {}) }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@company.com" style={s.input} autoComplete="email"
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>
                Password <span style={s.optionalTag}>min 6 chars</span>
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6} placeholder="••••••••" style={s.input} autoComplete="new-password"
              />
            </div>

            {msg && (
              <div style={{
                ...s.msgBox,
                background:   isError ? P.redDim   : P.greenDim,
                borderColor:  isError ? 'rgba(138,46,46,0.22)' : 'rgba(46,125,82,0.22)',
                color:        isError ? P.red       : P.green,
              }}>
                {msg}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ ...s.submitBtn, ...(loading ? { opacity: 0.65 } : {}) }}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>

          <div style={s.footer}>
            <span style={{ color: P.muted, fontSize: 13 }}>Already have an account? </span>
            <Link href="/" style={s.footerLink}>Sign in</Link>
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
  input:focus, select:focus {
    border-color: rgba(107,94,168,0.55) !important;
    box-shadow: 0 0 0 3px rgba(107,94,168,0.08) !important;
    outline: none !important;
  }
`

const s = {
  page:        { minHeight:'100vh', background:P.pageBg, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'36px 16px 56px', fontFamily:SANS },
  wrap:        { width:'100%', maxWidth:460 },
  card:        { background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:'36px 32px', boxShadow:'0 4px 24px rgba(107,94,168,0.08)' },
  brandRow:    { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
  brandText:   { display:'flex', flexDirection:'column', gap:1 },
  brandName:   { fontSize:15, fontWeight:700, color:P.text, letterSpacing:'-0.01em', lineHeight:1 },
  brandBy:     { fontSize:10, fontWeight:600, color:P.muted, letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:MONO, lineHeight:1 },
  heading:     { fontSize:24, fontWeight:700, color:P.text, margin:'0 0 6px', letterSpacing:'-0.02em' },
  subheading:  { fontSize:14, color:P.soft, margin:'0 0 28px', lineHeight:1.5 },
  form:        { display:'flex', flexDirection:'column', gap:20 },
  field:       { display:'flex', flexDirection:'column', gap:6 },
  label:       { fontSize:11, fontWeight:600, color:P.soft, textTransform:'uppercase', letterSpacing:'0.08em' },
  optionalTag: { color:P.muted, fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 },
  input:       { width:'100%', height:48, background:P.surface, border:`1.5px solid ${P.border}`, borderRadius:8, color:P.text, padding:'0 14px', fontSize:15, fontFamily:SANS, transition:'border-color 0.15s,box-shadow 0.15s' },
  roleGrid:    { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 },
  roleBtn:     { background:P.surfaceSub, border:`1.5px solid ${P.border}`, borderRadius:8, padding:'10px 6px', fontSize:13, color:P.soft, cursor:'pointer', textAlign:'center', transition:'border-color 0.12s,background 0.12s,color 0.12s', fontFamily:SANS },
  roleBtnActive:{ background:P.purpleDim, border:`1.5px solid rgba(107,94,168,0.40)`, color:P.purple, fontWeight:600 },
  msgBox:      { border:'1px solid', borderRadius:8, padding:'11px 14px', fontSize:13, lineHeight:1.5 },
  submitBtn:   { width:'100%', height:48, background:BTN_GRAD, border:'none', borderRadius:8, color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', letterSpacing:'-0.01em', boxShadow:'0 2px 12px rgba(107,94,168,0.25)', transition:'opacity 0.15s', marginTop:4 },
  footer:      { marginTop:24, textAlign:'center' },
  footerLink:  { fontSize:13, color:P.purple, textDecoration:'none', fontWeight:600 },
}
