// An in-memory folder behind handles shaped like the File System Access
// API's, for testing code that reads and writes folders on disk.

type FakeNode =
  | { kind: 'file'; text: string; modified: number }
  | { kind: 'directory'; children: Map<string, FakeNode> }

type Tree = { [name: string]: string | Tree }

const notFound = () => new DOMException('Not found', 'NotFoundError')
const mismatch = () => new DOMException('Wrong kind', 'TypeMismatchError')

function build(tree: Tree): FakeNode {
  return {
    kind: 'directory',
    children: new Map(
      Object.entries(tree).map(([name, value]) => [
        name,
        typeof value === 'string'
          ? { kind: 'file', text: value, modified: 1 }
          : build(value),
      ]),
    ),
  }
}

type DirectoryNode = Extract<FakeNode, { kind: 'directory' }>

class FakeHandle {
  /** Only where the folder was made `movable`, as browsers differ. */
  move?: (name: string) => Promise<void>

  constructor(
    public name: string,
    readonly node: FakeNode,
    readonly parent: DirectoryNode | null,
    readonly movable: boolean,
  ) {
    if (movable && parent) {
      this.move = (to) => {
        parent.children.delete(this.name)
        parent.children.set(to, node)
        this.name = to
        return Promise.resolve()
      }
    }
  }

  queryPermission() {
    return Promise.resolve<PermissionState>('granted')
  }

  requestPermission() {
    return Promise.resolve<PermissionState>('granted')
  }

  isSameEntry(other: FileSystemHandle) {
    return Promise.resolve((other as unknown as FakeHandle).node === this.node)
  }
}

class FakeFile extends FakeHandle {
  readonly kind = 'file'
  declare readonly node: Extract<FakeNode, { kind: 'file' }>

  getFile() {
    // A handle to a file removed since then finds nothing, as in browsers.
    if (this.parent && this.parent.children.get(this.name) !== this.node)
      return Promise.reject(notFound())
    const { text, modified } = this.node
    return Promise.resolve({
      name: this.name,
      lastModified: modified,
      text: () => Promise.resolve(text),
    })
  }

  createWritable() {
    let pending = ''
    return Promise.resolve({
      write: async (data: string | { text: () => Promise<string> }) => {
        pending = typeof data === 'string' ? data : await data.text()
      },
      close: () => {
        this.node.text = pending
        this.node.modified += 1
        return Promise.resolve()
      },
      abort: () => Promise.resolve(),
    })
  }
}

class FakeDirectory extends FakeHandle {
  readonly kind = 'directory'
  declare readonly node: DirectoryNode

  private child(name: string, node: FakeNode) {
    return node.kind === 'file'
      ? new FakeFile(name, node, this.node, this.movable)
      : new FakeDirectory(name, node, this.node, this.movable)
  }

  getFileHandle(name: string, options?: { create?: boolean }) {
    let node = this.node.children.get(name)
    if (!node && options?.create) {
      node = { kind: 'file', text: '', modified: 1 }
      this.node.children.set(name, node)
    }
    if (!node) return Promise.reject(notFound())
    if (node.kind !== 'file') return Promise.reject(mismatch())
    return Promise.resolve(this.child(name, node) as FakeFile)
  }

  getDirectoryHandle(name: string, options?: { create?: boolean }) {
    let node = this.node.children.get(name)
    if (!node && options?.create) {
      node = { kind: 'directory', children: new Map() }
      this.node.children.set(name, node)
    }
    if (!node) return Promise.reject(notFound())
    if (node.kind !== 'directory') return Promise.reject(mismatch())
    return Promise.resolve(this.child(name, node) as FakeDirectory)
  }

  removeEntry(name: string, options?: { recursive?: boolean }) {
    const node = this.node.children.get(name)
    if (!node) return Promise.reject(notFound())
    if (node.kind === 'directory' && node.children.size && !options?.recursive)
      return Promise.reject(
        new DOMException('Not empty', 'InvalidModificationError'),
      )
    this.node.children.delete(name)
    return Promise.resolve()
  }

  async *values() {
    for (const [name, node] of [...this.node.children]) {
      yield this.child(name, node)
    }
  }
}

/**
 * A folder holding `tree`: strings are files with that text, objects are
 * folders. `movable` gives its handles `move()`, as newer browsers do.
 */
export function fakeFolder(name: string, tree: Tree, movable = false) {
  const root = build(tree) as DirectoryNode
  const find = (path: string) => {
    let node: FakeNode | undefined = root
    for (const part of path.split('/')) {
      node = node?.kind === 'directory' ? node.children.get(part) : undefined
    }
    return node
  }
  return {
    handle: new FakeDirectory(
      name,
      root,
      null,
      movable,
    ) as unknown as FileSystemDirectoryHandle,
    /** The text of the file at `path`, or undefined if there is none. */
    read: (path: string) => {
      const node = find(path)
      return node?.kind === 'file' ? node.text : undefined
    },
    /** Changes a file as another app would. */
    write: (path: string, text: string) => {
      const node = find(path)
      if (node?.kind !== 'file') throw new Error(`No file at ${path}`)
      node.text = text
      node.modified += 1
    },
    /** Whether anything is at `path`. */
    has: (path: string) => !!find(path),
  }
}
