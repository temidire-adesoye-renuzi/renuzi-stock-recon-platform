import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ClipboardCheckIcon,
  GaugeIcon,
  LayersIcon,
  LogOutIcon,
  SettingsIcon } from
'lucide-react';

const navItems = [
{ to: '/submission', label: 'Daily Submission', Icon: ClipboardCheckIcon, role: 'Manager' },
{ to: '/dashboard', label: 'Executive Dashboard', Icon: GaugeIcon, role: 'Executive' },
{ to: '/admin', label: 'SKU Mapping', Icon: LayersIcon, role: 'Admin' }];


export function AppShell() {
  const location = useLocation();

  return (
    <div className="flex min-h-full w-full bg-canvas">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-brand">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-white">
            <span className="text-sm font-bold text-brand">R</span>
          </div>
          <span className="text-sm font-bold tracking-[0.14em] text-white">RENUZI RECON</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
          <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-white/45">
            Workspace
          </p>
          {navItems.map(({ to, label, Icon, role }) =>
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
            `group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
            isActive ?
            'bg-accent font-semibold text-white' :
            'font-medium text-white/70 hover:bg-white/10 hover:text-white'}`

            }>
            
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{label}</span>
              <span
              className={`text-2xs ${
              location.pathname === to ? 'text-white/80' : 'text-white/35'}`
              }>
              
                {role}
              </span>
            </NavLink>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-2xs font-semibold text-white">
              AO
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">Adaeze Okafor</p>
              <p className="truncate text-2xs text-white/50">Lekki Warehouse</p>
            </div>
            <NavLink
              to="/"
              aria-label="Sign out"
              className="rounded p-1 text-white/50 transition-colors duration-150 ease-out hover:bg-white/10 hover:text-white">
              
              <LogOutIcon className="h-4 w-4" aria-hidden="true" />
            </NavLink>
          </div>
          <div className="mt-1 flex items-center gap-2 px-2.5 text-2xs text-white/35">
            <SettingsIcon className="h-3 w-3" aria-hidden="true" />
            v2.4.1 · Sync 12:04 PM
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>);

}