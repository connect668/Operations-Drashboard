import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

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

    // 1. Create auth user ────────────────────────────────────────────────────
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

    // 2. Write profile row ────────────────────────────────────────────────────
    // IMPORTANT: if "Confirm email" is enabled in your Supabase Auth settings,
    // the user will NOT have an active session here, so auth.uid() is null and
    // RLS will block the upsert unless your profiles table allows anon inserts
    // (policy: "allow insert for all") OR you use a database trigger instead.
    //
    // Best long-term fix: create a trigger in Supabase:
    //   CREATE OR REPLACE FUNCTION public.handle_new_user()
    //   RETURNS trigger AS $$
    //   BEGIN
    //     INSERT INTO public.profiles (id, email, full_name, role)
    //     VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'pending');
    //     RETURN new;
    //   END;
    //   $$ LANGUAGE plpgsql SECURITY DEFINER;
    //   CREATE TRIGGER on_auth_user_created
    //     AFTER INSERT ON auth.users
    //     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    //
    // Until then, this upsert works when email confirmation is DISABLED.

    const { error: profileError } = await supabase.from('profiles').upsert({
      id:        authUser.id,
      email:     authUser.email,
      full_name: name.trim(),
      company:   company.trim() || null,
      role:      'pending',
    })

    if (profileError) {
      // Don't block the user — account was created, profile can be filled later.
      console.warn('Profile upsert failed (likely email confirmation is on):', profileError.message)
    }

    // 3. If email confirmation is OFF the user is signed in immediately.
    //    If it is ON, session is null — redirect to login with a message.
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // Already authenticated — go straight to dashboard
      router.push('/dashboard')
    } else {
      // Email confirmation required
      setMessage('Account created! Check your email to confirm your address, then log in.')
      setIsError(false)
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#111827',
          padding: '32px',
          borderRadius: '16px',
          border: '1px solid #1f2937',
          color: 'white',
        }}
      >
        <h1 style={{ marginBottom: '8px', fontSize: '24px', fontWeight: 700 }}>Create Account</h1>
        <p style={{ marginBottom: '24px', color: '#9ca3af', fontSize: '14px' }}>
          Set up your account to access the dashboard.
        </p>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #374151', backgroundColor: '#1f2937', color: 'white', outline: 'none' }}
          />
          <input
            type="text"
            placeholder="Company (optional)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #374151', backgroundColor: '#1f2937', color: 'white', outline: 'none' }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #374151', backgroundColor: '#1f2937', color: 'white', outline: 'none' }}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #374151', backgroundColor: '#1f2937', color: 'white', outline: 'none' }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px', borderRadius: '10px', border: 'none',
              backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: '16px', fontSize: '14px', color: isError ? '#f87171' : '#4ade80' }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: '20px', color: '#9ca3af', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link href="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
