import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - Получение списка контактов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const managerId = searchParams.get('managerId')

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { telegramUsername: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (managerId) {
      where.managerId = managerId
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          manager: {
            select: { id: true, name: true, avatar: true }
          },
          _count: {
            select: {
              messages: true,
              calls: true,
              deals: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.contact.count({ where })
    ])

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении контактов' },
      { status: 500 }
    )
  }
}

// POST - Создание нового контакта
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, telegramUsername, source, notes, managerId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Имя обязательно' },
        { status: 400 }
      )
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        phone,
        email,
        telegramUsername,
        source: source || 'manual',
        notes,
        managerId,
        status: 'NEW'
      },
      include: {
        manager: {
          select: { id: true, name: true, avatar: true }
        }
      }
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating contact:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании контакта' },
      { status: 500 }
    )
  }
}
