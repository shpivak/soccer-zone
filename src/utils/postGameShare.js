export const POST_GAME_SHARE_STORAGE_KEY = 'soccer-zone-post-game-share'

/** Coach preference (per device): open the photo + WhatsApp window after every saved game. Default on. */
export const isPostGameShareEnabled = () => {
  try {
    return localStorage.getItem(POST_GAME_SHARE_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export const setPostGameShareEnabled = (enabled) => {
  try {
    localStorage.setItem(POST_GAME_SHARE_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // storage unavailable — preference just won't persist
  }
}
