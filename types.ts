export interface TopologyMetrics {
  name: string;
  totalSwitches: number;
  totalCables: number; // Fabric cables only
  avgHops: number;
  maxHops: number;
  totalPower: number;
  userCapacity: number;
  details: string;
  possible: boolean;
  switchConfig: {
    leafs?: number;
    spines?: number;
    core?: number; // For 3-tier
    meshSwitches?: number;
    userPortsPerSwitch?: number;
  };
}

export interface NetworkConfig {
  numUsers: number;
  radix: number;
  powerPerSwitch: number; // Watts
  cablePowerClos: number; // Watts (including transceivers)
  cablePowerMesh: number; // Watts (including transceivers)
  meshFabricRatio: number; // Ratio of Fabric Ports : User Ports (default 1 for non-blocking)
  meshOneHopTraffic: number; // Percentage 0-100 of traffic that takes direct path
}

export interface Node {
  id: string;
  type: 'core' | 'spine' | 'leaf' | 'mesh' | 'user';
  x: number;
  y: number;
}

export interface Link {
  source: string;
  target: string;
  type: 'uplink' | 'downlink' | 'peer';
}