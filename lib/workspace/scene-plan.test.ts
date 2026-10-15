import { describe, expect, test } from 'bun:test'

import type { SceneLayout } from '@/lib/scene/contract'
import { readLatestSceneLayout, readMessageSceneLayout } from './scene-plan'

const layout: SceneLayout = {
  room: {
    type: 'living-room',
    label: 'Living room',
    width: 5.4,
    depth: 4.6,
    height: 2.7,
    windowWall: 'north',
  },
  items: [
    {
      productId: 'p1',
      role: 'seating',
      position: { x: 0, y: 0, z: -1.5 },
      rotationY: Math.PI,
      footprint: { width: 2.1, depth: 0.9, height: 0.8 },
    },
  ],
}

const toolPart = (part: Record<string, unknown>) => ({
  id: 'm1',
  role: 'assistant',
  parts: [part],
})

describe('readLatestSceneLayout', () => {
  test('returns null for empty or non-assistant messages', () => {
    expect(readLatestSceneLayout([])).toBeNull()
    expect(readLatestSceneLayout([{ id: 'u1', role: 'user', parts: [] }])).toBeNull()
  })

  test('reads output.layout from a finished tool call', () => {
    const messages = [
      toolPart({ type: 'tool-call', name: 'build_scene_layout', state: 'output-complete', output: { layout } }),
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('reads a bare layout output (no layout wrapper)', () => {
    const messages = [
      toolPart({ type: 'tool-call', name: 'build_scene_layout', state: 'output-complete', output: layout }),
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('accepts parts without a state field (persisted history)', () => {
    const messages = [
      toolPart({ type: 'tool-call', name: 'build_scene_layout', result: { layout } }),
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('skips in-flight and non-terminal states', () => {
    for (const state of ['input-streaming', 'output-streaming', 'awaiting-input', 'approval-requested']) {
      const messages = [
        toolPart({ type: 'tool-call', name: 'build_scene_layout', state, output: { layout } }),
      ]
      expect(readLatestSceneLayout(messages)).toBeNull()
    }
  })

  test('reads a live terminal part (state: complete) with direct output', () => {
    const messages = [
      toolPart({ type: 'tool-call', name: 'build_scene_layout', state: 'complete', output: { layout } }),
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('input-complete without output has no layout (persisted call awaits its result part)', () => {
    const messages = [
      toolPart({
        type: 'tool-call',
        id: 'c1',
        name: 'build_scene_layout',
        state: 'input-complete',
        input: { productIds: ['p1'] },
      }),
    ]
    expect(readLatestSceneLayout(messages)).toBeNull()
  })

  test('pairs a persisted tool result across messages (reconstructed history)', () => {
    const messages = [
      toolPart({
        type: 'tool-call',
        id: 'c1',
        name: 'build_scene_layout',
        state: 'input-complete',
        input: { productIds: ['p1'] },
      }),
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-result',
            toolCallId: 'c1',
            content: JSON.stringify({ layout }),
            state: 'complete',
          },
        ],
      },
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('pairs a tool result whose content is content parts (live result part)', () => {
    const messages = [
      toolPart({ type: 'tool-call', id: 'c1', name: 'build_scene_layout', state: 'input-complete' }),
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-result',
            toolCallId: 'c1',
            content: [{ type: 'text', content: JSON.stringify({ layout }) }],
            state: 'complete',
          },
        ],
      },
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('pairs a result part within the same message', () => {
    const messages = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          { type: 'tool-call', id: 'c1', name: 'build_scene_layout', state: 'complete', output: { layout } },
          { type: 'tool-result', toolCallId: 'c1', content: JSON.stringify({ layout }), state: 'complete' },
        ],
      },
    ]
    expect(readLatestSceneLayout(messages)).toEqual(layout)
  })

  test('skips other tools and malformed layouts', () => {
    const messages = [
      toolPart({ type: 'tool-call', name: 'search_channel3', state: 'output-complete', output: { products: [] } }),
      toolPart({ type: 'tool-call', name: 'build_scene_layout', state: 'output-complete', output: { layout: { nope: true } } }),
    ]
    expect(readLatestSceneLayout(messages)).toBeNull()
  })

  test('the newest layout wins', () => {
    const newest = { ...layout, items: [] }
    const messages = [
      toolPart({ type: 'tool-call', name: 'build_scene_layout', state: 'output-complete', output: { layout } }),
      toolPart({ type: 'tool-call', name: 'build_scene_layout', state: 'output-complete', output: { layout: newest } }),
    ]
    expect(readLatestSceneLayout(messages)).toEqual(newest)
  })

  test('readMessageSceneLayout ignores user messages', () => {
    expect(
      readMessageSceneLayout({ id: 'u1', role: 'user', parts: [{ type: 'tool-call', name: 'build_scene_layout', output: { layout } }] })
    ).toBeNull()
  })
})
