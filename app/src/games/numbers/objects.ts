/** Everyday objects with typical prices in yen, for the "いくらですか?" mode. */
export interface PriceObject {
  id: string;
  emoji: string;
  /** Hiragana name. */
  kana: string;
  es: string;
  en: string;
  prices: readonly number[];
}

export const PRICE_OBJECTS: readonly PriceObject[] = [
  { id: 'enpitsu', emoji: '✏️', kana: 'えんぴつ', es: 'lápiz', en: 'pencil', prices: [50, 80, 100] },
  { id: 'keshigomu', emoji: '🧽', kana: 'けしゴム', es: 'goma de borrar', en: 'eraser', prices: [60, 90, 120] },
  { id: 'nooto', emoji: '📓', kana: 'ノート', es: 'cuaderno', en: 'notebook', prices: [150, 200, 300] },
  { id: 'hon', emoji: '📖', kana: 'ほん', es: 'libro', en: 'book', prices: [800, 1200, 1500] },
  { id: 'kasa', emoji: '☂️', kana: 'かさ', es: 'paraguas', en: 'umbrella', prices: [1000, 1800, 2500] },
  { id: 'saifu', emoji: '👛', kana: 'さいふ', es: 'billetera', en: 'wallet', prices: [3000, 4800, 6000] },
  { id: 'kutsu', emoji: '👟', kana: 'くつ', es: 'zapatos', en: 'shoes', prices: [3500, 6800, 8000] },
  { id: 'kaban', emoji: '👜', kana: 'かばん', es: 'bolso', en: 'handbag', prices: [4000, 9800, 12000] },
  { id: 'tokei', emoji: '⌚', kana: 'とけい', es: 'reloj', en: 'watch', prices: [10000, 15000, 30000] },
  { id: 'jitensha', emoji: '🚲', kana: 'じてんしゃ', es: 'bicicleta', en: 'bicycle', prices: [25000, 40000, 63000] },
  { id: 'pasokon', emoji: '💻', kana: 'パソコン', es: 'computadora', en: 'computer', prices: [80000, 98000] },
  { id: 'ringo', emoji: '🍎', kana: 'りんご', es: 'manzana', en: 'apple', prices: [100, 120, 180] },
  { id: 'koohii', emoji: '☕', kana: 'コーヒー', es: 'café', en: 'coffee', prices: [300, 450, 600] },
  { id: 'pan', emoji: '🍞', kana: 'パン', es: 'pan', en: 'bread', prices: [130, 250, 400] },
  { id: 'bentou', emoji: '🍱', kana: 'べんとう', es: 'bento', en: 'bento', prices: [500, 680, 800] },
  { id: 'shatsu', emoji: '👕', kana: 'シャツ', es: 'camisa', en: 'shirt', prices: [1500, 2900, 4500] },
];

/** Name of an object in the meaning language. */
export const objectName = (object: Pick<PriceObject, 'es' | 'en'>, lang: 'es' | 'en'): string => (lang === 'en' ? object.en : object.es);
