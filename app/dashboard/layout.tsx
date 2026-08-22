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
    UserCircle,
    Radar,
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
    const [pinned, setPinned] = useState(false)
    const [hovered, setHovered] = useState(false)
    const expanded = pinned || hovered

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
        { name: "Command Center", href: "/dashboard/spread-control", icon: Radar },
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
            <aside
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={`fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-emerald-100/80 bg-white/95 shadow-[8px_0_40px_-24px_rgba(16,185,129,0.5)] backdrop-blur transition-[width] duration-300 ease-out ${expanded ? "w-72" : "w-20"}`}
            >
                {/* Brand — the logo is an always-clickable menu toggle */}
                <div className="flex h-20 shrink-0 items-center gap-3 px-5">
                    <button
                        type="button"
                        onClick={() => setPinned((value) => !value)}
                        title={pinned ? "Collapse menu" : "Keep menu open"}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-strong text-sm font-black text-white shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)] transition hover:brightness-110"
                    >
                        BT
                    </button>
                    <span className={`flex-1 text-xl font-black tracking-tight text-[#14231a] transition-all duration-300 ${expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"} overflow-hidden whitespace-nowrap`}>Bhoomitra</span>
                </div>

                {/* Nav */}
                <nav className="scrollbar-thin scrollbar-thumb-emerald-100 min-h-0 w-full flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                prefetch
                                title={!expanded ? item.name : undefined}
                                onMouseEnter={() => router.prefetch(item.href)}
                                onClick={() => { if (pathname !== item.href) setIsLoading(true) }}
                                className={`group/nav relative flex items-center gap-4 rounded-2xl px-3.5 py-3 transition-all duration-200 ${isActive
                                    ? "bg-brand-strong text-white shadow-[0_0_22px_-6px_rgba(16,185,129,0.7)]"
                                    : "text-[#2c4633] hover:bg-emerald-50"
                                    }`}
                            >
                                {isActive && !expanded && <span className="absolute right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white" />}
                                <Icon size={22} className="shrink-0" />
                                <span className={`text-sm font-bold whitespace-nowrap transition-all duration-300 ${expanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"} overflow-hidden`}>{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Logout */}
                <div className="shrink-0 border-t border-emerald-50 px-3 py-4">
                    <button
                        onClick={handleLogout}
                        title={!expanded ? t("nav.logout") : undefined}
                        className="flex w-full items-center gap-4 rounded-2xl px-3.5 py-3 text-red-600 transition-all duration-200 hover:bg-red-50"
                    >
                        <LogOut size={22} className="shrink-0" />
                        <span className={`text-sm font-bold whitespace-nowrap transition-all duration-300 ${expanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"} overflow-hidden`}>{t("nav.logout")}</span>
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
