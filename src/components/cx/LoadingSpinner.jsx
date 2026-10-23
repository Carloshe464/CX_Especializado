export default function LoadingSpinner({ label = 'Carregando…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3">
      <span aria-hidden="true" className="h-8 w-8 rounded-full border-4 border-secondary border-t-primary animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
