// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assertLocalTarget } from '../../scripts/seed-local.mjs'

describe('guarda do seed local', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321'])('aceita %s', (url) => {
    expect(assertLocalTarget(url, 'chave-ficticia-de-teste')).toBe(url)
  })

  it.each([
    'https://xxx.supabase.co', 'http://8.8.8.8:54321', 'http://192.168.1.10:54321',
    'http://localhost.exemplo.com', 'http://localhost@exemplo.com',
    'http://[::1]:54321', 'file:///localhost', 'não é uma URL', '',
    'http://usuario:senha@localhost:54321', 'http://localhost:54321/proxy',
    'http://localhost:54321?destino=remoto',
  ])('recusa destino %s', (url) => {
    expect(() => assertLocalTarget(url, 'chave-ficticia-de-teste')).toThrow()
  })

  it.each([undefined, null, '', '   '])('recusa chave ausente (%s)', (key) => {
    expect(() => assertLocalTarget('http://127.0.0.1:54321', key)).toThrow('SUPABASE_SECRET_KEY')
  })
})
