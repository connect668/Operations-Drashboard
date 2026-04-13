import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

export default function Home() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setSession(session)
      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignIn(e) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Logged in successfully.')
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Signed out.')
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  if (session) {
    return (
      <main style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
        <h1>Logged In</h1>
        <p>Welcome: {session.user.email}</p>

        <button
          onClick={handleSignOut}
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#111827',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #374151',
        }}
      >
        <h1 style={{ marginBottom: '8px' }}>Operations Dashboard</h1>
        <p style={{ marginBottom: '20px', color: '#9ca3af' }}>
          Sign in to continue
        </p>

        <form onSubmit={handleSignIn} style={{ display: 'grid', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #4b5563',
              background: '#1f2937',
              color: 'white',
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #4b5563',
              background: '#1f2937',
              color: 'white',
            }}
          />

          <button
            type="submit"
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </form>

        <Link href="/signup">
          <button
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #4b5563',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Create Account
          </button>
        </Link>

        {message && (
          <p style={{ marginTop: '16px', color: '#93c5fd' }}>{message}</p>
        )}
      </div>
    </main>
  )
}
