export const MIN_PASSWORD_LENGTH = 8

// Mesma mensagem para qualquer resultado: não revela se o e-mail existe.
export const NEUTRAL_RESET_MESSAGE = 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.'

export const GENERIC_ERROR = 'Não foi possível concluir. Tente novamente.'

// Mensagens das RPCs de entrada (migração da TASK-010), por SQLSTATE.
const RPC_MESSAGES = {
  CX003: 'Você já está vinculado a uma empresa.',
  CX004: 'O nome da empresa deve ter entre 2 e 120 caracteres.',
  CX005: 'O domínio da empresa deve ser o mesmo do seu e-mail verificado.',
  CX006: 'Domínios de e-mail públicos não podem ser usados como domínio da empresa.',
  CX007: 'Este domínio já pertence a outra empresa.',
  CX008: 'Domínio em formato inválido.',
  CX009: 'Nenhuma empresa cadastrada para o domínio do seu e-mail.',
}

/** Mensagem em pt-BR para o erro de uma RPC de entrada; `action` distingue o CX002. */
export function onboardingErrorMessage(error, action) {
  if (error?.code === 'CX002') {
    return action === 'create'
      ? 'Confirme o seu e-mail antes de criar uma empresa.'
      : 'Confirme o seu e-mail antes de entrar em uma empresa.'
  }
  return RPC_MESSAGES[error?.code] ?? GENERIC_ERROR
}
