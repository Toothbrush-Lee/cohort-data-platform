'use client'

import { Suspense } from 'react'

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>{children}</Suspense>
}
