import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AppShell } from './components/AppShell'
import { PersonalPage } from './pages/PersonalPage'
import { TeamPage } from './pages/TeamPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/personal" replace />} />
          <Route path="/personal" element={<PersonalPage />} />
          <Route path="/team" element={<TeamPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
