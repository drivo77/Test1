import React, { useMemo } from 'react';
import { TopologyMetrics, Node, Link } from '../types';

interface Props {
  metrics: TopologyMetrics;
  type: 'clos' | 'mesh';
}

const TopologyVisualizer: React.FC<Props> = ({ metrics, type }) => {
  const width = 400;
  const height = 300;

  const data = useMemo(() => {
    if (!metrics.possible) return { nodes: [], links: [] };

    const nodes: Node[] = [];
    const links: Link[] = [];

    if (type === 'clos') {
      const { leafs = 0, spines = 0, core = 0 } = metrics.switchConfig;
      
      const hasCore = core > 0;
      
      // Dynamic Scaling
      // We want to fit 'leafs' nodes in width.
      // Padding on sides: 5%.
      const availableWidth = width * 0.9;
      const xOffset = width * 0.05;
      
      // Node Sizes
      // Base size 12, but scale down if crowded.
      // Max items in a row = max(leafs, spines, core)
      const maxRowItems = Math.max(leafs, spines, core);
      const nodeSize = Math.max(2, Math.min(16, (availableWidth / maxRowItems) * 0.6));
      
      // Helper to generate positions
      const getX = (index: number, total: number) => {
        if (total === 1) return width / 2;
        const step = availableWidth / (total - 1);
        return xOffset + (step * index);
      };

      // Tiers Y positions
      const yLeaf = 260;
      const ySpine = hasCore ? 160 : 100;
      const yCore = 50;

      // Leafs (Bottom)
      for (let i = 0; i < leafs; i++) {
        nodes.push({ 
            id: `leaf-${i}`, 
            type: 'leaf', 
            x: getX(i, leafs), 
            y: yLeaf 
        });
      }

      // Spines (Middle)
      for (let i = 0; i < spines; i++) {
        nodes.push({ 
            id: `spine-${i}`, 
            type: 'spine', 
            x: getX(i, spines), 
            y: ySpine 
        });
      }

      // Core (Top)
      if (hasCore) {
        for (let i = 0; i < core; i++) {
            nodes.push({ 
                id: `core-${i}`, 
                type: 'core', 
                x: getX(i, core), 
                y: yCore 
            });
        }
      }

      // Connectivity
      // We draw symbolic full mesh between layers.
      // L <-> S
      // If count is high, drawing all links is black ink.
      // We'll draw links with low opacity.
      // Optimization: If > 50 nodes per row, maybe limit lines? 
      // User asked for "match number of switches". 
      // We will draw all lines but very thin.
      
      for (let i = 0; i < leafs; i++) {
        for (let j = 0; j < spines; j++) {
           links.push({ source: `leaf-${i}`, target: `spine-${j}`, type: 'uplink' });
        }
      }

      if (hasCore) {
        for (let i = 0; i < spines; i++) {
            for (let j = 0; j < core; j++) {
               links.push({ source: `spine-${i}`, target: `core-${j}`, type: 'uplink' });
            }
        }
      }

      return { nodes, links, nodeSize };

    } else {
      // Full Mesh
      const { meshSwitches = 0 } = metrics.switchConfig;
      
      const cx = width / 2;
      const cy = height / 2;
      
      // Radius depends on number of switches to prevent overlap?
      // Fixed radius is fine, just scale dots.
      const radius = Math.min(width, height) * 0.35;
      
      const angleStep = (2 * Math.PI) / meshSwitches;
      
      // Scale node size
      // Circumference ~ 2*PI*radius ~ 2*3.14*100 = 600.
      // items = meshSwitches.
      // size = (600 / meshSwitches) * 0.5
      const nodeSize = Math.max(2, Math.min(12, (2 * Math.PI * radius / meshSwitches) * 0.6));

      for (let i = 0; i < meshSwitches; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const id = `sw-${i}`;
        
        nodes.push({ id, type: 'mesh', x, y });

        // Inter-switch links
        for (let j = i + 1; j < meshSwitches; j++) {
          links.push({ source: id, target: `sw-${j}`, type: 'peer' });
        }
      }

      return { nodes, links, nodeSize };
    }
  }, [metrics, type]);

  if (!metrics.possible) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 italic bg-slate-900/30">
        <span className="text-red-400 mb-2">Impossible Topology</span>
        <span className="text-xs text-center px-4">{metrics.details}</span>
      </div>
    );
  }

  // Calculate stroke width based on density
  const strokeWidth = Math.max(0.2, 100 / data.links.length); 

  return (
    <div className="w-full h-full relative overflow-hidden">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Links */}
        <g>
        {data.links.map((link, i) => {
          const src = data.nodes.find(n => n.id === link.source)!;
          const trg = data.nodes.find(n => n.id === link.target)!;
          return (
            <line
              key={`link-${i}`}
              x1={src.x}
              y1={src.y}
              x2={trg.x}
              y2={trg.y}
              stroke={link.type === 'peer' ? '#ec4899' : '#6366f1'}
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
          );
        })}
        </g>

        {/* Nodes */}
        {data.nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            {node.type === 'core' && (
              <rect x={-data.nodeSize} y={-data.nodeSize*0.6} width={data.nodeSize*2} height={data.nodeSize*1.2} rx={data.nodeSize*0.2} fill="#818cf8" />
            )}
            {node.type === 'spine' && (
              <rect x={-data.nodeSize} y={-data.nodeSize} width={data.nodeSize*2} height={data.nodeSize*2} rx={data.nodeSize*0.4} fill="#6366f1" />
            )}
            {node.type === 'leaf' && (
              <rect x={-data.nodeSize} y={-data.nodeSize} width={data.nodeSize*2} height={data.nodeSize*2} rx={data.nodeSize*0.4} fill="#14b8a6" />
            )}
            {node.type === 'mesh' && (
              <circle r={data.nodeSize} fill="#ec4899" />
            )}
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 backdrop-blur-sm flex flex-col items-end shadow-lg">
         <span className="font-semibold text-slate-400 mb-0.5">
             {metrics.switchConfig.leafs ? `${metrics.switchConfig.leafs} Leaf / ${metrics.switchConfig.spines} Spine${metrics.switchConfig.core ? ` / ${metrics.switchConfig.core} Core` : ''}` : `${metrics.switchConfig.meshSwitches} Switches`}
         </span>
         {metrics.switchConfig.userPortsPerSwitch && (
             <span className="text-emerald-400">
                 {metrics.switchConfig.userPortsPerSwitch} User Ports / {metrics.switchConfig.leafs ? 'Leaf' : 'Switch'}
             </span>
         )}
      </div>
    </div>
  );
};

export default TopologyVisualizer;