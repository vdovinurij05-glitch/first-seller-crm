import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/pipelines - получить список всех воронок
export async function GET() {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: {
        _count: {
          select: {
            deals: true
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    })

    return NextResponse.json({ pipelines })
  } catch (error) {
    console.error('Error fetching pipelines:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipelines' },
      { status: 500 }
    )
  }
}
