"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Loader2, Phone, ShieldCheck, User, ArrowLeft } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Email + password (existing accounts)
  const [formData, setFormData] = useState({ email: "", password: "" })

  // Phone signup / sign-in
  const [phoneStep, setPhoneStep] = useState<"enter" | "verify">("enter")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [demoOtp, setDemoOtp] = useState<string | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)

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
      const response = await fetch("/api/auth/guest", { method: "POST" })
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name }),
      })

      const data = await response.json()

      if (data.success) {
        setDemoOtp(data.demoOtp)
        setIsNewUser(Boolean(data.isNewUser))
        setPhoneStep("verify")
        toast.success(data.message || "OTP sent")
      } else {
        toast.error(data.message || "Could not send OTP")
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.isNewUser ? "Account created — welcome!" : "Login successful!")
        router.push("/home")
        router.refresh()
      } else {
        toast.error(data.message || "Verification failed")
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resetPhoneFlow = () => {
    setPhoneStep("enter")
    setOtp("")
    setDemoOtp(null)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-gradient-to-b from-white to-[#f5faf6] px-4 pt-16 pb-10 overflow-hidden">
      <div className="w-full max-w-md transition-all duration-300 animate-fade-in-up">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/Bhoomitra-removebg-preview.png"
            alt="Bhoomitra"
            width={640}
            height={240}
            priority
            className="h-auto w-[300px] sm:w-[350px]"
          />
          <p className="mt-1 text-sm text-gray-500">Smart Agriculture Management</p>
        </div>

        <Card className="border-slate-200 shadow-lg shadow-slate-200/60 overflow-hidden bg-white rounded-2xl">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-2xl text-[#1e3a23]">Welcome</CardTitle>
            <CardDescription className="text-[#5a7a60]">
              Sign in to your account or create one with your phone number
            </CardDescription>
          </CardHeader>

          <Tabs defaultValue="phone" className="w-full">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2 bg-green-50/60">
                <TabsTrigger value="phone" className="data-[state=active]:bg-white data-[state=active]:text-[#1e3a23]">
                  Phone
                </TabsTrigger>
                <TabsTrigger value="email" className="data-[state=active]:bg-white data-[state=active]:text-[#1e3a23]">
                  Email
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ---------------- PHONE TAB (signup + sign-in) ---------------- */}
            <TabsContent value="phone" className="mt-0">
              {phoneStep === "enter" ? (
                <form onSubmit={handleSendOtp}>
                  <CardContent className="space-y-4 pt-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[#1e3a23]">Full Name</Label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a7a60] group-focus-within:text-[#3a7d44] transition-colors" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="Required for new accounts"
                          className="pl-10 border-[#d4e9c8] focus-visible:ring-[#3a7d44]"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-[#1e3a23]">Mobile Number</Label>
                      <div className="relative group">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a7a60] group-focus-within:text-[#3a7d44] transition-colors" />
                        <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-[#5a7a60]">+91</span>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="98765 43210"
                          className="pl-[4.5rem] border-[#d4e9c8] focus-visible:ring-[#3a7d44]"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
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
                          Sending OTP...
                        </>
                      ) : (
                        "Send OTP"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <CardContent className="space-y-4 pt-5">
                    <button
                      type="button"
                      onClick={resetPhoneFlow}
                      className="flex items-center gap-1 text-xs font-semibold text-[#5a7a60] hover:text-[#3a7d44] transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" /> Change number
                    </button>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Demo Mode — No SMS Sent</p>
                      <p className="text-sm text-amber-900">
                        Your OTP is <span className="font-mono font-black text-base">{demoOtp}</span>
                      </p>
                      <p className="text-[11px] text-amber-700">
                        In production this code would be delivered by SMS to +91 {phone}.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-[#1e3a23]">Enter OTP</Label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a7a60] group-focus-within:text-[#3a7d44] transition-colors" />
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          className="pl-10 border-[#d4e9c8] focus-visible:ring-[#3a7d44] tracking-widest font-mono"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
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
                          Verifying...
                        </>
                      ) : isNewUser ? (
                        "Verify & Create Account"
                      ) : (
                        "Verify & Continue"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              )}
            </TabsContent>

            {/* ---------------- EMAIL TAB (existing accounts) ---------------- */}
            <TabsContent value="email" className="mt-0">
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-5">
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
                    <Label htmlFor="password" className="text-[#1e3a23]">Password</Label>
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
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>

          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center gap-2 w-full">
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
              Your account details are stored securely and used only within Bhoomitra.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
