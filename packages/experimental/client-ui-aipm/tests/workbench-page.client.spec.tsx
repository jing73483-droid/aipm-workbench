// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { WorkbenchPage } from '../src/client/WorkbenchPage.tsx'
import { BrandName } from '../src/client/BrandName.tsx'
import { HeroLiquidMark, LiquidMark } from '../src/client/LiquidMark.tsx'
import { WorkbenchIcon } from '../src/client/WorkbenchIcon.tsx'
import { zh } from '../src/client/locales.ts'
import type { AIPMWorkbenchState } from '../src/client/protocol.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const unread = () => { throw new Error('unused') }

const empty: AIPMWorkbenchState = {
  workspaces: [],
  selectedPath: null,
  manifest: null,
  files: [],
  pending: [],
  openFile: null,
  builtinSkills: [],
}

const ready: AIPMWorkbenchState = {
  workspaces: [
    { id: 'ws-1', title: 'demo', path: '/tmp/demo', hasProject: true },
    { id: 'ws-2', title: 'other', path: '/tmp/other', hasProject: false },
  ],
  selectedPath: '/tmp/demo',
  manifest: {
    id: 'p1',
    name: 'Demo',
    type: 'feature',
    objective: 'Ship',
    rootDir: '/tmp/demo',
    stages: [
      { id: 'requirement-insight', order: 1, dirName: '01-requirement-insight', name: '需求洞察', status: 'not-started' },
      { id: 'market-user-research', order: 2, dirName: '02-market-user-research', name: '市场与用户研究', status: 'approved' },
      { id: 'brd', order: 3, dirName: '03-brd', name: 'BRD', status: 'pending-review' },
      { id: 'project-initiation', order: 4, dirName: '04-project-initiation', name: '立项', status: 'in-progress', notes: 'go' },
      { id: 'prd', order: 5, dirName: '05-prd', name: 'PRD', status: 'needs-rework' },
      { id: 'design-handoff', order: 6, dirName: '06-design-handoff', name: '设计交接', status: 'insufficient-data' },
      { id: 'dev-test-handoff', order: 7, dirName: '07-dev-test-handoff', name: '研发测试交接', status: 'skipped' },
      { id: 'launch-retrospective', order: 8, dirName: '08-launch-retrospective', name: '上线复盘', status: 'not-started' },
    ],
    assets: [],
    skills: [],
    initiationGates: [
      { id: 'problem', status: 'not-started' },
    ],
  },
  files: [
    { path: '/tmp/demo/aipm.json', relativePath: 'aipm.json', kind: 'file' },
    { path: '/tmp/demo/notes.md', relativePath: 'notes.md', kind: 'file' },
    { path: '/tmp/demo/01-requirement-insight/notes.md', relativePath: '01-requirement-insight/notes.md', kind: 'file' },
  ],
  pending: [{ id: 'c1', path: '/tmp/demo/notes.md', oldText: 'old', newText: 'new' }],
  openFile: { path: '/tmp/demo/notes.md', text: '# hello' },
  builtinSkills: [{ name: 'project-initiation-report', description: '立项' }],
}

function page(continueInChat = vi.fn()) {
  return render(
    <WorkbenchPage
      t={makeTranslate(zh)}
      continueInChat={continueInChat}
      usePanelInfo={unread}
      useSessions={unread}
      useSessionStatus={unread}
      useSessionRetainInfo={unread}
      useWorkspaces={unread}
      useResource={unread}
    />,
  )
}

async function clickCommand(label: string, index = 0): Promise<void> {
  await waitFor(() => {
    const node = screen.getAllByText(label)[index]
    const button = node instanceof HTMLButtonElement ? node : node?.closest('button')
    expect((button as HTMLButtonElement | null)?.disabled ?? true).toBe(false)
  })
  fireEvent.click(screen.getAllByText(label)[index]!)
}

