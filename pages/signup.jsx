import Head from 'next/head'
import { useState } from 'react'
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
  green:    "#5E9E72",
  greenDim: "rgba(94,158,114,0.12)",
  red:      "#A85858",
  redDim:   "rgba(168,88,88,0.12)",
}
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

    const { data:{ session } } = await supabase.auth.getSession()
    if (session) { router.push('/dashboard') }
    else { setMsg('Account created! Check your email to confirm, then sign in.'); setIsError(false); setLoading(false) }
  }

  return (
    <div style={s.page}>
      <Head><title>Create Account — Playbook</title></Head>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div style={s.gridBg} aria-hidden/>

      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.brandRow}>
            <span style={s.brandDot}/>
            <span style={s.brandName}>Playbook</span>
          </div>

          <h1 style={s.heading}>Create account</h1>
          <p style={s.subheading}>Request access to your team's playbook</p>

          <form onSubmit={handleSignup} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)}
                required placeholder="Jane Smith" style={s.input} autoComplete="name"/>
            </div>

            <div style={s.field}>
              <label style={s.label}>Company <span style={{color:P.muted,fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
              <input type="text" value={company} onChange={e=>setCompany(e.target.value)}
                placeholder="Acme Corp" style={s.input}/>
            </div>

            <div style={s.field}>
              <label style={s.label}>Your Role</label>
              <div style={s.roleGrid}>
                {ROLES.map(r=>(
                  <button key={r.value} type="button" onClick={()=>setRole(r.value)}
                    style={{...s.roleBtn,...(role===r.value?s.roleBtnActive:{})}}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                required placeholder="you@company.com" style={s.input} autoComplete="email"/>
            </div>

            <div style={s.field}>
              <label style={s.label}>Password <span style={{color:P.muted,fontWeight:400,textTransform:'none',letterSpacing:0}}>min 6 chars</span></label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                required minLength={6} placeholder="••••••••" style={s.input} autoComplete="new-password"/>
            </div>

            {msg && (
              <div style={{...s.msgBox, background:isError?P.redDim:P.greenDim, borderColor:isError?'rgba(168,88,88,0.28)':'rgba(94,158,114,0.28)', color:isError?P.red:P.green}}>
                {msg}
              </div>
            )}

            <button type="submit" disabled={loading} style={{...s.submitBtn,...(loading?{opacity:0.6}:{})}}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={s.footer}>
            <span style={{color:P.soft,fontSize:14}}>Already have an account? </span>
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
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  input:focus, select:focus {
    border-color: rgba(74,130,176,0.55) !important;
    box-shadow: 0 0 0 3px rgba(74,130,176,0.10) !important;
    outline: none !important;
  }
`

const s = {
  page:    { minHeight:'100vh', background:P.bg, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px 48px', fontFamily:SANS, position:'relative', overflow:'hidden' },
  gridBg:  { position:'fixed', inset:0, pointerEvents:'none', backgroundImage:`linear-gradient(rgba(74,130,176,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(74,130,176,0.035) 1px,transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 },
  wrap:    { width:'100%', maxWidth:440, position:'relative', zIndex:1 },
  card:    { background:P.surface, border:`1px solid ${P.borderMid}`, borderTop:`2px solid ${P.blue}`, borderRadius:14, padding:'32px 24px', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' },
  brandRow:{ display:'flex', alignItems:'center', gap:8, marginBottom:24 },
  brandDot:{ width:10, height:10, borderRadius:'50%', background:P.blue, boxShadow:`0 0 10px ${P.blue}`, display:'inline-block' },
  brandName:{ fontSize:13, fontWeight:800, color:P.blue, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:MONO },
  heading: { fontSize:26, fontWeight:700, color:P.text, margin:'0 0 6px', letterSpacing:'-0.02em' },
  subheading:{ fontSize:14, color:P.soft, margin:'0 0 28px', lineHeight:1.5 },
  form:    { display:'flex', flexDirection:'column', gap:20 },
  field:   { display:'flex', flexDirection:'column', gap:8 },
  label:   { fontSize:11, fontWeight:700, color:P.soft, textTransform:'uppercase', letterSpacing:'0.09em' },
  input:   { width:'100%', height:52, background:P.raise, border:`1px solid ${P.borderMid}`, borderRadius:10, color:P.text, padding:'0 16px', fontSize:15, fontFamily:SANS, transition:'border-color 0.15s,box-shadow 0.15s' },
  roleGrid:{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 },
  roleBtn: { background:'transparent', border:`1px solid ${P.border}`, borderRadius:8, padding:'11px 8px', fontSize:13, color:P.soft, cursor:'pointer', textAlign:'center', transition:'border-color 0.12s,background 0.12s,color 0.12s' },
  roleBtnActive:{ background:P.blueDim, border:`1px solid rgba(74,130,176,0.45)`, color:P.text, fontWeight:600 },
  msgBox:  { border:'1px solid', borderRadius:8, padding:'12px 16px', fontSize:13, lineHeight:1.5 },
  submitBtn:{ width:'100%', height:52, background:P.blue, border:'none', borderRadius:10, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', letterSpacing:'-0.01em', boxShadow:'0 4px 16px rgba(74,130,176,0.30)', transition:'opacity 0.15s', marginTop:4 },
  footer:  { marginTop:24, textAlign:'center' },
  footerLink:{ fontSize:14, color:P.blue, textDecoration:'none', fontWeight:700 },
}
