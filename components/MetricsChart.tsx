import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot, Label } from 'recharts';
import { NetworkConfig, TopologyMetrics } from '../types';
import { calculateClos, calculateFullMesh } from '../utils/networkMath';
import { Zap, Network, Activity, Plug, TrendingUp } from 'lucide-react';

interface Props {
  currentConfig: NetworkConfig;
}

const MetricsChart: React.FC<Props> = ({ currentConfig }) => {
  const [metricKey, setMetricKey] = useState<'powerPerPort' | 'power' | 'switches' | 'cables'>('powerPerPort');

  const data = useMemo(() => {
    const points = [];
    const minUsers = 128;
    const maxUsers = 1024; // Fixed range as requested
    const step = 128;

    for (let u = minUsers; u <= maxUsers; u += step) {
      const tempConfig = { ...currentConfig, numUsers: u };
      const clos = calculateClos(tempConfig);
      
      // Calculate Mesh to match the Clos capacity for fairness
      const targetCapacity = clos.possible ? clos.userCapacity : u;
      const mesh = calculateFullMesh(tempConfig, targetCapacity);

      if (clos.possible && mesh.possible) {
        points.push({
          x: u,
          closSwitches: clos.totalSwitches,
          meshSwitches: mesh.totalSwitches,
          closCables: clos.totalCables,
          meshCables: mesh.totalCables,
          closPower: clos.totalPower,
          meshPower: mesh.totalPower,
          closPowerPerPort: clos.userCapacity > 0 ? Math.round(clos.totalPower / clos.userCapacity) : 0,
          meshPowerPerPort: mesh.userCapacity > 0 ? Math.round(mesh.totalPower / mesh.userCapacity) : 0,
        });
      }
    }
    return points;
  }, [currentConfig]); // Re-run if config changes (e.g. power settings), though numUsers changes won't affect the curve itself due to fixed range, unless we used it. 
  // Actually currentConfig includes other params like powerPerSwitch which DO affect the curve.

  // Calculate the highlight point values based on currentConfig.numUsers
  const highlightValues = useMemo(() => {
    const clos = calculateClos(currentConfig);
    const targetCapacity = clos.possible ? clos.userCapacity : currentConfig.numUsers;
    const mesh = calculateFullMesh(currentConfig, targetCapacity);

    return {
        closSwitches: clos.totalSwitches,
        meshSwitches: mesh.totalSwitches,
        closCables: clos.totalCables,
        meshCables: mesh.totalCables,
        closPower: clos.totalPower,
        meshPower: mesh.totalPower,
        closPowerPerPort: clos.userCapacity > 0 ? Math.round(clos.totalPower / clos.userCapacity) : 0,
        meshPowerPerPort: mesh.userCapacity > 0 ? Math.round(mesh.totalPower / mesh.userCapacity) : 0,
        possible: clos.possible && mesh.possible
    };
  }, [currentConfig]);


  const metrics = {
    powerPerPort: { label: 'Power / Port', unit: 'W', icon: Plug, dataKeyClos: 'closPowerPerPort', dataKeyMesh: 'meshPowerPerPort' },
    power: { label: 'Total Power', unit: 'W', icon: Zap, dataKeyClos: 'closPower', dataKeyMesh: 'meshPower' },
    switches: { label: 'Switches', unit: '', icon: Network, dataKeyClos: 'closSwitches', dataKeyMesh: 'meshSwitches' },
    cables: { label: 'Fabric Cables', unit: '', icon: Activity, dataKeyClos: 'closCables', dataKeyMesh: 'meshCables' },
  };

  const activeMetric = metrics[metricKey];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[450px]">
      <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
            <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                <TrendingUp size={20} />
            </div>
            <div>
                <h3 className="font-semibold text-slate-200">Scaling Analysis</h3>
                <p className="text-xs text-slate-500">Comparing trends for 128 - 1024 users</p>
            </div>
        </div>
        
        <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 overflow-x-auto max-w-full">
          {(Object.keys(metrics) as Array<keyof typeof metrics>).map((key) => {
             const { icon: Icon, label } = metrics[key];
             const isActive = metricKey === key;
             return (
              <button
                key={key}
                onClick={() => setMetricKey(key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <Icon size={14} />
                <span className="hidden md:inline">{label}</span>
              </button>
             );
          })}
        </div>
      </div>

      <div className="flex-1 p-4 w-full h-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
                dataKey="x" 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                type="number"
                domain={[128, 1024]}
                ticks={[128, 256, 384, 512, 640, 768, 896, 1024]}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                label={{ value: 'Requested User Ports', position: 'insideBottomRight', offset: -10, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
            />
            <Tooltip
                content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                    return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md bg-opacity-90">
                        <p className="text-slate-400 text-xs mb-2">Users: <span className="text-white font-mono">{label}</span></p>
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-sm mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-300 capitalize">{entry.name}:</span>
                                <span className="font-mono text-white">
                                    {entry.value.toLocaleString()} {activeMetric.unit}
                                </span>
                            </div>
                        ))}
                        </div>
                    );
                    }
                    return null;
                }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            
            <ReferenceLine x={currentConfig.numUsers} stroke="#ffffff" strokeDasharray="3 3" opacity={0.5}>
                <Label 
                    value="Current" 
                    position="insideTopRight" 
                    fill="#ffffff" 
                    fontSize={10} 
                    offset={10}
                    className="hidden sm:block" 
                />
            </ReferenceLine>

            {highlightValues.possible && (
                <>
                    <ReferenceDot 
                        x={currentConfig.numUsers} 
                        y={highlightValues[activeMetric.dataKeyClos as keyof typeof highlightValues] as number} 
                        r={6} 
                        fill="#6366f1" 
                        stroke="#fff" 
                        strokeWidth={2} 
                    />
                    <ReferenceDot 
                        x={currentConfig.numUsers} 
                        y={highlightValues[activeMetric.dataKeyMesh as keyof typeof highlightValues] as number} 
                        r={6} 
                        fill="#ec4899" 
                        stroke="#fff" 
                        strokeWidth={2} 
                    />
                </>
            )}

            <Line
                name="Folded Clos"
                type="monotone"
                dataKey={activeMetric.dataKeyClos}
                stroke="#6366f1" // Indigo 500
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#818cf8' }}
                animationDuration={1000}
            />
            <Line
                name="Full Mesh"
                type="monotone"
                dataKey={activeMetric.dataKeyMesh}
                stroke="#ec4899" // Pink 500
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#f472b6' }}
                animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MetricsChart;