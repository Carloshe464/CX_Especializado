import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import AuthLayout from '@/components/cx/AuthLayout'
import FormMessage from '@/components/cx/FormMessage'
import LoadingSpinner from '@/components/cx/LoadingSpinner'

const TYPES = new Set(['email', 'recovery', 'email_change'])

async function confirm(search) {
  const params = new URLSearchParams(search)
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  if (!tokenHash || !TYPES.has(type) || !supabase) return null
  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    return error ? null : type
  } catch {
    return null
  }
}

export default function AuthConfirm() {
  const location = useLocation()
  const navigate = useNavigate()
  const attempt = useRef(null)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    let active = true
    // StrictMode refaz o efeito; a mesma promessa evita consumir o token duas vezes.
    attempt.current ??= confirm(location.search)
    attempt.current.then((type) => {
      if (!active) return
      if (type) {
        // verifyOtp emite PASSWORD_RECOVERY para recovery; AuthProvider libera o formulário.
        navigate(type === 'recovery' ? '/reset-password' : '/', { replace: true })
      } else {
        setInvalid(true)
        if (location.search || location.hash) navigate('/auth/confirm', { replace: true })
      }
    })
    return () => { active = false }
  }, [location.search, location.hash, navigate])

  return (
    <AuthLayout title="Confirmar acesso" description="Validação do link recebido por e-mail.">
      {invalid ? (
        <div className="space-y-4">
          <FormMessage>Link inválido ou expirado.</FormMessage>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-primary">
            <Link className="hover:underline" to="/login">Voltar para o login</Link>
            <Link className="hover:underline" to="/forgot-password">Solicitar novo link</Link>
          </div>
        </div>
      ) : <LoadingSpinner label="Validando link…" />}
    </AuthLayout>
  )
}
