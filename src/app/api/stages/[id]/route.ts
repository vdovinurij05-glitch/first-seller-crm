import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PUT /api/stages/:id - Обновить статус
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, color, order } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color
    if (order !== undefined) updateData.order = order

    const stage = await prisma.stage.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ stage })
  } catch (error) {
    console.error('Error updating stage:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении статуса' },
      { status: 500 }
    )
  }
}

// DELETE /api/stages/:id - Удалить статус
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Проверяем, что это не дефолтный статус
    const stage = await prisma.stage.findUnique({
      where: { id }
    })

    if (!stage) {
      return NextResponse.json(
        { error: 'Статус не найден' },
        { status: 404 }
      )
    }

    if (stage.isDefault) {
      return NextResponse.json(
        { error: 'Нельзя удалить стандартный статус' },
        { status: 400 }
      )
    }

    // Проверяем, есть ли сделки с этим статусом
    const dealsCount = await prisma.deal.count({
      where: { stage: id }
    })

    if (dealsCount > 0) {
      return NextResponse.json(
        { error: `Нельзя удалить статус с активными сделками (${dealsCount} шт.)` },
        { status: 400 }
      )
    }

    // Удаляем статус
    await prisma.stage.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting stage:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении статуса' },
      { status: 500 }
    )
  }
}
