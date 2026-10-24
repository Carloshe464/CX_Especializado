// Região viva para avisos de formulário; fica no DOM mesmo vazia para ser anunciada.
export default function FormMessage({ tone = 'error', children }) {
  return (
    <p aria-live="polite" className={tone === 'error'
      ? 'min-h-5 text-sm text-destructive'
      : 'min-h-5 text-sm text-emerald-700'}>
      {children}
    </p>
  )
}
