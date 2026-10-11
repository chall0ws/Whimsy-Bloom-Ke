import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { route } from './http'

function fakeRes() {
  const res = { headersSent: false, statusCode: 0, body: '', setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() }
  res.writeHead.mockImplementation((status: number) => (res.statusCode = status))
  res.end.mockImplementation((body: string) => (res.body = body))
  return res
}

describe('route errors', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  it('passes on what Paystack said when it refuses a payment', async () => {
    const res = fakeRes()
    await route(async () => {
      throw new Error('Paystack: Currency not supported by merchant')
    })({} as IncomingMessage, res as unknown as ServerResponse)
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body).error).toContain('Currency not supported by merchant')
  })

  it('keeps other errors generic', async () => {
    const res = fakeRes()
    await route(async () => {
      throw new Error('boom')
    })({} as IncomingMessage, res as unknown as ServerResponse)
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.body).error).toBe('Something went wrong on our side. Please try again.')
  })
})
