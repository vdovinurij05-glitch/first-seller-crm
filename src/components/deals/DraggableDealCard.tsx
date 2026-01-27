import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRef } from 'react'
import DealCard from './DealCard'

interface Deal {
  id: string
  title: string
  amount: number
  stage: string
  probability: number
  order: number
  contact?: {
    id: string
    name: string
    phone?: string
  }
  manager?: {
    id: string
    name: string
  }
  createdAt: string
}

interface DraggableDealCardProps {
  deal: Deal
  onClick?: () => void
}

export default function DraggableDealCard({ deal, onClick }: DraggableDealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: deal.id })

  const wasDragged = useRef(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab'
  }

  // Отслеживаем начало драга
  if (transform && !wasDragged.current) {
    wasDragged.current = true
  }

  // Сбрасываем флаг после окончания драга
  if (!transform && !isDragging && wasDragged.current) {
    setTimeout(() => {
      wasDragged.current = false
    }, 0)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Не вызываем onClick если был драг
    if (wasDragged.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick?.()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <DealCard deal={deal} onClick={handleClick} />
    </div>
  )
}
