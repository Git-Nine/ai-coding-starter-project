import { redirect } from 'next/navigation'
import Link from 'next/link'
import { User, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">
            <User className="h-4 w-4" /> Profile
          </Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <h1 className="text-3xl">Your garden.<br />Less work. More life.</h1>
        <p className="mt-3 text-muted-foreground">
          You&apos;re signed in. Start by scanning your space — a photo and a few details is all it takes.
        </p>

        <Card className="mt-8">
          <CardContent className="space-y-4 p-6">
            <p className="eyebrow">Start here</p>
            <p className="text-sm text-muted-foreground">
              Photograph your outdoor space and tell us a little about it. Your personalised plan, shopping list, and progress log build from here.
            </p>
            <Button asChild className="w-full">
              <Link href="/scans"><Camera className="h-4 w-4" /> Scan a space</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/profile">Set up your profile</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
