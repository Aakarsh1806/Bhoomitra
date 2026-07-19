"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
    UserCircle,
} from "lucide-react"

type NavItem = {
    name: string
    href: string
    icon: any
    adminOnly?: boolean
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const t = useTranslation()
    const { setIsLoading } = useNavigation()
    const [role, setRole] = useState<string | null>(null)
    const [checked, setChecked] = useState(false)

    // Resolve the live account (role + block status). If the account was
    // blocked/removed while the session was open, bounce back to login.
    useEffect(() => {
        let active = true
        fetch("/api/auth/me")
            .then(async (res) => {
                const data = await res.json().catch(() => ({}))
                if (!active) return
                if (!res.ok || !data?.success) {
                    if (data?.blocked) {
                        toast.error(data.message || "Your access has been revoked.")
                    }
                    router.replace("/login")
                    return
                }
                setRole(data.user?.role ?? null)
                setChecked(true)
            })
            .catch(() => {
                if (active) setChecked(true)
            })
        return () => {
            active = false
        }
    }, [router])

    const allNavItems: NavItem[] = [
        { name: t("nav.dashboard"), href: "/dashboard", icon: Home },
        { name: t("nav.autospray"), href: "/dashboard/autospray", icon: SprayCan },
        { name: t("nav.map"), href: "/dashboard/map", icon: Map },
        { name: t("nav.detection"), href: "/dashboard/detection", icon: Microscope },
        { name: t("nav.analytics"), href: "/dashboard/analytics", icon: BarChart3 },
        { name: t("nav.recommendations"), href: "/dashboard/recommendations", icon: Brain },
        { name: "Spread Control AI", href: "/dashboard/spread-control", icon: Shield },
        { name: "Activity", href: "/dashboard/history", icon: History },
        { name: "User Management", href: "/dashboard/users", icon: Users, adminOnly: true },
        { name: "About", href: "/dashboard/about", icon: Info },
        { name: "My Account", href: "/dashboard/account", icon: UserCircle },
    ]

    const navItems = allNavItems.filter((item) => !item.adminOnly || role === "admin")

    useEffect(() => {
        allNavItems.forEach((item) => router.prefetch(item.href))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, role])

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
            <aside className="fixed left-0 top-0 h-screen w-20 hover:w-72 bg-white shadow-2xl border-r border-green-100 transition-all duration-500 ease-in-out z-50 group flex flex-col overflow-hidden">

                <div className="mb-6 mt-6 flex items-center justify-center w-full group-hover:justify-start px-6 shrink-0">
                    <h1 className="text-2xl font-bold text-green-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Bhoomitra
                    </h1>
                    <div className="absolute font-bold text-2xl text-green-700 group-hover:hidden">
                        BT
                    </div>
                </div>

                {/* Scrollable nav area — guarantees every item is reachable on any screen height */}
                <nav className="flex-1 min-h-0 overflow-y-auto space-y-2 w-full px-4 py-2 scrollbar-thin scrollbar-thumb-green-100">
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
                                className={`flex items-center justify-center group-hover:justify-start gap-0 group-hover:gap-4 px-0 group-hover:px-4 py-3 rounded-2xl transition-all duration-300 w-full ${isActive
                                        ? "bg-green-600 text-white shadow-lg"
                                        : "text-green-800 hover:bg-green-50"
                                    }`}
                            >
                                <div className="shrink-0 flex items-center justify-center">
                                    <Icon size={22} />
                                </div>
                                <span className="text-sm font-semibold whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[180px] opacity-0 group-hover:opacity-100 transition-all duration-300">
                                    {item.name}
                                </span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Logout pinned at the bottom, always visible */}
                <div className="shrink-0 px-4 py-4 border-t border-green-50">
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center group-hover:justify-start gap-0 group-hover:gap-4 px-0 group-hover:px-4 py-3 rounded-2xl w-full transition-all duration-300 text-red-700 hover:bg-red-50 hover:shadow-md"
                    >
                        <div className="shrink-0 flex items-center justify-center">
                            <LogOut size={22} />
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[180px] opacity-0 group-hover:opacity-100 transition-all duration-300">
                            {t("nav.logout")}
                        </span>
                    </button>
                </div>
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
