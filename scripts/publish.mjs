import { readFile, writeFile, open, unlink, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const manifestPath = 'plugins/projectdb/plugin.json';
const git = (args) => execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
	cwd: root, encoding: 'utf8', timeout: 30000,
	env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
});
export async function publish(values = {}) {
let lock;
const lockPath = path.join(tmpdir(), `projectdb-publish-${createHash('sha256').update(root).digest('hex').slice(0, 20)}.lock`);

try {
	const canonical = async (directory) => {
		const resolved = await realpath(directory);
		return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
	};
	if (await canonical(git(['rev-parse', '--show-toplevel']).trim()) !== await canonical(root)) throw new Error('This script must belong to the current Git checkout. Run setup-author.ps1 if the checkout is not initialized.');
	if (git(['branch', '--show-current']).trim() !== 'main') throw new Error('Publication requires the main branch.');
	if (values.auto && git(['config', '--get', 'projectdb.autoPublish']).trim() !== 'true') throw new Error('Automatic publication is not enabled by this repository owner.');
	if (git(['diff', '--cached', '--name-only']).trim()) throw new Error('The index already contains staged changes; review them before publishing.');
	const manifest = JSON.parse(await readFile(path.join(root, manifestPath), 'utf8'));
	const origin = git(['config', '--get', 'remote.origin.url']).trim().replace(/\.git$/, '').replace(/^git@github.com:/, 'https://github.com/');
	if (origin !== manifest.repository) throw new Error('The origin does not match plugin.json. Review the repository identity.');
	execFileSync(process.execPath, [path.join(root, 'scripts/validate.mjs')], { cwd: root, stdio: 'inherit' });
	const changed = git(['status', '--porcelain', '--untracked-files=all']).trim();
	const old = JSON.parse(git(['show', `HEAD:${manifestPath}`]));
	const pluginChanged = Boolean(git(['status', '--porcelain', '--untracked-files=all', '--', 'plugins/projectdb']).trim());
	if (pluginChanged && manifest.version === old.version) {
		const parts = old.version.split('.').map(Number);
		parts[2]++;
		manifest.version = parts.join('.');
	} else if (pluginChanged) {
		const before = old.version.split('.').map(Number);
		const after = manifest.version.split('.').map(Number);
		const index = after.findIndex((part, i) => part !== before[i]);
		if (index < 0 || after[index] <= before[index]) throw new Error('Plugin version must increase.');
	}
	if (values.check) {
		console.log(changed ? `Ready to publish ProjectDB ${manifest.version}.` : 'No working changes.');
		return;
	}
	lock = await open(lockPath, 'wx');
	git(['fetch', 'origin', 'main']);
	git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
	if (changed) {
		if (pluginChanged) await writeFile(path.join(root, manifestPath), `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
		git(['add', '--all', '--', '.']);
		git(['commit', '-m', `Update ProjectDB plugin to ${manifest.version}`]);
	}
	git(['push', 'origin', 'HEAD:refs/heads/main']);
	console.log(`Published ProjectDB ${manifest.version}.`);
} catch (error) {
	console.error(`Publication stopped: ${error.message}`);
	console.error('Keep the local changes. Resolve the reported issue and retry; do not force push.');
	throw error;
} finally {
	if (lock) { await lock.close(); await unlink(lockPath); }
}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { values } = parseArgs({ options: { auto: { type: 'boolean' }, check: { type: 'boolean' } } });
	try { await publish(values); } catch { process.exitCode = 1; }
}
