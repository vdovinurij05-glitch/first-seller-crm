import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Получить текущего пользователя из токена
async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return null
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        mangoExtension: true
      }
    })
    return user
  } catch (error) {
    return null
  }
}

// GET /api/users/me - Получить профиль текущего пользователя
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении профиля' },
      { status: 500 }
    )
  }
}

// PUT /api/users/me - Обновить профиль текущего пользователя
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, email, mangoExtension } = body

    // Проверяем, что email не занят другим пользователем
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })
      if (existingUser) {
        return NextResponse.json(
          { error: 'Этот email уже используется' },
          { status: 400 }
        )
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(mangoExtension !== undefined && { mangoExtension: mangoExtension || null })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        mangoExtension: true
      }
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении профиля' },
      { status: 500 }
    )
  }
}
