"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/use-translation"
import { useNavigation } from "@/lib/navigation-context"
import {
    Home,
    SprayCan,
    Map,
    Microscope,
    BarChart3,
    Brain,
    Users,
    Info,
    History,
    LogOut,
    Shield,
} from "lucide-react"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const t = useTranslation()
    const { setIsLoading } = useNavigation()

    const navItems = [
        { name: t("nav.dashboard"), href: "/dashboard", icon: Home },
        { name: t("nav.autospray"), href: "/dashboard/autospray", icon: SprayCan },
        { name: t("nav.map"), href: "/dashboard/map", icon: Map },
        { name: t("nav.detection"), href: "/dashboard/detection", icon: Microscope },
        { name: t("nav.analytics"), href: "/dashboard/analytics", icon: BarChart3 },
        { name: t("nav.recommendations"), href: "/dashboard/recommendations", icon: Brain },
        { name: "Spread Control AI", href: "/dashboard/spread-control", icon: Shield },
        { name: "Activity", href: "/dashboard/history", icon: History },
        { name: "Users", href: "/dashboard/users", icon: Users },
        { name: "About", href: "/dashboard/about", icon: Info },
    ]

    useEffect(() => {
        const routesToPrefetch = [
            "/dashboard",
            "/dashboard/autospray",
            "/dashboard/map",
            "/dashboard/detection",
            "/dashboard/analytics",
            "/dashboard/recommendations",
            "/dashboard/spread-control",
            "/dashboard/history",
            "/dashboard/users",
            "/dashboard/about",
        ]

        routesToPrefetch.forEach((route) => router.prefetch(route))
    }, [router])

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" })
            toast.success("Logged out successfully")
            router.push("/login")
            router.refresh()
        } catch (error) {
            toast.error("Logout failed")
        }
    }

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-[#f4fbf6] via-[#eef9f2] to-[#e6f6ec]">

            {/* ===== SIDEBAR ===== */}
            <aside className="fixed left-0 top-0 h-screen w-20 hover:w-72 bg-white shadow-2xl border-r border-green-100 p-4 transition-all duration-500 ease-in-out z-50 group flex flex-col items-center hover:items-start overflow-hidden">

                <div className="mb-10 mt-4 flex items-center justify-center w-full group-hover:justify-start px-2">
                    <h1 className="text-2xl font-bold text-green-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Bhoomitra
                    </h1>
                    <div className="absolute font-bold text-2xl text-green-700 group-hover:hidden">
                        BT
                    </div>
                </div>

                <nav className="space-y-4 w-full flex-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                prefetch
                                onMouseEnter={() => router.prefetch(item.href)}
                                onClick={() => {
                                    if (pathname !== item.href) {
                                        setIsLoading(true)
                                    }
                                }}
                                className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 w-full ${isActive
                                        ? "bg-green-600 text-white shadow-lg"
                                        : "text-green-800 hover:bg-green-50"
                                    }`}
                            >
                                <div className="min-w-[1.25rem] flex items-center justify-center">
                                    <Icon size={22} />
                                </div>
                                <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
                                    {item.name}
                                </span>
                            </Link>
                        )
                    })}

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 px-4 py-3 rounded-2xl w-full transition-all duration-300 text-red-700 hover:bg-red-50 hover:shadow-md mt-auto"
                    >
                        <div className="min-w-[1.25rem] flex items-center justify-center">
                            <LogOut size={22} />
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
                            {t("nav.logout")}
                        </span>
                    </button>
                </nav>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 ml-20 p-10 min-h-screen">
                <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 min-h-full border border-green-50">
                    {children}
                </div>
            </main>

        </div>
    )
}