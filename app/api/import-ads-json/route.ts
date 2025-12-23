import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, writeFile, readFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants as FS } from 'node:fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ImportState = Record<string, unknown> & {
  pid?: number;
  status?: string;
  stopRequested?: boolean;
  exitCode?: number | null;
  finishedAt?: string | null;
  error?: string;
};

type ImportEvent = {
  event: 'count_progress' | 'progress' | 'heartbeat' | 'count' | 'done' | 'started';
  [key: string]: unknown;
};

type ParsedAd = Record<string, unknown>;

function isImportEvent(value: unknown): value is ImportEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'event' in value &&
    typeof (value as { event?: unknown }).event === 'string'
  );
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

/* ================= utils ================= */

function jobsDir() {
  return path.join(os.tmpdir(), 'ads-import-jobs');
}
function jobDir(jobId: string) {
  return path.join(jobsDir(), jobId);
}
function jobPaths(jobId: string) {
  const dir = jobDir(jobId);
  return {
    dir,
    inputPath: path.join(dir, 'input.json'), // normalized JSON array
    rawPath: path.join(dir, 'raw.json'), // uploaded raw file (optional)
    reportPath: path.join(dir, 'report.csv'),
    stopFile: path.join(dir, 'STOP'),
    statePath: path.join(dir, 'state.json'),
    stdoutPath: path.join(dir, 'stdout.log'),
    stderrPath: path.join(dir, 'stderr.log'),
  };
}

function nowISO() {
  return new Date().toISOString();
}

function safeJsonParse(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number | null | undefined) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function fileExists(p: string) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeState(jobId: string, patch: Partial<ImportState>) {
  const { statePath } = jobPaths(jobId);
  let prev: ImportState = {};
  try {
    prev = JSON.parse(await readFile(statePath, 'utf8')) as ImportState;
  } catch {
    prev = {};
  }
  const next: ImportState = { ...prev, ...patch, updatedAt: nowISO() };
  await writeFile(statePath, JSON.stringify(next, null, 2), 'utf8');
}

async function readState(jobId: string): Promise<ImportState> {
  const { statePath } = jobPaths(jobId);
  const txt = await readFile(statePath, 'utf8');
  return JSON.parse(txt) as ImportState;
}

function logDev(...args: unknown[]) {
  // In dev you want to see everything; in prod keep it quieter
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) console.log('[import-ads-json]', ...args);
}

/* ============ JSON normalizer (ANY JSON) ============ */

function looksLikeAd(obj: unknown): obj is ParsedAd {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.ad_archive_id === 'string' ||
    typeof candidate.id === 'string' ||
    !!candidate.snapshot
  );
}

function extractAdsArray(payload: unknown): ParsedAd[] {
  if (Array.isArray(payload)) return payload as ParsedAd[];

  if (payload && typeof payload === 'object') {
    // common wrappers
    const record = payload as Record<string, unknown>;
    const candidates = ['data', 'items', 'ads', 'results', 'rows'];
    for (const k of candidates) {
      if (Array.isArray(record[k])) return record[k] as ParsedAd[];
    }
    // single ad object
    if (looksLikeAd(record)) return [record];
  }

  // NDJSON fallback: payload might be a string containing json lines
  // (we handle this in parse step if top-level JSON parse fails)
  throw new Error(
    'Unsupported JSON shape. Expected an array, or an object containing data/items/ads/results[], or a single ad object.'
  );
}

function normalizeAds(ads: ParsedAd[]): ParsedAd[] {
  // Filter out obviously invalid items but keep as much as possible
  return ads.filter((x): x is ParsedAd => x && typeof x === 'object');
}

async function parseAnyJsonBuffer(buffer: Buffer): Promise<ParsedAd[]> {
  const text = buffer.toString('utf8').trim();
  if (!text) throw new Error('Uploaded file is empty');

  // 1) try normal JSON
  try {
    const payload = JSON.parse(text);
    const arr = extractAdsArray(payload);
    return normalizeAds(arr);
  } catch {
    // 2) NDJSON: each line is JSON object
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const out: ParsedAd[] = [];
    for (const ln of lines) {
      const obj = safeJsonParse(ln);
      if (obj && typeof obj === 'object') out.push(obj as ParsedAd);
    }
    if (out.length) return normalizeAds(out);
    throw new Error('Could not parse file as JSON or NDJSON.');
  }
}

