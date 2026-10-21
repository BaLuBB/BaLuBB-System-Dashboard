import si from 'systeminformation';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Fehlende Sensoren/Rechte sollen nie die ganze Messung kippen. */
const safe = async (promise, fallback = null) => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

export async function staticInfo() {
  const [os, system, cpu] = await Promise.all([
    safe(si.osInfo(), {}),
    safe(si.system(), {}),
    safe(si.cpu(), {}),
  ]);
  return {
    hostname: os.hostname,
    os: [os.distro, os.release].filter(Boolean).join(' '),
    kernel: os.kernel,
    arch: os.arch,
    model: [system.manufacturer, system.model].filter(Boolean).join(' '),
    cpu: [cpu.manufacturer, cpu.brand].filter(Boolean).join(' '),
    cores: cpu.cores,
    physicalCores: cpu.physicalCores,
  };
}

export async function collect() {
  const [load, speed, temp, mem, fs, io, net, ifaces, procs, battery, gfx, users] =
    await Promise.all([
      safe(si.currentLoad()),
      safe(si.cpuCurrentSpeed()),
      safe(si.cpuTemperature()),
      safe(si.mem()),
      safe(si.fsSize(), []),
      safe(si.disksIO()),
      safe(si.networkStats('*'), []),
      safe(si.networkInterfaces(), []),
      safe(si.processes()),
      safe(si.battery()),
      safe(si.graphics()),
      safe(si.users(), []),
    ]);

  const ipByIface = new Map(
    [].concat(ifaces ?? []).map((i) => [i.iface, [i.ip4, i.ip6].filter(Boolean)]),
  );
  const t = si.time();

  const topBy = (key) =>
    [...(procs?.list ?? [])]
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, 15)
      .map((p) => ({
        pid: p.pid, name: p.name, user: p.user,
        cpu: num(p.cpu), mem: num(p.mem), state: p.state,
      }));

  return {
    time: new Date().toISOString(),
    uptime: t.uptime,
    cpu: {
      percent: num(load?.currentLoad),
      perCore: (load?.cpus ?? []).map((c) => num(c.load)),
      avgGhz: num(speed?.avg),
      maxGhz: num(speed?.max),
      tempC: num(temp?.main),
      tempMaxC: num(temp?.max),
      coreTemps: temp?.cores ?? [],
    },
    memory: mem && {
      total: mem.total, used: mem.active, available: mem.available,
      swapTotal: mem.swaptotal, swapUsed: mem.swapused,
    },
    disks: (fs ?? []).map((d) => ({
      fs: d.fs, mount: d.mount, type: d.type,
      size: d.size, used: d.used, percent: num(d.use),
    })),
    diskIo: io && { readBps: num(io.rIO_sec), writeBps: num(io.wIO_sec) },
    network: (net ?? []).map((n) => ({
      iface: n.iface, up: n.operstate === 'up',
      ips: ipByIface.get(n.iface) ?? [],
      rxBps: num(n.rx_sec) ?? 0, txBps: num(n.tx_sec) ?? 0,
      rxTotal: n.rx_bytes, txTotal: n.tx_bytes,
      errors: (n.rx_errors ?? 0) + (n.tx_errors ?? 0),
    })),
    battery: battery?.hasBattery
      ? { percent: battery.percent, charging: battery.isCharging, minutesLeft: battery.timeRemaining }
      : null,
    gpus: (gfx?.controllers ?? []).map((g) => ({
      name: g.model, vendor: g.vendor,
      util: num(g.utilizationGpu), tempC: num(g.temperatureGpu),
      memUsedMb: num(g.memoryUsed), memTotalMb: num(g.memoryTotal),
    })),
    users: (users ?? []).map((u) => ({
      user: u.user, tty: u.tty, ip: u.ip, since: `${u.date} ${u.time}`.trim(),
    })),
    processes: {
      total: procs?.all ?? 0, running: procs?.running ?? 0, sleeping: procs?.sleeping ?? 0,
      topCpu: topBy('cpu'), topMem: topBy('mem'),
    },
  };
}
