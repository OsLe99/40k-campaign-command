export const ARMY_LIST_MAX_BYTES = 8 * 1024 * 1024
export const ARMY_LIST_ACCEPT = '.json,.ros,.rosz,.txt,.pdf'
const mimeTypes = {
  json: 'application/json', ros: 'application/xml', rosz: 'application/zip',
  txt: 'text/plain', pdf: 'application/pdf',
} as const
export type ArmyListExtension = keyof typeof mimeTypes
export function validateArmyList(file: Pick<File, 'name' | 'size'>) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !Object.hasOwn(mimeTypes, extension)) throw new Error('Choose a JSON, ROS, ROSZ, TXT, or PDF export.')
  if (!file.size) throw new Error('The army list file is empty.')
  if (file.size > ARMY_LIST_MAX_BYTES) throw new Error('Army list files must be no larger than 8 MiB.')
  // Keep the display name; never use it as a Storage key or URL.
  if (file.name.length > 180 || /[/\\]/.test(file.name) || [...file.name].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new Error('Use a filename of at most 180 characters without slashes or control characters.')
  return { extension: extension as ArmyListExtension, contentType: mimeTypes[extension as ArmyListExtension] }
}
export function armyListDownloadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').slice(0, 180) || 'army-list'
}
export function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}
