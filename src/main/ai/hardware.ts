import os from 'os';
import { execFileSync } from 'child_process';

import type { HardwareInfo, ModelTier } from './types';

function detectNvidiaVramMbWindows(): number | null {
  try {
    const out = execFileSync(
      'nvidia-smi',
      ['--query-gpu=memory.total', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true }
    ).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim() ?? '';
    const mb = Number.parseInt(firstLine, 10);
    return Number.isFinite(mb) && mb > 0 ? mb : null;
  } catch {
    return null;
  }
}

function detectGpuWindows(): { name: string | null; vramMb: number | null; hasNvidia: boolean } {
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress"
      ],
      { encoding: 'utf8', timeout: 5000, windowsHide: true }
    ).trim();
    if (!out) return { name: null, vramMb: null, hasNvidia: false };
    const parsed = JSON.parse(out) as
      | { Name?: string; AdapterRAM?: number }
      | Array<{ Name?: string; AdapterRAM?: number }>;
    const adapters = Array.isArray(parsed) ? parsed : [parsed];

    let primary: { Name?: string; AdapterRAM?: number } | null = null;
    let hasNvidia = false;

    for (const adapter of adapters) {
      const name = typeof adapter.Name === 'string' ? adapter.Name : '';
      if (!name || /microsoft basic/i.test(name)) continue;
      if (/nvidia/i.test(name)) {
        hasNvidia = true;
        primary = adapter;
        break;
      }
      if (!primary) primary = adapter;
    }

    const name = primary?.Name ?? null;
    const ram =
      typeof primary?.AdapterRAM === 'number' && primary.AdapterRAM > 0 ? primary.AdapterRAM : null;
    let vramMb = ram != null ? Math.round(ram / (1024 * 1024)) : null;
    if (hasNvidia) {
      const nvidiaVram = detectNvidiaVramMbWindows();
      if (nvidiaVram != null) vramMb = nvidiaVram;
    }
    return { name, vramMb, hasNvidia };
  } catch {
    return { name: null, vramMb: null, hasNvidia: false };
  }
}

function detectGpuMac(): { name: string | null; vramMb: number | null; hasNvidia: boolean } {
  try {
    const out = execFileSync('system_profiler', ['SPDisplaysDataType', '-json'], {
      encoding: 'utf8',
      timeout: 8000
    });
    const parsed = JSON.parse(out) as {
      SPDisplaysDataType?: Array<{ sppci_model?: string; _spdisplays_vram?: string }>;
    };
    const display = parsed.SPDisplaysDataType?.[0];
    const name = display?.sppci_model ?? null;
    const vramRaw = display?._spdisplays_vram ?? '';
    const match = /(\d+)\s*MB/i.exec(vramRaw);
    const vramMb = match ? Number.parseInt(match[1], 10) : null;
    return { name, vramMb, hasNvidia: Boolean(name && /nvidia/i.test(name)) };
  } catch {
    return { name: null, vramMb: null, hasNvidia: false };
  }
}

function detectGpu(): { name: string | null; vramMb: number | null; hasNvidia: boolean } {
  if (process.platform === 'win32') return detectGpuWindows();
  if (process.platform === 'darwin') return detectGpuMac();
  return { name: null, vramMb: null, hasNvidia: false };
}

function detectCpuWindows(): { model: string | null; frequencyGhz: number | null } {
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Processor | Select-Object -First 1 Name, MaxClockSpeed | ConvertTo-Json -Compress'
      ],
      { encoding: 'utf8', timeout: 5000, windowsHide: true }
    ).trim();
    if (!out) return { model: null, frequencyGhz: null };
    const parsed = JSON.parse(out) as { Name?: string; MaxClockSpeed?: number };
    const model = typeof parsed.Name === 'string' ? parsed.Name.trim() : null;
    const mhz = typeof parsed.MaxClockSpeed === 'number' ? parsed.MaxClockSpeed : null;
    const frequencyGhz = mhz != null && mhz > 0 ? Math.round((mhz / 1000) * 100) / 100 : null;
    return { model: model || null, frequencyGhz };
  } catch {
    return { model: null, frequencyGhz: null };
  }
}

function detectCpuMac(): { model: string | null; frequencyGhz: number | null } {
  try {
    const model = execFileSync('sysctl', ['-n', 'machdep.cpu.brand_string'], {
      encoding: 'utf8',
      timeout: 3000
    }).trim();
    let frequencyGhz: number | null = null;
    try {
      const hz = Number.parseInt(
        execFileSync('sysctl', ['-n', 'hw.cpufrequency_max'], { encoding: 'utf8', timeout: 3000 }).trim(),
        10
      );
      if (Number.isFinite(hz) && hz > 0) frequencyGhz = Math.round((hz / 1e9) * 100) / 100;
    } catch {
      /* optional */
    }
    return { model: model || null, frequencyGhz };
  } catch {
    return { model: null, frequencyGhz: null };
  }
}

function detectCpuFallback(): { model: string | null; frequencyGhz: number | null } {
  const cpu = os.cpus()[0];
  const model = cpu?.model?.trim() || null;
  const frequencyGhz =
    cpu?.speed != null && cpu.speed > 0 ? Math.round((cpu.speed / 1000) * 100) / 100 : null;
  return { model, frequencyGhz };
}

function detectCpu(): { model: string | null; frequencyGhz: number | null } {
  if (process.platform === 'win32') {
    const win = detectCpuWindows();
    if (win.model) return win;
  }
  if (process.platform === 'darwin') {
    const mac = detectCpuMac();
    if (mac.model) return mac;
  }
  return detectCpuFallback();
}

function recommendTier(totalMemoryMb: number, vramMb: number | null, _cpuCores: number): ModelTier {
  if (totalMemoryMb >= 12288 && vramMb != null && vramMb >= 6000) return 'heavy';
  return 'light';
}

export function getSupportedTiers(info: HardwareInfo): ModelTier[] {
  const supported: ModelTier[] = ['light'];
  if (info.totalMemoryMb >= 12288) {
    supported.push('heavy');
  }
  return supported;
}

export function isTierSupported(info: HardwareInfo, tier: ModelTier): boolean {
  return getSupportedTiers(info).includes(tier);
}

export function detectHardware(): HardwareInfo {
  const cpuCores = os.cpus().length;
  const cpu = detectCpu();
  const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
  const gpu = detectGpu();
  const hasGpu = Boolean(gpu.name && !/microsoft basic/i.test(gpu.name));

  return {
    platform: process.platform,
    cpuCores,
    cpuModel: cpu.model,
    cpuFrequencyGhz: cpu.frequencyGhz,
    totalMemoryMb,
    hasGpu,
    hasNvidiaGpu: gpu.hasNvidia,
    gpuName: gpu.name,
    estimatedVramMb: gpu.vramMb,
    recommendedTier: recommendTier(totalMemoryMb, gpu.vramMb, cpuCores)
  };
}
