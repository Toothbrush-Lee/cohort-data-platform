import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 需要认证的路由
const protectedRoutes = [
  '/subjects',
  '/visits',
  '/upload',
  '/review',
  '/data',
  '/export',
  '/enter',
  '/help',
  '/admin',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 从 cookie 获取 token
  const token = request.cookies.get('token')?.value

  // 检查是否在保护路由中
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // 如果是保护路由且没有 token，重定向到登录页
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // 匹配所有路径，除了：
    // - api (API routes)
    // - _next/static (静态文件)
    // - _next/image (优化图片)
    // - favicon.ico (网站图标)
    // - public 目录
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
