// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const root = css.match(/:root\s*\{([^}]+)\}/)[1]
const values = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]))
const expected = {
  "background": "40 30% 98%",
  "foreground": "20 15% 12%",
  "card": "0 0% 100%",
  "primary": "174 42% 21%",
  "primary-foreground": "40 30% 98%",
  "secondary": "40 25% 94%",
  "secondary-foreground": "174 42% 21%",
  "muted": "40 20% 95%",
  "muted-foreground": "25 8% 42%",
  "accent": "38 45% 92%",
  "accent-foreground": "30 25% 20%",
  "destructive": "8 70% 48%",
  "border": "40 18% 88%",
  "ring": "174 42% 21%",
  "radius": "0.75rem",
  "font-heading": "'Fraunces', Georgia, 'Times New Roman', serif",
  "font-body": "'Inter', ui-sans-serif, system-ui, sans-serif",
  "font-display": "'Fraunces', Georgia, serif",
  "input": "40 18% 88%",
  "card-foreground": "20 15% 12%",
  "popover": "0 0% 100%",
  "popover-foreground": "20 15% 12%",
  "destructive-foreground": "40 30% 98%",
  "chart-1": "174 42% 21%",
  "chart-2": "174 30% 40%",
  "chart-3": "38 70% 50%",
  "chart-4": "8 70% 48%",
  "chart-5": "200 60% 45%",
  "sidebar-background": "40 30% 98%",
  "sidebar-foreground": "20 15% 12%",
  "sidebar-primary": "174 42% 21%",
  "sidebar-primary-foreground": "40 30% 98%",
  "sidebar-accent": "38 45% 92%",
  "sidebar-accent-foreground": "30 25% 20%",
  "sidebar-border": "40 18% 88%",
  "sidebar-ring": "174 42% 21%"
}

describe('tokens exatos da TASK-001', () => {
  it.each(Object.entries(expected))('--%s preserva o valor documentado', (name, value) => {
    expect(values[name]).toBe(value)
  })

  it('marca os valores derivados e mantém somente o tema claro', () => {
    expect(root.match(/derivado — valor original não documentado/g)).toHaveLength(17)
    expect(css).not.toMatch(/\.dark\b/)
  })
})
