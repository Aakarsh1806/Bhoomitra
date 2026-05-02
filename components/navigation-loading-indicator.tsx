"use client"

import { useNavigation } from "@/lib/navigation-context"

export default function NavigationLoadingIndicator() {
  const { isLoading } = useNavigation()

  if (!isLoading) return null

  return (
    <div className="fixed left-0 top-0 z-[220] h-1 w-full overflow-hidden bg-transparent">
      <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] rounded-r bg-green-500" />
      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  )
}
