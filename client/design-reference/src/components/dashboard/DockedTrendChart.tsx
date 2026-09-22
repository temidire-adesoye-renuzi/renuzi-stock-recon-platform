import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { dockedTrend } from '../../data/varianceRecords';

export function DockedTrendChart() {
  const peak = Math.max(...dockedTrend.map((point) => point.value));

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
          <BarChart data={dockedTrend} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#EFEFEF" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              interval={2}
              tick={{ fontSize: 10, fill: '#8A8A8A' }} />
            
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 10, fill: '#8A8A8A' }} />
            
            <Tooltip
              cursor={{ fill: '#EAEAF4' }}
              contentStyle={{
                borderRadius: 6,
                border: '1px solid #E5E5E5',
                fontSize: 11,
                padding: '6px 8px'
              }}
              formatter={(value: number) => [`₦${value.toFixed(1)}M`, 'Docked value']} />
            
            <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={18}>
              {dockedTrend.map((point) =>
              <Cell key={point.day} fill={point.value === peak ? '#FB4B4C' : '#9798C9'} />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 border-t border-neutral-100 pt-2 text-2xs text-neutral-500">
        Peak <span className="num font-semibold text-danger">₦22.7M</span> on 22 Sep, driven by
        Edible Oils at Lekki Warehouse.
      </p>
    </section>);

}