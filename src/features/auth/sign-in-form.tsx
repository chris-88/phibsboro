import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useSignIn } from '@/api/auth'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { signInSchema, type SignInInput, type SignInValues } from '@/features/auth/schema'
import { checkLockout, recordFailure, type LockoutState } from '@/features/auth/sign-in-lockout'
import { toE164 } from '@/lib/phone'

export interface SignInFormProps {
  /** The number to prefill: the duplicate-number link from registration (S2.2 AC9) or the last
   *  number that signed in on this browser. Empty when neither is present. */
  initialPhone: string
  /** When a number was prefilled, focus lands on the password field rather than the number. */
  focusPassword: boolean
  /** Called the first time the number field is edited, so the login screen can clear the "you've
   *  been signed out" line once the player starts typing (S2.6 AC10). Optional: sign-in has no
   *  notice of its own. */
  onNumberTouched?: () => void
}

/** Which failure line to show under the form. Kept apart from the field-level lockout so a
 *  wrong password and a network blip never render the same sentence (S2.2 UI states). */
type FormError = 'invalid_credentials' | 'rate_limit' | 'network' | 'unknown' | null

/**
 * The two fields and one button (S2.2 AC1). The number normalises through the shared `phoneField`
 * (D35), so `087` and `+353 87` reach the same account. Every failure is a mapped `AuthFailure`:
 * a wrong password (or an unknown number — the same member, so the screen is no existence oracle,
 * AC4) keeps the number, clears the password and moves focus; a network or rate-limit failure
 * shows its own line and never counts towards the lockout. Only a wrong-credentials failure trips
 * the five-strike, 30-second UX lockout, which is a courtesy, not a boundary (D36, A15).
 */
export function SignInForm({
  initialPhone,
  focusPassword,
  onNumberTouched,
}: SignInFormProps): React.JSX.Element {
  const navigate = useNavigate()
  const signIn = useSignIn()
  const [formError, setFormError] = useState<FormError>(null)
  const [showPassword, setShowPassword] = useState(false)
  // A monotonic tick that drives the lockout countdown. Bumped on a lock and on every failure so
  // `checkLockout` is re-evaluated; an interval advances it once locked.
  const [nowTick, setNowTick] = useState(() => Date.now())

  const {
    register: field,
    handleSubmit,
    control,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<SignInInput, unknown, SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { phone: initialPhone, password: '' },
  })

  useEffect(() => {
    // Direct DOM focus, not RHF's setFocus: on first mount the field refs are not yet marked
    // mounted in RHF's registry, so setFocus is racy here. It is reliable in the onError handler
    // below, which runs after the fields are live.
    document.getElementById(focusPassword ? 'sign-in-password' : 'sign-in-phone')?.focus()
  }, [focusPassword])

  // The current field values gate the submit button and key the per-number lockout. The number
  // is normalised to E.164 so the lockout follows the account, not the spelling (AC6).
  const rawPhone = useWatch({ control, name: 'phone' })
  const password = useWatch({ control, name: 'password' })
  const normalised = toE164(rawPhone)
  const lockout: LockoutState = normalised
    ? checkLockout(normalised, nowTick)
    : { failures: 0, lockedUntil: null }
  const { lockedUntil } = lockout
  const locked = lockedUntil !== null && lockedUntil > nowTick
  const remainingSeconds =
    lockedUntil !== null ? Math.max(0, Math.ceil((lockedUntil - nowTick) / 1000)) : 0

  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => {
      setNowTick(Date.now())
    }, 500)
    return () => {
      clearInterval(id)
    }
  }, [locked])

  const busy = signIn.isPending
  const bothFilled = rawPhone.trim() !== '' && password !== ''

  const submit = handleSubmit((values) => {
    setFormError(null)
    // The submit button is disabled while `locked`, so this only runs when the number is clear.
    signIn.mutate(values, {
      onSuccess: () => {
        void navigate(nextRouteAfterAuth(), { replace: true })
      },
      onError: (failure) => {
        switch (failure.kind) {
          case 'invalid_credentials':
            recordFailure(values.phone, Date.now())
            setNowTick(Date.now())
            // Keep the number exactly as typed, clear only the password, move focus to it (AC3).
            resetField('password')
            setFocus('password')
            setFormError('invalid_credentials')
            return
          case 'rate_limit':
            setFormError('rate_limit')
            return
          case 'network':
            setFormError('network')
            return
          default:
            setFormError('unknown')
        }
      },
    })
  })

  const submitLabel = busy ? 'Signing in…' : 'Sign in'

  return (
    <form
      onSubmit={(e) => {
        void submit(e)
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field data-invalid={errors.phone ? true : undefined}>
        <FieldLabel htmlFor="sign-in-phone">Mobile number</FieldLabel>
        <Input
          id="sign-in-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="087 123 4567"
          disabled={busy}
          aria-invalid={errors.phone ? true : undefined}
          {...field('phone')}
          onChange={(e) => {
            void field('phone').onChange(e)
            onNumberTouched?.()
          }}
        />
        <FieldError errors={errors.phone ? [errors.phone] : undefined} />
      </Field>

      <Field data-invalid={errors.password ? true : undefined}>
        <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id="sign-in-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={busy}
            aria-invalid={errors.password || formError === 'invalid_credentials' ? true : undefined}
            {...field('password')}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            disabled={busy}
            onClick={() => {
              setShowPassword((v) => !v)
            }}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
        <FieldError errors={errors.password ? [errors.password] : undefined} />
        {formError === 'invalid_credentials' && (
          <p role="alert" className="text-sm text-destructive">
            That number and password don&rsquo;t match.
          </p>
        )}
      </Field>

      {formError === 'network' && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&rsquo;t reach the server. Try again.
        </p>
      )}
      {formError === 'rate_limit' && (
        <p role="alert" className="text-sm text-destructive">
          Too many tries. Wait a minute.
        </p>
      )}
      {formError === 'unknown' && (
        <p role="alert" className="text-sm text-destructive">
          Something went wrong. Try again.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={busy || !bothFilled || locked}>
        {submitLabel}
      </Button>

      {locked && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Too many tries. Try again in {remainingSeconds}s.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Forgotten your password? Ask your manager to send you a reset link.
      </p>
    </form>
  )
}
