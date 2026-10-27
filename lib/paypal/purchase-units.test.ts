import { describe, expect, test } from 'bun:test'
import {
  buildPurchaseUnits,
  formatAmount,
  MAX_PURCHASE_UNITS,
  payeePayload,
  prepareCheckoutItems,
  purchaseRefFor,
  sanitizeReferenceId,
} from './purchase-units'
import { CheckoutValidationError } from './errors'
import type { CheckoutItemInput, Payee } from './types'

const payees = new Map<string, Payee>([
  ['prod-1', { merchantId: 'MERCH1', email: 'one@sandbox.nakami.dev' }],
  ['prod-2', { merchantId: 'MERCH2' }],
])

const item = (overrides: Partial<CheckoutItemInput> = {}): CheckoutItemInput => ({
  productId: 'prod-1',
  title: 'Tan Leather Armchair',
  retailer: 'Ashford Home',
  price: 899,
  ...overrides,
})

describe('formatAmount', () => {
  test('emits exactly two decimals', () => {
    expect(formatAmount(899)).toBe('899.00')
    expect(formatAmount(19.99)).toBe('19.99')
  })

  test('rounds float artifacts to cents', () => {
    expect(formatAmount(0.1 + 0.2)).toBe('0.30')
  })
})

describe('sanitizeReferenceId / purchaseRefFor', () => {
  test('keeps only PayPal-safe characters', () => {
    expect(sanitizeReferenceId('fallback-armchair-tan-leather')).toBe(
      'fallback-armchair-tan-leather',
    )
    expect(sanitizeReferenceId('chn3 Étagère #3/wood')).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  test('prefixes the index so every unit is unique', () => {
    expect(purchaseRefFor(0, 'prod-1')).toBe('1-prod-1')
    expect(purchaseRefFor(1, 'prod-2')).toBe('2-prod-2')
    // A fully-invalid id still yields a unique, non-empty ref.
    expect(purchaseRefFor(0, '###')).toBe('1-item')
    expect(purchaseRefFor(1, '###')).toBe('2-item')
  })
})

describe('payeePayload', () => {
  test('sends merchant_id, plus email when the mapping has one', () => {
    expect(payeePayload({ merchantId: 'M1', email: 'a@b.dev' })).toEqual({
      merchant_id: 'M1',
      email_address: 'a@b.dev',
    })
    expect(payeePayload({ merchantId: 'M2', email: null })).toEqual({ merchant_id: 'M2' })
  })
})

describe('prepareCheckoutItems', () => {
  test('defaults currency and quantity', () => {
    const items = prepareCheckoutItems([item()])
    expect(items).toHaveLength(1)
    expect(items[0].currency).toBe('USD')
    expect(items[0].quantity).toBe(1)
  })

  test('merges duplicate products by summing quantity', () => {
    const items = prepareCheckoutItems([
      item({ slot: 'Armchair' }),
      item({ slot: 'Accent chair', quantity: 2 }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(3)
    expect(items[0].slot).toBe('Armchair')
  })

  test('rejects an empty cart', () => {
    expect(() => prepareCheckoutItems([])).toThrow(CheckoutValidationError)
  })

  test(`rejects more than ${MAX_PURCHASE_UNITS} distinct products (PayPal cap)`, () => {
    const eleven = Array.from({ length: MAX_PURCHASE_UNITS + 1 }, (_, i) =>
      item({ productId: `prod-${i}` }),
    )
    expect(() => prepareCheckoutItems(eleven)).toThrow(/at most 10/)
  })

  test('rejects non-positive prices', () => {
    expect(() => prepareCheckoutItems([item({ price: 0 })])).toThrow(/positive/)
    expect(() => prepareCheckoutItems([item({ price: -5 })])).toThrow(/positive/)
  })

  test('rejects non-USD currency', () => {
    expect(() => prepareCheckoutItems([item({ currency: 'EUR' })])).toThrow(/USD/)
  })
})

describe('buildPurchaseUnits', () => {
  test('builds one purchase unit per product with its own payee and amount', () => {
    const items = prepareCheckoutItems([
      item(),
      item({ productId: 'prod-2', title: 'Walnut Lounge Chair', retailer: 'Oak & Ember', price: 249.5, quantity: 2 }),
    ])
    const { units, total } = buildPurchaseUnits(items, payees)

    expect(units).toHaveLength(2)
    expect(units[0]).toEqual({
      referenceId: '1-prod-1',
      customId: '1-prod-1',
      payee: { merchantId: 'MERCH1', email: 'one@sandbox.nakami.dev' },
      amount: {
        currency: 'USD',
        value: '899.00',
        breakdown: { itemTotal: { currency: 'USD', value: '899.00' } },
      },
      items: [
        {
          name: 'Tan Leather Armchair',
          sku: 'prod-1',
          quantity: '1',
          unitAmount: { currency: 'USD', value: '899.00' },
        },
      ],
    })
    expect(units[1].referenceId).toBe('2-prod-2')
    expect(units[1].customId).toBe('2-prod-2')
    expect(units[1].payee.merchantId).toBe('MERCH2')
    expect(units[1].amount.value).toBe('499.00')
    expect(units[1].amount.breakdown.itemTotal.value).toBe('499.00')
    expect(units[1].items[0]).toEqual({
      name: 'Walnut Lounge Chair',
      sku: 'prod-2',
      quantity: '2',
      unitAmount: { currency: 'USD', value: '249.50' },
    })
    expect(total).toBe(1398)
  })

  test('throws when a product has no payee mapping', () => {
    const items = prepareCheckoutItems([item({ productId: 'unknown' })])
    expect(() => buildPurchaseUnits(items, payees)).toThrow(CheckoutValidationError)
  })
})
