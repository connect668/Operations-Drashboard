import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

export default function Home() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('Profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.log('Supabase error:', error)
        setErrorMessage(error.message)
      } else {
        setProfiles(data || [])
      }

      setLoading(false)
    }

    loadProfiles()
  }, [])

  return (
    <main style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Operations Dashboard</h1>
      <p>Supabase connection test</p>

      {loading && <p>Loading...</p>}
      {errorMessage && <p style={{ color: 'red' }}>Error: {errorMessage}</p>}

      {!loading && !errorMessage && profiles.length === 0 && (
        <p>No profiles found.</p>
      )}

      {!loading && !errorMessage && profiles.length > 0 && (
        <div>
          {profiles.map((profile) => (
            <div
              key={profile.id}
              style={{
                border: '1px solid #ccc',
                padding: '12px',
                marginBottom: '12px',
                borderRadius: '8px',
              }}
            >
              <p><strong>Name:</strong> {profile.name || 'No name'}</p>
              <p><strong>Role:</strong> {profile.role || 'No role'}</p>
              <p><strong>ID:</strong> {profile.id}</p>
              <p><strong>Created:</strong> {profile.created_at}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
