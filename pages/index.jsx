import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(true)   // true while we check existing session
  const [error,    setError]    = useState('')

  // ── If the user already has a valid session, skip the login page entirely ──
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        setLoading(false)
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password: password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // Session is now stored in localStorage by the Supabase client.
    // Push to dashboard — the dashboard's auth check will confirm the session.
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#1e293b',
          padding: '32px',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          color: 'white',
        }}
      >
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>
          Operations Dashboard
        </h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '24px' }}>
          Sign in to continue
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#cbd5e1' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: '1px solid #334155', backgroundColor: '#0f172a',
                color: 'white', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#cbd5e1' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: '1px solid #334155', backgroundColor: '#0f172a',
                color: 'white', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#f87171', marginBottom: '12px', fontSize: '14px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              backgroundColor: loading ? '#1d4ed8' : '#2563eb',
              color: 'white', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '16px', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#60a5fa', textDecoration: 'none' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
