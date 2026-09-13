import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import * as Sentry from '@sentry/react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useRegister } from '@/api/auth'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { PASSWORD_HINT_COPY, passwordHint } from '@/features/auth/password-hint'
import { registerSchema, type RegisterInput, type RegisterValues } from '@/features/auth/schema'
import { paths } from '@/lib/paths'

export interface RegisterFormProps {
  /** Submit stays disabled until the team lookup settles, so a player cannot register into a
   *  link that has not been checked yet (UI states). */
  canSubmit: boolean
  /** The join failed as `invalid_invite` after the account was already created: the screen
   *  swaps to `LinkProblem`, keeping the live session (AC9). */
  onDeadLink: () => void
}

/**
 * The three fields and one button (CLAUDE.md §Epic 2). A DOM count of inputs inside this form is
 * exactly three (AC3). The schema transforms the number to E.164, so the form's input and output
 * types differ and the hook declares both. Every failure is a mapped `AuthFailure`; the terminal
 * ones leave this component (navigate on success, `onDeadLink` on a dead link), the rest render
 * inline with the typed name, number and password kept for a one-tap retry.
 */
export function RegisterForm({ canSubmit, onDeadLink }: RegisterFormProps): React.JSX.Element {
  const navigate = useNavigate()
  const register = useRegister()
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null)
  const [genericError, setGenericError] = useState(false)

  const {
    register: field,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', phone: '', password: '' },
  })

  // useWatch (not watch()) so the length-only hint updates without the compiler-incompatible
  // subscription; it reads the current password to pick the one hint line under the field.
  const password = useWatch({ control, name: 'password' })

  const submit = handleSubmit((values) => {
    setDuplicatePhone(null)
    setGenericError(false)
    register.mutate(values, {
      onSuccess: () => {
        void navigate(nextRouteAfterAuth(), { replace: true })
      },
      onError: (failure) => {
        switch (failure.kind) {
          case 'invalid_invite':
            onDeadLink()
            return
          case 'duplicate_phone':
            setDuplicatePhone(values.phone)
            return
          case 'weak_password':
            // The schema blocks < 8, so this is a server floor the client did not model.
            setError('password', { message: 'At least 8 characters' })
            return
          case 'no_session':
            // The symptom of phone confirmations being switched back on: no message is ever
            // sent, so never prompt to check one — report it and offer a retry (AC13).
            Sentry.captureMessage('signUp returned no session')
            setGenericError(true)
            return
          default:
            setGenericError(true)
        }
      },
    })
  })

  const busy = register.isPending

  return (
    <form
      onSubmit={(e) => {
        void submit(e)
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field data-invalid={errors.name ? true : undefined}>
        <FieldLabel htmlFor="register-name">Your name</FieldLabel>
        <Input
          id="register-name"
          autoComplete="name"
          autoCapitalize="words"
          disabled={busy}
          aria-invalid={errors.name ? true : undefined}
          {...field('name')}
        />
        <FieldError errors={errors.name ? [errors.name] : undefined} />
      </Field>

      <Field data-invalid={errors.phone ? true : undefined}>
        <FieldLabel htmlFor="register-phone">Mobile number</FieldLabel>
        <Input
          id="register-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="087 123 4567"
          disabled={busy}
          aria-invalid={errors.phone ? true : undefined}
          {...field('phone')}
        />
        <FieldError errors={errors.phone ? [errors.phone] : undefined} />
      </Field>

      <Field data-invalid={errors.password ? true : undefined}>
        <FieldLabel htmlFor="register-password">Password</FieldLabel>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          disabled={busy}
          aria-invalid={errors.password ? true : undefined}
          {...field('password')}
        />
        {errors.password ? (
          <FieldError errors={[errors.password]} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {PASSWORD_HINT_COPY[passwordHint(password)]}
          </p>
        )}
      </Field>

      {duplicatePhone !== null && (
        <p role="alert" className="text-sm text-destructive">
          That number is already registered.{' '}
          <Link
            to={paths.login()}
            state={{ phone: duplicatePhone }}
            className="font-medium underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      )}
      {genericError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&rsquo;t create your account. Try again.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
        {busy ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
