"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Login successful!")
        router.push("/home")
        router.refresh()
      } else {
        toast.error(data.message || "Invalid email or password")
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/guest", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Welcome aboard as Guest!")
        router.push("/home")
        router.refresh()
      } else {
        toast.error("Guest login currently unavailable")
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-gradient-to-b from-white to-[#f5faf6] px-4 pt-20 overflow-hidden">
      <div className="w-full max-w-md transition-all duration-300 animate-fade-in-up">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/Bhoomitra-removebg-preview.png"
            alt="Bhoomitra"
            width={640}
            height={240}
            priority
            className="h-auto w-[330px] sm:w-[390px]"
          />
          <p className="mt-1 text-sm text-gray-500">Smart Agriculture Management</p>
        </div>

        <Card className="border-slate-200 shadow-lg shadow-slate-200/60 overflow-hidden bg-white rounded-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-[#1e3a23]">Login</CardTitle>
            <CardDescription className="text-[#5a7a60]">
              Enter your credentials to access the farm dashboard
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#1e3a23]">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a7a60] group-focus-within:text-[#3a7d44] transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@bhoomitra.ai"
                    className="pl-10 border-[#d4e9c8] focus-visible:ring-[#3a7d44]"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" title="password123" className="text-[#1e3a23]">Password</Label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a7a60] group-focus-within:text-[#3a7d44] transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10 border-[#d4e9c8] focus-visible:ring-[#3a7d44]"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button 
                type="submit" 
                className="w-full bg-[#3a7d44] hover:bg-[#1e3a23] text-white shadow-md shadow-green-900/10 transition-all duration-200 h-10"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Log in to Dashboard"
                )}
              </Button>
              
              <div className="flex items-center gap-2 w-full my-1">
                <div className="h-[1px] bg-slate-200 flex-1"></div>
                <span className="text-[10px] uppercase font-bold text-slate-400">or</span>
                <div className="h-[1px] bg-slate-200 flex-1"></div>
              </div>

              <Button 
                type="button" 
                variant="outline"
                onClick={handleGuestLogin}
                className="w-full border-green-200 text-[#3a7d44] hover:bg-green-50 h-10 transition-all font-semibold"
                disabled={loading}
              >
                Skip for now (Guest Mode)
              </Button>

              <p className="text-xs text-center text-[#5a7a60]">
                Access restricted to authorized personnel only.
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
