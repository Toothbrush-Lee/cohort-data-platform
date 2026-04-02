'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    authApi.logout()
    router.push('/')
    toast.success('已退出登录')
  }

  // 主导航显示核心页面
  const navItems = [
    { href: '/subjects', label: '受试者' },
    { href: '/visits', label: '随访' },
    { href: '/enter', label: '录入与审核' },
    { href: '/data', label: '已录入数据' },
    { href: '/export', label: '导出' },
  ]

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          队列研究多模态数据中台
        </Link>
        <nav className="flex items-center gap-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm ${
                pathname === item.href
                  ? 'text-gray-900 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/help">
            <Button variant="outline" size="sm">📖 帮助</Button>
          </Link>
          <Button variant="outline" onClick={handleLogout}>退出</Button>
        </nav>
      </div>
    </header>
  )
}
