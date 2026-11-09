import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate } from '@/lib/utils'

export interface ChartSeries {
  key: string
  label: string
  color: string
  dashed?: boolean
}

interface TrendChartProps {
  title: string
  description?: string
  data: object[]
  xKey: string
  series: ChartSeries[]
  unit?: string
  domain?: [number | 'auto', number | 'auto']
  height?: number
  valueFormatter?: (value: number) => string
}

const valueAt = (row: object, key: string): unknown => (row as Record<string, unknown>)[key]

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(16,28,43,0.12)',
  boxShadow: '0 12px 32px -18px rgba(16,28,43,0.35)',
  fontSize: 12,
  padding: '8px 10px',
}

export const TrendChart = ({
  title,
  description,
  data,
  xKey,
  series,
  unit,
  domain,
  height = 240,
  valueFormatter,
}: TrendChartProps) => {
  const hasValues = data.some((row) =>
    series.some((item) => valueAt(row, item.key) !== null && valueAt(row, item.key) !== undefined),
  )

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        {title}. {description ?? ''}
      </figcaption>
      <div
        role="img"
        aria-label={`${title} line chart. ${hasValues ? 'Values are displayed in the accompanying data table.' : 'No recorded values in this period.'}`}
        className="w-full"
        style={{ height }}
      >
        {hasValues ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(16,28,43,0.08)" vertical={false} />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: '#5a6b80' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tickFormatter={(value: string) =>
                  value.length >= 10 ? formatDate(value) : String(value)
                }
              />
              <YAxis
                domain={domain ?? ['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#5a6b80' }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(value: number) => `${value}${unit ?? ''}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(value) => (typeof value === 'string' && value.length >= 10 ? formatDate(value) : String(value))}
                formatter={(value, name) => {
                  const numeric = typeof value === 'number' ? value : Number(value)
                  const formatted = Number.isNaN(numeric)
                    ? 'Not recorded'
                    : `${valueFormatter ? valueFormatter(numeric) : numeric}${unit ?? ''}`
                  return [formatted, String(name)]
                }}
              />
              {series.length > 1 ? (
                <Legend
                  verticalAlign="top"
                  height={30}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 11 }}
                />
              ) : null}
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2.4}
                  strokeDasharray={item.dashed ? '5 5' : undefined}
                  dot={{ r: 2.6, strokeWidth: 0, fill: item.color }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive
                  animationDuration={900}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-navy-900/15 px-4 text-center text-xs text-muted dark:border-white/15">
            No recorded values in this period. Nothing is estimated or filled in.
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none font-medium text-muted hover:text-ink">
          View chart data
        </summary>
        <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-navy-900/10 dark:border-white/10">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-navy-900/5 dark:bg-white/5">
                <th scope="col" className="px-2 py-1 font-semibold">
                  Date
                </th>
                {series.map((item) => (
                  <th key={item.key} scope="col" className="px-2 py-1 font-semibold">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={String(valueAt(row, xKey))}>
                  <th scope="row" className="px-2 py-1 font-normal">
                    {formatDate(String(valueAt(row, xKey)))}
                  </th>
                  {series.map((item) => (
                    <td key={item.key} className="px-2 py-1 tabular-nums">
                      {valueAt(row, item.key) === null || valueAt(row, item.key) === undefined
                        ? 'Not recorded'
                        : `${valueAt(row, item.key)}${unit ?? ''}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
