import { describe, expect, test } from 'bun:test'
import {
  pickRandomMerchant,
  type MerchantPoolEntry,
} from './merchant-pool'

const entries: MerchantPoolEntry[] = [
  { payeeEmail: 'one@sandbox.example.com', payeeMerchantId: 'MERCH1' },
  { payeeEmail: 'two@sandbox.example.com', payeeMerchantId: 'MERCH2' },
]

describe('pickRandomMerchant', () => {
  test('selects the entry at the random index', () => {
    expect(pickRandomMerchant(() => 0, entries)).toBe(entries[0])
    expect(pickRandomMerchant(() => 0.99, entries)).toBe(entries[1])
  })

  test('clamps random() === 1 to the final entry', () => {
    expect(pickRandomMerchant(() => 1, entries)).toBe(entries[1])
  })

  test('returns null when the pool is empty', () => {
    expect(pickRandomMerchant(() => 0, [])).toBeNull()
  })
})
