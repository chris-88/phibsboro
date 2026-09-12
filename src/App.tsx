import { AppShell } from '@/components/app-shell'

// The shell and nothing else. Routing is S0.3, the real role comes from useCurrentUser()
// in S2.9, and the first real screen is S3.1.
export default function App() {
  return (
    <AppShell chrome="nav" role="player" title="Phibsboro FC" currentPath="/">
      <p className="py-6 text-sm text-muted-foreground">Shell only. Screens start at S3.1.</p>
    </AppShell>
  )
}
