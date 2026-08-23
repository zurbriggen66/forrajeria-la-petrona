import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Statusbar } from './Statusbar'

export function ShellLayout() {
  return (
    <div className="flex h-svh bg-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <Statusbar />
      </div>
    </div>
  )
}
