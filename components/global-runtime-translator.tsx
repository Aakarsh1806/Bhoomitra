"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/language-context"
import { getRuntimePhraseMap } from "@/lib/runtime-phrase-map"

const originalTextNodes = new WeakMap<Text, string>()

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function applyReplacements(input: string, map: Record<string, string>) {
  if (!input || Object.keys(map).length === 0) return input

  const phrases = Object.keys(map).sort((a, b) => b.length - a.length)
  let output = input

  for (const phrase of phrases) {
    const translated = map[phrase]
    const regex = new RegExp(escapeRegExp(phrase), "g")
    output = output.replace(regex, translated)
  }

  return output
}

function shouldSkipTextNode(node: Text) {
  const parent = node.parentElement
  if (!parent) return true
  const tag = parent.tagName.toLowerCase()
  if (["script", "style", "noscript", "textarea", "input", "code", "pre"].includes(tag)) return true
  if (parent.closest("[data-no-runtime-translate='true']")) return true
  return false
}

export default function GlobalRuntimeTranslator() {
  const { language } = useLanguage()

  useEffect(() => {
    const map = getRuntimePhraseMap(language)

    const translateNodeText = (node: Text) => {
      if (shouldSkipTextNode(node)) return

      if (!originalTextNodes.has(node)) {
        originalTextNodes.set(node, node.nodeValue || "")
      }

      const baseline = originalTextNodes.get(node) || ""
      const nextValue = language === "en" ? baseline : applyReplacements(baseline, map)
      if (node.nodeValue !== nextValue) {
        node.nodeValue = nextValue
      }
    }

    const walkAndTranslate = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let current: Node | null = walker.nextNode()
      while (current) {
        translateNodeText(current as Text)
        current = walker.nextNode()
      }
    }

    walkAndTranslate(document.body)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateNodeText(node as Text)
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walkAndTranslate(node)
          }
        })
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [language])

  return null
}
