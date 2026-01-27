import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/pipelines/[slug] - получить воронку по slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const pipeline = await prisma.pipeline.findUnique({
      where: { slug },
      include: {
        stages: {
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: {
            deals: true
          }
        }
      }
    })

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ pipeline })
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    )
  }
}
