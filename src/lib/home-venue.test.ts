import { describe, expect, it } from 'vitest'
import { HOME_VENUE, locationDisplay, locationForMatchSide } from '@/lib/home-venue'

describe('locationDisplay', () => {
  it('links the home ground and labels it Bogies', () => {
    expect(locationDisplay(HOME_VENUE.mapsUrl)).toEqual({
      href: HOME_VENUE.mapsUrl,
      label: 'Bogies',
    })
  })

  it('links any other maps URL as "Open in Maps"', () => {
    const url = 'https://maps.app.goo.gl/OtherPlace123'
    expect(locationDisplay(url)).toEqual({ href: url, label: 'Open in Maps' })
  })

  it('links an http URL too', () => {
    const url = 'http://example.com/pitch'
    expect(locationDisplay(url)).toEqual({ href: url, label: 'Open in Maps' })
  })

  it('renders a plain place name as text, no href', () => {
    expect(locationDisplay('Tolka Park')).toEqual({ label: 'Tolka Park' })
  })

  it('renders an empty value as empty text, no href', () => {
    expect(locationDisplay('')).toEqual({ label: '' })
    expect(locationDisplay('   ')).toEqual({ label: '' })
  })

  it('trims before deciding', () => {
    expect(locationDisplay(`  ${HOME_VENUE.mapsUrl}  `)).toEqual({
      href: HOME_VENUE.mapsUrl,
      label: 'Bogies',
    })
  })
})

describe('locationForMatchSide', () => {
  it('defaults a blank home match to the Bogies link', () => {
    expect(locationForMatchSide('', true)).toBe(HOME_VENUE.mapsUrl)
    expect(locationForMatchSide('   ', true)).toBe(HOME_VENUE.mapsUrl)
  })

  it('leaves the Bogies default in place for a home match (idempotent)', () => {
    expect(locationForMatchSide(HOME_VENUE.mapsUrl, true)).toBe(HOME_VENUE.mapsUrl)
  })

  it('keeps a manager-typed home location', () => {
    expect(locationForMatchSide('Tolka Park', true)).toBe('Tolka Park')
  })

  it('clears the Bogies default when switching to away or off a match', () => {
    expect(locationForMatchSide(HOME_VENUE.mapsUrl, false)).toBe('')
  })

  it('keeps a pasted away link', () => {
    const url = 'https://maps.app.goo.gl/AwayGround'
    expect(locationForMatchSide(url, false)).toBe(url)
  })

  it('leaves an already-empty away field empty (idempotent)', () => {
    expect(locationForMatchSide('', false)).toBe('')
  })
})
