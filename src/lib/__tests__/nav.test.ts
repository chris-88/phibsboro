import { describe, expect, it } from 'vitest'
import { isNavItemActive, navItemsForRole } from '@/lib/nav'

const labels = (role: 'player' | 'manager' | 'admin') => navItemsForRole(role).map((i) => i.label)

describe('navItemsForRole (AC7)', () => {
  it('gives a player Home and History', () => {
    expect(labels('player')).toEqual(['Home', 'History'])
  })

  it('gives a manager Home, History, Manage and Squad (S10.3 AC1)', () => {
    expect(labels('manager')).toEqual(['Home', 'History', 'Manage', 'Squad'])
  })

  it('gives an admin Home, History, Manage and Admin — no Squad (Q4, AC1)', () => {
    expect(labels('admin')).toEqual(['Home', 'History', 'Manage', 'Admin'])
    expect(labels('admin')).not.toContain('Squad')
  })

  it('never offers a player Manage, Squad or Admin', () => {
    expect(labels('player')).not.toContain('Manage')
    expect(labels('player')).not.toContain('Squad')
    expect(labels('player')).not.toContain('Admin')
  })

  it('uses the D34 route paths', () => {
    expect(navItemsForRole('admin').map((i) => i.to)).toEqual([
      '/',
      '/history',
      '/manage',
      '/admin',
    ])
    expect(navItemsForRole('manager').map((i) => i.to)).toEqual([
      '/',
      '/history',
      '/manage',
      '/squad',
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

  it('lights Squad on /squad and its deeper routes (S10.3)', () => {
    expect(isNavItemActive('/squad', '/squad')).toBe(true)
    expect(isNavItemActive('/squad', '/squad/event/x')).toBe(true)
    expect(isNavItemActive('/squad', '/manage')).toBe(false)
  })
})
