import { NetworkConfig, TopologyMetrics } from '../types';

export const calculateClos = (config: NetworkConfig): TopologyMetrics => {
  const { numUsers, radix, powerPerSwitch, cablePowerClos } = config;
  
  // Folded Clos (Leaf-Spine or Fat Tree)
  // Non-blocking (1:1 oversubscription) design at all layers.
  
  const userPortsPerLeaf = Math.floor(radix / 2); 
  
  if (userPortsPerLeaf === 0) {
     return {
      name: 'Folded Clos',
      totalSwitches: 0,
      totalCables: 0,
      avgHops: 0,
      maxHops: 0,
      totalPower: 0,
      userCapacity: 0,
      details: "Radix too small.",
      possible: false,
      switchConfig: {}
    };
  }

  // Tier 1: Leafs
  // We need enough leafs to cover users.
  const numLeafs = Math.ceil(numUsers / userPortsPerLeaf);
  const totalUserCapacity = numLeafs * userPortsPerLeaf;
  
  // Calculate Uplinks required from Tier 1
  // For non-blocking, Uplink BW = Downlink BW (User ports).
  // Total Uplinks = numLeafs * userPortsPerLeaf.
  
  let totalSwitches = 0;
  let fabricCables = 0;
  let tiers = 2;
  let switchConfig: any = {};
  let details = "";
  
  // 2-Tier Limit:
  if (numLeafs <= radix) {
      // 2-Tier
      // Spines needed to handle total uplink bandwidth
      // Each spine provides 'radix' ports.
      const totalUplinks = numLeafs * userPortsPerLeaf;
      const numSpines = Math.ceil(totalUplinks / radix);
      
      totalSwitches = numLeafs + numSpines;
      fabricCables = totalUplinks; 
      details = `2-Tier: ${numLeafs} Leafs, ${numSpines} Spines`;
      switchConfig = { leafs: numLeafs, spines: numSpines, userPortsPerSwitch: userPortsPerLeaf };
      tiers = 2;
  } else {
      // 3-Tier (Leaf -> Agg -> Core)
      tiers = 3;
      
      const numAgg = numLeafs;
      
      // Total Uplinks from Agg layer to Core layer:
      // Agg switches have k ports. k/2 down to leafs, k/2 up to core.
      // Total Uplinks = numAgg * (radix / 2).
      const totalAggUplinks = numAgg * Math.floor(radix / 2);

      // Number of Core Switches (Tier 3):
      const numCore = Math.ceil(totalAggUplinks / radix);
      
      // Check limits (Max Pods = radix). 
      const maxUsers3Tier = (radix / 2) * (radix / 2) * radix;

      if (numUsers > maxUsers3Tier) {
         return {
          name: 'Folded Clos (3-Tier)',
          totalSwitches: 0,
          totalCables: 0,
          avgHops: 0,
          maxHops: 0,
          totalPower: 0,
          userCapacity: 0,
          details: `Requires >3 Tiers. Max users ${maxUsers3Tier}.`,
          possible: false,
          switchConfig: {}
        };
      }

      totalSwitches = numLeafs + numAgg + numCore;
      
      // Cables (Fabric only)
      const cablesT1T2 = numLeafs * userPortsPerLeaf;
      const cablesT2T3 = totalAggUplinks;
      
      fabricCables = cablesT1T2 + cablesT2T3;
      
      details = `3-Tier: ${numLeafs} Leafs, ${numAgg} Agg, ${numCore} Core`;
      switchConfig = { leafs: numLeafs, spines: numAgg, core: numCore, userPortsPerSwitch: userPortsPerLeaf };
  }

  // Power Calculation: 
  // Switch Power + Cable Power.
  // cablePowerClos is now per PLUG. 2 plugs per cable.
  const totalPower = (totalSwitches * powerPerSwitch) + (fabricCables * cablePowerClos * 2);
  
  // Hops (Link Hops / Graph Edges)
  // We calculate "Fabric Hops" (Inter-switch hops).
  // We ignore local traffic (0 hops) to provide the structural latency of the fabric.
  
  let avgHops = 0;
  if (tiers === 2) {
      // In a 2-tier Clos, any traffic not to the local switch goes Leaf -> Spine -> Leaf
      avgHops = 2;
  } else {
      // 3-Tier (Leaf -> Agg -> Core)
      // Traffic can remain in the same Pod (Leaf -> Agg -> Leaf) = 2 hops.
      // Or go across Pods (Leaf -> Agg -> Core -> Agg -> Leaf) = 4 hops.
      
      const leavesPerPod = Math.floor(radix / 2);
      
      // If there is only 1 leaf, it's all local (but we exclude local). 
      // If there are multiple leaves, we distribute traffic to other leaves.
      // Total other leaves = numLeafs - 1.
      // Leaves in same pod (excluding self) = leavesPerPod - 1.
      // Leaves in other pods = numLeafs - leavesPerPod.
      
      if (numLeafs > 1) {
          const totalRemoteLeaves = numLeafs - 1;
          // Clamp to 0 if leavesPerPod > numLeafs (single pod case)
          const intraPodLeaves = Math.max(0, Math.min(leavesPerPod, numLeafs) - 1);
          const interPodLeaves = Math.max(0, numLeafs - leavesPerPod);
          
          const pIntraPod = intraPodLeaves / totalRemoteLeaves;
          const pInterPod = interPodLeaves / totalRemoteLeaves;
          
          avgHops = (pIntraPod * 2) + (pInterPod * 4);
      } else {
          avgHops = 0; // Should not happen given numUsers check
      }
  }

  return {
    name: `Folded Clos (${tiers}-Tier)`,
    totalSwitches,
    totalCables: fabricCables,
    avgHops: parseFloat(avgHops.toFixed(2)),
    maxHops: tiers === 2 ? 2 : 4,
    totalPower,
    userCapacity: totalUserCapacity,
    details,
    possible: true,
    switchConfig
  };
};

