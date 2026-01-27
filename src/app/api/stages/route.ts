import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/stages - Получить все статусы
export async function GET(req: NextRequest) {
  try {
    const stages = await prisma.stage.findMany({
      orderBy: { order: 'asc' }
    })

    return NextResponse.json({ stages })
  } catch (error) {
    console.error('Error fetching stages:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении статусов' },
      { status: 500 }
    )
  }
}

// POST /api/stages - Создать новый статус
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name, color } = body

    // Найдем максимальный order
    const maxOrderStage = await prisma.stage.findFirst({
      orderBy: { order: 'desc' }
    })

    const newOrder = maxOrderStage ? maxOrderStage.order + 1 : 0

    const stage = await prisma.stage.create({
      data: {
        id,
        name,
        color,
        order: newOrder,
        isDefault: false
      }
    })

    return NextResponse.json({ stage })
  } catch (error) {
    console.error('Error creating stage:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании статуса' },
      { status: 500 }
    )
  }
}
