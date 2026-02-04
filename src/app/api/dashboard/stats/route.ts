import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const now = new Date()

    // Начало сегодня
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    // Начало вчера
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    // Начало этой недели (понедельник)
    const thisWeekStart = new Date(now)
    const dayOfWeek = thisWeekStart.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    thisWeekStart.setDate(thisWeekStart.getDate() + diff)
    thisWeekStart.setHours(0, 0, 0, 0)

    // Начало прошлой недели
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    // Начало прошлого месяца
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // === КОНТАКТЫ ===
    const totalContacts = await prisma.contact.count()
    const contactsThisWeek = await prisma.contact.count({
      where: { createdAt: { gte: thisWeekStart } }
    })
    const contactsLastWeek = await prisma.contact.count({
      where: {
        createdAt: {
          gte: lastWeekStart,
          lt: thisWeekStart
        }
      }
    })
    const contactsChange = contactsLastWeek > 0
      ? Math.round(((contactsThisWeek - contactsLastWeek) / contactsLastWeek) * 100)
      : contactsThisWeek > 0 ? 100 : 0

    // === ЗВОНКИ СЕГОДНЯ ===
    const callsToday = await prisma.call.count({
      where: { createdAt: { gte: todayStart } }
    })
    const callsYesterday = await prisma.call.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: todayStart
        }
      }
    })
    const callsChange = callsYesterday > 0
      ? Math.round(((callsToday - callsYesterday) / callsYesterday) * 100)
      : callsToday > 0 ? 100 : 0

    // === СООБЩЕНИЯ ===
    const totalMessages = await prisma.message.count()
    const messagesThisWeek = await prisma.message.count({
      where: { createdAt: { gte: thisWeekStart } }
    })
    const messagesLastWeek = await prisma.message.count({
      where: {
        createdAt: {
          gte: lastWeekStart,
          lt: thisWeekStart
        }
      }
    })
    const messagesChange = messagesLastWeek > 0
      ? Math.round(((messagesThisWeek - messagesLastWeek) / messagesLastWeek) * 100)
      : messagesThisWeek > 0 ? 100 : 0

    // === АКТИВНЫЕ СДЕЛКИ ===
    const activeDeals = await prisma.deal.count({
      where: { closedAt: null }
    })
    const dealsThisMonth = await prisma.deal.count({
      where: { createdAt: { gte: thisMonthStart } }
    })
    const dealsLastMonth = await prisma.deal.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lt: thisMonthStart
        }
      }
    })
    const dealsChange = dealsLastMonth > 0
      ? Math.round(((dealsThisMonth - dealsLastMonth) / dealsLastMonth) * 100)
      : dealsThisMonth > 0 ? 100 : 0

    // === ПОСЛЕДНИЕ КОНТАКТЫ ===
    const recentContacts = await prisma.contact.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramUsername: true,
        source: true,
        createdAt: true
      }
    })

    // === ПОСЛЕДНИЕ ЗВОНКИ ===
    const recentCalls = await prisma.call.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // === СУММА АКТИВНЫХ СДЕЛОК ===
    const dealsSum = await prisma.deal.aggregate({
      where: { closedAt: null },
      _sum: { amount: true }
    })

    // === ЗАДАЧИ НА СЕГОДНЯ ===
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const pendingTasks = await prisma.task.count({
      where: {
        status: 'PENDING',
        dueDate: { lte: todayEnd }
      }
    })

    return NextResponse.json({
      stats: {
        contacts: totalContacts,
        contactsChange,
        calls: callsToday,
        callsChange,
        messages: totalMessages,
        messagesChange,
        deals: activeDeals,
        dealsChange,
        dealsSum: dealsSum._sum.amount || 0,
        pendingTasks
      },
      recentContacts: recentContacts.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        telegramUsername: c.telegramUsername,
        source: c.source || 'Неизвестно',
        createdAt: c.createdAt.toISOString()
      })),
      recentCalls: recentCalls.map(call => ({
        id: call.id,
        phone: call.phone || call.fromNumber || call.toNumber || 'Неизвестно',
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        contactName: call.contact?.name,
        createdAt: call.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
