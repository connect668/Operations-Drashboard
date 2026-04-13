import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Signup() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const trimmedEmail = email.trim()
    const trimmedCompany = company.trim()
    const trimmedFullName = fullName.trim()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          company: trimmedCompany,
          full_name: trimmedFullName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const user = data?.user

    if (user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: trimmedEmail,
        company: trimmedCompany,
        full_name: trimmedFullName,
      })

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
    }

    setMessage('Account created successfully. You can now log in.')
    setLoading(false)

    setTimeout(() => {
      router.push('/')
    }, 1200)
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
          maxWidth: '460px',
          backgroundColor: '#1e293b',
          padding: '32px',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          color: 'white',
        }}
      >
        <h1
          style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          Create Account
        </h1>

        <p
          style={{
            textAlign: 'center',
            color: '#94a3b8',
            marginBottom: '24px',
          }}
        >
          Set up your account to access the dashboard
        </p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#cbd5e1',
              }}
            >
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#cbd5e1',
              }}
            >
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#cbd5e1',
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#cbd5e1',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#f87171', marginBottom: '12px' }}>{error}</p>
          )}

          {message && (
            <p style={{ color: '#4ade80', marginBottom: '12px' }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '16px',
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '14px',
          }}
        >
          Already have an account?{' '}
          <Link
            href="/"
            style={{ color: '#60a5fa', textDecoration: 'none' }}
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
