import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSignUp(e) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Account created. You can go back and sign in now.')
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
        <h1 style={{ marginBottom: '8px' }}>Create Account</h1>
        <p style={{ marginBottom: '20px', color: '#9ca3af' }}>
          Set up your email and password
        </p>

        <form onSubmit={handleSignUp} style={{ display: 'grid', gap: '12px' }}>
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
            Create Account
          </button>
        </form>

        <Link href="/">
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
            Back to Login
          </button>
        </Link>

        {message && (
          <p style={{ marginTop: '16px', color: '#93c5fd' }}>{message}</p>
        )}
      </div>
    </main>
  )
}
