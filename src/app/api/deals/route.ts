import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/deals - Получить все сделки
export async function GET(req: NextRequest) {
  try {
    const deals = await prisma.deal.findMany({
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({ deals })
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сделок' },
      { status: 500 }
    )
  }
}

// POST /api/deals - Создать сделку
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, amount, stage, probability, description, contactId, managerId } = body

    const targetStage = stage || 'NEW'

    // Найдем максимальный order в этом stage
    const maxOrderDeal = await prisma.deal.findFirst({
      where: { stage: targetStage },
      orderBy: { order: 'desc' }
    })

    const newOrder = maxOrderDeal ? maxOrderDeal.order + 1 : 0

    const deal = await prisma.deal.create({
      data: {
        title,
        amount,
        stage: targetStage,
        probability: probability || 50,
        description: description || null,
        contactId: contactId || null,
        managerId: managerId || null,
        order: newOrder
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании сделки' },
      { status: 500 }
    )
  }
}
