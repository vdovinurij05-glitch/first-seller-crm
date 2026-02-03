import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/admin/fix-data - Исправить данные
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, contactId, dealId, newStage } = body

    // Удалить контакт
    if (action === 'delete-contact' && contactId) {
      console.log(`🗑️ Удаляю контакт ${contactId}...`)
      await prisma.contact.delete({ where: { id: contactId } })
      return NextResponse.json({ success: true, message: `Контакт ${contactId} удалён` })
    }

    // Исправить stage сделки
    if (action === 'fix-stage' && dealId && newStage) {
      console.log(`🔧 Исправляю stage для сделки ${dealId} на ${newStage}...`)
      await prisma.deal.update({
        where: { id: dealId },
        data: { stage: newStage }
      })
      return NextResponse.json({ success: true, message: `Stage сделки ${dealId} изменён на ${newStage}` })
    }

    // Показать информацию о сделке
    if (action === 'show-deal' && dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          pipeline: {
            include: {
              stages: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
      return NextResponse.json({ success: true, deal })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (error) {
    console.error('Ошибка:', error)
    return NextResponse.json(
      { error: 'Ошибка при выполнении операции' },
      { status: 500 }
    )
  }
}
