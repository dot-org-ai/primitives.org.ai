import { parquetRead } from 'hyparquet'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(import.meta.dirname, 'data', 'cascade')

async function readParquetFile(filename: string) {
  const buffer = readFileSync(join(DATA_DIR, filename))
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  return new Promise((resolve) => {
    parquetRead({
      file: arrayBuffer,
      onComplete: (data) => resolve(data),
    })
  })
}

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.parquet'))

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('              PARQUET FILE VERIFICATION                         ')
  console.log('═══════════════════════════════════════════════════════════════\n')

  for (const file of files) {
    console.log(`─── ${file} ───`)
    const data = (await readParquetFile(file)) as Record<string, unknown>[]
    console.log(JSON.stringify(data, null, 2))
    console.log()
  }
}

main().catch(console.error)
