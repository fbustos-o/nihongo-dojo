/** Everyday objects with typical prices in yen, for the "いくらですか?" mode. */
export interface PriceObject {
  id: string;
  emoji: string;
  /** Hiragana name. */
  kana: string;
  es: string;
  prices: readonly number[];
}

export const PRICE_OBJECTS: readonly PriceObject[] = [
  { id: 'enpitsu', emoji: '✏️', kana: 'えんぴつ', es: 'lápiz', prices: [50, 80, 100] },
  { id: 'keshigomu', emoji: '🧽', kana: 'けしゴム', es: 'goma de borrar', prices: [60, 90, 120] },
  { id: 'nooto', emoji: '📓', kana: 'ノート', es: 'cuaderno', prices: [150, 200, 300] },
  { id: 'hon', emoji: '📖', kana: 'ほん', es: 'libro', prices: [800, 1200, 1500] },
  { id: 'kasa', emoji: '☂️', kana: 'かさ', es: 'paraguas', prices: [1000, 1800, 2500] },
  { id: 'saifu', emoji: '👛', kana: 'さいふ', es: 'billetera', prices: [3000, 4800, 6000] },
  { id: 'kutsu', emoji: '👟', kana: 'くつ', es: 'zapatos', prices: [3500, 6800, 8000] },
  { id: 'kaban', emoji: '👜', kana: 'かばん', es: 'bolso', prices: [4000, 9800, 12000] },
  { id: 'tokei', emoji: '⌚', kana: 'とけい', es: 'reloj', prices: [10000, 15000, 30000] },
  { id: 'jitensha', emoji: '🚲', kana: 'じてんしゃ', es: 'bicicleta', prices: [25000, 40000, 63000] },
  { id: 'pasokon', emoji: '💻', kana: 'パソコン', es: 'computadora', prices: [80000, 98000] },
  { id: 'ringo', emoji: '🍎', kana: 'りんご', es: 'manzana', prices: [100, 120, 180] },
  { id: 'koohii', emoji: '☕', kana: 'コーヒー', es: 'café', prices: [300, 450, 600] },
  { id: 'pan', emoji: '🍞', kana: 'パン', es: 'pan', prices: [130, 250, 400] },
  { id: 'bentou', emoji: '🍱', kana: 'べんとう', es: 'bento', prices: [500, 680, 800] },
  { id: 'shatsu', emoji: '👕', kana: 'シャツ', es: 'camisa', prices: [1500, 2900, 4500] },
];
