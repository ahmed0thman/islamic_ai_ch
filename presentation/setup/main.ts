// Fonts are bundled locally through @fontsource so the PDF export never
// depends on the network. IBM Plex Sans Arabic for text, Amiri for Quranic
// text, Noto Naskh Arabic for the name «هُدًى» (its marks sit tight on the word).
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@fontsource/amiri/400.css'
import '@fontsource/amiri/700.css'
import '@fontsource/noto-naskh-arabic/700.css'
import { defineAppSetup } from '@slidev/types'

export default defineAppSetup(() => {
  // Every slide layout also sets dir="rtl" on its own root (layouts/*.vue).
  // The document language is Arabic for correct shaping and hyphenation.
  if (typeof document !== 'undefined')
    document.documentElement.setAttribute('lang', 'ar')
})
