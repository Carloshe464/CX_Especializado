import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/toaster'
import { toast, useToast } from '@/components/ui/use-toast'

afterEach(() => vi.restoreAllMocks())

it('Input, Textarea e Label preservam associação acessível e edição', async () => {
  render(<><Label htmlFor="protocolo">Protocolo</Label><Input id="protocolo" />
    <Label htmlFor="texto">Transcrição</Label><Textarea id="texto" /></>)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Protocolo'), 'TESTE-123')
  await user.type(screen.getByLabelText('Transcrição'), 'Texto sintético')
  expect(screen.getByLabelText('Protocolo')).toHaveValue('TESTE-123')
  expect(screen.getByLabelText('Transcrição')).toHaveValue('Texto sintético')
})

it('Tabs alterna o painel por teclado', async () => {
  render(<Tabs defaultValue="texto"><TabsList aria-label="Origem">
    <TabsTrigger value="texto">Texto</TabsTrigger><TabsTrigger value="prints">Prints</TabsTrigger>
  </TabsList><TabsContent value="texto">Entrada textual</TabsContent><TabsContent value="prints">Entrada de imagens</TabsContent></Tabs>)
  screen.getByRole('tab', { name: 'Texto' }).focus()
  await userEvent.setup().keyboard('[ArrowRight]')
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Prints' })).toHaveAttribute('aria-selected', 'true'))
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Entrada de imagens')
})

it('Select expõe combobox e permite escolher por teclado', async () => {
  const onValueChange = vi.fn()
  // jsdom não implementa rolagem de elementos; o navegador é verificado separadamente.
  const previous = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = vi.fn()
  try {
    render(<Select onValueChange={onValueChange}><SelectTrigger aria-label="Canal"><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent><SelectItem value="chat">Chat</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent></Select>)
    const trigger = screen.getByRole('combobox', { name: 'Canal' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const option = await screen.findByRole('option', { name: 'Chat' })
    option.focus()
    await userEvent.setup().keyboard('[Enter]')
    expect(onValueChange).toHaveBeenCalledWith('chat')
    expect(trigger).toHaveTextContent('Chat')
  } finally {
    if (previous) HTMLElement.prototype.scrollIntoView = previous
    else delete HTMLElement.prototype.scrollIntoView
  }
})

it('Dialog abre acessível, fecha por Escape e devolve o foco ao gatilho', async () => {
  render(<Dialog><DialogTrigger>Abrir detalhes</DialogTrigger><DialogContent>
    <DialogTitle>Avaliação sintética</DialogTitle><DialogDescription>Descrição de teste</DialogDescription>
  </DialogContent></Dialog>)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
  expect(screen.getByRole('dialog', { name: 'Avaliação sintética' })).toHaveAccessibleDescription('Descrição de teste')
  expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  await user.keyboard('[Escape]')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Abrir detalhes' })).toHaveFocus()
})

function ToastProbe() {
  const { dismiss } = useToast()
  return <button onClick={() => dismiss()}>Limpar notificações</button>
}

it('Toaster e useToast criam, atualizam e dispensam uma notificação', async () => {
  render(<><Toaster /><ToastProbe /></>)
  let handle
  act(() => { handle = toast({ title: 'Operação de teste', description: 'Mensagem sintética' }) })
  expect(await screen.findByText('Operação de teste')).toBeInTheDocument()
  act(() => handle.update({ title: 'Operação atualizada' }))
  expect(screen.getByText('Operação atualizada')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Fechar notificação' })).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Limpar notificações' }))
  await waitFor(() => expect(screen.queryByText('Operação atualizada')).not.toBeInTheDocument())
})
