import { pathToFileURL } from 'url'

// Get `import(x)` as a function that isn't transpiled to `require(x)` by
// TypeScript for dual ESM/CJS support.
// Load this lazily, so that there is no warning about the ESM loader being
// experimental (on Node v12.x) until we actually try to use it.
let importESMCached: (specifier: string) => Promise<any> | undefined

function getImportESM() {
  if (importESMCached === undefined) {
    importESMCached = new Function(
      'specifier',
      'return import(specifier)'
    ) as typeof importESMCached
  }
  return importESMCached
}

const handlerCache: Map<string, Function> = new Map()

// Look up the handler function that we call when a task is posted.
// This is either going to be "the" export from a file, or the default export.
export async function getHandler(
  filename: string,
  name: string
): Promise<Function | null> {
  let handler = handlerCache.get(`${filename}/${name}`)
  if (handler !== undefined) {
    return handler
  }

  try {
    // With our current set of TypeScript options, this is transpiled to
    // `require(filename)`.
    const handlerModule = await import(filename)

    // Check if the default export is an object, because dynamic import
    // resolves with `{ default: { default: [Function] } }` for CJS modules.
    handler =
      (typeof handlerModule.default !== 'function' && handlerModule.default) ||
      handlerModule

    if (typeof handler !== 'function') {
      handler = await (handler as any)[name]
    }
  } catch {}
  if (typeof handler !== 'function') {
    handler = await getImportESM()(pathToFileURL(filename).href)
    if (typeof handler !== 'function') {
      handler = await (handler as any)[name]
    }
  }
  if (typeof handler !== 'function') {
    return null
  }

  // Limit the handler cache size. This should not usually be an issue and is
  // only provided for pathological cases.
  if (handlerCache.size > 1000) {
    // @ts-ignore
    const [[key]] = handlerCache
    handlerCache.delete(key)
  }

  handlerCache.set(`${filename}/${name}`, handler)
  return handler
}

export function throwInNextTick(error: Error) {
  process.nextTick(() => {
    throw error
  })
}
