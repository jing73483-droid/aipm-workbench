/** AIPM workbench: project tree, create form, and split Markdown review. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Button, IconNewChatOutlineRegular, MarkdownText, Tag, type MarkdownLabels, type TagTone,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  AIPM_COMMAND_PATH, AIPM_STATE_PATH, GATES, PROJECT_TYPES, STATUSES,
  type AIPMCommand, type AIPMCommandResult, type AIPMGateId, type AIPMPendingChange,
  type AIPMProjectType, type AIPMStageId, type AIPMStatus, type AIPMWorkbenchState,
} from './protocol.ts'
import { NS, type WorkbenchKey } from './locales.ts'
import css from './WorkbenchPage.module.css'

/** Navigation back into the conversation after a project exists. */
export interface WorkbenchInjected {
  readonly continueInChat: (workspaceId?: string) => void
}

export type WorkbenchPageProps =
  PropsRuntime<'main'>
  & InjectFace<WorkbenchInjected>
  & PropsLocale<typeof NS>

const EMPTY: AIPMWorkbenchState = {
  workspaces: [],
  selectedPath: null,
  manifest: null,
  files: [],
  pending: [],
  openFile: null,
  builtinSkills: [],
}

/**
 * Render the AIPM workbench panel.
 * @param props - framework runtime, locale, and conversation handoff.
 * @returns the workbench page.
 */
