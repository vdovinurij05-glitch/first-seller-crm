import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { initiateCall } from '@/services/mango'
import { transcribeCall } from '@/services/transcription'

// GET - Получение списка звонков
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const contactId = searchParams.get('contactId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')
    const direction = searchParams.get('direction')

    const where: any = {}

    if (contactId) where.contactId = contactId
    if (managerId) where.managerId = managerId
    if (status) where.status = status
    if (direction) where.direction = direction

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: {
          contact: {
            select: { id: true, name: true, phone: true }
          },
          manager: {
            select: { id: true, name: true, avatar: true }
          },
          transcription: {
            select: { id: true, summary: true, sentiment: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.call.count({ where })
    ])

    return NextResponse.json({
      calls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении звонков' },
      { status: 500 }
    )
  }
}

// POST - Инициация исходящего звонка
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, extension, managerId } = body

    if (!phone || !extension) {
      return NextResponse.json(
        { error: 'phone и extension обязательны' },
        { status: 400 }
      )
    }

    const callId = await initiateCall(extension, phone, managerId)

    if (!callId) {
      return NextResponse.json(
        { error: 'Ошибка при инициации звонка' },
        { status: 500 }
      )
    }

    return NextResponse.json({ callId }, { status: 201 })
  } catch (error) {
    console.error('Error initiating call:', error)
    return NextResponse.json(
      { error: 'Ошибка при инициации звонка' },
      { status: 500 }
    )
  }
}
