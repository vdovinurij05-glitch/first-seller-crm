import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { transcribeCallRecording } from '@/services/mango'

// POST /api/calls/[id]/transcribe - запустить транскрибацию звонка
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const call = await prisma.call.findUnique({
      where: { id },
      select: {
        id: true,
        recordingUrl: true,
        transcription: true
      }
    })

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    if (!call.recordingUrl) {
      return NextResponse.json(
        { error: 'Recording not available for transcription' },
        { status: 400 }
      )
    }

    if (call.transcription) {
      return NextResponse.json(
        { error: 'Call already transcribed', transcription: call.transcription },
        { status: 400 }
      )
    }

    // Запускаем транскрибацию в фоне
    transcribeCallRecording(call.id, call.recordingUrl).catch(error => {
      console.error('Transcription error:', error)
    })

    return NextResponse.json({
      message: 'Transcription started',
      callId: call.id
    })
  } catch (error) {
    console.error('Error starting transcription:', error)
    return NextResponse.json(
      { error: 'Failed to start transcription' },
      { status: 500 }
    )
  }
}

// GET /api/calls/[id]/transcribe - получить транскрибацию звонка
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const call = await prisma.call.findUnique({
      where: { id },
      select: {
        id: true,
        transcription: true
      }
    })

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    if (!call.transcription) {
      return NextResponse.json(
        { error: 'Transcription not available' },
        { status: 404 }
      )
    }

    return NextResponse.json({ transcription: call.transcription })
  } catch (error) {
    console.error('Error fetching transcription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcription' },
      { status: 500 }
    )
  }
}
