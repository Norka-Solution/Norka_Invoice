interface Props {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export default function Modal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel, danger }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A1714]/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-xl border border-[#E5DFD6] w-full max-w-sm p-6 space-y-4">
        <div>
          <p className="font-semibold text-[#1A1714] text-sm">{title}</p>
          <p className="text-sm text-[#6B6259] mt-1">{message}</p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onCancel} className="btn-ghost btn-sm px-4">Cancel</button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn-danger btn-sm px-4' : 'btn-primary btn-sm px-4'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
