"use client"

import { 
  Sprout, 
  Upload, 
  Cpu, 
  CheckCircle, 
  Layers, 
  Database, 
  Leaf, 
  Bug,
  Zap,
  Globe,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Search
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-24 py-12 animate-in fade-in duration-700">
      
      {/* ── HERO SECTION ── */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-[#1a2e1d] tracking-tight">
          About Our Technology
        </h1>
        <p className="text-xl text-[#3a7d44] font-medium opacity-80">
          Transforming agriculture with intelligent AI solutions
        </p>
      </section>

      {/* ── MISSION SECTION ── */}
      <section className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-[#1a2e1d]">Our Mission</h2>
          <div className="space-y-4 text-slate-600 leading-relaxed text-lg">
            <p>
              Bhoomitra is committed to revolutionizing plant health management. 
              We empower farmers and agricultural professionals with instant, accurate disease detection to protect crops and increase yields.
            </p>
            <p>
              By bridging the gap between hardware and AI, we help prevent crop losses, reduce pesticide use, and promote sustainable farming practices globally.
            </p>
          </div>
        </div>
        <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden shadow-xl border-4 border-white">
          <img 
            src="https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=800" 
            alt="Smart Farming" 
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* ── HOW IT WORKS (3 STEPS) ── */}
      <section className="space-y-12">
        <h2 className="text-center text-3xl font-bold text-[#1a2e1d]">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 text-center">
          {[
            {
              step: "1",
              title: "Upload Image",
              desc: "Take a photo of a plant leaf or upload an existing image from your gallery.",
              icon: Upload,
            },
            {
              step: "2",
              title: "AI Analysis",
              desc: "Our MobileNetV2 model processes the image using deep learning algorithms.",
              icon: Cpu,
            },
            {
              step: "3",
              title: "Get Results",
              desc: "Receive instant diagnosis with plant type and condition identification.",
              icon: CheckCircle,
            }
          ].map((item, i) => (
            <div key={i} className="space-y-4 flex flex-col items-center">
              <div className="w-12 h-12 bg-[#10b981] text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                {item.step}
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm w-full h-full hover:shadow-md transition-shadow">
                <item.icon className="h-10 w-10 text-[#10b981] mx-auto mb-4" />
                <h3 className="font-bold text-[#1a2e1d] text-xl">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mt-2">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI MODEL SPECS ── */}
      <section className="bg-slate-50/50 p-12 rounded-[3rem] border border-slate-100 space-y-10">
        <h2 className="text-center text-3xl font-bold text-[#1a2e1d]">Our AI Model</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Architecture", val: "MobileNetV2 Transfer Learning", icon: Layers },
            { title: "Training Data", val: "50,000+ Labeled Plant Samples", icon: Database },
            { title: "Supported Plants", val: "Tomato, Potato, Corn, & more", icon: Leaf },
            { title: "Disease Coverage", val: "38+ Unique Conditions", icon: Bug }
          ].map((card, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center space-y-2">
              <h3 className="font-bold text-[#10b981] uppercase tracking-wider text-[10px]">{card.title}</h3>
              <p className="text-slate-700 font-semibold text-sm leading-tight">{card.val}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFITS SECTION ── */}
      <section className="space-y-12">
        <h2 className="text-3xl font-bold text-[#1a2e1d] text-center">Benefits</h2>
        <div className="grid md:grid-cols-4 gap-6">
           {[
             { title: "Early Detection", desc: "Identify diseases before they spread", icon: Sprout },
             { title: "Cost Effective", desc: "Reduce crop losses & treatment costs", icon: DollarSign },
             { title: "Sustainable", desc: "Minimize unnecessary pesticide use", icon: Globe },
             { title: "Fast & Accurate", desc: "Get results in seconds with high precision", icon: Zap }
           ].map((b, i) => (
             <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-50 flex flex-col items-center text-center space-y-4 hover:-translate-y-1 transition-transform">
                <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center">
                  <b.icon className="h-8 w-8 text-[#3a7d44]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1a2e1d]">{b.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mt-1">{b.desc}</p>
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section className="bg-white p-12 md:p-16 rounded-[3rem] shadow-xl shadow-green-900/5 border border-green-50 text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-[#1a2e1d]">Experience the Power of AI</h2>
          <p className="text-slate-600 max-w-xl mx-auto">Start detecting diseases in real-time and take control of your farm health.</p>
        </div>
        <Link href="/dashboard/detection" className="inline-block">
          <Button size="lg" className="bg-[#10b981] hover:bg-[#059669] text-white px-10 rounded-xl h-12 shadow-lg shadow-green-500/20">
            Start Detection
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* ── FOOTER STYLE INFO ── */}
      <footer className="pt-12 border-t border-slate-100 space-y-8">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            <h3 className="font-bold text-[#1a2e1d]">About the System</h3>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md">
              Our advanced AI platform utilizes state-of-the-art deep learning technology to accurately identify plant diseases in real-time. We help farmers make informed decisions about crop management.
            </p>
          </div>
          <div className="flex items-center md:justify-end gap-3 opacity-70">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Cpu size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Smart Bridge Hyderabad</p>
              <p className="text-xs text-slate-500">© 2026 Bhoomitra AI. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}



