import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AuthScreen } from '@/components/auth-screen'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) redirect('/home')

  return (
    <Suspense>
      <AuthScreen mode="login" startOpen={false} />
    </Suspense>
  )
}
