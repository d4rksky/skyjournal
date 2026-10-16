import type { FieldDefinition } from './types'

const rewardOptions = [
  { id: '1', label: '1' },
  { id: '1.5', label: '1.5' },
  { id: '2', label: '2' },
  { id: '2.5', label: '2.5' },
  { id: '3', label: '3' },
  { id: '4', label: '4' },
  { id: '5', label: '5' },
  { id: '6', label: '6' }
]

const riskOptions = [
  { id: '0.25', label: '0.25' },
  { id: '0.5', label: '0.5' },
  { id: '0.75', label: '0.75' },
  { id: '1', label: '1' },
  { id: '1.5', label: '1.5' },
  { id: '2', label: '2' },
  { id: '3', label: '3' }
]

export const createBuiltinFields = (): FieldDefinition[] => [
  {
    id: crypto.randomUUID(),
    key: 'side',
    label: 'نوع معامله',
    type: 'segmented',
    options: [
      { id: 'buy', label: 'خرید' },
      { id: 'sell', label: 'فروش' },
      { id: 'unknown', label: 'نامشخص' }
    ],
    enabled: true,
    builtin: true,
    builtinKey: 'side'
  },
  {
    id: crypto.randomUUID(),
    key: 'result',
    label: 'نتیجه',
    type: 'segmented',
    options: [
      { id: 'profit', label: 'سود' },
      { id: 'loss', label: 'ضرر' },
      { id: 'risk_free', label: 'ریسک‌فری' }
    ],
    enabled: true,
    builtin: true,
    builtinKey: 'result'
  },
  {
    id: crypto.randomUUID(),
    key: 'symbol',
    label: 'نماد',
    type: 'combobox',
    options: [],
    enabled: true,
    builtin: true,
    builtinKey: 'symbol'
  },
  {
    id: crypto.randomUUID(),
    key: 'tradeDate',
    label: 'تاریخ معامله',
    type: 'date',
    options: [],
    enabled: true,
    builtin: true,
    builtinKey: 'tradeDate'
  },
  {
    id: crypto.randomUUID(),
    key: 'reward',
    label: 'ریوارد',
    type: 'segmented',
    options: rewardOptions.map((option) => ({ ...option })),
    enabled: true,
    builtin: true,
    builtinKey: 'reward'
  },
  {
    id: crypto.randomUUID(),
    key: 'maxReward',
    label: 'بیشترین ریوارد',
    type: 'segmented',
    options: rewardOptions.map((option) => ({ ...option })),
    enabled: true,
    builtin: true,
    builtinKey: 'maxReward'
  },
  {
    id: crypto.randomUUID(),
    key: 'risk',
    label: 'ریسک',
    type: 'segmented',
    options: riskOptions,
    enabled: true,
    builtin: true,
    builtinKey: 'risk'
  },
  {
    id: crypto.randomUUID(),
    key: 'description',
    label: 'توضیحات',
    type: 'textarea',
    options: [],
    enabled: true,
    builtin: true,
    builtinKey: 'description'
  }
]
