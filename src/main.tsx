import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { applyTheme, DEFAULT_THEME, getTheme } from './lib/themes'
import App from './App'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true } } })
applyTheme(getTheme(DEFAULT_THEME))
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><AuthProvider><ThemeProvider><HashRouter><App /></HashRouter></ThemeProvider></AuthProvider></QueryClientProvider></React.StrictMode>,
)
