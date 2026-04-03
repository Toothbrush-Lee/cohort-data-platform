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

// 公开路由
const publicRoutes = ['/login', '/']

// 需要管理员权限的路由
const adminRoutes = ['/admin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 从 cookie 获取 token
  const token = request.cookies.get('token')?.value

  // 检查是否在保护路由中
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // 检查是否在管理员路由中
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))

  // 如果是保护路由且没有 token，重定向到登录页
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 如果是管理员路由，检查是否为管理员
  if (isAdminRoute && token) {
    // 这里无法验证 token 内容，需要前端页面自行验证
    // 可以在 cookie 中存储角色信息
  }

  // 如果已登录且在登录页，重定向到首页
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/subjects', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api (API routes)
     * - _next/static (静态文件)
     * - _next/image (优化图片)
     * - favicon.ico (网站图标)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
