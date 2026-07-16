// Zentrale Typdefinitionen der App.

/** Art einer Kategorie – bestimmt, wo sie zur Auswahl steht. */
export type CategoryKind = 'expense' | 'income' | 'both'

/** Eine Kategorie mit Emoji-Icon und Farbe für die Visualisierung. */
export interface Category {
  id: string
  name: string
  emoji: string
  /** Hex-Farbe, z. B. für Charts und Badges. */
  color: string
  kind: CategoryKind
  /** true bei den mitgelieferten Standardkategorien (nur informativ). */
  isDefault?: boolean
  /** Sortierreihenfolge in Listen. */
  order?: number
}

/** Herkunft einer Buchung. */
export type TransactionSource = 'manual' | 'import'

/**
 * Eine einzelne Buchung.
 * `amount` ist negativ für Ausgaben und positiv für Einnahmen (in Euro).
 */
export interface Transaction {
  id: string
  /** Buchungsdatum als ISO-String (YYYY-MM-DD). */
  date: string
  /** Betrag in Euro. Negativ = Ausgabe, positiv = Einnahme. */
  amount: number
  /** Verwendungszweck / Beschreibung. */
  description: string
  /** Empfänger oder Zahler (Gegenkonto-Name). */
  counterparty: string
  /** Zugewiesene Kategorie oder null, wenn noch nicht kategorisiert. */
  categoryId: string | null
  /** Freie Bemerkung des Nutzers. */
  note: string
  source: TransactionSource
  /** Verknüpft importierte Buchungen mit ihrem Import-Vorgang. */
  importBatchId?: string
  /** Hash zur Duplikat-Erkennung beim Import. */
  dedupHash: string
  /** Erstellungszeitpunkt (ISO-Timestamp). */
  createdAt: string
}

/** Feld, auf das eine Auto-Kategorisierungs-Regel angewendet wird. */
export type RuleField = 'description' | 'counterparty' | 'any'

/** Regel: Wenn `field` das Muster `pattern` enthält, weise `categoryId` zu. */
export interface Rule {
  id: string
  field: RuleField
  /** Suchbegriff (case-insensitiv, "enthält"-Vergleich). */
  pattern: string
  categoryId: string
  createdAt: string
}

/** Dezimaltrennzeichen in importierten Beträgen. */
export type DecimalSeparator = ',' | '.'

/** Wie der Betrag aus der CSV gelesen wird. */
export type AmountMode = 'single' | 'debitCredit'

/**
 * Gespeicherte Import-Vorlage pro Bank/Format.
 * Enthält alle Einstellungen, um eine CSV automatisch zu deuten.
 */
export interface ImportPreset {
  id: string
  name: string
  delimiter: string
  /** Text-Encoding der Datei. */
  encoding: 'utf-8' | 'iso-8859-1' | 'windows-1252'
  decimalSeparator: DecimalSeparator
  /** Datumsformat, z. B. "DD.MM.YYYY" oder "YYYY-MM-DD". */
  dateFormat: string
  /** Anzahl der Kopfzeilen, die vor der Tabelle übersprungen werden. */
  skipRows: number
  amountMode: AmountMode
  /** Spaltennamen (bei Header) oder Spaltenindizes als String. */
  columns: {
    date: string
    amount?: string
    debit?: string
    credit?: string
    description?: string
    counterparty?: string
  }
  createdAt: string
}

/** App-Einstellungen (Single-Row-Tabelle mit id = 'app'). */
export interface Settings {
  id: 'app'
  currency: string
  theme: 'system' | 'light' | 'dark'
}
