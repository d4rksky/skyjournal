import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type {
  Account,
  FieldDefinition,
  Journal,
  PendingImage,
  Strategy,
  SymbolItem
} from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FieldControl } from '@/components/fields/FieldControl'
import { ImageDropzone } from '@/components/journal/ImageDropzone'

export type JournalPageProps = {
  account: Account
  strategy: Strategy
  symbols: SymbolItem[]
  editingJournal?: Journal | null
  onBack: () => void
  onSaved: () => void
  onSymbolsChange: () => void
}

const mimeFromDataUrl = (dataUrl: string): string => {
  const match = /^data:([^;]+);/.exec(dataUrl)
  return match?.[1] ?? 'image/png'
}

const journalToPendingImages = (journal: Journal): PendingImage[] =>
  journal.images.map((image) => ({
    id: image.id,
    dataUrl: image.dataUrl,
    mime: mimeFromDataUrl(image.dataUrl)
  }))

const buildInitialValues = (
  fields: FieldDefinition[],
  account: Account,
  journal?: Journal | null
): Record<string, string | string[]> => {
  if (journal) {
    const values: Record<string, string | string[]> = {}
    for (const field of fields) {
      const existing = journal.values[field.key]
      if (existing !== undefined) {
        values[field.key] = existing
        continue
      }
      if (
        field.type === 'multiSelect' ||
        field.type === 'checkboxRow' ||
        field.type === 'checkboxColumn'
      ) {
        values[field.key] = []
        continue
      }
      values[field.key] = ''
    }
    return values
  }

  const values: Record<string, string | string[]> = {}
  for (const field of fields) {
    if (field.builtinKey === 'risk' && account.fixedRisk && account.fixedRiskValue) {
      values[field.key] = account.fixedRiskValue
      continue
    }
    if (
      field.type === 'multiSelect' ||
      field.type === 'checkboxRow' ||
      field.type === 'checkboxColumn'
    ) {
      values[field.key] = []
      continue
    }
    values[field.key] = ''
  }
  return values
}

const valuesEqual = (
  a: Record<string, string | string[]>,
  b: Record<string, string | string[]>
): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const left = a[key]
    const right = b[key]
    if (Array.isArray(left) || Array.isArray(right)) {
      const la = Array.isArray(left) ? left : []
      const ra = Array.isArray(right) ? right : []
      if (la.length !== ra.length || la.some((item, index) => item !== ra[index])) {
        return false
      }
      continue
    }
    if ((left ?? '') !== (right ?? '')) return false
  }
  return true
}

