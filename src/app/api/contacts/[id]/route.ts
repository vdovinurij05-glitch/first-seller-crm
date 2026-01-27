import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/contacts/:id - Получить контакт
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            content: true,
            direction: true,
            createdAt: true
          }
        },
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            direction: true,
            phone: true,
            status: true,
            duration: true,
            createdAt: true
          }
        },
        deals: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            amount: true,
            stage: true,
            createdAt: true
          }
        }
      }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Контакт не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении контакта' },
      { status: 500 }
    )
  }
}

// PUT /api/contacts/:id - Обновить контакт
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, phone, email, telegramUsername, status, notes } = body

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        telegramUsername: telegramUsername || null,
        status,
        notes: notes || null
      }
    })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении контакта' },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/:id - Удалить контакт
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.contact.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении контакта' },
      { status: 500 }
    )
  }
}
