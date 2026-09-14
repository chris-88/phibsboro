import { describe, expect, it } from 'vitest'
import { SERIES_ERROR_COPY, seriesErrorMessage } from '@/features/events/series-error-copy'
import { AppError, mapRpcError } from '@/lib/errors'

describe('seriesErrorMessage', () => {
  it('sharpens the three codes this form knows the context for', () => {
    expect(seriesErrorMessage(new AppError('not_authorised'))).toBe(
      SERIES_ERROR_COPY.not_authorised,
    )
    expect(seriesErrorMessage(new AppError('series_too_long'))).toBe(
      SERIES_ERROR_COPY.series_too_long,
    )
    expect(seriesErrorMessage(new AppError('starts_in_past'))).toBe(
      SERIES_ERROR_COPY.starts_in_past,
    )
  })

  it('falls through to mapRpcError for an unlisted code', () => {
    expect(seriesErrorMessage(new AppError('unknown'))).toBe(mapRpcError('unknown'))
    expect(seriesErrorMessage(new AppError('phone_taken'))).toBe(mapRpcError('phone_taken'))
  })

  it('treats a non-AppError as unknown', () => {
    expect(seriesErrorMessage(new Error('boom'))).toBe(mapRpcError('unknown'))
    expect(seriesErrorMessage('nope')).toBe(mapRpcError('unknown'))
  })
})
