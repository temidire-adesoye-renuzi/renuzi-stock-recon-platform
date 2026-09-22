import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Login } from './pages/Login';
import { DailySubmission } from './pages/DailySubmission';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { SkuMappingPage } from './pages/SkuMapping';

interface AppProps {
  /** Shows the submission lock countdown in its under-30-minutes red state. */
  lockUrgent?: boolean;
}

export function App({ lockUrgent = false }: AppProps) {
  return (
    <BrowserRouter>
      <div className="min-h-full w-full bg-canvas font-sans text-ink">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/submission" element={<DailySubmission lockUrgent={lockUrgent} />} />
            <Route path="/dashboard" element={<ExecutiveDashboard />} />
            <Route path="/admin" element={<SkuMappingPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>);

}