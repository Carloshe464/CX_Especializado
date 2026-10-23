import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useSession } from '@/auth/session'
import AuthLayout from '@/components/cx/AuthLayout'
import FormMessage from '@/components/cx/FormMessage'
import LoadingSpinner from '@/components/cx/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { MIN_PASSWORD_LENGTH } from '@/auth/messages'

export default function ResetPassword() {
  const { status, passwordRecovery, clearPasswordRecovery } = useSession()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== String(form.get('confirm'))) {
      setError('As senhas não conferem.')
      return
    }
    setPending(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (updateError) {
      setError(updateError.code === 'same_password'
        ? 'A nova senha deve ser diferente da anterior.'
        : 'Não foi possível redefinir a senha. Tente novamente.')
      return
    }
    clearPasswordRecovery?.()
    toast({ title: 'Senha redefinida com sucesso.' })
    navigate('/', { replace: true })
  }

  let content
  if (status === 'loading') {
    content = <LoadingSpinner label="Validando link…" />
  } else if (status !== 'signed_in' || !passwordRecovery || !supabase) {
    content = (
      <div className="space-y-4">
        <FormMessage>Link inválido ou expirado.</FormMessage>
        <Link className="text-sm font-medium text-primary hover:underline" to="/forgot-password">Solicitar novo link</Link>
      </div>
    )
  } else {
    content = (
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Salvando…' : 'Redefinir senha'}</Button>
      </form>
    )
  }

  return <AuthLayout title="Redefinir senha" description="Escolha uma nova senha para sua conta.">{content}</AuthLayout>
}
