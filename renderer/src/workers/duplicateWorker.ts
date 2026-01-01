/**
 * Web Worker для поиска дубликатов изображений
 * Выполняется в фоновом потоке, не блокирует UI
 */

// Типы для сообщений между main thread и worker
interface WorkerMessage {
  type: 'start' | 'cancel';
  cards?: Array<{
    id: string;
    filePath: string;
    fileName: string;
  }>;
  similarityThreshold?: number;
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  duplicates?: Array<{
    card1: { id: string; fileName: string };
    card2: { id: string; fileName: string };
    similarity: number;
  }>;
  error?: string;
}

// Функция вычисления perceptual hash (упрощенная версия)
// В Web Worker нет доступа к Node.js API, поэтому нужно передавать данные
// Для полноценной реализации нужно передавать ArrayBuffer изображения
// Здесь заглушка - в реальной реализации нужно использовать библиотеку для хеширования
// async function calculateImageHash(filePath: string): Promise<string> {
//   throw new Error('calculateImageHash должен быть реализован в main process');
// }

// Функция сравнения хешей
function calculateSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  
  return (matches / hash1.length) * 100;
}

// Обработчик сообщений от main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, cards, similarityThreshold = 90 } = event.data;

  if (type === 'cancel') {
    // Отменяем выполнение
    return;
  }

  if (!cards || cards.length < 2) {
    self.postMessage({
      type: 'result',
      duplicates: []
    } as WorkerResponse);
    return;
  }

  try {
    // Отправляем прогресс
    self.postMessage({
      type: 'progress',
      progress: 0
    } as WorkerResponse);

    // Вычисляем хеши для всех изображений
    // ВАЖНО: В Web Worker нет доступа к файловой системе
    // Нужно передавать данные изображений из main thread
    // Здесь заглушка - в реальной реализации нужно получать ArrayBuffer
    
    const hashMap = new Map<string, string>();
    const total = cards.length;
    
    for (let i = 0; i < cards.length; i++) {
      // Отправляем прогресс каждые 10%
      if (i % Math.max(1, Math.floor(total / 10)) === 0) {
        self.postMessage({
          type: 'progress',
          progress: Math.round((i / total) * 50) // 50% на вычисление хешей
        } as WorkerResponse);
      }
      
      // В реальной реализации здесь должно быть вычисление хеша
      // hashMap.set(cards[i].id, await calculateImageHash(cards[i].filePath));
    }

    // Сравниваем все пары
    const duplicates: WorkerResponse['duplicates'] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const card1 = cards[i];
        const card2 = cards[j];

        const pairKey = `${card1.id}-${card2.id}`;
        if (processedPairs.has(pairKey)) continue;

        const hash1 = hashMap.get(card1.id);
        const hash2 = hashMap.get(card2.id);

        if (!hash1 || !hash2) continue;

        const similarity = calculateSimilarity(hash1, hash2);

        if (similarity >= similarityThreshold) {
          duplicates.push({
            card1: { id: card1.id, fileName: card1.fileName },
            card2: { id: card2.id, fileName: card2.fileName },
            similarity: Math.round(similarity)
          });
          processedPairs.add(pairKey);
        }

        // Отправляем прогресс
        const progress = 50 + Math.round(((i * cards.length + j) / (cards.length * cards.length)) * 50);
        if (progress % 10 === 0) {
          self.postMessage({
            type: 'progress',
            progress
          } as WorkerResponse);
        }
      }
    }

    // Отправляем результат
    self.postMessage({
      type: 'result',
      duplicates
    } as WorkerResponse);

  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  }
};