/* ================= runner ================= */

async function runImportScript(scriptPath: string, jobId: string, enableDebug: boolean) {
  const { dir, inputPath, reportPath, stopFile, stdoutPath, stderrPath } = jobPaths(jobId);

  try {
    await unlink(stopFile);
  } catch {}

  await writeState(jobId, {
    jobId,
    status: 'running',
    startedAt: nowISO(),
    reportPath,
    inputPath,
    lastProgress: null,
    lastCountProgress: null,
    countEvent: null,
    doneEvent: null,
    exitCode: null,
    debug: !!enableDebug,
  });

  console.log(
    `[import-api] Starting worker: jobId=${jobId}, script=${scriptPath}, debug=${enableDebug}`
  );

  return new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [scriptPath, inputPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        REPORT_PATH: reportPath,
        DEBUG_IMPORT: enableDebug ? 'true' : process.env.DEBUG_IMPORT ?? 'false',
        STOP_FILE: stopFile,
        JOB_ID: jobId,
        IMPORT_JOB_ID: jobId,
        STARTED_AT: Date.now().toString(),

        // (optional) buckets support for your importer
        BUCKET_PHOTO: process.env.BUCKET_PHOTO ?? '',
        BUCKET_VIDEO_PREVIEW: process.env.BUCKET_VIDEO_PREVIEW ?? '',
        BUCKET_VIDEO: process.env.BUCKET_VIDEO ?? '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    writeState(jobId, { pid: child.pid, workdir: dir }).catch(() => {});
    logDev('spawned', { jobId, pid: child.pid, scriptPath, inputPath, reportPath });

    child.stdout.on('data', async (chunk) => {
      const text = chunk.toString('utf8');
      writeFile(stdoutPath, text, { flag: 'a' }).catch(() => {});

      // print to dev console (optional but super useful)
      logDev(`stdout(${jobId})`, text.trim().slice(0, 4000));

      const lines = text.split('\n');
      for (const line of lines) {
        const l = line.trim();
        if (!l) continue;

        const parsed = safeJsonParse(l);
        if (isImportEvent(parsed)) {
          const { event } = parsed;
          if (event === 'count_progress') {
            await writeState(jobId, { lastCountProgress: parsed });
          } else if (event === 'progress' || event === 'heartbeat') {
            await writeState(jobId, { lastProgress: parsed });
          } else if (event === 'count') {
            await writeState(jobId, { countEvent: parsed });
          } else if (event === 'done') {
            await writeState(jobId, { doneEvent: parsed });
          } else if (event === 'started') {
            await writeState(jobId, { startedEvent: parsed });
          }
        }
      }
    });

    child.stderr.on('data', async (chunk) => {
      const text = chunk.toString('utf8');
      writeFile(stderrPath, text, { flag: 'a' }).catch(() => {});
      await writeState(jobId, { lastStderrAt: nowISO() });

      // print to dev console
      logDev(`stderr(${jobId})`, text.trim().slice(0, 4000));
    });

    child.on('error', async (err) => {
      await writeState(jobId, {
        status: 'failed',
        exitCode: 1,
        error: `spawn error: ${err.message}`,
        finishedAt: nowISO(),
      });
      logDev('child error', { jobId, err: err.message });
      resolve();
    });

    child.on('close', async (code) => {
      const status = code === 0 ? 'done' : 'failed';
      await writeState(jobId, {
        status,
        exitCode: code ?? 1,
        finishedAt: nowISO(),
      });
      logDev('child closed', { jobId, code, status });
      resolve();
    });
  });
}

