import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const dashboardUnlocked = request.cookies.get('dashboard_unlocked')?.value === '1'
  const { pathname } = request.nextUrl

  // Root route is strictly the login entry point.
  if (pathname === '/') {
    const url = new URL('/login', request.url)
    return NextResponse.redirect(url)
  }

  // Home landing page is available only after auth.
  if (pathname === '/home') {
    if (!token) {
      const url = new URL('/login', request.url)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // Protected routes - any route starting with /dashboard
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      // Redirect to login if no token
      const url = new URL('/login', request.url)
      return NextResponse.redirect(url)
    }

    if (!dashboardUnlocked) {
      // Dashboard access must begin from the landing page action.
      const url = new URL('/home', request.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/', '/home'],
}
