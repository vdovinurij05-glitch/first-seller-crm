import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - получить одну задачу
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const task = await prisma.task.findUnique({
      where: { id }
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Задача не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении задачи' },
      { status: 500 }
    )
  }
}

// PATCH - обновить задачу
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, description, type, dueDate, status, reminderSent } = body

    // Получаем задачу до обновления чтобы проверить статус
    const existingTask = await prisma.task.findUnique({ where: { id } })

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)
    if (status !== undefined) {
      updateData.status = status
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
      }
    }
    if (reminderSent !== undefined) updateData.reminderSent = reminderSent

    const task = await prisma.task.update({
      where: { id },
      data: updateData
    })

    // Если задача была выполнена - записываем в ленту активности
    if (status === 'COMPLETED' && existingTask?.status !== 'COMPLETED' && existingTask?.dealId) {
      await prisma.dealComment.create({
        data: {
          content: `✅ Задача выполнена: "${task.title}"`,
          type: 'SYSTEM_EVENT',
          eventType: 'TASK_COMPLETED',
          metadata: JSON.stringify({ taskId: task.id }),
          dealId: existingTask.dealId,
          userId: existingTask.userId
        }
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении задачи' },
      { status: 500 }
    )
  }
}

// DELETE - удалить задачу
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.task.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении задачи' },
      { status: 500 }
    )
  }
}
