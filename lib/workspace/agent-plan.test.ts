import { describe, expect, test } from 'bun:test'

import { readLatestPlan, readMessagePlan, toViewMessages } from './agent-plan'

// The agent's plan (AgentPlanSchema) references products by id only; the details
// ride on the search_channel3 tool-call parts of the same assistant message.
// These fixtures mirror both part shapes: live streamed parts carry `output`,
// the parts persisted by /api/chat carry `result` (with toolName/args).

const searchResult = {
  id: 'fallback-sofa-emerald-velvet',
  title: 'Emerald Velvet Sofa',
  imageUrl: 'https://placehold.co/600x400/sofa',
  price: { amount: 1499, currency: 'USD' },
  retailer: 'Maison Nord',
  availability: 'InStock',
  url: 'https://maisonnord.example/products/emerald-velvet-sofa',
}

const lampResult = {
  id: 'fallback-floor-lamp-brass-arc',
  title: 'Brass Arc Floor Lamp',
  imageUrl: 'https://placehold.co/600x400/lamp',
  price: { amount: 189, currency: 'USD' },
  retailer: 'Ashford Home',
  availability: 'InStock',
  url: 'https://ashfordhome.example/products/brass-arc-floor-lamp',
}

const plan = {
  summary: 'A velvet sofa and a brass arc lamp for your living room.',
  searchQuery: 'velvet sofa brass floor lamp',
  productIds: ['fallback-sofa-emerald-velvet', 'fallback-floor-lamp-brass-arc'],
}

const message = (parts: Record<string, unknown>[]) => ({
  id: 'a1',
  role: 'assistant',
  parts,
})

describe('readMessagePlan', () => {
  test('resolves productIds against the streamed search output in the same message', () => {
    const view = readMessagePlan(
      message([
        {
          type: 'tool-call',
          name: 'search_channel3',
          state: 'output-available',
          output: { products: [searchResult, lampResult] },
        },
        { type: 'structured-output', status: 'complete', data: plan },
      ]),
      'furniture'
    )

    expect(view).not.toBeNull()
    expect(view?.complete).toBe(true)
    expect(view?.reply).toBe(plan.summary)
    expect(view?.board.products.map((p) => p.name)).toEqual([
      'Emerald Velvet Sofa',
      'Brass Arc Floor Lamp',
    ])
    expect(view?.board.products[0]?.price).toBe(1499)
    expect(view?.board.products[0]?.retailer).toBe('Maison Nord')
    expect(view?.board.products[0]?.slot).toBe('Emerald Velvet Sofa')
  })

  test('resolves productIds against persisted tool-call results too', () => {
    const view = readMessagePlan(
      message([
        {
          type: 'tool-call',
          toolName: 'search_channel3',
          args: { query: 'sofa' },
          result: { products: [searchResult] },
        },
        {
          type: 'structured-output',
          data: { ...plan, productIds: ['fallback-sofa-emerald-velvet'] },
        },
      ]),
      'furniture'
    )

    expect(view?.board.products).toHaveLength(1)
    expect(view?.board.products[0]?.name).toBe('Emerald Velvet Sofa')
  })

  test('skips ids that never appeared in a search result', () => {
    const view = readMessagePlan(
      message([
        { type: 'tool-call', name: 'search_channel3', output: { products: [searchResult] } },
        {
          type: 'structured-output',
          data: {
            ...plan,
            productIds: ['fallback-sofa-emerald-velvet', 'made-up-id'],
          },
        },
      ]),
      'furniture'
    )

    expect(view?.board.products).toHaveLength(1)
  })

  test('keeps plans that carry full products inline working', () => {
    const view = readMessagePlan(
      message([
        {
          type: 'structured-output',
          data: {
            reply: 'Here you go',
            products: [
              {
                slot: 'Sofa',
                name: 'Low linen sofa',
                retailer: 'Hale & Co',
                price: 749,
              },
            ],
          },
        },
      ]),
      'furniture'
    )

    expect(view?.reply).toBe('Here you go')
    expect(view?.board.products[0]?.slot).toBe('Sofa')
    expect(view?.board.products[0]?.price).toBe(749)
  })
})

describe('readLatestPlan', () => {
  test('finds the newest plan and seeds ids from earlier runs', () => {
    // Refinement run: the second plan reuses the sofa id from the first run's
    // search and only searches for the replacement lamp.
    const messages = [
      message([
        { type: 'tool-call', name: 'search_channel3', output: { products: [searchResult] } },
        {
          type: 'structured-output',
          data: { ...plan, productIds: ['fallback-sofa-emerald-velvet'] },
        },
      ]),
      { id: 'u1', role: 'user', parts: [{ type: 'text', content: 'swap the sofa' }] },
      message([
        {
          type: 'tool-call',
          name: 'search_channel3',
          state: 'output-available',
          output: { products: [lampResult] },
        },
        {
          type: 'structured-output',
          status: 'complete',
          data: {
            summary: 'Swapped the sofa for a lamp.',
            searchQuery: 'floor lamp',
            productIds: ['fallback-floor-lamp-brass-arc'],
          },
        },
      ]),
    ]

    const view = readLatestPlan(messages, 'furniture')
    expect(view?.messageId).toBe('a1') // both plan messages share the fixture id
    expect(view?.board.products.map((p) => p.name)).toEqual(['Brass Arc Floor Lamp'])
  })

  test('returns null without any plan', () => {
    expect(readLatestPlan([], 'furniture')).toBeNull()
    expect(
      readLatestPlan([{ id: 'u1', role: 'user', parts: [] }], 'furniture')
    ).toBeNull()
  })
})

describe('toViewMessages', () => {
  test('reports boardCount resolved through the message searches', () => {
    const views = toViewMessages(
      [
        { id: 'u0', role: 'user', parts: [{ type: 'text', text: 'a sofa and a lamp' }] },
        message([
          { type: 'tool-call', name: 'search_channel3', output: { products: [searchResult, lampResult] } },
          { type: 'structured-output', status: 'complete', data: plan },
        ]),
      ],
      { workedFor: {}, running: false, fallback: 'furniture' }
    )

    expect(views).toHaveLength(2)
    expect(views[1]?.boardCount).toBe(2)
  })
})
