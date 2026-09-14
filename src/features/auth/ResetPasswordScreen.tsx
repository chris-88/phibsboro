import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useRedeemResetToken } from '@/api/reset'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { LinkProblem } from '@/features/auth/link-problem'
import { PASSWORD_HINT_COPY, passwordHint } from '@/features/auth/password-hint'
import { setPasswordSchema, type SetPasswordValues } from '@/features/auth/schema'
import { paths } from '@/lib/paths'
import { useRouteParam } from '@/lib/use-route-param'

/**
 * The `/reset/:token` set-password screen (S2.3). The token is read from the route and never
 * validated before submit — no lookup RPC exists for it — so the screen says nothing about the
 * link's state until the player tries it. It renders the same for a signed-out visitor, a
 * signed-in one, and one signed in as somebody else; redemption replaces whatever session existed
 * with the target's own (AC9, AC11). A used, expired, revoked or unknown token all land on the one
 * dead-link screen (AC12). The token is never logged, put in the document title, or sent to Sentry.
 */
export default function ResetPasswordScreen(): React.JSX.Element {
  const token = useRouteParam('token')
  const navigate = useNavigate()
  const redeem = useRedeemResetToken()
  // Redeem succeeded but the auto sign-in did not: the password is changed, so finish at sign-in.
  const [signInFailed, setSignInFailed] = useState(false)
  const [show, setShow] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '' },
  })

  const password = useWatch({ control, name: 'password' })

  // Every failure path — used, expired, revoked, unknown — is the one dead-link screen (AC12).
  if (redeem.isError && redeem.error.kind === 'invalid_token') {
    return (
      <LinkProblem
        title="That link's expired or already been used."
        body="Ask your manager for a new one."
      />
    )
  }

  if (signInFailed) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-10 text-center">
        <h1 className="text-lg font-semibold text-foreground">Password changed.</h1>
        <p className="text-sm text-muted-foreground">Sign in with your new password.</p>
        <Button asChild className="mt-2 w-full">
          <Link to={paths.login()}>Sign in</Link>
        </Button>
      </div>
    )
  }

  const submit = handleSubmit((values) => {
    redeem.mutate(
      { token, password: values.password },
      {
        onSuccess: ({ signedIn }) => {
          if (signedIn) {
            toast('Password changed.')
            void navigate(nextRouteAfterAuth(), { replace: true })
          } else {
            setSignInFailed(true)
          }
        },
      },
    )
  })

  const busy = redeem.isPending
  // A network or unknown failure keeps the form usable; the dead-link case returned above.
  const genericError = redeem.isError

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Pick a new password</h1>
        <p className="text-sm text-muted-foreground">
          Type a new password. You&rsquo;ll be signed in straight after.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          void submit(e)
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="reset-password">New password</FieldLabel>
          <div className="relative">
            <Input
              id="reset-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              readOnly={busy}
              aria-invalid={errors.password ? true : undefined}
              className="pr-12"
              {...register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
              className="absolute inset-y-0 right-0"
              onClick={() => {
                setShow((s) => !s)
              }}
            >
              {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          {errors.password ? (
            <FieldError errors={[errors.password]} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {PASSWORD_HINT_COPY[passwordHint(password)]}
            </p>
          )}
        </Field>

        {genericError && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&rsquo;t do that. Try again.
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </div>
  )
}
