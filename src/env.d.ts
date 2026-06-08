import type { ApiType } from '../electron/preload/index'

declare global {
  interface Window {
    api: ApiType
  }
}