export const calculateFullMesh = (config: NetworkConfig, requiredUserPorts?: number): TopologyMetrics => {
  const { numUsers, radix, powerPerSwitch, cablePowerMesh, meshFabricRatio, meshOneHopTraffic } = config;

  const targetUsers = requiredUserPorts || numUsers;

  let bestMetrics: TopologyMetrics | null = null;
  
  // Enforce Fabric:User ratio strictly on the switch partition.
  // We determine the minimum number of ports that MUST be dedicated to fabric 
  // to satisfy the ratio, regardless of whether the user ports are fully utilized or not.
  // Formula: FabricPorts / (Radix - FabricPorts) >= Ratio
  // => FabricPorts >= (Ratio * Radix) / (1 + Ratio)
  
  const minFabricPorts = Math.ceil((meshFabricRatio * radix) / (1 + meshFabricRatio));
  
  // Iterate S (Switch count) to find the minimal S that satisfies the user capacity requirement.
  for (let s = 2; s <= 500; s++) { 
    // Determine links per peer needed to achieve at least minFabricPorts.
    // Fabric ports must be a multiple of (s-1) for symmetric full mesh.
    let linksPerPeer = Math.ceil(minFabricPorts / (s - 1));
    if (linksPerPeer < 1) linksPerPeer = 1; 
    
    const actualFabricPorts = linksPerPeer * (s - 1);
    const actualUserPorts = radix - actualFabricPorts;
    
    // If fabric requirements consume the entire switch (or more), this S is invalid/inefficient
    // (e.g. S is so large that even 1 link per peer exceeds Radix).
    if (actualUserPorts <= 0) {
        // If 1 link per peer is too much, larger S will also be too much.
        if (linksPerPeer === 1) break; 
        continue;
    }

    const totalCapacity = s * actualUserPorts;
    
    if (totalCapacity >= targetUsers) {
        // Valid Solution found
        
        const fabricCables = (s * (s - 1) / 2) * linksPerPeer;
        
        // Power Calculation:
        // cablePowerMesh is per PLUG. 2 plugs per cable.
        const totalPower = (s * powerPerSwitch) + (fabricCables * cablePowerMesh * 2);
        
        const oneHopRatio = meshOneHopTraffic / 100;
        const avgHops = (oneHopRatio * 1) + ((1 - oneHopRatio) * 2);

        bestMetrics = {
          name: 'Full Mesh',
          totalSwitches: s,
          totalCables: fabricCables,
          avgHops: parseFloat(avgHops.toFixed(2)),
          maxHops: 2,
          totalPower,
          userCapacity: totalCapacity,
          details: `${s} Switches, ${linksPerPeer}x LAG. (U:${actualUserPorts}/F:${actualFabricPorts})`,
          possible: true,
          switchConfig: { meshSwitches: s, userPortsPerSwitch: actualUserPorts }
        };
        break;
    }
  }
  
  if (!bestMetrics) {
     return {
      name: 'Full Mesh',
      totalSwitches: 0,
      totalCables: 0,
      avgHops: 0,
      maxHops: 0,
      totalPower: 0,
      userCapacity: 0,
      details: `Cannot support ${targetUsers} users with Radix ${radix} & Ratio ${meshFabricRatio}.`,
      possible: false,
      switchConfig: {}
    };
  }

  return bestMetrics;
};