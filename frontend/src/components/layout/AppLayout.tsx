import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { PageTransition } from '@/components/layout/PageTransition'

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="print:hidden">
        <AppSidebar />
      </div>
      <SidebarInset className="print:m-0">
        <div className="flex min-h-svh flex-col">
          <div className="print:hidden">
            <Navbar />
          </div>
          <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>
          <div className="print:hidden">
            <Footer />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
