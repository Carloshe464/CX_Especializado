export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      {Icon && <Icon className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
