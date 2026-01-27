import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/calls/[id] - получить информацию о звонке
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        deal: {
          select: {
            id: true,
            title: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true
          }
        },
        transcription: true
      }
    })

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ call })
  } catch (error) {
    console.error('Error fetching call:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call' },
      { status: 500 }
    )
  }
}
