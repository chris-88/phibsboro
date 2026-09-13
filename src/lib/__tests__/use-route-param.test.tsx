import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useRouteError } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RouteParamMissingError, useRouteParam } from '@/lib/use-route-param'

function ShowId() {
  const id = useRouteParam('id')
  return <p>id={id}</p>
}

function ShowError() {
  const error = useRouteError()
  return <p>{error instanceof RouteParamMissingError ? `missing:${error.param}` : 'other'}</p>
}

const mount = (path: string, initial: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path, element: <ShowId />, errorElement: <ShowError /> }], {
        initialEntries: [initial],
      })}
    />,
  )

describe('useRouteParam (AC10)', () => {
  it('returns the segment as a string', () => {
    mount('/event/:id', '/event/abc123')
    expect(screen.getByText('id=abc123')).toBeInTheDocument()
  })

  it('throws RouteParamMissingError when the route has no such segment', () => {
    mount('/event', '/event')
    expect(screen.getByText('missing:id')).toBeInTheDocument()
  })

  it('names the missing param on the error', () => {
    const error = new RouteParamMissingError('teamId')
    expect(error.param).toBe('teamId')
    expect(error.message).toBe('Missing route param: teamId')
    expect(error).toBeInstanceOf(Error)
  })
})
