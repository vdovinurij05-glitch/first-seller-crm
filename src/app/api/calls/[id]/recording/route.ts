import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/calls/[id]/recording - получить аудиозапись звонка
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const call = await prisma.call.findUnique({
      where: { id },
      select: {
        recordingUrl: true
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
        { error: 'Recording not available' },
        { status: 404 }
      )
    }

    // Возвращаем URL записи
    // В будущем можно добавить проксирование аудио через наш сервер
    return NextResponse.json({
      recordingUrl: call.recordingUrl,
      message: 'Recording URL retrieved successfully'
    })
  } catch (error) {
    console.error('Error fetching call recording:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call recording' },
      { status: 500 }
    )
  }
}
