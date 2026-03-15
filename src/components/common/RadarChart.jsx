/**
 * CSS 实现的雷达图 — 用于基因四维展示
 * 纯 CSS + SVG，不依赖外部图表库
 */
import React from "react";

export default function RadarChart({ data = {}, size = 160, color = "#ffd700" }) {
  // data 格式: { "标签": 0.7, "标签2": 0.5, ... }
  const entries = Object.entries(data);
  const count = entries.length;
  if (count < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 24;

  // 生成多边形顶点
  const getPoint = (index, value) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius * value;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // 背景网格层
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPaths = gridLevels.map((level) => {
    const points = Array.from({ length: count }, (_, i) => getPoint(i, level));
    return points.map((p) => `${p.x},${p.y}`).join(" ");
  });

  // 数据多边形
  const dataPoints = entries.map(([, val], i) => getPoint(i, val));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // 坐标轴
  const axisEndpoints = Array.from({ length: count }, (_, i) => getPoint(i, 1));

  // 标签位置（稍微外推）
  const labelPoints = entries.map(([label], i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const lr = radius + 18;
    return {
      x: cx + lr * Math.cos(angle),
      y: cy + lr * Math.sin(angle),
      label,
      value: entries[i][1],
    };
  });

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 背景网格 */}
        {gridPaths.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="#2a2a45"
            strokeWidth="1"
            opacity={0.6}
          />
        ))}

        {/* 坐标轴 */}
        {axisEndpoints.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#2a2a45" strokeWidth="1" opacity={0.4} />
        ))}

        {/* 数据区域 */}
        <polygon
          points={dataPath}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth="2"
        />

        {/* 数据点 */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}

        {/* 标签 */}
        {labelPoints.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9ca3af"
            fontSize="9"
            fontFamily="'ArkPixel', 'Courier New', monospace"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
