import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/**
 * Plantilla vacía para nueva liga — mismo layout que el Excel de Christian.
 * GET /api/ligas/template
 */
export async function GET() {
  const wb = XLSX.utils.book_new()

  // EQUIPOS (master)
  const eq: (string | null)[][] = [
    [null, 'LIGA: (nombre de la liga)'],
    [null, 'Completá abajo los equipos por categoría'],
    [],
    [null, 'CATEGORIA', 'EQUIPO', 'JUGADOR 1', 'JUGADOR 2', 'JUGADOR 3'],
    [null, '3ª Masculina', 'LUISMI-JORGE', 'Luis Miguel', 'Jorge Martín', null],
  ]
  const wsEq = XLSX.utils.aoa_to_sheet(eq)
  wsEq['!cols'] = [{ wch: 2 }, { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsEq, 'EQUIPOS')

  // Categorías de ejemplo
  const ALL: string[] = ['2-3', '3RA', '4TA', '5TA', '45 FEM GA', '45 FEM GB', 'MIXTO A', 'MIXTO B', 'MIXTO B G2']
  for (const cat of ALL) {
    const aoa: (string | null)[][] = []
    aoa.push([null, `${cat} categoria`, null, null, null, null, null, `${cat} categoria`])
    // 4 jornadas vacías con 8 espacios para equipos (4 partidos por jornada)
    for (let j = 0; j < 4; j += 2) {
      aoa.push([null, `JORNADA ${j + 1}`, '1 SET', '2 SET', '3 SET', 'PTOS', null, `JORNADA ${j + 2}`, '1 SET', '2 SET', '3 SET', 'PTOS'])
      for (let k = 0; k < 8; k++) aoa.push([null, null, null, null, null, null, null, null])
      aoa.push([])
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 2 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 2 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }]
    XLSX.utils.book_append_sheet(wb, ws, cat)
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_liga.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
