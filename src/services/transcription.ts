import axios from 'axios'
import FormData from 'form-data'
import prisma from '@/lib/prisma'

const OPENAI_API_URL = 'https://api.openai.com/v1'

// Транскрибация аудиофайла через Whisper API
export async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    // Скачиваем аудиофайл
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer'
    })

    const formData = new FormData()
    formData.append('file', Buffer.from(audioResponse.data), {
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
        }
      }
    )

    return response.data
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return null
  }
}

// Генерация краткого резюме и анализ тональности через GPT
export async function analyzeTranscription(text: string): Promise<{
  summary: string
  sentiment: string
  keywords: string[]
} | null> {
  try {
    const response = await axios.post(
      `${OPENAI_API_URL}/chat/completions`,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Ты - аналитик звонков в отделе продаж. Проанализируй транскрибацию звонка и верни JSON:
{
  "summary": "Краткое резюме звонка в 2-3 предложениях",
  "sentiment": "positive/negative/neutral",
  "keywords": ["ключевое", "слово", "максимум 5"]
}
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
        }
      }
    )

    const content = response.data.choices[0]?.message?.content
    if (content) {
      return JSON.parse(content)
    }
    return null
  } catch (error) {
    console.error('Error analyzing transcription:', error)
    return null
  }
}

// Полный процесс транскрибации звонка
export async function transcribeCall(callId: string): Promise<boolean> {
  try {
    // Получаем звонок
    const call = await prisma.call.findUnique({
      where: { id: callId }
    })

    if (!call || !call.recordingUrl) {
      console.log('Call not found or no recording URL')
      return false
    }

    // Проверяем, есть ли уже транскрибация
    const existingTranscription = await prisma.callTranscription.findUnique({
      where: { callId }
    })

    if (existingTranscription) {
      console.log('Transcription already exists')
      return true
    }

    // Транскрибируем аудио
    console.log('Starting transcription for call:', callId)
    const text = await transcribeAudio(call.recordingUrl)

    if (!text) {
      console.log('Transcription failed')
      return false
    }

    // Анализируем транскрибацию
    console.log('Analyzing transcription...')
    const analysis = await analyzeTranscription(text)

    // Сохраняем транскрибацию
    await prisma.callTranscription.create({
      data: {
        callId,
        text,
        summary: analysis?.summary,
        sentiment: analysis?.sentiment,
        keywords: analysis?.keywords || []
      }
    })

    console.log('Transcription saved successfully')
    return true
  } catch (error) {
    console.error('Error in transcribeCall:', error)
    return false
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
    take: 10 // Обрабатываем по 10 звонков за раз
  })

  for (const call of callsWithRecording) {
    await transcribeCall(call.id)
  }
}
