import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import AuthLayout from '@/components/cx/AuthLayout'
import Divider from '@/components/cx/Divider'
import FormMessage from '@/components/cx/FormMessage'
import GoogleButton from '@/components/cx/GoogleButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function loginErrorMessage(error) {
  if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message ?? '')) {
    return 'Confirme seu e-mail antes de entrar.'
  }
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) {
    return 'E-mail ou senha incorretos.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export default function Login() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    if (!supabase) {
      setError('Autenticação indisponível: configure o Supabase.')
      return
    }
    setPending(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    })
    setPending(false)
    // Com sucesso, o AuthProvider recebe a sessão e a rota pública redireciona.
    if (signInError) setError(loginErrorMessage(signInError))
  }

  return (
    <AuthLayout
      title="Entrar"
      description="Acesse o Protocolo CX com seu e-mail ou conta Google."
      footer={<>Ainda não tem conta? <Link className="font-medium text-primary hover:underline" to="/register">Criar conta</Link></>}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link className="text-sm text-primary hover:underline" to="/forgot-password">Esqueci minha senha</Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      <Divider />
      <GoogleButton onError={setError} />
    </AuthLayout>
  )
}
