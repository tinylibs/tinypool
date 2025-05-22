export function stdout(): NodeJS.WriteStream | undefined {
  // @ts-expect-error Node.js maps process.stdout to console._stdout
  return console._stdout || process.stdout || undefined
}

export function stderr(): NodeJS.WriteStream | undefined {
  // @ts-expect-error Node.js maps process.stderr to console._stderr
  return console._stderr || process.stderr || undefined
}

export const isBun = 'bun' in process.versions;
