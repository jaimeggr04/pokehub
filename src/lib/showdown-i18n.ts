/**
 * Traducción de equipos pegados en español.
 *
 * El índice (`pokemon-es.json`) sale de los CSV oficiales de PokeAPI, así que
 * cubre los nombres oficiales del juego. Pero mucha gente pega equipos pasados
 * por un traductor automático ("Magic Guard" -> "Guardia Mágica" cuando el
 * oficial es "Muro Mágico"), y eso no lo cubre ningún diccionario. Por eso, si
 * la búsqueda exacta falla, se recurre a una comparación aproximada contra el
 * conjunto de candidatos reales: para habilidades son 2-3 por especie y para
 * movimientos el learnset, así que acierta con mucha fiabilidad.
 */

export interface EsIndex {
  moves: Record<string, string>
  abilities: Record<string, string>
  items: Record<string, string>
  species: Record<string, string>
  natures: Record<string, string>
}

export type EsCategory = keyof EsIndex

let cached: EsIndex | null = null

/** Carga diferida: son ~100 KB que sólo hacen falta al importar de Showdown. */
export async function loadEsIndex(): Promise<EsIndex> {
  if (cached) return cached
  const mod = await import('@/lib/pokemon-es.json')
  cached = (mod.default ?? mod) as unknown as EsIndex
  return cached
}

/**
 * Naturalezas escritas de otra forma. Las oficiales van todas en femenino
 * ("Miedosa", "Pícara", "Osada"), así que aquí entran las variantes en
 * masculino y las traducciones literales del inglés, que son las que aparecen
 * en los equipos pasados por un traductor.
 *
 * Caso especial: la oficial "Tímida" es *bashful*, pero quien escribe "Tímido"
 * en masculino viene del inglés "Timid". Se mapea a `timid` a propósito; la
 * forma femenina oficial sigue dando `bashful` desde el índice.
 */
const NATURES_ES_EXTRA: Record<string, string> = {
  timido: 'timid', miedoso: 'timid',
  travieso: 'naughty', picaro: 'naughty',
  modesto: 'modest', osado: 'bold', hurano: 'lonely', serio: 'serious',
  placido: 'relaxed', flojo: 'lax', activo: 'hasty', ingenuo: 'naive',
  manso: 'quiet', alocado: 'rash', sereno: 'calm', calmado: 'calm',
  grosero: 'sassy', cauto: 'careful', cuidadoso: 'careful', raro: 'quirky',
  agitado: 'impish', docil: 'docile', afable: 'mild', amable: 'gentle',
}

/** Tipos en español. Son 19 fijos, no merece la pena meterlos en el índice. */
const TYPES_ES: Record<string, string> = {
  normal: 'normal', fuego: 'fire', agua: 'water', electrico: 'electric', planta: 'grass',
  hielo: 'ice', lucha: 'fighting', veneno: 'poison', tierra: 'ground', volador: 'flying',
  psiquico: 'psychic', bicho: 'bug', roca: 'rock', fantasma: 'ghost', dragon: 'dragon',
  siniestro: 'dark', acero: 'steel', hada: 'fairy', estelar: 'stellar',
}

/** Traduce un tipo (para el Teratipo). Devuelve el original si ya está en inglés. */
export function translateType(value: string): string {
  return TYPES_ES[value] ?? value
}

/**
 * Resuelve la naturaleza y avisa si no se ha reconocido. Se valida contra la
 * lista real porque una naturaleza equivocada cambia las estadísticas un 10%:
 * es preferible dejar la neutra y decírselo al usuario que colar un valor
 * inventado que el selector ni siquiera podría mostrar.
 */
export function resolveNature(
  raw: string,
  index: EsIndex | null,
  valid: readonly string[],
): { value: string; matched: boolean } {
  if (!raw) return { value: 'hardy', matched: true }
  if (valid.includes(raw)) return { value: raw, matched: true }

  const fromIndex = index?.natures[raw]
  if (fromIndex && valid.includes(fromIndex)) return { value: fromIndex, matched: true }

  const extra = NATURES_ES_EXTRA[raw]
  if (extra && valid.includes(extra)) return { value: extra, matched: true }

  return { value: 'hardy', matched: false }
}