const imagesEqual = (a: PendingImage[], b: PendingImage[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((image, index) => image.id === b[index]?.id)
}

const applyCarryOverSymbol = (
  nextValues: Record<string, string | string[]>,
  fields: FieldDefinition[],
  carriedSymbol: string | undefined
): Record<string, string | string[]> => {
  if (typeof carriedSymbol !== 'string') return nextValues
  const symbolField = fields.find((field) => field.builtinKey === 'symbol')
  if (symbolField) {
    nextValues[symbolField.key] = carriedSymbol
  }
  return nextValues
}

export const JournalPage = ({
  account,
  strategy,
  symbols,
  editingJournal = null,
  onBack,
  onSaved,
  onSymbolsChange
}: JournalPageProps) => {
  const isEdit = editingJournal !== null
  const enabledFields = useMemo(
    () => strategy.fields.filter((field) => field.enabled),
    [strategy.fields]
  )
  const formFields = useMemo(
    () => enabledFields.filter((field) => field.builtinKey !== 'description'),
    [enabledFields]
  )
  const descriptionField = useMemo(
    () => enabledFields.find((field) => field.builtinKey === 'description'),
    [enabledFields]
  )

  const initialValuesRef = useRef<Record<string, string | string[]>>({})
  const initialImagesRef = useRef<PendingImage[]>([])
  const initialRiskFixedRef = useRef(account.fixedRisk)
  // Survives resetForm after save-and-next → onSaved → refreshAccounts (new account ref).
  const carryOverDefaultsRef = useRef<{ symbol?: string }>({})

  const [values, setValues] = useState<Record<string, string | string[]>>({})
  const [images, setImages] = useState<PendingImage[]>([])
  const [riskFixed, setRiskFixed] = useState(account.fixedRisk)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)

  const resetForm = useCallback(() => {
    const nextValues = buildInitialValues(enabledFields, account, editingJournal)
    if (!editingJournal) {
      applyCarryOverSymbol(nextValues, enabledFields, carryOverDefaultsRef.current.symbol)
    }
    const nextImages = editingJournal ? journalToPendingImages(editingJournal) : []
    const nextRiskFixed = editingJournal ? editingJournal.riskFixed : account.fixedRisk
    initialValuesRef.current = nextValues
    initialImagesRef.current = nextImages
    initialRiskFixedRef.current = nextRiskFixed
    setValues(nextValues)
    setImages(nextImages)
    setRiskFixed(nextRiskFixed)
    setError(null)
  }, [enabledFields, account, editingJournal])

  useEffect(() => {
    carryOverDefaultsRef.current = {}
  }, [strategy.id, account.id, editingJournal?.id])

  useEffect(() => {
    resetForm()
  }, [resetForm, strategy.id, account.id, editingJournal?.id])

  const isDirty =
    !valuesEqual(values, initialValuesRef.current) ||
    !imagesEqual(images, initialImagesRef.current) ||
    riskFixed !== initialRiskFixedRef.current

  const handleFieldChange = (field: FieldDefinition, next: string | string[]) => {
    setValues((prev) => ({ ...prev, [field.key]: next }))
  }

  const handleCreateSymbol = async (label: string) => {
    await api.symbols.create(label)
    onSymbolsChange()
  }

  const persistJournal = async (): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const payloadImages = images.map((image) => ({
        id: image.id,
        mime: image.mime,
        dataBase64: image.dataUrl.includes(',') ? image.dataUrl.split(',')[1] : image.dataUrl
      }))
      const payload = {
        accountId: account.id,
        strategyId: strategy.id,
        values,
        riskFixed,
        images: payloadImages
      }
      if (isEdit && editingJournal) {
        await api.journals.update(editingJournal.id, payload)
      } else {
        await api.journals.create(payload)
      }
      onSaved()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق بود.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    const ok = await persistJournal()
    if (!ok) return
    onBack()
  }

  const handleSaveAndNext = async () => {
    if (isEdit) {
      await handleSave()
      return
    }
    const keepRisk = riskFixed
    const riskField = enabledFields.find((field) => field.builtinKey === 'risk')
    const keptRiskValue =
      keepRisk && riskField && typeof values[riskField.key] === 'string'
        ? values[riskField.key]
        : undefined
    const symbolField = enabledFields.find((field) => field.builtinKey === 'symbol')
    const keptSymbolValue =
      symbolField && typeof values[symbolField.key] === 'string'
        ? values[symbolField.key]
        : undefined
    // Set before persist: onSaved → refreshAccounts rebuilds account and re-runs resetForm.
    carryOverDefaultsRef.current = {
      symbol: typeof keptSymbolValue === 'string' ? keptSymbolValue : undefined
    }

    const ok = await persistJournal()
    if (!ok) {
      carryOverDefaultsRef.current = {}
      return
    }

    const nextValues = applyCarryOverSymbol(
      buildInitialValues(enabledFields, {
        ...account,
        fixedRisk: keepRisk,
        fixedRiskValue:
          typeof keptRiskValue === 'string' ? keptRiskValue : account.fixedRiskValue
      }),
      enabledFields,
      carryOverDefaultsRef.current.symbol
    )
    if (keepRisk && riskField && typeof keptRiskValue === 'string') {
      nextValues[riskField.key] = keptRiskValue
    }
    initialValuesRef.current = nextValues
    initialImagesRef.current = []
    initialRiskFixedRef.current = keepRisk
    setValues(nextValues)
    setImages([])
    setRiskFixed(keepRisk)
  }

  const handleBackRequest = () => {
    if (isDirty) {
      setLeaveConfirmOpen(true)
      return
    }
    onBack()
  }

  const handleConfirmLeave = () => {
    setLeaveConfirmOpen(false)
    onBack()
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBackRequest}
            className="gap-2"
            aria-label="بازگشت"
          >
            <ArrowRight className="size-4" aria-hidden />
            بازگشت
          </Button>
          <h1 className="text-lg font-semibold text-ink">
            {isEdit ? `ویرایش · ${strategy.name}` : strategy.name}
          </h1>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-2" dir="ltr">
          <div dir="rtl" className="flex min-h-0 flex-col border-r border-line">
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="mx-auto flex max-w-xl flex-col gap-5">
                {formFields.map((field) => (
                  <div key={field.id}>
                    <label className="mb-2 block text-sm font-medium text-ink">{field.label}</label>
                    <FieldControl
                      field={field}
                      value={values[field.key]}
                      onChange={(next) => handleFieldChange(field, next)}
                      symbols={symbols}
                      onCreateSymbol={(label) => void handleCreateSymbol(label)}
                    />
                  </div>
                ))}

                <div className="rounded-2xl border border-line bg-card p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={riskFixed}
                      onCheckedChange={(checked) => setRiskFixed(checked === true)}
                      aria-label="ریسک ثابت"
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">ریسک ثابت</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        اگر روشن باشد، همین درصد ریسک برای ژورنال بعدی این حساب پیش‌فرض می‌شود.
                      </span>
                    </span>
                  </label>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>

            <footer className="sticky bottom-0 flex shrink-0 flex-wrap gap-3 border-t border-line bg-card p-4">
              <Button
                type="button"
                size="lg"
                disabled={saving}
                onClick={() => void handleSave()}
                className="min-w-[8rem] flex-1"
              >
                {saving ? 'در حال ذخیره…' : 'ذخیره'}
              </Button>
              {!isEdit && (
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleSaveAndNext()}
                  className="min-w-[8rem] flex-1"
                >
                  ذخیره و ژورنال بعدی
                </Button>
              )}
            </footer>
          </div>

          <div dir="rtl" className="flex min-h-0 flex-col overflow-y-auto p-6">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
              <ImageDropzone images={images} onChange={setImages} />
              {descriptionField && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-ink">توضیحات</label>
                  <FieldControl
                    field={descriptionField}
                    value={values[descriptionField.key]}
                    onChange={(next) => handleFieldChange(descriptionField, next)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>خروج از فرم</DialogTitle>
            <DialogDescription>تغییرات ذخیره نشده پاک شود؟</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setLeaveConfirmOpen(false)}>
              ادامه ویرایش
            </Button>
            <Button type="button" onClick={handleConfirmLeave}>
              بله، بازگشت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
