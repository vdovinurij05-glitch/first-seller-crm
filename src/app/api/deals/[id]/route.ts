import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/deals/:id - Получить сделку
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegramId: true,
            telegramUsername: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true
          }
        },
        pipeline: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Сделка не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error fetching deal:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сделки' },
      { status: 500 }
    )
  }
}

// PATCH /api/deals/:id - Частичное обновление сделки
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params })
}

// PUT /api/deals/:id - Обновить сделку
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, amount, stage, probability, description, contactId, managerId, order, pipelineId } = body

    // Получаем текущую сделку для сравнения
    const currentDeal = await prisma.deal.findUnique({
      where: { id }
    })

    if (!currentDeal) {
      return NextResponse.json(
        { error: 'Сделка не найдена' },
        { status: 404 }
      )
    }

    console.log(`🔧 PATCH /api/deals/${id} - updating deal:`, { stage, pipelineId: pipelineId || currentDeal.pipelineId })

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (amount !== undefined) updateData.amount = amount
    if (stage !== undefined) updateData.stage = stage
    if (probability !== undefined) updateData.probability = probability
    if (description !== undefined) updateData.description = description || null
    if (contactId !== undefined) updateData.contactId = contactId || null
    if (managerId !== undefined) updateData.managerId = managerId || null
    if (order !== undefined) updateData.order = order
    if (pipelineId !== undefined) updateData.pipelineId = pipelineId || null

    // Если переводим в WON или LOST, устанавливаем closedAt
    if (stage === 'WON' || stage === 'LOST') {
      updateData.closedAt = new Date()
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegramId: true,
            telegramUsername: true
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

    // Создаем системное событие при смене статуса
    if (stage !== undefined && currentDeal && stage !== currentDeal.stage) {
      const stageNames: Record<string, string> = {
        'NEW': 'Новые',
        'CONTACTED': 'Контакт',
        'MEETING': 'Встреча',
        'PROPOSAL': 'Предложение',
        'NEGOTIATION': 'Переговоры',
        'WON': 'Выиграно',
        'LOST': 'Проиграно'
      }

      await prisma.dealComment.create({
        data: {
          content: `Статус изменен: ${stageNames[currentDeal.stage] || currentDeal.stage} → ${stageNames[stage] || stage}`,
          type: 'SYSTEM_EVENT',
          eventType: 'STAGE_CHANGED',
          metadata: JSON.stringify({
            from: currentDeal.stage,
            to: stage
          }),
          dealId: id,
          userId: managerId || currentDeal.managerId
        }
      })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error updating deal:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении сделки' },
      { status: 500 }
    )
  }
}

// DELETE /api/deals/:id - Удалить сделку
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Сначала удаляем все комментарии
    await prisma.dealComment.deleteMany({
      where: { dealId: id }
    })

    // Затем удаляем сделку
    await prisma.deal.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deal:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении сделки' },
      { status: 500 }
    )
  }
}
