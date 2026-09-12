import { describe, expect, it } from 'vitest'
import { isNavItemActive, navItemsForRole } from '@/lib/nav'

const labels = (role: 'player' | 'manager' | 'admin') => navItemsForRole(role).map((i) => i.label)

describe('navItemsForRole (AC7)', () => {
  it('gives a player Home and History', () => {
    expect(labels('player')).toEqual(['Home', 'History'])
  })

  it('gives a manager Home, History and Manage', () => {
    expect(labels('manager')).toEqual(['Home', 'History', 'Manage'])
  })

  it('gives an admin Home, History, Manage and Admin', () => {
    expect(labels('admin')).toEqual(['Home', 'History', 'Manage', 'Admin'])
  })

  it('never offers a player Manage or Admin', () => {
    expect(labels('player')).not.toContain('Manage')
    expect(labels('player')).not.toContain('Admin')
  })

  it('uses the D34 route paths', () => {
    expect(navItemsForRole('admin').map((i) => i.to)).toEqual([
      '/',
      '/history',
      '/manage',
      '/admin',
    ])
  })
})

describe('isNavItemActive', () => {
  it('matches Home exactly and nothing else', () => {
    expect(isNavItemActive('/', '/')).toBe(true)
    expect(isNavItemActive('/', '/manage')).toBe(false)
  })

  it('lights up the section a deeper route belongs to', () => {
    expect(isNavItemActive('/manage', '/manage')).toBe(true)
    expect(isNavItemActive('/manage', '/manage/event/new')).toBe(true)
  })

  it('does not match a sibling route that shares a prefix', () => {
    expect(isNavItemActive('/manage', '/managers')).toBe(false)
  })
})
