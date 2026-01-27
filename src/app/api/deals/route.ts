import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/deals - Получить все сделки
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const pipelineSlug = searchParams.get('pipelineSlug')

    // Если указан pipelineSlug, находим pipeline и фильтруем по нему
    let whereClause: any = {}
    if (pipelineSlug) {
      const pipeline = await prisma.pipeline.findUnique({
        where: { slug: pipelineSlug }
      })
      if (pipeline) {
        whereClause.pipelineId = pipeline.id
      }
    }

    const deals = await prisma.deal.findMany({
      where: whereClause,
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
    const { title, amount, stage, probability, description, contactId, managerId, pipelineId, pipelineSlug } = body

    // Если указан pipelineSlug, находим pipelineId
    let finalPipelineId = pipelineId
    if (pipelineSlug && !pipelineId) {
      const pipeline = await prisma.pipeline.findUnique({
        where: { slug: pipelineSlug }
      })
      if (pipeline) {
        finalPipelineId = pipeline.id
      }
    }

    // Если не указана воронка, используем дефолтную
    if (!finalPipelineId) {
      const defaultPipeline = await prisma.pipeline.findFirst({
        where: { isDefault: true }
      })
      if (defaultPipeline) {
        finalPipelineId = defaultPipeline.id
      }
    }

    const targetStage = stage || 'NEW'

    // Найдем максимальный order в этом stage
    const maxOrderDeal = await prisma.deal.findFirst({
      where: { stage: targetStage, pipelineId: finalPipelineId },
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
        pipelineId: finalPipelineId || null,
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