/** Partículas que cada cual escribe a su manera: "Chaleco de Asalto"/"Chaleco Asalto". */
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y'])

function loose(slug: string) {
  return slug.split('-').filter((w) => w && !STOP.has(w)).join('-')
}

/**
 * Traduce un slug ya normalizado. Devuelve el original si no hay traducción:
 * un nombre sin traducir es mucho mejor que abortar la importación entera.
 */
export function translate(index: EsIndex | null, category: EsCategory, value: string): string {
  if (!value || !index) return value
  const table = index[category]
  return table[value] ?? table[loose(value)] ?? value
}

/* --------------------------- Traducción literal palabra a palabra -------------------------- */

/**
 * Vocabulario para equipos traducidos del inglés palabra por palabra.
 *
 * No sirve derivarlo de los nombres oficiales: "Dark Pulse" se llama
 * oficialmente "Pulso Umbrío", así que un diccionario sacado de los datos
 * aprendería umbrio->dark y nunca oscuro->dark, que es lo que escribe un
 * traductor automático. Por eso va a mano y con el inglés como referencia.
 */
const LITERAL_WORDS: Record<string, string> = {
  // Elementos y tipos
  fuego: 'fire', agua: 'water', planta: 'grass', hierba: 'grass', electrico: 'electric',
  hielo: 'ice', lucha: 'fight', veneno: 'poison', toxico: 'toxic', tierra: 'ground',
  volador: 'flying', psiquico: 'psycho', bicho: 'bug', roca: 'rock', rocoso: 'rocky',
  fantasma: 'ghost', dragon: 'dragon', siniestro: 'dark', oscuro: 'dark', oscura: 'dark',
  acero: 'steel', hada: 'fairy', metal: 'metal', metalico: 'steel',

  // Sustantivos de ataque
  pulso: 'pulse', rayo: 'beam', trueno: 'thunder', llama: 'flame', llamarada: 'blast',
  explosion: 'blast', bola: 'ball', esfera: 'sphere', puno: 'punch', golpe: 'hit',
  patada: 'kick', cabeza: 'head', cabezazo: 'butt', mordisco: 'bite', colmillo: 'fang',
  garra: 'claw', cuchilla: 'blade', espada: 'sword', corte: 'cut', tijera: 'scissor',
  cuerno: 'horn', cola: 'tail', ala: 'wing', pico: 'peck', pluma: 'feather',
  danza: 'dance', canto: 'sing', voz: 'voice', grito: 'shout', rugido: 'roar',
  viento: 'wind', tormenta: 'storm', huracan: 'hurricane', vendaval: 'gale',
  onda: 'wave', ola: 'wave', oleada: 'surge', chorro: 'jet', cascada: 'waterfall',
  hoja: 'leaf', hojas: 'leaf', semilla: 'seed', raiz: 'root', latigo: 'whip',
  polvo: 'powder', polen: 'pollen', espora: 'spore', veneno2: 'venom',
  meteoro: 'meteor', cometa: 'comet', estrella: 'star', luz: 'light', sombra: 'shadow',
  rueda: 'wheel', roca2: 'stone', piedra: 'stone', arena: 'sand', barro: 'mud',
  terremoto: 'earthquake', fisura: 'fissure', avalancha: 'avalanche',
  escudo: 'shield', muro: 'wall', barrera: 'barrier', refugio: 'shelter',
  campo: 'field', terreno: 'terrain', niebla: 'misty', bruma: 'mist',
  aire: 'air', cielo: 'sky', vuelo: 'fly', salto: 'jump', carga: 'charge',
  furia: 'rage', ira: 'outrage', calma: 'calm', mente: 'mind', foco: 'focus',
  vida: 'life', muerte: 'death', suerte: 'luck', destino: 'destiny',
  agilidad: 'agility', velocidad: 'speed', fuerza: 'force', poder: 'power',
  drenaje: 'drain', absorber: 'absorb', recuperacion: 'recover', descanso: 'rest',
  proteccion: 'protect', detectar: 'detect', refuerzo: 'bulk',

  // Adjetivos y modificadores
  sagrada: 'sacred', sagrado: 'sacred', santa: 'sacred', santo: 'sacred',
  sigilosa: 'sneak', sigiloso: 'sneak', furtivo: 'sneak', furtiva: 'sneak',
  extrema: 'extreme', extremo: 'extreme', rapido: 'quick', rapida: 'quick',
  lento: 'slow', pesado: 'heavy', ligero: 'light', doble: 'double', triple: 'triple',
  gigante: 'giant', mega: 'mega', super: 'super', hiper: 'hyper', mil: 'thousand',
  focal: 'focus', certera: 'focus', mortal: 'deadly', salvaje: 'wild',
  herbacea: 'grassy', herbaceo: 'grassy', electrica: 'electric', psiquica: 'psychic',
  brillante: 'shining', ardiente: 'burning', helado: 'frozen', helada: 'freeze',
  lunar: 'moon', solar: 'solar', nocturno: 'night', real: 'kings',

  // Objetos
  casco: 'helmet', chaleco: 'vest', cinturon: 'belt', banda: 'band', panuelo: 'scarf',
  gafas: 'specs', lentes: 'specs', bufanda: 'scarf', cinta: 'band', collar: 'collar',
  baya: 'berry', resto: 'leftovers', restos: 'leftovers', asalto: 'assault',
  experto: 'expert', vital: 'vital', vidasfera: 'life', concha: 'shell', campana: 'bell',
  politica: 'policy', debilidad: 'weakness', punta: 'point', garrote: 'club',
  palo: 'stick', roca3: 'rock', humeda: 'damp', calida: 'heat', fria: 'icy',
  arenosa: 'smooth', pesa: 'weight', bota: 'boots', botas: 'boots',

  // Habilidades
  presion: 'pressure', firmeza: 'steadfast', impasible: 'steadfast',
  intimidacion: 'intimidate', levitacion: 'levitate', torrente: 'torrent',
  espesura: 'overgrow', sobrecrecimiento: 'overgrow', mar: 'blaze', llamas: 'blaze',
  chupasavia: 'sap-sipper', herbivoro: 'sap-sipper', regeneracion: 'regenerator',
  postura: 'stance', cambio: 'change', construccion: 'construct',
  hidratacion: 'hydration', clorofila: 'chlorophyll', nerviosismo: 'unnerve',
  multiescamas: 'multiscale', competitivo: 'competitive', justiciero: 'justified',
  justificado: 'justified', rugosa: 'rough', tosca: 'rough', piel: 'skin',
  magica: 'magic', magico: 'magic', guardia: 'guard', rastro: 'trace',
  trasero: 'tail', trasera: 'tail', rompemuros: 'brick-break', sanguijuela: 'leech',
  demolicion: 'brick-break', psicocorte: 'psycho-cut', lluevehojas: 'leaf-storm',
  drenadoras: 'leech-seed', umbrio: 'dark', afin: 'tail', vil: 'sneak',
}

