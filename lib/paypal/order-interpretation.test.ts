import { describe, expect, test } from 'bun:test'
import {
  captureUnitsFromOrder,
  declinedRefsFrom422,
  deriveOrderStatusFromItems,
  orderStatusFromPayPal,
} from './order-interpretation'

// Fixtures trimmed from the official "Accept Multi-seller payments" responses
// (developer.paypal.com/platforms/checkout/standard/customize/multiseller-payments).

const fullyCapturedBody = {
  status: 'COMPLETED',
  purchase_units: [
    {
      reference_id: '1-prod-1',
      payments: {
        captures: [
          {
            id: '3C679366HH908993G2',
            status: 'COMPLETED',
            seller_receivable_breakdown: { net_amount: { value: '899.00' } },
          },
        ],
      },
    },
    {
      reference_id: '2-prod-2',
      payments: {
        captures: [
          {
            id: '3C679366HH908993F1',
            status: 'COMPLETED',
            seller_receivable_breakdown: { net_amount: { value: '48.00' } },
          },
        ],
      },
    },
  ],
}

const partiallyCapturedBody = {
  status: 'PARTIALLY_COMPLETED',
  purchase_units: [
    {
      reference_id: '1-prod-1',
      payments: {
        captures: [{ status: 'DECLINED', error: { name: 'UNPROCESSABLE_ENTITY' } }],
      },
    },
    {
      reference_id: '2-prod-2',
      payments: {
        captures: [
          { id: 'CAP2', status: 'COMPLETED', seller_receivable_breakdown: { net_amount: { value: '48.00' } } },
        ],
      },
    },
  ],
}

describe('captureUnitsFromOrder', () => {
  test('maps each purchase unit to its capture facts', () => {
    const byRef = captureUnitsFromOrder(fullyCapturedBody)
    expect(byRef.size).toBe(2)
    expect(byRef.get('1-prod-1')).toEqual({
      purchaseRef: '1-prod-1',
      captureId: '3C679366HH908993G2',
      captureStatus: 'COMPLETED',
      netAmount: 899,
    })
    expect(byRef.get('2-prod-2')?.netAmount).toBe(48)
  })

  test('tolerates units without captures yet', () => {
    const byRef = captureUnitsFromOrder({
      purchase_units: [{ reference_id: '1-prod-1' }],
    })
    expect(byRef.get('1-prod-1')).toEqual({
      purchaseRef: '1-prod-1',
      captureId: null,
      captureStatus: null,
      netAmount: null,
    })
  })

  test('reads the 207 PARTIALLY_COMPLETED shape: declined unit has no capture id', () => {
    const byRef = captureUnitsFromOrder(partiallyCapturedBody)
    expect(byRef.get('1-prod-1')).toEqual({
      purchaseRef: '1-prod-1',
      captureId: null,
      captureStatus: 'DECLINED',
      netAmount: null,
    })
    expect(byRef.get('2-prod-2')?.captureStatus).toBe('COMPLETED')
  })
})

describe('orderStatusFromPayPal', () => {
  test('maps the statuses the multi-seller flow can produce', () => {
    expect(orderStatusFromPayPal('COMPLETED')).toBe('completed')
    expect(orderStatusFromPayPal('PARTIALLY_COMPLETED')).toBe('partially_completed')
    expect(orderStatusFromPayPal('APPROVED')).toBe('approved')
    expect(orderStatusFromPayPal('VOIDED')).toBe('canceled')
    expect(orderStatusFromPayPal('CREATED')).toBe('created')
  })

  test('falls back to created for unknown statuses', () => {
    expect(orderStatusFromPayPal('SOMETHING_NEW')).toBe('created')
  })
})

describe('declinedRefsFrom422', () => {
  test('extracts reference ids from the per-unit error details', () => {
    const refs = declinedRefsFrom422({
      name: 'UNPROCESSABLE_ENTITY',
      details: [
        { field: "/purchase_units/@reference_id=='1-prod-1'", issue: 'INSTRUMENT_DECLINED' },
        { field: "/purchase_units/@reference_id=='2-prod-2'", issue: 'INSTRUMENT_DECLINED' },
      ],
    })
    expect(refs).toEqual(['1-prod-1', '2-prod-2'])
  })
})

describe('deriveOrderStatusFromItems', () => {
  test('all COMPLETED -> completed', () => {
    expect(
      deriveOrderStatusFromItems([
        { captureStatus: 'COMPLETED' },
        { captureStatus: 'COMPLETED' },
      ]),
    ).toBe('completed')
  })

  test('mixed COMPLETED + DECLINED -> partially_completed', () => {
    expect(
      deriveOrderStatusFromItems([
        { captureStatus: 'DECLINED' },
        { captureStatus: 'COMPLETED' },
      ]),
    ).toBe('partially_completed')
  })

  test('all DECLINED -> failed', () => {
    expect(
      deriveOrderStatusFromItems([{ captureStatus: 'DECLINED' }, { captureStatus: 'DECLINED' }]),
    ).toBe('failed')
  })

  test('incomplete or PENDING streams return null', () => {
    expect(deriveOrderStatusFromItems([{ captureStatus: null }, { captureStatus: 'COMPLETED' }])).toBeNull()
    expect(deriveOrderStatusFromItems([{ captureStatus: 'PENDING' }, { captureStatus: 'COMPLETED' }])).toBeNull()
    expect(deriveOrderStatusFromItems([])).toBeNull()
  })
})
