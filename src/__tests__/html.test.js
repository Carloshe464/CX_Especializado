// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

it('preserva idioma, título, fontes e entrada da aplicação', () => {
  expect(html).toContain('lang="pt-BR"')
  expect(html).toContain('<title>Protocolo de Inteligência CX</title>')
  expect(html).toContain('family=Fraunces:wght@400;500;600')
  expect(html).toContain('family=Inter:wght@400;500;600')
  expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"')
  expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin')
  expect(html).toContain('href="/manifest.json"')
  expect(html).toContain('id="root"')
  expect(html).toContain('type="module" src="/src/main.jsx"')
})

