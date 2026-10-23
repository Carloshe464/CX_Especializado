import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import AuthLayout from '@/components/cx/AuthLayout'
import FormMessage from '@/components/cx/FormMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NEUTRAL_RESET_MESSAGE } from '@/auth/messages'

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email')).trim()
    setPending(true)
    try {
      await supabase?.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    } catch {
      // Ignorado de propósito: a resposta é sempre neutra.
    }
    setPending(false)
    setSent(true)
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      description="Informe seu e-mail para receber o link de redefinição."
      footer={<Link className="font-medium text-primary hover:underline" to="/login">Voltar para o login</Link>}
    >
      {sent ? (
        <FormMessage tone="success">{NEUTRAL_RESET_MESSAGE}</FormMessage>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Enviando…' : 'Enviar link'}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