export function WorkbenchPage({ t, continueInChat }: WorkbenchPageProps) {
  const [state, setState] = useState<AIPMWorkbenchState>(EMPTY)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [stageId, setStageId] = useState<AIPMStageId | null>(null)
  const [form, setForm] = useState({ name: '', type: 'feature' as AIPMProjectType, objective: '', rootDir: '' })
  const [stageStatus, setStageStatus] = useState<AIPMStatus>('not-started')
  const [stageNotes, setStageNotes] = useState('')
  const [snapshotMessage, setSnapshotMessage] = useState('aipm: checkpoint')
  const labels = useMemo<MarkdownLabels>(() => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
  }), [t])

  const refresh = useCallback(async (path?: string | null, file?: string | null) => {
    const query = new URLSearchParams()
    if (path) query.set('path', path)
    if (file) query.set('file', file)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetch(`${AIPM_STATE_PATH}${suffix}`)
    const body = await response.json() as AIPMWorkbenchState | AIPMCommandResult
    if (!response.ok) {
      throw new Error('error' in body && typeof body.error === 'string' ? body.error : t('loading'))
    }
    setState(body as AIPMWorkbenchState)
    setStatus('ready')
  }, [t])

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [refresh])

  useEffect(() => {
    if (form.rootDir === '' && state.workspaces[0] !== undefined) {
      setForm(current => ({ ...current, rootDir: state.workspaces[0]!.path }))
    }
  }, [form.rootDir, state.workspaces])

  const run = async (command: AIPMCommand, file?: string | null): Promise<void> => {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch(AIPM_COMMAND_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(command),
      })
      const body = await response.json() as AIPMCommandResult
      if (!body.ok || body.state === undefined) throw new Error(body.error ?? t('loading'))
      setState(body.state)
      if (file) setSelectedFile(file)
      if (body.snapshot !== undefined) {
        setNotice(`${body.snapshot.kind}: ${body.snapshot.commitMessage}`)
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const openFile = async (path: string): Promise<void> => {
    setPendingId(null)
    setSelectedFile(path)
    await refresh(state.selectedPath, path)
    const next = await (await fetch(`${AIPM_STATE_PATH}?path=${encodeURIComponent(state.selectedPath ?? '')}&file=${encodeURIComponent(path)}`)).json() as AIPMWorkbenchState
    setState(next)
    setDraft(next.openFile?.text ?? '')
  }

  const pending = state.pending.find(item => item.id === pendingId)
  const stage = state.manifest?.stages.find(item => item.id === stageId)
  const stageFiles = state.files.filter(entry => (
    entry.kind === 'file'
    && (stage === undefined || entry.relativePath === 'aipm.json' || entry.relativePath.startsWith(`${stage.dirName}/`))
  ))

  const onCreate = async (): Promise<void> => {
    await run({
      op: 'init',
      name: form.name,
      type: form.type,
      objective: form.objective,
      rootDir: form.rootDir,
    })
  }

  if (status === 'loading') {
    return <section className={css.page} data-testid="aipm-workbench"><p className={css.muted}>{t('loading')}</p></section>
  }
  if (status === 'error') {
    return (
      <section className={css.page} data-testid="aipm-workbench">
        <p className={css.error}>{t('error', { message: error })}</p>
        <Button variant="primary" size="sm" onClick={() => { setStatus('loading'); void refresh() }}>{t('retry')}</Button>
      </section>
    )
  }

  return (
    <section className={css.page} aria-label={t('title')} data-testid="aipm-workbench">
      <aside className={css.tree}>
        <div className={css.heading}>
          <h1>{t('title')}</h1>
          {state.manifest !== null && (
            <Button
              variant="primary"
              size="sm"
              icon={<IconNewChatOutlineRegular size={13} />}
              onClick={() => { continueInChat(workspaceIdFor(state)) }}
            >
              {t('continueChat')}
            </Button>
          )}
        </div>
        {notice !== '' && <p className={css.notice}>{notice}</p>}
        <WorkspaceList
          t={t}
          state={state}
          onSelect={(path) => { void refresh(path) }}
        />
        {state.manifest !== null && (
          <>
            <TreeSection title={t('stages')}>
              {state.manifest.stages.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={stageId === item.id ? css.rowActive : css.row}
                  onClick={() => {
                    setStageId(item.id)
                    setStageStatus(item.status)
                    setStageNotes(item.notes ?? '')
                    setPendingId(null)
                    setSelectedFile(null)
                  }}
                >
                  <span>{item.order}. {item.name}</span>
                  <Tag tone={statusTone(item.status)}>{t(statusKey(item.status))}</Tag>
                </button>
              ))}
            </TreeSection>
            <TreeSection title={t('files')}>
              {stageFiles.length === 0 && <p className={css.muted}>{t('noFiles')}</p>}
              {stageFiles.map(entry => (
                <button
                  key={entry.path}
                  type="button"
                  className={selectedFile === entry.path ? css.rowActive : css.row}
                  onClick={() => { void openFile(entry.path) }}
                >
                  {entry.relativePath}
                </button>
              ))}
            </TreeSection>
            <TreeSection title={t('pending')}>
              {state.pending.length === 0 && <p className={css.muted}>{t('noPending')}</p>}
              {state.pending.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={pendingId === item.id ? css.rowActive : css.row}
                  onClick={() => { setPendingId(item.id); setSelectedFile(null) }}
                >
                  {fileName(item.path)}
                </button>
              ))}
            </TreeSection>
          </>
        )}
      </aside>
      <div className={css.pane}>
        {state.workspaces.length === 0 && <p className={css.muted}>{t('emptyWorkspaces')}</p>}
        {state.workspaces.length > 0 && state.manifest === null && (
          <CreateForm t={t} form={form} busy={busy} onChange={setForm} onCreate={() => { void onCreate() }} />
        )}
        {state.manifest !== null && stage !== undefined && pending === undefined && selectedFile === null && (
          <StageDetail
            t={t}
            stage={stage}
            status={stageStatus}
            notes={stageNotes}
            gates={state.manifest.initiationGates}
            snapshotMessage={snapshotMessage}
            busy={busy}
            onStatus={setStageStatus}
            onNotes={setStageNotes}
            onSnapshotMessage={setSnapshotMessage}
            onSave={() => { void run({ op: 'updateStage', rootDir: state.selectedPath, stageId: stage.id, status: stageStatus, notes: stageNotes }) }}
            onGate={(gateId, verdict) => { void run({ op: 'confirmGate', rootDir: state.selectedPath, gateId, verdict }) }}
            onSnapshot={() => { void run({ op: 'snapshot', rootDir: state.selectedPath, message: snapshotMessage }) }}
            onInstall={() => {
              void run({
                op: 'installSkill',
                sourceKind: 'builtin',
                source: 'project-initiation-report',
                scope: 'project',
                rootDir: state.selectedPath,
              })
            }}
          />
        )}
        {state.manifest !== null && selectedFile !== null && pending === undefined && (
          <SplitEditor
            t={t}
            labels={labels}
            path={selectedFile}
            draft={draft}
            onDraft={setDraft}
            busy={busy}
            onPropose={() => { void run({ op: 'propose', rootDir: state.selectedPath, path: selectedFile, newText: draft }) }}
            onSave={() => { void run({ op: 'writeFile', path: selectedFile, text: draft }, selectedFile) }}
          />
        )}
        {pending !== undefined && (
          <PendingReview
            t={t}
            change={pending}
            labels={labels}
            busy={busy}
            onApply={() => { void run({ op: 'applyChange', rootDir: state.selectedPath, changeId: pending.id }) }}
            onReject={() => { void run({ op: 'rejectChange', rootDir: state.selectedPath, changeId: pending.id }) }}
          />
        )}
      </div>
    </section>
  )
}

