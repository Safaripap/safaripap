// The onboarding steps, shared by the server (which runs them) and the admin
// screen (which shows them ticking off). No server-only imports here.

export type StepId = 'sacco' | 'wallet' | 'address' | 'vehicle' | 'conductor'

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'sacco', label: 'Sacco ready' },
  { id: 'wallet', label: 'Lightning wallet created' },
  { id: 'address', label: 'Lightning Address set up' },
  { id: 'vehicle', label: 'Vehicle registered' },
  { id: 'conductor', label: 'Conductor login created' },
]