/* ================= handlers ================= */

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const action = form.get('action') as string | null;
    const debugFlag = (form.get('debug') as string | null) || null;
    const enableDebug = !!debugFlag && (debugFlag === '1' || debugFlag === 'true');

    // STOP
    if (action === 'stop') {
      const stopJobId = (form.get('jobId') as string) || '';
      if (!stopJobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

      const { stopFile } = jobPaths(stopJobId);
      if (!(await fileExists(jobDir(stopJobId)))) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      await writeFile(stopFile, stopJobId, 'utf8');
      await writeState(stopJobId, { stopRequested: true });

      // Kill immediately (Windows-safe: use SIGTERM fallback)
      try {
        const state = await readState(stopJobId);
        if (state?.pid && isProcessAlive(state.pid)) {
          try {
            process.kill(state.pid, 'SIGKILL'); // may not exist on Windows
          } catch {
            process.kill(state.pid); // default signal
          }
          await writeState(stopJobId, {
            status: 'stopped',
            exitCode: 1,
            finishedAt: nowISO(),
            error: 'Stopped by user',
          });
        }
      } catch {}

      logDev('stop requested', { jobId: stopJobId });
      return NextResponse.json({ success: true, message: 'Stop requested', jobId: stopJobId });
    }

    // START
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'JSON file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    }

    // Validate env for script
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env as Record<
      string,
      string | undefined
    >;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Missing env', details: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    // Validate script exists
    const scriptPath = path.join(process.cwd(), 'scripts', 'import_ads_from_json.js');
    try {
      await access(scriptPath, FS.F_OK);
    } catch {
      return NextResponse.json({ error: 'Script not found', scriptPath }, { status: 500 });
    }

    const jobId = randomUUID();
    await mkdir(jobsDir(), { recursive: true });

    const { dir, inputPath, rawPath, reportPath, statePath } = jobPaths(jobId);
    await mkdir(dir, { recursive: true });

    // Save raw upload for debugging
    await writeFile(rawPath, buffer);

    // Parse + normalize to a clean JSON array
    let ads: ParsedAd[] = [];
    try {
      ads = await parseAnyJsonBuffer(buffer);
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      await writeFile(
        statePath,
        JSON.stringify({ jobId, status: 'failed', error: message }, null, 2),
        'utf8'
      );
      return NextResponse.json(
        { error: 'Invalid JSON', details: message || 'parse error' },
        { status: 400 }
      );
    }

    // Write normalized array to inputPath
    await writeFile(inputPath, JSON.stringify(ads), 'utf8');

    await writeFile(
      statePath,
      JSON.stringify(
        {
          jobId,
          status: 'queued',
          createdAt: nowISO(),
          reportPath,
          inputPath,
          rawPath,
          adsCount: ads.length,
          fileName: file.name,
          fileSize: buffer.byteLength,
          debug: !!enableDebug,
        },
        null,
        2
      ),
      'utf8'
    );

    logDev('job queued', { jobId, adsCount: ads.length, inputPath, reportPath });

    runImportScript(scriptPath, jobId, enableDebug).catch(async (e) => {
      const message = getErrorMessage(e);
      await writeState(jobId, { status: 'failed', error: `run error: ${message}` });
      logDev('runImportScript failed', { jobId, err: message });
    });

    return NextResponse.json(
      { success: true, message: 'Import started', jobId, adsCount: ads.length },
      { status: 202 }
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logDev('POST failed', message);
    return NextResponse.json({ error: 'Failed to run import', details: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  try {
    const state = await readState(jobId);

    // mark dead jobs
    if (state?.status === 'running' && state?.pid && !isProcessAlive(state.pid)) {
      const next = {
        ...state,
        status: state.stopRequested ? 'stopped' : 'failed',
        exitCode: state.exitCode ?? 1,
        finishedAt: state.finishedAt || nowISO(),
        error: state.error || 'Worker process is not running',
      };
      await writeState(jobId, next);
      return NextResponse.json(next);
    }

    const debugFlag = req.nextUrl.searchParams.get('debug');
    const enableDebug = !!debugFlag && (debugFlag === '1' || debugFlag === 'true');

    if (enableDebug) {
      const { stdoutPath, stderrPath, reportPath } = jobPaths(jobId);

      const stdout = (await fileExists(stdoutPath)) ? await readFile(stdoutPath, 'utf8') : '';
      const stderr = (await fileExists(stderrPath)) ? await readFile(stderrPath, 'utf8') : '';

      // file sizes can help to see if it's "stuck"
      let reportSize = 0;
      try {
        reportSize = (await stat(reportPath)).size;
      } catch {}

      return NextResponse.json({
        ...state,
        reportSize,
        stdoutTail: stdout.split('\n').slice(-200),
        stderrTail: stderr.split('\n').slice(-200),
      });
    }

    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
}
