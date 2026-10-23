import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { queryClient } from '@/lib/query-client'
import { supabaseConfigError } from '@/lib/supabaseClient'
import AppShell from '@/components/cx/AppShell'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Survey from '@/pages/Survey'
import Dashboard from '@/pages/Dashboard'
import Evaluations from '@/pages/Evaluations'
import NewEvaluation from '@/pages/NewEvaluation'
import EvaluationDetail from '@/pages/EvaluationDetail'
import Curation from '@/pages/Curation'
import MyDevelopment from '@/pages/MyDevelopment'
import Satisfaction from '@/pages/Satisfaction'
import ProtocolPage from '@/pages/ProtocolPage'
import PageNotFound from '@/pages/PageNotFound'

export function AppRoutes() {
  // TODO(TASK-014): envolver com ProtectedRoute as rotas dentro de AppShell.
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pesquisa/:token" element={<Survey />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/avaliacoes" element={<Evaluations />} />
        <Route path="/nova-avaliacao" element={<NewEvaluation />} />
        <Route path="/avaliacao/:id" element={<EvaluationDetail />} />
        <Route path="/curadoria" element={<Curation />} />
        <Route path="/meu-desenvolvimento" element={<MyDevelopment />} />
        <Route path="/satisfacao" element={<Satisfaction />} />
        <Route path="/protocolo" element={<ProtocolPage />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {import.meta.env.DEV && supabaseConfigError && (
          <div role="status" className="bg-accent px-4 py-2 text-sm text-accent-foreground">
            {supabaseConfigError}
          </div>
        )}
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
