const isDebuggingEnabled = Boolean(process.env.DEBUG)

export const log = (message: string, ...args: unknown[]) => {
  if (!isDebuggingEnabled) {
    return
  }
  console.log(`[graphql-codegen-builder] ${message}`)
  if (args.length) {
    console.dir(args, { depth: null, colors: true })
  }
}