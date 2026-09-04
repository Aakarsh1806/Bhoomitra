/**
 * Translation coverage check: every key in the English dictionary must exist in
 * all four other languages, with matching {placeholder} sets and no leakage of
 * one Indian script into another language's block.
 *
 * Run: node scripts/check-translations.mjs
 */
import { readFileSync } from "node:fs"

const SOURCE = "lib/translations.ts"
const LANGS = ["en", "hi", "mr", "ta", "te"]

const SCRIPTS = {
  devanagari: /[ऀ-ॿ]/,
  tamil: /[஀-௿]/,
  telugu: /[ఀ-౿]/,
}
const FOREIGN = {
  hi: ["tamil", "telugu"],
  mr: ["tamil", "telugu"],
  ta: ["devanagari", "telugu"],
  te: ["devanagari", "tamil"],
  en: [],
}

const lines = readFileSync(SOURCE, "utf8").split(/\r?\n/)

const blocks = {}
let current = null
for (const line of lines) {
  const start = line.match(/^ {2}(en|hi|mr|ta|te): \{$/)
  if (start) {
    current = start[1]
    blocks[current] = {}
    continue
  }
  if (current && line.trim() === "},") {
    current = null
    continue
  }
  if (!current) continue
  const entry = line.trim().match(/^"([^"]+)":\s*"(.*)",$/)
  if (entry) blocks[current][entry[1]] = entry[2]
}

const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",")

let failures = 0
const fail = (message) => {
  failures += 1
  console.error(`FAIL ${message}`)
}

for (const lang of LANGS) {
  if (!blocks[lang]) fail(`missing language block: ${lang}`)
}

const englishKeys = Object.keys(blocks.en ?? {})
console.log(`English keys: ${englishKeys.length}`)

for (const lang of LANGS.filter((l) => l !== "en")) {
  const dict = blocks[lang] ?? {}
  const missing = englishKeys.filter((key) => !(key in dict))
  if (missing.length) fail(`${lang}: ${missing.length} missing keys -> ${missing.join(", ")}`)

  const extra = Object.keys(dict).filter((key) => !englishKeys.includes(key))
  if (extra.length) fail(`${lang}: ${extra.length} keys not present in English -> ${extra.join(", ")}`)

  for (const key of englishKeys) {
    if (!(key in dict)) continue
    if (placeholders(blocks.en[key]) !== placeholders(dict[key])) {
      fail(`${lang}: interpolation mismatch on "${key}" (en="${blocks.en[key]}", ${lang}="${dict[key]}")`)
    }
    for (const script of FOREIGN[lang]) {
      if (SCRIPTS[script].test(dict[key])) fail(`${lang}: "${key}" contains ${script} characters -> ${dict[key]}`)
    }
  }
}

// Plural keys must come as complete one/other pairs in every language.
const pluralBases = new Set(
  englishKeys.filter((k) => k.endsWith(".one") || k.endsWith(".other")).map((k) => k.replace(/\.(one|other)$/, "")),
)
for (const base of pluralBases) {
  for (const lang of LANGS) {
    for (const form of ["one", "other"]) {
      if (!(`${base}.${form}` in (blocks[lang] ?? {}))) fail(`${lang}: missing plural form ${base}.${form}`)
    }
  }
}

if (failures) {
  console.error(`\n${failures} translation check failure(s)`)
  process.exit(1)
}
console.log("All translation checks passed.")