function WorkspaceList(props: {
  t: (key: WorkbenchKey) => string
  state: AIPMWorkbenchState
  onSelect: (path: string) => void
}) {
  if (props.state.workspaces.length === 0) return null
  return (
    <TreeSection title={props.t('fieldWorkspace')}>
      {props.state.workspaces.map(workspace => (
        <button
          key={workspace.id}
          type="button"
          className={props.state.selectedPath === workspace.path ? css.rowActive : css.row}
          onClick={() => { props.onSelect(workspace.path) }}
        >
          <span>{workspace.title}</span>
          {workspace.hasProject && <Tag tone="info">{props.state.manifest?.name ?? 'AIPM'}</Tag>}
        </button>
      ))}
    </TreeSection>
  )
}

function CreateForm(props: {
  t: (key: WorkbenchKey) => string
  form: { name: string; type: AIPMProjectType; objective: string; rootDir: string }
  busy: boolean
  onChange: (form: { name: string; type: AIPMProjectType; objective: string; rootDir: string }) => void
  onCreate: () => void
}) {
  const { t, form } = props
  return (
    <form
      className={css.form}
      onSubmit={(event) => { event.preventDefault(); props.onCreate() }}
    >
      <h2>{t('createTitle')}</h2>
      <p className={css.muted}>{t('createIntro')}</p>
      <label>
        {t('fieldName')}
        <input value={form.name} onChange={event => props.onChange({ ...form, name: event.target.value })} required />
      </label>
      <label>
        {t('fieldType')}
        <select value={form.type} onChange={event => props.onChange({ ...form, type: event.target.value as AIPMProjectType })}>
          {PROJECT_TYPES.map(type => <option key={type} value={type}>{t(typeKey(type))}</option>)}
        </select>
      </label>
      <label>
        {t('fieldObjective')}
        <textarea value={form.objective} onChange={event => props.onChange({ ...form, objective: event.target.value })} required rows={4} />
      </label>
      <label>
        {t('fieldWorkspace')}
        <input value={form.rootDir} onChange={event => props.onChange({ ...form, rootDir: event.target.value })} required />
      </label>
      <Button variant="primary" type="submit" disabled={props.busy}>{props.busy ? t('creating') : t('createAction')}</Button>
    </form>
  )
}

function StageDetail(props: {
  t: (key: WorkbenchKey) => string
  stage: { id: AIPMStageId; name: string; status: AIPMStatus }
  status: AIPMStatus
  notes: string
  gates: readonly { id: AIPMGateId; status: AIPMStatus }[]
  snapshotMessage: string
  busy: boolean
  onStatus: (status: AIPMStatus) => void
  onNotes: (notes: string) => void
  onSnapshotMessage: (message: string) => void
  onSave: () => void
  onGate: (gateId: AIPMGateId, verdict: 'pass' | 'supplement' | 'stop') => void
  onSnapshot: () => void
  onInstall: () => void
}) {
  const { t } = props
  return (
    <div className={css.form}>
      <h2>{props.stage.name}</h2>
      <label>
        {t('status')}
        <select value={props.status} onChange={event => props.onStatus(event.target.value as AIPMStatus)}>
          {STATUSES.map(status => <option key={status} value={status}>{t(statusKey(status))}</option>)}
        </select>
      </label>
      <label>
        {t('notes')}
        <textarea value={props.notes} onChange={event => props.onNotes(event.target.value)} rows={4} />
      </label>
      <Button variant="primary" size="sm" disabled={props.busy} onClick={props.onSave}>{t('saveStage')}</Button>
      {props.stage.id === 'project-initiation' && (
        <div>
          <h3>{t('gates')}</h3>
          {GATES.map(gateId => {
            const gate = props.gates.find(item => item.id === gateId)
            return (
              <div key={gateId} className={css.gateRow}>
                <span>{t(gateKey(gateId))}</span>
                <Tag tone={statusTone(gate?.status ?? 'not-started')}>{t(statusKey(gate?.status ?? 'not-started'))}</Tag>
                <Button size="sm" disabled={props.busy} onClick={() => { props.onGate(gateId, 'pass') }}>{t('verdict.pass')}</Button>
                <Button size="sm" disabled={props.busy} onClick={() => { props.onGate(gateId, 'supplement') }}>{t('verdict.supplement')}</Button>
                <Button size="sm" disabled={props.busy} onClick={() => { props.onGate(gateId, 'stop') }}>{t('verdict.stop')}</Button>
              </div>
            )
          })}
        </div>
      )}
      <label>
        {t('snapshotMessage')}
        <input value={props.snapshotMessage} onChange={event => props.onSnapshotMessage(event.target.value)} />
      </label>
      <div className={css.actions}>
        <Button size="sm" disabled={props.busy} onClick={props.onSnapshot}>{t('snapshotAction')}</Button>
        <Button size="sm" disabled={props.busy} onClick={props.onInstall}>{t('installSkill')}</Button>
      </div>
    </div>
  )
}

