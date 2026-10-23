import { useState } from 'react'
import { Building2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useSession } from '@/auth/session'
import { GENERIC_ERROR, onboardingErrorMessage } from '@/auth/messages'
import AuthLayout from '@/components/cx/AuthLayout'
import Divider from '@/components/cx/Divider'
import FormMessage from '@/components/cx/FormMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// A RPC decide tudo (e-mail verificado, domínio, papel); a tela só mostra o resultado.
export default function Onboarding() {
  const { user, refresh, onSignOut } = useSession()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)

  async function run(action, rpc, params) {
    setError('')
    if (!supabase) {
      setError(GENERIC_ERROR)
      return
    }
    setPending(action)
    const { error: rpcError } = await supabase.rpc(rpc, params)
    if (rpcError) {
      setPending(null)
      setError(onboardingErrorMessage(rpcError, action))
      return
    }
    await refresh()
    setPending(null)
    navigate('/', { replace: true })
  }

  function handleCreate(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    run('create', 'create_organization', {
      p_name: String(form.get('name')).trim(),
      p_domain: String(form.get('domain')).trim() || null,
    })
  }

  return (
    <AuthLayout
      title="Entrar na empresa"
      description={user?.email ? `Conectado como ${user.email}.` : undefined}
      footer={(
        <Button variant="ghost" className="gap-2" onClick={onSignOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />Sair
        </Button>
      )}
    >
      <p className="text-sm text-muted-foreground">
        Se a sua empresa já usa o Protocolo CX, entre com o domínio do seu e-mail. Você começa como analista.
      </p>
      <Button className="mt-4 w-full gap-2" disabled={pending !== null} onClick={() => run('join', 'join_organization_by_domain')}>
        <Building2 className="h-4 w-4" aria-hidden="true" />
        {pending === 'join' ? 'Entrando…' : 'Entrar na empresa do meu e-mail'}
      </Button>
      <div className="mt-4"><FormMessage>{error}</FormMessage></div>
      <Divider />
      <section aria-labelledby="criar-empresa">
        <h2 id="criar-empresa" className="font-heading text-lg font-semibold">Criar uma empresa</h2>
        <p className="mt-1 text-sm text-muted-foreground">Quem cria a empresa vira supervisor. O domínio é opcional e deve ser o do seu e-mail.</p>
        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome da empresa</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domínio (opcional)</Label>
            <Input id="domain" name="domain" placeholder="suaempresa.com.br" autoComplete="off" />
          </div>
          <Button type="submit" variant="outline" className="w-full" disabled={pending !== null}>
            {pending === 'create' ? 'Criando…' : 'Criar empresa'}
          </Button>
        </form>
      </section>
    </AuthLayout>
  )
}
