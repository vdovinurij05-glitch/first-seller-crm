import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch gap-2 group"
    >
      {/* Drag Handle - видимый и draggable */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-lg transition-colors touch-none"
      >
        <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
      </div>

      {/* Deal Card - кликабельная, но не draggable */}
      <div className="flex-1 min-w-0">
        <DealCard deal={deal} onClick={onClick} />
      </div>
    </div>
  )
}
