import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'

export const saveTextFile = async (
  defaultFileName: string,
  content: string
): Promise<string | null> => {
  const win = BrowserWindow.getFocusedWindow()
  const result = win
    ? await dialog.showSaveDialog(win, {
        title: 'ذخیره خروجی',
        defaultPath: defaultFileName,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
    : await dialog.showSaveDialog({
        title: 'ذخیره خروجی',
        defaultPath: defaultFileName,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })

  if (result.canceled || !result.filePath) return null
  writeFileSync(result.filePath, content, 'utf8')
  return result.filePath
}
