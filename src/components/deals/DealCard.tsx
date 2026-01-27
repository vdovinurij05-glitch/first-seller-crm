import { User, Phone } from 'lucide-react'

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

interface DealCardProps {
  deal: Deal
  onClick?: () => void
}

export default function DealCard({ deal, onClick }: DealCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer"
    >
      <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{deal.title}</h4>

      <div className="mb-3">
        <span className="font-bold text-green-600 text-lg">{formatCurrency(deal.amount)}</span>
      </div>

      {deal.contact && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <User className="w-4 h-4" />
          <span className="line-clamp-1">{deal.contact.name}</span>
        </div>
      )}

      {deal.contact?.phone && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Phone className="w-4 h-4" />
          <span>{deal.contact.phone}</span>
        </div>
      )}

      {deal.manager && (
        <div className="pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">{deal.manager.name}</span>
        </div>
      )}
    </div>
  )
}
