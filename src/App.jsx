import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { queryClient } from '@/lib/query-client'
import { supabaseConfigError } from '@/lib/supabaseClient'
import { AuthProvider } from '@/auth/AuthProvider'
import ProtectedRoute from '@/auth/ProtectedRoute'
import PublicOnlyRoute from '@/auth/PublicOnlyRoute'
import RequireRole from '@/auth/RequireRole'
import Layout from '@/components/cx/Layout'
import LoadingSpinner from '@/components/cx/LoadingSpinner'
import ScrollToTop from '@/components/ScrollToTop'
import { Toaster } from '@/components/ui/toaster'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import AuthConfirm from '@/pages/AuthConfirm'
import Onboarding from '@/pages/Onboarding'
import PageNotFound from '@/pages/PageNotFound'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Evaluations = lazy(() => import('@/pages/Evaluations'))
const NewEvaluation = lazy(() => import('@/pages/NewEvaluation'))
const EvaluationDetail = lazy(() => import('@/pages/EvaluationDetail'))
const Curation = lazy(() => import('@/pages/Curation'))
const MyDevelopment = lazy(() => import('@/pages/MyDevelopment'))
const Satisfaction = lazy(() => import('@/pages/Satisfaction'))
const ProtocolPage = lazy(() => import('@/pages/ProtocolPage'))
const Survey = lazy(() => import('@/pages/Survey'))

const MANAGERS = ['supervisor', 'platform_admin']

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner label="Carregando…" /></div>}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        {/* Fica fora de PublicOnlyRoute: o link de recuperação cria uma sessão. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/pesquisa/:token" element={<Survey />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<Layout />}>
            <Route path="/" element={<RequireRole deny={['analista']} redirectTo="/meu-desenvolvimento"><Dashboard /></RequireRole>} />
            <Route path="/avaliacoes" element={<Evaluations />} />
            <Route path="/nova-avaliacao" element={<NewEvaluation />} />
            <Route path="/avaliacao/:id" element={<EvaluationDetail />} />
            <Route path="/curadoria" element={<RequireRole allow={MANAGERS} redirectTo="/"><Curation /></RequireRole>} />
            <Route path="/meu-desenvolvimento" element={<MyDevelopment />} />
            <Route path="/satisfacao" element={<RequireRole allow={MANAGERS} redirectTo="/"><Satisfaction /></RequireRole>} />
            <Route path="/protocolo" element={<ProtocolPage />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  )
}

// AuthProvider fica dentro do roteador para que "Sair" possa navegar para /login.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          {import.meta.env.DEV && supabaseConfigError && (
            <div role="status" className="bg-accent px-4 py-2 text-sm text-accent-foreground">
              {supabaseConfigError}
            </div>
          )}
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
