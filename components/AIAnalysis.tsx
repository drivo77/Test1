import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { TopologyMetrics, NetworkConfig } from '../types';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  clos: TopologyMetrics;
  mesh: TopologyMetrics;
  config: NetworkConfig;
}

const AIAnalysis: React.FC<Props> = ({ clos, mesh, config }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!process.env.API_KEY) {
         throw new Error("API Key not found in environment.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        Act as a senior network architect. 
        Compare a Folded Clos (Leaf-Spine) topology with a Direct-Connect Full-Mesh topology for a packet network.
        
        Configuration:
        - Total User Ports Needed: ${config.numUsers}
        - Switch Radix (Ports per switch): ${config.radix}
        - Power/Switch (ASIC): ${config.powerPerSwitch}W
        - Power/Plug (Clos): ${config.cablePowerClos}W
        - Power/Plug (Mesh): ${config.cablePowerMesh}W

        Results:
        1. Folded Clos:
           - Switches: ${clos.totalSwitches}
           - Cables: ${clos.totalCables}
           - Avg Hops: ${clos.avgHops}
           - Power: ${clos.totalPower}W
           - Feasible: ${clos.possible}

        2. Full Mesh:
           - Switches: ${mesh.totalSwitches}
           - Cables: ${mesh.totalCables}
           - Avg Hops: ${mesh.avgHops}
           - Power: ${mesh.totalPower}W
           - Feasible: ${mesh.possible}

        Provide a concise, professional analysis (max 200 words) focusing on the trade-offs between complexity, latency, power efficiency, and scalability based on these numbers. Which one is the winner for this specific scale?
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAnalysis(response.text || "No analysis generated.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={120} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="text-amber-400" size={20} />
            AI Architect Analysis
          </h3>
          <button
            onClick={generateAnalysis}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
            {analysis ? 'Regenerate' : 'Analyze Trade-offs'}
          </button>
        </div>

        {error && (
            <div className="p-3 mb-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {error}
            </div>
        )}

        <div className="min-h-[100px] text-slate-300 leading-relaxed text-sm">
          {analysis ? (
             <div className="markdown-prose animate-in fade-in duration-500">
               {analysis.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
             </div>
          ) : (
            <div className="text-slate-500 italic flex flex-col items-center justify-center py-8">
               <p>Click analyze to get a Gemini-powered assessment of these topologies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;