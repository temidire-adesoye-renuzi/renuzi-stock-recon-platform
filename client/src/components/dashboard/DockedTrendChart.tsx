import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDayMonth, formatNaira } from '../../lib/format'

export interface TrendPoint {
  date: string
  valueNgn: number
}

/** 14-day docked-value trend (₦M) — peak day highlighted in danger red. */
export function DockedTrendChart({ points }: { points: TrendPoint[] }) {
  const data = points.map((point) => ({
    day: formatDayMonth(point.date),
    value: Number((point.valueNgn / 1_000_000).toFixed(1)),
    raw: point.valueNgn,
  }))
  const peak = data.reduce((best, point) => (point.value > best.value ? point : best), {
    day: '',
    value: -Infinity,
    raw: 0,
  })

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Docked Value by Day
        </h2>
        <span className="text-2xs text-neutral-400">Last 14 days · ₦M</span>
      </div>

      <div className="mt-3 h-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#EFEFEF" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              interval={2}
              tick={{ fontSize: 10, fill: '#8A8A8A' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 10, fill: '#8A8A8A' }}
            />
            <Tooltip
              cursor={{ fill: '#EAEAF4' }}
              contentStyle={{
                borderRadius: 6,
                border: '1px solid #E5E5E5',
                fontSize: 11,
                padding: '6px 8px',
              }}
              formatter={(value) => [`₦${Number(value ?? 0).toFixed(1)}M`, 'Docked value']}
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={18}>
              {data.map((point) => (
                <Cell
                  key={point.day}
                  fill={point.value === peak.value ? '#FB4B4C' : '#9798C9'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.length > 0 ? (
        <p className="mt-2 border-t border-neutral-100 pt-2 text-2xs text-neutral-500">
          Peak <span className="num font-semibold text-danger">₦{peak.value.toFixed(1)}M</span> on{' '}
          {peak.day} — {formatNaira(peak.raw)} docked across locations.
        </p>
      ) : (
        <p className="mt-2 border-t border-neutral-100 pt-2 text-2xs text-neutral-500">
          No docked value recorded in the window yet.
        </p>
      )}
    </section>
  )
}
