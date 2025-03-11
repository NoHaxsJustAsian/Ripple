import { ReplaceStep, Step } from '@tiptap/pm/transform'
import { TextSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Slice, Fragment } from '@tiptap/pm/model'
import { Extension, Mark, getMarkRange, getMarksBetween, isMarkActive, mergeAttributes } from '@tiptap/core'
import type { CommandProps, Editor, MarkRange } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

const LOG_ENABLED = true

export const MARK_DELETION = 'deletion'
export const MARK_INSERTION = 'insertion'
export const EXTENSION_NAME = 'trackchange'

// Track Change Operations
export const TRACK_COMMAND_ACCEPT = 'accept'
export const TRACK_COMMAND_ACCEPT_ALL = 'accept-all'
export const TRACK_COMMAND_REJECT = 'reject'
export const TRACK_COMMAND_REJECT_ALL = 'reject-all'

export type TRACK_COMMAND_TYPE = 'accept' | 'accept-all' | 'reject' | 'reject-all'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackchange: {
      /**
       * Change track change extension enabled status.
       */
      setTrackChangeStatus: (enabled: boolean) => ReturnType,
      getTrackChangeStatus: () => ReturnType,
      toggleTrackChangeStatus: () => ReturnType,
      /**
       * Accept one change (based on current selection or nearest mark).
       */
      acceptChange: () => ReturnType,
      /**
       * Accept all changes: remove all deletion marks and unwrap insertion marks.
       */
      acceptAllChanges: () => ReturnType,
      /**
       * Reject one change.
       */
      rejectChange: () => ReturnType,
      /**
       * Reject all changes: remove all insertion marks and unwrap deletion marks.
       */
      rejectAllChanges: () => ReturnType
    }
  }
}