/**
 * Expresiones enteras que un traductor automático produce y que no salen de
 * traducir palabra por palabra ("Cambio de Rumbo" por U-turn).
 */
const LITERAL_PHRASES: Record<string, string> = {
  'semilla-drenaje': 'leech-seed',
  'drenaje-de-semillas': 'leech-seed',
  'cambio-de-rumbo': 'u-turn',
  'giro-rapido': 'rapid-spin',
  'meteoro-asombroso': 'meteor-mash',
  'golpe-certero': 'close-combat',
  'combate-cercano': 'close-combat',
  'rayo-lunar': 'moonblast',
  'danza-espadas': 'swords-dance',
  'a-bocajarro': 'close-combat',
  'ida-y-vuelta': 'u-turn',
}

/** Partículas españolas que no aportan nada al comparar. */
const FILLER = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'con'])

/**
 * Traduce palabra a palabra; deja tal cual lo que no conoce. Una entrada puede
 * traducirse en varias palabras ("chupasavia" -> "sap sipper"), así que el
 * resultado se aplana para poder comparar conjuntos del mismo tamaño.
 */
function literalWords(value: string): string[] {
  return value
    .split('-')
    .filter((w) => w && !FILLER.has(w))
    .flatMap((w) => (LITERAL_WORDS[w] ?? w).split('-'))
}