describe('WorkbenchPage', () => {
  it('shows an empty workspace hint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(empty))))
    page()
    expect(await screen.findByText('还没有工作区。请先在左侧边栏添加一个本地文件夹，再回到这里创建项目。')).toBeTruthy()
  })

  it('creates a project from the form', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.startsWith('/api/aipm.command')) {
        return new Response(JSON.stringify({ ok: true, state: ready }))
      }
      void init
      return new Response(JSON.stringify({
        ...empty,
        workspaces: [{ id: 'ws-1', title: 'demo', path: '/tmp/demo', hasProject: false }],
        selectedPath: '/tmp/demo',
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    page()
    expect(await screen.findByText('创建 AIPM 项目')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: 'Demo' } })
    fireEvent.change(screen.getByLabelText('项目类型'), { target: { value: 'new-product' } })
    fireEvent.change(screen.getByLabelText('一句话目标'), { target: { value: 'Ship' } })
    const fields = screen.getAllByRole('textbox')
    fireEvent.change(fields[fields.length - 1]!, { target: { value: '/tmp/changed' } })
    fireEvent.click(screen.getByText('创建项目'))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/api/aipm.command'))).toBe(true)
    })
  })

  it('opens a file and submits a pending review', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/aipm.command')) {
        const command = JSON.parse(String(init?.body)) as { op: string }
        if (command.op === 'propose') return new Response(JSON.stringify({ ok: true, state: ready }))
        if (command.op === 'applyChange') {
          return new Response(JSON.stringify({ ok: true, state: { ...ready, pending: [] } }))
        }
      }
      return new Response(JSON.stringify(ready))
    })
    vi.stubGlobal('fetch', fetchMock)
    const continueInChat = vi.fn()
    page(continueInChat)
    expect(await screen.findByText('去对话中继续')).toBeTruthy()
    const fileButtons = screen.getAllByRole('button', { name: 'notes.md' })
    fireEvent.click(fileButtons[0]!)
    expect(await screen.findByText('提交审阅')).toBeTruthy()
    fireEvent.click(screen.getByText('提交审阅'))
    fireEvent.click(screen.getAllByRole('button', { name: 'notes.md' })[1]!)
    expect(await screen.findByText('通过')).toBeTruthy()
    fireEvent.click(screen.getByText('通过'))
    fireEvent.click(screen.getByText('去对话中继续'))
    expect(continueInChat).toHaveBeenCalledWith('ws-1')
  })

  it('shows a load error and retries', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new Response(JSON.stringify(empty)))
    vi.stubGlobal('fetch', fetchMock)
    page()
    expect(await screen.findByText('无法读取工作台：offline')).toBeTruthy()
    fireEvent.click(screen.getByText('重试'))
    expect(await screen.findByText('还没有工作区。请先在左侧边栏添加一个本地文件夹，再回到这里创建项目。')).toBeTruthy()
  })

  it('surfaces HTTP and non-error load failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'bad' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    page()
    expect(await screen.findByText('无法读取工作台：bad')).toBeTruthy()
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 400 })))
    page()
    expect(await screen.findByText('无法读取工作台：正在读取项目…')).toBeTruthy()
    cleanup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce('boom'))
    page()
    expect(await screen.findByText('无法读取工作台：boom')).toBeTruthy()
  })

  it('edits a stage, gates, snapshot, and skill, then reviews files', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/aipm.command')) {
        const command = JSON.parse(String(init?.body)) as { op: string }
        if (command.op === 'snapshot') {
          return new Response(JSON.stringify({
            ok: true,
            state: ready,
            snapshot: { created: true, kind: 'git', commitMessage: 'checkpoint' },
          }))
        }
        if (command.op === 'writeFile') {
          return new Response(JSON.stringify({ ok: true, state: { ...ready, openFile: { path: '/tmp/demo/notes.md', text: 'edited' } } }))
        }
        if (command.op === 'rejectChange') {
          return new Response(JSON.stringify({ ok: true, state: { ...ready, pending: [] } }))
        }
        if (command.op === 'propose') {
          return new Response(JSON.stringify({ ok: false, error: 'blocked' }))
        }
        return new Response(JSON.stringify({ ok: true, state: ready }))
      }
      if (url.includes('file=')) {
        return new Response(JSON.stringify({ ...ready, openFile: { path: '/tmp/demo/notes.md', text: '# hello' } }))
      }
      return new Response(JSON.stringify({ ...ready, pending: [], files: [] }))
    })
    vi.stubGlobal('fetch', fetchMock)
    page()
    expect(await screen.findByText('这个阶段还没有文件。')).toBeTruthy()
    expect(screen.getByText('没有待审阅的改动。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /4\. 立项/ }))
    expect(await screen.findByText('立项闸门')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'approved' } })
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: 'notes' } })
    await clickCommand('更新阶段')
    await clickCommand('通过')
    await clickCommand('补证')
    await clickCommand('终止')
    fireEvent.change(screen.getByLabelText('快照说明'), { target: { value: 'checkpoint' } })
    await clickCommand('提交 Git 快照')
    expect(await screen.findByText('git: checkpoint')).toBeTruthy()
    await clickCommand('安装立项技能')
    fireEvent.click(screen.getByRole('button', { name: 'other' }))
    fireEvent.click(screen.getByRole('button', { name: /1\. 需求洞察/ }))
  })

  it('saves, proposes, and rejects file changes, including command errors', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/aipm.command')) {
        const command = JSON.parse(String(init?.body)) as { op: string }
        if (command.op === 'propose') return new Response(JSON.stringify({ ok: false }))
        if (command.op === 'writeFile') return new Response(JSON.stringify({ ok: true, state: ready }))
        if (command.op === 'rejectChange') throw 'nope'
        return new Response(JSON.stringify({ ok: true, state: ready }))
      }
      if (url.includes('file=')) {
        return new Response(JSON.stringify({ ...ready, selectedPath: null, openFile: null }))
      }
      return new Response(JSON.stringify(ready))
    })
    vi.stubGlobal('fetch', fetchMock)
    const continueInChat = vi.fn()
    page(continueInChat)
    expect(await screen.findByText('去对话中继续')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'aipm.json' }))
    expect(await screen.findByLabelText('编辑')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'aipm.json' }))
    expect(await screen.findByLabelText('编辑')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('编辑'), { target: { value: 'edited' } })
    await clickCommand('直接保存')
    await clickCommand('提交审阅')
    expect(await screen.findByText('正在读取项目…')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'notes.md' })[1]!)
    expect(await screen.findByText('驳回')).toBeTruthy()
    await clickCommand('驳回')
    expect(await screen.findByText('nope')).toBeTruthy()
    fireEvent.click(screen.getByText('去对话中继续'))
    expect(continueInChat).toHaveBeenCalled()
  })

  it('labels a workspace without a readable manifest as AIPM', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ...empty,
      workspaces: [{ id: 'ws-1', title: 'demo', path: '/tmp/demo', hasProject: true }],
      selectedPath: '/tmp/demo',
    }))))
    page()
    expect(await screen.findByText('AIPM')).toBeTruthy()
    expect(screen.getByText('创建 AIPM 项目')).toBeTruthy()
  })

  it('renders the brand name and sidebar glyph', () => {
    const unreadIcon = (): never => { throw new Error('unused') }
    const brand = render(<BrandName t={makeTranslate(zh)} />)
    expect(brand.getByText('HI，小璟')).toBeTruthy()
    brand.unmount()
    const hero = render(<HeroLiquidMark size={34} t={makeTranslate(zh)} />)
    expect(hero.getByText('HI，小璟')).toBeTruthy()
    hero.unmount()
    expect(render(<HeroLiquidMark size={34} className="swim" t={makeTranslate(zh)} />).container.querySelector('svg')?.getAttribute('class')).toContain('swim')
    expect(render(<LiquidMark size={24} />).container.querySelector('svg')?.getAttribute('width')).toBe('24')
    expect(render(
      <WorkbenchIcon
        size={18}
        active={false}
        usePanelInfo={unreadIcon}
        useSessions={unreadIcon}
        useWorkspaces={unreadIcon}
        useResource={unreadIcon}
        useSessionStatus={unreadIcon}
        useSessionRetainInfo={unreadIcon}
      />,
    ).container.querySelector('svg')).toBeTruthy()
  })
})
