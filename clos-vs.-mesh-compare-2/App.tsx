import React, { useState } from 'react';
import { calculateClos, calculateFullMesh } from './utils/networkMath';
import { NetworkConfig, TopologyMetrics } from './types';
import TopologyVisualizer from './components/TopologyVisualizer';
import MetricsChart from './components/MetricsChart';
import { 
  Settings, 
  Network, 
  Activity, 
  Zap, 
  Share2, 
  Box, 
  ArrowRightLeft,
  Info,
  Sliders,
  Users,
  Plug,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<NetworkConfig>({
    numUsers: 1024,
    radix: 64,
    powerPerSwitch: 1700,
    cablePowerClos: 25,
    cablePowerMesh: 27.5,
    meshFabricRatio: 1.2, 
    meshOneHopTraffic: 80, // Default 80% 1-hop
  });

  // Calculate Clos first
  const closMetrics = calculateClos(config);
  
  // Calculate Mesh using Clos capacity as the requirement
  const meshMetrics = calculateFullMesh(config, closMetrics.userCapacity);

  // Derived Metrics
  const closPowerPerPort = closMetrics.userCapacity > 0 ? (closMetrics.totalPower / closMetrics.userCapacity) : 0;
  const meshPowerPerPort = meshMetrics.userCapacity > 0 ? (meshMetrics.totalPower / meshMetrics.userCapacity) : 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof NetworkConfig, isFloat: boolean = false) => {
    const value = isFloat ? parseFloat(e.target.value) : (parseInt(e.target.value) || 0);
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
               <Share2 size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Folded-CLOS vs. OCS-enabled Direct Mesh
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
             <span className="flex items-center gap-1 hover:text-slate-200 transition"><Box size={16}/> Clos vs Mesh</span>
          </div>
        </div>
      </header>

      <main className="container max-w-[1920px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">
          
          {/* Controls Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl max-h-[calc(100vh-100px)] overflow-y-auto">
              <div className="flex items-center gap-2 mb-6 text-indigo-400">
                <Settings size={20} />
                <h2 className="font-semibold">Configuration</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Minimum Number of User Ports
                  </label>
                  <div className="relative group">
                    <input
                      type="number"
                      value={config.numUsers}
                      onChange={(e) => handleInputChange(e, 'numUsers')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="128" step="128"
                    />
                    <div className="absolute right-1 top-1 bottom-1 w-6 flex flex-col gap-1">
                      <button 
                        onClick={() => setConfig(prev => ({...prev, numUsers: prev.numUsers + 128}))}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-sm flex items-center justify-center text-white transition-colors"
                      >
                        <ChevronUp size={12} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => setConfig(prev => ({...prev, numUsers: Math.max(128, prev.numUsers - 128)}))}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-sm flex items-center justify-center text-white transition-colors"
                      >
                        <ChevronDown size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <input 
                     type="range"
                     min="128" max="4096" step="128"
                     value={config.numUsers}
                     onChange={(e) => handleInputChange(e, 'numUsers')}
                     className="w-full mt-2 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Switch Radix (k)
                  </label>
                  <select
                    value={config.radix}
                    onChange={(e) => setConfig(p => ({...p, radix: parseInt(e.target.value)}))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value={16}>16 Ports</option>
                    <option value={32}>32 Ports</option>
                    <option value={64}>64 Ports</option>
                    <option value={128}>128 Ports</option>
                    <option value={256}>256 Ports</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-800">
                   <h3 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2"><Zap size={12}/> Power Settings</h3>
                   <div className="space-y-4">
                      <div>
                        <label className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Switch ASIC Power</span>
                            <span>{config.powerPerSwitch} W</span>
                        </label>
                        <input
                            type="range" min="100" max="1700" step="100"
                            value={config.powerPerSwitch}
                            onChange={(e) => handleInputChange(e, 'powerPerSwitch')}
                            className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Clos Plug Power</span>
                            <span>{config.cablePowerClos} W</span>
                        </label>
                        <input
                            type="range" min="0.5" max="27.5" step="0.5"
                            value={config.cablePowerClos}
                            onChange={(e) => handleInputChange(e, 'cablePowerClos', true)}
                            className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Mesh Plug Power</span>
                            <span>{config.cablePowerMesh} W</span>
                        </label>
                        <input
                            type="range" min="0.5" max="27.5" step="0.5"
                            value={config.cablePowerMesh}
                            onChange={(e) => handleInputChange(e, 'cablePowerMesh', true)}
                            className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2"><Sliders size={12}/> Mesh Constraints</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Fabric:User Ratio</span>
                                <span>{config.meshFabricRatio}:1</span>
                            </label>
                            <input
                                type="range" min="1.0" max="2.0" step="0.1"
                                value={config.meshFabricRatio}
                                onChange={(e) => handleInputChange(e, 'meshFabricRatio', true)}
                                className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="text-[10px] text-slate-600 mt-1">
                                1.0 = Non-blocking (1:1). Higher values require more switches for fabric.
                            </div>
                        </div>
                        <div>
                            <label className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Mesh Traffic % (1-Hop)</span>
                                <span>{config.meshOneHopTraffic}%</span>
                            </label>
                            <input
                                type="range" min="0" max="100" step="5"
                                value={config.meshOneHopTraffic}
                                onChange={(e) => handleInputChange(e, 'meshOneHopTraffic')}
                                className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="text-[10px] text-slate-600 mt-1">
                                Remaining {100 - config.meshOneHopTraffic}% traverses 2 hops.
                            </div>
                        </div>
                    </div>
                </div>

              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
               <MetricCard 
                 title="Total Switches" 
                 clos={closMetrics.totalSwitches} 
                 mesh={meshMetrics.totalSwitches}
                 closPossible={closMetrics.possible}
                 meshPossible={meshMetrics.possible} 
                 unit=""
                 icon={<Network size={18} />}
                 inverse={true} 
               />
               <MetricCard 
                 title="Fabric Cables" 
                 clos={closMetrics.totalCables} 
                 mesh={meshMetrics.totalCables}
                 closPossible={closMetrics.possible}
                 meshPossible={meshMetrics.possible} 
                 unit=""
                 icon={<Activity size={18} />}
                 inverse={true}
               />
               <MetricCard 
                 title="Avg Hops" 
                 clos={closMetrics.avgHops} 
                 mesh={meshMetrics.avgHops} 
                 closPossible={closMetrics.possible}
                 meshPossible={meshMetrics.possible}
                 unit=""
                 icon={<ArrowRightLeft size={18} />}
                 inverse={true}
               />
               <MetricCard 
                 title="Total Power" 
                 clos={closMetrics.totalPower} 
                 mesh={meshMetrics.totalPower}
                 closPossible={closMetrics.possible}
                 meshPossible={meshMetrics.possible} 
                 unit="W"
                 icon={<Zap size={18} />}
                 inverse={true}
                 format={(v) => v > 1000 ? `${(v/1000).toFixed(1)}k` : v}
               />
               <MetricCard 
                 title="Power per Port" 
                 clos={closPowerPerPort} 
                 mesh={meshPowerPerPort}
                 closPossible={closMetrics.possible}
                 meshPossible={meshMetrics.possible} 
                 unit="W"
                 icon={<Plug size={18} />}
                 inverse={true}
                 format={(v) => Math.round(v).toString()}
               />
               <MetricCard 
                 title="User Ports" 
                 clos={closMetrics.userCapacity} 
                 mesh={meshMetrics.userCapacity}
                 closPossible={closMetrics.possible}
                 meshPossible={meshMetrics.possible} 
                 unit=""
                 icon={<Users size={18} />}
                 inverse={false}
               />
            </div>

            {/* Side-by-Side Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
                
                {/* Clos Visual */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                             <span className="font-semibold text-slate-300 text-sm">Folded Clos</span>
                        </div>
                        <span className="text-xs text-slate-500">{closMetrics.details} ({closMetrics.userCapacity} User Ports)</span>
                    </div>
                    <div className="flex-1 p-2">
                        <TopologyVisualizer metrics={closMetrics} type="clos" />
                    </div>
                </div>

                {/* Mesh Visual */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                             <span className="font-semibold text-slate-300 text-sm">Full Mesh</span>
                        </div>
                        <span className="text-xs text-slate-500 flex flex-col items-end">
                            <span>{meshMetrics.possible ? `${meshMetrics.switchConfig.meshSwitches} Switches` : 'Invalid Config'}</span>
                            <span className="text-[10px] text-slate-400">
                                {meshMetrics.possible 
                                    ? `(${meshMetrics.userCapacity} User Ports, ${meshMetrics.switchConfig.userPortsPerSwitch}/Switch)` 
                                    : '(- User Ports)'}
                            </span>
                        </span>
                    </div>
                    <div className="flex-1 p-2">
                        <TopologyVisualizer metrics={meshMetrics} type="mesh" />
                    </div>
                </div>
            </div>

            {/* Scaling Chart */}
            <MetricsChart currentConfig={config} />

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-xs text-slate-500">
               <div className="flex items-start gap-2">
                 <Info size={16} className="mt-0.5 shrink-0" />
                 <div className="space-y-1">
                    <p><strong>Cable Counts:</strong> Only inter-switch fabric cables are counted. User cables are excluded.</p>
                    <p><strong>Clos:</strong> Minimal non-blocking (1:1) Leaf-Spine (2-Tier) or Leaf-Agg-Core (3-Tier). Switch counts optimized for bandwidth.</p>
                    <p><strong>Full Mesh:</strong> Minimal switch count (S) to support the same user capacity as the Clos topology, respecting Fabric:User ratio.</p>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

// Helper for Metric Cards
const MetricCard: React.FC<{
  title: string;
  clos: number;
  mesh: number;
  closPossible: boolean;
  meshPossible: boolean;
  unit: string;
  icon: React.ReactNode;
  inverse?: boolean;
  format?: (v: number) => string | number;
}> = ({ title, clos, mesh, closPossible, meshPossible, unit, icon, inverse = false, format }) => {
  const diff = mesh - clos;
  const isMeshBetter = inverse ? diff < 0 : diff > 0;
  const diffPercent = clos !== 0 ? ((mesh - clos) / clos) * 100 : 0;
  
  const displayClos = closPossible ? (format ? format(clos) : clos.toLocaleString()) : 'Invalid';
  const displayMesh = meshPossible ? (format ? format(mesh) : mesh.toLocaleString()) : 'Invalid';

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
      <div className="flex items-center gap-2 text-slate-400 mb-2 text-sm">
        {icon}
        <span>{title}</span>
      </div>
      
      <div className="space-y-3">
          <div className="flex justify-between items-end">
              <div className="text-xs uppercase text-indigo-400 font-bold tracking-wider">Clos</div>
              <div className={`text-xl font-mono ${closPossible ? 'text-white' : 'text-slate-500'}`}>
                  {displayClos} <span className="text-sm text-slate-500">{closPossible ? unit : ''}</span>
              </div>
          </div>
          
          <div className="w-full h-px bg-slate-800"></div>

          <div className="flex justify-between items-end">
              <div className="text-xs uppercase text-pink-400 font-bold tracking-wider">Mesh</div>
              <div className={`text-xl font-mono ${meshPossible ? 'text-white' : 'text-red-400 text-sm'}`}>
                  {displayMesh} <span className="text-sm text-slate-500">{meshPossible ? unit : ''}</span>
              </div>
          </div>

          {closPossible && meshPossible ? (
            <div className={`text-xs font-medium text-right ${isMeshBetter ? 'text-green-400' : 'text-amber-400'}`}>
                Mesh is {Math.abs(diffPercent).toFixed(1)}% {diff > 0 ? 'higher' : 'lower'}
            </div>
          ) : (
            <div className="text-xs font-medium text-right text-slate-600">
                Comparison unavailable
            </div>
          )}
      </div>
    </div>
  );
}

export default App;