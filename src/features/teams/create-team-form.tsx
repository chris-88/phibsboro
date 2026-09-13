import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useCreateTeam } from '@/api/teams'
import { createTeamInput, type CreateTeamInput } from '@/features/teams/schema'
import { isUniqueViolation } from '@/lib/errors'

export interface CreateTeamFormProps {
  /** The empty state autofocuses the field (AC10). */
  autoFocus?: boolean
}

/**
 * The one create control (S6.1): a single name field and a button. Zod trims and bounds the
 * name before any request (AC3); a case-insensitive duplicate maps to the field, not a toast
 * (AC4); any other failure keeps the typed name and shows one line under the button (AC12).
 */
export function CreateTeamForm({ autoFocus = false }: CreateTeamFormProps): React.JSX.Element {
  const create = useCreateTeam()
  const [networkFailed, setNetworkFailed] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamInput),
    defaultValues: { name: '' },
  })

  const submit = handleSubmit((values) => {
    setNetworkFailed(false)
    create.mutate(values, {
      onSuccess: () => {
        reset({ name: '' })
        setFocus('name')
      },
      onError: (error) => {
        if (isUniqueViolation(error, 'teams_name_key')) {
          setError('name', { message: "There's already a team called that." })
        } else {
          setNetworkFailed(true)
        }
      },
    })
  })

  return (
    <form
      onSubmit={(e) => {
        void submit(e)
      }}
      noValidate
      className="flex flex-col gap-2"
    >
      <Field data-invalid={errors.name ? true : undefined}>
        <FieldLabel htmlFor="team-name" className="sr-only">
          Team name
        </FieldLabel>
        <Input
          id="team-name"
          placeholder="Team name"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        <FieldError errors={errors.name ? [errors.name] : undefined} />
      </Field>
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Creating…' : 'Add team'}
      </Button>
      {networkFailed && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&rsquo;t add that team. Try again.
        </p>
      )}
    </form>
  )
}