/**
 * Empareja por conjunto de palabras, sin importar el orden: el español invierte
 * el orden respecto al inglés ("Espada Sagrada" / "sacred-sword"). Sólo acepta
 * coincidencia total del conjunto, que sobre una lista acotada de candidatos
 * (el learnset, las 2-3 habilidades) es una señal muy fiable.
 */
/** Quita la "y" final para que "rocky"/"rock" y "misty"/"mist" se comparen igual. */
const stem = (w: string) => (w.length > 3 ? w.replace(/y$/, '') : w)

function matchByWords(input: string, candidates: string[]): string | null {
  const phrase = LITERAL_PHRASES[input]
  if (phrase && candidates.includes(phrase)) return phrase

  const want = literalWords(input).map(stem)
  if (want.length === 0) return null
  const key = [...want].sort().join('-')

  // Algunos nombres van en una sola palabra en inglés y en dos en español:
  // "Viento Trasero" -> "tailwind". Se prueban también las concatenaciones.
  const joined = new Set(permutations(want).map((p) => p.join('')))

  const hits = candidates.filter((c) => {
    const parts = c.split('-').filter(Boolean).map(stem)
    if (parts.length === want.length) return [...parts].sort().join('-') === key
    if (parts.length === 1) return joined.has(parts[0])
    return false
  })

  return hits.length === 1 ? hits[0] : null
}

/**
 * Variantes morfológicas de un objeto.
 *  - Las megapiedras acaban en "-ita" en español y en "-ite" en inglés.
 *  - Las Z-cristal viven en la PokéAPI como "poisonium-z--held", no "poisonium-z".
 */
function itemVariants(raw: string): string[] {
  const out = [`${raw}--held`, `${raw}--bag`]
  if (/ita$/.test(raw)) out.push(raw.replace(/ita$/, 'ite'))
  if (/ito$/.test(raw)) out.push(raw.replace(/ito$/, 'ite'))
  return out
}

/** Permutaciones de hasta 3 palabras; más no aparece en estos nombres. */
function permutations(words: string[]): string[][] {
  if (words.length > 3) return [words]
  if (words.length <= 1) return [words]
  const out: string[][] = []
  for (let i = 0; i < words.length; i++) {
    const rest = [...words.slice(0, i), ...words.slice(i + 1)]
    for (const p of permutations(rest)) out.push([words[i], ...p])
  }
  return out
}

/* ------------------------------ Coincidencia aproximada ----------------------------- */

/** Índice inverso slug -> nombre español, para comparar en los dos idiomas. */
function spanishNames(index: EsIndex, category: EsCategory): Map<string, string> {
  const out = new Map<string, string>()
  for (const [es, slug] of Object.entries(index[category])) {
    if (!out.has(slug)) out.set(slug, es)
  }
  return out
}

/** Coeficiente de dados sobre bigramas: 0 = nada que ver, 1 = idénticos. */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const bigrams = (s: string) => {
    const out = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      out.set(g, (out.get(g) ?? 0) + 1)
    }
    return out
  }

  const A = bigrams(a)
  const B = bigrams(b)
  let shared = 0
  let totalA = 0
  let totalB = 0
  for (const n of A.values()) totalA += n
  for (const n of B.values()) totalB += n
  for (const [g, n] of A) shared += Math.min(n, B.get(g) ?? 0)

  return (2 * shared) / (totalA + totalB)
}

