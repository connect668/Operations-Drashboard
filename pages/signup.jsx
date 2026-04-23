import Head from 'next/head'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const PALETTE = {
  bg:           "#0B1118",
  panel:        "#141D26",
  panelDeep:    "#0C1219",
  border:       "#2A3B4E",
  borderStrong: "#3A5068",
  text:         "#E8EDF3",
  textSoft:     "#A6B4C2",
  textMuted:    "#7E8F9E",
  blue:         "#4D7EA8",
  blueSoft:     "rgba(77, 126, 168, 0.13)",
  green:        "#6E9477",
  greenSoft:    "rgba(110, 148, 119, 0.13)",
  red:          "#A86161",
  redSoft:      "rgba(168, 97, 97, 0.13)",
}

const MONO = '"JetBrains Mono","Fira Code","SF Mono",ui-monospace,monospace'
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'

export default function SignupPage() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [company,  setCompany]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [message,  setMessage]  = useState('')
  const [isError,  setIsError]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function handleSignup(e) {
    e.preventDefault()
    setMessage('')
    setIsError(false)
    setLoading(true)

    // 1. Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setMessage(signUpError.message)
      setIsError(true)
      setLoading(false)
      return
    }

    const authUser = data?.user

    if (!authUser) {
      setMessage('Something went wrong. Please try again.')
      setIsError(true)
      setLoading(false)
      return
    }

    // 2. Write profile row
    const { error: profileError } = await supabase.from('profiles').upsert({
      id:        authUser.id,
      email:     authUser.email,
      full_name: name.trim(),
      company:   company.trim() || null,
      role:      'pending',
    })

    if (profileError) {
      console.warn('Profile upsert failed (likely email confirmation is on):', profileError.message)
    }

    // 3. Redirect or show confirmation message
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      router.push('/dashboard')
    } else {
      setMessage('Account created! Check your email to confirm your address, then log in.')
      setIsError(false)
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <Head><title>Create Account — Playbook</title></Head>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        body { margin: 0; }
        input:focus { border-color: rgba(77,126,168,0.55) !important; box-shadow: 0 0 0 3px rgba(77,126,168,0.10) !important; outline: none !important; }
        ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:#0B1118; } ::-webkit-scrollbar-thumb { background:#2A3B4E; border-radius:3px; }
        .signup-btn:hover:not(:disabled) { background: rgba(77,126,168,0.20) !important; }
      `}} />

      {/* ── Grid background decoration ── */}
      <div style={s.gridBg} aria-hidden />

      <div style={s.card}>
        {/* Header */}
        <div style={s.cardHeader}>
          <div style={s.logoRow}>
            <span style={s.logoDot} />
            <span style={s.logoText}>OSS</span>
          </div>
          <h1 style={s.title}>Create Account</h1>
          <p style={s.subtitle}>Set up your credentials to request Playbook access</p>
        </div>

        <form onSubmit={handleSignup} style={s.form}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Full Name</label>
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
            <label style={s.label}>Company <span style={{ color: PALETTE.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              style={s.input}
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              style={s.input}
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Password <span style={{ color: PALETTE.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>min 6 chars</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              style={s.input}
            />
          </div>

          {message && (
            <p style={{ ...s.msgBox, background: isError ? 'rgba(168,97,97,0.10)' : 'rgba(110,148,119,0.10)', borderColor: isError ? 'rgba(168,97,97,0.30)' : 'rgba(110,148,119,0.28)', color: isError ? PALETTE.red : PALETTE.green }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="signup-btn"
            style={{ ...s.btn, opacity: loading ? 0.55 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <div style={s.footer}>
          <span style={s.footerText}>Already have an account?</span>
          {' '}
          <Link href="/" style={s.footerLink}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: PALETTE.bg,
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily: SANS,
    position: 'relative',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'fixed', inset: 0, pointerEvents: 'none',
    backgroundImage:
      `linear-gradient(rgba(77,126,168,0.04) 1px, transparent 1px),
       linear-gradient(90deg, rgba(77,126,168,0.04) 1px, transparent 1px)`,
    backgroundSize: '48px 48px',
    zIndex: 0,
  },
  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: '420px',
    background: PALETTE.panel,
    border: `1px solid rgba(77,126,168,0.22)`,
    borderTop: `2px solid ${PALETTE.blue}`,
    borderRadius: '4px',
    padding: '32px 28px',
    boxSizing: 'border-box',
    color: PALETTE.text,
  },
  cardHeader: { marginBottom: '24px' },
  logoRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
  logoDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: PALETTE.blue,
    boxShadow: `0 0 10px ${PALETTE.blue}`,
    display: 'inline-block',
  },
  logoText: {
    fontSize: '11px', fontWeight: 800, color: PALETTE.blue,
    letterSpacing: '0.20em', fontFamily: MONO,
  },
  title: {
    margin: '0 0 8px', fontSize: '22px', fontWeight: 700,
    color: PALETTE.text, letterSpacing: '-0.01em',
  },
  subtitle: { margin: 0, fontSize: '12px', color: PALETTE.textSoft, lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '10px', fontWeight: 700, color: PALETTE.textSoft,
    textTransform: 'uppercase', letterSpacing: '0.09em',
  },
  input: {
    padding: '11px 13px', borderRadius: '3px',
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelDeep,
    color: PALETTE.text, outline: 'none',
    fontSize: '14px', boxSizing: 'border-box', width: '100%',
    fontFamily: SANS,
    transition: 'border-color 0.15s ease',
  },
  msgBox: {
    margin: 0, padding: '10px 13px', borderRadius: '3px',
    border: '1px solid', fontSize: '12px', lineHeight: 1.5,
  },
  btn: {
    padding: '11px 16px', borderRadius: '3px',
    border: `1px solid ${PALETTE.blue}`,
    background: PALETTE.blueSoft,
    color: PALETTE.blue, fontWeight: 700,
    fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
    fontFamily: SANS,
    transition: 'background 0.15s ease',
    marginTop: '4px',
  },
  footer: { marginTop: '20px', textAlign: 'center' },
  footerText: { fontSize: '12px', color: PALETTE.textSoft },
  footerLink: { fontSize: '12px', color: PALETTE.blue, textDecoration: 'none', fontWeight: 700 },
}
