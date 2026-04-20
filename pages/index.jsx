import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const PALETTE = {
  bg:      "#03070f",
  panel:   "#070f1c",
  border:  "#0e1e30",
  text:    "#ccd9ea",
  textSoft:"#4d6a84",
  textMuted:"#283d52",
  blue:    "#1a80ff",
  blueSoft:"rgba(26,128,255,0.10)",
}

const MONO = '"JetBrains Mono","Fira Code","SF Mono",ui-monospace,monospace'
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'

export default function Home() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { router.replace('/dashboard') } else { setLoading(false) }
    }
    checkSession()
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    })
    if (signInError) { setError(signInError.message); setLoading(false); return }
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: PALETTE.bg }}>
        <p style={{ color: PALETTE.textSoft, fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', fontFamily: MONO }}>
          Authenticating…
        </p>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        body { margin: 0; }
        input:focus { border-color: rgba(26,128,255,0.50) !important; box-shadow: 0 0 0 3px rgba(26,128,255,0.08) !important; outline: none !important; }
        ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:#03070f; } ::-webkit-scrollbar-thumb { background:#162840; border-radius:3px; }
        .login-btn:hover:not(:disabled) { background: rgba(26,128,255,0.18) !important; }
      `}} />

      {/* ── Grid background decoration ── */}
      <div style={s.gridBg} aria-hidden />

      <div style={s.card}>
        {/* Header */}
        <div style={s.cardHeader}>
          <div style={s.logoRow}>
            <span style={s.logoDot} />
            <span style={s.logoText}>OPS</span>
          </div>
          <h1 style={s.title}>Operations Dashboard</h1>
          <p style={s.subtitle}>Enter your credentials to access the platform</p>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
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
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="login-btn"
            style={{ ...s.btn, opacity: loading ? 0.55 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div style={s.footer}>
          <span style={s.footerText}>No account?</span>
          {' '}
          <Link href="/signup" style={s.footerLink}>Create one</Link>
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
      `linear-gradient(rgba(26,128,255,0.03) 1px, transparent 1px),
       linear-gradient(90deg, rgba(26,128,255,0.03) 1px, transparent 1px)`,
    backgroundSize: '48px 48px',
    zIndex: 0,
  },
  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: '400px',
    background: PALETTE.panel,
    border: `1px solid rgba(26,128,255,0.20)`,
    borderTop: `2px solid ${PALETTE.blue}`,
    borderRadius: '4px',
    padding: '32px 28px',
    boxSizing: 'border-box',
    color: PALETTE.text,
  },
  cardHeader: { marginBottom: '28px' },
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
  subtitle: { margin: 0, fontSize: '12px', color: PALETTE.textSoft, lineHeight: 1.5, letterSpacing: '0.01em' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '10px', fontWeight: 700, color: PALETTE.textSoft,
    textTransform: 'uppercase', letterSpacing: '0.09em',
  },
  input: {
    padding: '11px 13px', borderRadius: '3px',
    border: `1px solid ${PALETTE.border}`,
    background: '#050d1a',
    color: PALETTE.text, outline: 'none',
    fontSize: '14px', boxSizing: 'border-box', width: '100%',
    fontFamily: SANS,
    transition: 'border-color 0.15s ease',
  },
  error: {
    margin: 0, padding: '10px 13px', borderRadius: '3px',
    background: 'rgba(232,50,72,0.10)',
    border: '1px solid rgba(232,50,72,0.28)',
    color: '#e83248', fontSize: '12px', lineHeight: 1.5,
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
