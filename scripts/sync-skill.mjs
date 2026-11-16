import { readFile, writeFile, mkdir, access, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { skillFiles, listFiles, publicCopy, checkPublicText } from './skill-package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'plugins/projectdb/skills/projectdb-constructor');
const manifestPath = path.join(root, 'plugins/projectdb/plugin.json');
const { values } = parseArgs({ options: { source: { type: 'string' }, version: { type: 'string' } } });

try {
	if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(values.version ?? '')) {
		throw new Error('Use --version X.Y.Z (for example, --version 1.0.1).');
	}
	const source = path.resolve(values.source ?? path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'skills/projectdb-constructor'));
	if ((await lstat(source)).isSymbolicLink()) throw new Error('Use the actual source directory, not a symlink.');
	const target = path.resolve(destination);
	const relation = path.relative(source, target);
	if (!relation || (!relation.startsWith('..') && !path.isAbsolute(relation))) throw new Error('Source and package must be separate directories.');
	const files = await listFiles(source);
	if (JSON.stringify(files) !== JSON.stringify([...skillFiles].sort())) {
		throw new Error('Source file list changed. Review it and update skillFiles in scripts/skill-package.mjs before copying.');
	}
	const contents = [];
	for (const relative of skillFiles) {
		const text = publicCopy(relative, await readFile(path.join(source, relative), 'utf8'));
		checkPublicText(relative, text);
		contents.push([relative, text]);
	}
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	let installed = false;
	try { await access(path.join(destination, 'SKILL.md')); installed = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
	if (installed) {
		const existing = await listFiles(destination);
		if (JSON.stringify(existing) !== JSON.stringify([...skillFiles].sort())) throw new Error('Package has unexpected files; review them before synchronizing.');
		let changed = false;
		for (const [relative, text] of contents) if (await readFile(path.join(destination, relative), 'utf8') !== text) changed = true;
		if (!changed && values.version === manifest.version) {
			console.log(`No changes. ProjectDB ${manifest.version} is current.`);
			process.exit(0);
		}
		const before = manifest.version.split('.').map(Number);
		const after = values.version.split('.').map(Number);
		const index = after.findIndex((part, i) => part !== before[i]);
		if (index < 0 || after[index] <= before[index]) throw new Error(`New version must be greater than ${manifest.version}.`);
	}
	for (const [relative, text] of contents) {
		const output = path.join(destination, relative);
		await mkdir(path.dirname(output), { recursive: true });
		await writeFile(output, text, 'utf8');
	}
	manifest.version = values.version;
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
	console.log(`Prepared ProjectDB ${manifest.version}: ${contents.length} files. Review git diff, validate, then commit and push.`);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
