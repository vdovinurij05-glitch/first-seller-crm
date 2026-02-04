import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

const MANGO_API_URL = 'https://app.mango-office.ru/vpbx'

const config = {
  apiKey: process.env.MANGO_API_KEY || '',
  apiSalt: process.env.MANGO_API_SALT || ''
}

function generateSign(json: string): string {
  const signString = config.apiKey + json + config.apiSalt
  return crypto.createHash('sha256').update(signString).digest('hex')
}

const RECORDINGS_DIR = path.join(process.cwd(), 'public', 'recordings')

// Создаём директорию если нет
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
}

// GET /api/mango/test-recording?recording_id=MToxMDI0MjQyNzoyNTg2MzI1NzAxODow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recordingId = searchParams.get('recording_id')

    if (!recordingId) {
      return NextResponse.json({
        error: 'recording_id parameter required',
        example: '/api/mango/test-recording?recording_id=MToxMDI0MjQyNzoyNTg2MzI1NzAxODow'
      }, { status: 400 })
    }

    console.log(`🎙️ Test download for recording_id: ${recordingId}`)

    // Формируем запрос к API
    const json = JSON.stringify({
      recording_id: recordingId,
      action: 'download'
    })
    const sign = generateSign(json)

    const formData = new URLSearchParams()
    formData.append('vpbx_api_key', config.apiKey)
    formData.append('sign', sign)
    formData.append('json', json)

    console.log(`🎙️ Request to Mango API:`)
    console.log(`   URL: ${MANGO_API_URL}/queries/recording/post/`)
    console.log(`   vpbx_api_key: ${config.apiKey}`)
    console.log(`   json: ${json}`)

    // Делаем запрос - сначала попробуем с автоматическими редиректами
    try {
      const response = await axios.post(`${MANGO_API_URL}/queries/recording/post/`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 5,
        responseType: 'arraybuffer',
        timeout: 30000
      })

      console.log(`🎙️ Response status: ${response.status}`)
      console.log(`🎙️ Response content-type: ${response.headers['content-type']}`)

      const contentType = response.headers['content-type'] || ''

      // Если получили аудио - сохраняем
      if (contentType.includes('audio') || response.data.length > 10000) {
        const ext = contentType.includes('wav') ? 'wav' : 'mp3'
        const filename = `test_${Date.now()}.${ext}`
        const filepath = path.join(RECORDINGS_DIR, filename)

        fs.writeFileSync(filepath, response.data)

        return NextResponse.json({
          success: true,
          message: 'Recording downloaded successfully!',
          filename,
          size: response.data.length,
          contentType,
          url: `/recordings/${filename}`
        })
      }

      // Если получили текст/JSON - выводим
      const textData = response.data.toString('utf-8').substring(0, 1000)
      return NextResponse.json({
        success: false,
        message: 'Unexpected response',
        status: response.status,
        contentType,
        dataSize: response.data.length,
        dataPreview: textData
      })

    } catch (error: any) {
      // Обрабатываем редирект
      if (error.response?.status === 302 || error.response?.status === 301) {
        const location = error.response.headers['location']
        console.log(`🎙️ Got redirect to: ${location}`)

        if (location) {
          // Скачиваем по редиректу
          const fileResponse = await axios.get(location, {
            responseType: 'arraybuffer',
            timeout: 60000
          })

          const contentType = fileResponse.headers['content-type'] || 'audio/mpeg'
          const ext = contentType.includes('wav') ? 'wav' : 'mp3'
          const filename = `test_${Date.now()}.${ext}`
          const filepath = path.join(RECORDINGS_DIR, filename)

          fs.writeFileSync(filepath, fileResponse.data)

          return NextResponse.json({
            success: true,
            message: 'Recording downloaded via redirect!',
            redirectUrl: location,
            filename,
            size: fileResponse.data.length,
            contentType,
            url: `/recordings/${filename}`
          })
        }
      }

      // Другие ошибки
      const errorData = error.response?.data
      let errorText = ''
      if (Buffer.isBuffer(errorData)) {
        errorText = errorData.toString('utf-8').substring(0, 500)
      } else {
        errorText = JSON.stringify(errorData).substring(0, 500)
      }

      return NextResponse.json({
        success: false,
        error: error.message,
        status: error.response?.status,
        headers: error.response?.headers,
        data: errorText
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Test recording error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
