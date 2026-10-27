import { describe, expect, test } from 'bun:test'
import {
  merchantNamespace,
  normalizeMerchantIds,
  sameMerchantIds,
} from './merchant-ids'

describe('normalizeMerchantIds', () => {
  test('trims, drops blanks, dedupes and sorts', () => {
    expect(normalizeMerchantIds([' B ', 'A', 'A', '', '  '])).toEqual(['A', 'B'])
  })
})

describe('sameMerchantIds', () => {
  test('ignores order and duplicates', () => {
    expect(sameMerchantIds(['A', 'B'], ['B', 'A', 'A'])).toBe(true)
  })

  test('rejects a different set', () => {
    expect(sameMerchantIds(['A'], ['A', 'B'])).toBe(false)
    expect(sameMerchantIds(['A', 'B'], ['A', 'C'])).toBe(false)
  })
})

describe('merchantNamespace', () => {
  test('is stable and order-independent', () => {
    expect(merchantNamespace(['A', 'B'])).toBe(merchantNamespace(['B', 'A']))
  })

  test('differs for different sets and is a valid identifier', () => {
    const one = merchantNamespace(['A'])
    const two = merchantNamespace(['A', 'B'])
    expect(one).not.toBe(two)
    expect(one).toMatch(/^paypal_sdk_[A-Za-z0-9_]+$/)
  })
})