// Insertion mark definition
export const InsertionMark = Mark.create({
  name: MARK_INSERTION,
  addAttributes() {
    return {
      class: {
        default: 'insertion',
        rendered: true
      }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span.insertion',
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  }
})

// Deletion mark definition
export const DeletionMark = Mark.create({
  name: MARK_DELETION,
  addAttributes() {
    return {
      class: {
        default: 'deletion',
        rendered: true
      }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span.deletion',
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  }
})

// For IME input handling (this code is kept in case you ever want to adjust IME behavior)
const IME_STATUS_NORMAL = 0
const IME_STATUS_START = 1
const IME_STATUS_CONTINUE = 2
const IME_STATUS_FINISHED = 3
type IME_STATUS_TYPE = 0 | 1 | 2 | 3
let composingStatus: IME_STATUS_TYPE = 0
let isStartInput = false

// Get the current extension instance.
const getSelfExt = (editor: Editor) =>
  editor.extensionManager.extensions.find(item => item.type === 'extension' && item.name === EXTENSION_NAME) as Extension

// Get current minute timestamp.
const getMinuteTime = () => Math.round(new Date().getTime() / 1000 / 60) * 1000 * 60

/**
 * Process accept or reject commands on track changes.
 */
const changeTrack = (opType: TRACK_COMMAND_TYPE, param: CommandProps) => {
  const { editor, tr } = param
  const { from, to } = editor.state.selection
  let markRanges: Array<MarkRange> = []

  // When no selection, try to detect the mark near the cursor.
  if ((opType === TRACK_COMMAND_ACCEPT || opType === TRACK_COMMAND_REJECT) && from === to) {
    // Check for both insertion and deletion marks at cursor position
    const marks = editor.state.selection.$from.marks()
    const insertionMark = marks.find(m => m.type.name === MARK_INSERTION)
    const deletionMark = marks.find(m => m.type.name === MARK_DELETION)
    
    if (insertionMark) {
      const range = getMarkRange(editor.state.selection.$from, editor.state.doc.type.schema.marks.insertion)
      if (range) {
        markRanges.push({
          mark: insertionMark,
          from: range.from,
          to: range.to
        })
      }
    }
    if (deletionMark) {
      const range = getMarkRange(editor.state.selection.$from, editor.state.doc.type.schema.marks.deletion)
      if (range) {
        markRanges.push({
          mark: deletionMark,
          from: range.from,
          to: range.to
        })
      }
    }
  } else if (opType === TRACK_COMMAND_ACCEPT_ALL || opType === TRACK_COMMAND_REJECT_ALL) {
    // Get all marks in the document
    markRanges = getMarksBetween(0, editor.state.doc.content.size, editor.state.doc)
    opType = opType === TRACK_COMMAND_ACCEPT_ALL ? TRACK_COMMAND_ACCEPT : TRACK_COMMAND_REJECT
  } else {
    // Get marks in the current selection
    markRanges = getMarksBetween(from, to, editor.state.doc)
  }

  // Filter to only track change marks
  markRanges = markRanges.filter(mr => mr.mark.type.name === MARK_DELETION || mr.mark.type.name === MARK_INSERTION)
  if (!markRanges.length) { return false }

  // Sort ranges from end to start to avoid position shifts
  markRanges.sort((a, b) => b.from - a.from)

  let offset = 0
  const removeInsertionMark = editor.state.doc.type.schema.marks.insertion.create()
  const removeDeletionMark = editor.state.doc.type.schema.marks.deletion.create()

  markRanges.forEach(mr => {
    const isAcceptInsert = opType === TRACK_COMMAND_ACCEPT && mr.mark.type.name === MARK_INSERTION
    const isRejectDelete = opType === TRACK_COMMAND_REJECT && mr.mark.type.name === MARK_DELETION
    if (isAcceptInsert || isRejectDelete) {
      // For accept on insert marks or reject on delete marks: remove the mark
      tr.removeMark(mr.from, mr.to, removeInsertionMark.type)
      tr.removeMark(mr.from, mr.to, removeDeletionMark.type)
    } else {
      // Otherwise, delete the content
      tr.delete(mr.from, mr.to)
    }
  })

  if (tr.steps.length) {
    tr.setMeta('trackManualChanged', true)
    const newState = editor.state.apply(tr)
    editor.view.updateState(newState)
  }
  return false
}

interface TrackChangeOptions {
  enabled: boolean;
  onTrackChange?: (type: 'insertion' | 'deletion', from: number, to: number, text: string) => string;
}

interface TrackChangeStorage {
  enabled: boolean;
  activeChangeId?: string;
  lastChangeType?: 'insertion' | 'deletion';
  lastChangeFrom?: number;
  lastChangeTo?: number;
  accumulatedText?: string;
  isComposing?: boolean;
  lastCursorPos?: number; // Track last cursor position
}

export const TrackChangeExtension = Extension.create<TrackChangeOptions, TrackChangeStorage>({
  name: EXTENSION_NAME,

  addStorage() {
    return {
      enabled: false,
      activeChangeId: undefined,
      lastChangeType: undefined,
      lastChangeFrom: undefined,
      lastChangeTo: undefined,
      accumulatedText: undefined,
      isComposing: false,
      lastCursorPos: undefined,
    };
  },

  onCreate() {
    if (this.options.enabled) {
      console.log('Track Change enabled')
    }

    // Set up focus management
    if (this.editor?.view?.dom) {
      let blurTimeout: NodeJS.Timeout;

      this.editor.view.dom.addEventListener('blur', () => {
        // Clear any existing timeout
        if (blurTimeout) clearTimeout(blurTimeout);

        // Set a new timeout
        blurTimeout = setTimeout(() => {
          // Only reset composition state if we're truly losing focus
          if (!this.editor?.view?.hasFocus() && !document.activeElement?.closest('.comments-panel')) {
            // Just mark that we're not actively composing
            this.storage.isComposing = false;
            
            // If we have an active change, finalize it by creating a new comment
            if (this.storage.activeChangeId && 
                this.storage.lastChangeType && 
                this.storage.lastChangeFrom !== undefined && 
                this.storage.lastChangeTo !== undefined && 
                this.storage.accumulatedText) {
              
              // Create a final comment with the accumulated changes
              if (this.options.onTrackChange) {
                this.options.onTrackChange(
                  this.storage.lastChangeType,
                  this.storage.lastChangeFrom,
                  this.storage.lastChangeTo,
                  this.storage.accumulatedText
                );
              }
              
              // Reset change tracking state
              this.storage.activeChangeId = undefined;
              this.storage.lastChangeType = undefined;
              this.storage.lastChangeFrom = undefined;
              this.storage.lastChangeTo = undefined;
              this.storage.accumulatedText = undefined;
              this.storage.lastCursorPos = undefined;
            }
          }
        }, 200);
      });

      this.editor.view.dom.addEventListener('focus', () => {
        if (blurTimeout) clearTimeout(blurTimeout);
        
        // Only start a new composition if we don't have an active one
        if (!this.storage.isComposing) {
          this.storage.isComposing = true;
          // Start with a clean state on new focus
          this.storage.activeChangeId = undefined;
          this.storage.lastCursorPos = undefined;
        }
      });

      // Handle composition events
      this.editor.view.dom.addEventListener('compositionstart', () => {
        this.storage.isComposing = true;
      });

      this.editor.view.dom.addEventListener('compositionend', () => {
        this.storage.isComposing = false;
      });
    }
  },

  addExtensions() {
    return [InsertionMark, DeletionMark]
  },

  addCommands: () => ({
    setTrackChangeStatus: (enabled: boolean) => ({ editor }: CommandProps) => {
      const ext = getSelfExt(editor)
      ext.options.enabled = enabled
      return false
    },
    toggleTrackChangeStatus: () => ({ editor }: CommandProps) => {
      const ext = getSelfExt(editor)
      ext.options.enabled = !ext.options.enabled
      return false
    },
    getTrackChangeStatus: () => ({ editor }: CommandProps) => {
      const ext = getSelfExt(editor)
      return ext.options.enabled
    },
    acceptChange: () => (param: CommandProps) => {
      changeTrack('accept', param)
      return false
    },
    acceptAllChanges: () => (param: CommandProps) => {
      changeTrack('accept-all', param)
      return false
    },
    rejectChange: () => (param: CommandProps) => {
      changeTrack('reject', param)
      return false
    },
    rejectAllChanges: () => (param: CommandProps) => {
      changeTrack('reject-all', param)
      return false
    }
  }),

  onSelectionUpdate() {
    if (!this.editor || !this.editor.state || !this.editor.view) return;
    
    const { from, to } = this.editor.state.selection;
    LOG_ENABLED &&
      console.log('Selection status:', from, to, this.editor.view.composing);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey<any>('composing-check'),
        props: {
          handleDOMEvents: {
            compositionstart: () => {
              LOG_ENABLED && console.log('IME input started')
              isStartInput = true
              return false
            },
            compositionupdate: () => {
              LOG_ENABLED && console.log('IME composition update')
              composingStatus = IME_STATUS_CONTINUE
              return false
            }
          }
        }
      })
    ]
  },

  onTransaction({ transaction, editor }) {
    if (!transaction.docChanged) return;
    if (transaction.getMeta('trackManualChanged')) return;
    if (transaction.getMeta('history$')) return;
    
    const syncMeta = transaction.getMeta('y-sync$')
    if (syncMeta?.isChangeOrigin) return;

    const ext = getSelfExt(editor)
    if (!ext.options.enabled) return;

    const steps = transaction.steps;
    const selection = transaction.selection || editor.state.selection;
    const cursorPos = selection.from;

    // Determine if we should start a new change group based on editing context
    const shouldStartNewGroup = () => {
      if (!this.storage.activeChangeId) return true;
      if (!this.storage.lastCursorPos) return true;

      // If cursor has moved more than 5 characters away from last edit position,
      // consider it a new editing context
      const cursorMovement = Math.abs(cursorPos - this.storage.lastCursorPos);
      if (cursorMovement > 5) return true;

      return false;
    };

    if (shouldStartNewGroup()) {
      // Start a new change group
      this.storage.activeChangeId = `change-${Date.now()}`;
      this.storage.accumulatedText = '';
      this.storage.lastChangeFrom = undefined;
      this.storage.lastChangeTo = undefined;
      this.storage.isComposing = true;
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as ReplaceStep;
      if (!(step instanceof ReplaceStep)) continue;

      const isInsertion = step.slice.content.size > 0;
      const isDeletion = step.from !== step.to;

      if (isInsertion) {
        const from = step.from;
        const to = step.from + step.slice.content.size;
        const newText = step.slice.content.textBetween(0, step.slice.content.size, ' ');

        // Update the change range to encompass all changes
        if (this.storage.lastChangeFrom === undefined || from < this.storage.lastChangeFrom) {
          this.storage.lastChangeFrom = from;
        }
        if (this.storage.lastChangeTo === undefined || to > this.storage.lastChangeTo) {
          this.storage.lastChangeTo = to;
        }

        // Add the new text to accumulated changes
        this.storage.accumulatedText = (this.storage.accumulatedText || '') + newText;
        
        // Add mark for the new text
        editor.commands.setMark(MARK_INSERTION);
      }

      if (isDeletion) {
        const doc = transaction.docs[i];
        if (!doc) continue;
        
        const deletedText = doc.textBetween(step.from, step.to, ' ');
        
        // Update the change range to encompass all changes
        if (this.storage.lastChangeFrom === undefined || step.from < this.storage.lastChangeFrom) {
          this.storage.lastChangeFrom = step.from;
        }
        if (this.storage.lastChangeTo === undefined || step.to > this.storage.lastChangeTo) {
          this.storage.lastChangeTo = step.to;
        }

        // Add the deleted text to accumulated changes
        this.storage.accumulatedText = (this.storage.accumulatedText || '') + deletedText;

        // Create deletion mark
        const tr = editor.state.tr;
        tr.addMark(step.from, step.to, editor.schema.marks.deletion.create());
        editor.view.dispatch(tr);
      }

      // Update comment if we have enough information
      if (this.options.onTrackChange && 
          this.storage.lastChangeFrom !== undefined && 
          this.storage.lastChangeTo !== undefined && 
          this.storage.accumulatedText) {
        this.options.onTrackChange(
          isDeletion ? 'deletion' : 'insertion',
          this.storage.lastChangeFrom,
          this.storage.lastChangeTo,
          this.storage.accumulatedText
        );
      }
    }

    // Update last cursor position
    this.storage.lastCursorPos = cursorPos;

    // Handle composition state
    if (editor.view.composing) {
      this.storage.isComposing = true;
    } else if (this.storage.isComposing) {
      // Composition just ended - finalize the current change group
      this.storage.isComposing = false;
      this.storage.activeChangeId = undefined;
    }
  }
})

export default TrackChangeExtension