/** Puntúa comparando contra el slug inglés y contra el nombre español. */
function score(input: string, candidate: string, esName: string | undefined): number {
  const flat = (s: string) => s.replace(/-/g, '')
  let best = Math.max(
    similarity(input, candidate),
    similarity(flat(input), flat(candidate)),
  )
  if (esName) {
    best = Math.max(best, similarity(input, esName), similarity(flat(input), flat(esName)))
  }

  // Compartir una palabra entera pesa mucho: "piel-rugosa" vs "piel-tosca"
  // ("Piel Tosca" es el nombre oficial de rough-skin).
  const words = new Set(input.split('-').filter((w) => w.length > 2))
  const others = new Set([...candidate.split('-'), ...(esName?.split('-') ?? [])])
  let common = 0
  for (const w of words) if (others.has(w)) common++
  if (common > 0) best = Math.max(best, 0.45 + 0.2 * common)

  return best
}

/**
 * Elige el mejor candidato para un nombre que no se ha podido traducir.
 * `threshold` sube cuanto más grande y ambiguo sea el conjunto de candidatos.
 */
export function fuzzyPick(
  input: string,
  candidates: string[],
  index: EsIndex | null,
  category: EsCategory,
  threshold = 0.55,
): string | null {
  if (!input || candidates.length === 0) return null
  if (candidates.includes(input)) return input

  const es = index ? spanishNames(index, category) : new Map<string, string>()

  let best: string | null = null
  let bestScore = 0
  let runnerUp = 0

  for (const c of candidates) {
    const s = score(input, c, es.get(c))
    if (s > bestScore) {
      runnerUp = bestScore
      bestScore = s
      best = c
    } else if (s > runnerUp) {
      runnerUp = s
    }
  }

  if (bestScore < threshold) return null
  // Si dos candidatos empatan prácticamente, es mejor no adivinar.
  if (bestScore - runnerUp < 0.06 && candidates.length > 2) return null
  return best
}

/**
 * Resuelve un nombre pegado al slug real, en este orden:
 *
 *  1. El diccionario oficial. Si lo conoce, se acepta aunque la especie no
 *     pueda tenerlo: "Ascuas" es Ember de verdad, y sin este corte la búsqueda
 *     aproximada lo emparejaba con "spikes" sólo porque Garchomp no aprende
 *     Ember.
 *  2. Un nombre en inglés que ya está entre los candidatos válidos.
 *  3. Búsqueda aproximada, para lo traducido a mano o por una máquina.
 *
 * Si nada encaja se devuelve lo que escribió el usuario: importar con un campo
 * a medias es mucho mejor que no importar.
 */
export function resolveName(
  raw: string,
  category: EsCategory,
  index: EsIndex | null,
  candidates: string[] = [],
  threshold?: number,
  /**
   * Obliga a que el resultado salga de `candidates`. Se usa con las habilidades:
   * un Pokémon sólo puede tener las suyas, así que una traducción de diccionario
   * que no esté en su lista es necesariamente falsa. Ejemplo real: "Firmeza" es
   * el nombre oficial de *Stamina*, pero quien lo escribe para un Gallade está
   * traduciendo *Steadfast*, que sí es suya.
   */
  requireCandidate = false,
): { value: string; matched: boolean } {
  if (!raw) return { value: '', matched: true }

  const translated = translate(index, category, raw)
  const usable = !requireCandidate || candidates.length === 0 || candidates.includes(translated)
  if (translated !== raw && usable) return { value: translated, matched: true }

  if (candidates.includes(raw)) return { value: raw, matched: true }

  if (category === 'items') {
    const variant = itemVariants(raw).find((v) => candidates.includes(v))
    if (variant) return { value: variant, matched: true }
  }

  // Traducción literal del inglés: "Espada Sagrada" -> {sacred, sword}.
  const literal = matchByWords(raw, candidates)
  if (literal) return { value: literal, matched: true }

  const guess = fuzzyPick(raw, candidates, index, category, threshold)
  if (guess) return { value: guess, matched: true }

  return { value: raw, matched: false }
}
