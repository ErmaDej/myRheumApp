import type { Profile } from '@/data/types'
import type { WeeklySummary } from '@/lib/reports/summary'
import { describeRange } from '@/lib/reports/summary'
import { formatDate, formatMinutes } from '@/lib/utils'

const NAVY: [number, number, number] = [16, 28, 43]
const TEAL: [number, number, number] = [70, 191, 169]
const MUTED: [number, number, number] = [90, 107, 128]

const text = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '—' : String(value)

/**
 * Builds a printable consultation summary.
 * pdf libraries are imported dynamically so they never enter the initial bundle.
 */
export const buildSummaryPdf = async (
  summary: WeeklySummary,
  profile: Profile,
): Promise<import('jspdf').jsPDF> => {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  // Header
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageWidth, 92, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('myRheumApp — Health Summary', margin, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(146, 223, 207)
  doc.text(`${profile.name}  ·  ${describeRange(summary.range)}`, margin, 58)
  doc.setTextColor(200, 210, 222)
  doc.text(
    `Generated ${new Date().toLocaleString()}  ·  Synthetic demo data may be present`,
    margin,
    74,
  )

  let cursorY = 118

  // Period overview
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Reporting period', margin, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, textColor: NAVY, lineColor: [225, 230, 237] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    head: [['Measure', 'Value']],
    body: [
      ['Completed check-ins', `${summary.checkIns}`],
      ['Days covered', `${summary.daysInRange} (${summary.missingDays} without a check-in)`],
      ['Pain (0–10)', `${text(summary.pain.mean)}  (range ${text(summary.pain.min)}–${text(summary.pain.max)}; n=${summary.pain.samples})`],
      ['Morning stiffness', `${formatMinutes(summary.stiffness.mean)} (n=${summary.stiffness.samples})`],
      ['Fatigue (0–10)', `${text(summary.fatigue.mean)} (n=${summary.fatigue.samples})`],
      ['Sleep quality (0–10)', `${text(summary.sleep.mean)} (n=${summary.sleep.samples})`],
    ],
  })

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24

  // Adherence
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Medication adherence (recorded events only)', margin, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5, textColor: NAVY },
    headStyles: { fillColor: TEAL, textColor: NAVY, fontStyle: 'bold' },
    head: [['Medication', 'Taken', 'Skipped', 'Uncertain', 'Not recorded', '% taken']],
    body: summary.medicationLines.map((line) => [
      `${line.plan.name} ${line.plan.dose}`.trim(),
      `${line.taken}`,
      `${line.skipped}`,
      `${line.uncertain}`,
      `${line.notRecorded}`,
      line.percentRecordedTaken === null ? '—' : `${line.percentRecordedTaken}%`,
    ]),
    foot: [
      [
        'All scheduled doses',
        `${summary.adherence.taken}`,
        `${summary.adherence.skipped}`,
        `${summary.adherence.uncertain}`,
        `${summary.adherence.notRecorded}`,
        summary.adherence.percentRecordedTaken === null
          ? '—'
          : `${summary.adherence.percentRecordedTaken}%`,
      ],
    ],
    footStyles: { fillColor: [239, 233, 255], textColor: NAVY, fontStyle: 'bold' },
  })

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24

  // Baseline comparison
  if (summary.trends.some((trend) => trend.baseline !== null && trend.recent !== null)) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Pretreatment baseline vs current period', margin, cursorY)
    cursorY += 8

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, textColor: NAVY, lineColor: [225, 230, 237] },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      head: [['Measure', 'Baseline', 'Recent', 'Change']],
      body: summary.trends.map((trend) => [
        `${trend.label} (${trend.unit})`,
        `${text(trend.baseline)} (n=${trend.sampleBaseline})`,
        `${text(trend.recent)} (n=${trend.sampleRecent})`,
        trend.changePercent === null ? '—' : `${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%`,
      ]),
    })

    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(
      'Association only. A change after starting treatment does not show that the treatment caused it.',
      margin,
      cursorY,
    )
    cursorY += 20
  }

  // Laboratory
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Laboratory results in this period', margin, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5, textColor: NAVY },
    headStyles: { fillColor: [239, 233, 255], textColor: NAVY, fontStyle: 'bold' },
    head: [['Collected', 'Test', 'Result', 'Reference', 'Laboratory']],
    body:
      summary.newLabs.length === 0
        ? [['—', 'No laboratory results recorded in this period', '—', '—', '—']]
        : summary.newLabs.map((lab) => [
            formatDate(lab.collectedAt),
            lab.testName,
            `${lab.value} ${lab.unit}`.trim(),
            lab.referenceText ??
              (lab.referenceLow !== undefined || lab.referenceHigh !== undefined
                ? `${lab.referenceLow ?? ''}–${lab.referenceHigh ?? ''} ${lab.unit}`.trim()
                : 'Not supplied'),
            lab.laboratory ?? '—',
          ]),
  })

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24

  // Questions and notes
  const questions = summary.patientNotes.slice(0, 6)
  if (questions.length > 0) {
    if (cursorY > 700) {
      doc.addPage()
      cursorY = 48
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Patient notes for discussion', margin, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    cursorY += 16
    for (const note of questions) {
      const lines = doc.splitTextToSize(`• ${note}`, pageWidth - margin * 2)
      doc.text(lines, margin, cursorY)
      cursorY += lines.length * 12 + 4
    }
  }

  // Footer disclaimer on every page
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    const height = doc.internal.pageSize.getHeight()
    doc.setDrawColor(225, 230, 237)
    doc.line(margin, height - 44, pageWidth - margin, height - 44)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(
      'Patient-recorded summary. Not a diagnosis and not a substitute for clinical review. Verify original documents before changing treatment.',
      margin,
      height - 30,
    )
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin - 44, height - 30)
  }

  return doc
}

export const downloadSummaryPdf = async (summary: WeeklySummary, profile: Profile): Promise<void> => {
  const doc = await buildSummaryPdf(summary, profile)
  const slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  doc.save(`myrheum-summary-${slug || 'patient'}-${summary.range.start.slice(0, 10)}.pdf`)
}
