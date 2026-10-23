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
import { MIN_PASSWORD_LENGTH } from '@/auth/messages'

export default function Register() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
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
    if (!supabase) {
      setError('Autenticação indisponível: configure o Supabase.')
      return
    }
    setPending(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email: String(form.get('email')).trim(),
      password,
      options: {
        data: { full_name: String(form.get('fullName')).trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    setPending(false)
    if (signUpError) {
      setError(signUpError.code === 'weak_password'
        ? 'A senha não atende aos requisitos de segurança.'
        : 'Não foi possível criar a conta. Tente novamente.')
      return
    }
    setDone(true)
  }

  return (
    <AuthLayout
      title="Criar conta"
      description="Cadastre-se para acessar o Protocolo CX."
      footer={<>Já tem conta? <Link className="font-medium text-primary hover:underline" to="/login">Entrar</Link></>}
    >
      {done ? (
        <FormMessage tone="success">Enviamos um link de confirmação para o seu e-mail.</FormMessage>
      ) : (
        <>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </div>
            <FormMessage>{error}</FormMessage>
            <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Criando conta…' : 'Criar conta'}</Button>
          </form>
          <Divider />
          <GoogleButton onError={setError} />
        </>
      )}
    </AuthLayout>
  )
}
