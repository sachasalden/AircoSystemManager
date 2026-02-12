#!/usr/bin/env -S node --input-type=module
// TypeScript-only connectivity checker tailored for Moxa NPort devices (e.g. NPort 5130A).
// It tests a set of common ports used by NPort devices and reports which are open.
// Usage (compile then run):
//   npx tsc src/moxaCheck.ts --outDir dist-esm --module ES2020 && node dist-esm/moxaCheck.js --host 192.168.55.97
// Or provide ports: --ports 4001,23,80
import * as net from 'net';
function parseArgs() {
    const args = process.argv.slice(2);
    const out = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--host' && args[i + 1])
            out.host = args[++i];
        else if (a === '--ports' && args[i + 1])
            out.ports = String(args[++i]).split(',').map((s) => Number(s.trim())).filter(Boolean);
        else if (a === '--timeout' && args[i + 1])
            out.timeout = Number(args[++i]);
    }
    out.host = out.host ?? process.env.HOST ?? '192.168.55.97';
    // Common ports for NPort / device management and serial-over-TCP
    out.ports = out.ports ?? [4001, 4000, 23, 80, 443, 502];
    out.timeout = out.timeout ?? (Number(process.env.TIMEOUT) || 2000);
    return out;
}
function tryConnect(host, port, timeout) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let finished = false;
        const onSuccess = () => {
            if (finished)
                return;
            finished = true;
            socket.destroy();
            resolve({ port, ok: true });
        };
        const onFailure = (reason) => {
            if (finished)
                return;
            finished = true;
            try {
                socket.destroy();
            }
            catch { }
            resolve({ port, ok: false, err: reason });
        };
        socket.setTimeout(timeout, () => onFailure('timeout'));
        socket.once('error', (err) => onFailure(String(err.message ?? err)));
        socket.connect({ host, port }, onSuccess);
    });
}
async function scan(host, ports, timeout) {
    console.log(`Scanning ${host} for ports: ${ports.join(', ')} (timeout ${timeout}ms)`);
    const results = [];
    for (const p of ports) {
        try {
            // sequential to avoid flooding network; quick and predictable
            // could be parallelized if desired
            // small delay between attempts reduces some network devices' rate-limiting
            const res = await tryConnect(host, p, timeout);
            results.push(res);
        }
        catch (e) {
            results.push({ port: p, ok: false, err: String(e?.message ?? e) });
        }
    }
    // Report
    const open = results.filter((r) => r.ok);
    if (open.length > 0) {
        console.log('\nOpen ports:');
        for (const r of open)
            console.log(`  - ${r.port} (open)`);
    }
    else {
        console.log('\nNo tested ports were open.');
    }
    console.log('\nFull results:');
    for (const r of results) {
        if (r.ok)
            console.log(`  ${r.port} : OK`);
        else
            console.log(`  ${r.port} : CLOSED / ${r.err}`);
    }
    // If one of the serial data ports is open (4001/4000), note it
    const serialPorts = [4001, 4000];
    const hasSerial = results.some((r) => serialPorts.includes(r.port) && r.ok);
    if (hasSerial)
        console.log('\nHint: Serial-over-TCP port detected (try connecting with a serial client).');
}
async function main() {
    const { host, ports, timeout } = parseArgs();
    await scan(host, ports, timeout);
}
if (typeof process !== 'undefined')
    main();
