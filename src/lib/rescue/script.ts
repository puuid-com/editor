import { createIsomorphicFn } from '@tanstack/react-start'

import { installRescue } from './rescue'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'
import type { RescueText } from './rescue'

// Placeholders the screen fills in itself, passed through the messages.
const name = '{name}'
const date = '{date}'

function rescueText(): RescueText {
  return {
    titleFatal: m.rescue_title_fatal(),
    bodyFatal: m.rescue_body_fatal(),
    titleStuck: m.rescue_title_stuck(),
    bodyStuck: m.rescue_body_stuck(),
    titleBlocked: m.rescue_title_blocked(),
    bodyBlocked: m.rescue_body_blocked(),
    titleManual: m.rescue_title_manual(),
    bodyManual: m.rescue_body_manual(),
    lastStep: m.rescue_last_step({ step: '{step}' }),
    keepData: m.rescue_keep_data(),
    downloadBackup: m.rescue_download_backup(),
    downloadFiles: m.rescue_download_files(),
    backupDone: m.rescue_backup_done({ name }),
    filesDone: m.rescue_files_done({ name }),
    noFiles: m.rescue_no_files(),
    readFailed: m.rescue_read_failed({ error: '{error}' }),
    backupName: m.backup_file_name({ date }),
    filesName: m.rescue_files_name({ date }),
    deletedFolder: m.rescue_deleted_folder(),
    getHelp: m.rescue_get_help(),
    askClaude: m.rescue_ask_claude(),
    askChatGpt: m.rescue_ask_chatgpt(),
    copyDetails: m.rescue_copy_details(),
    copied: m.rescue_copied(),
    copyFailed: m.rescue_copy_failed(),
    helpNote: m.rescue_help_note(),
    tryAgain: m.rescue_try_again(),
    reload: m.reload_page(),
    resetLayout: m.rescue_reset_layout(),
    resetNote: m.rescue_reset_note(),
    erase: m.rescue_erase(),
    eraseConfirm: m.rescue_erase_confirm(),
    eraseNoBackup: m.rescue_erase_no_backup(),
    eraseBlocked: m.rescue_erase_blocked(),
    close: m.rescue_close(),
    keepWaiting: m.rescue_keep_waiting(),
    showLog: m.rescue_show_log(),
    logEmpty: m.rescue_log_empty(),
    unexpected: m.rescue_unexpected(),
    details: m.rescue_details(),
    aiPrompt: m.rescue_ai_prompt({
      url: '{url}',
      problem: '{problem}',
      report: '{report}',
    }),
  }
}

/**
 * The inline script that installs the recovery screen, in the page's
 * language. Built on the server only: the browser runs it from the HTML and
 * never downloads it with the app.
 */
export const rescueScript = createIsomorphicFn()
  .server(() => {
    const args = JSON.stringify([
      rescueText(),
      { version: appVersion, dev: import.meta.env.DEV },
    ])
      // Nothing in the strings can close the script tag.
      .replace(/</g, '\\u003c')
    return `(${installRescue.toString()}).apply(null, ${args})`
  })
  .client(() => '')
