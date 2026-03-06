import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import prisma from '@/lib/prisma'

const OPENAI_API_URL = 'https://api.openai.com/v1'

export interface TranscriptionAnalysis {
  summary: string
  sentiment: string
  keywords: string[]
  clientName: string
  agreements: string
  clientTemperature: 'HOT' | 'WARM' | 'COLD'
  meetingDateTime: string
  tariff: string
  dealAmount: number
}

// Транскрибация аудиофайла через Whisper API
export async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    let audioBuffer: Buffer

    // Если путь локальный — читаем с диска
    if (audioUrl.startsWith('/') && !audioUrl.startsWith('//')) {
      const filePath = path.join(process.cwd(), 'public', audioUrl)
      if (!fs.existsSync(filePath)) {
        console.error(`[transcribe] File not found: ${filePath}`)
        return null
      }
      audioBuffer = fs.readFileSync(filePath)
      console.log(`[transcribe] Read file from disk: ${filePath} (${audioBuffer.length} bytes)`)
    } else {
      // Полный URL — скачиваем через axios
      const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' })
      audioBuffer = Buffer.from(audioResponse.data)
      console.log(`[transcribe] Downloaded from URL: ${audioUrl} (${audioBuffer.length} bytes)`)
    }

    const formData = new FormData()
    formData.append('file', audioBuffer, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    })
    formData.append('model', 'whisper-1')
    formData.append('language', 'ru')
    formData.append('response_format', 'text')

    const response = await axios.post(
      `${OPENAI_API_URL}/audio/transcriptions`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        timeout: 120000, // 2 минуты на длинные записи
      }
    )

    console.log(`[transcribe] Whisper done, text length: ${response.data?.length || 0}`)
    return response.data
  } catch (error: any) {
    console.error('[transcribe] Whisper error:', error?.response?.data || error?.message)
    return null
  }
}

// Анализ транскрибации через GPT: резюме, имя клиента, договорённости
export async function analyzeTranscription(text: string): Promise<TranscriptionAnalysis | null> {
  try {
    const response = await axios.post(
      `${OPENAI_API_URL}/chat/completions`,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Ты - аналитик звонков в отделе продаж компании 1Seller. Проанализируй транскрибацию телефонного звонка и верни JSON:
{
  "summary": "Краткое резюме звонка в 2-3 предложениях",
  "sentiment": "positive/negative/neutral",
  "keywords": ["ключевое", "слово", "максимум 5"],
  "clientName": "Имя клиента (и отчество если назвал). Пустая строка если не представился.",
  "agreements": "О чём договорились: итоговые договорённости из разговора. Пустая строка если не договорились.",
  "clientTemperature": "HOT/WARM/COLD",
  "meetingDateTime": "Дата и время встречи если обсуждались, формат ISO 8601 (2026-03-10T15:00:00). Пустая строка если не обсуждалось.",
  "tariff": "Название тарифа если обсуждался. Возможные варианты: Яндекс KIT, Продвижение маркетплейсов, Фабрика контента, Платная консультация. Пустая строка если не обсуждался.",
  "dealAmount": 0
}

Правила определения clientTemperature:
- HOT — клиент заинтересован, позитивно настроен, согласился на встречу или сотрудничество
- WARM — клиент слушает, задаёт вопросы, но нужно дожимать, не отказал но и не согласился
- COLD — клиент отказался, не заинтересован, грубит, просит не звонить

Правила определения dealAmount по тарифу:
- "Яндекс KIT" и встреча согласована → 30000
- "Продвижение маркетплейсов" → 87500
- "Фабрика контента" → 315000
- "Платная консультация" → 25000
- Если тариф не обсуждался → 0

Отвечай только JSON без markdown.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      }
    )

    const content = response.data.choices[0]?.message?.content
    if (content) {
      const parsed = JSON.parse(content)
      return {
        summary: parsed.summary || '',
        sentiment: parsed.sentiment || 'neutral',
        keywords: parsed.keywords || [],
        clientName: parsed.clientName || '',
        agreements: parsed.agreements || '',
        clientTemperature: (['HOT', 'WARM', 'COLD'].includes(parsed.clientTemperature) ? parsed.clientTemperature : 'WARM') as 'HOT' | 'WARM' | 'COLD',
        meetingDateTime: parsed.meetingDateTime || '',
        tariff: parsed.tariff || '',
        dealAmount: typeof parsed.dealAmount === 'number' ? parsed.dealAmount : 0,
      }
    }
    return null
  } catch (error: any) {
    console.error('[transcribe] GPT analysis error:', error?.response?.data || error?.message)
    return null
  }
}

// Полный процесс: транскрибация + анализ + сохранение. Возвращает результат для Twenty CRM.
export async function transcribeAndAnalyzeCall(callId: string): Promise<{ text: string; analysis: TranscriptionAnalysis } | null> {
  try {
    const call = await prisma.call.findUnique({ where: { id: callId } })

    if (!call || !call.recordingUrl) {
      console.log(`[transcribe] Call ${callId} not found or no recording`)
      return null
    }

    // Дедупликация
    const existing = await prisma.callTranscription.findUnique({ where: { callId } })
    if (existing) {
      console.log(`[transcribe] Already transcribed: ${callId}`)
      // Возвращаем существующие данные для Twenty CRM
      return {
        text: existing.text,
        analysis: {
          summary: existing.summary || '',
          sentiment: existing.sentiment || 'neutral',
          keywords: existing.keywords ? existing.keywords.split(', ') : [],
          clientName: '',
          agreements: '',
          clientTemperature: 'WARM',
          meetingDateTime: '',
          tariff: '',
          dealAmount: 0,
        }
      }
    }

    // 1. Whisper
    console.log(`[transcribe] Starting Whisper for call ${callId}...`)
    const text = await transcribeAudio(call.recordingUrl)
    if (!text) {
      console.log(`[transcribe] Whisper failed for ${callId}`)
      return null
    }

    // 2. GPT анализ
    console.log(`[transcribe] Starting GPT analysis for ${callId}...`)
    const analysis = await analyzeTranscription(text)
    if (!analysis) {
      // Сохраняем хотя бы текст
      await prisma.callTranscription.create({
        data: { callId, text, keywords: '' }
      })
      return { text, analysis: { summary: '', sentiment: 'neutral', keywords: [], clientName: '', agreements: '', clientTemperature: 'WARM', meetingDateTime: '', tariff: '', dealAmount: 0 } }
    }

    // 3. Сохраняем в БД
    await prisma.callTranscription.create({
      data: {
        callId,
        text,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        keywords: analysis.keywords.join(', ')
      }
    })

    console.log(`[transcribe] Saved transcription for ${callId}: "${analysis.summary.slice(0, 80)}..."`)
    return { text, analysis }
  } catch (error: any) {
    console.error(`[transcribe] Error for ${callId}:`, error?.message)
    return null
  }
}

// Фоновая задача для транскрибации всех звонков без транскрибации
export async function transcribePendingCalls(): Promise<void> {
  const callsWithRecording = await prisma.call.findMany({
    where: {
      recordingUrl: { not: null },
      transcription: null,
      status: 'COMPLETED'
    },
    take: 10
  })

  for (const call of callsWithRecording) {
    await transcribeAndAnalyzeCall(call.id)
  }
}