function SplitEditor(props: {
  t: (key: WorkbenchKey) => string
  labels: MarkdownLabels
  path: string
  draft: string
  busy: boolean
  onDraft: (value: string) => void
  onPropose: () => void
  onSave: () => void
}) {
  return (
    <div className={css.split}>
      <div className={css.splitHead}>
        <strong>{fileName(props.path)}</strong>
        <div className={css.actions}>
          <Button size="sm" variant="primary" disabled={props.busy} onClick={props.onPropose}>{props.t('propose')}</Button>
          <Button size="sm" disabled={props.busy} onClick={props.onSave}>{props.t('saveDirect')}</Button>
        </div>
      </div>
      <div className={css.splitBody}>
        <label className={css.editorPane}>
          {props.t('editor')}
          <textarea value={props.draft} onChange={event => props.onDraft(event.target.value)} />
        </label>
        <div className={css.previewPane}>
          <span>{props.t('preview')}</span>
          <MarkdownText text={props.draft} labels={props.labels} variant="compact" />
        </div>
      </div>
    </div>
  )
}

function PendingReview(props: {
  t: (key: WorkbenchKey) => string
  change: AIPMPendingChange
  labels: MarkdownLabels
  busy: boolean
  onApply: () => void
  onReject: () => void
}) {
  return (
    <div className={css.split}>
      <div className={css.splitHead}>
        <strong>{fileName(props.change.path)}</strong>
        <div className={css.actions}>
          <Button size="sm" variant="primary" disabled={props.busy} onClick={props.onApply}>{props.t('applyChange')}</Button>
          <Button size="sm" disabled={props.busy} onClick={props.onReject}>{props.t('rejectChange')}</Button>
        </div>
      </div>
      <div className={css.splitBody}>
        <div className={css.previewPane}>
          <span>{props.t('oldText')}</span>
          <MarkdownText text={props.change.oldText} labels={props.labels} variant="compact" />
        </div>
        <div className={css.previewPane}>
          <span>{props.t('newText')}</span>
          <MarkdownText text={props.change.newText} labels={props.labels} variant="compact" />
        </div>
      </div>
    </div>
  )
}

function TreeSection(props: { title: string; children: ReactNode }) {
  return (
    <div className={css.section}>
      <h2>{props.title}</h2>
      {props.children}
    </div>
  )
}

function workspaceIdFor(state: AIPMWorkbenchState): string | undefined {
  return state.workspaces.find(workspace => workspace.path === state.selectedPath)?.id
}

function fileName(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
}

function statusKey(status: AIPMStatus): WorkbenchKey {
  return `status.${status}`
}

function typeKey(type: AIPMProjectType): WorkbenchKey {
  return `type.${type}`
}

function gateKey(id: AIPMGateId): WorkbenchKey {
  return `gate.${id}`
}

function statusTone(status: AIPMStatus): TagTone {
  if (status === 'approved') return 'success'
  if (status === 'in-progress' || status === 'pending-review') return 'info'
  if (status === 'needs-rework' || status === 'insufficient-data') return 'warning'
  if (status === 'skipped') return 'danger'
  return 'neutral'
}
